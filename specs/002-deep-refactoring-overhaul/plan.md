# Implementation Plan: 공격적 비판 분석 기반 아키텍처·성능·보안·접근성 심층 리팩토링

**Branch**: `002-deep-refactoring-overhaul` | **Date**: 2026-11-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-deep-refactoring-overhaul/spec.md`

**Note**: 본 문서는 `/speckit-plan` Phase 0~1 설계 산출물이며, 세부 작업 분해(`tasks.md`)는 `/speckit-tasks` 단계에서 생성한다.

---

## Summary

`001-constitution-compliance-refactoring`(`v0.1.6`) 완료 상태에 대해 5대 공격적 비판 페르소나 심층 감사로 적발한 잔여 결함을 해소하는 2차 심층 리팩토링 구현 계획이다. 핵심 설계는 (1) `css-tree ^3.2.1` AST CSS 정화·DOM/SVG 허용목록 보강, Rust `dunce ^1.0.5` Windows `\\?\`/시스템 경로 차단, 데스크톱 읽기 단일 IPC 일원화(`read_validated_book_file`), SSOT SSRF 규칙 및 비프록시 정적 웹 HTTPS·세션 메모리 예외(`FR-001`~`FR-003`), (2) 표지 `Blob` 분리 및 `IndexedDB v2` 싱글턴·`localStorage` 중복 쓰기 제거, `sha2`/`crypto.subtle` SHA-256 지문+레거시 동일 크기 온디맨드 대조, `safe_download_to_storage` 네이티브 직접 디스크 스트리밍, 라우터·뷰어 지연 로딩(`SC-001` <=480 kB / -35%+), 비차단 EPUB 색인+캐시, 이탈/종료 `flush()` 및 데스크톱 쓰기 실패 인앱 복구(`FR-004`~`FR-008`), (3) `useAccessibleDialog` 포커스 트랩/복귀·`InAppConfirmModal` 3테마 확인·`AbortSignal` 취소 가드(`FR-009`~`FR-010`), (4) 6대 거대 파일(`598~1,237줄`)의 **450줄 이하** 모듈 분해·`DocumentReaderPort` 추상화·테스트 사각지대 해소·전 플랫폼 식별자(`com.edith.easyviewer`) 통일 및 저장소 내 `.dmg` 바이너리 추적 제거(`FR-011`~`FR-015`)다.

상세 근거와 계약은 [research.md](./research.md), [data-model.md](./data-model.md), [contracts/reader-port.md](./contracts/reader-port.md), [contracts/security-and-streaming.md](./contracts/security-and-streaming.md), [contracts/accessibility-and-quality.md](./contracts/accessibility-and-quality.md), [quickstart.md](./quickstart.md)에 정의한다.

---

## Technical Context

- **Language/Version**: TypeScript `~5.6.3` (`strict: true`), Vue `^3.5.13` (`<script setup lang="ts">`), Rust edition `2021` (`rustc 1.100.0 >= 1.90.0`)
- **Primary Dependencies**:
  - Frontend: `vue ^3.5.13`, `pinia ^2.3.0`, `vue-router ^4.5.0`, `tailwindcss ^3.4.17`, `lucide-vue-next ^0.468.0`, `epubjs ^0.3.93`, `jszip ^3.10.1`, **`css-tree ^3.2.1`** *(신규 — 자체 타입 내장, `@types/css-tree` 미설치)*, `vite ^6.0.5`, `vue-tsc ^2.2.0`
  - Tauri 2 & Rust: `@tauri-apps/{api,cli} ^2.12.x`, `tauri-plugin-{fs,store,dialog,opener,keyring-store}`, `reqwest 0.13` (`features = ["rustls", "http2", "stream"]`), `tokio = { version = "1", features = ["fs", "io-util", "time"] }`, `futures-util = "0.3"`, `sha2 0.11`, `hex 0.4`, **`dunce = "1.0.5"`** *(신규 — Windows `\\?\` verbatim UNC 정규화)*, **`zip = { version = "9", default-features = false, features = ["deflate"] }`** *(신규 — 대용량 EPUB OPF/표지 선택 추출, 취약 <=8.x 회피)*
- **Storage**: `EasyViewerDB` IndexedDB v2 싱글턴 (`book_files`, `book_covers` Blob, `location_indexes`, `key_value`), 데스크톱 지정 폴더 FS(쓰기 실패 시 `StorageWriteError` 명시), Web Crypto `SHA-256` / `sha2` 콘텐츠 지문(`contentHash`), 소형 설정 전용 `localStorage` 폴백
- **Testing**: Vitest `^3.2` + `@vue/test-utils` + `jsdom` + `@tauri-apps/api/mocks`, Playwright (E2E + 접근성 + 웹 성능), `cargo test`, `scripts/check-boundaries.mjs` (**450줄 규모 상한 게이트 포함**)
- **Target Platform**: Desktop (`macOS 11+`, `Windows`, `Linux`), Mobile (`iOS 15+`, `Android`) — 전 플랫폼 앱 식별자 **`com.edith.easyviewer`** 단일 통일; Web Fallback
- **Project Type**: Tauri 2 + Vue 3 SPA 하이브리드 전자책 뷰어
- **Performance Goals**:
  - 초기 진입 번들(`dist/assets/index-*.js`) 비압축 크기 기준선(`742.07 kB`) 대비 **35% 이상 축소** (`<= 480 kB`), 서재 초기화 중 `epubjs`/`jszip`/`css-tree` 미적재
  - 100권 표지 서재 기준 위치 저장 시 직렬화량 **90% 이상 절감**, 네이티브 원격 다운로드 시 추가 메모리 **<= 25% 또는 <= 32 MiB**
  - 대용량 EPUB 첫 화면 표시: 도서 버퍼 전달 후 엔진 첫 페이지 표시 **<= 500ms** (서재 도서 선택 후 라우트·지연 청크 적재 포함 E2E 전체 여정 **<= 3000ms**), 재열람 색인 복원 0ms 재계산
- **Constraints**:
  - 모든 프로덕션 소스 파일(`src/**/*.{ts,vue}`, `src-tauri/src/**/*.rs`, `scripts/**/*.mjs`) **450줄 이하** (`SC-005`)
  - `spec.md`·문서 한국어 및 코드/식별자 영어(`constitution.md` 원칙 I), Strict TDD Red → Green(`원칙 II`), Zero Trust(`원칙 VII`)
  - 정적 웹 비프록시 환경 인증 요청은 `HTTPS` + 현재 실행 세션 메모리만 허용(평문 HTTP·영구 저장 차단)
- **Scale/Scope**: 기존 모놀리식 6대 파일(`ReaderView.vue`, `NetworkDownloadModal.vue`, `lib.rs`, `epubEngine.ts`, `txtMeasuredPagination.ts`, `LibraryView.vue` / `remoteProxyGuard.mjs`) 해체 및 신규 접근성/스토리지/포트 모듈 도입, 테스트 사각지대 전면 보강

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### 1. Pre-Design & Post-Design Gate 점검
- **원칙 I (한국어 문서·커밋 & 영어 코드)**: PASS — `spec.md`, `research.md`, `plan.md`, `data-model.md`, `contracts/`, `quickstart.md` 모두 한국어로 작성되었으며 코드/심볼/주석은 영어로 정의함.
- **원칙 II (TDD — NON-NEGOTIABLE)**: PASS — 모든 보안·스토리지·모듈 분해·접근성·경합 작업 전에 실패 테스트(Red) 선행 작성을 전제로 설계함.
- **원칙 III (무결성 & Anti-Bypass)**: PASS — IndexedDB 침묵 폴백 제거(`StorageWriteError`), 정규식 CSS 치환 폐기(`css-tree`), 모킹은 I/O 경계(`tests/`)로만 제한.
- **원칙 IV (리서치 기반 & 실측 근거)**: PASS — Phase 0 [research.md](./research.md)에 OWASP/PortSwigger CSSI, CVE-2025-66021, Rust `dunce`, Tauri v2 직접 스트리밍/Channel, `css-tree` 크기, Web Crypto/`sha2`, IndexedDB Blob vs `localStorage` 근거 및 코드 실측치 기록 완료.
- **원칙 V (플랫폼 추상화 & 엔진 모듈화)**: PASS — `DocumentReaderPort`로 `epubjs` 완전 격리, `ReaderView` 내 직접 `platformStorage` 호출 제거, `scripts/ssrfRules.mjs` SSOT 통합, 450줄 규모 게이트 강제.
- **원칙 VI (지속적 의심 & 다층 검증)**: PASS — 테스트 사각지대(`ReaderView`, `NetworkDownloadModal`, `TxtPageMeasurer`, Windows `\\?\`, `AbortSignal`, 접근성) 전면 포함.
- **원칙 VII (Zero Trust 보안)**: PASS — CSS/DOM AST 파서 정화, `dunce` Windows 확장 경로 차단, 단일 데스크톱 파일 읽기 IPC, 정적 웹 `HTTPS`+세션 메모리 한정 예외.
- **문서 분리 게이트**: PASS — `spec.md` 내 프레임워크·파일 경로 누출 `ZERO_LEAKS` 검증 완료; 모든 기술 스택·계약은 본 계획과 `contracts/`에만 배치함.

---

## Project Structure

### Documentation (this feature)

```text
specs/002-deep-refactoring-overhaul/
├── spec.md
├── checklists/requirements.md
├── research.md
├── plan.md
├── data-model.md
├── quickstart.md
└── contracts/
    ├── reader-port.md
    ├── security-and-streaming.md
    └── accessibility-and-quality.md
