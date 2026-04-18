use std::time::Duration;
use tauri::Manager;

// ── Win32: minimize every other top-level window so only the splash is
// visible during boot. The user can restore them via taskbar/Alt-Tab
// after the app comes up. We never minimize anything we ourselves own.
#[cfg(target_os = "windows")]
mod win {
    use std::sync::atomic::{AtomicUsize, Ordering};
    use windows_sys::Win32::Foundation::{BOOL, HWND, LPARAM};
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        EnumWindows, GetWindowLongPtrW, GetWindowTextLengthW, GetWindowThreadProcessId,
        IsIconic, IsWindowVisible, ShowWindowAsync, GWL_EXSTYLE, SW_MINIMIZE, WS_EX_TOOLWINDOW,
    };

    unsafe extern "system" fn enum_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let counter = &*(lparam as *const Counters);

        let mut window_pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, &mut window_pid);

        // Skip our own windows
        if window_pid == counter.our_pid {
            return 1;
        }
        // Skip invisible
        if IsWindowVisible(hwnd) == 0 {
            return 1;
        }
        // Skip already-minimized
        if IsIconic(hwnd) != 0 {
            return 1;
        }
        // Skip tool windows (popups, tooltips, etc.)
        let ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32;
        if ex_style & WS_EX_TOOLWINDOW != 0 {
            return 1;
        }
        // Skip windows without a title (background/desktop hosts)
        if GetWindowTextLengthW(hwnd) == 0 {
            return 1;
        }

        // Async so we don't block on any single window's WndProc
        ShowWindowAsync(hwnd, SW_MINIMIZE);
        counter.minimized.fetch_add(1, Ordering::Relaxed);
        1 // continue enumeration
    }

    struct Counters {
        our_pid: u32,
        minimized: AtomicUsize,
    }

    pub fn minimize_others() -> usize {
        let counters = Counters {
            our_pid: std::process::id(),
            minimized: AtomicUsize::new(0),
        };
        unsafe {
            EnumWindows(
                Some(enum_proc),
                &counters as *const Counters as LPARAM,
            );
        }
        counters.minimized.load(Ordering::Relaxed)
    }
}

#[cfg(not(target_os = "windows"))]
mod win {
    pub fn minimize_others() -> usize {
        0
    }
}

#[tauri::command]
fn minimize_other_windows() -> usize {
    let count = win::minimize_others();
    eprintln!("[sansxel] minimize_other_windows minimized {} window(s)", count);
    count
}

// Splash window calls this when its boot sequence finishes.
//
// Sequence: close the splash immediately (it has already faded its
// content to black on the JS side), hold a brief 500ms blackout, then
// reveal the main window.
#[tauri::command]
fn boot_complete(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(splash) = app.get_webview_window("splash") {
        let _ = splash.close();
    }

    let app_handle = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(500));
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
