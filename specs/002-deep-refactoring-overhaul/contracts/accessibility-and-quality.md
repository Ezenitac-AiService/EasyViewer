# 계약 3: 접근성·모듈 규모 게이트·테스트 사각지대 계약 (`FR-009`, `FR-011`, `FR-013`, `SC-001`, `SC-005`, `SC-006`)

**Feature**: `002-deep-refactoring-overhaul` | **Date**: 2026-11-16

---

## 1. 접근성 대화상자 계약 (`src/composables/ui/useAccessibleDialog.ts`)

모든 모달·서랍(`NetworkDownloadModal`, `SyncModal`, `ViewerSettingsPanel`, `ViewerSideDrawer`, `InAppConfirmModal`)은 다음 계약을 준수한다:

1. **시맨틱 속성**: 루트 대화상자 컨테이너에 `role="dialog"`, `aria-modal="true"`, `aria-labelledby="<title-id>"` 부여.
2. **포커스 트랩**: 열림 시 첫 포커스 가능 요소(또는 지정 초기 요소)로 포커스 이동. 대화상자 내부에서 `Tab` / `Shift+Tab` 순환 시 외부 배경으로 포커스 이탈 금지.
3. **닫기 및 포커스 복원**: `Escape` 키 입력 또는 배경 클릭 시 `close` 이벤트 발행. 닫힌 직후 대화상자를 열었던 트리거 요소(`previousActiveElement`)로 포커스 자동 복원(`requestAnimationFrame` / `nextTick`).
4. **인앱 확인 대화상자 (`InAppConfirmModal.vue`)**: 웹 환경 삭제 확인(`window.confirm` 제거) 및 데스크톱 저장 폴더 쓰기 실패 복구("기본 폴더 전환" / "다른 폴더 선택")가 모두 `light`/`dark`/`sepia` 3테마 CSS 변수를 준수하는 본 모달을 통해 처리된다.
5. **아이콘 버튼 레이블**: `ReaderView`, `LibraryView`, 모달/서랍 내 텍스트 없는 모든 아이콘 버튼에 `aria-label` 필수 부여.

---

## 2. 모듈 분해 및 450줄 규모 상한 게이트 (`scripts/check-boundaries.mjs`)

1. **검사 대상**: 전체 프로덕션 루트(`src/**/*.{ts,vue}`, `src-tauri/src/**/*.rs`, `scripts/**/*.mjs`) — 기존 5개 폴더(`views`, `stores`, `components`, `engines`, `services/sync`)뿐 아니라 `src/composables/`, `src/services/storage/`, `src/services/network/`, Rust·스크립트까지 전수 스캔한다(규칙 헬퍼는 필요 시 `scripts/` 하위 모듈로 분리해 스크립트 파일 자체도 `<= 450줄` 준수).
2. **상한 규칙 및 단계별 적용**:
   - 모든 단일 프로덕션 소스 파일은 **450줄 이하**여야 한다.
   - Phase 2에서는 `scanWorkspaceBoundaries(root, options)`의 옵션(`enforceMaxLines`, `forbidViewPlatformStorage`) 제어로 스캐너를 구현해 `tests/unit/checkBoundaries.spec.ts`의 가상 픽스처 테스트로 초과/역참조 실패(`RED→GREEN`)를 검증하고 기존 실제 레포 스모크 테스트는 무충돌 유지한다. Phase 6(`T035`) 거대 파일 분해 완료 시점에 옵션을 기본값 `true`로 전환해 전역 `npm run check:boundaries` (`npm run verify`)가 **예외 레지스트리 0건** 기준으로 위반 시 exit `1`을 반환하도록 확정한다(임시 우회 목록 미잔존).
3. **계층 경계 규칙 추가**:
   - `src/views/` 전체(`ReaderView.vue`, `LibraryView.vue` 등)에서 `platformStorage` 직접 호출 금지 (`useBookStore` / 도메인 서비스 경유 강제).
   - `src/views/`, `src/stores/`에서 `epubjs` / `jszip` 직접 `import` 금지 (`DocumentReaderPort` 및 동적 `metadataExtractor` 포트 경유).
   - `useToast` 공용 컴포저블 외 뷰/모달 내부 개별 토스트 타이머 중복 구현 금지.

---

## 3. 자동화 검증 확장 기준 (`FR-013`, `SC-001`~`SC-006`)

| 영역 | 필수 신규/보강 테스트 범위 |
| :--- | :--- |
| **보안(`US1`)** | `css-tree` CSS 이스케이프(`\75\72\6c`)·주석 분할·`srcset`/`foreignObject` SVG 부정 케이스, Rust `dunce` Windows `\\?\` & `C:\Windows` 차단 부정 케이스, 비프록시 정적 웹 HTTP 인증 차단 및 HTTPS 세션 동의 단위 테스트 |
| **성능·저장(`US2`)** | Base64 `coverUrl` → `book_covers` `Blob` 마이그레이션 & 100권 직렬화 크기 -90% 테스트, `contentHash` 온디맨드 충돌 차단, unmount/pagehide 즉시 `flush()`, `safe_download_to_storage` 스트리밍 및 `STORAGE_DIR_WRITE_FAILED` 비폴백 오류 테스트, 초기 진입 청크 크기 검증(`dist/assets/index-*.js` <= 480 kB & 기준선 -35%+) |
| **접근성·경합(`US3`)** | 모달/서랍 `Tab`/`Shift+Tab`/`Escape`/초점 복귀 단위·E2E 테스트, `InAppConfirmModal` 3테마 확인/복구 테스트, `ReaderView` route 변경 및 조기 이탈 `AbortSignal` 취소 경합 테스트 |
| **엔진·UI 사각지대(`US4`, `US5`)** | `ReaderView` 조율 흐름 단위 테스트, `NetworkDownloadModal`·`WebDavExplorerView` 단위 테스트, `TxtPageMeasurer` 줄/페이지 분할 단위 테스트, `check:boundaries` 450줄 상한 초과 실패 테스트 |
