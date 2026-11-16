use std::collections::HashSet;
use std::io::{Read, Write};
use std::path::PathBuf;

use serde::Serialize;
use sha2::{Digest, Sha256};
use tauri::Manager;
#[cfg(desktop)]
use tauri_plugin_fs::FsExt;

#[cfg(desktop)]
use crate::security::path_guard::AppSecurityState;
use crate::security::path_guard::{
    resolve_validated_book_path, user_home_dir, validate_and_prepare_storage_dir,
    validate_and_read_book_file, validate_storage_dir_path, MAX_BOOK_BYTES,
};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeImportResult {
    pub stored_path: String,
    pub file_size: u64,
    pub content_hash: String,
}

#[tauri::command]
pub fn is_desktop() -> bool {
    cfg!(desktop)
}

#[cfg(desktop)]
#[tauri::command]
pub fn allow_storage_dir(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppSecurityState>,
    path: String,
) -> Result<(), String> {
    let canonical = validate_and_prepare_storage_dir(&path, user_home_dir().as_deref())?;
    {
        let mut dirs = state
            .approved_storage_dirs
            .lock()
            .map_err(|_| "STATE_LOCK_ERROR: 저장소 잠금 실패".to_string())?;
        dirs.insert(canonical.clone());
    }
    app.fs_scope()
        .allow_directory(&canonical, true)
        .map_err(|e| e.to_string())
}

#[allow(unused_variables)]
pub fn resolve_scope_and_whitelist(
    app: &tauri::AppHandle,
    raw_path: &str,
) -> Result<(HashSet<PathBuf>, HashSet<PathBuf>, bool), String> {
    #[cfg(desktop)]
    {
        let fs_scope_allowed = validate_storage_dir_path(raw_path)
            .ok()
            .and_then(|p| dunce::canonicalize(p).ok())
            .is_some_and(|c| app.fs_scope().is_allowed(&c));

        let state = app.state::<AppSecurityState>();
        let dirs = state
            .approved_storage_dirs
            .lock()
            .map_err(|_| "STATE_LOCK_ERROR: 저장소 잠금 실패".to_string())?
            .clone();
        let drops = state
            .approved_drop_paths
            .lock()
            .map_err(|_| "STATE_LOCK_ERROR: 드롭 경로 잠금 실패".to_string())?
            .clone();
        return Ok((dirs, drops, fs_scope_allowed));
    }
    #[cfg(mobile)]
    {
        let base_dir = app
            .path()
            .app_data_dir()
            .map_err(|e| format!("STORAGE_DIR_ERROR: {e}"))?
            .join("books");
        let mut dirs = HashSet::new();
        if let Ok(canon) = dunce::canonicalize(&base_dir) {
            dirs.insert(canon);
        } else {
            dirs.insert(base_dir);
        }
        Ok((dirs, HashSet::new(), false))
    }
}

#[tauri::command]
pub fn read_validated_book_file(
    app: tauri::AppHandle,
    path: String,
    max_bytes: Option<u64>,
) -> Result<tauri::ipc::Response, String> {
    let (dirs, drops, fs_scope_allowed) = resolve_scope_and_whitelist(&app, &path)?;
    let bytes = validate_and_read_book_file(
        &path,
        max_bytes,
        &dirs,
        &drops,
        fs_scope_allowed,
        user_home_dir().as_deref(),
    )?;
    Ok(tauri::ipc::Response::new(bytes))
}

#[tauri::command]
pub fn hash_validated_book_file(app: tauri::AppHandle, path: String) -> Result<String, String> {
    let (dirs, drops, fs_scope_allowed) = resolve_scope_and_whitelist(&app, &path)?;
    let canonical = resolve_validated_book_path(
        &path,
        &dirs,
        &drops,
        fs_scope_allowed,
        user_home_dir().as_deref(),
    )?;
    let mut file =
        std::fs::File::open(&canonical).map_err(|e| format!("FILE_READ_FAILED: {e}"))?;
    let mut hasher = Sha256::new();
    let mut buf = [0u8; 64 * 1024];
    loop {
        let n = file.read(&mut buf).map_err(|e| format!("FILE_READ_FAILED: {e}"))?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(format!("sha256-{}", hex::encode(hasher.finalize())))
}

#[tauri::command]
pub fn import_validated_book_to_storage(
    app: tauri::AppHandle,
    source_path: String,
    dest_dir: String,
    target_file_name: String,
) -> Result<NativeImportResult, String> {
    let (dirs, drops, fs_scope_allowed) = resolve_scope_and_whitelist(&app, &source_path)?;
    let canonical_src = resolve_validated_book_path(
        &source_path,
        &dirs,
        &drops,
        fs_scope_allowed,
        user_home_dir().as_deref(),
    )?;
    let prepared_dir = validate_and_prepare_storage_dir(&dest_dir, user_home_dir().as_deref())
        .map_err(|e| format!("STORAGE_DIR_WRITE_FAILED: {e}"))?;

    let sanitized = std::path::Path::new(&target_file_name)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("imported_book.epub");
    let final_path = prepared_dir.join(sanitized);
    let nonce = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let part_path = prepared_dir.join(format!("{sanitized}.{nonce}.part"));

    let mut src_file = std::fs::File::open(&canonical_src)
        .map_err(|e| format!("FILE_READ_FAILED: {e}"))?;
    let mut dst_file = std::fs::File::create(&part_path)
        .map_err(|e| format!("STORAGE_DIR_WRITE_FAILED: {e}"))?;

    let mut hasher = Sha256::new();
    let mut buf = [0u8; 64 * 1024];
    let mut total: u64 = 0;
    loop {
        let n = src_file.read(&mut buf).map_err(|e| {
            let _ = std::fs::remove_file(&part_path);
            format!("FILE_READ_FAILED: {e}")
        })?;
        if n == 0 {
            break;
        }
        total += n as u64;
        if total > MAX_BOOK_BYTES {
            let _ = std::fs::remove_file(&part_path);
            return Err("FILE_TOO_LARGE: 도서 파일 크기가 256 MiB 상한을 초과했습니다.".into());
        }
        hasher.update(&buf[..n]);
        dst_file.write_all(&buf[..n]).map_err(|e| {
            let _ = std::fs::remove_file(&part_path);
            format!("STORAGE_DIR_WRITE_FAILED: {e}")
        })?;
    }
    dst_file.flush().map_err(|e| {
        let _ = std::fs::remove_file(&part_path);
        format!("STORAGE_DIR_WRITE_FAILED: {e}")
    })?;
    std::fs::rename(&part_path, &final_path).map_err(|e| {
        let _ = std::fs::remove_file(&part_path);
        format!("STORAGE_DIR_WRITE_FAILED: {e}")
    })?;

    Ok(NativeImportResult {
        stored_path: final_path.to_string_lossy().to_string(),
        file_size: total,
        content_hash: format!("sha256-{}", hex::encode(hasher.finalize())),
    })
}
