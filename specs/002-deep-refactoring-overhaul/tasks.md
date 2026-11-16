---

description: "Task list for 002-deep-refactoring-overhaul following Strict TDD and <=450-line modularity gates"
---

# Tasks: 공격적 비판 분석 기반 아키텍처·성능·보안·접근성 심층 리팩토링

**Input**: Design documents from `/specs/002-deep-refactoring-overhaul/`
**Prerequisites**: `plan.md` (required), `spec.md` (required), `research.md`, `data-model.md`, `contracts/` (`reader-port.md`, `security-and-streaming.md`, `accessibility-and-quality.md`), `quickstart.md`

**Tests**: 본 프로젝트 헌법(원칙 II)에 따라 **Strict TDD(Red → Green → Refactor)** 를 강제한다. 각 사용자 스토리에서 단위·계약·통합 테스트 태스크를 반드시 먼저 작성해 실패(`RED`)를 확인한 뒤 구현을 진행한다.

**Organization**: 모든 작업은 독립 구현·독립 검증이 가능하도록 사용자 스토리(`US1`~`US5`) 단위로 편성했으며, 모든 프로덕션 파일은 `450줄` 이하 상한(`FR-011`, `SC-005`)을 준수한다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 서로 다른 파일이며 미완료 선행 태스크에 의존하지 않아 병렬 실행 가능
- **[Story]**: 해당 작업이 속한 사용자 스토리 (`[US1]`~`[US5]`; Setup/Foundational/Polish 제외)
- 모든 태스크는 정확한 대상 파일 경로를 포함한다

---

## Phase 1: Setup (프로젝트 의존성 및 공통 타입·기반 준비)

**Purpose**: 신규 AST CSS 파서·Windows UNC 경로 정규화·스트리밍 SHA-256·저장소/포트/모듈 규모 상한 검증 기반을 설치·정의한다.

- [X] T001 `package.json` `dependencies`에 자체 타입이 내장된 `css-tree` (`^3.2.1`, `@types/css-tree` 미설치)만 추가하고(부족한 내부 선언 필요 시 `src/types/css-tree.d.ts` 보강), `src-tauri/Cargo.toml` `[dependencies]`에 `reqwest` `"stream"` 피처 추가 및 `tokio = { version = "1", features = ["fs", "io-util", "time"] }`, `futures-util = "0.3"`, `dunce = "1.0.5"`, `sha2 = "0.11"`, `hex = "0.4"`, `zip = { version = "9", default-features = false, features = ["deflate"] }`를 추가해 `package-lock.json`·`src-tauri/Cargo.lock`을 동기화하고 `cargo check` 컴파일 통과 확인
- [X] T002 [P] `src/types/index.ts`에 `BookMeta.contentHash?: string` (`sha256-<hex>`), `BookMeta.hasCover?: boolean`, `StorageWriteError` (`code: 'STORAGE_DIR_WRITE_FAILED'`, `targetDir`, `causeMessage`), `NativeDownloadResult`, `DownloadProgressEvent` 타입 계약을 추가
- [X] T003 [P] `src/engines/types.ts`에 `DocumentReaderPort`, `ReaderLoadOptions` (`AbortSignal`, `onRelocated`, `onIndexReady`), `ReaderLocationChange`, `ExtractedEpubMetadata`, `EpubMetadataExtractor` 포트 인터페이스를 정의 per `contracts/reader-port.md`

---

## Phase 2: Foundational (전 스토리 차단 선행 기반 — 모듈 해체 골격 · 공용 경계)

**Purpose**: 1,000줄 이상 거대 백엔드·스토리지·SSRF 단일 파일을 먼저 응집된 모듈 골격으로 분리해 이후 모든 스토리 구현이 깨끗한 경계 위에서 동작하도록 보장한다.

**⚠️ CRITICAL**: 본 단계 완료 전까지 사용자 스토리 구현에 진입하지 않는다.

