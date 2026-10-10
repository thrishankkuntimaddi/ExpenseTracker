//! A tiny reminder scheduler. The web app plans the notifications (copy, days,
//! skip rules) and hands them over; this thread just delivers them on time —
//! even while the window is closed and the app lives in the menu bar / tray.

use serde::Deserialize;
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};
use tauri_plugin_notification::NotificationExt;

#[derive(Debug, Clone, Deserialize)]
pub struct Reminder {
    #[allow(dead_code)] // kept for debugging
    pub id: i64,
    pub at: i64, // epoch ms
    pub title: String,
    pub body: String,
}

pub type SharedReminders = Arc<Mutex<Vec<Reminder>>>;

/// Ignore reminders whose time passed long ago (e.g. the computer was asleep).
const STALE_MS: i64 = 15 * 60 * 1000;

fn now_ms() -> i64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as i64).unwrap_or(0)
}

pub fn notify(app: &AppHandle, title: &str, body: &str) {
    let _ = app.notification().builder().title(title).body(body).show();
}

/// The user is busy in the app: its window is on screen and focused.
fn busy_in_app(app: &AppHandle) -> bool {
    app.get_webview_window("main")
        .map(|w| w.is_visible().unwrap_or(false) && w.is_focused().unwrap_or(false))
        .unwrap_or(false)
}

/// Split `items` into the ones due at `now` (still fresh) and the rest.
pub fn take_due(items: &mut Vec<Reminder>, now: i64) -> Vec<Reminder> {
    let (due, later): (Vec<_>, Vec<_>) = items.drain(..).partition(|r| r.at <= now);
    *items = later;
    due.into_iter().filter(|r| now - r.at < STALE_MS).collect()
}

pub fn start(app: AppHandle, list: SharedReminders) {
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_secs(20));
        let due = take_due(&mut list.lock().unwrap(), now_ms());
        if due.is_empty() || busy_in_app(&app) {
            continue; // nothing due, or the user is looking at the app right now
        }
        for r in due {
            notify(&app, &r.title, &r.body);
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    fn r(at: i64) -> Reminder { Reminder { id: at, at, title: String::new(), body: String::new() } }

    #[test]
    fn delivers_due_skips_stale_keeps_future() {
        let now = 10_000_000;
        let mut items = vec![r(now - 1_000), r(now - STALE_MS - 1), r(now + 60_000)];
        let due = take_due(&mut items, now);
        assert_eq!(due.len(), 1);
        assert_eq!(due[0].at, now - 1_000);
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].at, now + 60_000);
    }
}
