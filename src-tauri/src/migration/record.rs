// SPDX-License-Identifier: GPL-3.0-only
//! `migration-v1.json` (data-model §1). Only category codes are stored, never paths or secrets.

use serde::{Deserialize, Serialize};
use std::fs;
use std::io;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

pub const RECORD_FILE: &str = "migration-v1.json";
pub const SCHEMA: u32 = 1;
pub const SOURCE_IDENTIFIER: &str = "com.edith.easyviewer";
pub const TARGET_IDENTIFIER: &str = "com.ezenitac.easyviewer";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MigrationState {
    Migrated,
    SkippedTargetNotEmpty,
    SkippedNoSource,
    Partial,
    Failed,
    Declined,
    DiscardPending,
    Discarded,
}

impl MigrationState {
    /// `discard_pending` is the only intermediate state.
    pub fn is_final(self) -> bool {
        self != MigrationState::DiscardPending
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MigrationErrorKind {
    Io,
    Permission,
    Space,
    Boundary,
    Busy,
}

impl MigrationErrorKind {
    pub fn from_io(err: &io::Error) -> Self {
        match err.kind() {
            io::ErrorKind::PermissionDenied | io::ErrorKind::ReadOnlyFilesystem => Self::Permission,
            io::ErrorKind::StorageFull | io::ErrorKind::QuotaExceeded => Self::Space,
            _ => Self::Io,
        }
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CopiedTargets {
    pub data_dir: bool,
    pub webview_store: bool,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CredentialSummary {
    pub migrated: u32,
    pub missing: u32,
    pub failed: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub skipped: Option<bool>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MigrationRecord {
    pub schema: u32,
    pub state: MigrationState,
    pub source_identifier: String,
    pub started_at: String,
    pub finished_at: String,
    #[serde(default)]
    pub copied: CopiedTargets,
    #[serde(default)]
    pub skipped_entries: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<MigrationErrorKind>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub credentials: Option<CredentialSummary>,
    #[serde(default)]
    pub reconstructed: bool,
    #[serde(default)]
    pub notice_acknowledged: bool,
}

impl MigrationRecord {
    pub fn new(state: MigrationState) -> Self {
        let now = iso8601_utc(SystemTime::now());
        MigrationRecord {
            schema: SCHEMA,
            state,
            source_identifier: SOURCE_IDENTIFIER.to_string(),
            started_at: now.clone(),
            finished_at: now,
            copied: CopiedTargets::default(),
            skipped_entries: 0,
            error: None,
            credentials: None,
            reconstructed: false,
            notice_acknowledged: false,
        }
    }

    fn unreadable() -> Self {
        let mut rec = Self::new(MigrationState::Failed);
        rec.error = Some(MigrationErrorKind::Io);
        rec
    }
}

/// Reads the record. A record that cannot be parsed or has another schema counts as `failed`
/// (final), so the migration is never retried over existing new data.
pub fn read_record(dir: &Path) -> Option<MigrationRecord> {
    let raw = fs::read(dir.join(RECORD_FILE)).ok()?;
    let value: serde_json::Value = match serde_json::from_slice(&raw) {
        Ok(v) => v,
        Err(_) => return Some(MigrationRecord::unreadable()),
    };
    if value.get("schema").and_then(|s| s.as_u64()) != Some(u64::from(SCHEMA)) {
        return Some(MigrationRecord::unreadable());
    }
    Some(serde_json::from_value(value).unwrap_or_else(|_| MigrationRecord::unreadable()))
}

/// Writes the record atomically (temp file + rename) inside `dir`.
pub fn write_record(dir: &Path, record: &MigrationRecord) -> io::Result<()> {
    fs::create_dir_all(dir)?;
    let json = serde_json::to_vec_pretty(record).map_err(io::Error::other)?;
    let tmp = dir.join(format!(".{RECORD_FILE}.tmp"));
    fs::write(&tmp, json)?;
    fs::rename(&tmp, dir.join(RECORD_FILE))
}

/// Formats a timestamp as ISO 8601 UTC (`YYYY-MM-DDTHH:MM:SSZ`) without extra dependencies.
pub fn iso8601_utc(time: SystemTime) -> String {
    let secs = time.duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    let (days, rem) = (secs / 86_400, secs % 86_400);
    let (h, m, s) = (rem / 3600, (rem % 3600) / 60, rem % 60);
    // Civil-from-days (Howard Hinnant), valid for the Unix era.
    let z = days as i64 + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = yoe + era * 400 + i64::from(month <= 2);
    format!("{year:04}-{month:02}-{day:02}T{h:02}:{m:02}:{s:02}Z")
}

#[cfg(test)]
mod unit {
    use super::*;
    use std::time::Duration;

    #[test]
    fn iso8601_matches_known_instants() {
        assert_eq!(iso8601_utc(UNIX_EPOCH), "1970-01-01T00:00:00Z");
        assert_eq!(iso8601_utc(UNIX_EPOCH + Duration::from_secs(951_782_400)), "2000-02-29T00:00:00Z");
        assert_eq!(iso8601_utc(UNIX_EPOCH + Duration::from_secs(1_795_000_000)), "2026-11-18T11:06:40Z");
    }
}
