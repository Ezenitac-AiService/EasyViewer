// SPDX-License-Identifier: GPL-3.0-only
//! Exclusive migration lock in a per-user runtime/temp folder (contracts/data-migration.md §1).

use super::record::TARGET_IDENTIFIER;
use std::fs::{self, File, OpenOptions, TryLockError};
use std::io;
use std::path::{Path, PathBuf};

/// Held for the whole migration; the OS releases the lock when the file handle is dropped.
#[derive(Debug)]
pub struct MigrationLock {
    _file: File,
}

impl MigrationLock {
    /// `Ok(None)` means another instance holds the lock.
    pub fn try_acquire(path: &Path) -> io::Result<Option<Self>> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        let file = OpenOptions::new().create(true).truncate(false).write(true).open(path)?;
        match file.try_lock() {
            Ok(()) => Ok(Some(MigrationLock { _file: file })),
            Err(TryLockError::WouldBlock) => Ok(None),
            Err(TryLockError::Error(e)) => Err(e),
        }
    }
}

/// Linux: `$XDG_RUNTIME_DIR/<id>/migration.lock`, else `/tmp/<id>-<uid>/migration.lock`.
/// macOS and others: the per-user temporary folder (`NSTemporaryDirectory()` = `$TMPDIR`).
pub fn lock_file_path() -> PathBuf {
    if cfg!(target_os = "linux") {
        if let Some(runtime) = std::env::var_os("XDG_RUNTIME_DIR").filter(|v| !v.is_empty()) {
            return PathBuf::from(runtime).join(TARGET_IDENTIFIER).join("migration.lock");
        }
        return std::env::temp_dir()
            .join(format!("{TARGET_IDENTIFIER}-{}", current_uid()))
            .join("migration.lock");
    }
    std::env::temp_dir().join(TARGET_IDENTIFIER).join("migration.lock")
}

#[cfg(unix)]
fn current_uid() -> u32 {
    use std::os::unix::fs::MetadataExt;
    fs::metadata("/proc/self").map(|m| m.uid()).unwrap_or(0)
}

#[cfg(not(unix))]
fn current_uid() -> u32 {
    0
}