- [X] T004 [P] `scripts/ssrfRules.mjs`에 **`node:*` 내장 모듈 임포트가 전혀 없는 순수 ESM**으로 IPv4/IPv6 CIDR·Zone ID·정수/8진 표기·사설망/고위험 호스트 분류 SSOT 모듈을 생성하고, `tsconfig.json` `include` 범위 내 타입 선언 `src/types/scripts-ssrf.d.ts`를 추가해 `src/services/network/ssrfValidator.ts` 및 `scripts/remoteProxyGuard.mjs`(≤ 420줄)가 `vue-tsc -b` 및 `vite build` 오류 없이 동일 규칙을 재사용하도록 리팩토링 per `contracts/security-and-streaming.md` §3
- [X] T005 [P] `src-tauri/src/lib.rs`(1,034줄)를 `src-tauri/src/security/{mod.rs,ssrf.rs,path_guard.rs}`(각 ≤ 250줄, `fs_scope` 검증 내 `std::fs::canonicalize` → `dunce::canonicalize` 교체 포함), `src-tauri/src/commands/{mod.rs,files.rs,epub_meta.rs,remote.rs}`(각 ≤ 290줄, `#[cfg(desktop)] AppSecurityState`와 `#[cfg(mobile)]` `app_data_dir` 크로스 플랫폼 분기 포함), `src-tauri/src/lib.rs`(≤ 80줄 빌더·핸들러 등록) 모듈 트리로 1차 구조 분할 per `plan.md` & `FR-011`
- [X] T006 [P] `src/services/storage/idbClient.ts`(≤ 130줄)에 `EasyViewerDB` (`DB_VERSION = 2`) 단일 `IDBDatabase` 연결 싱글턴, `onversionchange`/`onblocked` 멀티탭 안전 종료 가드, 테스트용 리셋 훅(`resetIdbClientForTests()`), 4개 Object Store(`book_files`, `book_covers`, `location_indexes`, `key_value`) 초기화 로직을 구현하고, `tests/unit/setup.ts` `afterEach`에 `resetIdbClientForTests()` 및 `EasyViewerDB` 정리를 연동하며 `tests/perf/baseline.spec.ts`의 하드코딩된 `indexedDB.open('EasyViewerDB', 1)`을 `DB_VERSION = 2` 호환 오픈으로 갱신(`VersionError` 방지) per `data-model.md` §1
- [X] T007 [P] `src/composables/ui/useToast.ts`(≤ 45줄)에 언마운트 시 `clearTimeout`을 자동 보장하는 공용 토스트 컴포저블을 작성하고, `src/composables/ui/useAccessibleDialog.ts`(≤ 140줄)에 `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `Tab`/`Shift+Tab` 포커스 트랩, `Escape` 닫기, 호출 트리거 포커스 복구 계약을 구현 per `contracts/accessibility-and-quality.md` §1
- [X] T008 `scripts/check-boundaries.mjs`(필요 시 규칙 모듈 분리로 스크립트 파일도 ≤ 450줄 유지)에 `scanWorkspaceBoundaries(root, options)` 옵션 제어(`enforceMaxLines`, `forbidViewPlatformStorage`)를 통해 전 루트(`src/**/*.{ts,vue}`, `src-tauri/src/**/*.rs`, `scripts/**/*.mjs`) 단일 파일 **450줄** 상한 검증기 및 `src/views/` 내 `platformStorage`·`epubjs`/`jszip` 차단 검사 함수를 구현하고(Phase 2~5 동안 기존 `checkBoundaries.spec.ts` 실제 레포 스모크 통과 유지, `T035` 완료 시 기본값 `true` 전환), `tests/unit/checkBoundaries.spec.ts`의 가상 워크스페이스 픽스처 테스트(`RED → GREEN`)로 450줄 초과·뷰 역참조 차단을 선제 검증 per `contracts/accessibility-and-quality.md` §2

**Checkpoint**: Foundational 모듈 골격 완성 — 이제 `US1`~`US5` 작업을 독립 진행할 수 있다.

---

## Phase 3: User Story 1 - 다중 OS 신뢰 경계 및 콘텐츠·경로 보안 빈틈 차단 (Priority: P1) 🎯 MVP

**Goal**: Windows `\\?\` 확장 경로 및 시스템 디렉토리 차단, 크로스 플랫폼(데스크톱+모바일) 로컬 파일 읽기·해싱 단일 IPC 일원화, `css-tree` AST CSS·SVG/DOM 구조 정화, 비프록시 정적 웹 HTTPS+세션 메모리 한정 예외 정책을 완결한다.

**Independent Test**: `tests/unit/epubSanitizer.spec.ts`, `tests/unit/remoteFetch.spec.ts`, `tests/unit/platformAdapter.spec.ts`, `src-tauri/cargo test`를 실행해 Windows `\\?\`/`C:\Windows`, 난독화 CSS/SVG 우회, JS `plugin-fs` 직접 읽기, 정적 웹 `HTTP` 인증 시도가 모두 차단됨을 독립 검증한다.

### Tests for User Story 1 (TDD Red Phase ⚠️ — 구현 전 실패 확인 필수)

- [X] T009 [P] [US1] `src-tauri/src/security/path_guard.rs` `#[cfg(test)]`에 Windows 시스템 경로(`C:/Windows`, `C:\Program Files`, `C:\ProgramData`, `AppData/Local/Microsoft`), `\\?\C:\Windows\...` verbatim 접두사 및 `\\?\UNC\server\share` 네트워크 공유 차단 부정 단위 테스트를 선행 작성(RED) per `FR-001` / `contracts/security-and-streaming.md` §1
- [X] T010 [P] [US1] `tests/unit/epubSanitizer.spec.ts`에 CSS 16진수 이스케이프(`u\72l(https://...)`, `h\74tps:`), 주석 분할 난독화(`/*comment*/`), `@import`/`@namespace`/외부 `@font-face`, `image-set()`/`var()` URL 결합 및 속성 선택자 유출, SVG `<foreignObject>`·`<use>`·`<animate>`·`<mpath>`·`<svg><style>`, `<link rel="preload">`, HTML `srcset`/`poster`/`ping`/`background` 속성 및 복구 불가 기형 CSS 차단 실패 테스트(RED)를 추가 per `FR-002` / `contracts/reader-port.md` §2
- [X] T011 [P] [US1] `tests/unit/remoteFetch.spec.ts`, `tests/unit/platformAdapter.spec.ts`, `tests/unit/platformDialogService.spec.ts`에 비프록시 정적 웹(`x-easyviewer-proxy` 헤더 부재 — `404` 및 SPA `200 text/html` 폴백 모두 포함) 환경에서 평문 `http://` 인증 요청 무조건 거부(`INSECURE_AUTH_BLOCKED`)·`https://` 명시 동의 후 세션 메모리 전용 허용, 그리고 Tauri `loadBookBinary`·`sameFileContent`·`dialogService.readValidatedLocalFileBuffer`가 JS `plugin-fs` `readFile` 대신 `read_validated_book_file`·`hash_validated_book_file` IPC만 호출함을 검증하는 단위 테스트(RED)를 추가/갱신 per `FR-001` / `FR-003`

### Implementation for User Story 1

