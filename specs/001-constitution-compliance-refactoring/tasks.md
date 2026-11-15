---

description: "001-constitution-compliance-refactoring 구현을 위한 단계별 태스크 목록"
---

# Tasks: 헌법 준수 기반 아키텍처·품질·보안 리팩토링

**Input**: Design documents from `/specs/001-constitution-compliance-refactoring/`
**Prerequisites**: [plan.md](./plan.md) (required), [spec.md](./spec.md) (required), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: 본 기능은 헌법 제2원칙(TDD·무테스트 구현 금지) 및 `FR-001`~`FR-003`에 따라 **2계층 특성화 테스트(1계층 Vitest + 2계층 Playwright)와 TDD Red → Green → Refactor 주기를 필수 포함**합니다. 각 리팩토링 작업에 앞서 실패하는 테스트 또는 특성화 테스트를 먼저 작성하고 검증합니다.

**Organization**: 태스크는 [spec.md](./spec.md)의 사용자 스토리 우선순위(`US1`~`US4`)별로 독립 구현·독립 검증 가능하도록 구성했습니다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 서로 다른 파일을 다루며 미완료 선행 태스크에 의존하지 않아 병렬 실행 가능
- **[Story]**: 해당 태스크가 속한 사용자 스토리 (`US1`, `US2`, `US3`, `US4`) — Setup·Foundational·Polish 단계에서는 생략
- 모든 태스크 설명에는 대상 파일 경로와 `data-model.md` / `contracts/`의 불변 제약 조건을 명시

## Path Conventions

