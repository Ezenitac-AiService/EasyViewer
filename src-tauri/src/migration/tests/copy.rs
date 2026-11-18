// SPDX-License-Identifier: GPL-3.0-only
use super::*;

#[test]
fn skipped_no_source_when_old_folders_are_missing() {
    let fx = Fixture::new();
    let ctx = fx.ctx();
    let insp = inspect(&ctx);
    assert!(!insp.source_exists);
    let rec = execute(&ctx, &mut no_progress());
    assert_eq!(rec.state, MigrationState::SkippedNoSource);
    assert_eq!(read_record(&fx.new_data).unwrap().state, MigrationState::SkippedNoSource);
}

#[test]
fn skipped_target_not_empty_never_overwrites_new_data() {
    let fx = Fixture::new();
    fx.seed_old();
    write(&fx.new_data.join("books/mine.epub"), b"new data wins");
    let ctx = fx.ctx();
    assert!(!inspect(&ctx).target_empty);
    let rec = execute(&ctx, &mut no_progress());
    assert_eq!(rec.state, MigrationState::SkippedTargetNotEmpty);
    assert_eq!(fs::read(fx.new_data.join("books/mine.epub")).unwrap(), b"new data wins");
    assert!(!fx.new_data.join("books/a.epub").exists());
}

#[test]
fn migrated_copies_everything_and_preserves_the_original_tree() {
    let fx = Fixture::new();
    fx.seed_old();
    let before_data = tree_digest(&fx.old_data);
    let before_web = tree_digest(&fx.old_web);
    let ctx = fx.ctx();
    let rec = execute(&ctx, &mut no_progress());
    assert_eq!(rec.state, MigrationState::Migrated);
    assert!(rec.copied.data_dir && rec.copied.webview_store);
    assert_eq!(rec.schema, 1);
    assert_eq!(rec.source_identifier, "com.edith.easyviewer");
    assert!(rec.started_at.ends_with('Z') && rec.finished_at.ends_with('Z'));
    // original untouched (list, size, sha256)
    assert_eq!(tree_digest(&fx.old_data), before_data);
    assert_eq!(tree_digest(&fx.old_web), before_web);
    // copy equals original; record file is the only addition
    let mut copied = tree_digest(&fx.new_data);
    copied.remove(RECORD_FILE);
    assert_eq!(copied, before_data);
    assert_eq!(tree_digest(&fx.new_web), before_web);
    // -wal / -shm travel with the main SQLite file
    assert!(fx.new_web.join("Default/IndexedDB/v1/db.sqlite3-wal").exists());
    assert!(fx.new_web.join("Default/IndexedDB/v1/db.sqlite3-shm").exists());
}

#[test]
fn second_run_changes_nothing() {
    let fx = Fixture::new();
    fx.seed_old();
    let ctx = fx.ctx();
    execute(&ctx, &mut no_progress());
    let after_first = tree_digest(&fx.new_data);
    let input = DecisionInput {
        record: RecordView::from_record(read_record(&fx.new_data)),
        applicable: true,
        source_exists: true,
        target_empty: false,
        lock_acquired: true,
        old_app: OldAppStatus::NotRunning,
        user_choice: None,
    };
    assert_eq!(decide(&input), Decision::OpenMainWindow);
    assert_eq!(tree_digest(&fx.new_data), after_first);
}

#[test]
fn partial_when_only_one_target_succeeds() {
    let fx = Fixture::new();
    fx.seed_old();
    // Block the WebKit target: its parent path is a regular file, so the copy cannot be placed.
    write(&fx.base().join("WebKit/com.ezenitac.easyviewer"), b"");
    let mut ctx = fx.ctx();
    ctx.paths.discard_dirs.clear();
    let rec = execute(&ctx, &mut no_progress());
    assert_eq!(rec.state, MigrationState::Partial);
    assert!(rec.copied.data_dir);
    assert!(!rec.copied.webview_store);
    assert!(rec.error.is_some());
}