- [X] T012 [US1] `src-tauri/src/security/path_guard.rs`에 `dunce::canonicalize` 기반 정규화(데스크톱 `fs_scope` 검사 포함), UNC/공유 경로 거부, POSIX + Windows 대소문자 비구분 시스템·보호 디렉토리(`C:/Windows`, `C:/Program Files`, `C:/Program Files (x86)`, `C:/ProgramData`, `C:/Recovery`) 및 추가 자격증명 경로(`.git-credentials`, `.npmrc`, `.netrc`) 차단을 구현하고 `cargo test` 통과 확인(GREEN) per `FR-001`
- [X] T013 [US1] `src/engines/epub/sanitizer.ts`(≤ 240줄)에 `css-tree` 기반 `sanitizeCssWithAst` (`AtRule`/`Declaration`/`Url`/중첩함수·속성선택자 검증 및 Fail-Closed 파싱 오류 차단, `<svg><style>` 포함) + XHTML/SVG 네임스페이스 허용목록 + `<link>`·`srcset`/`poster`/`ping`/`background` 검사를 구현하고 `epubEngine.ts`의 WebKit 상호작용 보존(`allowScriptedContent: true`) + 다층 `CONTENT_CSP`를 유지한 상태에서 `epubSanitizer.spec.ts` 통과 확인(GREEN) per `FR-002` / `FR-015` / `contracts/reader-port.md` §2
- [X] T014 [US1] `src-tauri/src/commands/files.rs`의 `read_validated_book_file`을 크로스 플랫폼(`#[cfg(desktop)]` `AppSecurityState`·`dunce` `fs_scope` + `#[cfg(mobile)]` `app_data_dir/books`)으로 전환하고, `platformAdapter.ts` (`loadBookBinary`, `sameFileContent`) 및 `dialogService.ts` (`readValidatedLocalFileBuffer`)에서 `@tauri-apps/plugin-fs` 직접 `readFile` 선행·폴백 호출을 전면 제거, `src-tauri/capabilities/{default,desktop}.json`의 `fs:allow-read-file` 권한을 제거한 뒤 `platformDialogService.spec.ts`·`platformAdapter.spec.ts` 통과 확인(GREEN) per `FR-001` / `contracts/security-and-streaming.md` §1
- [X] T015 [US1] `src/services/network/remoteFetch.ts`(≤ 380줄 유지) 및 `src/services/platform/credentialService.ts`에 `x-easyviewer-proxy === '1'` 긍정 지문 기반 프록시 판정(SPA `200 HTML` 포함 비프록시 분류), 비프록시 정적 웹 `HTTP` 인증 무조건 차단(`INSECURE_AUTH_BLOCKED`), `HTTPS` 명시 동의 후 세션 메모리 전용 자격증명 한정(브라우저 영구 저장 금지) 정책을 구현하고 `remoteFetch.spec.ts`·`platformAdapter.spec.ts` 통과 확인(GREEN) per `FR-003`

**Checkpoint**: User Story 1 완료 — 모든 크로스 OS 경로, CSS/SVG AST 정화, 단일 크로스 플랫폼 파일 읽기·해싱, 정적 웹 인증 보안 경계가 독립 검증되었다.

---

## Phase 4: User Story 2 - 대규모 서재·대용량 도서 성능, 메모리 효율 및 데이터 유실 방지 (Priority: P1)

**Goal**: 표지 `Blob` 분리 및 `v1→v2` 무손실 마이그레이션, SHA-256 + 레거시 동일 크기 온디맨드 해싱(네이티브 Rust 스트리밍), 크로스 플랫폼 네이티브 `safe_download_to_storage`·`import_validated_book_to_storage` 직접 디스크 스트리밍 + 선택 메타 추출(원격/로컬 256MB JS 힙 비경유), 라우터/메타추출 지연 로딩(엔트리 `<= 480 kB`), 비차단 EPUB 색인+캐시, 이탈 즉시 위치 `flush()`, 쓰기 실패 복구 UI를 구현한다.

**Independent Test**: `tests/unit/storageMigration.spec.ts`, `tests/unit/bookHashDedupe.spec.ts`, `tests/unit/epubLocationCache.spec.ts`, `tests/unit/remoteDownloadStream.spec.ts`, `npm run build` 번들 예산 게이트(`<= 480 kB`) 및 `cargo test`를 통해 모든 성능·저장소·메모리 기준(`SC-001`~`SC-003`)을 독립 검증한다.

### Tests for User Story 2 (TDD Red Phase ⚠️ — 구현 전 실패 확인 필수)

- [X] T016 [P] [US2] `tests/unit/storageMigration.spec.ts`에 Base64 `coverUrl`을 포함한 100권 레거시 `BookMeta` → `book_covers` `Blob` + 경량 `BookMeta`(`hasCover: true`, `coverUrl: undefined`) 무손실 마이그레이션, `localStorage` 미기록 및 레거시 키 정리, 위치 저장 시 `reading_positions_v1` 단독 기록(직렬화 크기 90%+ 절감), `flushPendingLocationSave()` 즉시 확정 및 데스크톱 쓰기 실패 시 `StorageWriteError` 비폴백 예외 단위 테스트(RED)를 작성 per `FR-004` / `FR-005` / `SC-002`
- [X] T017 [P] [US2] `tests/unit/bookHashDedupe.spec.ts`에 앞 4KB가 동일하지만 후반부가 다른 두 대용량 버퍼의 SHA-256 비중복(`contentHash`) 판별 및 아직 `contentHash`가 없는 동일 `fileSize` 레거시 도서 재등록(파일명 변경) 시 온디맨드 해싱 매칭(데스크톱 Rust `hash_validated_book_file` 경유 포함) 테스트(RED)를 작성 per `FR-006`
- [X] T018 [P] [US2] `src-tauri/src/commands/remote.rs`·`files.rs`·`epub_meta.rs` `#[cfg(test)]` 및 `tests/unit/remoteDownloadStream.spec.ts`에 `safe_download_to_storage` 고정 버퍼 디스크 스트리밍·고유 `<sanitized>.<nonce>.part` 동시 다운로드 비충돌·`Sha256` 해시·`MAX_BOOK_BYTES` 초과 즉시 중단·해당 `.part` 파일 정리·`import_validated_book_to_storage`·`extract_epub_metadata_from_path` 선택 추출(256MB 전체 힙 비적재 + `zip 9.x` `MAX_METADATA_ENTRY_BYTES` ZIP Bomb 초과 차단 부정 테스트)·모바일 `app_data_dir` 대상 분기, 그리고 `downloadService.ts`의 `Channel<DownloadProgressEvent>` 진행률 전파·비버퍼 경량 결과 반환 단위 테스트(RED)를 작성 per `FR-007` / `SC-002`
- [X] T019 [P] [US2] `tests/unit/epubLocationCache.spec.ts`에 대용량 EPUB `loadBook`이 전체 색인 완료 전 1차 화면 표시(`precisionReady: false`)를 먼저 반환하고 스파인 비중 근사 백분율→백그라운드 색인 완료 후 `location_indexes` IndexedDB 캐시 저장·재열람 즉시 복원(`precisionReady: true`)·`destroy()` 시 진행 중 색인 루프 즉시 중단을 검증하는 단위 테스트(RED)를 작성 per `FR-008` / `SC-003`

### Implementation for User Story 2