- 프론트엔드 소스: `src/` (`views/`, `stores/`, `components/`, `engines/`, `services/`, `types/`, `assets/`)
- 네이티브 백엔드 및 설정: `src-tauri/` (`src/`, `capabilities/`, `tauri.conf.json`, `Cargo.toml`)
- 자동화 검증 및 품질 스크립트: `tests/unit/`, `tests/e2e/`, `tests/perf/`, `tests/fixtures/`, `scripts/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 2계층 테스트 러너(`Vitest`, `Playwright`)와 품질 게이트 스크립트 기반을 초기화한다.

- [X] T001 `devDependencies`(`vitest` `^3.2`, `@vue/test-utils`, `jsdom`, `@playwright/test`), `dependencies`의 `tauri-plugin-keyring-store-api`(OS 키체인 JS 바인딩) 추가 및 미사용 `@tauri-apps/plugin-http` 제거(`safe_remote_fetch` 통합)와 함께 `test`, `test:e2e`, `test:perf`, `check:boundaries`, `check:version`, `check:commit-msg`, `verify` 스크립트를 `package.json`에 추가 (기존 `"version": "0.1.5"` 유지)
- [X] T002 [P] `@/` 경로 별칭(`tsconfig.json` 일치), `jsdom` 환경, `tests/unit/setup.ts` 전역 설정을 포함한 `vitest.config.ts` 생성
- [X] T003 [P] `npm run preview` 웹 서버 연동(테스트 모드에서 `src-tauri/tauri.conf.json`의 `app.security.csp` HTTP 헤더 검증 지원) 및 Chromium/WebKit 프로젝트를 구성한 `playwright.config.ts` 생성
- [X] T004 [P] `tests/unit/`, `tests/e2e/`, `tests/perf/`, `tests/fixtures/`, `src/services/platform/` 디렉토리 구조 생성

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 사용자 스토리가 공통으로 의존하는 격리 테스트 대역(`mockIPC`), 결정적 테스트 픽스처, 하위 호환 도메인 타입 보강을 준비한다.

**⚠️ CRITICAL**: 본 단계가 완료되기 전에는 어떤 사용자 스토리 리팩토링도 착수하지 않는다.

- [X] T005 `afterEach(() => clearMocks())`, `@tauri-apps/api/mocks`의 `mockIPC` 헬퍼, `crypto.randomUUID`/브라우저 API 기본 스텁을 제공하는 `tests/unit/setup.ts` 작성
- [X] T006 [P] 1MB 이상 한국어·영문 혼합 TXT 픽스처 생성기와 깨끗한 EPUB(다중 챕터 CSS/이미지/SVG 포함)·악성 `<script>`/`on*`/`javascript:`/`data:text/html`/CSS `expression()` 포함 EPUB·Zip Bomb(과다 엔트리/과대 비압축 크기) 아카이브 및 악성 WebDAV `PROPFIND` `href`(`..`/제어문자) 픽스처를 생성하는 `tests/fixtures/bookFixtures.ts` 작성
- [X] T007 [P] `src/types/index.ts`의 기존 도메인 계약(`BookMeta`, `ReadingLocation`, `BookmarkItem`, `ViewerSettings`)을 손상 없이 유지하면서 `WebDavConnection` 선택 메타 필드(`rememberPassword?: boolean`, `credentialScope?: 'session' | 'native-secure' | 'web-acknowledged'`)와 `TrustedRemoteHostConsent`(`hostKey`, `allowPrivateNetwork`, `allowSelfSignedTls`, `consentedAt`), `PlatformCapabilities`, `PerformanceMetricSample`, `PerformanceBaselineReport`(`capturedAt`, `environment`, `seededBookCount`, `warmupRuns`, `measuredRuns`, `metrics`) 타입을 `src/types/index.ts`에 추가
- [X] T008 테스트 하네스 부트스트랩 스모크 테스트(`npm test` 30초 이내 실행 및 `mockIPC` 동작 확인)를 `tests/unit/harness.smoke.spec.ts`에 작성하고 통과 확인

**Checkpoint**: `npm test`와 테스트 픽스처 기반이 동작하므로 이제 `US1` 특성화 안전망 구축에 착수할 수 있다.

---

## Phase 3: User Story 1 - 기존 핵심 동작 보존을 위한 자동화 검증 안전망 구축 (Priority: P1) 🎯 MVP

**Goal**: 리팩토링 착수 전에 현재 도서 파싱·검색·위치 보존·동기화 병합·스토리지/네트워크 어댑터·브라우저 레이아웃·런타임 성능 기준선을 1·2계층 자동화 테스트로 고정한다.

**Independent Test**: 리팩토링으로 프로덕션 코드를 구조 변경하기 전에 `npm test`(30초 이내)와 `npm run test:e2e`, `npm run test:perf -- --save-baseline`을 실행해 모든 기존 핵심 동작 특성화 테스트가 100% 결정적으로 통과하고 성능 기준선 JSON이 기록됨을 확인한다.

### 1계층 단위·경계 특성화 테스트 (Tier 1)

- [X] T009 [P] [US1] `detectAndDecodeText`, `parseTxtDocument`, `paginateTxtDocument`, `searchTxtDocument`, `parseOffsetLocator` 특성화 테스트(`ReadingLocation.percentage` 범위 `0~100` 불변식 포함)를 `tests/unit/txtEngine.spec.ts`에 작성
- [X] T010 [P] [US1] `getOrCreateDeviceId`, `mergeReadingPositions`(`remote.updatedAt > local.updatedAt` 우선 규칙 검증), `mergeBookmarks`(중복 `id` 금지 및 병합 정렬 검증), `synchronizeReadingData` 로컬 허브/원격 병합 특성화 테스트를 `tests/unit/syncService.spec.ts`에 작성
- [X] T011 [P] [US1] `ViewerSettings`(`viewMode` `'scroll' | 'paginated'`, `theme` `'light' | 'dark' | 'sepia'`, `fontSize` `12~32`, `lineHeight` `1.2~2.4`, `pageMargin` `16~64` 범위 클램핑) 및 `useSettingsStore` 테마 클래스 적용 테스트를 `tests/unit/useSettingsStore.spec.ts`에 작성
- [X] T012 [P] [US1] `useBookStore` 도서 추가·열람·삭제·책갈피(`BookMeta` `format` `'txt' | 'epub'`, `fileSize >= 0`, `BookmarkItem` 중복 `id` 금지) 특성화 테스트를 `tests/unit/useBookStore.spec.ts`에 작성
- [X] T013 [P] [US1] `mockIPC` 기반 `PlatformStorageAdapter`(`isTauriEnv`, `isDesktopApp`, `sanitizeFileName`, `getStorageDir`, `setStorageDir`, `saveBookFile`, `loadBookBinary`, `removeBookBinary`, `setItem`, `getItem`) 데스크톱/모바일/웹 경계 특성화 테스트 및 `initLibrary`/`prepareBookFiles` IPC 호출 횟수 상한 회귀 방지 검증을 `tests/unit/platformAdapter.spec.ts`에 작성
- [X] T014 [P] [US1] `extractEpubMetadata`, `inferBookFormat`, `extractFilenameFromUrl`, `buildWebDavTargetUrl`, `loadWebDavHistory`/`saveWebDavConnection` 현재 동작 특성화 테스트를 `tests/unit/mediaAndNetworkBaseline.spec.ts`에 작성

### 2계층 실제 브라우저 렌더링·보안·성능 기준선 (Tier 2)

- [X] T015 [P] [US1] `TxtPageMeasurer` 실제 CSS 줄바꿈 측정 페이지네이션, `scroll` ↔ `paginated` 전환 전후 독서 위치 보존, `light`/`dark`/`sepia` 테마 및 글꼴 전환 특성화 테스트를 `tests/e2e/reader-txt.spec.ts`에 작성
- [X] T016 [P] [US1] `EpubViewerEngine` 로컬 EPUB 열람, 목차/본문 탐색, 본문 탭/텍스트 선택 상호작용 및 기본 `<script>`/`on*`/`javascript:` 삽입 차단 특성화 테스트를 `tests/e2e/reader-epub.spec.ts`에 작성
- [X] T017 [P] [US1] `LibraryView` 도서 파일 업로드·샘플 도서 추가·검색·책갈피 생성·로컬 파일 삭제 흐름 특성화 테스트를 `tests/e2e/library-flow.spec.ts`에 작성
- [X] T018 [US1] Playwright 웹 DOM·레이아웃 범위에서 고정 `50`권 메타데이터 시드(`library_init_ms`)와 1MB+ TXT 픽스처 기반으로 워밍업 `2`회 제외 `7`회 반복 측정 중앙값(`medianMs`, `samplesMs`)을 산출해 `PerformanceBaselineReport`(`environment`, `seededBookCount`, `library_init_ms`, `large_txt_open_ms`, `view_mode_toggle_ms`, `theme_switch_ms`)를 기록하고 동일 환경 검증 및 회귀 식(`deltaMs > 15 && ratio > 0.10`)을 판정하는 `tests/perf/baseline.spec.ts` 및 `scripts/run-perf-gate.mjs` 작성
- [X] T019 [US1] `npm test`(30초 이내 완료 확인), `npm run build && npm run test:e2e`, `npm run test:perf -- --save-baseline`을 실행해 동일 환경 기준선(`specs/001-constitution-compliance-refactoring/perf-baseline.json`)을 확보

**Checkpoint**: User Story 1(MVP) 완료 — 1·2계층 자동화 특성화 안전망과 리팩토링 전 성능 기준선이 고정되어 구조 리팩토링을 안전하게 진행할 수 있다.

---

## Phase 4: User Story 2 - 플랫폼 종속 호출의 단일 추상화 경계 통합 (Priority: P2)

**Goal**: `LibraryView.vue`와 `useBookStore.ts`의 직접 `@tauri-apps/*` 호출을 `src/services/platform/` 추상화 경계로 이전해 데스크톱·모바일·웹 일관성과 격리 테스트 가능성을 확보한다(`FR-004`, `FR-005`).

**Independent Test**: `src/services/platform/` 포트 계약을 `mockIPC` 및 웹 DOM 폴백 테스트 대역으로 검증한 뒤, `LibraryView.vue`와 `useBookStore.ts`가 추상화 경계만 호출하도록 전환하고 `US1` 전체 특성화 테스트 및 경계 직접 호출 0건 검사를 통과하는지 확인한다.

### Tests for User Story 2 (TDD Red 단계 — 구현 전 실패 테스트 작성) ⚠️

> **NOTE**: 아래 테스트를 먼저 작성해 실패(Red)를 확인한 뒤 포트 구현체를 작성한다.

- [X] T020 [P] [US2] `PlatformDialogPort`(`pickBookFiles` 반환형 `{ files, cancelled }`, `pickStorageDirectory` 미지원 시 `null` 반환, `confirmAction` 취소 시 `false` 반환) 데스크톱/모바일/웹 계약 테스트를 `tests/unit/platformDialogService.spec.ts`에 작성
- [X] T021 [P] [US2] `PlatformPathPort`(`dirname`, `basename` Windows `\` 및 POSIX `/` 구분자 정규화, 비Tauri 폴백) 계약 테스트를 `tests/unit/platformPathService.spec.ts`에 작성
- [X] T022 [P] [US2] `PlatformDragDropPort`(`subscribe`의 `onDragStateChange`, `onFilesDropped`, `onError`, cleanup 해제 함수 반환 및 Tauri Webview `onDragDropEvent`/`plugin-fs` + 브라우저 `DataTransfer` 분기) 계약 테스트를 `tests/unit/platformDragDropService.spec.ts`에 작성
- [X] T023 [P] [US2] `LibraryView.vue` 컴포넌트 마운트 시 파일 가져오기, 저장 폴더 변경, 삭제 확인, 드래그앤드롭에서 `@tauri-apps/*` 직접 호출 없이 추상화 포트를 경유하는 통합 단위 테스트를 `tests/unit/libraryViewPlatformBoundary.spec.ts`에 작성

### Implementation for User Story 2 (TDD Green → Refactor)

- [X] T024 [P] [US2] `PlatformDialogPort`(`SelectedBookFile`의 `name`, `size`, `sourcePath`, 지연 `readBuffer(): Promise<ArrayBuffer>` 반환형 포함) 인터페이스와 Tauri `plugin-dialog`/웹 `<input type="file">`·`confirm` 폴백 구현체를 `src/services/platform/dialogService.ts`에 작성
- [X] T025 [P] [US2] `PlatformPathPort` 인터페이스와 Tauri `@tauri-apps/api/path`/순수 문자열 경로 폴백 구현체를 `src/services/platform/pathService.ts`에 작성
- [X] T026 [P] [US2] `PlatformDragDropPort` 인터페이스와 Tauri Webview `onDragDropEvent`+파일 크기 상한 검증 읽기(`allow_storage_dir` 외부 드래그앤드롭 일시 스코프 테스트 또는 Rust 검증 읽기 커맨드 경유)/HTML5 `DataTransfer` 통합 구독 구현체를 `src/services/platform/dragDropService.ts`에 작성
- [X] T027 [US2] `src/services/platform/dialogService.ts`, `pathService.ts`, `dragDropService.ts`, `src/services/storage/platformAdapter.ts`와 `PlatformCapabilities` 조회 헬퍼를 통합 export하는 `src/services/platform/index.ts` 작성
- [X] T028 [US2] `src/stores/useBookStore.ts`의 직접 `@tauri-apps/api/path`(`dirname`) 동적 import를 `PlatformPathPort.dirname` 호출로 교체하고 비정상 경로/폴더 해제 시 복구 가능 상태를 유지하도록 예외 처리 보강
- [X] T029 [US2] `src/views/LibraryView.vue`의 직접 `@tauri-apps/plugin-dialog`(`open`, `ask`), `@tauri-apps/api/webview`(`getCurrentWebview`), `@tauri-apps/plugin-fs`(`readFile`) 호출을 `PlatformDialogPort`(`readBuffer()` 순차 처리) 및 `PlatformDragDropPort` 호출로 교체하고 허용 크기 상한 초과·미지원 확장자·손상 파일·대화상자 취소 시 기존 서재 데이터 보존 확인
- [X] T030 [US2] `npm test` 및 `npm run test:e2e`를 실행해 `tests/unit/platform*.spec.ts`, `tests/unit/libraryViewPlatformBoundary.spec.ts` 및 `US1` 전체 특성화 테스트 통과 확인 (`src/views/ReaderView.vue`·`src/stores/useSettingsStore.ts` 표준 DOM 제어는 `FR-005` 예외 유지 확인)

**Checkpoint**: User Story 2 1차 추상화 완료 — 상위 뷰·스토어의 직접 `@tauri-apps/*` 호출은 제거되었으나, 단일 드롭 모델(`T063`) 및 `tauri-plugin-opener` 폴더 열기 전환(`T066`)은 Phase 8에서 최종 수렴한다.

---

## Phase 5: User Story 3 - 포괄 보안 정책 및 네트워크·콘텐츠 격리 강화 (Priority: P3)

**Goal**: 앱 CSP 활성화·외부 폰트 CDN 제거, EPUB 다중 격리 보강, Tauri Capability 플랫폼 분리, `/__remote_proxy` SSRF/Origin/Redirect/TLS 방어, WebDAV `v1 -> v2` 자격증명 안전 마이그레이션 및 명시적 NAS/TLS 동의 흐름을 구축한다(`FR-007`~`FR-010`).

**Independent Test**: 강화된 CSP·EPUB 격리·프록시 SSRF/TLS/Origin 검증·자격증명 분리를 적용한 상태에서 정상 도서 열람/테마 변경/승인된 원격·사설 NAS 다운로드/동기화는 100% 통과하고, 악성 스크립트·고위험 내부 IP(`127.0.0.1`, `169.254.169.254`, `::1`, `::ffff:169.254.169.254`)·리다이렉트 내부 전환·타 출처 프록시·미승인 자체 서명 TLS는 100% 차단됨을 확인한다.

### Tests for User Story 3 (TDD Red 단계 — 보안·마이그레이션 실패 테스트 먼저 작성) ⚠️

> **NOTE**: 모든 보안 방어와 마이그레이션 구현 전에 실패하는 테스트를 먼저 작성한다.

- [X] T031 [P] [US3] 순수 URL·IP·CIDR 분류(`0.0.0.0/8`, `127.0.0.0/8`, `169.254.0.0/16`, `::/128`, `::1/128`, `fe80::/10`, `::ffff:0:0/96` 추출 IPv4 무조건 차단 및 RFC 1918·`fc00::/7`·`.local` `allowPrivateNetwork` 조건부 허용)와 Node DNS Pinning(DNS Rebinding TOCTOU 방지 `lookup` 고정) 단위 테스트를 `tests/unit/ssrfGuard.spec.ts`에 작성
- [X] T032 [P] [US3] `/__remote_proxy` 미들웨어의 Fail-Closed 동일 출처(`Origin`/`Referer`·`Sec-Fetch-Site` 누락·불일치 `403` 차단), `Access-Control-Allow-Origin: *` 미설정, 허용 메서드 화이트리스트(`GET`/`HEAD`/`OPTIONS`/`PROPFIND`/`POST`, 기타 `405`), 요청 본문/응답 크기 상한 및 타임아웃 초과 차단, 세션 논스 없는 `x-allow-private-nas`/`x-allow-insecure-tls` 단독 우회 차단, `301/302/303/307/308` 리다이렉트 홉 재검증(최대 5회) 및 타 출처 리다이렉트 시 `Authorization` 제거, 기본 TLS 검증(`rejectUnauthorized: true`)과 `CODE: PRIVATE_NETWORK_CONFIRM_REQUIRED` / `CODE: SELF_SIGNED_TLS_CONFIRM_REQUIRED` 구조화 오류 테스트를 `tests/unit/remoteProxySecurity.spec.ts`에 작성
- [X] T033 [P] [US3] `PlatformCredentialPort`(`getPassword`, `setPassword`, `removePassword`, `migrateLegacyPlaintext`) 세션 메모리 기본 유지, Tauri OS 키체인(`mockIPC` 기반 `tauri-plugin-keyring-store`) vs 웹 한계 동의(`webStorageConsent`) 분기 및 `WebDavConnection` `v1 -> v2` 마이그레이션 시 기존 필드(`id`, `alias`, `url`, `username`, `initialPath`, `lastConnectedAt`) 무손상·평문 `password` 제거 검증 단위 테스트를 `tests/unit/credentialMigration.spec.ts`에 작성
- [X] T034 [P] [US3] `jszip` 사전 Zip Bomb(과다 엔트리/누적 비압축 크기 초과) 거부, `sanitizeSectionDocument`의 SVG `<script>`·`<foreignObject>`·`<use>`·`<animate>`·`<set>`·`xlink:href="javascript:..."`·`<base>`·CSS `@import`/`expression()`/`url(javascript:)`/`data:text/html`/`data:image/svg+xml`·`<meta http-equiv="refresh">` 제거 및 `hooks.content` `<base>` 처리 순서와 강화된 `CONTENT_CSP`(`base-uri 'none'`) 간 양립 검증 단위 테스트를 `tests/unit/epubSanitizer.spec.ts`에 작성
- [X] T035 [P] [US3] 순수 Rust 경로 검증(`validate_storage_dir_path`), 드래그앤드롭 경계 확인 및 `safe_remote_fetch` URL/DNS/IP 검증·리다이렉트 차단·응답 상한·TLS 예외 플래그 헬퍼에 대한 `cargo test` 단위 테스트를 `src-tauri/src/lib.rs`(`#[cfg(test)] mod tests`)에 작성 *(Rust `cargo check && cargo test` 5/5 통과 완료)*
- [X] T036 [P] [US3] 실제 브라우저(`src-tauri/tauri.conf.json`의 `app.security.csp`를 HTTP `Content-Security-Policy` 헤더로 주입한 preview, Chromium+WebKit) 환경에서 악성 EPUB 스크립트/이벤트 핸들러/`@import`/SVG/Zip Bomb/외부 폰트·리소스 요청 차단과 다중 챕터 내부 CSS·이미지·SVG(`<base>`/`CONTENT_CSP` 정합)·본문 탭·텍스트 선택·테마(`light`/`dark`/`sepia`) 유지, `/__remote_proxy` 타 출처/DoS/SSRF 차단을 검증하는 E2E 보안 테스트를 `tests/e2e/security-csp-proxy.spec.ts`에 작성

### Implementation for User Story 3 (TDD Green → Refactor)

- [X] T037 [P] [US3] `index.html`에서 외부 Google Fonts `<link>` 태그(L11-13)를 제거하고, `src/assets/main.css` 및 `src/engines/epub/epubEngine.ts`의 폰트 스택을 로컬/OS 기본 글꼴 스택(CSP 외부 폰트 예외 0건)으로 정리
- [X] T038 [P] [US3] `src-tauri/tauri.conf.json`의 `"csp": null`을 `contracts/security-policy.md`에 정의된 명시적 CSP 객체(`default-src`, `script-src: 'self'`, `style-src: 'self' 'unsafe-inline' blob:`, `img-src`, `font-src: 'self' data: blob:`, `frame-src`/`child-src`, `connect-src`, `object-src: 'none'`, `base-uri: 'self'`)로 교체
- [X] T039 [P] [US3] `src-tauri/capabilities/default.json`(공통+모바일 `$APPDATA/books/**` 한정 `fs:allow-{exists,read-file,write-file,mkdir,remove}`, `keyring-store:default` 유지 및 광범위 `fs:allow-appdata-read-recursive`·`fs:allow-appdata-write-recursive`·와일드카드 `http:default` 제거)과 신규 `src-tauri/capabilities/desktop.json`(`"platforms": ["linux", "macOS", "windows"]`, 데스크톱용 `fs:allow-{exists,stat,read-file,write-file,mkdir,rename,remove}`)을 분리해 모바일 빌드에 임의 파일 읽기 및 WebView 직접 HTTP fetch 권한이 포함되지 않도록 최소 권한 스코프 적용
- [X] T040 [P] [US3] `src-tauri/Cargo.toml`의 직접 WebView `tauri-plugin-http` 의존을 `reqwest` + `tauri-plugin-keyring-store`로 정비하고(WebView `plugin:http|fetch` 우회 경로 제거), `src-tauri/src/lib.rs`에 `tauri_plugin_keyring_store::init()`, 순수 Rust `validate_storage_dir_path`, DNS Pinning·`redirect::Policy::none()`·응답 크기 상한·명시적 TLS 예외 플래그를 강제하는 `safe_remote_fetch` 통합 커맨드(및 드래그앤드롭 검증 읽기 커맨드 `read_validated_book_file`) 구현 *(`reqwest 0.13` 전환 및 `cargo check && cargo test` 5/5 통과 완료)*
- [X] T041 [P] [US3] `src/engines/epub/epubEngine.ts`에서 `ePub(buffer)`/`locations.generate(150)` 전에 `jszip` 엔트리 수·누적 압축 해제 크기 상한(Zip Bomb)을 검증하고, `CONTENT_CSP`를 `default-src 'none'; script-src 'none'; object-src 'none'; frame-src 'none'; child-src 'none'; worker-src 'none'; form-action 'none'; base-uri 'none'; connect-src 'none'; style-src 'self' 'unsafe-inline' blob: data:; img-src 'self' blob: data:; font-src 'self' blob: data:`로 강화하며 `hooks.content`의 `<base>` 처리 순서 정합성 유지 및 `sanitizeSectionDocument`에서 SVG `<script>`/`<foreignObject>`/`<use>`/`<animate>`/`<set>`·`xlink:href`·`<base>`·CSS `@import`/`expression()`/`url(...)` 위험 스킴·`data:image/svg+xml`을 제거
- [X] T042 [US3] `node:*` 의존성 없는 브라우저/Node 공용 순수 URL 정규화·IP 리터럴·CIDR 판별·사설망(`RFC 1918`/`fc00::/7`/`.local`) vs 고위험 내부 주소 분류 모듈을 `src/services/network/ssrfValidator.ts`에 작성 (`T031` 분류 파트 통과)
- [X] T043 [US3] DNS 해석 검증 및 소켓 IP Pinning(커스텀 `lookup` 콜백으로 `Host`·TLS `servername` SNI 유지하며 DNS Rebinding 차단)을 수행하는 Node 전용 `scripts/remoteProxyGuard.mjs`를 작성하고 `vite.config.ts`의 `easyViewerRemoteProxyPlugin()`(`/__remote_proxy`)에 연동해 Fail-Closed `Origin`/`Referer`·`Sec-Fetch-Site` 검증, `Access-Control-Allow-Origin: *` 제거, 허용 메서드 화이트리스트·요청 본문(`1 MiB`)/응답(`256 MiB`) 상한·타임아웃 강제, 서버 세션 논스(`X-Proxy-Session-Token`) 기반 `x-allow-*` 게이트, 리다이렉트 홉 재검증(최대 5회) 및 교차 출처 시 `Authorization` 제거, `rejectUnauthorized: true` 기본 강제, `PRIVATE_NETWORK_CONFIRM_REQUIRED`/`SELF_SIGNED_TLS_CONFIRM_REQUIRED` 구조화 오류 응답 구현 (`T031`·`T032` 통과)
- [X] T044 [P] [US3] `PlatformCredentialPort`와 세션 메모리 `Map<connectionId, string>`, 네이티브 OS 키체인(`tauri-plugin-keyring-store-api` — 프론트엔드 자체 키/평문 JSON 저장 금지), 웹 한계 동의 분리, `migrateLegacyPlaintext`를 구현하는 `src/services/platform/credentialService.ts` 작성 및 `src/services/platform/index.ts`에 export 추가 (`T033` 통과)
- [X] T045 [US3] `TrustedRemoteHostConsent` 저장/조회, Tauri 네이티브 요청 시 Rust `safe_remote_fetch` 통합 커맨드 호출(단일 요청별 `allowPrivateNas`/`allowSelfSignedTls` 전달, 응답 크기 상한 적용), 웹 요청 시 `/__remote_proxy` 보안 헤더·세션 논스 연계를 담당하는 통합 원격 요청 헬퍼를 `src/services/network/remoteFetch.ts`에 작성
- [X] T046 [US3] `src/services/network/downloadService.ts`, `src/services/network/webdavService.ts`, `src/services/sync/syncService.ts`의 네트워크 요청을 `src/services/network/remoteFetch.ts` 경유로 통합하고(특히 `syncService.ts` 직접 `fetch` 제거 및 `webdavService.ts` 무분별한 프록시 폴백 제거, WebDAV `PROPFIND` `href` `..` 경로 탐색·제어문자 거부 및 다운로드 파일 크기 상한 강제), `loadWebDavHistory()`/`saveWebDavConnection()`에 `v1 -> v2` 평문 비밀번호 제거 마이그레이션과 `PlatformCredentialPort` 연동 적용
- [X] T047 [US3] `src/components/library/NetworkDownloadModal.vue`에 "비밀번호 기억" 체크박스(기본 해제, 웹 환경 한계 안내 동의 모달/프롬프트)와 사설망 NAS(`PRIVATE_NETWORK_CONFIRM_REQUIRED`) 및 자체 서명 TLS 인증서(`SELF_SIGNED_TLS_CONFIRM_REQUIRED`) 명시적 사용자 확인·동의(`TrustedRemoteHostConsent`) 흐름을 UI(`light`/`dark`/`sepia` 테마 호환)로 통합
- [X] T048 [US3] `npm test` 및 `npm run build && npm run test:e2e`를 실행해 `tests/unit/{ssrfGuard,remoteProxySecurity,credentialMigration,epubSanitizer}.spec.ts` 및 `tests/e2e/security-csp-proxy.spec.ts` 통과 확인 *(Vitest 19파일 60/60, Playwright E2E 10/10, Rust `cargo check && cargo test` 5/5 모두 통과 완료)*

**Checkpoint**: User Story 3 프론트엔드 핵심 구현 완료 — 단, CSP `connect-src` 축소(`T064`), 프록시/동기화 수렴(`T060`~`T062`), Rust `reqwest 0.13`·Zero-Trust IPC 화이트리스트 검증(`T035`, `T040`, `T048`, `T059`, `T065`, `T067`)은 Phase 8에서 최종 수렴한다.

---

## Phase 6: User Story 4 - 구현 무결성 점검 및 품질·거버넌스 게이트 정착 (Priority: P4)

**Goal**: 플랫폼 경계 우회 탐지, 버전 일치 점검, 커밋 메시지 형식 검증, 리서치·무결성 검토 체크리스트, 성능 회귀 검증을 자동화된 상시 품질 게이트(`npm run verify`)로 정착시킨다(`FR-011`, `FR-012`, `SC-005`, `SC-006`).

**Independent Test**: `npm run check:boundaries`, `npm run check:version`, `npm run check:commit-msg`, `npm run verify`를 정상 코드베이스 및 의도적으로 주입한 위반 사례(직접 `@tauri-apps/*` 호출, 버전 불일치, 영어-only 또는 본문 누락 커밋 메시지)로 실행해 정상 통과와 위반 탐지율 100%를 검증한다.

### Tests for User Story 4 (품질 게이트 긍정/부정 테스트 먼저 작성) ⚠️

- [X] T049 [P] [US4] `check-boundaries.mjs`의 위반 탐지(`src/views/`, `src/stores/`, `src/components/`, `src/engines/`, `src/services/sync/` 내 직접 `@tauri-apps/`, `localStorage`, `indexedDB`·비승인 `fetch`/`XMLHttpRequest` 탐지 vs `src/services/{platform,storage,network}/`·`tests/`·로컬 `blob:` 허용 및 `engines -> views/stores/services` 역의존 탐지) 단위 테스트를 `tests/unit/checkBoundaries.spec.ts`에 작성
- [X] T050 [P] [US4] `check-version-sync.mjs` 및 `check-commit-msg.mjs`(Conventional Commits 접두사 + 한글 요약 + 빈 줄 + 20자 이상 한국어 본문 vs Merge/Revert 예외 vs 의도적 위반 사례 실패 판정) 단위 테스트를 `tests/unit/governanceScripts.spec.ts`에 작성

### Implementation for User Story 4

- [X] T051 [P] [US4] `src/views`, `src/stores`, `src/components`, `src/engines`, `src/services/sync`에서 직접 `@tauri-apps/`, `localStorage`, `indexedDB`, 비승인 직접 네트워크 `fetch`/`XMLHttpRequest` 참조(`blob:` 제외) 및 `src/engines/`의 상위 계층 역의존을 탐지해 위반 파일·줄 번호 출력 후 exit `1`을 반환하는 `scripts/check-boundaries.mjs` 작성
- [X] T052 [P] [US4] `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json` 세 파일의 버전 문자열(`0.1.5`) 일치 여부를 검증하는 `scripts/check-version-sync.mjs` 작성
- [X] T053 [P] [US4] Git 커밋 메시지 파일 또는 인자에 대해 헤더 패턴(`^(feat|fix|docs|style|refactor|perf|test|build|ci|chore)(\([a-z0-9-]+\))?!?: .{4,}$`), 한글 포함, 둘째 줄 빈 줄, 20자 이상 한국어 본문(`Merge `/`Revert ` 예외 허용)을 검증하는 `scripts/check-commit-msg.mjs` 작성
- [X] T054 [US4] `package.json`의 `verify` 스크립트를 `npm run build && npm test && npm run check:boundaries && npm run check:version` 및 `cargo check && cargo test`로 연결하고, `cargo` 부재 시 기본 종료 코드 **`2` (`BLOCKED`)** 를 반환하며 프론트엔드 전용 확인 시 `--frontend-only` 플래그 명시하에 `BLOCKED` 경고 출력 후 `0`을 반환하는 `scripts/verify.mjs` 작성
- [X] T055 [US4] 전체 프로덕션 소스(`src/`, `src-tauri/src/`)에서 미구현 `TODO`/`FIXME`/테스트 전용 우회 분기·중복 `fetch` 잔존 여부를 점검·정리하고, 리서치 근거 및 무결성 검토 체크리스트를 `specs/001-constitution-compliance-refactoring/checklists/governance.md`에 정착

**Checkpoint**: User Story 4 자동화 도구(`check:boundaries`, `check:version`, `check:commit-msg`, `verify.mjs`) 구축 완료 — 전체 통합 게이트 최종 완료 처리는 Phase 8(`T058`, `T059`~`T067`) 수렴 이후 확정한다.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 전체 스토리를 아우르는 최종 회귀·성능·문서 정합성 검증을 수행한다.

- [X] T056 [P] [specs/001-constitution-compliance-refactoring/quickstart.md](./quickstart.md)의 시나리오 A~D 명령과 실제 추가된 `package.json` 스크립트 일치 여부 확인 및 보완
- [X] T057 리팩토링 후 `npm run build && npm run test:e2e && npm run test:perf` 실행으로 `tests/e2e/*.spec.ts` 전체 시나리오 무회귀 및 Playwright 웹 DOM·레이아웃 범위의 동일 `environment` 기준선(`specs/001-constitution-compliance-refactoring/perf-baseline.json`) 대비 `tests/perf/baseline.spec.ts` 성능 회귀 0건(`deltaMs > 15 && ratio > 0.10` 미초과)과 `mockIPC` IPC 호출 횟수 상한 통과 검증
- [X] T058 `scripts/verify.mjs`(`npm run verify`) 최종 실행(종료 코드 `0` — 프론트엔드 빌드·Vitest 60/60·경계·버전 동기화 + Rust `cargo check && cargo test` 5/5 통과), `scripts/check-commit-msg.mjs` 샘플 검증 완료 *(모바일 실기기·크로스 타겟/서명 수동 검증은 `T059`에서 추적)*

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 선행 조건 없음 — 즉시 시작 가능
- **Phase 2 (Foundational)**: Phase 1 완료에 의존 — 모든 User Story를 차단(Blocking)
- **Phase 3 (User Story 1 — P1, MVP)**: Phase 2 완료에 의존 — **구조 리팩토링(`US2`, `US3`) 전에 특성화 안전망과 성능 기준선을 반드시 먼저 완성** (`FR-003`, `FR-012`)
- **Phase 4 (User Story 2 — P2)**: Phase 3 (`US1`) 완료에 의존 (특성화 테스트와 성능 기준선 확보 후 플랫폼 추상화 이관 착수)
- **Phase 5 (User Story 3 — P3)**: Phase 3 (`US1`) 완료에 의존; `US2`와 코드 영역(네트워크·보안·설정·Rust)이 대부분 분리되어 있으나 `src/services/platform/index.ts` 공유 지점 때문에 `US2` 이후 순차 또는 `T027` 완료 후 병렬 진행 권장
- **Phase 6 (User Story 4 — P4)**: `check-boundaries` 최종 통과 게이트는 `US2`·`US3` 완료 이후 검증되나, 스크립트와 단위 테스트(`T049`~`T054`) 자체는 Phase 2 이후 병렬 개발 가능
- **Phase 7 (Polish)**: 원하는 모든 User Story 완료 후 최종 통합 검증 수행

### User Story Dependencies

- **User Story 1 (P1)**: Foundational(Phase 2) 완료 후 단독 진행 가능 — 다른 스토리 의존성 없음
- **User Story 2 (P2)**: `US1` 특성화 안전망 완료 후 단독 구현·검증 가능
- **User Story 3 (P3)**: `US1` 완료 및 `src/services/platform/index.ts`(`T027`) 확정 후 독립 구현·검증 가능 (단, `NetworkDownloadModal.vue`, `vite.config.ts`, `src-tauri/` 중심이므로 `US2` 뷰/스토어 이관과 충돌 최소화)
- **User Story 4 (P4)**: `scripts/` 및 `tests/unit/` 게이트 도구는 독립 구현 가능하며, 최종 `npm run verify` 무오류 통과는 `US2`·`US3` 완료 시점에 달성

### Parallel Opportunities

- **Setup (Phase 1)**: `T002`, `T003`, `T004` 병렬 실행 가능 (`T001` 이후)
- **Foundational (Phase 2)**: `T006`, `T007` 병렬 실행 가능
- **User Story 1 (Phase 3)**: 1계층 특성화 테스트 `T009`~`T014` 전체 병렬 작성 가능; 2계층 브라우저 테스트 `T015`~`T017` 병렬 작성 가능
- **User Story 2 (Phase 4)**: 계약 테스트 `T020`~`T023` 병렬 작성 가능; 포트 구현체 `T024`~`T026` 병렬 작성 가능
- **User Story 3 (Phase 5)**: 실패 테스트 `T031`~`T036` 병렬 작성 가능; 구현 태스크 중 `T037`(폰트/HTML), `T038`(CSP), `T039`(Capabilities), `T040`(Rust), `T041`(EPUB sanitizer), `T044`(자격증명 포트) 병렬 진행 가능
- **User Story 4 (Phase 6)**: 게이트 테스트 `T049`~`T050` 및 스크립트 `T051`~`T053` 병렬 진행 가능

---

## Parallel Example: User Story 1 & User Story 2

```bash
# User Story 1: 1계층 특성화 테스트 동시 작성 (T009~T014)
Task: "T009 [P] [US1] TXT 엔진 특성화 테스트 in tests/unit/txtEngine.spec.ts"
Task: "T010 [P] [US1] 동기화 병합 특성화 테스트 in tests/unit/syncService.spec.ts"
Task: "T011 [P] [US1] 설정 스토어 특성화 테스트 in tests/unit/useSettingsStore.spec.ts"
Task: "T012 [P] [US1] 도서 스토어 특성화 테스트 in tests/unit/useBookStore.spec.ts"
Task: "T013 [P] [US1] mockIPC 플랫폼 어댑터 특성화 테스트 in tests/unit/platformAdapter.spec.ts"
Task: "T014 [P] [US1] EPUB 메타·다운로드·WebDAV 기준 테스트 in tests/unit/mediaAndNetworkBaseline.spec.ts"

# User Story 2: 플랫폼 포트 구현체 동시 작성 (T024~T026)
Task: "T024 [P] [US2] PlatformDialogPort 구현 in src/services/platform/dialogService.ts"
Task: "T025 [P] [US2] PlatformPathPort 구현 in src/services/platform/pathService.ts"
Task: "T026 [P] [US2] PlatformDragDropPort 구현 in src/services/platform/dragDropService.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1(Setup) 및 Phase 2(Foundational) 완료 → `npm test` 및 테스트 픽스처 동작 확인
2. Phase 3(User Story 1) 완료 → `tests/unit/*.spec.ts` + `tests/e2e/*.spec.ts` + `perf-baseline.json` 확보
3. **STOP and VALIDATE**: `npm test`(<=30s), `npm run test:e2e`, `npm run test:perf -- --save-baseline` 단독 통과 검증

### Incremental Delivery

1. Setup + Foundational → 테스트 인프라 준비 완료
2. **User Story 1(MVP)** 추가 → 기존 동작 회귀 방지 안전망 & 성능 기준선 고정
3. **User Story 2** 추가 → `LibraryView.vue`·`useBookStore.ts` 플랫폼 경계 통합 & `check-boundaries` 기반 정합성 확보
4. **User Story 3** 추가 → CSP·Capability·EPUB 격리·SSRF/TLS 방어·WebDAV `v1 -> v2` 자격증명 보안 완료
5. **User Story 4** + Polish → 자동화 품질 게이트(`npm run verify`, 커밋 검증, 성능 무회귀 검증) 영구 정착

---

## Notes

- `[P]` 태스크는 서로 다른 파일을 수정하며 선행 의존성이 없는 항목에만 부여했습니다.
- `[US1]`~`[US4]` 라벨은 [spec.md](./spec.md)의 각 사용자 스토리와 1:1 추적 가능하도록 매핑했습니다.
- 현재 로컬 작업 환경에는 `cargo`/`rustc`가 미설치되어 있으므로, `T035`, `T040`, `T048`, `T054`, `T058`, `T059`, `T065`~`T067`의 Rust 검증(`cargo check && cargo test`)은 로컬 미설치 환경에서 **통과로 간주하지 않고 `BLOCKED` 상태로 구분 기록**하며 CI(`rustc >= 1.90.0`) 또는 Rust 툴체인 보유 호스트에서 최종 완료해야 합니다.
- 모든 테스트 대역(`mockIPC`, FS/HTTP/스토리지 스텁)은 `tests/` 내부에서만 사용하며, 프로덕션 코드(`src/`, `src-tauri/src/`)에는 테스트 통과용 우회 분기나 하드코딩을 허용하지 않습니다.


---

## Phase 8: Convergence

**Purpose**: `/speckit-converge` 및 `/speckit-analyze` 감사에서 식별된 잔여 미검증 게이트(`BLOCKED` Rust/모바일 검증), 누락된 보안 프록시/동기화 테스트 및 에지 케이스 결함, CSP·드래그앤드롭 설정 불일치, SSRF 검증기 3자 동등성, macOS 라이브러리 최신화·Zero-Trust IPC 화이트리스트·바이너리 응답 경계를 수렴한다. (`T060`~`T067` 완료 후 최종 게이트 `T059` 실행)

- [X] T060 [P] [US3] `scripts/remoteProxyGuard.mjs` 및 `vite.config.ts`(`easyViewerRemoteProxyPlugin`) 동등성 경로에 전체 요청·스트림 수명 총합 타임아웃(deadline/`timeoutMs` 클라이언트 헤더 상한 클램핑 및 `maxResponseBytes` 클램핑 포함)을 보강하고 `tests/unit/remoteProxySecurity.spec.ts`에 `/redirect-loopback`(`403`), `/redirect-cross-origin`(`Authorization`/`Cookie` 제거), 5홉 초과(`508 TOO_MANY_REDIRECTS`), `maxResponseBodyBytes` 초과(`413 RESPONSE_TOO_LARGE`), `timeoutMs` 초과(`504 TIMEOUT`), 자체 서명 HTTPS 기본 거부(`SELF_SIGNED_TLS_CONFIRM_REQUIRED`), 세션 논스 없는 `x-allow-insecure-tls` 차단(`403 INVALID_SESSION_TOKEN`), `Referer` 동일 출처 검증 테스트를 추가·통과 확인 per `specs/001-constitution-compliance-refactoring/tasks.md` `T032` / `FR-009` / `SC-002` / `contracts/security-policy.md` §3.1
- [X] T061 [P] [US3] `scripts/remoteProxyGuard.mjs`와 `vite.config.ts`(`easyViewerRemoteProxyPlugin`)의 모든 프록시 처리 응답(업스트림 오류·리다이렉트 포함)에 `X-EasyViewer-Proxy: 1` 헤더를 부여하고 `src/services/network/remoteFetch.ts`가 프록시 헤더 존재 시 업스트림 `404`를 그대로 반환하며 프록시 미마운트 정적 호스팅에 한해 `public` URL 직접 `fetch()`만 허용하도록 수정하고 `timeoutMs`/`maxResponseBytes` 전달 및 단위 테스트를 추가 per `FR-009` / `T043` / `T045` / `T046` / `contracts/security-policy.md` §3.1
- [X] T062 [P] [US3] `src/services/sync/syncService.ts`가 일시적 오프라인·일반 서버 장애만 `local-hub`로 폴백하고 `RemoteFetchConsentError`(`BLOCKED_HIGH_RISK`, `PRIVATE_NETWORK_CONFIRM_REQUIRED`, `SELF_SIGNED_TLS_CONFIRM_REQUIRED`)는 상위로 전파하도록 수정하며, `src/components/library/SyncModal.vue`의 `handleRunSync`에 `try/catch` 오류 표시 및 `TrustedRemoteHostConsent` 승인·재시도 흐름(`light`/`dark`/`sepia` 호환)을 통합해 단위 테스트를 보강 per `FR-009` / `T046` / `T047` / `contracts/security-policy.md` §3.3 / Constitution Principle VII
- [X] T063 [P] [US2] 정설 단일 드롭 모델(Option A)에 따라 `src-tauri/tauri.conf.json`을 `"dragDropEnabled": true`로 전환하고 `src/services/platform/dragDropService.ts`가 `isTauriEnv()`일 때 HTML5 `window` `drag*`/`drop` 이중 구독 없이 `getCurrentWebview().onDragDropEvent`(`sourcePath` + `readValidatedLocalFileBuffer`)만 구독하며 웹 환경에서는 HTML5 `DataTransfer`만 구독하도록 수정하고 `tests/unit/platformDragDropService.spec.ts` 및 외부 폴더 드롭 허용/미승인 경로 거부 연동을 보강 per `FR-005` / `T026` / `contracts/platform-boundary.md` §3
- [X] T064 [P] [US3] `src-tauri/tauri.conf.json` `connect-src`를 `"'self' ipc: http://ipc.localhost blob: data:"`로 축소(와일드카드 `http: https:` 제거)해 `contracts/security-policy.md`·`tests/e2e/security-csp-proxy.spec.ts`에 루트 앱 CSP `connect-src` 차단 단언 E2E 테스트를 검증하고(Chromium+WebKit 10/10 통과), `tests/unit/ssrfGuard.spec.ts` 및 `src-tauri/src/lib.rs` `#[cfg(test)]`에 `ssrfValidator.ts`·`scripts/remoteProxyGuard.mjs`·Rust `classify_ip`/`classify_ip_str` IPv4/IPv6 CIDR·Zone ID(`fe80::1%en0`)·정수/8진 IP(`0177.0.0.1`, `2130706433`)·`::ffff:169.254.169.254` 동일 입력 벡터 3자 동등성 교차 테스트를 추가·통과 확인 per `FR-007` / `FR-009` / `contracts/security-policy.md` §1
- [X] T065 [P] [US3] `src-tauri/Cargo.toml`·`Cargo.lock`·`src-tauri/src/lib.rs`의 `reqwest`를 `0.13`(기본 `rustls` + `rustls-platform-verifier`, MSRV `1.85.0`) 단일 스택으로 전환해 macOS 키체인 CA 신뢰 및 리다이렉트 루프 밖 클라이언트 재사용 최적화를 적용하고, 5-OS 호환을 위해 `tauri-plugin-keyring-store 0.3.2`를 유지한 채 JS `@tauri-apps/{api,cli} ^2.12.x`·공식 플러그인 `2.x`(MSRV `1.90.0`) 버전 정합을 `package.json`·`Cargo.toml`·`Cargo.lock`에 반영 per `FR-009` / `plan.md` / `research.md` §4
- [X] T066 [P] [US2] `src-tauri/src/lib.rs`의 `Command::new("open")` 커스텀 `open_folder`를 제거하고 공식 `tauri-plugin-opener`(`src-tauri/Cargo.toml`, `lib.rs` init, `package.json` `@tauri-apps/plugin-opener`)와 `capabilities/desktop.json`의 스코프 제한 `opener:allow-open-path`로 전환하며 `src/services/storage/platformAdapter.ts` `openStorageDir`(`allow_storage_dir` 사전 검증 + `openPath`)을 이관하고 `platformAdapter.spec.ts` 및 macOS 배포 형태(비샌드박스 `.dmg` vs App Sandbox + `tauri-plugin-persisted-scope`·entitlements)를 반영 per `FR-004` / `FR-005` / `contracts/security-policy.md` §2
- [X] T067 [P] [US3] `src-tauri/src/lib.rs`의 `read_validated_book_file`을 `#[cfg(desktop)]` 전용 및 `tauri::ipc::Response` 바이너리 반환(`dialogService.ts` 동등 수신)으로 전환하고, `allow_storage_dir`(최장 기존 조상 `canonicalize()` -> 민감 경로/심볼릭 링크 차단 -> `create_dir_all` -> 재검증 및 `Mutex<HashSet<PathBuf>>` 등록)과 `read_validated_book_file`(시스템/자격증명 민감 경로 `/System`, `/Library`, `/etc`, `/private`, `~/.ssh`, `~/.gnupg`, `~/.aws`, `~/.kube` 거부 + 등록된 `allow_storage_dir`/Tauri `fs_scope`/네이티브 드롭·다이얼로그 승인 경로 화이트리스트 강제) 및 `#[cfg(test)]` 부정 단위 테스트를 추가 per `FR-008` / `contracts/security-policy.md` §2 / Constitution Principle VII
- [ ] T059 *(로컬 `aarch64-apple-darwin` 자동화 게이트 완료 / 잔여: 미설치 크로스 타겟 및 실기기·서명 수동 검증)* Rust 툴체인(`rustc 1.100.0 >= 1.90.0`)에서 `npm run verify`(종료 코드 `0`, Vitest 60/60·`cargo check`·`cargo test` 5/5), `npm run test:e2e`(10/10), `npm run test:perf`(1/1) 통과 완료; 단, 로컬 `rustup target`에 `aarch64-apple-darwin`만 설치되어 있어 macOS universal/Android/iOS 크로스 타겟 빌드, macOS 코드 서명/App Sandbox 공증(`.dmg`/notarization), 실앱 데스크톱 OS Finder·드래그앤드롭 GUI 및 모바일 실기기 수동 검증은 대상 환경에서 추가 완료 필요 per `.specify/memory/constitution.md` Principle VI/Quality Gates (`T054`) (partial)

---

## Phase 9: Convergence

**Purpose**: 1차 수렴 검증(`/speckit-converge`)에서 탐지된 Rust SSRF IPv6 리터럴 분기, macOS 대소문자 비구분 민감 경로 차단, Rust 원격 요청 총합 수명 데드라인, 원격 동기화 `POST` HTTP 상태 판정 결함 4건을 수렴한다.

- [X] T068 [P] [US3] `src-tauri/src/lib.rs`의 `resolve_and_pin_host`가 `url.host()`(`url::Host::Ipv4` / `url::Host::Ipv6` / `url::Host::Domain`)로 직접 분기해 대괄호 IPv6 리터럴(`http://[::1]/`, `http://[::ffff:169.254.169.254]/`, `http://[fc00::1]/`)이 OS DNS 조회(`DNS_RESOLUTION_FAILED`)로 누락되지 않고 즉시 `classify_ip`에 따라 `BLOCKED_HIGH_RISK` 또는 `PRIVATE_NETWORK_CONFIRM_REQUIRED`를 반환하며 대괄호 제거 호스트명으로 `pinned_map`을 인덱싱하도록 수정하고 Rust `#[cfg(test)]` 단위 테스트를 추가 per `FR-009` / `contracts/security-policy.md` §3.2
- [X] T069 [P] [US3] `src-tauri/src/lib.rs`의 `is_sensitive_path`가 macOS(APFS/HFS+)·Windows의 대소문자 비구분 파일시스템에서 우회되지 않도록 `cfg!(any(target_os = "macos", target_os = "windows"))` 환경에서 시스템 접두사(`/System`, `/Library`, `/etc`, `/private`, `C:\Windows` 등)와 자격증명 컴포넌트(`.ssh`, `.gnupg`, `.aws`, `.kube`)를 ASCII 소문자 정규화 비교(`"/system/Books"`, `"/Users/.../.SSH/key"`)로 차단하도록 수정하고 Rust `#[cfg(test)]` 부정 단위 테스트를 추가 per `FR-008` / `contracts/security-policy.md` §2
- [X] T070 [P] [US3] `src-tauri/src/lib.rs`의 `safe_remote_fetch`가 리다이렉트 홉별 `timeout`만 적용하던 문제를 수정해 `std::time::Instant` 기반 전체 요청(연결 + 모든 리다이렉트 홉 + 응답 바디 스트림 읽기) 총합 수명 데드라인(`compute_remaining_budget`, 홉별 잔여 타임아웃 전파 및 `e.is_timeout()` 매핑)을 적용하여 전체 상한 초과 시 구조화된 `TIMEOUT:` 오류를 반환하도록 보강하고 Rust `#[cfg(test)]` 단위 테스트를 추가 per `FR-009` / `contracts/security-policy.md` §3.2
- [X] T071 [P] [US3] `src/services/sync/syncService.ts`의 `POST` 동기화 분기가 `!postRes.ok`를 무시하고 무조건 `mode = 'remote'`를 반환하던 결함을 수정해 `postRes.ok` 확인 후에만 `remote` 완료로 판정하고 `5xx` 서버 오류·일시 장애 시 `local-hub` 폴백(`4xx`·`RemoteFetchConsentError`는 상위로 전파)하도록 수정하며 `tests/unit/syncService.spec.ts`에 `POST 500` 폴백·`4xx` 실패 단위 테스트를 추가 per `FR-009` / `FR-003` / `contracts/security-policy.md` §3.3
