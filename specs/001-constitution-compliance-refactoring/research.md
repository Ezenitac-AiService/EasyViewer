# 기술 리서치 및 설계 의사결정: 헌법 준수 기반 아키텍처·품질·보안 리팩토링

**Feature**: `001-constitution-compliance-refactoring` | **Date**: 2026-11-15
**Spec**: [`spec.md`](./spec.md) | **Constitution**: [`.specify/memory/constitution.md`](../../.specify/memory/constitution.md) (`v3.2.0`)

본 문서는 `plan.md` 수립에 앞서 기술적 미확정 요소, 크로스 플랫폼 경계, 보안(CSP·SSRF·자격증명), 테스트 전략, 성능 검증 및 품질 게이트 자동화 방안을 **공식 레퍼런스와 실제 코드베이스 실측 결과**에 기반해 확정합니다.

---

## 1. 2계층 자동화 검증 및 특성화 테스트 아키텍처

- **Decision**:
  - **1계층(단위·경계 격리 테스트)**: `Vitest` (`^3.2`, Vite 6 공식 호환 버전) + `@vue/test-utils` + `jsdom` + `@tauri-apps/api/mocks` (`mockIPC`, `clearMocks`) 조합을 채택한다.
  - **2계층(실제 브라우저 렌더링·E2E·성능 테스트)**: `Playwright` (`@playwright/test`, Chromium + WebKit)를 Vite preview 서버(`npm run preview`)와 연동해 실행한다. 보안 CSP 검증 시에는 `src-tauri/tauri.conf.json`의 `app.security.csp`를 읽어 preview/Playwright 응답 HTTP `Content-Security-Policy` 헤더로 주입한 상태에서 실제 적용을 검증한다.
  - **네이티브 백엔드 테스트**: `src-tauri/src/lib.rs`의 데스크톱/모바일 경로·원격 URL 검증 로직을 순수 Rust 함수로 분리하고 `cargo test` 및 `cargo check`로 검증한다. (`scripts/verify.mjs` 통합 게이트에 포함되며, Rust 미설치 호스트에서는 기본 `exit 2` `BLOCKED`로 구분하고 로컬 `aarch64-apple-darwin` 외 미설치 크로스 타겟·모바일 실기기는 대상 환경에서 완료한다.)
  - **리팩토링 절차**: Michael Feathers의 *Characterization Tests* 및 *Seams* 기법에 따라, 기존 동작을 수정하기 전에 1·2계층 특성화 테스트로 현재 동작을 먼저 고정한 뒤 구조를 전환한다.
- **Rationale**:
  - **코드베이스 실측 근거**: `package.json`에 `test` 스크립트와 테스트 의존성이 전무하며, `src/engines/txt/txtMeasuredPagination.ts`는 `getComputedStyle`·`clientWidth`·`clientHeight`·`Range`에 직접 의존하므로 `jsdom`에서는 `clientWidth === 0`이 되어 `TxtPageMeasurer.valid === false`가 된다. 또한 `src/engines/epub/epubEngine.ts`는 iOS/macOS WebKit의 iframe 이벤트 제약 때문에 `allowScriptedContent: true`를 사용한다. 따라서 1계층(`jsdom` + `mockIPC`)만으로는 측정 기반 페이지네이션과 WebKit/Chromium iframe CSP 동작을 검증할 수 없으며, 2계층 실제 브라우저 렌더링 테스트 분리가 필수적이다.
  - **공식 레퍼런스 근거**: Tauri v2 공식 테스팅 문서(`@tauri-apps/api/mocks`)는 `window.__TAURI_INTERNALS__` 부재 환경에서 `mockIPC`와 `afterEach(() => clearMocks())`를 표준으로 권장하며, Vue/Vite 공식 에코시스템은 단위·컴포넌트 테스트에 `Vitest`를, 실제 브라우저 레이아웃·E2E에 `Playwright`를 권장한다.
- **Alternatives considered**:
  - *Vitest 단독 + `clientWidth`/`Range` 전면 모킹*: 모의 객체가 실제 CSS 줄바꿈·레이아웃을 재현하지 못해 거짓 통과(False Confidence) 위험이 큼.
  - *Playwright 단독 실행*: 단순 스토어·병합·인코딩 함수까지 매번 브라우저를 띄우면 1계층 30초 목표(`SC-001`) 달성이 어렵고 TDD 피드백 루프가 느려짐.

---

## 2. 플랫폼 추상화 계층 확장 및 점진 이관 (Branch by Abstraction)

