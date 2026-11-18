// SPDX-License-Identifier: GPL-3.0-only
//! Detects a running legacy-identifier app (old fork build or the original app) without new
//! dependencies: macOS `lsappinfo`, Linux `/proc/*/exe` (research R1, F25).

use std::path::Path;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OldAppStatus {
    Running,
    NotRunning,
    /// Detection itself failed; the user is asked as if it were running.
    Unknown,
}

const LEGACY_EXE: &str = "easy-viewer";

/// `lsappinfo find bundleid=<id>` prints one ASN per running process and nothing otherwise.
pub fn parse_lsappinfo_running(stdout: &str) -> bool {
    stdout.contains("ASN:")
}

/// Matches the legacy executable name exactly (deb/rpm `/usr/bin/easy-viewer`, AppImage mount).
pub fn is_legacy_exe(exe: &Path) -> bool {
    exe.file_name().and_then(|n| n.to_str()) == Some(LEGACY_EXE)
}

#[cfg(target_os = "macos")]
pub fn detect_old_app() -> OldAppStatus {
    let out = std::process::Command::new("/usr/bin/lsappinfo")
        .args(["find", &format!("bundleid={}", super::record::SOURCE_IDENTIFIER)])
        .output();
    match out {
        Ok(o) if o.status.success() => {
            if parse_lsappinfo_running(&String::from_utf8_lossy(&o.stdout)) {
                OldAppStatus::Running
            } else {
                OldAppStatus::NotRunning
            }
        }
        _ => OldAppStatus::Unknown,
    }
}

#[cfg(target_os = "linux")]
pub fn detect_old_app() -> OldAppStatus {
    let Ok(entries) = std::fs::read_dir("/proc") else {
        return OldAppStatus::Unknown;
    };
    for entry in entries.flatten() {
        let name = entry.file_name();
        if !name.to_string_lossy().bytes().all(|b| b.is_ascii_digit()) {
            continue;
        }
        // Other users' processes are unreadable; they cannot share this user's data folder.
        if let Ok(exe) = std::fs::read_link(entry.path().join("exe")) {
            if is_legacy_exe(&exe) {
                return OldAppStatus::Running;
            }
        }
    }
    OldAppStatus::NotRunning
}

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
pub fn detect_old_app() -> OldAppStatus {
    OldAppStatus::NotRunning
}