- [X] T020 [US2] `src/services/storage/assetStore.ts`(≤ 120줄)와 `src/services/storage/nativeBookIpc.ts`(≤ 110줄)를 분리하고 `src/services/storage/platformAdapter.ts`(≤ 310줄)가 이를 위임·재노출하여 `idbClient.ts` 기반 표지 바이너리(`saveCoverBlob`, `loadCoverBlob`, `removeCoverBlob`), 위치 색인 캐시(`saveLocationIndex`, `loadLocationIndex`), 및 `hashValidatedBookFile`·`importValidatedBookToStorage`·`extractEpubMetadataFromPath` IPC 어댑터를 제공하며, 가변 서재 목록 `localStorage` 중복 쓰기 제거 및 데스크톱 `saveBookFile` 실패 시 `StorageWriteError`를 던지도록 구현(기존 `@/services/platform` 모킹 테스트 스텁 동기화 포함) per `FR-001` / `FR-004` / `FR-005` / `data-model.md`
- [X] T021 [US2] `src-tauri/src/commands/remote.rs`, `files.rs`(≤ 220줄), `epub_meta.rs`(≤ 220줄)에 `safe_download_to_storage`(64 KiB 청크 스트리밍 + `sha2::Sha256` + `Channel<DownloadProgressEvent>` + 고유 `<sanitized>.<nonce>.part` 임시 파일·원자적 rename + `#[cfg(desktop)]` `AppSecurityState` / `#[cfg(mobile)]` `app_data_dir` 분기), 크로스 플랫폼 `hash_validated_book_file`, `import_validated_book_to_storage`(대상 폴더 쓰기 실패 시 `STORAGE_DIR_WRITE_FAILED:` 반환), `extract_epub_metadata_from_path` (`zip 9.x` + `MAX_METADATA_ENTRY_BYTES` 해독 크기 상한 가드, 공용 `ExtractedEpubMetadata` 반환)를 구현하고 `src-tauri/src/lib.rs` 핸들러에 등록하며 `remoteFetch.ts`·`downloadService.ts`가 네이티브 원격 다운로드 후 256MB 전체 버퍼를 JS로 재적재하지 않고 경량 메타만 수신하도록 연동 per `FR-007` / `contracts/security-and-streaming.md` §2
- [X] T022 [US2] `src/services/storage/bookHasher.ts`(≤ 120줄, 브라우저·Node 24 공용 `globalThis.crypto.subtle.digest` 사용 — `node:crypto` 직접 임포트 금지), `src/stores/libraryMigration.ts`(≤ 170줄), `src/engines/epub/metadataExtractor.ts`(≤ 90줄, `ExtractedEpubMetadata` 준수)를 분리하고, `src/services/platform/dragDropService.ts`·`dialogService.ts`가 네이티브 `sourcePath` 드롭/선택 시 JS 256MB `ArrayBuffer` 선행 적재 없이 경로를 지연 전달하도록 개선(`platformDragDropService.spec.ts` 동기화)하며, `src/stores/useBookStore.ts`(≤ 450줄 유지)에 `importValidatedBookToStorage`·`hashValidatedBookFile`·`extractEpubMetadataFromPath` 우선 경유(웹/순수 버퍼는 Web Crypto/동적 `metadataExtractor`), `initLibrary()` 내 `v1→v2` 표지 분리 마이그레이션, 동일 `fileSize` 레거시 후보 온디맨드 해싱 대조, `SyncPayload` 병합 시 `bookId` 우선 + `contentHash` 보조 매칭, 및 `flushReadingLocation()` 즉시 확정 메서드를 구현 per `FR-004` / `FR-005` / `FR-006` / `SC-005`
- [X] T023 [US2] `src/engines/epub/locationIndexer.ts`(≤ 220줄) 및 `src/engines/epub/epubEngine.ts`에 비차단 섹션 비중 근사 백분율, 백그라운드 `locations.generate(150)` 완료 시 본문 위치 고정 정교화, `destroy()`/`AbortSignal` 즉시 색인 취소, 및 `location_indexes` IndexedDB 캐시 연동을 구현 per `FR-008` / `contracts/reader-port.md` §1
- [X] T024 [US2] `src/router/index.ts`의 `/reader/:id` 라우트를 동적 임포트(`() => import('@/views/ReaderView.vue')`)로 전환하고 `useBookStore.ts`의 EPUB 메타 추출도 동적 `import('@/engines/epub/metadataExtractor')`로 전환(네이티브는 Rust 선택 추출 우선 사용)하며, 초기 진입 청크 크기 검증(`dist/assets/index-*.js <= 480 kB`, `-35%+`)을 `scripts/run-perf-gate.mjs` / `verify`에 추가해 `T016`~`T019` 전체 통과(GREEN) 확인 per `FR-007` / `SC-001`

**Checkpoint**: User Story 2 완료 — 초기 번들 경량화, 표지/색인 분리, 네이티브 직접 스트리밍, 비차단 EPUB 로딩, 충돌 없는 SHA-256 해싱 및 조기 종료 위치 보존이 검증되었다.

---

## Phase 5: User Story 3 - 완전한 키보드·스크린리더 접근성, 상태 경합 차단 및 회복 탄력성 확보 (Priority: P2)

**Goal**: 모든 모달/서랍에 `useAccessibleDialog` 포커스 트랩·`Escape`·초점 복원·ARIA 속성을 적용하고, `InAppConfirmModal` 3테마 인앱 확인/쓰기 실패 복구 UI를 구축하며, `ReaderView` route 전환 및 조기 이탈 `AbortSignal` 취소 가드·다중 가져오기 진행 피드백을 구현한다.

**Independent Test**: `tests/unit/accessibleDialog.spec.ts`, `tests/unit/readerSessionRace.spec.ts`, `tests/unit/libraryImportRecovery.spec.ts` 및 Playwright `tests/e2e/accessibility-and-ux.spec.ts`를 실행해 키보드 트랩/복귀, 3테마 인앱 확인/복구, 도서 급전환·취소 경합 방지를 독립 검증한다.

### Tests for User Story 3 (TDD Red Phase ⚠️ — 구현 전 실패 확인 필수)

