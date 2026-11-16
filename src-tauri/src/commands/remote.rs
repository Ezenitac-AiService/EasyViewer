use std::collections::HashMap;
use std::net::IpAddr;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use base64::Engine;
use futures_util::StreamExt;
use reqwest::header::{HeaderMap, HeaderName, HeaderValue, AUTHORIZATION, COOKIE, LOCATION};
use reqwest::redirect::Policy;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::Manager;
use tokio::io::{AsyncWriteExt, BufWriter};

#[cfg(desktop)]
use crate::security::path_guard::AppSecurityState;
use crate::security::path_guard::{
    user_home_dir, validate_and_prepare_storage_dir, MAX_BOOK_BYTES,
};
use crate::security::ssrf::{
    compute_remaining_budget, is_allowed_method, resolve_and_pin_host, same_origin,
    validate_url_syntax, PinnedSsrfResolver,
};

const MAX_REQUEST_BODY_BYTES: usize = 1024 * 1024;
const MAX_REDIRECTS: usize = 5;
const DEFAULT_TIMEOUT_MS: u64 = 30_000;
const CONNECT_TIMEOUT_SECS: u64 = 10;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SafeRemoteFetchRequest {
    pub url: String,
    pub method: String,
    pub headers: Option<HashMap<String, String>>,
    pub body_base64: Option<String>,
    pub allow_private_nas: Option<bool>,
    pub allow_self_signed_tls: Option<bool>,
    pub timeout_ms: Option<u64>,
    pub max_response_bytes: Option<u64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SafeRemoteFetchResponse {
    pub status: u16,
    pub status_text: String,
    pub headers: HashMap<String, String>,
    pub body_base64: String,
    pub final_url: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SafeDownloadRequest {
    pub url: String,
    pub headers: Option<HashMap<String, String>>,
    pub dest_dir: Option<String>,
    pub allow_private_nas: Option<bool>,
    pub allow_self_signed_tls: Option<bool>,
    pub timeout_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgressEvent {
    pub received_bytes: u64,
    pub total_bytes: Option<u64>,
    pub percent: u8,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeDownloadResult {
    pub stored_path: String,
    pub file_name: String,
    pub file_size: u64,
    pub content_hash: String,
    pub final_url: String,
    pub detected_format: String,
}

fn build_http_client(
    allow_self_signed: bool,
    pinned_map: Arc<Mutex<HashMap<String, IpAddr>>>,
) -> Result<reqwest::Client, String> {
    let resolver = Arc::new(PinnedSsrfResolver { pinned: pinned_map });
    reqwest::Client::builder()
        .redirect(Policy::none())
        .connect_timeout(Duration::from_secs(CONNECT_TIMEOUT_SECS))
        .danger_accept_invalid_certs(allow_self_signed)
        .dns_resolver(resolver)
        .build()
        .map_err(|e| format!("HTTP_CLIENT_ERROR: {e}"))
}

#[allow(unused_variables)]
fn resolve_download_dir(app: &tauri::AppHandle, requested: Option<&str>) -> Result<PathBuf, String> {
    #[cfg(desktop)]
    {
        let raw_dir = match requested {
            Some(d) if !d.trim().is_empty() => PathBuf::from(d),
            _ => app
                .path()
                .app_data_dir()
                .map_err(|e| format!("STORAGE_DIR_WRITE_FAILED: {e}"))?
                .join("books"),
        };
        let canonical = validate_and_prepare_storage_dir(
            raw_dir.to_string_lossy().as_ref(),
            user_home_dir().as_deref(),
        )
        .map_err(|e| format!("STORAGE_DIR_WRITE_FAILED: {e}"))?;
        let state = app.state::<AppSecurityState>();
        if let Ok(mut dirs) = state.approved_storage_dirs.lock() {
            dirs.insert(canonical.clone());
        }
        return Ok(canonical);
    }
    #[cfg(mobile)]
    {
        let dir = app
            .path()
            .app_data_dir()
            .map_err(|e| format!("STORAGE_DIR_WRITE_FAILED: {e}"))?
            .join("books");
        std::fs::create_dir_all(&dir).map_err(|e| format!("STORAGE_DIR_WRITE_FAILED: {e}"))?;
        Ok(dir)
    }
}

pub fn make_unique_part_path(dir: &Path, sanitized_name: &str, nonce: u128) -> PathBuf {
    dir.join(format!("{sanitized_name}.{nonce}.part"))
}

pub fn map_remote_transport_error(msg: &str, allow_self_signed: bool, timed_out: bool) -> String {
    let lower = msg.to_ascii_lowercase();
    if timed_out || lower.contains("timed out") {
        format!("TIMEOUT: 원격 요청 제한 시간이 초과되었습니다: {msg}")
    } else if !allow_self_signed
        && (lower.contains("certificate")
            || lower.contains("tls")
            || lower.contains("self-signed")
            || lower.contains("unknown issuer")
            || lower.contains("unknownissuer"))
    {
        format!("SELF_SIGNED_TLS_CONFIRM_REQUIRED: TLS 인증서 검증에 실패했습니다: {msg}")
    } else {
        format!("REMOTE_FETCH_FAILED: 원격 요청 실패: {msg}")
    }
}

pub fn strip_sensitive_redirect_headers(
    initial_url: &reqwest::Url,
    next_url: &reqwest::Url,
    headers: &mut HeaderMap,
) {
    if !same_origin(initial_url, next_url) {
        headers.remove(AUTHORIZATION);
        headers.remove(COOKIE);
    }
}

fn build_sanitized_header_map(raw_headers: Option<HashMap<String, String>>) -> HeaderMap {
    let mut header_map = HeaderMap::new();
    if let Some(map) = raw_headers {
        for (k, v) in map {
            let lower = k.to_ascii_lowercase();
            if lower == "host" || lower == "content-length" || lower == "connection" {
                continue;
            }
            if let (Ok(name), Ok(val)) = (HeaderName::from_bytes(k.as_bytes()), HeaderValue::from_str(&v)) {
                header_map.insert(name, val);
            }
        }
    }
    header_map
}

fn sanitize_download_filename(url: &reqwest::Url) -> String {
    let raw = url
        .path_segments()
        .and_then(|mut s| s.next_back())
        .filter(|s| !s.is_empty())
        .unwrap_or("downloaded_book.epub");
    let clean: String = raw
        .chars()
        .map(|c| if matches!(c, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*') || c.is_control() { '_' } else { c })
        .collect();
    if clean.is_empty() { "downloaded_book.epub".to_string() } else { clean }
}

#[tauri::command]
pub async fn safe_remote_fetch(request: SafeRemoteFetchRequest) -> Result<SafeRemoteFetchResponse, String> {
    let mut method = is_allowed_method(&request.method)?;
    let mut current_url = validate_url_syntax(&request.url)?;
    let allow_private_nas = request.allow_private_nas.unwrap_or(false);
    let allow_self_signed = request.allow_self_signed_tls.unwrap_or(false);
    let timeout = Duration::from_millis(request.timeout_ms.unwrap_or(DEFAULT_TIMEOUT_MS).clamp(1_000, 120_000));
    let max_bytes = request.max_response_bytes.unwrap_or(MAX_BOOK_BYTES).min(MAX_BOOK_BYTES) as usize;

    let mut body_bytes = match request.body_base64 {
        Some(encoded) if !encoded.is_empty() => base64::engine::general_purpose::STANDARD
            .decode(encoded.as_bytes())
            .map_err(|e| format!("INVALID_BODY: 요청 본문 Base64 디코딩 실패: {e}"))?,
        _ => Vec::new(),
    };
    if body_bytes.len() > MAX_REQUEST_BODY_BYTES {
        return Err("PAYLOAD_TOO_LARGE: 요청 본문이 허용 상한(1 MiB)을 초과했습니다.".into());
    }

    let mut header_map = build_sanitized_header_map(request.headers);
    let initial_url = current_url.clone();
    let deadline = Instant::now() + timeout;
    let pinned_map = Arc::new(Mutex::new(HashMap::<String, IpAddr>::new()));
    let client = build_http_client(allow_self_signed, Arc::clone(&pinned_map))?;

    for hop in 0..=MAX_REDIRECTS {
        let remaining = compute_remaining_budget(deadline, Instant::now())?;
        let (host, pinned_addr) = resolve_and_pin_host(&current_url, allow_private_nas)?;
        if let Ok(mut guard) = pinned_map.lock() { guard.insert(host, pinned_addr.ip()); }

        let mut req_builder = client.request(method.clone(), current_url.clone()).timeout(remaining).headers(header_map.clone());
        if !body_bytes.is_empty() && !matches!(method.as_str(), "GET" | "HEAD") {
            req_builder = req_builder.body(body_bytes.clone());
        }
        let mut response = req_builder.send().await.map_err(|e| {
            map_remote_transport_error(
                &e.to_string(),
                allow_self_signed,
                e.is_timeout() || Instant::now() >= deadline,
            )
        })?;

        let status = response.status();
        if status.is_redirection() {
            if hop >= MAX_REDIRECTS { return Err("TOO_MANY_REDIRECTS: 리다이렉트 횟수(5회)를 초과했습니다.".into()); }
            let location = response.headers().get(LOCATION).and_then(|v| v.to_str().ok()).ok_or_else(|| "INVALID_REDIRECT: Location 헤더가 없습니다.".to_string())?;
            let next_url = current_url.join(location).map_err(|e| format!("INVALID_REDIRECT: 잘못된 Location URI: {e}"))?;
            validate_url_syntax(next_url.as_str())?;
            strip_sensitive_redirect_headers(&initial_url, &next_url, &mut header_map);
            if status.as_u16() == 303 { method = reqwest::Method::GET; body_bytes.clear(); }
            current_url = next_url;
            continue;
        }
        if let Some(len) = response.content_length() {
            if (len as usize) > max_bytes { return Err("RESPONSE_TOO_LARGE: 응답 크기가 허용 상한(256 MiB)을 초과했습니다.".into()); }
        }
        let mut response_headers = HashMap::new();
        for (name, val) in response.headers().iter() {
            if let Ok(s) = val.to_str() { response_headers.insert(name.as_str().to_ascii_lowercase(), s.to_string()); }
        }
        let mut acc = Vec::new();
        while let Some(chunk) = response.chunk().await.map_err(|e| format!("REMOTE_STREAM_FAILED: {e}"))? {
            compute_remaining_budget(deadline, Instant::now())?;
            if acc.len().saturating_add(chunk.len()) > max_bytes {
                return Err("RESPONSE_TOO_LARGE: 응답 크기가 허용 상한(256 MiB)을 초과했습니다.".into());
            }
            acc.extend_from_slice(&chunk);
        }
        return Ok(SafeRemoteFetchResponse {
            status: status.as_u16(),
            status_text: status.canonical_reason().unwrap_or("").to_string(),
            headers: response_headers,
            body_base64: base64::engine::general_purpose::STANDARD.encode(&acc),
            final_url: current_url.to_string(),
        });
    }
    Err("TOO_MANY_REDIRECTS: 리다이렉트 처리에 실패했습니다.".into())
}

#[tauri::command]
pub async fn safe_download_to_storage(
    app: tauri::AppHandle,
    request: SafeDownloadRequest,
    on_progress: tauri::ipc::Channel<DownloadProgressEvent>,
) -> Result<NativeDownloadResult, String> {
    let dest_dir = resolve_download_dir(&app, request.dest_dir.as_deref())?;
    let mut current_url = validate_url_syntax(&request.url)?;
    let allow_private_nas = request.allow_private_nas.unwrap_or(false);
    let allow_self_signed = request.allow_self_signed_tls.unwrap_or(false);
    let timeout = Duration::from_millis(request.timeout_ms.unwrap_or(120_000).clamp(1_000, 300_000));
    let mut header_map = build_sanitized_header_map(request.headers);
    let initial_url = current_url.clone();
    let deadline = Instant::now() + timeout;
    let pinned_map = Arc::new(Mutex::new(HashMap::<String, IpAddr>::new()));
    let client = build_http_client(allow_self_signed, Arc::clone(&pinned_map))?;

    for hop in 0..=MAX_REDIRECTS {
        let remaining = compute_remaining_budget(deadline, Instant::now())?;
        let (host, pinned_addr) = resolve_and_pin_host(&current_url, allow_private_nas)?;
        if let Ok(mut guard) = pinned_map.lock() { guard.insert(host, pinned_addr.ip()); }

        let response = client
            .get(current_url.clone())
            .timeout(remaining)
            .headers(header_map.clone())
            .send()
            .await
            .map_err(|e| {
                map_remote_transport_error(
                    &e.to_string(),
                    allow_self_signed,
                    e.is_timeout() || Instant::now() >= deadline,
                )
            })?;
        if response.status().is_redirection() {
            if hop >= MAX_REDIRECTS { return Err("TOO_MANY_REDIRECTS: 리다이렉트 횟수 초과".into()); }
            let loc = response.headers().get(LOCATION).and_then(|v| v.to_str().ok()).ok_or_else(|| "INVALID_REDIRECT: Location 헤더 없음".to_string())?;
            let next_url = current_url.join(loc).map_err(|e| format!("INVALID_REDIRECT: {e}"))?;
            validate_url_syntax(next_url.as_str())?;
            strip_sensitive_redirect_headers(&initial_url, &next_url, &mut header_map);
            current_url = next_url;
            continue;
        }
        if !response.status().is_success() {
            return Err(format!("HTTP_ERROR: 원격 다운로드 실패 (HTTP {})", response.status().as_u16()));
        }
        let total_bytes = response.content_length();
        if let Some(len) = total_bytes {
            if len > MAX_BOOK_BYTES { return Err("RESPONSE_TOO_LARGE: 256 MiB 상한 초과".into()); }
        }

        let file_name = sanitize_download_filename(&current_url);
        let nonce = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0);
        let part_path = make_unique_part_path(&dest_dir, &file_name, nonce);
        let final_path = dest_dir.join(&file_name);

        let file = tokio::fs::File::create(&part_path).await.map_err(|e| format!("STORAGE_DIR_WRITE_FAILED: {e}"))?;
        let mut writer = BufWriter::with_capacity(64 * 1024, file);
        let mut hasher = Sha256::new();
        let mut stream = response.bytes_stream();
        let mut received: u64 = 0;

        while let Some(chunk_res) = stream.next().await {
            if let Err(e) = compute_remaining_budget(deadline, Instant::now()) {
                let _ = tokio::fs::remove_file(&part_path).await;
                return Err(e);
            }
            let chunk = match chunk_res {
                Ok(c) => c,
                Err(e) => {
                    let _ = tokio::fs::remove_file(&part_path).await;
                    return Err(map_remote_transport_error(
                        &e.to_string(),
                        allow_self_signed,
                        e.is_timeout() || Instant::now() >= deadline,
                    ));
                }
            };
            received += chunk.len() as u64;
            if received > MAX_BOOK_BYTES {
                let _ = tokio::fs::remove_file(&part_path).await;
                return Err("RESPONSE_TOO_LARGE: 256 MiB 상한 초과".into());
            }
            hasher.update(&chunk);
            if let Err(e) = writer.write_all(&chunk).await {
                let _ = tokio::fs::remove_file(&part_path).await;
                return Err(format!("STORAGE_DIR_WRITE_FAILED: {e}"));
            }
            let percent = total_bytes.map(|t| if t > 0 { ((received * 100) / t).min(99) as u8 } else { 50 }).unwrap_or(50);
            let _ = on_progress.send(DownloadProgressEvent { received_bytes: received, total_bytes, percent });
        }

        if let Err(e) = writer.flush().await {
            let _ = tokio::fs::remove_file(&part_path).await;
            return Err(format!("STORAGE_DIR_WRITE_FAILED: {e}"));
        }
        drop(writer);
        if let Err(e) = tokio::fs::rename(&part_path, &final_path).await {
            let _ = tokio::fs::remove_file(&part_path).await;
            return Err(format!("STORAGE_DIR_WRITE_FAILED: {e}"));
        }
        let _ = on_progress.send(DownloadProgressEvent { received_bytes: received, total_bytes: Some(received), percent: 100 });

        let detected_format = if file_name.to_ascii_lowercase().ends_with(".txt") { "txt" } else { "epub" }.to_string();
        return Ok(NativeDownloadResult {
            stored_path: final_path.to_string_lossy().to_string(),
            file_name,
            file_size: received,
            content_hash: format!("sha256-{}", hex::encode(hasher.finalize())),
            final_url: current_url.to_string(),
            detected_format,
        });
    }
    Err("TOO_MANY_REDIRECTS: 리다이렉트 처리 실패".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unique_part_paths_never_collide_across_concurrent_nonces_t018() {
        let dir = Path::new("/tmp/books");
        let p1 = make_unique_part_path(dir, "novel.epub", 101);
        let p2 = make_unique_part_path(dir, "novel.epub", 102);
        assert_ne!(p1, p2);
        assert!(p1.to_string_lossy().ends_with(".part"));
    }

    #[test]
    fn maps_tls_errors_and_strips_cross_origin_auth_headers_t052() {
        assert!(
            map_remote_transport_error("invalid peer certificate: UnknownIssuer", false, false)
                .starts_with("SELF_SIGNED_TLS_CONFIRM_REQUIRED:")
        );
        assert!(
            map_remote_transport_error("operation timed out", false, true)
                .starts_with("TIMEOUT:")
        );

        let mut headers = HeaderMap::new();
        headers.insert(AUTHORIZATION, HeaderValue::from_static("Basic dXNlcjpwYXNz"));
        headers.insert(COOKIE, HeaderValue::from_static("sid=123"));
        let origin_a = reqwest::Url::parse("https://nas.example.com/books/a.epub").unwrap();
        let origin_b = reqwest::Url::parse("https://cdn.other.com/books/a.epub").unwrap();
        strip_sensitive_redirect_headers(&origin_a, &origin_b, &mut headers);
        assert!(!headers.contains_key(AUTHORIZATION));
        assert!(!headers.contains_key(COOKIE));
    }
}
