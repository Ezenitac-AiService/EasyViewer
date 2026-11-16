use std::collections::HashSet;
use std::path::{Component, Path, PathBuf};
use std::sync::Mutex;

pub const MAX_BOOK_BYTES: u64 = 256 * 1024 * 1024;

#[cfg(desktop)]
#[derive(Default)]
pub struct AppSecurityState {
    pub approved_storage_dirs: Mutex<HashSet<PathBuf>>,
    pub approved_drop_paths: Mutex<HashSet<PathBuf>>,
}

/// Validates and normalizes a storage directory path so relative or `..` traversal paths are rejected.
pub fn validate_storage_dir_path(path: &str) -> Result<PathBuf, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("storage folder path must not be empty".into());
    }
    let dir = PathBuf::from(trimmed);
    if !dir.is_absolute() {
        return Err(format!("storage folder must be an absolute path: {path}"));
    }
    for component in dir.components() {
        if matches!(component, Component::ParentDir) {
            return Err(format!("storage folder must not contain '..': {path}"));
        }
    }
    Ok(dir)
}

pub fn is_supported_book_extension(path: &Path) -> bool {
    match path.extension().and_then(|ext| ext.to_str()) {
        Some(ext) => matches!(ext.to_ascii_lowercase().as_str(), "txt" | "epub"),
        None => false,
    }
}

pub fn user_home_dir() -> Option<PathBuf> {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
}

fn matches_path_prefix(path: &Path, prefix: &Path, case_insensitive: bool) -> bool {
    if !case_insensitive {
        return path.starts_with(prefix);
    }
    let path_norm = path.to_string_lossy().replace('\\', "/").to_ascii_lowercase();
    let prefix_raw = prefix.to_string_lossy().replace('\\', "/").to_ascii_lowercase();
    let prefix_norm = prefix_raw.trim_end_matches('/');
    if prefix_norm.is_empty() {
        return path_norm.starts_with('/');
    }
    path_norm == prefix_norm || path_norm.starts_with(&format!("{prefix_norm}/"))
}

/// Checks OS system directories and credential stores with configurable case folding for APFS/NTFS.
pub fn is_sensitive_path_with_case_mode(
    path: &Path,
    home_dir: Option<&Path>,
    case_insensitive: bool,
) -> bool {
    let raw_norm = path.to_string_lossy().replace('\\', "/");
    let lower_raw = raw_norm.to_ascii_lowercase();
    if lower_raw.starts_with("//?/unc/") || lower_raw.starts_with("//") {
        // Block UNC network shares (\\server\share, //server/share, \\?\UNC\...) except \\?\<drive>:
        if !lower_raw.starts_with("//?/") || lower_raw.starts_with("//?/unc/") {
            return true;
        }
    }
    let stripped_verbatim = raw_norm
        .strip_prefix("//?/")
        .or_else(|| raw_norm.strip_prefix("\\\\?\\"))
        .unwrap_or(&raw_norm);
    let check_path = Path::new(stripped_verbatim);

    const SYSTEM_DENY_PREFIXES: &[&str] = &[
        "/System",
        "/Library",
        "/etc",
        "/private",
        "/proc",
        "/sys",
        "/dev",
        "/root",
        "/var/root",
        "/var/db",
    ];
    for prefix in SYSTEM_DENY_PREFIXES {
        if matches_path_prefix(check_path, Path::new(prefix), case_insensitive) {
            return true;
        }
    }

    const WIN_DENY_PREFIXES: &[&str] = &[
        "c:/windows",
        "c:/program files",
        "c:/program files (x86)",
        "c:/programdata",
        "c:/recovery",
        "c:/system volume information",
    ];
    let stripped_lower = stripped_verbatim.to_ascii_lowercase();
    for win_prefix in WIN_DENY_PREFIXES {
        if stripped_lower == *win_prefix || stripped_lower.starts_with(&format!("{win_prefix}/")) {
            return true;
        }
    }
    if stripped_lower.contains("/appdata/local/microsoft/") || stripped_lower.ends_with("/appdata/local/microsoft") {
        return true;
    }

    const CREDENTIAL_DIRS: &[&str] = &[
        ".ssh",
        ".gnupg",
        ".aws",
        ".kube",
        ".git-credentials",
        ".npmrc",
        ".netrc",
    ];
    if let Some(home) = home_dir {
        for sub in CREDENTIAL_DIRS {
            if matches_path_prefix(check_path, &home.join(sub), case_insensitive) {
                return true;
            }
        }
    }
    for comp in check_path.components() {
        if let Component::Normal(name) = comp {
            if let Some(s) = name.to_str() {
                let matched = if case_insensitive {
                    CREDENTIAL_DIRS.iter().any(|dir| s.eq_ignore_ascii_case(dir))
                } else {
                    CREDENTIAL_DIRS.contains(&s)
                };
                if matched {
                    return true;
                }
            }
        }
    }
    false
}

