use std::time::Duration;
use tauri::Manager;

// ── Win32: minimize every other top-level window so only the splash is
// visible during boot. The user can restore them via taskbar/Alt-Tab
// after the app comes up. We never minimize anything we ourselves own.
#[cfg(target_os = "windows")]
mod win {
    use windows_sys::Win32::Foundation::{BOOL, HWND, LPARAM};
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        EnumWindows, GetWindowThreadProcessId, IsWindowVisible, ShowWindow, SW_MINIMIZE,
    };

    unsafe extern "system" fn enum_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let our_pid = lparam as u32;
        let mut window_pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, &mut window_pid);

        if window_pid != our_pid && IsWindowVisible(hwnd) != 0 {
            ShowWindow(hwnd, SW_MINIMIZE);
        }
        1 // continue enumeration
    }

    pub fn minimize_others() {
        unsafe {
            let our_pid = std::process::id();
            EnumWindows(Some(enum_proc), our_pid as LPARAM);
        }
    }
}

#[cfg(not(target_os = "windows"))]
mod win {
    pub fn minimize_others() {}
}

#[tauri::command]
fn minimize_other_windows() {
    win::minimize_others();
}

// Splash window calls this when its boot sequence finishes.
//
// Sequence: close the splash *immediately* (it has already faded its
// content to black on the JS side), then hold a dark gap for 2.4s
// before revealing the main window. That gap is the "launcher gone,
// app booting" moment.
#[tauri::command]
fn boot_complete(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(splash) = app.get_webview_window("splash") {
        let _ = splash.close();
    }

    let app_handle = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(2400));
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
