# Contributing guide

**언어 / Language**: [한국어](CONTRIBUTING.md) | **[English](CONTRIBUTING.en.md)**

This repository is an **independent fork** of the original [EasyViewer](https://github.com/edith2580/EasyViewer) by edith2580. Please read the principles below before contributing. The Korean [CONTRIBUTING.md](CONTRIBUTING.md) is the authoritative version.

## Support scope

<!-- support-scope-en:start -->
This fork focuses on **macOS**.
iOS is maintained with lower priority and is provided as a source build only, without a public distribution channel.
Linux and Android are distributed as **test builds** only, with no guarantee of quality, feature parity, real-device verification or response time.
**Windows is outside the scope of this fork. On Windows, use the original [EasyViewer](https://github.com/edith2580/EasyViewer).**
Running in a web browser is a development aid only.
Linux test builds are built for Ubuntu 22.04 or later and equivalent distributions (deb, AppImage, WebKitGTK 4.1, X11 and Wayland). Android test builds target Android 7.0 (API 24) or later.
<!-- support-scope-en:end -->

The source of the support-scope wording is `src/config/supportScope.ts`. To change it, edit the source, update every document that contains the support-scope block (Korean) or the support-scope-en block (English), and run `node scripts/check-support-scope.mjs`.

## Windows issues

- Windows is outside the scope of this fork, so changes that add Windows-only code, settings or files are not accepted (`node scripts/check-windows-exclusion.mjs` checks this).
- Questions about the Windows pre-releases this fork published (`v0.1.6-alpha`, `v0.1.6-beta`) are pointed to the preserved [Windows migration guide](docs/windows-migration.md) (Korean) and closed. Do not file them in the original author's repository.

## Relationship with the original repository

- This fork does **not merge, cherry-pick or sync** the upstream (`edith2580/EasyViewer`). The repository is no longer part of the upstream fork network.
- If an idea from the original app is needed, re-implement it here through a separate spec (`/speckit-specify`).
- **The only exception** is security coordination. If a defect found here also affects the original author's latest release, we tell the original author privately or propose a fix before disclosure. That is a contribution, not a sync.
- Rewriting shared history (force pushes) and removing copyright or attribution notices are forbidden. Refactoring or removing code that came from the original author in the normal course of work is fine.

### If upstream changes were merged by mistake

1. Check whether an upstream remote is still configured.
   ```bash
   git remote -v
   ```
2. Remove it if it is.
   ```bash
   git remote remove upstream
   ```
3. If a commit merging upstream changes was already pushed, do not force-push; create a revert commit.
   ```bash
   git revert -m 1 <merge commit>
   ```
4. Make sure no workflow or script contains a sync path.
   ```bash
   node scripts/check-release-gate.mjs --static
   ```

## Operating principles

This fork follows the [project constitution](.specify/memory/constitution.md) (v6.1.0, Korean). In particular, under principle VIII (independent fork governance):

- Public wording describes only this fork's scope. It does not define the original project's role or intent and does not belittle the original app. `node scripts/check-support-scope.mjs` checks for forbidden phrases.
- The license is `GPL-3.0-only`. The license text (`LICENSE`) is not changed, and the attribution and modification notices (`NOTICE`) are kept.
- New source files created in this fork start with `SPDX-License-Identifier: GPL-3.0-only`.
- The public root documents (`README`, `CONTRIBUTING`, `SECURITY`, `CHANGELOG`, `NOTICE`, `THIRD_PARTY_LICENSES`) keep a Korean default and an English counterpart (`*.en.md`) (principle I). A change to one side updates the other side in the same change. If the two disagree, the Korean document wins. `node scripts/check-doc-pairs.mjs` checks the pairs and the language links.

## Expectations by support tier

| Tier | Platforms | Expectation |
|---|---|---|
| Focus | macOS | The only core build. Check macOS behavior for every change; the core CI including `macos-build` must pass |
| Maintained (lower priority) | iOS | Source build only. Try not to break the build or existing behavior. CI results only report and do not block merges, but failures are looked into and fixed |
| Test build | Linux, Android | Distributed as test builds only, with no guarantee of quality, feature parity, real-device verification or response time. Keep the build working; CI results only report. Bug reports go to the test build bug form |
| Excluded | Windows | Outside the scope of this fork. Windows-only code, settings and features are not accepted |
| Development aid | Web | Kept only as a fallback for development and testing |

## Spec process

New features and large changes follow the Spec Kit flow: `/speckit-specify` → `/speckit-clarify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-analyze` → `/speckit-implement`. Artifacts live in `specs/<number>-<name>/` (Korean). The spec (`spec.md`) does not contain implementation details.

## Development environment and layout

### Tech stack

- **Framework**: Vue `^3.5.13` (`<script setup lang="ts">`), TypeScript `~5.6.3` (`strict: true`), Vite `^6.0.5`
- **State, routing, UI**: Pinia `^2.3.0`, Vue Router `^4.5.0`, Tailwind CSS `^3.4.17`, Lucide Vue Next `^0.468.0`
- **Document engines**: `epubjs ^0.3.93`, `jszip ^3.10.1`, `css-tree ^3.2.1`, and a custom TXT engine (`txtEngine.ts`, `txtMeasuredPagination.ts`)
- **Native backend**: Tauri `2` (`@tauri-apps/api ^2.12.4`, `plugin-dialog`, `plugin-fs`, `plugin-store`, `plugin-opener`, `tauri-plugin-keyring-store`), Rust `reqwest 0.13` (`rustls`, `stream`), `dunce`, `sha2`, `zip 9.x`
- **Platforms**: focus macOS (the only core build), maintained iOS (source build only), test builds Linux and Android (distributed as test builds only, no guarantees), Web (development aid, `IndexedDB` / proxy). Windows is outside the scope of this fork (see [Supported platforms and releases](./README.en.md#supported-platforms-and-releases)).

### Directory layout

```text
./
├── src/
│   ├── assets/                 # Global styles and local font stack (main.css)
│   ├── components/
│   │   ├── common/             # Accessible confirm and recovery dialogs (InAppConfirmModal)
│   │   ├── library/            # Remote download (RemoteUrlDownloadTab, WebDav*), sync and folder menus
│   │   └── viewer/             # Viewer settings panel, TOC, bookmark and search drawers
│   ├── composables/            # UI, reading session, TXT virtual and page control, import, cover URLs
│   ├── engines/                # Pure document engines (DocumentReaderPort; no upper-layer dependency)
│   │   ├── epub/               # epub.js adapter, css-tree AST sanitizer, non-blocking location index, touch and tap
│   │   └── txt/                # Encoding detection, chunking and search, line-box and measured pagination
│   ├── services/
│   │   ├── platform/           # Platform ports (dialog, dragDrop, path, credential)
│   │   ├── storage/            # IndexedDB v2 (cover blobs and index cache), SHA-256 hashing, native IPC
│   │   ├── network/            # SSRF validator, safe fetch and streaming download, WebDAV client
│   │   ├── sync/               # Cross-device reading position and bookmark merge and sync
│   │   └── sampleBooks.ts      # Bundled sample books
│   ├── stores/                 # Pinia stores (useBookStore, useSettingsStore) with migration and sync helpers
│   ├── types/                  # Shared TypeScript interfaces and types
│   └── views/                  # Slim router views (LibraryView, ReaderView, lazy /reader/:id)
├── src-tauri/
│   ├── capabilities/           # Least-privilege split (default.json, desktop.json)
│   └── src/                    # Rust security, SSRF and path guards (security/), file, streaming and EPUB commands (commands/)
├── scripts/                    # 450-line and layer boundaries, version sync, app identity, proxy guard, verify
├── tests/                      # Tier 1 Vitest unit and contract tests, tier 2 Playwright E2E and performance baselines
└── specs/                      # Spec Kit feature specs, plans, security contracts and checklists
```


## Verification commands

Before submitting a change, these must pass:

```bash
npm run verify
```

```bash
cd src-tauri && cargo deny check
```

`npm run verify` runs the build, unit tests, layer and size boundaries (450 lines or fewer per file), version and identifier sync, the license policy audit, the support-scope wording check, the Korean/English document pair check, `cargo check`, `cargo clippy` (any warning fails) and `cargo test`. Code without tests is not accepted (constitution principle II, TDD).

Individual checks and tests can also be run on their own.

```bash
# Tier 1 unit and platform-boundary tests (Vitest with mockIPC, under 30 seconds)
npm test

# Static architecture boundaries (no direct Tauri, web storage or fetch in views/stores/components/engines/sync)
npm run check:boundaries

# Version agreement across package.json, Cargo.toml, tauri.conf.json and the lock files
npm run check:version

# Commit message rules (Conventional Commits with a Korean summary and body)
npm run check:commit-msg -- <COMMIT_EDITMSG_PATH>

# Full verification gate (build, test, boundaries, version, licenses, support scope, identity,
# Korean/English document pairs, workflow rules, cargo check and cargo test)
# Without Rust it exits with code 2 (BLOCKED); use --frontend-only to check the frontend only
npm run verify

# Tier 2 browser rendering, CSP/proxy security and E2E tests (Playwright Chromium and WebKit)
npm run test:e2e

# Tier 2 runtime performance regression gate (median against a fixed 50-book seed baseline)
npm run test:perf
```

### When the license audit fails

If adding or updating a dependency breaks the audit, handle it in this order. Do not bypass or disable the audit.

1. Confirm with evidence (official license lists, the FSF compatibility list, etc.) whether the new license is compatible with GPLv3.
2. If it is, leave the evidence in a comment and add it to the allow lists in `scripts/license-policy.json` and `src-tauri/deny.toml` (and `src-tauri/about.toml` for Rust).
3. If it is not, replace the dependency.
4. Regenerate the full notices.
   ```bash
   node scripts/check-licenses.mjs --write
   ```

## Versions and builds

### Files kept at the same version

After changing the version, update these files and run `npm run check:version`.

- `./package.json`
- `./package-lock.json`
- `./src-tauri/Cargo.toml` (and `./src-tauri/Cargo.lock` through `cargo check`)
- `./src-tauri/tauri.conf.json`

### Rust toolchain

- Recommended: `rustc >= 1.90.0` (meets the MSRV of the current Tauri v2 plugins and `reqwest 0.13` with `rustls`)

```bash
node -v && npm -v
rustc --version && cargo --version
rustup show
```

### Development

```bash
# Install dependencies
npm install

# Web dev server (http://localhost:1420)
npm run dev

# Type check and production bundle
npm run build

# Tauri desktop app (requires the Rust toolchain)
npm run tauri dev
```

### Linux build

```bash
# Ubuntu/Debian prerequisites: libwebkit2gtk-4.1-dev, libappindicator3-dev, librsvg2-dev, patchelf, rpm
# Stable versions build deb, rpm and AppImage; pre-release versions with a hyphen build deb and AppImage only
APPIMAGE_EXTRACT_AND_RUN=1 npm run tauri build -- --bundles deb,rpm,appimage
```

### macOS and iOS builds

```bash
# macOS development
npm run mac:dev

# macOS universal build (Apple Silicon and Intel)
npm run mac:build

# Per-architecture macOS builds (set CI=true on headless machines to avoid Spotlight disk locks)
npm run mac:build:arm
npm run mac:build:intel

# iOS (Xcode) project init, development and build
npm run ios:init
npm run ios:dev
npm run ios:build

# Open in Xcode (debugging, App Store archive)
npx tauri ios dev --open
npx tauri ios build --open
```

- **Distribution and macOS signing (`1.0.0-alpha.1`)**: the default desktop build is non-sandboxed (`.dmg`, Hardened Runtime). `src-tauri/tauri.conf.json` sets `bundle.macOS.signingIdentity: "-"` (ad-hoc signature with the Hardened Runtime seal), so `codesign --verify --deep --strict` passes. The app identifier is `com.ezenitac.easyviewer` on every platform. Before notarization, a `.dmg` downloaded with a browser needs `xattr -cr /Applications/Pagelight.app` before the first launch. A Mac App Store (App Sandbox) build needs `tauri-plugin-persisted-scope` and the `com.apple.security.files.user-selected.read-write` entitlement; public distribution needs Apple Developer code signing and notarization (`APPLE_DEVELOPMENT_TEAM`, `APPLE_SIGNING_IDENTITY`). The iOS source build is described in [docs/ios-build.md](./docs/ios-build.md) (Korean).
- **Clearing ports and locks on macOS (if needed)**:

```bash
kill -9 $(lsof -t -i :1420 -i :1421) 2>/dev/null
find src-tauri/target -name "lock.ios" -o -name ".cargo*-lock" -delete 2>/dev/null
```

### Android build

```bash
npm run android:init
npm run android:dev
npm run android:build       # arm64 debug APK
npm run android:release     # arm64 release APK
npm run android:release:all # release APKs for all ABIs
```

## CI and releases

- [`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs five jobs on every pull request and every push to `main`: `verify` (full verification gate), `licenses` (cargo-deny and notice consistency), `macos-build` (universal build and signature check), `ios-sim-build` (unsigned simulator build) and `android-debug` (debug APK). It uses no secrets, and merges to `main` and the release gate require only the core jobs `verify`, `licenses` and `macos-build` (repository admins can bypass this in an emergency). The lower-priority platform jobs (`ios-sim-build`, `android-debug`) only report; a failure is still looked into and fixed.
- [`.github/workflows/release.yml`](.github/workflows/release.yml) runs on a `v*` tag push or `workflow_dispatch`. A release gate (`scripts/check-release-gate.mjs`) must pass before any build, and it builds only the **macOS universal `.dmg`** (the core build) and the test builds **Linux x64 `.deb` and `.AppImage`** (plus `.rpm` for stable versions) and the **Android arm64 `.apk`** signed with the fork key. Linux and Android file names end in `-test`, and the release notes get a "Test builds" section. When a test build fails, the signing-key secrets are missing or a platform is under a security exclusion (`.github/release-exclusions.json`), only that platform is left out and the notes say so (a debug-signed APK is never published). If the macOS build fails nothing is published, and when the same test build platform is left out three releases in a row the next release gate stops. Before publishing it writes `SHA256SUMS.txt` and checks the markers, omission notices and that no Windows files are present again.

### Release procedure

1. Align and verify the version (`package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `src-tauri/tauri.conf.json`, the Apple project settings and the Android `versionCode`).
   ```bash
   npm run check:version
   npm run verify
   ```
2. Rehearse the whole flow first. A rehearsal uses a tag name ending in `-rehearsal` and only creates a draft release.
   ```bash
   gh workflow run release.yml -f rehearsal=true -f tag_name=v1.0.0-alpha.1-rehearsal
   ```
3. Push the tag to publish the release.
   ```bash
   git tag v1.0.0-alpha.1
   git push origin v1.0.0-alpha.1
   ```

Operational details are in the [maintainer runbook](./docs/maintainer-runbook.md) and the [Android signing key guide](./docs/android-signing.md) (both Korean).


## Commit rules

Commit messages are written **in Korean** with a Conventional Commits prefix (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `ci:`, `chore:`, etc.) and a summary title. The body states ① why, ② what changed, and ③ scope and verification results. `npm run check:commit-msg` checks the format. If you cannot write Korean, open the pull request anyway; a maintainer will help with the message.
