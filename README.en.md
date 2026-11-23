# Pagelight

**언어 / Language**: [한국어](README.md) | **[English](README.en.md)**

> This is an independent fork. It supports macOS, iOS (source build only) and Linux; Android is maintained. For Windows, please use the original EasyViewer by edith2580.

A simple viewer for plain text (TXT) and EPUB documents (`v1.0.0-alpha.1`), an independent fork of the original [EasyViewer](https://github.com/edith2580/EasyViewer) `v0.1.6` by edith2580.

[![CI](https://github.com/Ezenitac-AiService/EasyViewer/actions/workflows/ci.yml/badge.svg)](https://github.com/Ezenitac-AiService/EasyViewer/actions/workflows/ci.yml)
[![Release](https://github.com/Ezenitac-AiService/EasyViewer/actions/workflows/release.yml/badge.svg)](https://github.com/Ezenitac-AiService/EasyViewer/actions/workflows/release.yml)
[![GitHub Release](https://img.shields.io/github/v/release/Ezenitac-AiService/EasyViewer?include_prereleases&sort=semver&label=release&logo=github)](https://github.com/Ezenitac-AiService/EasyViewer/releases)
[![License: GPL-3.0-only](https://img.shields.io/badge/license-GPL--3.0--only-blue.svg)](./LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20iOS%20%7C%20Linux%20%7C%20Android-lightgrey.svg)](#supported-platforms)
[![Upstream Origin](https://img.shields.io/badge/upstream%20origin-edith2580%2FEasyViewer%20(v0.1.6)-informational?logo=github)](https://github.com/edith2580/EasyViewer)

> [!NOTE]
> **About this fork and where to file issues**
>
> - This repository ([Ezenitac-AiService/EasyViewer](https://github.com/Ezenitac-AiService/EasyViewer)) split from the original [EasyViewer](https://github.com/edith2580/EasyViewer) `v0.1.6` and is maintained independently under the name Pagelight. It keeps the original author's copyright and the `GPL-3.0-only` license.
> - **Please file Pagelight bugs and requests in this repository's [Issues](https://github.com/Ezenitac-AiService/EasyViewer/issues),** not in the original author's repository.
> - Report security vulnerabilities through the private channel in [SECURITY.en.md](./SECURITY.en.md), not in public issues.

> **License**: [GNU General Public License v3.0 only (`GPL-3.0-only`)](./LICENSE). Attribution and modification notices are in [NOTICE.en.md](./NOTICE.en.md); third-party notices are in [THIRD_PARTY_LICENSES.en.md](./THIRD_PARTY_LICENSES.en.md).

The Korean [README.md](README.md) is the authoritative version. This page is kept in sync with it.

---

## Supported platforms

- **Focus**: macOS, iOS (source build only, no public distribution channel), Linux.
- **Maintained**: Android, with lower priority.
- **Not supported**: Windows. This fork does not distribute or support Windows builds. On Windows, use the original [EasyViewer](https://github.com/edith2580/EasyViewer).
- Running in a web browser is a development aid only.
- Linux is verified on Ubuntu 22.04 or later and equivalent distributions (deb, AppImage, WebKitGTK 4.1, X11 and Wayland). Other distributions may work but are not verified.

## Features

### Viewer options and themes

- **View modes**: switch between vertical scrolling (`scroll`) and horizontal pages (`paginated`) at any time while keeping your reading position.
- **Typography**: font (system and local font stacks, no external CDN), font size, line spacing and margins.
- **Color themes**: default (light), dark and sepia.

### Library, sync and security

- **EPUB / TXT reading and search**: table of contents and chapter navigation (EPUB), automatic encoding detection and chunked loading for large files (TXT), bookmarks and reading progress.
- **Network download and WebDAV sync**: download remote files, a local sync hub and remote WebDAV endpoints.
  - The WebDAV `v1 → v2` migration removed plain-text passwords. Native apps (desktop and mobile) keep credentials in the OS keychain (`tauri-plugin-keyring-store`); the web build keeps them in session memory by default and stores them locally only with explicit consent.
- **Zero-trust security boundaries**:
  - **CSP and EPUB isolation**: an app-wide `Content-Security-Policy`, an EPUB zip-bomb bound check before parsing (`validateEpubArchiveBounds`) and layered HTML/SVG/CSS sanitization (`sanitizeSectionDocument`).
  - **SSRF, DNS pinning and TLS checks**: the development and preview proxy (`/__remote_proxy`) fails closed on `Origin`/`Sec-Fetch-Site`, uses a session nonce and a total timeout; the native Rust `safe_remote_fetch` (`reqwest 0.13` with `rustls`, `url::Host` IPv4/IPv6 classification, a deadline over the whole request) is the single trust boundary.
  - **Least-privilege capabilities and path allow-lists**: a separate desktop-only `desktop.json`, a scoped `tauri-plugin-opener`, ancestor normalization in `allow_storage_dir`, and `read_validated_book_file` (`#[cfg(desktop)]`, case-insensitive blocking of sensitive OS paths).

---

## Development and architecture

- **Framework**: Vue `^3.5.13` (`<script setup lang="ts">`), TypeScript `~5.6.3` (`strict: true`), Vite `^6.0.5`
- **State, routing, UI**: Pinia `^2.3.0`, Vue Router `^4.5.0`, Tailwind CSS `^3.4.17`, Lucide Vue Next `^0.468.0`
- **Document engines**: `epubjs ^0.3.93`, `jszip ^3.10.1`, `css-tree ^3.2.1`, and a custom TXT engine (`txtEngine.ts`, `txtMeasuredPagination.ts`)
- **Native backend**: Tauri `2` (`@tauri-apps/api ^2.12.4`, `plugin-dialog`, `plugin-fs`, `plugin-store`, `plugin-opener`, `tauri-plugin-keyring-store`), Rust `reqwest 0.13` (`rustls`, `stream`), `dunce`, `sha2`, `zip 9.x`
- **Platforms**: see [Supported platforms](#supported-platforms).

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

---

## Running and quality gates

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

### Tests and verification scripts

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

---

## Versioning and cross-platform builds

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

### Installing on macOS (release files)

Download the `.dmg` and `SHA256SUMS.txt` from the releases page into the same folder and check the checksum first.

```bash
shasum -a 256 -c SHA256SUMS.txt --ignore-missing
```

The app is not notarized by Apple yet. If the first launch says the app "is damaged and can't be opened", confirm that the checksum matches and then remove the quarantine attribute.

```bash
xattr -cr /Applications/Pagelight.app
```

> **Warning**: removing the quarantine attribute is a **temporary measure** until the app is notarized. macOS will run the app without checking it, so only do this for a file you downloaded from this repository's releases page and whose checksum matches.

### Windows users

This fork does not distribute or officially support Windows installers. On Windows, use the original [EasyViewer](https://github.com/edith2580/EasyViewer). If you used this fork's Windows pre-releases (`v0.1.6-alpha`, `v0.1.6-beta`), follow the [Windows migration guide](./docs/windows-migration.md) (Korean).

The Windows code paths are still compiled and tested in CI so that no unverified security code is left behind.

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

### GitHub Actions CI and releases

- [`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs six jobs on every pull request and every push to `main`: `verify` (full verification gate), `licenses` (cargo-deny and notice consistency), `windows-compile-test` (compile and test the undistributed Windows code), `macos-build` (universal build and signature check), `ios-sim-build` (unsigned simulator build) and `android-debug` (debug APK). It uses no secrets, and `main` only accepts merges that pass all six jobs.
- [`.github/workflows/release.yml`](.github/workflows/release.yml) runs on a `v*` tag push or `workflow_dispatch`. A release gate (`scripts/check-release-gate.mjs`) must pass before any build, and it builds only the **macOS universal `.dmg`**, **Linux x64 `.deb` and `.AppImage`** (plus `.rpm` for stable versions) and the **Android arm64 `.apk`** signed with the fork key. Before publishing it writes `SHA256SUMS.txt` and checks again that no Windows files are present.

#### Release procedure

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

---

## Differences from the original app

<!-- upstream-diff:start -->
Only verifiable facts are listed. Values for the original app ([EasyViewer](https://github.com/edith2580/EasyViewer)) are based on `v0.1.6`, where this fork split off, and the latest release `v0.2.2` checked on 2026-11-19.

| Item | Pagelight (this fork) | EasyViewer (original) |
|---|---|---|
| Display name | Pagelight | EasyViewer |
| App identifier | `com.ezenitac.easyviewer` | `com.edith.easyviewer` |
| Distributed platforms | macOS, Linux, Android (iOS as source build only) | Windows, macOS, Linux, Android as of `v0.2.2` |
| Windows | Not distributed or supported | Distributed by the original author |
| Internal data format version | 2 | 1 |

- Because the identifiers differ, both apps can be installed on the same device and do not share data.
- The original app cannot open data created by this fork (data format 2). To move to Windows, see the [Windows migration guide](./docs/windows-migration.md) (Korean).
- These values may change in later versions of the original app.
<!-- upstream-diff:end -->

## Attribution and license

- **Original work**: this repository is a derivative work based on the original [EasyViewer](https://github.com/edith2580/EasyViewer) by edith2580. Copyright (C) 2026 edith2580.
- **Changes in this fork**: Copyright (C) 2026 M5. This fork split from the original `v0.1.6` (commit `44c4d37`, tag `upstream-base-v0.1.6`) and became independent on 2026-11-17; the GitHub fork network separation was completed on 2026-11-23. Later original releases (`v0.2.0`, `v0.2.1`, `v0.2.2`) were not merged. A summary of the main changes is in section 3 of [NOTICE.en.md](./NOTICE.en.md) and in [CHANGELOG.en.md](./CHANGELOG.en.md).
- **License**: [GNU General Public License v3.0 only (`GPL-3.0-only`)](./LICENSE). The license text is unchanged. "Only" is this fork's choice; the reasons and the conditions for revisiting it are in section 5 of [NOTICE.en.md](./NOTICE.en.md).
- **Third-party components**: a summary of direct dependencies is in [`THIRD_PARTY_LICENSES.en.md`](./THIRD_PARTY_LICENSES.en.md); the full notices and license texts, including transitive dependencies, are in [`src/generated/third-party-notices.txt`](./src/generated/third-party-notices.txt) (also viewable from the app's About screen).
