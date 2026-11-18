// SPDX-License-Identifier: GPL-3.0-only
//! Platform folders for the legacy and new identifiers (research R1, verification S1).

use super::record::{SOURCE_IDENTIFIER, TARGET_IDENTIFIER};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TargetKind {
    /// App data folder (`books/`, plugin stores; on Linux also the WebKitGTK data).
    DataDir,
    /// macOS WKWebsiteDataStore (`~/Library/WebKit/<id>/WebsiteData`).
    WebviewStore,
}

#[derive(Debug, Clone)]
pub struct CopyPair {
    pub kind: TargetKind,
    pub source: PathBuf,
    pub target: PathBuf,
    /// Top-level folder names inside `source` that are caches and are not migrated.
    pub excludes: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct MigrationPaths {
    pub pairs: Vec<CopyPair>,
    /// Folder that holds `migration-v1.json` (the new app data folder).
    pub record_dir: PathBuf,
    /// New-identifier folders emptied by "discard migration result".
    pub discard_dirs: Vec<PathBuf>,
}

impl MigrationPaths {
    /// `data_base` is the parent of the app data folder (Tauri `app_data_dir().parent()`), so the
    /// XDG data home on Linux is respected. Returns `None` where no migration runs.
    pub fn for_platform(data_base: &Path, home: &Path) -> Option<Self> {
        let new_data = data_base.join(TARGET_IDENTIFIER);
        let data_pair = CopyPair {
            kind: TargetKind::DataDir,
            source: data_base.join(SOURCE_IDENTIFIER),
            target: new_data.clone(),
            excludes: data_dir_excludes(),
        };
        if cfg!(target_os = "macos") {
            let webkit = home.join("Library/WebKit");
            Some(MigrationPaths {
                pairs: vec![
                    data_pair,
                    CopyPair {
                        kind: TargetKind::WebviewStore,
                        source: webkit.join(SOURCE_IDENTIFIER).join("WebsiteData"),
                        target: webkit.join(TARGET_IDENTIFIER).join("WebsiteData"),
                        excludes: Vec::new(),
                    },
                ],
                record_dir: new_data.clone(),
                discard_dirs: vec![new_data, webkit.join(TARGET_IDENTIFIER)],
            })
        } else if cfg!(target_os = "linux") {
            Some(MigrationPaths {
                pairs: vec![data_pair],
                record_dir: new_data.clone(),
                discard_dirs: vec![new_data],
            })
        } else {
            None
        }
    }
}

/// WebKitGTK puts its disk cache next to the data (wry `web_context.rs`). Caches are not migrated.
/// The exact folder list on Linux is re-checked by spike S1 (T005/T076).
fn data_dir_excludes() -> Vec<String> {
    if cfg!(target_os = "linux") {
        vec!["WebKitCache".to_string()]
    } else {
        Vec::new()
    }
}

/// Settings for the progress window: never persistent, never under the new identifier's folders.
#[derive(Debug, Clone)]
pub struct ProgressWindowSpec {
    pub label: &'static str,
    pub incognito: bool,
    pub data_directory: PathBuf,
}

pub fn progress_window_spec() -> ProgressWindowSpec {
    ProgressWindowSpec {
        label: "migration-progress",
        incognito: true,
        data_directory: std::env::temp_dir().join("pagelight-migration-progress"),
    }
}
