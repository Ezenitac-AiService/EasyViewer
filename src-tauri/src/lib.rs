pub mod commands;
pub mod migration;
pub mod security;

#[cfg(desktop)]
use tauri::Manager;

#[cfg(desktop)]
use crate::commands::files::allow_storage_dir;
use crate::commands::epub_meta::extract_epub_metadata_from_path;
use crate::commands::files::{
    hash_validated_book_file, import_validated_book_to_storage, is_desktop,
    read_validated_book_file,
};
use crate::commands::remote::{safe_download_to_storage, safe_remote_fetch};
#[cfg(desktop)]
use crate::security::path_guard::{is_sensitive_path, user_home_dir, AppSecurityState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();

    // Must be the first plugin: a second launch only focuses the running instance (spec 003 R1).
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.unminimize();
            let _ = window.set_focus();
        }
    }));

    let builder = builder
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_keyring_store::init())
        .setup(|app| {
            // The main window is `"create": false`; it is created only after the one-time
            // migration decision is final (contracts/data-migration.md §1).
            #[cfg(desktop)]
            migration::startup::begin(app.handle())?;
            #[cfg(mobile)]
            migration::window::open_main_window(app.handle())?;
            Ok(())
        });

    #[cfg(desktop)]
    let builder = builder
        .manage(AppSecurityState::default())
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::DragDrop(tauri::DragDropEvent::Drop { paths, .. }) = event {
                let state = window.state::<AppSecurityState>();
                let home = user_home_dir();
                if let Ok(mut drops) = state.approved_drop_paths.lock() {
                    for p in paths {
                        if let Ok(canonical) = dunce::canonicalize(p) {
                            if !is_sensitive_path(&canonical, home.as_deref()) {
                                drops.insert(canonical);
                            }
                        }
                    }
                };
            }
        })
        .invoke_handler(tauri::generate_handler![
            is_desktop,
            allow_storage_dir,
            read_validated_book_file,
            hash_validated_book_file,
            import_validated_book_to_storage,
            extract_epub_metadata_from_path,
            safe_remote_fetch,
            safe_download_to_storage,
            migration::commands::get_migration_record,
            migration::commands::acknowledge_migration_notice,
            migration::commands::mark_library_reconstructed,
            migration::commands::skip_legacy_credentials,
            migration::commands::migrate_legacy_credentials,
            migration::commands::request_restart_for_discard
        ]);

    #[cfg(mobile)]
    let builder = builder.invoke_handler(tauri::generate_handler![
        is_desktop,
        read_validated_book_file,
        hash_validated_book_file,
        import_validated_book_to_storage,
        extract_epub_metadata_from_path,
        safe_remote_fetch,
        safe_download_to_storage
    ]);

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