pub fn is_sensitive_path(path: &Path, home_dir: Option<&Path>) -> bool {
    is_sensitive_path_with_case_mode(
        path,
        home_dir,
        cfg!(any(target_os = "macos", target_os = "windows")),
    )
}

pub fn validate_and_prepare_storage_dir(
    raw_path: &str,
    home_dir: Option<&Path>,
) -> Result<PathBuf, String> {
    let dir = validate_storage_dir_path(raw_path)?;
    if is_sensitive_path(&dir, home_dir) {
        return Err(format!(
            "SECURITY_DENIED: 시스템 또는 자격 증명 보호 경로는 저장소로 허용되지 않습니다: {raw_path}"
        ));
    }

    let mut ancestor = dir.as_path();
    while !ancestor.exists() {
        ancestor = ancestor.parent().ok_or_else(|| {
            format!("SECURITY_DENIED: 유효한 상위 디렉토리를 찾을 수 없습니다: {raw_path}")
        })?;
    }
    let canonical_ancestor = dunce::canonicalize(ancestor)
        .map_err(|e| format!("SECURITY_DENIED: 상위 경로 정규화 실패: {e}"))?;
    if is_sensitive_path(&canonical_ancestor, home_dir) {
        return Err(format!(
            "SECURITY_DENIED: 심볼릭 링크를 통한 민감 경로 접근은 차단됩니다: {raw_path}"
        ));
    }

    std::fs::create_dir_all(&dir).map_err(|e| format!("DIR_CREATE_FAILED: {e}"))?;

    let canonical_final = dunce::canonicalize(&dir)
        .map_err(|e| format!("SECURITY_DENIED: 생성된 경로 검증 실패: {e}"))?;
    if !canonical_final.is_dir() {
        return Err(format!("INVALID_DIR: 디렉토리가 아닙니다: {raw_path}"));
    }
    if is_sensitive_path(&canonical_final, home_dir) {
        return Err(format!(
            "SECURITY_DENIED: 생성된 경로가 민감 영역으로 해석되어 거부되었습니다: {raw_path}"
        ));
    }
    Ok(canonical_final)
}

pub fn resolve_validated_book_path(
    raw_path: &str,
    approved_dirs: &HashSet<PathBuf>,
    approved_drops: &HashSet<PathBuf>,
    fs_scope_allowed: bool,
    home_dir: Option<&Path>,
) -> Result<PathBuf, String> {
    let raw = validate_storage_dir_path(raw_path)?;
    if is_sensitive_path(&raw, home_dir) {
        return Err("SECURITY_DENIED: 시스템 또는 자격 증명 보호 경로는 읽을 수 없습니다.".into());
    }
    if !is_supported_book_extension(&raw) {
        return Err("UNSUPPORTED_FORMAT: .txt 또는 .epub 파일만 열 수 있습니다.".into());
    }

    let canonical = dunce::canonicalize(&raw)
        .map_err(|e| format!("FILE_READ_FAILED: 파일 정보를 확인할 수 없습니다: {e}"))?;
    if is_sensitive_path(&canonical, home_dir) {
        return Err("SECURITY_DENIED: 심볼릭 링크 대상이 보호 경로여서 차단되었습니다.".into());
    }
    if !is_supported_book_extension(&canonical) {
        return Err("UNSUPPORTED_FORMAT: 정규화된 대상이 .txt 또는 .epub 파일이 아닙니다.".into());
    }

    let in_approved_dir = approved_dirs.iter().any(|dir| canonical.starts_with(dir));
    let in_approved_drop = approved_drops.contains(&canonical);
    if !in_approved_dir && !in_approved_drop && !fs_scope_allowed {
        return Err(
            "SECURITY_DENIED: 승인된 저장소, 파일 다이얼로그 또는 드롭 화이트리스트에 없는 파일입니다."
                .into(),
        );
    }

    let metadata = std::fs::metadata(&canonical)
        .map_err(|e| format!("FILE_READ_FAILED: 파일 정보를 확인할 수 없습니다: {e}"))?;
    if !metadata.is_file() {
        return Err("INVALID_FILE: 일반 파일만 읽을 수 있습니다.".into());
    }
    Ok(canonical)
}

