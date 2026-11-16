# 서드파티 오픈소스 라이선스 고지 (Third-Party Licenses)

**Project**: EasyViewer (`0.1.6-beta`)  
**Project License**: [GNU General Public License v3.0 (GPL-3.0)](./LICENSE)  
**Updated**: `2026-11-16`

> 본 프로젝트의 주 라이선스는 [`LICENSE`](./LICENSE)(GNU General Public License v3.0)이며, GPL-3.0 전문은 원문 변경이 금지되어 있으므로 원본 그대로 보존하고 본 문서에 직접 의존 서드파티 패키지·크레이트 라이선스 목록을 관리합니다.

---

## 1. 프론트엔드 런타임 의존성 (`package.json` `dependencies`)

| 패키지명 | 버전 범위 (`package.json`) | 설치 확인 버전 | SPDX 라이선스 |
| :--- | :--- | :--- | :--- |
| `@tauri-apps/api` | `^2.12.4` | `2.12.4` | `Apache-2.0 OR MIT` |
| `@tauri-apps/plugin-dialog` | `^2.8.4` | `2.8.4` | `MIT OR Apache-2.0` |
| `@tauri-apps/plugin-fs` | `^2.7.1` | `2.7.1` | `MIT OR Apache-2.0` |
| `@tauri-apps/plugin-opener` | `^2.7.3` | `2.7.3` | `MIT OR Apache-2.0` |
| `@tauri-apps/plugin-store` | `^2.5.1` | `2.5.1` | `MIT OR Apache-2.0` |
| `css-tree` | `^3.2.1` | `3.2.1` | `MIT` |
| `epubjs` | `^0.3.93` | `0.3.93` | `BSD-2-Clause` |
| `jszip` | `^3.10.1` | `3.10.2` | `MIT OR GPL-3.0-or-later` |
| `lucide-vue-next` | `^0.468.0` | `0.468.0` | `ISC` |
| `pinia` | `^2.3.0` | `2.3.1` | `MIT` |
| `tauri-plugin-keyring-store-api` | `^0.3.2` | `0.3.2` | `MIT OR Apache-2.0` |
| `vue` | `^3.5.13` | `3.5.45` | `MIT` |
| `vue-router` | `^4.5.0` | `4.6.4` | `MIT` |

> 참고: `0.1.6-alpha` 보안 아키텍처 전환에 따라 WebView 직접 HTTP 호출용 `@tauri-apps/plugin-http` 의존성은 제거되었으며, 네이티브 원격 요청은 Rust 백엔드 `safe_remote_fetch`(`reqwest`)로 일원화되었습니다.

---

## 2. 개발 및 테스트 도구 의존성 (`package.json` `devDependencies`)

| 패키지명 | 버전 범위 (`package.json`) | 설치 확인 버전 | SPDX 라이선스 |
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

## 3. Rust 네이티브 백엔드 직접 의존성 (`src-tauri/Cargo.toml`)

| 크레이트명 | `Cargo.toml` 명세 | `Cargo.lock` 고정 버전 | SPDX 라이선스 |
| :--- | :--- | :--- | :--- |
| `tauri` | `"2"` | `2.12.5` | `Apache-2.0 OR MIT` |
| `tauri-build` *(build)* | `"2"` | `2.7.4` | `Apache-2.0 OR MIT` |
| `tauri-plugin-fs` | `"2"` | `2.7.1` | `Apache-2.0 OR MIT` |
| `tauri-plugin-store` | `"2"` | `2.5.0` | `Apache-2.0 OR MIT` |
| `tauri-plugin-dialog` | `"2"` | `2.8.4` | `Apache-2.0 OR MIT` |
| `tauri-plugin-opener` | `"2"` | `2.7.3` | `Apache-2.0 OR MIT` |
| `tauri-plugin-keyring-store` | `"0.3.2"` | `0.3.2` | `MIT OR Apache-2.0` |
| `reqwest` | `"0.13"` (`rustls`, `http2`, `stream`) | `0.13.5` | `MIT OR Apache-2.0` |
| `tokio` | `"1"` (`fs`, `io-util`, `time`) | `1.54.1` | `MIT` |
| `futures-util` | `"0.3"` | `0.3.34` | `MIT OR Apache-2.0` |
| `dunce` | `"1.0.5"` | `1.0.5` | `CC0-1.0 OR MIT-0 OR Apache-2.0` |
| `sha2` | `"0.11"` | `0.11.1` | `MIT OR Apache-2.0` |
| `hex` | `"0.4"` | `0.4.3` | `MIT OR Apache-2.0` |
| `zip` | `"9"` (`deflate`) | `9.6.0` | `MIT` |
| `url` | `"2"` | `2.5.8` | `MIT OR Apache-2.0` |
| `base64` | `"0.22"` | `0.22.1` | `MIT OR Apache-2.0` |
| `serde` | `"1"` (`derive`) | `1.0.229` | `MIT OR Apache-2.0` |
| `serde_json` | `"1"` | `1.0.154` | `MIT OR Apache-2.0` |

> 간접(전이) 의존성의 상세 목록 및 버전은 [`package-lock.json`](./package-lock.json) 및 [`src-tauri/Cargo.lock`](./src-tauri/Cargo.lock)에서 확인할 수 있습니다. 본 소프트웨어의 소스 코드를 재배포하거나 파생 저작물을 배포하는 경우 [`LICENSE`](./LICENSE)(GNU GPL v3.0) 조항이 적용됩니다.