- **Decision**:
  - 기존 `src/services/storage/platformAdapter.ts`의 저장소 책임을 유지하면서, 플랫폼 분기 기능(`FR-004`)을 포괄하는 **도메인별 포트 모듈(`src/services/platform/`)**을 신설하고 기존 `platformAdapter.ts`를 호환 파사드로 정리한다:
    - `dialogService.ts` (파일/폴더 선택, 확인/경고 대화상자 — Tauri `plugin-dialog` vs 웹 `<input type="file">`/`confirm` 폴백)
    - `dragDropService.ts` (Tauri Webview `onDragDropEvent` + `plugin-fs` 읽기 vs 브라우저 HTML5 `drop` `DataTransfer` 통합)
    - `pathService.ts` (파일명/디렉토리 추출, 경로 정규화 — `@tauri-apps/api/path` vs 순수 문자열 폴백)
    - `credentialService.ts` (WebDAV 비밀번호 세션 메모리/플랫폼 안전 저장/웹 동의 분기)
    - 기존 `src/services/storage/platformAdapter.ts` 및 `src/services/network/`는 동일 경계 계층으로 통합 관리한다.
  - **전환 기법**: Martin Fowler의 *Branch by Abstraction* 패턴에 따라 `LibraryView.vue`와 `useBookStore.ts`의 직접 `@tauri-apps/*` 호출(`@tauri-apps/plugin-dialog`, `@tauri-apps/api/webview`, `@tauri-apps/plugin-fs`, `@tauri-apps/api/path`)을 특성화 테스트 통과 상태에서 단계적으로 포트 호출로 교체한다.
  - **제외 경계(`FR-005`)**: `ReaderView.vue`, `ViewerSideDrawer.vue`, `useSettingsStore.ts`의 표준 웹뷰 DOM 조작(`window.getSelection`, `window.addEventListener('keydown'|'resize')`, `document.documentElement.classList`)은 추상화 강제 대상에서 제외한다.
- **Rationale**:
  - **코드베이스 실측 근거**: 현재 `LibraryView.vue`(L67, L99, L133, L252)와 `useBookStore.ts`(L101)가 `@tauri-apps/*`를 직접 동적 import하고 있어, 단위 테스트에서 모킹 지점이 분산되고 웹/모바일 분기 로직이 뷰 컴포넌트에 혼재되어 있다.
  - **공식 레퍼런스 근거**: Ports & Adapters 및 Branch by Abstraction은 기존 외부 동작을 깨뜨리지 않고 호출부를 단일 경계로 수렴시키는 표준 리팩토링 패턴이다.
- **Alternatives considered**:
  - *`platformAdapter.ts` 단일 파일에 다이얼로그·드래그앤드롭·경로·자격증명 모두 추가*: 단일 파일이 700줄 이상 비대화되어 단일 책임 원칙과 테스트 격리가 약화됨.

---

## 3. 콘텐츠 보안 정책(CSP), 전자책 격리 및 폰트 자산화

- **Decision**:
  - **`index.html` 외부 CDN 제거**: Google Fonts `<link>`(L11-13)를 제거하고, `src/assets/main.css` 및 `epubEngine.ts`의 폰트 스택을 **로컬 번들 폰트(필요 시 경량 서브셋/가변 폰트 또는 OS 기본 한글 폰트 스택: `"Pretendard Variable", Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans CJK KR", sans-serif` / `"Nanum Myeongjo", "AppleMyungjo", Georgia, serif`)**로 전환한다.
  - **`src-tauri/tauri.conf.json` 명시적 CSP 설정**: `"csp": null`을 제거하고 Tauri v2 호환 정책을 적용한다:
    - `default-src`: `'self' customprotocol: asset:`
    - `script-src`: `'self'` (외부·인라인 스크립트 전면 차단; Tauri 빌드 시 번들 해시/논스 자동 주입 활용)
    - `style-src`: `'self' 'unsafe-inline' blob:` (EPUB XHTML 인라인 스타일, `epub.js` `blob:` CSS 및 동적 뷰어 테마 변수 주입 허용)
    - `img-src`: `'self' asset: http://asset.localhost blob: data:` (전자책 내장 이미지·표지 렌더링 지원)
    - `font-src`: `'self' data: blob:` (외부 CDN 차단)
    - `frame-src` / `child-src`: `'self' blob: data:` (`epub.js` iframe 렌더링 허용)
    - `connect-src`: `'self' ipc: http://ipc.localhost blob: data:` (Tauri IPC·동일 출처 `/__remote_proxy`·로컬 `blob:` 메타 읽기만 허용하고 임의 `http:`/`https:` 아웃바운드 유출 차단)
    - `object-src`: `'none'`
    - `base-uri`: `'self'`
  - **전자책 콘텐츠 다중 격리·Zip Bomb 방어·`<base>` 정합성**: `epubEngine.ts`에서 `ePub(buffer)` 및 `locations.generate(150)` 호출 전에 `jszip` 중앙 디렉토리로 엔트리 수·개별/누적 압축 해제 크기 상한(예: 10,000 엔트리, 256 MiB)을 사전 검증해 압축 폭탄(Zip Bomb)을 차단한다. 또한 `sanitizeSectionDocument` + `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; object-src 'none'; frame-src 'none'; child-src 'none'; worker-src 'none'; form-action 'none'; base-uri 'none'; connect-src 'none'; style-src 'self' 'unsafe-inline' blob: data:; img-src 'self' blob: data:; font-src 'self' blob: data:">` 2중 방어를 적용하고 SVG `<script>`/`<foreignObject>`/`<use>`/`<animate>`/`<set>`·`xlink:href` 위험 URI·`<base>`·CSS `@import`/`expression()`/`url(javascript:)`/`data:text/html` 차단을 포함하며, `epub.js` `hooks.content.register`의 `<base>` 주입/제거 순서와 `base-uri 'none'` 간 호환성을 Chromium·WebKit에서 실제 다중 챕터 EPUB(CSS/이미지/SVG 포함)으로 검증한다.
