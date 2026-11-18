// SPDX-License-Identifier: GPL-3.0-only
//! Main window creation shared by desktop (after the migration decision) and mobile.

use tauri::{AppHandle, Manager, Runtime, WebviewWindowBuilder};

/// Creates the main window from `tauri.conf.json` (`"create": false`, label `main`).
pub fn open_main_window<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    if app.get_webview_window("main").is_some() {
        return Ok(());
    }
    let config = app
        .config()
        .app
        .windows
        .iter()
        .find(|w| w.label == "main")
        .cloned()
        .ok_or_else(|| tauri::Error::WindowNotFound)?;
    WebviewWindowBuilder::from_config(app, &config)?.build().map(|_| ())
}
