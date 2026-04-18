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

// Splash window calls this when its boot sequence finishes.
//
// Sequence: close the splash immediately (it has already faded its
// content to black on the JS side), hold a brief 150ms blackout, then
// reveal the main window.
#[tauri::command]
fn boot_complete(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(splash) = app.get_webview_window("splash") {
        let _ = splash.close();
    }

    let app_handle = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(150));
        if let Some(main) = app_handle.get_webview_window("main") {
            let _ = main.show();
            let _ = main.set_focus();
        }
    });

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
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![boot_complete, minimize_other_windows])
        .setup(|app| {
            schedule_splash_watchdog(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