- **Rationale**:
  - **공식 레퍼런스 근거**: Tauri v2 공식 보안 문서에 따르면 `"csp": null`은 모든 XSS 보호를 무력화하며, `blob:`/`asset:`/`'unsafe-inline'`(style-src)는 `epub.js` iframe `srcdoc`/`blob:` 렌더링 호환을 위해 필요한 최소 디렉티브이다. 또한 `@fontsource` CJK 폰트 패키지는 수 MB에 달할 수 있으므로 오프라인 우선 경량 앱에서는 OS 기본 한글 폰트 스택을 기본으로 하되 선택적 로컬 `.woff2` 자산만 허용해 번들 비대화와 외부 CDN 의존성을 동시에 제거한다.
- **Alternatives considered**:
  - *`script-src 'unsafe-inline'` 허용 또는 `style-src`에서 `'unsafe-inline'` 제거*: 전자책 내 인라인 `style="..."` 및 뷰어 동적 테마 주입이 깨지므로, HTML 새니타이저 + `script-src 'self'` 유지가 현실적 최선이다.
  - *즉시 `epubjs` (`^0.3.93`) + `jszip` (`^3.10.1`)을 `foliate-js` + `fflate`로 교체*: `epubjs`는 업스트림 유지보수가 중단되어 macOS/iOS `WKWebView`에서 `allowScriptedContent: true`와 `style-src 'unsafe-inline' blob:`를 강요하고, `jszip`(`~100KB`)은 대용량 파일 메모리 부담이 크므로 중장기적으로는 ES 모듈 기반 `foliate-js` + `fflate`(`~9KB` 스트리밍) 전환이 타당하다. 다만 본 리팩토링은 기존 동작 100% 보존(`SC-003`)이 목표이므로 현 단계에서는 사전 Zip Bomb 상한 검증·다층 새니타이저로 격리를 완성하고 엔진 교체는 차기 마일스톤으로 분리한다.

---

## 4. 원격 중계 프록시 SSRF 방어 및 WebDAV 자격증명 보안 마이그레이션

