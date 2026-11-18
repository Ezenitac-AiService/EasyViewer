// SPDX-License-Identifier: GPL-3.0-only
//! Pure startup decision (contracts/data-migration.md §1 flow). It only returns
//! `OpenMainWindow`/`RecordThenOpen`/`DiscardThenOpen` once the migration decision is final.

use super::detect::OldAppStatus;
use super::record::{MigrationRecord, MigrationState};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RecordView {
    Missing,
    Final(MigrationState),
    DiscardPending,
}

impl RecordView {
    pub fn from_record(record: Option<MigrationRecord>) -> Self {
        match record {
            None => RecordView::Missing,
            Some(r) if r.state == MigrationState::DiscardPending => RecordView::DiscardPending,
            Some(r) => RecordView::Final(r.state),
        }
    }
}

/// Answers of the native dialog shown while the legacy app is running.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UserChoice {
    Retry,
    SkipThisTime,
    Quit,
}

#[derive(Debug, Clone, Copy)]
pub struct DecisionInput {
    pub record: RecordView,
    /// Whether this platform migrates at all (macOS, Linux).
    pub applicable: bool,
    pub source_exists: bool,
    pub target_empty: bool,
    pub lock_acquired: bool,
    pub old_app: OldAppStatus,
    pub user_choice: Option<UserChoice>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Decision {
    OpenMainWindow,
    /// Write a final record with this state, then open the main window.
    RecordThenOpen(MigrationState),
    /// Empty the new folders, record `discarded`, then open the main window.
    DiscardThenOpen,
    /// Native dialog only; no main window. `undetermined` when detection failed.
    AskUser { undetermined: bool },
    /// Quit without a record and without a main window (asked again next launch).
    Exit,
    /// Copy on a background thread; the main window is created after the record is written.
    CopyInBackground,
}

pub fn decide(input: &DecisionInput) -> Decision {
    match input.record {
        RecordView::DiscardPending => return Decision::DiscardThenOpen,
        RecordView::Final(_) => return Decision::OpenMainWindow,
        RecordView::Missing => {}
    }
    if !input.applicable || !input.source_exists {
        return Decision::RecordThenOpen(MigrationState::SkippedNoSource);
    }
    if !input.target_empty {
        return Decision::RecordThenOpen(MigrationState::SkippedTargetNotEmpty);
    }
    if !input.lock_acquired {
        return Decision::Exit;
    }
    match input.user_choice {
        Some(UserChoice::SkipThisTime) => return Decision::RecordThenOpen(MigrationState::Declined),
        Some(UserChoice::Quit) => return Decision::Exit,
        Some(UserChoice::Retry) | None => {}
    }
    match input.old_app {
        OldAppStatus::NotRunning => Decision::CopyInBackground,
        OldAppStatus::Running => Decision::AskUser { undetermined: false },
        OldAppStatus::Unknown => Decision::AskUser { undetermined: true },
    }
}
