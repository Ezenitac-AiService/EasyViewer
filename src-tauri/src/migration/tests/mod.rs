// SPDX-License-Identifier: GPL-3.0-only
//! T064: desktop one-time migration (contracts/data-migration.md §1, data-model §1).

mod copy;
mod flow;
mod linux;

use crate::migration::decide::{decide, Decision, DecisionInput, RecordView, UserChoice};
use crate::migration::detect::{is_legacy_exe, parse_lsappinfo_running, OldAppStatus};
use crate::migration::engine::{
    discard, execute, execute_with_lock, inspect, is_effectively_empty, ExclusiveOutcome,
    MigrationContext,
};
use crate::migration::lock::{lock_file_path, MigrationLock};
use crate::migration::paths::{progress_window_spec, CopyPair, MigrationPaths, TargetKind};
use crate::migration::record::{
    read_record, write_record, MigrationErrorKind, MigrationRecord, MigrationState, RECORD_FILE,
};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use tempfile::TempDir;

pub(super) fn write(path: &Path, bytes: &[u8]) {
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, bytes).unwrap();
}

/// Relative path -> (size, sha256) for every regular file under `root`.
pub(super) fn tree_digest(root: &Path) -> BTreeMap<String, (u64, String)> {
    let mut out = BTreeMap::new();
    fn walk(root: &Path, dir: &Path, out: &mut BTreeMap<String, (u64, String)>) {
        for entry in fs::read_dir(dir).unwrap() {
            let entry = entry.unwrap();
            let meta = fs::symlink_metadata(entry.path()).unwrap();
            if meta.is_dir() {
                walk(root, &entry.path(), out);
            } else if meta.is_file() {
                let bytes = fs::read(entry.path()).unwrap();
                let rel = entry.path().strip_prefix(root).unwrap().to_string_lossy().into_owned();
                out.insert(rel, (meta.len(), hex::encode(Sha256::digest(&bytes))));
            }
        }
    }
    if root.exists() {
        walk(root, root, &mut out);
    }
    out
}

pub(super) struct Fixture {
    _tmp: TempDir,
    pub old_data: PathBuf,
    pub new_data: PathBuf,
    pub old_web: PathBuf,
    pub new_web: PathBuf,
}

impl Fixture {
    pub fn new() -> Self {
        let tmp = TempDir::new().unwrap();
        let base = tmp.path().to_path_buf();
        Fixture {
            old_data: base.join("data/com.edith.easyviewer"),
            new_data: base.join("data/com.ezenitac.easyviewer"),
            old_web: base.join("WebKit/com.edith.easyviewer/WebsiteData"),
            new_web: base.join("WebKit/com.ezenitac.easyviewer/WebsiteData"),
            _tmp: tmp,
        }
    }

    pub fn base(&self) -> &Path {
        self._tmp.path()
    }

    pub fn seed_old(&self) {
        write(&self.old_data.join("books/a.epub"), b"epub-bytes");
        write(&self.old_data.join("books/b.txt"), b"plain text book");
        write(&self.old_data.join("settings.json"), b"{\"theme\":\"sepia\"}");
        write(&self.old_web.join("Default/salt"), b"salt");
        write(&self.old_web.join("Default/IndexedDB/v1/db.sqlite3"), b"sqlite-main");
        write(&self.old_web.join("Default/IndexedDB/v1/db.sqlite3-wal"), b"wal");
        write(&self.old_web.join("Default/IndexedDB/v1/db.sqlite3-shm"), b"shm");
    }

    pub fn ctx(&self) -> MigrationContext {
        MigrationContext {
            paths: MigrationPaths {
                pairs: vec![
                    CopyPair {
                        kind: TargetKind::DataDir,
                        source: self.old_data.clone(),
                        target: self.new_data.clone(),
                        excludes: vec!["WebKitCache".into()],
                    },
                    CopyPair {
                        kind: TargetKind::WebviewStore,
                        source: self.old_web.clone(),
                        target: self.new_web.clone(),
                        excludes: vec![],
                    },
                ],
                record_dir: self.new_data.clone(),
                discard_dirs: vec![
                    self.new_data.clone(),
                    self.base().join("WebKit/com.ezenitac.easyviewer"),
                ],
            },
            root_is_sensitive: |_| false,
        }
    }
}

pub(super) fn no_progress() -> impl FnMut(crate::migration::engine::CopyProgress) {
    |_| {}
}


pub(super) fn walk_names(root: &Path) -> Vec<String> {
    let mut out = vec![];
    if let Ok(rd) = fs::read_dir(root) {
        for e in rd.flatten() {
            out.push(e.file_name().to_string_lossy().into_owned());
            if e.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                out.extend(walk_names(&e.path()));
            }
        }
    }
    out
}
