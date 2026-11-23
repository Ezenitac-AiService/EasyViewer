# Pagelight (independent fork of EasyViewer) — Copyright and modification notice

**언어 / Language**: [한국어](NOTICE) | **[English](NOTICE.en.md)**

> This is a reference translation of [NOTICE](NOTICE). If the two differ, the Korean `NOTICE` prevails.

This program is distributed under the GNU General Public License version 3 (GPL-3.0-only). The full license text is in the `LICENSE` file and has not been modified.

## 1. Original work and attribution

This repository (<https://github.com/Ezenitac-AiService/EasyViewer>) is a derivative work based on the original EasyViewer by edith2580 (<https://github.com/edith2580/EasyViewer>).

```text
Copyright (C) 2026 edith2580 — original EasyViewer
```

The original repository had no separate copyright statement. The attribution above was written by this fork based on the original author's public identity (GitHub account edith2580, first repository commit on 2026-11-07); it is not text copied from the original.

## 2. Changes in this fork

```text
Copyright (C) 2026 M5 — parts added or changed in this fork
```

The changes in this fork are the work of an individual contributor (commit author M5). This entry will be updated if there is evidence for attributing them to an organization.

## 3. Modification notice (GPLv3 §5(a))

- Base: original v0.1.6 (commit 44c4d37, tag upstream-base-v0.1.6)
- Independence date: 2026-11-17 (GitHub fork network separation completed: 2026-11-23)
- Later original releases (v0.2.0, v0.2.1, v0.2.2) were not merged into this fork.
- Main changes:
  - 001 refactoring: security boundaries (path validation, SSRF protection, CSP, separate credential storage). These changes were contributed to the original project (PR #2) and merged there.
  - 002 refactoring: deep restructuring of the document engines, storage and sync layers, and convergence of the quality gates. The internal data format was raised to version 2 (the original uses version 1).
  - 003 independent separation: app identifier changed to com.ezenitac.easyviewer, product display name to Pagelight and package name to pagelight; app icon replaced; support scope changed; license and notices reorganized; migration of existing user data.
- Source files that this fork changed substantially carry a one-line notice of the change at the top.

## 4. App name and icon

- This fork's app is named Pagelight and is a different app from the original EasyViewer.
- The app icons (`src-tauri/icons/`, Android `mipmap-*`, iOS `AppIcon.appiconset`) were generated with `npx tauri icon` from the source `src-tauri/icons/source/pagelight.svg`. That source was newly created in this fork, does not use the original icon, and is distributed under the same GPL-3.0-only license as this program.

## 5. Choice of license version

The original includes the full GPLv3 text but does not state whether "any later version" is allowed. This fork chose GPL-3.0-only. This is this fork's decision and will be reconsidered if the original author states that later versions are allowed.

## 6. Support scope

This fork focuses on **macOS**. iOS, Linux and Android are maintained platforms with lower priority; iOS is provided as a source build only, without a public distribution channel. **Windows is not a supported or distributed platform of this fork. On Windows, use the original [EasyViewer](https://github.com/edith2580/EasyViewer).** Running in a web browser is a development aid. Linux is verified on Ubuntu 22.04 or later and equivalent distributions (deb, AppImage, WebKitGTK 4.1, X11 and Wayland); other distributions may work but are not verified.

## 7. Third-party components

A summary table is in [THIRD_PARTY_LICENSES.en.md](THIRD_PARTY_LICENSES.en.md). The copyright notices and full license texts of every third-party component in the distributed files (direct and transitive dependencies) are in `src/generated/third-party-notices.txt`, which can also be viewed from the app's About screen.
