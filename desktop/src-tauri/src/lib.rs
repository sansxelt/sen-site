use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use tauri::Manager;

// Set true by main.tsx via notify_main_ready once React + session
// restore have settled. Splash polls is_main_ready before closing
// itself so the user never sees a black gap between splash and the
// main UI. Static so commands can read/write without juggling state.
static MAIN_READY: AtomicBool = AtomicBool::new(false);

#[tauri::command]
fn notify_main_ready() {
    MAIN_READY.store(true, Ordering::SeqCst);
}

#[tauri::command]
fn is_main_ready() -> bool {
    MAIN_READY.load(Ordering::SeqCst)
}

// v0.1.7 — triple-Esc handler in the main app calls this to revisit
// the splash mini-game. Hides main, re-creates the splash window if
// it was closed, and resets MAIN_READY so the splash poll loop
// re-engages.
#[tauri::command]
fn revisit_splash(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::WebviewUrl;
    use tauri::webview::WebviewWindowBuilder;

    MAIN_READY.store(false, Ordering::SeqCst);

    if let Some(main) = app.get_webview_window("main") {
        let _ = main.hide();
    }

    if let Some(splash) = app.get_webview_window("splash") {
        let _ = splash.show();
        let _ = splash.set_focus();
        let _ = splash.set_always_on_top(true);
        return Ok(());
    }

    // Splash was closed by boot_complete \u2014 recreate it.
    let _ = WebviewWindowBuilder::new(
        &app,
        "splash",
        WebviewUrl::App("splash.html".into()),
    )
    .title("sansxel")
    .inner_size(720.0, 420.0)
    .decorations(false)
    .resizable(false)
    .center()
    .skip_taskbar(true)
    .always_on_top(true)
    .focused(true)
    .build()
    .map_err(|e| format!("revisit splash: {e}"))?;
    Ok(())
}

// ── Win32: minimize EVERY top-level window so only sansxel is visible
// during boot. v0.1.4 uses a two-pronged approach:
//   1. EnumWindows + ShowWindow(SW_FORCEMINIMIZE) walks every visible
//      top-level window, skipping our own. This catches stubborn apps
//      that ignore Win+M (Chromium, Electron, some games).
//   2. Win+M as a fallback for shell-managed cases.
// Plus splash auto-focus so [Space] works without needing the user
// to click the splash first.
#[cfg(target_os = "windows")]
mod win {
    use windows_sys::Win32::Foundation::{BOOL, HWND, LPARAM, TRUE};
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
        SendInput, SetFocus, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT,
        KEYEVENTF_KEYUP, VIRTUAL_KEY, VK_LWIN, VK_M,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        EnumWindows, GetWindowThreadProcessId, IsIconic, IsWindowVisible,
        SetForegroundWindow, ShowWindow, SW_FORCEMINIMIZE,
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

    pub fn send_win_m() {
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

    // EnumWindows callback: minimize every visible top-level window
    // that doesn't belong to our process.
    unsafe extern "system" fn minimize_callback(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let our_pid = lparam as u32;
        if IsWindowVisible(hwnd) == 0 {
            return TRUE;
        }
        if IsIconic(hwnd) != 0 {
            return TRUE; // already minimized
        }
        let mut window_pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, &mut window_pid);
        if window_pid == our_pid {
            return TRUE; // our own window, skip
        }
        ShowWindow(hwnd, SW_FORCEMINIMIZE);
        TRUE
    }

    pub fn minimize_all_other_windows() {
        unsafe {
            let our_pid = std::process::id();
            EnumWindows(Some(minimize_callback), our_pid as LPARAM);
        }
    }

    pub fn force_focus(hwnd: HWND) {
        unsafe {
            SetForegroundWindow(hwnd);
            SetFocus(hwnd);
        }
    }
}

#[cfg(target_os = "windows")]
mod copilot_win {
    use windows_sys::Win32::Foundation::HWND;
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        SetWindowDisplayAffinity, WDA_EXCLUDEFROMCAPTURE, WDA_NONE,
    };

    // WDA_EXCLUDEFROMCAPTURE makes the window invisible to screen
    // recorders / share tools (OBS, Zoom, screenshot, etc.). Used
    // for the copilot's "Stealth" toggle so interview-mode use
    // doesn't leak the assistant content into recorded streams.
    pub fn set_capture_excluded(hwnd: HWND, excluded: bool) {
        unsafe {
            let affinity = if excluded {
                WDA_EXCLUDEFROMCAPTURE
            } else {
                WDA_NONE
            };
            SetWindowDisplayAffinity(hwnd, affinity);
        }
    }
}

#[cfg(not(target_os = "windows"))]
mod copilot_win {
    pub fn set_capture_excluded(_hwnd: usize, _excluded: bool) {}
}

