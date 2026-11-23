# Third-party open source licenses

**언어 / Language**: [한국어](THIRD_PARTY_LICENSES.md) | **[English](THIRD_PARTY_LICENSES.en.md)**

**Project**: Pagelight (independent fork of EasyViewer, `1.0.0-alpha.1`)  
**Project License**: [GNU General Public License v3.0 only (`GPL-3.0-only`)](./LICENSE) — the reason for the version choice is in section 5 of [NOTICE.en.md](./NOTICE.en.md)  
**Updated**: `2026-11-23`

> This is a reference translation of [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md). The Korean table is the one checked by `scripts/check-licenses.mjs`; if the two differ, the Korean document prevails.

> **Full notices**: this document summarizes direct dependencies. The copyright notices and full license texts of every third-party component in the distributed files, including transitive dependencies, are in [`src/generated/third-party-notices.txt`](./src/generated/third-party-notices.txt) (viewable from the app's About screen) and are generated with `node scripts/check-licenses.mjs --write`.

> The project's main license is [`LICENSE`](./LICENSE) (GNU General Public License v3.0). The GPL-3.0 text must not be modified, so it is kept as is; this document lists the licenses of the direct third-party packages and crates.

---

## 1. Frontend runtime dependencies (`package.json` `dependencies`)

| Package | Range (`package.json`) | Installed version | SPDX license |
| :--- | :--- | :--- | :--- |
| `@tauri-apps/api` | `^2.12.4` | `2.12.4` | `Apache-2.0 OR MIT` |
| `@tauri-apps/plugin-dialog` | `^2.8.4` | `2.8.4` | `MIT OR Apache-2.0` |
| `@tauri-apps/plugin-fs` | `^2.7.1` | `2.7.1` | `MIT OR Apache-2.0` |
| `@tauri-apps/plugin-opener` | `^2.7.3` | `2.7.3` | `MIT OR Apache-2.0` |
| `@tauri-apps/plugin-store` | `^2.5.1` | `2.5.1` | `MIT OR Apache-2.0` |
| `css-tree` | `^3.2.1` | `3.2.1` | `MIT` |
| `epubjs` | `^0.3.93` | `0.3.93` | `BSD-2-Clause` |
| `jszip` | `^3.10.1` | `3.10.2` | `MIT OR GPL-3.0-or-later` (this fork chooses `MIT`) |
| `lucide-vue-next` | `^0.468.0` | `0.468.0` | `ISC` |
| `pinia` | `^2.3.0` | `2.3.1` | `MIT` |
| `tauri-plugin-keyring-store-api` | `^0.3.2` | `0.3.2` | `MIT OR Apache-2.0` |
| `vue` | `^3.5.13` | `3.5.45` | `MIT` |
| `vue-router` | `^4.5.0` | `4.6.4` | `MIT` |

> Note: with the `0.1.6-alpha` security architecture change, the `@tauri-apps/plugin-http` dependency for direct HTTP calls from the WebView was removed; native remote requests go through the Rust backend `safe_remote_fetch` (`reqwest`).

---

## 2. Development and test tools (`package.json` `devDependencies`)

| Package | Range (`package.json`) | Installed version | SPDX license |
| :--- | :--- | :--- | :--- |
| `@playwright/test` | `^1.59.1` | `1.65.1` | `Apache-2.0` |
| `@tauri-apps/cli` | `^2.12.4` | `2.12.4` | `Apache-2.0 OR MIT` |
| `@types/node` | `^22.10.0` | `22.20.5` | `MIT` |
| `@vitejs/plugin-vue` | `^5.2.1` | `5.2.4` | `MIT` |
| `@vue/test-utils` | `^2.6.0` | `2.6.0` | `MIT` |
| `autoprefixer` | `^10.4.20` | `10.6.2` | `MIT` |
| `fake-indexeddb` | `^6.2.8` | `6.2.8` | `Apache-2.0` |
| `jsdom` | `^26.1.0` | `26.1.0` | `MIT` |
| `postcss` | `^8.4.49` | `8.5.32` | `MIT` |
| `tailwindcss` | `^3.4.17` | `3.4.19` | `MIT` |
| `typescript` | `~5.6.3` | `5.6.3` | `Apache-2.0` |
| `vite` | `^6.0.5` | `6.4.5` | `MIT` |
| `vitest` | `^3.2.4` | `3.2.7` | `MIT` |
| `vue-tsc` | `^2.2.0` | `2.2.12` | `MIT` |

---

## 3. Rust native backend direct dependencies (`src-tauri/Cargo.toml`)

| Crate | `Cargo.toml` requirement | `Cargo.lock` version | SPDX license |
| :--- | :--- | :--- | :--- |
| `tauri` | `"2"` | `2.12.5` | `Apache-2.0 OR MIT` |
| `tauri-build` *(build)* | `"2"` | `2.7.4` | `Apache-2.0 OR MIT` |
| `tauri-plugin-fs` | `"2"` | `2.7.1` | `Apache-2.0 OR MIT` |
| `tauri-plugin-store` | `"2"` | `2.5.0` | `Apache-2.0 OR MIT` |
| `tauri-plugin-dialog` | `"2"` | `2.8.4` | `Apache-2.0 OR MIT` |
| `tauri-plugin-opener` | `"2"` | `2.7.3` | `Apache-2.0 OR MIT` |
| `tauri-plugin-keyring-store` | `"0.3.2"` | `0.3.2` | `MIT OR Apache-2.0` |
| `tauri-plugin-single-instance` *(desktop)* | `"2"` | `2.5.5` | `Apache-2.0 OR MIT` |
| `reqwest` | `"0.13"` (`rustls`, `http2`, `stream`) | `0.13.5` | `MIT OR Apache-2.0` |
| `tokio` | `"1"` (`fs`, `io-util`, `time`) | `1.54.1` | `MIT` |
| `futures-util` | `"0.3"` | `0.3.34` | `MIT OR Apache-2.0` |
| `dunce` | `"1.0.5"` | `1.0.5` | `CC0-1.0 OR MIT-0 OR Apache-2.0` |
| `sha2` | `"0.11"` | `0.11.1` | `MIT OR Apache-2.0` |
| `hex` | `"0.4"` | `0.4.3` | `MIT OR Apache-2.0` |
| `zip` | `"9"` (`deflate`) | `9.6.0` | `MIT` |
| `url` | `"2"` | `2.5.9` | `MIT OR Apache-2.0` |
| `base64` | `"0.22"` | `0.22.1` | `MIT OR Apache-2.0` |
| `serde` | `"1"` (`derive`) | `1.0.229` | `MIT OR Apache-2.0` |
| `serde_json` | `"1"` | `1.0.154` | `MIT OR Apache-2.0` |

> Transitive dependencies and their versions are listed in [`package-lock.json`](./package-lock.json) and [`src-tauri/Cargo.lock`](./src-tauri/Cargo.lock). If you redistribute the source code or distribute derivative works, the terms of [`LICENSE`](./LICENSE) (GNU GPL v3.0) apply.
