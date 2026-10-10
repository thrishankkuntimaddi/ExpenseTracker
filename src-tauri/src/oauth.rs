//! Google sign-in for the desktop app.
//!
//! Google refuses to show its sign-in page inside embedded web views, so the
//! desktop app uses the "installed app" flow: open the user's normal browser,
//! and catch the redirect on a one-off loopback port (http://127.0.0.1:PORT).
//! The page builds the URL (with PKCE) and exchanges the code itself; this
//! only opens the browser and returns what Google sent back.

use std::io::{BufRead, BufReader, Write};
use std::net::TcpListener;
use std::sync::mpsc;
use std::time::Duration;

use serde::Serialize;
use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoopbackResult {
    pub redirect_uri: String,
    /// The raw query string Google redirected with (code, state, or error)
    pub query: String,
}

const DONE_PAGE: &str = "<!doctype html><meta charset=utf-8><title>Expense Tracker</title>\
<body style=\"font:16px -apple-system,Segoe UI,sans-serif;display:grid;place-items:center;height:90vh;margin:0;background:#E4E5EA;color:#1D1D1F\">\
<div style=\"text-align:center\"><h2 style=\"margin:0 0 8px\">You're signed in</h2>\
<p style=\"margin:0;color:#555\">You can close this tab and return to Expense Tracker.</p></div>";

/// `auth_url` must contain `__REDIRECT_URI__`, replaced by the loopback address.
pub fn loopback(app: &AppHandle, auth_url: &str, timeout: Duration) -> Result<LoopbackResult, String> {
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| format!("Couldn't open a local port: {e}"))?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    let redirect_uri = format!("http://127.0.0.1:{port}");
    let url = auth_url.replace("__REDIRECT_URI__", &urlencode(&redirect_uri));
    app.opener().open_url(url, None::<&str>).map_err(|e| format!("Couldn't open the browser: {e}"))?;

    let (tx, rx) = mpsc::channel();
    std::thread::spawn(move || {
        // Browsers may also ask for /favicon.ico — wait for the request that carries the result
        for stream in listener.incoming().flatten() {
            let mut stream = stream;
            let mut line = String::new();
            if BufReader::new(&stream).read_line(&mut line).is_err() { continue; }
            let path = line.split_whitespace().nth(1).unwrap_or("");
            let query = path.split_once('?').map(|(_, q)| q.to_string()).unwrap_or_default();
            if query.contains("code=") || query.contains("error=") {
                let _ = write!(stream, "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nConnection: close\r\nContent-Length: {}\r\n\r\n{}", DONE_PAGE.len(), DONE_PAGE);
                let _ = tx.send(query);
                break;
            }
            let _ = write!(stream, "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
        }
    });
    let query = rx.recv_timeout(timeout).map_err(|_| "Sign-in timed out — try again.".to_string())?;
    Ok(LoopbackResult { redirect_uri, query })
}

fn urlencode(s: &str) -> String {
    s.bytes().map(|b| match b {
        b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => (b as char).to_string(),
        _ => format!("%{b:02X}"),
    }).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn encodes_loopback_uri() {
        assert_eq!(urlencode("http://127.0.0.1:5123"), "http%3A%2F%2F127.0.0.1%3A5123");
    }
}
