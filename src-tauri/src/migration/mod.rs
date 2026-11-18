// SPDX-License-Identifier: GPL-3.0-only
//! One-time desktop data migration from the legacy identifier (spec 003 US6, FR-018).
//!
//! Invariant: no persistent WebView (main window) is created before the migration decision is
//! final, otherwise the new identifier's WebKit store would appear and the chance to migrate
//! would be lost (contracts/data-migration.md §1).

#[cfg(desktop)]
pub mod commands;
pub mod credentials;
pub mod decide;
pub mod detect;
pub mod engine;
pub mod lock;
pub mod paths;
pub mod record;
#[cfg(desktop)]
pub mod startup;
pub mod window;

#[cfg(test)]
mod tests;
