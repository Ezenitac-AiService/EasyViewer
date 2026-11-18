// SPDX-License-Identifier: GPL-3.0-only
//! Tauri commands over the migration record and the legacy credential migration (T069).

use super::credentials::{migrate_credentials, CredentialOutcome, SecretStore};
use super::record::{
    read_record, write_record, CredentialSummary, MigrationRecord, MigrationState,
    SOURCE_IDENTIFIER,
};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, Runtime, State};
use tauri_plugin_keyring_store::{KeyringExt, KeyringStore};

/// Serialises read-modify-write of `migration-v1.json` within this process.
pub struct MigrationRuntime {
    pub record_dir: PathBuf,
    pub write_lock: Mutex<()>,
}

impl MigrationRuntime {
    fn update(&self, f: impl FnOnce(&mut MigrationRecord) -> Result<(), String>) -> Result<MigrationRecord, String> {
        let _guard = self.write_lock.lock().map_err(|_| "record_lock".to_string())?;
        let mut record = read_record(&self.record_dir).ok_or_else(|| "no_record".to_string())?;
        f(&mut record)?;
        write_record(&self.record_dir, &record).map_err(|_| "record_write".to_string())?;
        Ok(record)
    }
}

struct Keyring<'a>(&'a KeyringStore);

impl SecretStore for Keyring<'_> {
    fn get(&self, account: &str) -> Result<Option<String>, ()> {
        self.0.get_password(account).map_err(|_| ())
    }
    fn set(&self, account: &str, secret: &str) -> Result<(), ()> {
        self.0.set_password(account, secret).map_err(|_| ())
    }
}

fn can_migrate_credentials(record: &MigrationRecord) -> bool {
    matches!(record.state, MigrationState::Migrated | MigrationState::Partial) && record.credentials.is_none()
}

#[tauri::command]
pub fn get_migration_record(state: State<'_, MigrationRuntime>) -> Option<MigrationRecord> {
    read_record(&state.record_dir)
}

#[tauri::command]
pub fn acknowledge_migration_notice(state: State<'_, MigrationRuntime>) -> Result<(), String> {
    state.update(|r| {
        r.notice_acknowledged = true;
        Ok(())
    })
    .map(|_| ())
}

#[tauri::command]
pub fn mark_library_reconstructed(state: State<'_, MigrationRuntime>) -> Result<(), String> {
    state.update(|r| {
        r.reconstructed = true;
        Ok(())
    })
    .map(|_| ())
}

/// User chose "skip and re-enter later": nothing is read from the legacy keychain.
#[tauri::command]
pub fn skip_legacy_credentials(state: State<'_, MigrationRuntime>) -> Result<(), String> {
    state
        .update(|r| {
            if can_migrate_credentials(r) {
                r.credentials = Some(CredentialSummary { skipped: Some(true), ..Default::default() });
            }
            Ok(())
        })
        .map(|_| ())
}

/// One-shot: after a result is recorded, further calls change nothing and return zeros.
#[tauri::command]
pub async fn migrate_legacy_credentials<R: Runtime>(
    app: AppHandle<R>,
    account_keys: Vec<String>,
) -> Result<CredentialOutcome, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<MigrationRuntime>();
        let current = app.keyring().store.clone();
        let legacy = KeyringStore::new(SOURCE_IDENTIFIER);
        let mut outcome = CredentialOutcome::default();
        state.update(|r| {
            if !can_migrate_credentials(r) {
                return Ok(());
            }
            outcome = migrate_credentials(&Keyring(&legacy), &Keyring(&current), &account_keys)
                .map_err(|_| "invalid_account_keys".to_string())?;
            r.credentials = Some(CredentialSummary {
                migrated: outcome.migrated,
                missing: outcome.missing,
                failed: outcome.failed,
                skipped: None,
            });
            Ok(())
        })?;
        Ok(outcome)
    })
    .await
    .map_err(|_| "credential_task".to_string())?
}

/// "Discard migration result": the WebView holds the store open, so record `discard_pending`
/// and restart; the folders are emptied before the next main window exists.
#[tauri::command]
pub fn request_restart_for_discard<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, MigrationRuntime>,
) -> Result<(), String> {
    state.update(|r| {
        if matches!(r.state, MigrationState::Migrated | MigrationState::Partial) {
            r.state = MigrationState::DiscardPending;
            Ok(())
        } else {
            Err("not_discardable".to_string())
        }
    })?;
    app.restart();
}
