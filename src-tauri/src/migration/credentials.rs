// SPDX-License-Identifier: GPL-3.0-only
//! Legacy WebDAV credential migration (research R2, data-model §2, contracts §3).
//! Secrets stay inside Rust: responses, logs and the record only carry counts.

use serde::Serialize;

pub const MAX_ACCOUNT_KEYS: usize = 64;
const ACCOUNT_PREFIX: &str = "easyviewer:webdav:";

/// Keychain access, abstracted so the logic is testable with an in-memory double.
pub trait SecretStore {
    fn get(&self, account: &str) -> Result<Option<String>, ()>;
    fn set(&self, account: &str, secret: &str) -> Result<(), ()>;
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize)]
pub struct CredentialOutcome {
    pub migrated: u32,
    pub missing: u32,
    pub failed: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InvalidAccountKeys {
    TooMany,
    BadFormat,
}

/// Every key must be `easyviewer:webdav:<id>` with `<id>` = `[A-Za-z0-9_-]{1,128}`.
/// One bad key rejects the whole request.
pub fn validate_account_keys(keys: &[String]) -> Result<(), InvalidAccountKeys> {
    if keys.len() > MAX_ACCOUNT_KEYS {
        return Err(InvalidAccountKeys::TooMany);
    }
    let valid = |key: &String| {
        key.strip_prefix(ACCOUNT_PREFIX).is_some_and(|id| {
            (1..=128).contains(&id.len())
                && id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
        })
    };
    if keys.iter().all(valid) {
        Ok(())
    } else {
        Err(InvalidAccountKeys::BadFormat)
    }
}

/// Copies each account from `legacy` to `current` when `current` has no value yet.
/// Never deletes legacy entries and never overwrites the new service.
pub fn migrate_credentials(
    legacy: &dyn SecretStore,
    current: &dyn SecretStore,
    keys: &[String],
) -> Result<CredentialOutcome, InvalidAccountKeys> {
    validate_account_keys(keys)?;
    let mut out = CredentialOutcome::default();
    for key in keys {
        match current.get(key) {
            Ok(Some(existing)) if !existing.is_empty() => continue, // new service wins
            Ok(_) => {}
            Err(()) => {
                out.failed += 1;
                continue;
            }
        }
        match legacy.get(key) {
            Ok(Some(secret)) if !secret.is_empty() => match current.set(key, &secret) {
                Ok(()) => out.migrated += 1,
                Err(()) => out.failed += 1,
            },
            Ok(_) => out.missing += 1,
            Err(()) => out.failed += 1,
        }
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;
    use std::collections::{HashMap, HashSet};

    #[derive(Default)]
    struct MemStore {
        values: RefCell<HashMap<String, String>>,
        deny: HashSet<String>,
        writes: RefCell<u32>,
        deletes: RefCell<u32>,
    }

    impl MemStore {
        fn with(pairs: &[(&str, &str)]) -> Self {
            let s = MemStore::default();
            for (k, v) in pairs {
                s.values.borrow_mut().insert(k.to_string(), v.to_string());
            }
            s
        }
    }

    impl SecretStore for MemStore {
        fn get(&self, account: &str) -> Result<Option<String>, ()> {
            if self.deny.contains(account) {
                return Err(());
            }
            Ok(self.values.borrow().get(account).cloned())
        }
        fn set(&self, account: &str, secret: &str) -> Result<(), ()> {
            if self.deny.contains(account) {
                return Err(());
            }
            *self.writes.borrow_mut() += 1;
            self.values.borrow_mut().insert(account.to_string(), secret.to_string());
            Ok(())
        }
    }

    fn keys(ids: &[&str]) -> Vec<String> {
        ids.iter().map(|id| format!("easyviewer:webdav:{id}")).collect()
    }

    #[test]
    fn rejects_more_than_64_keys_and_any_malformed_key() {
        let many: Vec<String> = (0..65).map(|i| format!("easyviewer:webdav:c{i}")).collect();
        assert_eq!(validate_account_keys(&many), Err(InvalidAccountKeys::TooMany));
        assert_eq!(validate_account_keys(&many[..64]), Ok(()));
        for bad in [
            "easyviewer:webdav:",
            "easyviewer:webdav:a/b",
            "easyviewer:webdav:a b",
            "other:webdav:abc",
            "easyviewer:webdav:ünïcode",
        ] {
            let mut list = keys(&["ok1"]);
            list.push(bad.to_string());
            assert_eq!(validate_account_keys(&list), Err(InvalidAccountKeys::BadFormat), "{bad}");
        }
        let long = format!("easyviewer:webdav:{}", "a".repeat(129));
        assert_eq!(validate_account_keys(&[long]), Err(InvalidAccountKeys::BadFormat));
        assert_eq!(validate_account_keys(&keys(&["A-z_09"])), Ok(()));

        let legacy = MemStore::with(&[("easyviewer:webdav:ok1", "s1")]);
        let current = MemStore::default();
        let mut list = keys(&["ok1"]);
        list.push("bad key".into());
        assert!(migrate_credentials(&legacy, &current, &list).is_err());
        assert_eq!(*current.writes.borrow(), 0, "a rejected request writes nothing");
    }

    #[test]
    fn migrates_missing_and_failed_without_overwriting_or_deleting() {
        let legacy = MemStore::with(&[
            ("easyviewer:webdav:a", "secret-a"),
            ("easyviewer:webdav:keep", "old-value"),
            ("easyviewer:webdav:denied", "x"),
        ]);
        let mut current = MemStore::with(&[("easyviewer:webdav:keep", "new-value")]);
        current.deny.insert("easyviewer:webdav:denied".into());
        let out = migrate_credentials(&legacy, &current, &keys(&["a", "keep", "gone", "denied"])).unwrap();
        assert_eq!(out, CredentialOutcome { migrated: 1, missing: 1, failed: 1 });
        assert_eq!(current.values.borrow()["easyviewer:webdav:a"], "secret-a");
        assert_eq!(current.values.borrow()["easyviewer:webdav:keep"], "new-value", "new service wins");
        assert_eq!(legacy.values.borrow().len(), 3, "legacy entries are never deleted");
        assert_eq!(*legacy.deletes.borrow(), 0);
    }

    #[test]
    fn legacy_read_failure_counts_as_failed() {
        let mut legacy = MemStore::with(&[("easyviewer:webdav:a", "s")]);
        legacy.deny.insert("easyviewer:webdav:a".into());
        let current = MemStore::default();
        let out = migrate_credentials(&legacy, &current, &keys(&["a"])).unwrap();
        assert_eq!(out, CredentialOutcome { migrated: 0, missing: 0, failed: 1 });
    }

    #[test]
    fn second_call_changes_nothing() {
        let legacy = MemStore::with(&[("easyviewer:webdav:a", "secret-a")]);
        let current = MemStore::default();
        migrate_credentials(&legacy, &current, &keys(&["a"])).unwrap();
        let writes = *current.writes.borrow();
        let again = migrate_credentials(&legacy, &current, &keys(&["a"])).unwrap();
        assert_eq!(again, CredentialOutcome::default());
        assert_eq!(*current.writes.borrow(), writes);
    }

    #[test]
    fn response_carries_no_secret_or_account_key() {
        let legacy = MemStore::with(&[("easyviewer:webdav:conn1", "hunter2-secret")]);
        let current = MemStore::default();
        let out = migrate_credentials(&legacy, &current, &keys(&["conn1"])).unwrap();
        let json = serde_json::to_string(&out).unwrap();
        assert!(!json.contains("hunter2") && !json.contains("conn1") && !json.contains("easyviewer"));
        assert_eq!(json, r#"{"migrated":1,"missing":0,"failed":0}"#);
    }
}