// ── v0.1.11 — Live Mode foreground-window watcher ───────────────────
// Reads the title of the currently focused top-level window so the
// Capsule Rail can offer context-aware hints ("Summarize this page",
// "Fix this code", etc.). Privacy-critical: only ever reads the
// WINDOW TITLE (no contents), only when the user has consented in
// the Capsule's first-launch dialog, and skips windows that belong
// to our own process so we never echo our own UI back as context.
#[cfg(target_os = "windows")]
mod live_mode {
    use windows_sys::Win32::Foundation::HWND;
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowTextLengthW, GetWindowTextW,
        GetWindowThreadProcessId,
    };

    pub fn foreground_title() -> Option<String> {
        unsafe {
            let hwnd: HWND = GetForegroundWindow();
            if hwnd.is_null() {
                return None;
            }
            // Skip if the foreground window is ours — we don't want
            // sansxel to suggest "fix sansxel" when the user is just
            // looking at the rail itself.
            let mut window_pid: u32 = 0;
            GetWindowThreadProcessId(hwnd, &mut window_pid);
            if window_pid == std::process::id() {
                return None;
            }
            let len = GetWindowTextLengthW(hwnd);
            if len <= 0 {
                return None;
            }
            // +1 for the null terminator GetWindowTextW writes.
            let mut buf: Vec<u16> = vec![0; (len as usize) + 1];
            let copied = GetWindowTextW(hwnd, buf.as_mut_ptr(), buf.len() as i32);
            if copied <= 0 {
                return None;
            }
            let title = String::from_utf16_lossy(&buf[..copied as usize]);
            let trimmed = title.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            }
        }
    }
}

#[cfg(not(target_os = "windows"))]
mod live_mode {
    pub fn foreground_title() -> Option<String> {
        None
    }
}

// Returns the title of the currently focused top-level window, or
// null when there isn't one (or we're on a non-Windows build). The
// JS side polls this every ~800ms while Live Mode is enabled.
#[tauri::command]
fn get_foreground_window_title() -> Option<String> {
    live_mode::foreground_title()
}

#[cfg(not(target_os = "windows"))]
mod win {
    pub fn send_win_m() {}
    pub fn minimize_all_other_windows() {}
    pub fn force_focus(_hwnd: usize) {}
}

#[tauri::command]
fn minimize_other_windows(app: tauri::AppHandle) {
    // Aggressive: walk every top-level window and force-minimize the
    // ones that don't belong to us. Catches Chromium / Electron apps
    // that ignore Win+M.
    win::minimize_all_other_windows();
    // Fallback: also fire Win+M for shell-managed cases. This minimizes
    // our splash too, so we re-show it below.
    win::send_win_m();
    eprintln!("[sansxel] minimize-all complete");

    let app_handle = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(80));
        if let Some(splash) = app_handle.get_webview_window("splash") {
            let _ = splash.unminimize();
            let _ = splash.show();
            let _ = splash.set_focus();
            // Force foreground so [Space] keypresses route to splash
            // immediately, no manual click required.
            #[cfg(target_os = "windows")]
            {
                if let Ok(hwnd) = splash.hwnd() {
                    win::force_focus(hwnd.0 as windows_sys::Win32::Foundation::HWND);
                }
            }
        }
    });
}

// Lock the splash on top of everything during boot. Called from
// splash.html on load. Uses Win32 SetWindowPos to make it topmost
// and SetForegroundWindow to grab focus so keystrokes land on it.
#[tauri::command]
fn lock_splash_focus(app: tauri::AppHandle) {
    if let Some(splash) = app.get_webview_window("splash") {
        let _ = splash.set_always_on_top(true);
        let _ = splash.show();
        let _ = splash.set_focus();
        #[cfg(target_os = "windows")]
        {
            if let Ok(hwnd) = splash.hwnd() {
                win::force_focus(hwnd.0 as windows_sys::Win32::Foundation::HWND);
            }
        }
    }
}