```

### Source Code (repository root — 모든 프로덕션 파일 `<= 450줄`)

```text
.
├── .gitignore                                     # build/*.dmg 추적 제외 반영
├── package.json                                   # css-tree 추가
├── src/
│   ├── router/index.ts                            # ReaderView 지연 로딩 (() => import)
│   ├── types/
│   │   ├── index.ts                               # BookMeta.contentHash / hasCover / StorageWriteError
│   │   ├── css-tree.d.ts                          # css-tree AST 타입 선언
│   │   ├── scripts-ssrf.d.ts                      # scripts/ssrfRules.mjs TS 모듈 선언
│   │   └── epubjs.d.ts
│   ├── engines/
│   │   ├── types.ts                               # DocumentReaderPort, ReaderLoadOptions, ExtractedEpubMetadata
│   │   ├── epub/
│   │   │   ├── sanitizer.ts                       # (신규 <=250줄) css-tree AST + SVG/XHTML 허용목록 정화 + Zip Guard
│   │   │   ├── locationIndexer.ts                 # (신규 <=220줄) 첫 화면 이후 비차단 색인 + IndexedDB 캐시 + 비중 계산
│   │   │   ├── touchTapController.ts              # (신규 <=130줄) WebKit 탭/스크롤 제스처 & 키 포워딩
│   │   │   ├── epubCfiMetrics.ts                  # (신규 <=250줄) 스파인 비중·CFI 백분율·TOC 해석 헬퍼
│   │   │   ├── metadataExtractor.ts               # (신규 <=90줄) 지연 임포트 전용 EPUB 메타·Blob 표지 추출
│   │   │   ├── epubEngine.ts                      # (축소 <=350줄) DocumentReaderPort 구현
│   │   │   └── stableScrollManager.ts             # <=325줄
│   │   └── txt/
│   │       ├── txtEngine.ts                       # <=297줄
│   │       ├── txtLineBox.ts                      # (신규 <=180줄) Range/LineBox 텍스트 지오메트리
│   │       ├── txtPageMeasurer.ts                 # (신규 <=240줄) 페이지 단위 실측 탐색기
│   │       └── txtMeasuredPagination.ts           # (축소 <=310줄) TxtPaginationSession 스케줄러
│   ├── composables/
│   │   ├── ui/
│   │   │   ├── useToast.ts                        # (신규 <=45줄) 공용 타이머 정리 토스트
│   │   │   └── useAccessibleDialog.ts             # (신규 <=160줄) role=dialog, 가시성 필터, 중첩 스택, inert, 초점 복귀
│   │   ├── reader/
│   │   │   ├── useReaderSession.ts                # (신규 <=220줄) 라우트 watch, AbortSignal, unload flush
│   │   │   ├── useTxtReaderController.ts          # (신규 <=250줄) TXT 가상 스크롤 + 페이지네이션 조율
│   │   │   └── useReaderNavigation.ts             # (신규 <=190줄) 탭존, 단축키, 목차/검색/동기화 이동
│   │   └── library/
│   │       ├── useLibraryImport.ts                # (신규 <=170줄) 파일 가져오기 진행상태, 저장폴더 위임 & 복구
│   │       └── useBookCoverUrls.ts                # (신규 <=90줄) 표지 blob: URL 캐시 및 언마운트/삭제 revoke
│   ├── services/
│   │   ├── storage/
│   │   │   ├── idbClient.ts                       # (신규 <=130줄) IndexedDB v2 싱글턴 (onversionchange 가드 포함)
│   │   │   ├── assetStore.ts                      # (신규 <=120줄) book_covers / location_indexes IndexedDB 전담 헬퍼
│   │   │   ├── nativeBookIpc.ts                   # (신규 <=110줄) read/hash/import/extract_epub_metadata IPC 어댑터
│   │   │   ├── bookHasher.ts                      # (신규 <=120줄) Web Crypto / Rust hash_validated_book_file 라우팅
│   │   │   └── platformAdapter.ts                 # (축소 <=310줄) 자산/네이티브 IPC 위임 및 StorageWriteError
│   │   ├── network/
│   │   │   ├── ssrfValidator.ts                   # scripts/ssrfRules.mjs (+src/types/scripts-ssrf.d.ts) 공유 Wrapper
│   │   │   ├── remoteFetch.ts                     # (<=380줄) safe_download_to_storage + 정적 웹 HTTPS/세션 예외
│   │   │   ├── webdavService.ts                   # <=370줄
│   │   │   └── downloadService.ts                 # 스트리밍 진행률·디스크 결과·경량 메타 연계
│   │   └── platform/                              # <=210줄 각 파일 (dialogService/dragDropService 지연 경로·plugin-fs readFile 제거)
│   ├── stores/
│   │   ├── libraryMigration.ts                    # (신규 <=170줄) v1->v2 Base64 표지 분리 마이그레이션 헬퍼
│   │   ├── librarySyncHelpers.ts                  # (신규 <=110줄) 동기화·스냅샷·파일 권한 헬퍼
│   │   └── useBookStore.ts                        # (<=450줄) 경량 서재 상태, 온디맨드 중복 판정, flush, 저장소 위임
│   ├── components/
│   │   ├── common/InAppConfirmModal.vue           # (신규 <=120줄) 3테마(`--ev-text-muted` 포함) 인앱 확인/복구 모달
│   │   └── library/
│   │       ├── NetworkDownloadModal.vue           # (축소 <=300줄) 탭 껍데기
│   │       ├── RemoteUrlDownloadTab.vue           # (신규 <=160줄)
│   │       ├── StorageFolderMenu.vue              # (신규 <=110줄) 데스크톱 저장 폴더 메뉴
│   │       ├── WebDavConnectionForm.vue           # (신규 <=240줄)
│   │       └── WebDavExplorerView.vue             # (신규 <=280줄)
│   └── views/
│       ├── LibraryView.vue                        # (축소 <=380줄, platformStorage 직접 호출 0건)
│       └── ReaderView.vue                         # (축소 <=290줄, platformStorage 직접 호출 0건, title/클래스 호환 유지)
├── .github/workflows/release.yml                  # 레거시 build/*.dmg 복사 분기 정리 및 프리릴리즈 번들 분기 연동
├── scripts/
│   ├── ssrfRules.mjs                              # (신규 <=220줄, +src/types/scripts-ssrf.d.ts) 프록시·클라이언트 공용 SSOT SSRF 분류기 (IPv6 전환 대역 포함)
│   ├── remoteProxyDns.mjs                         # (신규 <=120줄) 프록시 DNS Pinning/에이전트 헬퍼
│   ├── remoteProxyGuard.mjs                       # (축소 <=420줄) ssrfRules 재사용
│   ├── ci-build-desktop.mjs                       # (신규 <=50줄) resolveDesktopBuildCommand 순수 함수 + CI 정식/프리릴리즈 번들 분기
│   ├── check-boundaries.mjs                       # 450줄 규모 상한 + 전 루트 스캔(옵션/Phase 6 전환, 하위 모듈 ≤450줄)
│   ├── check-version-sync.mjs                     # package/Cargo/Tauri + Android(MainActivity·buildSrc·레거시 폴더 차단)/iOS 식별자·버전 검증
│   └── run-perf-gate.mjs                          # 001 기준선 호환 유지 + 신규 SC-001~SC-003 보조 게이트(overhaulGates) 확장
├── tests/perf/
│   ├── baseline.spec.ts                           # EasyViewerDB v2 호환 오픈 (VersionError 방지, 001 시드 유지)
│   └── overhaulGates.spec.ts                      # (신규) SC-002 직렬화 절감 / SC-003 대용량 EPUB 엔진 <=500ms · E2E <=3000ms 게이트
└── src-tauri/
    ├── Cargo.toml                                 # reqwest("stream"), tokio, futures-util, dunce, sha2, hex, zip(9.x)
    ├── capabilities/{default,desktop}.json        # desktop+mobile read_validated_book_file 일원화로 fs:allow-read-file 제거
    ├── tauri.android.conf.json                    # "identifier": "com.edith.easyviewer"
    ├── gen/{android,apple}/                       # Android/Apple 식별자(com.edith.easyviewer)·버전·init 정합 (레거시 com/easyviewer 제거)
    └── src/
        ├── lib.rs                                 # (축소 <=80줄) 빌더/핸들러 등록
        ├── security/
        │   ├── mod.rs
        │   ├── ssrf.rs                            # (신규 <=300줄, 단위 테스트 포함 <=450줄) IPv6 전환 대역 포함 SSRF 검증
        │   └── path_guard.rs                      # (신규 <=360줄, 단위 테스트 포함 <=450줄) dunce + Windows/POSIX 시스템 경로 + fs_scope 정규화
        └── commands/
            ├── mod.rs
            ├── files.rs                           # (신규 <=260줄, 단위 테스트 포함 <=450줄) read/hash/import_validated_book_to_storage
            ├── epub_meta.rs                       # (신규 <=260줄, 단위 테스트 포함 <=450줄) extract_epub_metadata_from_path (EPUB 2/3 + 상대경로 + 엔티티 + ZIP Bomb 가드)
            └── remote.rs                          # (신규 <=380줄, 단위 테스트 포함 <=450줄) safe_remote_fetch + safe_download_to_storage(데드라인/TLS/고유 .part)
```

**Structure Decision**: 기존 Tauri 2 + Vue 3 단일 저장소 구조를 유지하되 6개 비대 모듈을 책임별 하위 파일(`composables/`, `engines/{epub,txt}/`, `storage/`, `components/library/`, `src-tauri/src/{security,commands}/`)로 해체해 모든 프로덕션 파일이 450줄 이하 상한을 충족하도록 설계한다.

---

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
| :--- | :--- | :--- |
| 해당 없음 (위반 없음) | 모든 분리는 단일 책임 원칙과 450줄 규모 상한 게이트(`FR-011`, `SC-005`) 준수를 위한 최소 응집 단위이며, 예외 0건을 유지함 | 비대 단일 파일 내 섹션 주석 분할만으로는 초기 청크 분리, 단위 테스트 격리, 재비대화 차단이 불가능함 |
