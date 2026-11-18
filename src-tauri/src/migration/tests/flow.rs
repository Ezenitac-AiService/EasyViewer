// SPDX-License-Identifier: GPL-3.0-only
use super::*;

#[test]
fn only_the_lock_holder_migrates_when_two_threads_race() {
    let fx = Fixture::new();
    fx.seed_old();
    let ctx = std::sync::Arc::new(fx.ctx());
    let lock = fx.base().join("run/migration.lock");
    let barrier = std::sync::Arc::new(std::sync::Barrier::new(2));
    let handles: Vec<_> = (0..2)
        .map(|_| {
            let (ctx, lock, barrier) = (ctx.clone(), lock.clone(), barrier.clone());
            std::thread::spawn(move || {
                barrier.wait();
                match MigrationLock::try_acquire(&lock).unwrap() {
                    Some(guard) => execute_with_lock(&ctx, &guard, &mut |_| {}),
                    None => ExclusiveOutcome::LockBusy,
                }
            })
        })
        .collect();
    let outcomes: Vec<_> = handles.into_iter().map(|h| h.join().unwrap()).collect();
    let executed = outcomes.iter().filter(|o| matches!(o, ExclusiveOutcome::Executed(_))).count();
    assert_eq!(executed, 1, "{outcomes:?}");
    assert!(outcomes.iter().all(|o| !matches!(o, ExclusiveOutcome::Executed(r) if r.state != MigrationState::Migrated)));
    assert_eq!(read_record(&fx.new_data).unwrap().state, MigrationState::Migrated);
}

#[test]
fn lock_is_exclusive_and_lives_outside_shared_parent_folders() {
    let tmp = TempDir::new().unwrap();
    let path = tmp.path().join("x/migration.lock");
    let first = MigrationLock::try_acquire(&path).unwrap();
    assert!(first.is_some());
    assert!(MigrationLock::try_acquire(&path).unwrap().is_none());
    drop(first);
    assert!(MigrationLock::try_acquire(&path).unwrap().is_some());

    let real = lock_file_path();
    let s = real.to_string_lossy();
    assert!(s.ends_with("migration.lock"));
    assert!(s.contains("com.ezenitac.easyviewer"));
    assert!(!s.contains("Library/Application Support"));
    assert!(!s.contains(".local/share"));
}

#[test]
fn progress_window_is_incognito_with_a_temporary_data_directory() {
    let spec = progress_window_spec();
    assert!(spec.incognito);
    assert!(spec.data_directory.starts_with(std::env::temp_dir()));
    let s = spec.data_directory.to_string_lossy();
    assert!(!s.contains("Library/Application Support") && !s.contains(".local/share"));
    assert!(!s.contains("Library/WebKit"));
}

#[test]
fn discard_pending_empties_new_data_before_the_window_opens() {
    let fx = Fixture::new();
    fx.seed_old();
    let ctx = fx.ctx();
    execute(&ctx, &mut no_progress());
    let mut rec = read_record(&fx.new_data).unwrap();
    rec.state = MigrationState::DiscardPending;
    write_record(&fx.new_data, &rec).unwrap();

    let input = DecisionInput {
        record: RecordView::from_record(read_record(&fx.new_data)),
        applicable: true,
        source_exists: true,
        target_empty: false,
        lock_acquired: true,
        old_app: OldAppStatus::NotRunning,
        user_choice: None,
    };
    assert_eq!(decide(&input), Decision::DiscardThenOpen);

    let after = discard(&ctx).unwrap();
    assert_eq!(after.state, MigrationState::Discarded);
    let left: Vec<_> = tree_digest(&fx.new_data).into_keys().collect();
    assert_eq!(left, vec![RECORD_FILE.to_string()]);
    assert!(!fx.base().join("WebKit/com.ezenitac.easyviewer").exists());
    // originals are still there
    assert!(fx.old_data.join("books/a.epub").exists());
    assert!(fx.old_web.join("Default/salt").exists());
}

#[test]
fn discard_refuses_folders_that_are_not_the_new_identifier() {
    let fx = Fixture::new();
    fx.seed_old();
    let mut ctx = fx.ctx();
    ctx.paths.discard_dirs = vec![fx.old_data.clone()];
    assert!(discard(&ctx).is_err());
    assert!(fx.old_data.join("books/a.epub").exists());
}

