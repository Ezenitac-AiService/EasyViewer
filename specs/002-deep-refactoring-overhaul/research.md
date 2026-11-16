# Phase 0 리서치: 공격적 비판 분석 기반 심층 리팩토링 (`002-deep-refactoring-overhaul`)

**Feature**: `002-deep-refactoring-overhaul` | **Date**: 2026-11-16 | **Spec**: [spec.md](./spec.md)

본 문서는 `specs/002-deep-refactoring-overhaul/spec.md`의 모든 기술·보안·성능·접근성 요구사항(`FR-001`~`FR-015`, `Clarifications` 10건)을 구현하기 전에 공식 문서, 보안 권고, 최신 라이브러리 메트릭 및 현재 코드베이스 실측치를 대조 검증한 Phase 0 리서치 산출물이다.

---

## 1. CSS·DOM 구조 파서 기반 전자책 정화 (`FR-002`)

- **Decision**: 정규식 기반 `sanitizeStyleText`를 폐기하고, **`css-tree` (`^3.2.1`) CSS AST 파서·워커·생성기** + **강화된 XHTML/SVG DOM 허용 목록 정화기**(`src/engines/epub/sanitizer.ts`)를 채택한다.
- **Rationale**:
  - PortSwigger CSS Injection 연구, OWASP XSS/CSSI 가이드, 및 CVE-2025-66021 / HackTricks SVG-XHTML 네임스페이스 연구에 따르면 정규식 필터는 CSS 16진수 이스케이프(`\75\72\6c`), 주석 분할(`u/*x*/rl`), `@namespace`, 속성 선택자 기반 데이터 유출(`input[value^="a"] { background-image: url(...) }`), `<svg><foreignObject>` XML 네임스페이스 혼동에 의해 구조적으로 우회된다.
  - `css-tree ^3.2.1`은 W3C CSS 문법 렉서/파서로 이스케이프와 주석을 정규 토큰으로 디코딩해 AST(`AtRule`, `Declaration`, `Url`, `FunctionNode`)로 노출한다. 따라서 AST 순회 단계에서 `@import`/`@namespace`/`@font-face`(외부 `http:`/`https:` URI)와 `expression()`, 위험 스킴 `Url`, 외부 `http:`/`https:` `Url`을 결정적으로 제거하고 안전 규칙만 `generate()`로 재직렬화할 수 있다.
  - `css-tree`는 side-effect free 모듈로 압축 후 ~50.5 kB(gzip)이며, `src/router/index.ts` 지연 로딩으로 분리되는 뷰어 청크 내부에만 포함되므로 초기 서재 번들에는 **0 kB** 영향을 준다.
- **Alternatives considered**:
  - `DOMPurify` 단독 사용: HTML/SVG 노드 정화에는 강하나 내부 `<style>` 시트의 세부 속성/함수 AST 제어 및 XHTML EPUB `<link>`·네임스페이스 처리에 한계가 있어, XHTML/SVG 엄격 DOM 정화와 `css-tree` AST 워커 조합이 더 적합하다.
  - 책 내부 스타일 전면 삭제: 조판·여백·제목 서식이 파괴되어 전자책 가독성(`FR-002`)을 해친다.

---

## 2. Windows `\\?\` 확장 경로 정규화 및 단일 로컬 신뢰 경계 (`FR-001`)