- **Decision**:
  - **프록시(`vite.config.ts` `/__remote_proxy`) 및 네이티브 HTTP(Rust `safe_remote_fetch`) Zero-Trust·SSRF·DoS·TLS 방어**:
    1. **Fail-Closed 동일 출처(Origin/Sec-Fetch-Site)·메서드·크기·타임아웃 검증**: `Access-Control-Allow-Origin: *`를 제거하고, `Origin`/`Referer` 누락·불일치 또는 `Sec-Fetch-Site` 불일치 시 즉시 `403 Forbidden`으로 거부한다(Fail-Closed). HTTP 메서드는 `GET`/`HEAD`/`OPTIONS`/`PROPFIND`/`POST`만 허용하고 요청 본문(`1 MiB`)·응답 스트림(`256 MiB`)·소켓 타임아웃을 강제해 프록시 DoS/OOM을 차단한다.
    2. **공용 순수 분류 + Node DNS Pinning + 서버 세션 논스**: 브라우저/Node 공용 `src/services/network/ssrfValidator.ts`는 `node:*` 의존성 없는 순수 URL 정규화·IP 리터럴·CIDR 판별만 담당한다. Node 프록시 전용 가드(`scripts/remoteProxyGuard.mjs`)는 DNS 해석 IP 검증 후 `http.request`/`https.request`의 커스텀 `lookup` 콜백으로 검증된 단일 IP를 고정해 DNS Rebinding(TOCTOU)을 차단하고, WebDAV `PROPFIND` XML `href`의 `..` 경로 탐색·제어 문자를 거부한다.
    3. **사설망 개인 NAS·자체 서명 TLS 예외의 서버 측 논스 게이트**: RFC 1918·`fc00::/7`·`.local` 호스트는 기본 차단(`PRIVATE_NETWORK_CONFIRM_REQUIRED`), 자체 서명 TLS는 기본 `rejectUnauthorized: true`에서 `SELF_SIGNED_TLS_CONFIRM_REQUIRED`로 차단한다. 프록시의 `x-allow-private-nas`/`x-allow-insecure-tls` 헤더 단독 신뢰를 금지하고 서버가 발급한 세션 논스(`X-Proxy-Session-Token`) 및 UI 승인 호스트 정책을 동반 검증한다.
    4. **네이티브 HTTP WebView 우회 원천 차단 (`safe_remote_fetch` + macOS 시스템 키체인 CA 신뢰)**: Tauri WebView Capability(`default.json`)에서 `"http:default"` 와일드카드 및 `@tauri-apps/plugin-http` 직접 `fetch` 권한(`plugin:http|fetch`)을 제거해 WebView XSS의 JS 사전검사 우회 및 `plugin-http` IPC 버전 불일치/`CVE-2026-95623` 표면을 제거한다. 대신 `src-tauri/Cargo.toml`의 **`reqwest` (`0.13`, 기본 `rustls` + 내장 `rustls-platform-verifier`, MSRV `1.85.0`)** 단일 스택으로 확정된 Rust 전용 `safe_remote_fetch` 커맨드가 URL 정규화·`url::Host`(`Ipv4`/`Ipv6`/`Domain`) 기반 IP 리터럴 즉시 분류·DNS IP 검증·연결 IP 고정(대괄호 제거 호스트명 키)·`redirect::Policy::none()` 수동 리다이렉트 추적(최대 5홉, 교차 출처 시 `Authorization` 제거)·응답 바이트 상한(`256 MiB`)·전체 요청·스트림 총합 수명 데드라인(`TIMEOUT:`)을 원자적으로 강제한다. (`reqwest 0.12`의 `rustls-tls`/`webpki-roots`는 macOS Keychain Access 사용자 신뢰 루트 CA를 무시하므로 `0.13` 전환을 단일 정설 안으로 고정하며, 리다이렉트 루프 밖 `reqwest::Client` 재사용/풀링으로 핸드셰이크 오버헤드를 최소화한다.)
    5. **TLS 검증 정책**: 프록시 기본값 `rejectUnauthorized: true`, Rust `safe_remote_fetch` 기본값 `danger_accept_invalid_certs(false)`(macOS `Security.framework`/OS 키체인 기반 `rustls-platform-verifier` 신뢰 포함)를 강제하며, 사용자가 특정 호스트 예외(`allowSelfSignedTls: true`)를 명시 승인한 요청에 한해 예외를 허용한다.
  - **WebDAV 자격증명 보호 및 `v1 → v2` 호환 마이그레이션**:
    1. 기본 동작: 비밀번호는 현재 실행 세션 동안만 메모리 맵(`Map<connectionId, string>`)에 유지한다.
    2. "비밀번호 기억" 선택 시: 네이티브(Tauri) 환경은 **`tauri-plugin-keyring-store`**(`0.3.2`) + `tauri-plugin-keyring-store-api` 단일 스택을 유지해 macOS/iOS Keychain, Android Keystore, Windows Credential Manager, Linux Secret Service 5개 OS 안전 저장소에 즉시 분리 저장한다(순수 `keyring v4` + `android-keyring` 직접 커맨드 전환은 Android `ndk-context` 검증 부담 및 5-OS 동작 회귀 방지를 위해 차기 경량화 마일스톤으로 분리; 프론트엔드 자체 키 저장 금지; macOS `tauri dev` 바이너리 해시 변경 시 Login Keychain 프롬프트는 일관된 개발자 서명/번들 ID로 완화). 웹 환경은 브라우저 로컬 저장 한계(XSS 시 노출 가능) 경고 동의 후 저장한다.
    3. 마이그레이션: 기존 `webdav_history`에 `password` 평문 필드가 존재하면 첫 로드 시 연결 정보(`id`, `alias`, `url`, `username`, `initialPath`, `lastConnectedAt`)를 유지한 채 안전 저장소(또는 세션 메모리)로 이관하고 `webdav_history` 레코드에서 평문 `password`를 제거한다.
