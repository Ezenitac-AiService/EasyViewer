// SPDX-License-Identifier: GPL-3.0-only
//! Spec 004 T029 (FR-015, SC-004a): the Linux migration rules, exercised on any host by passing
//! the OS name. Linux is a test build, so these automated tests stand in for real-device checks.

use super::*;

fn linux_ctx(base: &Path) -> MigrationContext {
    let paths = MigrationPaths::for_os("linux", &base.join("share"), &base.join("home"))
        .expect("Linux runs the migration");
    MigrationContext { paths, root_is_sensitive: |_| false }
}

fn seed_linux_old(base: &Path) -> PathBuf {
    let old = base.join("share/com.edith.easyviewer");
    write(&old.join("books/a.epub"), b"epub-bytes");
    write(&old.join("settings.json"), b"{\"theme\":\"dark\"}");
    write(&old.join("localstorage/file__0.localstorage"), b"webkitgtk-local-storage");
    write(&old.join("WebKitCache/Version 16/Records/x"), b"cache");
    old
}

#[test]
fn linux_paths_copy_one_data_pair_and_skip_the_webkit_cache() {
    let base = Path::new("/home/u/.local/share");
    let p = MigrationPaths::for_os("linux", base, Path::new("/home/u")).unwrap();
    assert_eq!(p.pairs.len(), 1);
    assert_eq!(p.pairs[0].kind, TargetKind::DataDir);
    assert_eq!(p.pairs[0].source, base.join("com.edith.easyviewer"));
    assert_eq!(p.pairs[0].target, base.join("com.ezenitac.easyviewer"));
    assert_eq!(p.pairs[0].excludes, vec!["WebKitCache".to_string()]);
    assert!(p.pairs.iter().all(|pair| pair.kind != TargetKind::WebviewStore));
    assert_eq!(p.record_dir, base.join("com.ezenitac.easyviewer"));
    assert_eq!(p.discard_dirs, vec![base.join("com.ezenitac.easyviewer")]);
}

#[test]
fn macos_paths_keep_the_webkit_store_pair() {
    let p = MigrationPaths::for_os("macos", Path::new("/Users/u/Library/Application Support"), Path::new("/Users/u")).unwrap();
    assert_eq!(p.pairs.len(), 2);
    assert!(p.pairs[0].excludes.is_empty());
    assert!(p.pairs[1].source.ends_with("Library/WebKit/com.edith.easyviewer/WebsiteData"));
    assert_eq!(p.discard_dirs.len(), 2);
}

#[test]
fn other_systems_have_no_migration() {
    for os in ["windows", "android", "ios", "freebsd"] {
        assert!(MigrationPaths::for_os(os, Path::new("/x"), Path::new("/y")).is_none(), "{os}");
    }
}

#[test]
fn current_platform_matches_the_os_rules() {
    let (base, home) = (Path::new("/b"), Path::new("/h"));
    let current = MigrationPaths::for_platform(base, home).map(|p| p.pairs.len());
    let expected = MigrationPaths::for_os(std::env::consts::OS, base, home).map(|p| p.pairs.len());
    assert_eq!(current, expected);
}

#[test]
fn linux_rules_preserve_the_original_and_never_duplicate_on_rerun() {
    let tmp = TempDir::new().unwrap();
    let old = seed_linux_old(tmp.path());
    let before = tree_digest(&old);
    let ctx = linux_ctx(tmp.path());
    let rec = execute(&ctx, &mut no_progress());
    assert_eq!(rec.state, MigrationState::Migrated);
    assert_eq!(tree_digest(&old), before);
    let new_data = tmp.path().join("share/com.ezenitac.easyviewer");
    assert!(new_data.join("localstorage/file__0.localstorage").exists());
    assert!(!new_data.join("WebKitCache").exists());
    let data_only = |root: &Path| {
        let mut d = tree_digest(root);
        d.remove(RECORD_FILE);
        d
    };
    let after_first = data_only(&new_data);

    // A rerun never copies over the existing new data (only the record is refreshed).
    let again = execute(&ctx, &mut no_progress());
    assert_eq!(again.state, MigrationState::SkippedTargetNotEmpty);
    assert_eq!(data_only(&new_data), after_first);
    assert_eq!(tree_digest(&old), before);
}

#[test]
fn linux_rules_discard_empties_only_the_new_data_folder() {
    let tmp = TempDir::new().unwrap();
    let old = seed_linux_old(tmp.path());
    let ctx = linux_ctx(tmp.path());
    execute(&ctx, &mut no_progress());
    let after = discard(&ctx).unwrap();
    assert_eq!(after.state, MigrationState::Discarded);
    let new_data = tmp.path().join("share/com.ezenitac.easyviewer");
    let left: Vec<_> = tree_digest(&new_data).into_keys().collect();
    assert_eq!(left, vec![RECORD_FILE.to_string()]);
    assert!(old.join("books/a.epub").exists());
}

#[test]
fn linux_rules_roll_back_an_interrupted_copy() {
    let tmp = TempDir::new().unwrap();
    seed_linux_old(tmp.path());
    // The new data folder's parent is a regular file, so the copy is interrupted before placement.
    write(&tmp.path().join("blocked"), b"");
    let mut ctx = linux_ctx(tmp.path());
    ctx.paths.pairs[0].target = tmp.path().join("blocked/com.ezenitac.easyviewer");
    ctx.paths.record_dir = tmp.path().join("record/com.ezenitac.easyviewer");
    ctx.paths.discard_dirs.clear();
    let rec = execute(&ctx, &mut no_progress());
    assert_eq!(rec.state, MigrationState::Failed);
    let leftovers: Vec<_> = walk_names(tmp.path()).into_iter().filter(|n| n.contains(".migrating")).collect();
    assert!(leftovers.is_empty(), "{leftovers:?}");
}
