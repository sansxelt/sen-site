use std::time::Duration;
use tauri::Manager;

// Splash window calls this when its boot sequence finishes.
//
// Sequence: close the splash *immediately* (it has already faded its
// content to black on the JS side), then hold a dark gap for 2.4s
// before revealing the main window. That gap is the "launcher gone,
// app booting" moment — same beat as Fortnite / Solara launchers.
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![boot_complete])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
