use std::time::Duration;
use tauri::Manager;

// ── Win32: minimize EVERY top-level window so only sansxel is visible
// during boot. We do this by sending the Win+M hotkey via SendInput,
// which is what Windows itself uses for "Minimize all windows" — far
// more reliable than EnumWindows + ShowWindow because the shell
// handles edge cases (UWP, modern apps, secured windows) for us.
//
// Win+M minimizes everything *including* our splash, so we re-show
// the splash a moment later.
#[cfg(target_os = "windows")]
mod win {
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
        SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP,
        VIRTUAL_KEY, VK_LWIN, VK_M,
    };

    unsafe fn key_input(vk: VIRTUAL_KEY, key_up: bool) -> INPUT {
        INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: vk,
                    wScan: 0,
                    dwFlags: if key_up { KEYEVENTF_KEYUP } else { 0 },
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        }
    }

    pub fn minimize_all() {
        unsafe {
            let mut inputs = [
                key_input(VK_LWIN, false),
                key_input(VK_M, false),
                key_input(VK_M, true),
                key_input(VK_LWIN, true),
            ];
            SendInput(
                inputs.len() as u32,
                inputs.as_mut_ptr(),
                std::mem::size_of::<INPUT>() as i32,
            );
        }
    }
}

#[cfg(not(target_os = "windows"))]
mod win {
    pub fn minimize_all() {}
}

#[tauri::command]
fn minimize_other_windows(app: tauri::AppHandle) {
    // Step 1: minimize everything (Win+M hits us too)
    win::minimize_all();
    eprintln!("[sansxel] sent minimize-all (Win+M)");

    // Step 2: bring our splash back so the launcher stays visible.
    // 80ms is enough for the shell to finish processing the hotkey.
    let app_handle = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(80));
        if let Some(splash) = app_handle.get_webview_window("splash") {
            let _ = splash.unminimize();
            let _ = splash.show();
            let _ = splash.set_focus();
        }
    });
}

// ── Window mode: pin the main window to a screen edge as a toolbar
//
// Modes:
//   normal       — 1200x800 centered, not always-on-top
//   toolbar-top  — full-width strip at the top of the primary display
//   toolbar-left — narrow column anchored to the left edge
//   toolbar-right — narrow column anchored to the right edge
//
// Used during interviews / studying / recording when sansxel needs to
// stay visible alongside another fullscreen app.
#[tauri::command]
fn set_window_mode(app: tauri::AppHandle, mode: String) -> Result<(), String> {
    use tauri::{LogicalPosition, LogicalSize};

    let win = match app.get_webview_window("main") {
        Some(w) => w,
        None => return Ok(()),
    };

    let monitor = win.current_monitor().map_err(|e| e.to_string())?;
    let (mw, mh) = if let Some(m) = monitor {
        let s = m.size();
        let scale = m.scale_factor();
        (s.width as f64 / scale, s.height as f64 / scale)
    } else {
        (1920.0, 1080.0)
    };

    match mode.as_str() {
        "toolbar-top" => {
            let _ = win.set_always_on_top(true);
            let _ = win.set_size(LogicalSize::new(mw, 96.0));
            let _ = win.set_position(LogicalPosition::new(0.0, 0.0));
        }
        "toolbar-left" => {
            let _ = win.set_always_on_top(true);
            let _ = win.set_size(LogicalSize::new(440.0, mh));
            let _ = win.set_position(LogicalPosition::new(0.0, 0.0));
        }
        "toolbar-right" => {
            let _ = win.set_always_on_top(true);
            let _ = win.set_size(LogicalSize::new(440.0, mh));
            let _ = win.set_position(LogicalPosition::new(mw - 440.0, 0.0));
        }
        _ => {
            // normal — back to a standard centered window
            let _ = win.set_always_on_top(false);
            let _ = win.set_size(LogicalSize::new(1200.0, 800.0));
            let _ = win.center();
        }
    }

    Ok(())
}

// Splash window calls this when its boot sequence finishes.
//
// Order matters: show the main window FIRST (it appears under the
// always-on-top splash, so the user doesn't see it yet), THEN close
// the splash. The result is a zero-frame handover — the splash
// vanishes and the main is already there underneath.
#[tauri::command]
fn boot_complete(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.show();
        let _ = main.set_focus();
    }
    if let Some(splash) = app.get_webview_window("splash") {
        let _ = splash.close();
    }
    Ok(())
}

// Hard watchdog: if the splash hasn't called boot_complete within 15s
// (JS crashed, infinite loop, anything), force the handover. This is
// the safety net that guarantees the user can never get stuck staring
// at a launcher that won't go away.
fn schedule_splash_watchdog(app_handle: tauri::AppHandle) {
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_secs(15));
        if app_handle.get_webview_window("splash").is_some() {
            eprintln!("[sansxel] splash watchdog firing — forcing main window");
            if let Some(splash) = app_handle.get_webview_window("splash") {
                let _ = splash.close();
            }
            if let Some(main) = app_handle.get_webview_window("main") {
                let _ = main.show();
                let _ = main.set_focus();
            }
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    // Single-instance MUST be the first plugin registered — it
    // intercepts the second launch before any other Tauri code runs.
    // The deep-link feature on this plugin auto-forwards the
    // sansxel://... URL to the original instance's deep-link handler.
    #[cfg(any(target_os = "windows", target_os = "linux"))]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(
            |app, _args, _cwd| {
                // Bring the running app forward when someone tries to
                // launch a second copy. The URL itself is delivered to
                // onOpenUrl by the deep-link plugin separately.
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.unminimize();
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            },
        ));
    }

    builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_deep_link::init())
        .invoke_handler(tauri::generate_handler![
            boot_complete,
            minimize_other_windows,
            set_window_mode
        ])
        .setup(|app| {
            // Dev/Linux: register the sansxel:// scheme at runtime so the
            // OS routes sansxel:// URLs back to us. On Windows installers
            // the scheme is registered at install time via the bundle
            // config, so this is a no-op there in production.
            #[cfg(any(windows, target_os = "linux"))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                let _ = app.deep_link().register("sansxel");
            }

            schedule_splash_watchdog(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