- [X] T025 [P] [US3] `tests/unit/accessibleDialog.spec.ts`에 `InAppConfirmModal`, `SyncModal`, `NetworkDownloadModal`, `ViewerSettingsPanel`, `ViewerSideDrawer`의 `role="dialog"`, `aria-modal="true"`, `Tab`/`Shift+Tab` 포커스 트랩, `Escape` 닫기 및 트리거 버튼 초점 복귀 단위 테스트(RED)를 작성 per `FR-009` / `contracts/accessibility-and-quality.md` §1
- [X] T026 [P] [US3] `tests/unit/readerSessionRace.spec.ts`에 `/reader/A` → `/reader/B` route 파라미터 변경 재로드, 느린 `loadBook` 진행 중 뒤로 가기 시 `AbortSignal` 취소 및 스테일 상태 무시, 언마운트/pagehide `flushReadingLocation` 호출 단위 테스트(RED)를 작성 per `FR-005` / `FR-010`
- [X] T027 [P] [US3] `tests/unit/libraryImportRecovery.spec.ts`에 `StorageWriteError` 발생 시 기본 폴더 전환/다른 폴더 선택 복구 모달 동작, 웹 삭제 확인(`window.confirm` 미사용 `InAppConfirmModal` 호출) 및 다중 파일 가져오기 중 진행/중복 방지 가드 단위 테스트(RED)를 작성 per `FR-005` / `FR-009` / `FR-010`

### Implementation for User Story 3

