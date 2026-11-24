# Pagelight

**언어 / Language**: [한국어](README.md) | **[English](README.en.md)**

[![CI](https://github.com/Ezenitac-AiService/EasyViewer/actions/workflows/ci.yml/badge.svg)](https://github.com/Ezenitac-AiService/EasyViewer/actions/workflows/ci.yml)
[![Release build](https://github.com/Ezenitac-AiService/EasyViewer/actions/workflows/release.yml/badge.svg)](https://github.com/Ezenitac-AiService/EasyViewer/actions/workflows/release.yml)
[![GitHub Release](https://img.shields.io/github/v/release/Ezenitac-AiService/EasyViewer?include_prereleases&sort=semver&label=release&logo=github)](https://github.com/Ezenitac-AiService/EasyViewer/releases)
[![License: GPL-3.0-only](https://img.shields.io/badge/license-GPL--3.0--only-blue.svg)](./LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS%20(focus)%20%7C%20iOS%20(source%20build)%20%7C%20Linux%20%C2%B7%20Android%20(test%20build)-lightgrey.svg)](#supported-platforms-and-releases)
[![Forked from](https://img.shields.io/badge/forked%20from-edith2580%2FEasyViewer%20(v0.1.6)-informational?logo=github)](https://github.com/edith2580/EasyViewer)

> This is an independent fork. It focuses on macOS; iOS is a source build only, and Linux and Android are test builds. For Windows, please use the original EasyViewer by edith2580.

Pagelight is a simple viewer for plain text (TXT) and EPUB documents (`v1.0.0-alpha.1`). It is an independent fork of the original [EasyViewer](https://github.com/edith2580/EasyViewer) `v0.1.6` by edith2580, and the app files and checksums are on the [Releases](https://github.com/Ezenitac-AiService/EasyViewer/releases) page. The Korean [README.md](README.md) is the authoritative version; this page is kept in sync with it.

> [!IMPORTANT]
> **First launch**: the app is not notarized by Apple yet, so the first launch on macOS may say it "is damaged and can't be opened". Check the checksum, then follow the macOS steps in [Installation and first launch](#installation-and-first-launch).

> [!NOTE]
> **About this fork and where to file issues**
>
> - This repository ([Ezenitac-AiService/EasyViewer](https://github.com/Ezenitac-AiService/EasyViewer)) split from the original [EasyViewer](https://github.com/edith2580/EasyViewer) `v0.1.6` and is maintained independently under the name Pagelight. It keeps the original author's copyright and the `GPL-3.0-only` license.
> - **Please file Pagelight bugs and requests in this repository's [Issues](https://github.com/Ezenitac-AiService/EasyViewer/issues),** not in the original author's repository.
> - Report security vulnerabilities through the private channel in [SECURITY.en.md](./SECURITY.en.md), not in public issues.

---

## Differences from the original app

<!-- upstream-diff:start -->
Only verifiable facts are listed. Values for the original app ([EasyViewer](https://github.com/edith2580/EasyViewer)) are based on `v0.1.6`, where this fork split off, and the latest release `v0.2.2` checked on 2026-11-19.

| Item | Pagelight (this fork) | EasyViewer (original) |
|---|---|---|
| Display name | Pagelight | EasyViewer |
| App identifier | `com.ezenitac.easyviewer` | `com.edith.easyviewer` |
| Distributed platforms | macOS, Linux and Android (test builds), iOS as source build only | Windows, macOS, Linux, Android as of `v0.2.2` |
| Windows | Not distributed or supported | Distributed by the original author |
| Internal data format version | 2 | 1 |

- Because the identifiers differ, both apps can be installed on the same device and do not share data.
- The original app cannot open data created by this fork (data format 2). To move to Windows, see the [Windows migration guide](./docs/windows-migration.md) (Korean).
- These values may change in later versions of the original app.
<!-- upstream-diff:end -->

## Supported platforms and releases

<!-- support-scope-en:start -->
This fork focuses on **macOS**.
iOS is maintained with lower priority and is provided as a source build only, without a public distribution channel.
Linux and Android are distributed as **test builds** only, with no guarantee of quality, feature parity, real-device verification or response time.
**Windows is outside the scope of this fork. On Windows, use the original [EasyViewer](https://github.com/edith2580/EasyViewer).**
Running in a web browser is a development aid only.
Linux test builds are built for Ubuntu 22.04 or later and equivalent distributions (deb, AppImage, WebKitGTK 4.1, X11 and Wayland). Android test builds target Android 7.0 (API 24) or later.
<!-- support-scope-en:end -->

| Platform | Tier | Minimum | Release files | Status |
|---|---|---|---|---|
| **macOS** | Focus | 11.0 Big Sur | `Pagelight_<version>_universal.dmg` (Apple Silicon and Intel) | Core build |
| **iOS** | Maintained | 15.0 | None | Source build only ([iOS source build guide](./docs/ios-build.md), Korean) |
| **Linux** | Test build | Ubuntu 22.04 or later (WebKitGTK 4.1) | `Pagelight_<version>_amd64-test.deb`, `Pagelight_<version>_amd64-test.AppImage` (plus `.rpm` for stable versions) | Test build, no guarantees |
| **Android** | Test build | 7.0 (API 24) | `Pagelight_<version>_android-arm64-test.apk` | Test build, from the release where the fork signing key is ready |
| **Windows** | Excluded | – | None | Outside the scope of this fork |

App files and the checksum list (`SHA256SUMS.txt`) are on the [Releases](https://github.com/Ezenitac-AiService/EasyViewer/releases) page. Linux and Android files whose names end in `-test` are test builds with no guarantee of quality or response time. Check downloaded files against the checksums.

```bash
shasum -a 256 -c SHA256SUMS.txt --ignore-missing   # macOS
sha256sum -c SHA256SUMS.txt --ignore-missing        # Linux
```

### Minimum requirements

The app runs in each OS's built-in WebView, so the minimum versions come from what the framework (Tauri 2) and build tool (Vite 6) require and the WebView features the app uses.

| Platform | Minimum | Basis |
|---|---|---|
| macOS | 11.0 Big Sur | Tauri 2 defaults to 10.13, but the Vite 6 output uses Safari 14 syntax and the accessible dialogs' `inert` works from Safari 15.5. Big Sur can update to Safari 16.6 |
| iOS | 15.0 | Tauri 2 default. The iOS WebView follows the OS version and runs the Vite 6 output (Safari 14 syntax) |
| Android (test build) | 7.0 (API 24) | Tauri 2 default. Needs an updatable Android System WebView (Chrome 87 or later) |
| Linux (test build) | Ubuntu 22.04 or later (WebKitGTK 4.1) | Build-environment baseline for test builds (not a verification guarantee). 22.04 receives WebKitGTK 2.50 through security updates |

`AbortSignal.any` (which needs Safari/iOS 17.4 or later), used to cancel opening an EPUB, was replaced with an equivalent fallback so EPUBs open on the minimum versions above.

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

## Controls

Controls on the reading screen. Use `Cmd` on macOS and `Ctrl` elsewhere.

| Action | Input |
|---|---|
| Next / previous page (paginated mode) | `→` / `←`, `PageDown` / `PageUp`, `Space` (next) |
| Next / previous screen (scroll mode) | `↓` / `↑`, `PageDown` / `PageUp`, `Space` (next) |
| Search | `Ctrl`/`Cmd`+`F` |
| Add or remove a bookmark at the current position | `Ctrl`/`Cmd`+`B` |
| Close the contents/search drawer or settings | `Esc` |
| Click or tap the page (paginated mode) | Bottom third or middle right: next page, middle left: previous page, elsewhere: show or hide the menu |
| Click or tap the page (scroll mode) | Show or hide the menu |
| Dialogs | `Esc` closes, `Tab` moves focus |

## Installation and first launch

### macOS

Download the `.dmg` and `SHA256SUMS.txt` from the releases page into the same folder and check the checksum first.

```bash
shasum -a 256 -c SHA256SUMS.txt --ignore-missing
```

The app is not notarized by Apple yet. If the first launch says the app "is damaged and can't be opened", confirm that the checksum matches and then remove the quarantine attribute.

```bash
xattr -cr /Applications/Pagelight.app
```

> **Warning**: removing the quarantine attribute is a **temporary measure** until the app is notarized. macOS will run the app without checking it, so only do this for a file you downloaded from this repository's releases page and whose checksum matches.

### Linux and Android test builds

The Linux (`.deb`, `.AppImage`) and Android (`.apk`) files are test builds, with no guarantee of quality, feature parity, real-device verification or response time. Please report problems with the [test build bug form](https://github.com/Ezenitac-AiService/EasyViewer/issues/new?template=bug_report_test_build.yml). Android APKs are signed only with the key this fork owns and are left out of releases where the key is not ready.

### iOS

iOS is provided as a source build only, without a public distribution channel. Follow the [iOS source build guide](./docs/ios-build.md) (Korean).

### Windows users

Windows is outside the scope of this fork, so on Windows use the original [EasyViewer](https://github.com/edith2580/EasyViewer). If you used this fork's Windows pre-releases (`v0.1.6-alpha`, `v0.1.6-beta`), follow the preserved [Windows migration guide](./docs/windows-migration.md) (Korean).

## Building from source

You need Node.js, npm and the Rust toolchain (`rustc >= 1.90.0`), plus Xcode (macOS and iOS), the Android SDK and NDK (Android) or the WebKitGTK development packages (Linux) for each platform.

```bash
# Install dependencies
npm install

# Web dev server (http://localhost:1420)
npm run dev

# Tauri desktop app (requires the Rust toolchain)
npm run tauri dev

# macOS universal build (Apple Silicon and Intel)
npm run mac:build
```

Linux, iOS and Android build commands and version sync are in [Versions and builds](./CONTRIBUTING.en.md#versions-and-builds) in the contributing guide.

## Development, contributing and security

- [Contributing guide](./CONTRIBUTING.en.md): independent fork principles, [development environment and layout](./CONTRIBUTING.en.md#development-environment-and-layout) (tech stack, directory layout), [verification commands](./CONTRIBUTING.en.md#verification-commands) (`npm run verify` and more), [versions and builds](./CONTRIBUTING.en.md#versions-and-builds) and the [CI and release](./CONTRIBUTING.en.md#ci-and-releases) procedure.
- [Security policy](./SECURITY.en.md): the private vulnerability reporting channel and the security scope of test builds.
- Bug reports: the bug form (macOS, iOS) and the test build bug form (Linux, Android) in [Issues](https://github.com/Ezenitac-AiService/EasyViewer/issues).
- Operations: the [maintainer runbook](./docs/maintainer-runbook.md) and the [Android signing key guide](./docs/android-signing.md) (both Korean).

## License and copyright notices

- **Original work**: this repository is a derivative work based on the original [EasyViewer](https://github.com/edith2580/EasyViewer) by edith2580. Copyright (C) 2026 edith2580.
- **Changes in this fork**: Copyright (C) 2026 M5. This fork split from the original `v0.1.6` (commit `44c4d37`, tag `upstream-base-v0.1.6`) and became independent on 2026-11-17; the GitHub fork network separation was completed on 2026-11-23. Later original releases (`v0.2.0`, `v0.2.1`, `v0.2.2`) were not merged. A summary of the main changes is in section 3 of [NOTICE.en.md](./NOTICE.en.md) and in [CHANGELOG.en.md](./CHANGELOG.en.md).
- **License**: [GNU General Public License v3.0 only (`GPL-3.0-only`)](./LICENSE). The license text is unchanged. "Only" is this fork's choice; the reasons and the conditions for revisiting it are in section 5 of [NOTICE.en.md](./NOTICE.en.md).
- **Third-party components**: a summary of direct dependencies is in [`THIRD_PARTY_LICENSES.en.md`](./THIRD_PARTY_LICENSES.en.md); the full notices and license texts, including transitive dependencies, are in [`src/generated/third-party-notices.txt`](./src/generated/third-party-notices.txt) (also viewable from the app's About screen).