#[test]
fn failed_rolls_back_temp_folders_and_keeps_new_folder_empty() {
    let fx = Fixture::new();
    fx.seed_old();
    // The target's parent is a regular file, so neither the temp folder nor the target can exist.
    write(&fx.base().join("blocked"), b"");
    let mut ctx = fx.ctx();
    ctx.paths.pairs.truncate(1);
    ctx.paths.pairs[0].target = fx.base().join("blocked/com.ezenitac.easyviewer");
    ctx.paths.record_dir = fx.base().join("record/com.ezenitac.easyviewer");
    ctx.paths.discard_dirs.clear();
    let rec = execute(&ctx, &mut no_progress());
    assert_eq!(rec.state, MigrationState::Failed);
    let err = rec.error.expect("error category");
    assert!(matches!(
        err,
        MigrationErrorKind::Io | MigrationErrorKind::Permission | MigrationErrorKind::Space
    ));
    // no temporary leftovers anywhere under the fixture
    let leftovers: Vec<_> = walk_names(fx.base()).into_iter().filter(|n| n.contains(".migrating")).collect();
    assert!(leftovers.is_empty(), "{leftovers:?}");
}


#[test]
fn error_categories_never_contain_paths() {
    for kind in [
        MigrationErrorKind::Io,
        MigrationErrorKind::Permission,
        MigrationErrorKind::Space,
        MigrationErrorKind::Boundary,
        MigrationErrorKind::Busy,
    ] {
        let json = serde_json::to_string(&kind).unwrap();
        assert!(["\"io\"", "\"permission\"", "\"space\"", "\"boundary\"", "\"busy\""].contains(&json.as_str()));
    }
    let fx = Fixture::new();
    fx.seed_old();
    let rec = execute(&fx.ctx(), &mut no_progress());
    let raw = fs::read_to_string(fx.new_data.join(RECORD_FILE)).unwrap();
    assert!(!raw.contains(&fx.base().to_string_lossy().to_string()));
    assert_eq!(rec.state, MigrationState::Migrated);
}

#[cfg(unix)]
#[test]
fn symlinks_and_special_files_are_skipped_and_counted() {
    let fx = Fixture::new();
    fx.seed_old();
    let outside = fx.base().join("outside-secret.txt");
    write(&outside, b"do not copy");
    std::os::unix::fs::symlink(&outside, fx.old_data.join("books/link.txt")).unwrap();
    std::os::unix::fs::symlink(fx.base(), fx.old_data.join("escape-dir")).unwrap();
    let rec = execute(&fx.ctx(), &mut no_progress());
    assert_eq!(rec.state, MigrationState::Migrated);
    assert_eq!(rec.skipped_entries, 2);
    assert!(fs::symlink_metadata(fx.new_data.join("books/link.txt")).is_err());
    assert!(fs::symlink_metadata(fx.new_data.join("escape-dir")).is_err());
}

#[test]
fn sensitive_entries_inside_the_source_are_skipped() {
    let fx = Fixture::new();
    fx.seed_old();
    write(&fx.old_data.join(".ssh/id_rsa"), b"private key");
    let rec = execute(&fx.ctx(), &mut no_progress());
    assert_eq!(rec.state, MigrationState::Migrated);
    assert!(rec.skipped_entries >= 1);
    assert!(!fx.new_data.join(".ssh").exists());
}

#[test]
fn sensitive_source_root_is_refused_as_boundary() {
    let fx = Fixture::new();
    fx.seed_old();
    let mut ctx = fx.ctx();
    ctx.root_is_sensitive = |_| true;
    let rec = execute(&ctx, &mut no_progress());
    assert_eq!(rec.state, MigrationState::Failed);
    assert_eq!(rec.error, Some(MigrationErrorKind::Boundary));
    assert!(!fx.new_data.join("books").exists());
}

#[test]
fn cache_folders_are_excluded() {
    let fx = Fixture::new();
    fx.seed_old();
    write(&fx.old_data.join("WebKitCache/Version 16/blob"), b"cache");
    let rec = execute(&fx.ctx(), &mut no_progress());
    assert_eq!(rec.state, MigrationState::Migrated);
    assert!(!fx.new_data.join("WebKitCache").exists());
}

#[test]
fn source_change_during_copy_is_rolled_back_as_busy() {
    let fx = Fixture::new();
    fx.seed_old();
    let mut ctx = fx.ctx();
    ctx.paths.pairs.remove(0); // only the WebKit store (SQLite bundle)
    let wal = fx.old_web.join("Default/IndexedDB/v1/db.sqlite3-wal");
    let mut touched = false;
    let mut progress = |_p: crate::migration::engine::CopyProgress| {
        if !touched {
            touched = true;
            fs::write(&wal, b"wal grew while copying").unwrap();
        }
    };
    let rec = execute(&ctx, &mut progress);
    assert_eq!(rec.state, MigrationState::Failed);
    assert_eq!(rec.error, Some(MigrationErrorKind::Busy));
    assert!(!fx.new_web.exists());
}