// ── Floating Copilot window control ────────────────────────────────
// The copilot window is a separate top-level Tauri window that floats
// above everything. It has two visual sizes:
//   - collapsed: a capsule on the chosen edge
//   - open: a panel (vertical for left/right, horizontal command bar
//     for top/bottom)
// We resize + reposition based on `edge` (left/right/top/bottom) and
// `open`.
//
// v0.1.8 Capsule Rail spec:
//   - Vertical edges (left/right): tall narrow capsule, opens
//     horizontally inward to a 388px panel
//   - Top/Bottom: full-width horizontal bar, opens DOWNWARD (or
//     UPWARD for bottom) into a command-bar style panel
//
// Multi-monitor stub: we log the secondary monitor count so future
// versions can let the user pick which display the rail lives on.
#[tauri::command]
fn position_copilot_window(
    app: tauri::AppHandle,
    edge: String,
    open: bool,
) -> Result<(), String> {
    use tauri::{LogicalPosition, LogicalSize};
    let win = app
        .get_webview_window("copilot")
        .ok_or_else(|| "copilot window not found".to_string())?;

    let monitor = win
        .current_monitor()
        .map_err(|e| format!("monitor: {e}"))?
        .ok_or_else(|| "no monitor".to_string())?;
    let scale = monitor.scale_factor();
    let mw = monitor.size().width as f64 / scale;
    let mh = monitor.size().height as f64 / scale;

    // Multi-monitor stub: count how many displays are attached so we
    // can later add per-display preferences. Only logged for now.
    if let Ok(monitors) = app.available_monitors() {
        let secondary_count = monitors.len().saturating_sub(1);
        if secondary_count > 0 {
            eprintln!(
                "[sansxel] copilot: detected {secondary_count} secondary monitor(s)"
            );
        }
    }

    // Sizing per edge + state:
    //   left/right collapsed: 180px wide capsule rail full-height
    //   left/right open:      388px wide panel full-height
    //   top collapsed:        full-width 56px tall bar at top
    //   top open:             full-width 388px tall command panel
    //   bottom collapsed:     full-width 56px tall bar at bottom
    //   bottom open:          full-width 388px tall command panel
    let (w, h, x, y) = match (edge.as_str(), open) {
        ("right", true) => (388.0_f64, mh - 24.0, mw - 388.0, 12.0),
        ("right", false) => (180.0, mh - 24.0, mw - 180.0, 12.0),
        ("left", true) => (388.0, mh - 24.0, 0.0, 12.0),
        ("left", false) => (180.0, mh - 24.0, 0.0, 12.0),
        ("top", true) => (mw, 388.0, 0.0, 0.0),
        ("top", false) => (mw, 56.0, 0.0, 0.0),
        ("bottom", true) => (mw, 388.0, 0.0, mh - 388.0),
        ("bottom", false) => (mw, 56.0, 0.0, mh - 56.0),
        _ => (180.0, mh - 24.0, mw - 180.0, 12.0),
    };

    let _ = win.set_size(LogicalSize::new(w, h));
    let _ = win.set_position(LogicalPosition::new(x, y));
    Ok(())
}

#[tauri::command]
fn show_copilot(app: tauri::AppHandle) -> Result<(), String> {
    let win = app
        .get_webview_window("copilot")
        .ok_or_else(|| "copilot window not found".to_string())?;
    let _ = win.show();
    let _ = win.set_focus();
    Ok(())
}

#[tauri::command]
fn hide_copilot(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("copilot") {
        let _ = win.hide();
    }
    Ok(())
}

// Stream-proof toggle. When enabled, screen recorders see a black
// rectangle where the copilot window is. When disabled, normal.
#[tauri::command]
fn set_copilot_stream_proof(
    app: tauri::AppHandle,
    enabled: bool,
) -> Result<(), String> {
    let win = app
        .get_webview_window("copilot")
        .ok_or_else(|| "copilot window not found".to_string())?;
    #[cfg(target_os = "windows")]
    {
        if let Ok(hwnd) = win.hwnd() {
            copilot_win::set_capture_excluded(
                hwnd.0 as windows_sys::Win32::Foundation::HWND,
                enabled,
            );
        }
    }
    Ok(())
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
// always-on-top splash, so the user doesn't see it yet), THEN hide
// the splash. The result is a zero-frame handover \u2014 the splash
// vanishes and the main is already there underneath.
//
// v0.1.13 fix: HIDE the splash instead of CLOSING it. Closing
// destroys the webview, so revisit_splash had to recreate a brand
// new one with a fresh WebviewWindowBuilder \u2014 which doesn't carry
// the original background_color from tauri.conf.json, so users hit
// ESC\u00d7\u00d73 and saw a white screen while the new HTML loaded.
// Hiding keeps the original webview + its dark bg + its loaded HTML
// alive, so revisit is instant and visually correct.
#[tauri::command]
fn boot_complete(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.show();
        let _ = main.set_focus();
    }
    if let Some(splash) = app.get_webview_window("splash") {
        let _ = splash.hide();
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
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        // v0.1.14 \u2014 global hotkey support (Ctrl+Space summons the
        // floating copilot from anywhere). Registration of the actual
        // shortcut happens below in setup().
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            boot_complete,
            minimize_other_windows,
            lock_splash_focus,
            set_window_mode,
            position_copilot_window,
            show_copilot,
            hide_copilot,
            set_copilot_stream_proof,
            notify_main_ready,
            is_main_ready,
            revisit_splash,
            get_foreground_window_title
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

            // v0.1.14 \u2014 register the Ctrl+Space global hotkey so the
            // floating copilot can be summoned from any app. The
            // handler shows the copilot window + brings it to front.
            #[cfg(desktop)]
            {
                use tauri_plugin_global_shortcut::{
                    Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState,
                };
                let app_handle = app.handle().clone();
                let shortcut = Shortcut::new(Some(Modifiers::CONTROL), Code::Space);
                if let Err(e) = app.global_shortcut().on_shortcut(shortcut, move |_app, _scut, event| {
                    if event.state() == ShortcutState::Pressed {
                        if let Some(copilot) = app_handle.get_webview_window("copilot") {
                            let _ = copilot.show();
                            let _ = copilot.set_focus();
                            let _ = copilot.set_always_on_top(true);
                        }
                    }
                }) {
                    eprintln!("[sansxel] global shortcut register failed: {e}");
                }
            }

            schedule_splash_watchdog(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
