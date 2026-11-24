# Changelog

**언어 / Language**: [한국어](CHANGELOG.md) | **[English](CHANGELOG.en.md)**

This is the changelog of the independent fork of the original [EasyViewer](https://github.com/edith2580/EasyViewer) by edith2580. It follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The Korean [CHANGELOG.md](CHANGELOG.md) is the authoritative version.

## [Unreleased] — Korean and English public document cleanup (2026-11-24)

Reorganized the structure, flow and terms of the six public document pairs (README, CONTRIBUTING, SECURITY, CHANGELOG, NOTICE, THIRD_PARTY_LICENSES).

### Changed

- The README header now runs title → language switch → six badges → English banner → introduction → first-launch notice → fork and issue notice. The platform badge shows the support tiers, and the support-scope text moved to the "Supported platforms and releases" section.
- The README body puts the user sections first (differences from the original app, supported platforms and releases, features, controls, installation and first launch, building from source); developer details (tech stack, directory layout, verification commands, versions and builds, CI and releases) moved to the contributing guide.
- Public document titles and their top format (title → language switch → purpose sentence) are unified, and the original author's side is consistently called the original author, original repository and original app.
- The public document check (`scripts/check-doc-pairs.mjs`) now also checks the top format, titles, Korean/English section structure, links and anchors, terms and the README header.

## [Unreleased] — Support scope realignment and fork separation wrap-up (2026-11-24)

Applies the platform tiers of constitution v6.1.0 (focus macOS, maintained iOS, test builds Linux and Android, excluded Windows).

### Changed

- The support-scope source, public documents (Korean and English) and the About screen now use the new tiers. English documents also carry a support-scope block (`support-scope-en`), which is checked.
- The bug form is split into a core form (macOS, iOS) and a test build form (Linux, Android, `test-build` label).
- Releases: Linux and Android file names end in `-test`, and the release notes carry a "Test builds" section and omission notices. A failed test build no longer stops a release when macOS succeeds; three consecutive omissions of the same platform stop the next release. Added security exclusions (`.github/release-exclusions.json`).
- `SECURITY.md` now states the security scope of test builds.

### Removed

- The remaining Windows-only code, settings, icons and audit target, plus a reintroduction check (`scripts/check-windows-exclusion.mjs`) in the quality gate. The end-of-support history of the Windows pre-releases and the migration guide stay as preserved records.

## [Unreleased] — Independent fork separation (2026-11-17)

This fork split from the original `v0.1.6` (commit `44c4d37`, tag `upstream-base-v0.1.6`) and became independent on 2026-11-17. The GitHub fork network separation was completed on 2026-11-23. Later original releases (`v0.2.0`, `v0.2.1`, `v0.2.2`) were not merged.

<!-- support-scope-en:start -->
This fork focuses on **macOS**.
iOS is maintained with lower priority and is provided as a source build only, without a public distribution channel.
Linux and Android are distributed as **test builds** only, with no guarantee of quality, feature parity, real-device verification or response time.
**Windows is outside the scope of this fork. On Windows, use the original [EasyViewer](https://github.com/edith2580/EasyViewer).**
Running in a web browser is a development aid only.
Linux test builds are built for Ubuntu 22.04 or later and equivalent distributions (deb, AppImage, WebKitGTK 4.1, X11 and Wayland). Android test builds target Android 7.0 (API 24) or later.
<!-- support-scope-en:end -->

### Added

- `NOTICE` with attribution to the original author and the GPLv3 §5(a) modification notice
- `GPL-3.0-only` license declarations (`package.json`, `Cargo.toml`, installer metadata)
- Automated license audit of all direct and transitive dependencies (`scripts/check-licenses.mjs`, `cargo deny`) and full third-party notices (`src/generated/third-party-notices.txt`)
- About screen: version, license, repository, original source, support scope, third-party notices
- Support-scope source text (`src/config/supportScope.ts`) and a public wording check (`scripts/check-support-scope.mjs`)
- Issue forms (supported platform choices, guidance for Windows users, Korean/English labels, fork confirmation)
- One-time migration of existing macOS and Linux user data (library, settings, OS credentials; originals kept) and a guide for mobile users
- CI that builds only supported platforms (`ci.yml`, six jobs) and a release pipeline (`release.yml`, safety gates before building and before publishing, `SHA256SUMS.txt`)
- Security policy (`SECURITY.md`) with private vulnerability reporting, and a "differences from the original app" section in the README
- English counterparts (`*.en.md`) of the public root documents and a Korean/English pair check (`scripts/check-doc-pairs.mjs`)

### Changed

- The support scope now focuses on macOS. iOS, Linux and Android are maintained with lower priority, and Windows is not considered (Windows compile and test in CI stopped as well).
- The app identity now differs from the original app so that both can be installed on the same device.
  - App identifier: `com.edith.easyviewer` → `com.ezenitac.easyviewer` (all platforms)
  - Display name `Pagelight`, package name `pagelight` (Rust library `pagelight_lib`)
  - App icon replaced with an original created in this fork (`src-tauri/icons/source/pagelight.svg`)
  - The Android package path moved to `com/ezenitac/easyviewer`; release builds are signed only with the fork-owned signing key supplied through environment variables ([Android signing guide](docs/android-signing.md), Korean)
  - The Apple development team ID and personal device UDID were removed from the repository and moved to environment variables (`APPLE_DEVELOPMENT_TEAM`, `IOS_DEVICE_ID`) ([iOS build guide](docs/ios-build.md), Korean)
  - `npm run verify` now includes a check (`scripts/check-identity.mjs`) against leftover old identifiers or the original name, renamed internal storage keys, pinned team IDs or UDIDs, and reuse of the original icon
  - Internal storage keys (`EasyViewerDB`, `easyviewer:`, etc.) were kept so existing data continues to load

### Security

- Updated the `url` dependency to 2.5.9 to resolve RUSTSEC-2026-0592 (stack overflow when handling nested `blob:` URLs).
- Updated the `cookie` dependency to 0.18.3 to resolve RUSTSEC-2026-0594 (private cookie nonces repeating in forked processes). The app does not use that feature, but the affected version is gone.
- Pinned `@xmldom/xmldom`, used by the EPUB engine, to 0.9.12 to resolve XML injection and DoS advisories.

### Removed support

- Windows distribution and official support ended. If you used this fork's Windows pre-releases, see the [Windows migration guide](docs/windows-migration.md) (Korean).

## Fork pre-releases

### [0.1.6-beta] — 2026-11-16 (fork-only pre-release)

- 002 deep refactoring: document engines, storage and sync layers restructured; performance, accessibility and security gates converged. The internal data format was raised to version 2 (the original uses version 1).
- Pre-release bundle branching, Android `buildSrc` path alignment and updated third-party license notices.
- Published files: macOS (universal `.dmg`), Linux (`.deb`, `.AppImage`), Android (`.apk`), Windows (`x64-setup.exe`, `x64_portable.zip`). **Support for the Windows files ended on 2026-11-17.**

### [0.1.6-alpha] — 2026-11-16 (fork pre-release)

- 001 constitution-compliance refactoring: path validation, SSRF protection, CSP, separate credential storage (OS keychain), platform abstraction layer.
- These changes were contributed to the original project (PR #2) and merged there.
- The published files included a Windows `x64-setup.exe`. **Support ended on 2026-11-17.**

## Summary of the original history (edith2580/EasyViewer, before the split)

Summarized from the original repository's tag messages. See the [original releases](https://github.com/edith2580/EasyViewer/releases) for details.

- **0.1.6** (2026-11-16): Windows portable package (`portable.zip`) and multi-platform release setup. **This fork's base (`44c4d37`, tag `upstream-base-v0.1.6`).**
- **0.1.5** (2026-11-15): `package-lock.json` version cleanup, build output cleanup beyond the macOS `.dmg`.
- **0.1.4** (2026-11-13): Windows and Android release build outputs and version sync.
- **0.1.3** (2026-11-11): Windows and Android release build outputs and version sync.
- **0.1.2** (2026-11-08): TXT table-of-contents navigation and current-entry scrolling fixes.
- **0.1.1** (2026-11-08): Fixed jumping while scrolling TXT.
- **0.1.0** (2026-11-07): First release, macOS package.

After the split, the original project released 0.2.0 (2026-11-17, Windows network folder fix), 0.2.1 (2026-11-17, Android WebDAV connection fix) and 0.2.2 (2026-11-18, macOS signing and notarization). This fork did not merge them.