pub fn validate_and_read_book_file(
    raw_path: &str,
    max_bytes: Option<u64>,
    approved_dirs: &HashSet<PathBuf>,
    approved_drops: &HashSet<PathBuf>,
    fs_scope_allowed: bool,
    home_dir: Option<&Path>,
) -> Result<Vec<u8>, String> {
    let canonical =
        resolve_validated_book_path(raw_path, approved_dirs, approved_drops, fs_scope_allowed, home_dir)?;
    let metadata = std::fs::metadata(&canonical)
        .map_err(|e| format!("FILE_READ_FAILED: 파일 정보를 확인할 수 없습니다: {e}"))?;
    let ceiling = max_bytes.unwrap_or(MAX_BOOK_BYTES).min(MAX_BOOK_BYTES);
    if metadata.len() > ceiling {
        return Err(format!(
            "FILE_TOO_LARGE: 도서 파일 크기가 허용 상한({ceiling} bytes)을 초과했습니다."
        ));
    }
    std::fs::read(&canonical).map_err(|e| format!("FILE_READ_FAILED: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_storage_dir_paths() {
        assert!(validate_storage_dir_path("").is_err());
        assert!(validate_storage_dir_path("relative/folder").is_err());
        assert!(validate_storage_dir_path("/tmp/books/../escape").is_err());
        assert!(validate_storage_dir_path("/tmp/books").is_ok());
    }

    #[test]
    fn enforces_zero_trust_storage_and_read_whitelist_negative_cases() {
        let sandbox_root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("target").join("unit-test-zero-trust");
        let _ = std::fs::remove_dir_all(&sandbox_root);
        std::fs::create_dir_all(&sandbox_root).unwrap();
        let fake_home = sandbox_root.join("home");
        std::fs::create_dir_all(&fake_home).unwrap();

        for blocked in ["/System/Library", "/Library/Preferences", "/etc/ssh", "/private/etc"] {
            assert!(validate_and_prepare_storage_dir(blocked, Some(&fake_home)).is_err());
        }
        let nested_safe = sandbox_root.join("books").join("nested-leaf");
        let prepared = validate_and_prepare_storage_dir(nested_safe.to_str().unwrap(), Some(&fake_home)).unwrap();
        let approved_file = prepared.join("allowed.txt");
        std::fs::write(&approved_file, b"hello allowed book").unwrap();
        let outside_dir = sandbox_root.join("outside");
        std::fs::create_dir_all(&outside_dir).unwrap();
        let unapproved_file = outside_dir.join("secret.txt");
        std::fs::write(&unapproved_file, b"should not read").unwrap();

        let mut approved_dirs = HashSet::new();
        approved_dirs.insert(prepared.clone());
        let empty_drops = HashSet::new();
        assert_eq!(
            validate_and_read_book_file(approved_file.to_str().unwrap(), None, &approved_dirs, &empty_drops, false, Some(&fake_home)).unwrap(),
            b"hello allowed book"
        );
        assert!(validate_and_read_book_file(unapproved_file.to_str().unwrap(), None, &approved_dirs, &empty_drops, false, Some(&fake_home)).unwrap_err().contains("SECURITY_DENIED"));
        let mut drops = HashSet::new();
        drops.insert(dunce::canonicalize(&unapproved_file).unwrap());
        assert_eq!(
            validate_and_read_book_file(unapproved_file.to_str().unwrap(), None, &approved_dirs, &drops, false, Some(&fake_home)).unwrap(),
            b"should not read"
        );
        let _ = std::fs::remove_dir_all(&sandbox_root);
    }

    #[test]
    fn is_sensitive_path_blocks_case_variants_when_case_insensitive() {
        let fake_home = PathBuf::from("/Users/AliceSandbox");
        assert!(is_sensitive_path_with_case_mode(Path::new("/system/Library"), Some(&fake_home), true));
        assert!(is_sensitive_path_with_case_mode(Path::new("/ETC/passwd"), Some(&fake_home), true));
        assert!(is_sensitive_path_with_case_mode(&fake_home.join(".SSH/id_ed25519"), Some(&fake_home), true));
        assert!(!is_sensitive_path_with_case_mode(Path::new("/etcetera/Books"), Some(&fake_home), true));
    }

    #[test]
    fn blocks_windows_system_unc_and_extra_credential_paths_t009() {
        let win_home = PathBuf::from("C:/Users/Reader");
        for blocked in [
            "C:/Windows/System32/cmd.exe",
            "C:\\Program Files\\App\\book.txt",
            "C:\\Program Files (x86)\\App\\book.txt",
            "C:\\ProgramData\\secret\\book.epub",
            "C:/Recovery/OEM/book.txt",
            "C:/Users/Reader/AppData/Local/Microsoft/Credentials/book.txt",
            "\\\\?\\C:\\Windows\\System32\\book.txt",
            "\\\\?\\UNC\\server\\share\\book.epub",
            "//fileserver/share/book.epub",
        ] {
            assert!(
                is_sensitive_path_with_case_mode(Path::new(blocked), Some(&win_home), true),
                "Expected Windows/UNC path to be blocked: {blocked}"
            );
        }
        for cred_file in [
            "/Users/reader/.git-credentials",
            "/Users/reader/.npmrc",
            "/Users/reader/.netrc",
        ] {
            assert!(
                is_sensitive_path_with_case_mode(Path::new(cred_file), None, false),
                "Expected credential path to be blocked: {cred_file}"
            );
        }
    }
}