#[test]
fn empty_definition_ignores_empty_dirs_and_zero_byte_files() {
    let fx = Fixture::new();
    assert!(is_effectively_empty(&fx.new_data));
    fs::create_dir_all(fx.new_data.join("EBWebView/empty")).unwrap();
    write(&fx.new_data.join(".lock"), b"");
    assert!(is_effectively_empty(&fx.new_data));
    write(&fx.new_data.join("store.json"), b"{}");
    assert!(!is_effectively_empty(&fx.new_data));
}

#[test]
fn migrates_into_a_new_folder_that_only_holds_startup_leftovers() {
    let fx = Fixture::new();
    fx.seed_old();
    fs::create_dir_all(fx.new_data.join("empty-subdir")).unwrap();
    write(&fx.new_data.join(".keep"), b"");
    let ctx = fx.ctx();
    assert!(inspect(&ctx).target_empty);
    assert_eq!(execute(&ctx, &mut no_progress()).state, MigrationState::Migrated);
    assert!(fx.new_data.join("books/a.epub").exists());
}

#[test]
fn unknown_schema_is_treated_as_failed() {
    let fx = Fixture::new();
    write(&fx.new_data.join(RECORD_FILE), br#"{"schema":2,"state":"migrated"}"#);
    let rec = read_record(&fx.new_data).unwrap();
    assert_eq!(rec.state, MigrationState::Failed);
    write(&fx.new_data.join(RECORD_FILE), b"not json");
    assert_eq!(read_record(&fx.new_data).unwrap().state, MigrationState::Failed);
    assert!(read_record(&fx.base().join("nowhere")).is_none());
}

#[test]
fn record_round_trips_with_camel_case_fields() {
    let fx = Fixture::new();
    let mut rec = MigrationRecord::new(MigrationState::Migrated);
    rec.skipped_entries = 3;
    rec.notice_acknowledged = true;
    write_record(&fx.new_data, &rec).unwrap();
    let raw: serde_json::Value =
        serde_json::from_str(&fs::read_to_string(fx.new_data.join(RECORD_FILE)).unwrap()).unwrap();
    assert_eq!(raw["schema"], 1);
    assert_eq!(raw["sourceIdentifier"], "com.edith.easyviewer");
    assert_eq!(raw["skippedEntries"], 3);
    assert_eq!(raw["noticeAcknowledged"], true);
    assert_eq!(raw["copied"]["webviewStore"], false);
    assert!(raw.get("error").is_none() && raw.get("credentials").is_none());
    assert_eq!(read_record(&fx.new_data).unwrap(), rec);
}

#[test]
fn change_to_an_already_copied_file_is_caught_by_the_final_rescan() {
    let fx = Fixture::new();
    fx.seed_old();
    let mut ctx = fx.ctx();
    ctx.paths.pairs.remove(0);
    // Files are copied in sorted order; "Default/IndexedDB/v1/db.sqlite3" goes first, so this
    // write happens after it was copied and only the post-copy rescan can notice it.
    let main_db = fx.old_web.join("Default/IndexedDB/v1/db.sqlite3");
    let mut calls = 0;
    let mut progress = |p: crate::migration::engine::CopyProgress| {
        calls += 1;
        if p.files_done == p.files_total {
            fs::write(&main_db, b"sqlite-main grew after being copied").unwrap();
        }
    };
    let rec = execute(&ctx, &mut progress);
    assert!(calls > 1);
    assert_eq!(rec.state, MigrationState::Failed);
    assert_eq!(rec.error, Some(MigrationErrorKind::Busy));
    assert!(!fx.new_web.exists());
}

#[cfg(unix)]
#[test]
fn unreadable_target_is_never_treated_as_empty() {
    use std::os::unix::fs::PermissionsExt;
    let fx = Fixture::new();
    let parent = fx.base().join("locked");
    write(&parent.join("com.ezenitac.easyviewer/books/x.epub"), b"existing");
    fs::set_permissions(&parent, fs::Permissions::from_mode(0o000)).unwrap();
    let verdict = is_effectively_empty(&parent.join("com.ezenitac.easyviewer"));
    fs::set_permissions(&parent, fs::Permissions::from_mode(0o755)).unwrap();
    assert!(!verdict, "a folder we cannot inspect may hold user data");
}