- [X] T028 [P] [US3] `src/components/common/InAppConfirmModal.vue`(≤ 120줄)에 `useAccessibleDialog`와 `light`/`dark`/`sepia` 3테마 CSS 변수를 적용한 인앱 확인·저장소 복구 모달을 구현하고 `src/services/platform/dialogService.ts` 웹 `window.confirm`을 본 모달 어댑터로 교체하며 `tests/unit/platformDialogService.spec.ts` 및 **`tests/e2e/library-flow.spec.ts#L38-L40`**(`InAppConfirmModal` 삭제 확인 클릭 단계)를 동시 동기화 per `FR-005` / `FR-009`
- [X] T029 [US3] `src/components/library/SyncModal.vue`, `src/components/library/NetworkDownloadModal.vue`, `src/components/viewer/ViewerSettingsPanel.vue`, `src/components/viewer/ViewerSideDrawer.vue`에 `useAccessibleDialog`(`role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `Tab` 트랩, `Escape`, 초점 복귀)를 일괄 통합하고 `src/views/ReaderView.vue`·`src/views/LibraryView.vue` 아이콘 버튼에 `aria-label`을 추가(기존 E2E `getByTitle` 호환용 `title` 속성 병행 유지) per `FR-009`
- [X] T030 [US3] `src/composables/reader/useReaderSession.ts`(≤ 220줄)에 `route.params.id` 감시, 레거시 도서(미보완 `contentHash`) 열람 시 `loadBook` 실행 전 `contentHash` 선행 확정·영속화(색인 캐시 연계), `AbortController` 취소 토큰, `beforeunload`/`visibilitychange`/`onBeforeUnmount` `flushReadingLocation()` 보장을 구현하고, `src/composables/library/useLibraryImport.ts`(≤ 170줄)에 가져오기 진행 상태(`isImporting`, `importProgress`, 네이티브 `sourcePath` 경량 메타 우선) 및 `StorageWriteError` 복구 핸들링을 구현해 `T025`~`T027` 통과(GREEN) 확인 per `FR-005` / `FR-008` / `FR-010`

**Checkpoint**: User Story 3 완료 — 접근성 대화상자 규약, 웹 테마 일관 확인창, `AbortSignal` 경합 방지 및 저장소 실패 복구가 독립 검증되었다.

---

## Phase 6: User Story 4 - 거대 단일 모듈 분해 및 계층·도메인 응집도 재구성 (Priority: P3)

**Goal**: 6대 거대 파일(`ReaderView.vue`, `NetworkDownloadModal.vue`, `epubEngine.ts`, `txtMeasuredPagination.ts`, `LibraryView.vue`, `remoteProxyGuard.mjs`)의 잔여 코드를 계획된 하위 모듈(각 `<= 450줄`)로 최종 분해하고 `ReaderView`→`platformStorage` 직접 호출 및 토스트 타이머 중복을 제거해 `check:boundaries` 450줄 게이트를 100% 통과한다.

**Independent Test**: `npm run check:boundaries`를 실행해 계층 위반 **0건** 및 모든 프로덕션 파일(`src/**/*.{ts,vue}`, `src-tauri/src/**/*.rs`, `scripts/**/*.mjs`) **450줄 이하**(예외 0건)를 독립 검증하고, `DocumentReaderPort` 외부에 `epubjs` 의존이 없음을 확인한다.

### Tests for User Story 4 (TDD Red Phase ⚠️ — 구현 전 실패 확인 필수)

- [X] T031 [P] [US4] `tests/unit/checkBoundaries.spec.ts`에 450줄 초과 프로덕션 파일(`src/`, `src-tauri/src/`, `scripts/`)·미등록 예외 거부 및 `src/views/` 전체(`LibraryView.vue`·`ReaderView.vue`) 내 `platformStorage`·`epubjs` 직접 참조 차단 검증 테스트(RED)를 확장하고 `scanWorkspaceBoundaries` 기본 강제 모드(`enforceMaxLines: true`, `forbidViewPlatformStorage: true`) 전환을 준비 per `FR-011` / `FR-012` / `SC-005`

### Implementation for User Story 4

- [X] T032 [P] [US4] `src/engines/epub/touchTapController.ts`(≤ 130줄)를 분리하고 `src/engines/epub/epubEngine.ts`(≤ 350줄)가 `DocumentReaderPort`를 완전 구현(EPUB 어댑터 포트 캡슐화 및 `destroy()` 색인 중단 포함)하도록 정리 per `FR-011` / `FR-012`
- [X] T033 [P] [US4] `src/engines/txt/txtMeasuredPagination.ts`(803줄)를 `src/engines/txt/txtLineBox.ts`(≤ 180줄), `src/engines/txt/txtPageMeasurer.ts`(≤ 240줄), `src/engines/txt/txtMeasuredPagination.ts`(≤ 310줄)로 분해 per `FR-011`
- [X] T034 [P] [US4] `src/components/library/NetworkDownloadModal.vue`(1,100줄)를 `src/components/library/RemoteUrlDownloadTab.vue`(≤ 160줄), `WebDavConnectionForm.vue`(≤ 240줄), `WebDavExplorerView.vue`(≤ 280줄), `NetworkDownloadModal.vue`(≤ 300줄 껍데기)로 분리하고 `useToast`로 토스트 중복 제거 per `FR-011`
- [X] T035 [US4] `src/composables/reader/useTxtReaderController.ts`(≤ 250줄), `useReaderNavigation.ts`(≤ 190줄), `src/composables/library/useBookCoverUrls.ts`(≤ 90줄)를 추출해 `src/views/ReaderView.vue`(≤ 290줄)와 `src/views/LibraryView.vue`(≤ 380줄)를 슬림 껍데기로 전환하고(기존 `tests/e2e/reader-txt.spec.ts#L32` 본문 컨테이너 클래스 및 `title` 셀렉터 호환 유지), `ReaderView`의 `platformStorage.loadBookBinary` 및 **`LibraryView`의 `platformStorage` 직접 호출 5건(`getStorageDir`/`isCustomStorageDir`/`openStorageDir`/`setStorageDir`)** 을 모두 `useBookStore`/도메인 서비스 위임으로 교체(`tests/unit/libraryViewPlatformBoundary.spec.ts`의 `@/services/platform` 모킹 스텁에 표지/색인 메서드 동기화 포함)하며, `LibraryView` 표지 `blob:` URL 언마운트/삭제 `revokeObjectURL` 정리 추가 후 `scanWorkspaceBoundaries` 기본 엄격 모드를 켜서 `npm run check:boundaries` (전 루트 `450줄` 상한 예외 0건) 통과(GREEN) 확인 per `FR-011` / `SC-005`

**Checkpoint**: User Story 4 완료 — 모든 프로덕션 파일 450줄 이하, 단일 책임 경계 위반 0건, `DocumentReaderPort` 추상화가 검증되었다.

---

## Phase 7: User Story 5 - 테스트 사각지대 해소 및 저장소·멀티 플랫폼 산출물 정합화 (Priority: P3)

**Goal**: 기존 3대 무테스트 핵심 파일(`ReaderView.vue`, `NetworkDownloadModal.vue`/`WebDavExplorerView`, `TxtPageMeasurer`) 단위 테스트를 완성하고, 전 플랫폼 앱 식별자(`com.edith.easyviewer`) 및 버전을 통일하며, Git·CI 워크플로우 내 대용량 `.dmg` 바이너리 추적을 제거한다.

**Independent Test**: 신규 단위/E2E 테스트 통과와 `git ls-files build/*.dmg` `0건`, `tauri.android.conf.json`·Android `build.gradle.kts`/`MainActivity`·Apple `project.yml`/`Info.plist`의 `com.edith.easyviewer` 및 버전 일치를 독립 검증한다.

### Tests for User Story 5 (TDD Red Phase ⚠️ — 구현 전 실패 확인 필수)

- [X] T036 [P] [US5] `tests/unit/readerViewOrchestration.spec.ts`에 분해된 `ReaderView`·`useTxtReaderController`·`useReaderNavigation`의 TXT/EPUB 열람, 단축키, 책갈피, 검색, 퀵 동기화 및 `DocumentReaderPort` 호출 흐름 단위 테스트(RED)를 작성 per `FR-013`
- [X] T037 [P] [US5] `tests/unit/networkDownloadModal.spec.ts`에 `NetworkDownloadModal`·`WebDavExplorerView`의 정렬/필터, 사설망·TLS 동의 프롬프트 후 재시도, 다운로드 취소/실패 오류 복구 단위 테스트(RED)를 작성 per `FR-013`
- [X] T038 [P] [US5] `tests/unit/txtMeasuredPagination.spec.ts`에 `TxtPageMeasurer`·`TxtLineBox`·`TxtPaginationSession`의 `posOf`/`absOf` 이진 탐색, 긴 문단 줄 분할(`continued: true`), 백그라운드 페이지 색인·이탈 정리 단위 테스트(RED)를 작성 per `FR-013`
- [X] T039 [P] [US5] `tests/e2e/accessibility-and-ux.spec.ts`에 Playwright 실제 브라우저 기반 모달 포커스 트랩/`Tab` 순환/`Escape` 닫기/초점 복원, 3테마 인앱 삭제 확인 및 대용량 EPUB 비차단 첫 화면(`<= 500ms` 측정 포함) E2E 테스트(RED)를 작성 per `FR-009` / `FR-013` / `SC-003` / `SC-005`

### Implementation for User Story 5

- [X] T040 [US5] `T036`~`T039` 테스트와 `useReaderSession`·`WebDavExplorerView`·`TxtPageMeasurer` 세부 경계 보강을 통해 전 신규 단위/E2E 테스트 통과(GREEN) 확인 per `FR-013`
- [X] T041 [P] [US5] `build/EasyViewer_*.dmg`를 Git 추적에서 제거(`git rm --cached` / 삭제), `.gitignore`의 `!build/*.dmg` 예외 삭제, `.github/workflows/release.yml` 내 레거시 `build/*.dmg` 복사 분기(`L219-221`) 정리, 및 **`tests/unit/releaseWorkflow.spec.ts` (`build/*.dmg` 단언 → Universal DMG 업로드 검증) 동시 갱신**으로 배포 바이너리를 GitHub Release 빌드 산출물로 일원화 per `FR-014`
- [X] T042 [P] [US5] `src-tauri/tauri.android.conf.json`, `src-tauri/gen/android/app/build.gradle.kts`(`applicationId`·`namespace`·`MainActivity.kt` 패키지 및 `npm run android:init -- --help`/정합 확인 포함), `src-tauri/gen/apple/project.yml`(`bundleIdPrefix` + `PRODUCT_BUNDLE_IDENTIFIER`), `src-tauri/gen/apple/easy-viewer_iOS/Info.plist`(`CFBundleShortVersionString`/`CFBundleVersion` 동기화)의 앱 식별자를 **`com.edith.easyviewer`** 로 통일하고, `scripts/check-version-sync.mjs`가 CLI 기본 모드에서 전 플랫폼 식별자·버전 일치를 검증하되 부분 fixture 단위 테스트(`tests/unit/governanceScripts.spec.ts` 하위호환 + 전 플랫폼 fixture 테스트 추가)도 통과하도록 확장 per `FR-014`

**Checkpoint**: User Story 5 완료 — 테스트 사각지대 해소, 저장소 바이너리 정리, 다중 플랫폼 식별자 단일화가 완료되었다.

---

## Phase 8: Polish & Cross-Cutting Concerns (최종 통합 검증 및 회귀 확인)

**Purpose**: 모든 사용자 스토리(`US1`~`US5`) 완료 후 전체 게이트·보안·성능·모듈 규모·접근성 무회귀를 최종 실측한다.

- [X] T043 [P] `README.md`(레거시 로컬 `build/*.dmg` 참조 정리 포함) 및 `specs/002-deep-refactoring-overhaul/quickstart.md`에 신규 아키텍처 구조, 표지 분리 저장/스트리밍 동작, 450줄 게이트 및 `com.edith.easyviewer` 식별자 정합 내역을 최신화
- [X] T044 `tests/perf/baseline.spec.ts`(`DB_VERSION = 2` 호환 오픈 유지, `001` 시드/기준선 스키마 보존)와 별도 신규 `tests/perf/overhaulGates.spec.ts` 및 `scripts/run-perf-gate.mjs` 보조 게이트(`SC-001` `dist/assets/index-*.js <= 480 kB`, `SC-002` 100권 직렬화 90%+ 절감·스트리밍 메모리, `SC-003` 대용량 EPUB 첫 화면 `<= 500ms`)를 구성한 뒤 `export PATH="$HOME/.cargo/bin:$PATH" && npm run verify && npm run test:e2e && npm run test:perf` 전체 통합 게이트를 실행해 Vitest 100%, `check:boundaries`(전 루트 450줄 상한 예외 `0건`), `check:version`, `cargo test`, Playwright E2E/접근성, 성능 기준선 회귀 `0건`을 확인하고 `quickstart.md` 체크 시나리오로 교차 검증 per `FR-015` / `SC-001`~`SC-006`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 즉시 시작 가능
- **Phase 2 (Foundational)**: Phase 1 완료 후 시작 — **모든 사용자 스토리(`US1`~`US5`) 시작 전 완료 필수**
- **Phase 3 (`US1`, P1) & Phase 4 (`US2`, P1)**: Phase 2 완료 후 상호 독립/병렬 진행 가능 (`T014`·`T020`의 `platformAdapter.ts` 수정만 순차 조율)
- **Phase 5 (`US3`, P2)**: Phase 2 완료 후 시작 (`StorageWriteError` 복구 UI `T027`/`T030`은 `T020`과 연계)
- **Phase 6 (`US4`, P3)**: `US1`~`US3` 핵심 로직 안정화 후 마무리 해체 및 `check:boundaries` 450줄 게이트 전체 통과 확인
- **Phase 7 (`US5`, P3)**: Phase 6 분해 구조 확정 후 신규 단위/E2E 사각지대 완성, 저장소/식별자 정리는 언제든 병렬 가능
- **Phase 8 (Polish)**: `US1`~`US5` 전체 완료 후 최종 통합 실측 게이트 실행

### Within Each User Story

1. TDD Red 테스트 태스크 먼저 작성 및 실패(`RED`) 확인
2. Rust 백엔드 / 모델 / 저장소 계약 구현
3. 상위 서비스 / 컴포저블 / UI 뷰 통합 및 `GREEN` 확인

---

## Parallel Example

```bash
# Phase 2 Foundational 병렬 실행 예:
Task: "T004 [P] scripts/ssrfRules.mjs SSOT 통합"
Task: "T005 [P] src-tauri/src/{security,commands} 모듈 분할"
Task: "T006 [P] src/services/storage/idbClient.ts IndexedDB v2 싱글턴"
Task: "T007 [P] useToast & useAccessibleDialog 공용 컴포저블"

# Phase 3 (US1) TDD Red 테스트 병렬 작성 예:
Task: "T009 [P] [US1] Rust path_guard Windows \\\\?\\ 부정 단위 테스트"
Task: "T010 [P] [US1] epubSanitizer CSS AST/SVG 난독화 부정 테스트"
Task: "T011 [P] [US1] remoteFetch 정적 웹 HTTP 인증 거부 & 단일 read_validated_book_file 테스트"
```

---

## Implementation Strategy

### MVP First (User Story 1 + User Story 2 — P1 보안 및 성능 핵심)
1. Phase 1(Setup) + Phase 2(Foundational) 완료
2. **Phase 3 (`US1`, P1)**: Windows `\\?\` · 단일 데스크톱 파일 읽기 · `css-tree` AST 정화 · 정적 웹 HTTPS/세션 예외 완료 및 검증
3. **Phase 4 (`US2`, P1)**: 표지 분리 `IndexedDB v2` · SHA-256 지문 · `safe_download_to_storage` 직접 스트리밍 · 엔트리 번들 분할(`<= 480 kB`) · 비차단 EPUB 색인 캐시 완료 및 검증

### Incremental Delivery (P2 UX/접근성 → P3 모듈화·테스트·릴리즈 정합)
4. **Phase 5 (`US3`, P2)**: `useAccessibleDialog` 포커스 트랩 · 3테마 `InAppConfirmModal` · `AbortSignal` 취소 경합 차단
5. **Phase 6 (`US4`, P3)**: 6대 거대 파일 `<= 450줄` 분해 완성 및 `check:boundaries` 게이트 통과
6. **Phase 7 (`US5`, P3)** + **Phase 8 (Polish)**: 3대 무테스트 모듈 커버리지 완성, `.dmg` 추적 정리, `com.edith.easyviewer` 통일 및 전체 게이트 최종 검증

---

## Phase 9: Convergence

- [X] T045 [US3] TDD Red → Green 순서로 `tests/unit/libraryImportRecovery.spec.ts`(또는 `LibraryView` 단위 테스트)에 가져오기 진행 UI(`isImporting`/`importProgress`)·중복 판정 실패 테스트(RED)를 먼저 작성한 뒤, `src/views/LibraryView.vue`에서 `useLibraryImport`의 `isImporting`·`importProgress`를 바인딩해 진행 배지/비활성 가드 UI를 렌더링하고 등록 전 `bookStore.books` ID 집합과 대조해 `deduplicated` 여부를 정확히 판별(GREEN, `<= 450줄` 유지) per `FR-010` / `Constitution II` (partial)
- [X] T046 [US3] `src/components/common/InAppConfirmModal.vue`의 미정의 변수 `--ev-muted`를 `src/assets/main.css` 표준 `--ev-text-muted`로 정합화하고, `tests/e2e/accessibility-and-ux.spec.ts`에 Playwright 실제 브라우저 기반 `Tab`/`Shift+Tab` 포커스 트랩 순환, 모달 닫힘 후 트리거 버튼 초점 복귀 단언, 및 `light`/`sepia`/`dark` 3테마 인앱 삭제 확인 모달 검증을 추가 per `FR-009` (partial)
- [X] T047 [US2] `tests/perf/overhaulGates.spec.ts`에 독서 위치 변경 후 `flushReadingLocation`(페이지 이탈/서재 복귀 또는 디바운스 완료 대기)을 거쳐 `EasyViewerDB` `key_value` 스토어의 `reading_positions_v1` 단독 직렬화 크기가 100권 서재 메타데이터(`library_books_v1` + 표지 제외/비교) 대비 90% 이상 절감됨을 실측 검증하는 `SC-002` 단언을 추가(로딩 직후 `<= 500ms` 및 E2E 전체 여정 `<= 3000ms` 구분 주석 유지) per `SC-002` / `SC-003` (partial)

---

## Phase 10: Convergence

- [X] T048 [US5] CRITICAL: `scripts/ci-build-desktop.mjs`에서 순수 함수 `resolveDesktopBuildCommand(matrixName, version, defaultCmd)`를 분리·export(Windows와 Linux 모두 동일하게 `version.includes('-')` SemVer 프리릴리즈 조건으로 통일)하고 `tests/unit/releaseWorkflow.spec.ts`에 정식 버전(`0.1.6` → `nsis,msi` / `deb,rpm,appimage`) 및 프리릴리즈 버전(`0.1.6-beta`, `0.1.6-0` → Windows `nsis` / Linux `deb,appimage`) 분기 단위 테스트를 추가 per `Constitution II` / `FR-014` (`D1`, missing)
- [X] T049 [US5] `scripts/check-version-sync.mjs` 및 `tests/unit/governanceScripts.spec.ts`를 확장해 `src-tauri/gen/android` 내 레거시 `com/easyviewer` 잔존 디렉터리 차단 및 `MainActivity.kt`(`package com.edith.easyviewer`)·`buildSrc`(`com/edith/easyviewer/kotlin`) 경로 정합성까지 자동 검증하도록 보강 per `FR-014` / `T042` (`F5`, partial)
- [X] T050 [P] [US1] `tests/unit/remoteFetch.spec.ts` 및 `src-tauri/src/security/ssrf.rs` `#[cfg(test)]`에 IPv6 전환 대역(NAT64 `64:ff9b::7f00:1`·`64:ff9b:1::a9fe:a9fe`, 6to4 `2002:7f00:1::`, Teredo `2001:0000:...`, 구형 IPv4-compatible `::127.0.0.1`) 차단 실패 테스트(RED)를 추가하고 `scripts/ssrfRules.mjs`와 `src-tauri/src/security/ssrf.rs` 양쪽에 내장 IPv4 추출·차단 규칙을 동기화 구현(GREEN) per `FR-003` (`F2`, partial)
- [X] T051 [P] [US1] `tests/unit/epubSanitizer.spec.ts`에 `<img src="https://...">`/`<form action="https://...">`/`<link rel="stylesheet" href="https://...">` 외부 URI 차단 및 `@media`/`@supports`/`@container` 내부 비허용 URI 스킴 차단 실패 테스트(RED)를 추가하고, `src/engines/epub/sanitizer.ts`를 명시적 안전 URI 스킴 허용 목록(상대 경로, `#fragment`, `blob:`, 안전 래스터 `data:image/*`) 기반으로 강화(GREEN) per `FR-002` (`C1`, partial)
- [X] T052 [P] [US2] `src-tauri/src/commands/remote.rs`·`epub_meta.rs` `#[cfg(test)]` 및 `tests/unit/remoteDownloadStream.spec.ts`에 ① `safe_download_to_storage` 스트리밍 청크 루프 데드라인(`TIMEOUT:`), 자체 서명 인증서 `SELF_SIGNED_TLS_CONFIRM_REQUIRED:` 매핑, 교차 출처 리다이렉트 시 민감 헤더 제거 테스트와 ② `epub_meta.rs`의 EPUB 2 `<meta name="cover">` 표지 추출, 상대 경로(`../`)·퍼센트 인코딩(`%20`) 정규화, XML 엔티티(`&amp;` 등) 디코딩 테스트(RED)를 추가하고 구현(GREEN) per `FR-007` (`F3`, `C2`, partial)
- [X] T053 [P] [US2] `tests/unit/epubLocationCache.spec.ts` 및 `tests/unit/storageMigration.spec.ts`에 ① `EpubViewerEngine.loadBook()`이 캐시 미적중 또는 `contentHash` 미전달 시에도 `rendition.display()` 첫 화면 표시를 먼저 완료한 뒤에만 백그라운드 `locations.generate(150)`를 시작함을 검증하는 순서 단언과 ② `flushReadingLocation()` 호출 시 `reading_positions_v1`뿐 아니라 갱신된 `lastOpenedAt`/`lastLocation`이 반영된 경량 `library_books_v1`도 함께 저장됨을 검증하는 테스트(RED)를 추가하고 `src/engines/epub/epubEngine.ts`·`src/stores/useBookStore.ts`에 반영(GREEN) per `FR-004` / `FR-008` / `SC-003` (`F4`, partial)
- [X] T054 [P] [US3] `tests/unit/accessibleDialog.spec.ts`에 비가시(`display: none`/`hidden`/`[inert]`) 요소 포커스 제외, 배경 영역 `inert` 격리, 및 중첩 대화상자 오픈 시 최상위(Topmost) 모달만 `Escape`/`Tab`을 처리해 하위 모달이 함께 닫히지 않음을 검증하는 단위 테스트(RED)를 추가하고 `src/composables/ui/useAccessibleDialog.ts`에 구현(GREEN) per `FR-009` (`C3`, partial)