- **Rationale**:
  - **공식 레퍼런스 근거**: OWASP SSRF Prevention Cheat Sheet는 검증된 IP로의 소켓 연결 고정(DNS Rebinding/TOCTOU 차단)·리다이렉트 홉 재검증을 필수로 권고한다. 또한 `tauri-plugin-http`를 WebView Capability에 `"http:default"`로 열어 두면 XSS가 `plugin:http|fetch`를 직접 호출해 JS URL 검사를 우회할 수 있고, JS/Rust 마이너 버전 차이에 따른 IPC 계약 불일치·`CVE-2026-95623` 리다이렉트 스코프 취약점 위험이 남으므로, Rust `safe_remote_fetch` 커맨드로 단일화하는 것이 헌법 제7원칙(Zero Trust)에 부합한다. 아울러 `platformAdapter.ts`의 평문 저장을 대체하기 위해 Rust `tauri-plugin-keyring-store`와 JS 클라이언트 `tauri-plugin-keyring-store-api` 쌍이 필요하다.
- **Alternatives considered**:
  - *Rust 키체인 없이 프론트엔드 TS 난수 키 암호화 사용*: 키와 암호문이 동일 저장소(`localStorage`/파일)에 남아 헌법 제3원칙(무결성·우회 금지)과 `FR-009` 위반이므로 기각한다.

---

## 5. Tauri v2 플랫폼별 Capability 분리

- **Decision**:
  - [`src-tauri/capabilities/default.json`](../../src-tauri/capabilities/default.json)에는 공통 최소 권한(`core:default`, `fs:default`, `$APPDATA/books/**` 한정 모바일 내부 책 파일 읽기·쓰기·삭제·폴더 생성, `store:default`, `dialog:default`, `keyring-store:default`)만 남기고, 광범위한 `fs:allow-appdata-read-recursive` / `fs:allow-appdata-write-recursive` 및 와일드카드 `http:default`는 제거한다.
  - 데스크톱 전용 파일 시스템 권한(`fs:allow-exists`, `fs:allow-stat`, `fs:allow-read-file`, `fs:allow-write-file`, `fs:allow-mkdir`, `fs:allow-rename`, `fs:allow-remove`) 및 폴더 열기(`tauri-plugin-opener` + `@tauri-apps/plugin-opener` `openPath`로 `platformAdapter.ts` `openStorageDir` 이관, `Command::new("open")` 제거)는 [`src-tauri/capabilities/desktop.json`](../../src-tauri/capabilities/desktop.json)(`"platforms": ["linux", "macOS", "windows"]`)으로 분리하며 `opener:allow-open-path`는 승인된 디렉토리 범위로 스코프를 제한한다.
  - **macOS Zero-Trust 경로 제한·화이트리스트·바이너리 IPC 및 배포 모델**: `read_validated_book_file`은 `#[cfg(desktop)]` 전용으로 한정하고(모바일 노출 제거), `canonicalize()` 심볼릭 링크 해소 검증·대소문자 비구분 파일시스템(macOS APFS/Windows) ASCII 소문자 정규화를 포함한 민감 OS/자격증명 디렉토리(`/System`, `/Library`, `/etc`, `/private`, `~/.ssh`, `~/.gnupg`, `~/.aws`, `~/.kube`) 차단에 더해 Rust 측에서 등록된 `allow_storage_dir` 또는 네이티브 드롭/다이얼로그 허용 경로 화이트리스트 하위인지 검증하며 Tauri v2 바이너리 `tauri::ipc::Response`로 직렬화 오버헤드 없이 반환한다. `allow_storage_dir`는 미존재 리프 생성 시 최장 기존 조상까지 `canonicalize()` 검증 후 생성·재검증으로 TOCTOU를 차단한다. 또한 macOS 비샌드박스(`.dmg`/Hardened Runtime) 배포를 기본 전제로 `bundle.macOS.signingIdentity: "-"` Ad-Hoc 번들 봉인을 적용(`codesign --verify --deep --strict` 통과, `APPLE_SIGNING_IDENTITY`로 CI 재정의 가능)하며, Mac App Store(App Sandbox) 배포 시 `tauri-plugin-persisted-scope` + `com.apple.security.files.user-selected.read-write` entitlement를 필수로 결합한다.