- **Decision**: Rust 백엔드 경로 검증(`src-tauri/src/security/path_guard.rs`)에 **`dunce = "1.0.5"`** 를 도입해 Windows `std::fs::canonicalize()`의 verbatim UNC 접두사(`\\?\` / `\\?\UNC\`)를 안전하게 정규화하고, POSIX 시스템 접두사에 더해 **Windows 시스템·보호 접두사(`C:/Windows`, `C:/Program Files`, `C:/Program Files (x86)`, `C:/ProgramData`, `\\?\UNC\...` 네트워크 공유 차단)** 를 명시적으로 추가한다. 또한 프론트엔드 `PlatformStorageAdapter`의 데스크톱 로컬 파일 읽기(`loadBookBinary`) 및 중복 바이트 검증(`sameFileContent`) 모두 JS `@tauri-apps/plugin-fs` 직접 `readFile(storedPath)`를 제거하고 항상 **`read_validated_book_file`(`tauri::ipc::Response`) / `hash_validated_book_file`** 단일 신뢰 경계만 경유하도록 일원화한다.
- **Rationale**:
  - Rust 공식 Win32 경로 동작 문서 및 `dunce` 크레이트 명세에 따르면 Windows에서 `std::fs::canonicalize()`는 항상 `\\?\C:\...` 또는 `\\?\UNC\...` 접두사를 붙이며, 단순 문자열 접두사 검사나 Naive `.replace("\\\\?\\", "")`는 예약 장치명/UNC 경로 오판 및 Scope 비교 불일치를 초래한다. `dunce::canonicalize` (`1.0.5`)는 표준 로컬 경로만 안전하게 `C:\...`로 환원하고 비Windows 타겟에서는 zero-cost passthrough 된다.
  - 현재 `src/services/storage/platformAdapter.ts`의 `loadBookBinary`와 `sameFileContent`가 데스크톱에서 JS `plugin-fs` `readFile`을 별도 호출해 Rust 화이트리스트와 이원화된 경로를 남기고 있었으므로 이를 단일 Rust IPC 경로로 통합한다.
- **Alternatives considered**:
  - 단순 문자열 `trim_start_matches(r"\\?\")` 구현: UNC 네트워크 공유 경로(`\\?\UNC\server\share`) 손상 위험으로 기각.

---

## 3. 네이티브 대용량 원격 도서 직접 디스크 스트리밍 & 2단계/단일 해싱 (`FR-006`, `FR-007`)

- **Decision**:
  - **네이티브 다운로드 스트리밍 (`safe_download_to_storage`)**: Tauri 데스크톱·모바일 환경에서 원격 도서 다운로드 시 Rust 백엔드(`src-tauri/src/commands/remote.rs`)가 SSRF/DNS Pinning/Redirect 검증 통과 후 HTTP 바디 청크(`reqwest` `"stream"` 피처 + `bytes_stream()` + `futures-util`)를 고정 버퍼로 읽어 대상 폴더(데스크톱은 `#[cfg(desktop)] app.state::<AppSecurityState>()` 검증 폴더, 모바일은 `#[cfg(mobile)] app.path().app_data_dir()?.join("books")`) 내 임시 파일에 `tokio::io::BufWriter`로 직접 기록하고, 동시에 `sha2` (`Sha256`) 스트리밍 해시를 계산한다. UI에는 `tauri::ipc::Channel<DownloadProgressEvent>`로 진행률만 전송하고 완료 시 `{ storedPath, fileName, fileSize, contentHash, finalUrl, detectedFormat }`만 반환하며, 이후 대용량 EPUB 메타·표지 추출은 Rust **`zip` (`9.x`, 취약 구버전 <=8.x 회피)** 기반 `extract_epub_metadata_from_path`가 OPF/표지 엔트리만 선택 추출해 256 MB 전체 버퍼 JS 재적재를 완전히 차단한다.
  - **콘텐츠 지문(`contentHash`) 단일화**: 전체 파일 바이트 기반 **SHA-256 (`sha256-<hex>`)** 을 채택한다(네이티브 다운로드는 `sha2` 스트리밍 및 `hash_validated_book_file` IPC, 웹 `ArrayBuffer`는 `crypto.subtle.digest('SHA-256', buffer)`). 기존 도서(`legacy`)는 기존 `id`를 유지하되 `contentHash`가 비어 있는 상태에서 동일 `fileSize` 도서가 가져오기 되면 해당 후보만 온디맨드 해싱해 중복을 차단하고, 나머지 레거시 도서는 유휴 시간/열람 시 점진 보완한다.
- **Rationale**:
  - 현재 `remoteFetch.ts:180` + `lib.rs:670`은 256 MB 파일 다운로드 시 Rust `Vec<u8>` → Base64 문자열(341 MB) → JSON 직렬화 → JS `atob()` → `Uint8Array` → `.slice()`를 거치며 **~4배(1 GiB+) RAM 급증**을 유발한다. Tauri v2 공식 파일 전송 가이드에 따르면 백엔드 직접 디스크 스트리밍이 `O(1)` 버퍼로 가장 메모리 효율적이다.
  - 기존 `computeBookHash`(`useBookStore.ts:20-34`)는 앞 4KB + 파일명 FNV-1a 32비트로 충돌과 이름 변경 시 복제 결함이 있었다. SHA-256은 충돌 확률이 0에 수렴하고 AArch64/x86 하드웨어 가속(`sha2` / Web Crypto C++ 계층)으로 수백 MB도 빠르게 계산된다.
- **Alternatives considered**:
  - `Channel<ArrayBuffer>`로 UI 메모리까지 전체 바이트 전송: Base64 대비 빠르나 여전히 JS 힙에 256 MB+ 버퍼 1~2벌을 적재해 모바일 WebView OOM 위험이 남아 백엔드 직접 스트리밍을 우선 채택(단, 브라우저 웹 환경만 Blob/Fetch 스트리밍 사용).

---

## 4. 표지·색인 분리 저장, IndexedDB 싱글턴 및 초기 번들 분할 (`FR-004`, `FR-005`, `FR-008`)

- **Decision**:
  - **IndexedDB 저장소 확장 (`DB_VERSION = 2`)**: 단일 `IDBDatabase` 연결 싱글턴(`src/services/storage/idbClient.ts`)을 캐싱하고, `book_files`(도서 원본), `book_covers`(독립 `Blob`/바이너리 표지, UI에서는 `URL.createObjectURL` 후 언마운트 시 `revokeObjectURL`), `location_indexes`(도서 `contentHash`별 EPUB CFI 색인 배열), `key_value`(경량 메타데이터·위치·책갈피·설정)로 스토어를 분리한다.
  - **동기 `localStorage` 남용 중단**: `library_books_v1`, `reading_positions_v1`, `bookmarks_v1` 저장 시 `localStorage` 중복 쓰기를 제거하고(소형 설정 플래그/레거시 읽기 폴백만 유지) `positions` 갱신 시 전체 `books` 배열을 400ms마다 재직렬화하지 않도록 분리한다. `ReaderView` 이탈·`pagehide`·`beforeunload` 시 대기 중인 디바운스 타이머를 즉시 `flush()`한다.
  - **초기 번들 코드 분할**: `src/router/index.ts`에서 `ReaderView.vue`를 `() => import('@/views/ReaderView.vue')`로 전환하고, `useBookStore.ts`의 EPUB 메타 추출도 동적 `import('@/engines/epub/metadataExtractor')`로 지연 로딩해 초기 `index` 청크에서 `epubjs`·`jszip`·`css-tree`·`txtMeasuredPagination`을 완전 분리한다.
  - **데스크톱 쓰기 실패 명시적 복구**: `saveBookFile`이 사용자 지정 저장 폴더 쓰기에 실패하면 IndexedDB 침묵 폴백 대신 `StorageWriteError`를 발생시키고, 라이브러리 복구 모달(`InAppConfirmModal` 확장)에서 **"기본 폴더로 전환 후 재저장"** / **"다른 폴더 선택"** 을 제공한다.
- **Rationale**:
  - MDN/Web Storage 표준상 `localStorage`는 오리진당 ~5 MB 상한 + 동기 메인 스레드 블로킹을 가지며, 현재 `extractEpubMetadata`가 `coverUrl`에 수백 KB Base64 문자열을 저장해 15~20권만으로도 `QuotaExceededError`가 발생한다. IndexedDB `Blob` 분리는 수백 GB 디스크 쿼터와 비동기 I/O를 제공한다.
  - 현재 `dist/assets/index-*.js`가 `742.07 kB`로 Vite 500 kB 경고를 초과한다. 라우트/메타추출 동적 분할로 초기 서재 엔트리를 35% 이상 축소(`SC-001`)할 수 있다.
- **Alternatives considered**:
  - OPFS(Origin Private File System) 전면 전환: iOS/Safari 구버전 WebKit 제약 및 Tauri 웹뷰 호환성 리스크가 있어 기존 IndexedDB `Blob` 스토어 분리가 전 플랫폼 일관성 면에서 더 안전하다.

---

## 5. 비차단 EPUB 로딩, 뷰어 포트 추상화 및 접근성 컨트롤러 (`FR-008`, `FR-009`, `FR-010`, `FR-012`)

- **Decision**:
  - **비차단 EPUB 색인 및 캐시**: `EpubViewerEngine`은 `rendition.display()` 완료 후 첫 화면을 즉시 표시(`SC-003` <500ms)하고, 그 동안 `sectionMetrics` 가중치(파일 엔트리 바이트/스파인 비중)로 근사 백분율·슬라이더 이동을 즉시 제공한다. 이후 백그라운드 유휴 루프로 `locations.generate(150)`(또는 `location_indexes` 캐시 적중 시 0ms 즉시 복원) 완료 시 현재 CFI 위치를 고정한 채 `sectionMetrics`만 정교화하고 캐시에 영속 저장한다.
  - **`DocumentReaderPort` 추상화 (`src/engines/types.ts`)**: `ReaderView`·`useBookStore`가 `EpubViewerEngine`이나 `epubjs` 타입에 직접 결합하지 않도록 `DocumentReaderPort`(`load`, `goTo`, `goToPercentage`, `next`, `prev`, `search`, `applySettings`, `destroy`)와 `extractEpubMetadata` 포트 계약을 정의한다.
  - **WAI-ARIA APG 대화상자 컨트롤러 (`useAccessibleDialog.ts`)**: 모든 모달/서랍(`NetworkDownloadModal`, `SyncModal`, `ViewerSettingsPanel`, `ViewerSideDrawer`, `InAppConfirmModal`)에 `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `Tab`/`Shift+Tab` 포커스 트랩, `Escape` 닫기, 닫힘 후 트리거 요소 포커스 복원을 통합하고, 웹 `window.confirm`을 테마 일관 인앱 확인 대화상자(`InAppConfirmModal.vue`)로 대체한다.
- **Rationale**:
  - `epubjs` `locations.generate()` 직렬 큐 블로킹 문제(GitHub/Foliate 사례)는 백그라운드 지연 실행 + `contentHash` 기반 IndexedDB 캐싱으로 첫 열람 및 재열람 모두 해소할 수 있으며, `DocumentReaderPort` 격리로 추후 `foliate-js` 전환 시에도 UI 코드 수정이 불필요하다.
  - WAI-ARIA APG 규범상 포커스 트랩과 호출 요소 포커스 복원은 키보드/보조 기술 사용자 필수 기준이며, `useAccessibleDialog` 단일 컴포저블로 5개 UI 컴포넌트에 중복 없이 일관 적용된다.

---

## 6. 모듈 크기 상한 게이트(≤450줄) 및 테스트 사각지대 해소 (`FR-011`, `FR-013`, `FR-014`)

- **Decision**:
  - **`scripts/check-boundaries.mjs` 확장 (`--max-lines=450`)**: `src/**/*.{ts,vue}`, `src-tauri/src/**/*.rs`, `scripts/**/*.mjs`의 모든 프로덕션 파일이 450줄 이하인지 검사한다(승인된 예외는 명시적 사유와 함께 중앙 레지스트리에만 허용하며, 1차 목표는 **예외 0건**). 또한 `scripts/ssrfRules.mjs`와 `src/services/network/ssrfValidator.ts` 간 SSRF 규칙을 단일 모듈 공유(SSOT)로 통합한다.
  - **거대 6개 모듈 해체 설계**:
    - `ReaderView.vue`(1,237줄) → 뷰 쉘(~260줄) + `composables/reader/{useReaderSession,useTxtReaderController,useReaderNavigation}.ts` + `composables/ui/useToast.ts`
    - `NetworkDownloadModal.vue`(1,100줄) → 모달 쉘(~160줄) + `RemoteUrlDownloadTab.vue`, `WebDavConnectionForm.vue`, `WebDavExplorerView.vue`
    - `src-tauri/src/lib.rs`(1,034줄) → `lib.rs` + `security/{ssrf,path_guard}.rs` + `commands/{files,remote}.rs`
    - `epubEngine.ts`(1,020줄) → `epubEngine.ts` + `sanitizer.ts` + `locationIndexer.ts` + `touchTapController.ts` + `metadataExtractor.ts`
    - `txtMeasuredPagination.ts`(803줄) → `txtLineBox.ts` + `txtPageMeasurer.ts` + `txtMeasuredPagination.ts`
    - `LibraryView.vue`(598줄) / `scripts/remoteProxyGuard.mjs`(601줄) → `useLibraryImport.ts` / `scripts/ssrfRules.mjs` + `scripts/remoteProxyGuard.mjs` 분리
  - **멀티 플랫폼 식별자 & 저장소 정리 (`FR-014`)**: `src-tauri/tauri.android.conf.json` 및 Android 프로젝트(`build.gradle.kts`, `AndroidManifest.xml`, `MainActivity.kt`, `buildSrc/src/main/java/com/edith/easyviewer/kotlin`, 레거시 `com/easyviewer` 잔존 디렉터리 차단)와 Apple `Info.plist`/`project.yml` 식별자·버전을 `com.edith.easyviewer` / 현재 버전으로 통일하고, `build/*.dmg` 바이너리 Git 추적을 해제(`.gitignore` 정리)한다. 또한 Tauri v2 데스크톱 번들링 시 Microsoft WiX(`.msi`)는 순수 숫자 버전(`Major.Minor.Build`)만 허용하고 Fedora RPM(`rpmbuild`)은 `Version` 필드에 하이픈(`-`)을 허용하지 않으므로, SemVer 프리릴리즈 버전(`ver.includes('-')`)에서는 Windows `nsis` 및 Linux `deb,appimage`만 빌드하도록 `scripts/ci-build-desktop.mjs` (`resolveDesktopBuildCommand`)에서 일관되게 분기한다.
  - **SSRF IPv6 전환 대역 및 네이티브 스트리밍 보안 정합 (`FR-003`, `FR-007`)**: OWASP SSRF Prevention Cheat Sheet 및 RFC 6052/8215(NAT64 `64:ff9b::/96`, `64:ff9b:1::/48`), RFC 3056(6to4 `2002::/16`), RFC 4380(Teredo `2001:0000::/32`), RFC 4291(구형 IPv4-compatible `::/96`)에 따라 `scripts/ssrfRules.mjs`와 `src-tauri/src/security/ssrf.rs` 양쪽 모두에서 IPv6 내장 IPv4를 추출·분류하여 우회를 차단한다. 또한 `safe_download_to_storage`는 스트리밍 청크 루프마다 총합 데드라인(`compute_remaining_budget`)을 검사해 Slowloris 지연을 차단하고 `SELF_SIGNED_TLS_CONFIRM_REQUIRED:` 오류 매핑과 교차 출처 리다이렉트 시 민감 인증 헤더 제거를 `safe_remote_fetch`와 동일하게 적용한다.
  - **첫 화면 표시 이후 비차단 색인 및 중첩 모달 접근성 (`FR-008`, `FR-009`)**: `epub.js`의 `locations.generate()`는 메인 스레드 DOM 작업이므로 `rendition.display()` 완료 이후에 시작해야 첫 페이지 표시(`<= 500ms`)를 블로킹하지 않는다(`foliate-js` 섹션 분수 아키텍처 패턴 준용). WAI-ARIA APG Dialog Modal 및 HTML `inert` 명세에 따라 `useAccessibleDialog`는 비가시/비활성/inert 요소를 포커스 후보에서 제외하고, 모달 중첩 시 최상위 활성 모달만 `Escape`/`Tab`을 처리하며 배경 영역에 `inert`를 부여한다.
- **Alternatives considered**:
  - ESLint/Clippy 복합 플러그인 추가 설치: 현행 무의존 Node/Cargo 게이트(`check-boundaries.mjs` + `verify.mjs`)에 라인/경계 검사를 통합하는 편이 CI 속도(30초 이내)와 유지보수 측면에서 가장 단순하다.
