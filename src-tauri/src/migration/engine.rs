// SPDX-License-Identifier: GPL-3.0-only
//! Copy engine: temp folder → verify → atomic rename. The source is only ever read.

use super::lock::MigrationLock;
use super::paths::{CopyPair, MigrationPaths, TargetKind};
use super::record::{
    iso8601_utc, read_record, write_record, MigrationErrorKind, MigrationRecord, MigrationState,
    RECORD_FILE, SOURCE_IDENTIFIER, TARGET_IDENTIFIER,
};
use crate::security::path_guard::{case_insensitive_platform, is_sensitive_path_with_case_mode};
use std::collections::BTreeMap;
use std::fs;
use std::io;
use std::path::{Component, Path, PathBuf};
use std::time::SystemTime;

pub struct MigrationContext {
    pub paths: MigrationPaths,
    /// Guard for a whole source root (production: `is_sensitive_path` on the canonical root).
    pub root_is_sensitive: fn(&Path) -> bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CopyProgress {
    pub pair_index: usize,
    pub pair_count: usize,
    pub files_done: u64,
    pub files_total: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Inspection {
    pub source_exists: bool,
    pub target_empty: bool,
}

#[derive(Debug)]
pub enum ExclusiveOutcome {
    Executed(MigrationRecord),
    LockBusy,
    AlreadyDone,
}

pub fn inspect(ctx: &MigrationContext) -> Inspection {
    let source_exists = ctx.paths.pairs.iter().any(|p| p.source.is_dir());
    let target_empty = ctx.paths.pairs.iter().all(|p| is_effectively_empty(&p.target))
        && is_effectively_empty(&ctx.paths.record_dir);
    Inspection { source_exists, target_empty }
}

/// Empty = missing, or only empty folders and zero-byte files (created by plugins at startup).
pub fn is_effectively_empty(dir: &Path) -> bool {
    let meta = match fs::symlink_metadata(dir) {
        Ok(m) => m,
        Err(e) => return matches!(e.kind(), io::ErrorKind::NotFound | io::ErrorKind::NotADirectory),
    };
    if !meta.is_dir() {
        return false;
    }
    let Ok(entries) = fs::read_dir(dir) else { return false };
    entries.flatten().all(|entry| match fs::symlink_metadata(entry.path()) {
        Ok(m) if m.is_dir() => is_effectively_empty(&entry.path()),
        Ok(m) => m.is_file() && m.len() == 0,
        Err(_) => false,
    })
}

/// Runs the migration while `_lock` is held. Re-checks the record so a second instance that got
/// the lock later changes nothing.
pub fn execute_with_lock(
    ctx: &MigrationContext,
    _lock: &MigrationLock,
    progress: &mut dyn FnMut(CopyProgress),
) -> ExclusiveOutcome {
    if read_record(&ctx.paths.record_dir).is_some() {
        return ExclusiveOutcome::AlreadyDone;
    }
    ExclusiveOutcome::Executed(execute(ctx, progress))
}

/// Inspects, copies and writes the final record. Never panics; errors become categories.
pub fn execute(ctx: &MigrationContext, progress: &mut dyn FnMut(CopyProgress)) -> MigrationRecord {
    let inspection = inspect(ctx);
    let mut record = if !inspection.source_exists {
        MigrationRecord::new(MigrationState::SkippedNoSource)
    } else if !inspection.target_empty {
        MigrationRecord::new(MigrationState::SkippedTargetNotEmpty)
    } else {
        copy_all(ctx, progress)
    };
    record.finished_at = iso8601_utc(SystemTime::now());
    let _ = write_record(&ctx.paths.record_dir, &record);
    record
}

fn copy_all(ctx: &MigrationContext, progress: &mut dyn FnMut(CopyProgress)) -> MigrationRecord {
    let mut record = MigrationRecord::new(MigrationState::Migrated);
    let pairs: Vec<&CopyPair> = ctx.paths.pairs.iter().filter(|p| p.source.is_dir()).collect();
    let (mut ok, mut failed) = (0usize, 0usize);
    for (index, pair) in pairs.iter().enumerate() {
        let root_ok = dunce::canonicalize(&pair.source)
            .map(|c| !(ctx.root_is_sensitive)(&c))
            .unwrap_or(false);
        let result = if root_ok {
            let mut report = |files_done, files_total| {
                progress(CopyProgress { pair_index: index, pair_count: pairs.len(), files_done, files_total })
            };
            copy_tree_atomic(pair, &mut report)
        } else {
            Err(MigrationErrorKind::Boundary)
        };
        match result {
            Ok(skipped) => {
                ok += 1;
                record.skipped_entries += skipped;
                match pair.kind {
                    TargetKind::DataDir => record.copied.data_dir = true,
                    TargetKind::WebviewStore => record.copied.webview_store = true,
                }
            }
            Err(kind) => {
                failed += 1;
                record.error.get_or_insert(kind);
            }
        }
    }
    record.state = match (ok, failed) {
        (_, 0) => MigrationState::Migrated,
        (0, _) => MigrationState::Failed,
        _ => MigrationState::Partial,
    };
    record
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct FileStamp {
    size: u64,
    modified: Option<SystemTime>,
}

struct Snapshot {
    dirs: Vec<PathBuf>,
    files: BTreeMap<PathBuf, FileStamp>,
    skipped: u64,
}

fn scan(root: &Path, excludes: &[String]) -> io::Result<Snapshot> {
    let mut snap = Snapshot { dirs: Vec::new(), files: BTreeMap::new(), skipped: 0 };
    scan_dir(root, Path::new(""), excludes, &mut snap)?;
    Ok(snap)
}

fn scan_dir(root: &Path, rel: &Path, excludes: &[String], snap: &mut Snapshot) -> io::Result<()> {
    let case_insensitive = case_insensitive_platform(std::env::consts::OS);
    for entry in fs::read_dir(root.join(rel))? {
        let entry = entry?;
        let child = rel.join(entry.file_name());
        if rel.as_os_str().is_empty() && excludes.iter().any(|x| entry.file_name() == x.as_str()) {
            continue;
        }
        // Relative check: credential folders (.ssh, .gnupg, …) anywhere below the source root.
        if is_sensitive_path_with_case_mode(&child, None, case_insensitive)
            || child.components().any(|c| !matches!(c, Component::Normal(_)))
        {
            snap.skipped += 1;
            continue;
        }
        let meta = fs::symlink_metadata(entry.path())?;
        if meta.is_dir() {
            snap.dirs.push(child.clone());
            scan_dir(root, &child, excludes, snap)?;
        } else if meta.is_file() {
            snap.files.insert(child, FileStamp { size: meta.len(), modified: meta.modified().ok() });
        } else {
            // Symbolic links and special files are never followed or copied.
            snap.skipped += 1;
        }
    }
    Ok(())
}

/// Copies one source folder. Returns the number of skipped entries.
fn copy_tree_atomic(
    pair: &CopyPair,
    progress: &mut dyn FnMut(u64, u64),
) -> Result<u64, MigrationErrorKind> {
    let io_err = |e: io::Error| MigrationErrorKind::from_io(&e);
    let before = scan(&pair.source, &pair.excludes).map_err(io_err)?;
    let parent = pair.target.parent().ok_or(MigrationErrorKind::Boundary)?;
    let name = pair.target.file_name().ok_or(MigrationErrorKind::Boundary)?;
    fs::create_dir_all(parent).map_err(io_err)?;
    let tmp = parent.join(format!(".{}.migrating", name.to_string_lossy()));
    if fs::symlink_metadata(&tmp).is_ok() {
        fs::remove_dir_all(&tmp).map_err(io_err)?;
    }
    let result = fill_and_verify(pair, &before, &tmp, progress).and_then(|()| place(&tmp, &pair.target));
    if result.is_err() {
        let _ = fs::remove_dir_all(&tmp);
    }
    result.map(|()| before.skipped)
}

fn fill_and_verify(
    pair: &CopyPair,
    before: &Snapshot,
    tmp: &Path,
    progress: &mut dyn FnMut(u64, u64),
) -> Result<(), MigrationErrorKind> {
    let io_err = |e: io::Error| MigrationErrorKind::from_io(&e);
    fs::create_dir(tmp).map_err(io_err)?;
    for dir in &before.dirs {
        fs::create_dir_all(tmp.join(dir)).map_err(io_err)?;
    }
    let total = before.files.len() as u64;
    for (done, (rel, stamp)) in before.files.iter().enumerate() {
        let copied = fs::copy(pair.source.join(rel), tmp.join(rel)).map_err(io_err)?;
        if copied != stamp.size {
            return Err(MigrationErrorKind::Busy);
        }
        progress(done as u64 + 1, total);
    }
    // Verify the copy (count and sizes) …
    let copy = scan(tmp, &[]).map_err(io_err)?;
    let copy_sizes: Vec<_> = copy.files.iter().map(|(k, v)| (k, v.size)).collect();
    let src_sizes: Vec<_> = before.files.iter().map(|(k, v)| (k, v.size)).collect();
    if copy_sizes != src_sizes {
        return Err(MigrationErrorKind::Io);
    }
    // … and that nobody wrote to the source meanwhile (secondary defence after app detection).
    let after = scan(&pair.source, &pair.excludes).map_err(io_err)?;
    if after.files != before.files {
        return Err(MigrationErrorKind::Busy);
    }
    Ok(())
}

fn place(tmp: &Path, target: &Path) -> Result<(), MigrationErrorKind> {
    let io_err = |e: io::Error| MigrationErrorKind::from_io(&e);
    if fs::symlink_metadata(target).is_ok() {
        if !is_effectively_empty(target) {
            return Err(MigrationErrorKind::Io);
        }
        fs::remove_dir_all(target).map_err(io_err)?;
    }
    fs::rename(tmp, target).map_err(io_err)
}

/// Empties the new-identifier folders (never anything else) and records `discarded`.
/// Must run before any persistent WebView exists.
pub fn discard(ctx: &MigrationContext) -> io::Result<MigrationRecord> {
    let owns_new_identifier = |p: &Path| {
        let names: Vec<_> = p.components().filter_map(|c| match c {
            Component::Normal(n) => n.to_str(),
            _ => None,
        }).collect();
        names.contains(&TARGET_IDENTIFIER) && !names.contains(&SOURCE_IDENTIFIER)
    };
    if ctx.paths.discard_dirs.iter().any(|d| !owns_new_identifier(d)) {
        return Err(io::Error::new(io::ErrorKind::InvalidInput, "discard target is not a new-identifier folder"));
    }
    for dir in &ctx.paths.discard_dirs {
        if dir == &ctx.paths.record_dir {
            if let Ok(entries) = fs::read_dir(dir) {
                for entry in entries.flatten() {
                    if entry.file_name() == RECORD_FILE {
                        continue;
                    }
                    let path = entry.path();
                    if fs::symlink_metadata(&path)?.is_dir() {
                        fs::remove_dir_all(&path)?;
                    } else {
                        fs::remove_file(&path)?;
                    }
                }
            }
        } else if fs::symlink_metadata(dir).is_ok() {
            fs::remove_dir_all(dir)?;
        }
    }
    let mut record = read_record(&ctx.paths.record_dir)
        .unwrap_or_else(|| MigrationRecord::new(MigrationState::Discarded));
    record.state = MigrationState::Discarded;
    record.finished_at = iso8601_utc(SystemTime::now());
    write_record(&ctx.paths.record_dir, &record)?;
    Ok(record)
}