fn input(record: RecordView) -> DecisionInput {
    DecisionInput {
        record,
        applicable: true,
        source_exists: true,
        target_empty: true,
        lock_acquired: true,
        old_app: OldAppStatus::NotRunning,
        user_choice: None,
    }
}

#[test]
fn decide_never_opens_the_main_window_before_the_decision_is_final() {
    // final records and non-migrations open immediately
    assert_eq!(decide(&input(RecordView::Final(MigrationState::Migrated))), Decision::OpenMainWindow);
    assert_eq!(decide(&input(RecordView::Final(MigrationState::Declined))), Decision::OpenMainWindow);
    assert_eq!(decide(&input(RecordView::Final(MigrationState::Discarded))), Decision::OpenMainWindow);
    assert_eq!(decide(&input(RecordView::DiscardPending)), Decision::DiscardThenOpen);

    let mut i = input(RecordView::Missing);
    i.applicable = false;
    assert_eq!(decide(&i), Decision::RecordThenOpen(MigrationState::SkippedNoSource));
    let mut i = input(RecordView::Missing);
    i.source_exists = false;
    assert_eq!(decide(&i), Decision::RecordThenOpen(MigrationState::SkippedNoSource));
    let mut i = input(RecordView::Missing);
    i.target_empty = false;
    assert_eq!(decide(&i), Decision::RecordThenOpen(MigrationState::SkippedTargetNotEmpty));

    // a migration is needed: no main window until it is decided
    let mut i = input(RecordView::Missing);
    i.lock_acquired = false;
    assert_eq!(decide(&i), Decision::Exit);
    let mut i = input(RecordView::Missing);
    i.old_app = OldAppStatus::Running;
    assert_eq!(decide(&i), Decision::AskUser { undetermined: false });
    i.old_app = OldAppStatus::Unknown;
    assert_eq!(decide(&i), Decision::AskUser { undetermined: true });
    assert_eq!(decide(&input(RecordView::Missing)), Decision::CopyInBackground);
}

#[test]
fn decide_applies_the_user_choice_from_the_native_dialog() {
    let mut i = input(RecordView::Missing);
    i.old_app = OldAppStatus::Running;
    i.user_choice = Some(UserChoice::SkipThisTime);
    assert_eq!(decide(&i), Decision::RecordThenOpen(MigrationState::Declined));
    i.user_choice = Some(UserChoice::Quit);
    assert_eq!(decide(&i), Decision::Exit);
    i.user_choice = Some(UserChoice::Retry);
    assert_eq!(decide(&i), Decision::AskUser { undetermined: false });
    i.old_app = OldAppStatus::NotRunning;
    assert_eq!(decide(&i), Decision::CopyInBackground);
}

#[test]
fn legacy_app_detection_parsers() {
    assert!(parse_lsappinfo_running("\"EasyViewer\" ASN:0x0-0x1d01d:\n"));
    assert!(!parse_lsappinfo_running(""));
    assert!(!parse_lsappinfo_running("\n"));
    assert!(is_legacy_exe(Path::new("/usr/bin/easy-viewer")));
    assert!(is_legacy_exe(Path::new("/tmp/.mount_EasyVi/usr/bin/easy-viewer")));
    assert!(!is_legacy_exe(Path::new("/usr/bin/pagelight")));
    assert!(!is_legacy_exe(Path::new("/usr/bin/easy-viewer-helper")));
}

#[test]
fn platform_paths_point_at_the_old_and_new_identifiers() {
    let home = Path::new("/home/u");
    let base = Path::new("/home/u/.local/share");
    if let Some(p) = MigrationPaths::for_platform(base, home) {
        let first = &p.pairs[0];
        assert!(first.source.ends_with("com.edith.easyviewer"));
        assert!(first.target.ends_with("com.ezenitac.easyviewer"));
        assert!(p.record_dir.ends_with("com.ezenitac.easyviewer"));
        assert!(p.discard_dirs.iter().all(|d| d.to_string_lossy().contains("com.ezenitac.easyviewer")));
        if cfg!(target_os = "macos") {
            assert_eq!(p.pairs.len(), 2);
            assert!(p.pairs[1].source.ends_with("Library/WebKit/com.edith.easyviewer/WebsiteData"));
            assert!(p.pairs[1].target.ends_with("Library/WebKit/com.ezenitac.easyviewer/WebsiteData"));
        } else {
            assert_eq!(p.pairs.len(), 1);
            assert!(!first.excludes.is_empty());
        }
    } else {
        assert!(!cfg!(any(target_os = "macos", target_os = "linux")));
    }
}
