//! Expense Tracker — desktop shell (Tauri).
//!
//! Runs the same web app as the website inside the system's own web view
//! (WKWebView / WebView2 / WebKitGTK), so the download is a few MB instead
//! of 100+. Adds what a browser tab can't: one instance only, and a menu bar
//! / system tray icon so the app stays ready after its window is closed.

mod oauth;
mod reminders;

use std::time::Duration;

use reminders::{Reminder, SharedReminders};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, RunEvent, State, WindowEvent,
};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};

#[tauri::command]
fn app_version(app: AppHandle) -> String {
    app.package_info().version.to_string()
}

/// Desktop Google sign-in: open the browser, wait for the loopback redirect.
/// Runs off the main thread (it waits up to 5 minutes for the user).
#[tauri::command]
async fn google_oauth_loopback(app: AppHandle, auth_url: String) -> Result<oauth::LoopbackResult, String> {
    tauri::async_runtime::spawn_blocking(move || oauth::loopback(&app, &auth_url, Duration::from_secs(300)))
        .await
        .map_err(|e| e.to_string())?
}

/// The web app hands over the next 14 days of reminders (replaces the list).
#[tauri::command]
fn set_reminders(list: State<'_, SharedReminders>, items: Vec<Reminder>) {
    *list.lock().unwrap() = items;
}

#[tauri::command]
fn show_notification(app: AppHandle, title: String, body: String) {
    reminders::notify(&app, &title, &body);
}

#[tauri::command]
fn get_autostart(app: AppHandle) -> bool {
    app.autolaunch().is_enabled().unwrap_or(false)
}

/// Returns the state actually in effect afterwards.
#[tauri::command]
fn set_autostart(app: AppHandle, on: bool) -> bool {
    let manager = app.autolaunch();
    let _ = if on { manager.enable() } else { manager.disable() };
    manager.is_enabled().unwrap_or(false)
}

/// Debug self-test: the page reports what every bridge call returned.
#[tauri::command]
fn selftest_report(app: AppHandle, report: String) {
    println!("SELFTEST {report}");
    if std::env::var("EXPENSETRACKER_SELFTEST").is_ok() {
        app.exit(0);
    }
}

fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

pub fn run() {
    let reminders_list: SharedReminders = Default::default();

    let app = tauri::Builder::default()
        // A second launch focuses the running app instead of opening another copy
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| show_main(app)))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        // Open at login starts quietly in the tray (--hidden)
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, Some(vec!["--hidden"])))
        .manage(reminders_list.clone())
        .invoke_handler(tauri::generate_handler![
            app_version,
            google_oauth_loopback,
            set_reminders,
            show_notification,
            get_autostart,
            set_autostart,
            selftest_report
        ])
        .setup(move |app| {
            // Menu bar / system tray: the app stays ready after the window closes
            let open = MenuItem::with_id(app, "open", "Open Expense Tracker", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &quit])?;
            TrayIconBuilder::with_id("main")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Expense Tracker")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, e| match e.id.as_ref() {
                    "open" => show_main(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, e| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = e {
                        show_main(tray.app_handle());
                    }
                })
                .build(app)?;

            // Launched at login → start quietly in the tray
            if std::env::args().any(|a| a == "--hidden") {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.hide();
                }
            }

            reminders::start(app.handle().clone(), reminders_list.clone());

            #[cfg(debug_assertions)]
            if std::env::var("EXPENSETRACKER_SELFTEST").is_ok() {
                let handle = app.handle().clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_secs(6));
                    if let Some(w) = handle.get_webview_window("main") {
                        // EXPENSETRACKER_SELFTEST=signup also signs up a throwaway user
                        // (only meaningful against the local Firebase emulators)
                        let signup = std::env::var("EXPENSETRACKER_SELFTEST").as_deref() == Ok("signup");
                        let _ = w.eval(&format!("window.__ET_SELFTEST_SIGNUP = {signup};"));
                        let _ = w.eval(include_str!("selftest.js"));
                    }
                });
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing the window hides it; the app stays ready in the tray
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building Expense Tracker");

    app.run(|_app, event| {
        // macOS: clicking the Dock icon brings the hidden window back
        #[cfg(target_os = "macos")]
        if let RunEvent::Reopen { .. } = event {
            show_main(_app);
        }
        #[cfg(not(target_os = "macos"))]
        let _ = event;
    });
}