- **Rationale**:
  - **공식 레퍼런스 근거**: Tauri v2 공식 Capabilities·Opener·Persisted Scope 문서는 `"platforms"` 배열을 통한 최소 권한 분리, `tauri-plugin-opener` 권한 스코프 통합, macOS App Sandbox 환경에서의 `persisted-scope` 및 `2.12.x` macOS LaunchServices 재시작 수정을 권장한다.

---

## 6. 런타임 성능 기준선 및 통계 검증 설계

- **Decision**:
  - Playwright 기반 성능 측정 스크립트(`tests/perf/baseline.spec.ts` 및 `scripts/run-perf-gate.mjs`)를 통해 3개 핵심 구간을 측정한다:
    1. 서재 초기화 완료 시간 (고정 `50`권 메타데이터 시드 기반 `LibraryView` 마운트 → 목록 렌더링 완료; 콜드 `IndexedDB` 오픈 제외 측정 명시)
    2. 대용량 텍스트(1MB 이상 고정 한국어/영문 픽스처) 열람 및 첫 페이지/청크 표시 시간
    3. 보기 모드(`scroll` ↔ `paginated`) 및 테마(`light` → `dark` → `sepia`) 전환 완료 시간
  - **통계 판정**: 워밍업 2회 제외 후 7회 반복 측정의 **중앙값($p_{50}$)**을 비교하며, `SC-006`에 따라 `(신규 중앙값 - 기준선 중앙값 > 15ms) && ((신규 중앙값 - 기준선 중앙값) / 기준선 중앙값 > 0.10)`인 경우에만 회귀(Fail)로 판정한다.
  - 기준선 리포트는 동일 `environment`(OS/CPU/브라우저)에서 생성된 `specs/001-constitution-compliance-refactoring/perf-baseline.json`(로컬 검증용 임시 산출물)과 비교하며, 실행 환경이 다른 경우 동일 환경의 기준 커밋에서 기준선을 재측정해 대조한다.

---

## 7. 품질·거버넌스 게이트 자동화 스크립트

- **Decision**:
  - Node.js 기반 무의존 검사 스크립트 3종을 `scripts/`에 추가하고 `package.json` 스크립트에 연결한다:
    1. `scripts/check-boundaries.mjs` (`npm run check:boundaries`): `src/views/`, `src/stores/`, `src/components/`, `src/engines/`, `src/services/sync/`에서 `@tauri-apps/*`, `localStorage`, `indexedDB`, 비승인 직접 네트워크 `fetch`/`XMLHttpRequest`(`blob:` 예외 허용) 참조 및 `src/engines/`의 상위 레이어 역의존이 발견되면 비정상 종료(exit 1)하여 `SC-002`를 자동 검증한다(추상화 허용 경로인 `src/services/platform/`, `src/services/storage/`, `src/services/network/` 제외).
    2. `scripts/check-version-sync.mjs` (`npm run check:version`): `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json` (및 존재하는 경우 `package-lock.json`, `src-tauri/Cargo.lock`)의 버전 문자열이 프리릴리즈 SemVer(`0.1.6-alpha` 등) 포함 일치하는지 검증한다.
    3. `scripts/check-commit-msg.mjs` (`npm run check:commit-msg`): Conventional Commits 헤더(`^(feat|fix|docs|style|refactor|perf|test|build|ci|chore)(\([a-z0-9-]+\))?!?: .+`), 빈 줄, 한국어 포함 상세 본문(최소 20자 이상 또는 이유/내용 서술) 여부를 검증한다.
  - 통합 검증 스크립트 `npm run verify`: `npm run build && npm test && npm run check:boundaries && npm run check:version` 및 `cargo check && cargo test`를 실행한다. `cargo` 미설치 환경에서는 기본 종료 코드를 `2`(`BLOCKED`)로 반환해 Rust 미검증 상태의 거짓 통과를 차단하며, 로컬에서 프론트엔드 게이트만 확인할 때는 `--frontend-only` 플래그를 명시한 경우에 한해 `BLOCKED` 경고를 기록하고 `0`을 반환한다. (또한 1계층 `mockIPC` 테스트에서 `initLibrary`/`prepareBookFiles` IPC 호출 횟수 상한을 별도 검증한다.)
