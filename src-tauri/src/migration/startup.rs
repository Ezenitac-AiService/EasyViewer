// SPDX-License-Identifier: GPL-3.0-only
//! Startup glue (T070): runs the pure decision, then creates the main window only once the
//! migration decision is final. `setup` never blocks on the copy.

use super::commands::MigrationRuntime;
use super::decide::{decide, Decision, DecisionInput, RecordView, UserChoice};
use super::detect::{detect_old_app, OldAppStatus};
use super::engine::{discard, execute_with_lock, inspect, CopyProgress, MigrationContext};
use super::lock::{lock_file_path, MigrationLock};
use super::paths::{progress_window_spec, MigrationPaths};
use super::record::{read_record, write_record, MigrationRecord};
use super::window::open_main_window;
use crate::security::path_guard::{is_sensitive_path, user_home_dir};
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Manager, Runtime, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogResult};

const RETRY: &str = "다시 시도";
const SKIP: &str = "이번엔 건너뛰기";
const QUIT: &str = "종료";
const PROGRESS_DELAY: Duration = Duration::from_secs(5);

fn root_guard(path: &Path) -> bool {
    is_sensitive_path(path, user_home_dir().as_deref())
}

/// Called from `setup`. Returns immediately; windows are created by the chosen branch.
pub fn begin<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let record_dir = app.path().app_data_dir()?;
    app.manage(MigrationRuntime { record_dir: record_dir.clone(), write_lock: Mutex::new(()) });
    let paths = record_dir
        .parent()
        .zip(user_home_dir())
        .and_then(|(base, home)| MigrationPaths::for_platform(base, &home));
    let Some(paths) = paths else {
        // Platforms without a migration source (e.g. Windows) still get a final record.
        let input = DecisionInput {
            record: RecordView::from_record(read_record(&record_dir)),
            applicable: false,
            source_exists: false,
            target_empty: false,
            lock_acquired: false,
            old_app: OldAppStatus::NotRunning,
            user_choice: None,
        };
        if let Decision::RecordThenOpen(state) = decide(&input) {
            let _ = write_record(&record_dir, &MigrationRecord::new(state));
        }
        return open_main_window(app);
    };
    step(app.clone(), Arc::new(MigrationContext { paths, root_is_sensitive: root_guard }), None)
}

fn step<R: Runtime>(app: AppHandle<R>, ctx: Arc<MigrationContext>, choice: Option<UserChoice>) -> tauri::Result<()> {
    let record = RecordView::from_record(read_record(&ctx.paths.record_dir));
    let inspection = inspect(&ctx);
    let needs_copy = record == RecordView::Missing && inspection.source_exists && inspection.target_empty;
    let lock = if needs_copy { MigrationLock::try_acquire(&lock_file_path()).ok().flatten() } else { None };
    let deciding_user = matches!(choice, Some(UserChoice::SkipThisTime | UserChoice::Quit));
    let old_app = if needs_copy && lock.is_some() && !deciding_user { detect_old_app() } else { OldAppStatus::NotRunning };
    let input = DecisionInput {
        record,
        applicable: true,
        source_exists: inspection.source_exists,
        target_empty: inspection.target_empty,
        lock_acquired: lock.is_some(),
        old_app,
        user_choice: choice,
    };
    match decide(&input) {
        Decision::OpenMainWindow => open_main_window(&app),
        Decision::RecordThenOpen(state) => {
            let _ = write_record(&ctx.paths.record_dir, &MigrationRecord::new(state));
            open_main_window(&app)
        }
        Decision::DiscardThenOpen => {
            // On failure the record stays `discard_pending` and is retried next launch.
            let _ = discard(&ctx);
            open_main_window(&app)
        }
        Decision::AskUser { undetermined } => {
            drop(lock);
            ask_user(app, ctx, undetermined);
            Ok(())
        }
        Decision::Exit => {
            app.exit(0);
            Ok(())
        }
        Decision::CopyInBackground => {
            let lock = lock.expect("CopyInBackground implies the lock is held");
            spawn_copy(app, ctx, lock);
            Ok(())
        }
    }
}

fn ask_user<R: Runtime>(app: AppHandle<R>, ctx: Arc<MigrationContext>, undetermined: bool) {
    let message = if undetermined {
        "다른 EasyViewer가 실행 중인지 확인할 수 없습니다.\n\n이전 버전 데이터를 안전하게 옮기려면 EasyViewer를 모두 종료한 뒤 [다시 시도]를 누르세요. [이번엔 건너뛰기]를 고르면 빈 서재로 시작하며, 원본 데이터는 그대로 남습니다."
    } else {
        "EasyViewer가 실행 중입니다.\n\n이전 버전 데이터를 안전하게 옮기려면 EasyViewer를 종료한 뒤 [다시 시도]를 누르세요. [이번엔 건너뛰기]를 고르면 빈 서재로 시작하며, 원본 데이터는 그대로 남습니다."
    };
    let handle = app.clone();
    app.dialog()
        .message(message)
        .title("Pagelight — 이전 버전 데이터 옮기기")
        .buttons(MessageDialogButtons::YesNoCancelCustom(RETRY.into(), SKIP.into(), QUIT.into()))
        .show_with_result(move |result| {
            let choice = match result {
                MessageDialogResult::Yes => UserChoice::Retry,
                MessageDialogResult::No => UserChoice::SkipThisTime,
                MessageDialogResult::Custom(label) if label == RETRY => UserChoice::Retry,
                MessageDialogResult::Custom(label) if label == SKIP => UserChoice::SkipThisTime,
                _ => UserChoice::Quit,
            };
            if step(handle.clone(), ctx, Some(choice)).is_err() {
                handle.exit(1);
            }
        });
}

fn spawn_copy<R: Runtime>(app: AppHandle<R>, ctx: Arc<MigrationContext>, lock: MigrationLock) {
    let done = Arc::new(AtomicBool::new(false));
    {
        let (app, done) = (app.clone(), done.clone());
        std::thread::spawn(move || {
            std::thread::sleep(PROGRESS_DELAY);
            if !done.load(Ordering::SeqCst) {
                let _ = open_progress_window(&app);
            }
        });
    }
    std::thread::spawn(move || {
        let label = progress_window_spec().label;
        let mut report = |p: CopyProgress| {
            if let Some(w) = app.get_webview_window(label) {
                let _ = w.eval(format!(
                    "window.pagelightMigrationProgress&&window.pagelightMigrationProgress({},{},{},{})",
                    p.pair_index, p.pair_count, p.files_done, p.files_total
                ));
            }
        };
        let _ = execute_with_lock(&ctx, &lock, &mut report);
        drop(lock);
        done.store(true, Ordering::SeqCst);
        if let Some(w) = app.get_webview_window(label) {
            let _ = w.destroy();
        }
        if open_main_window(&app).is_err() {
            app.exit(1);
        }
    });
}

/// Non-persistent window (incognito + temporary data directory) with no IPC capability.
fn open_progress_window<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let spec = progress_window_spec();
    if app.get_webview_window(spec.label).is_some() {
        return Ok(());
    }
    WebviewWindowBuilder::new(app, spec.label, WebviewUrl::App("migration-progress.html".into()))
        .title("Pagelight")
        .inner_size(420.0, 180.0)
        .resizable(false)
        .incognito(spec.incognito)
        .data_directory(spec.data_directory)
        .build()
        .map(|_| ())
}
