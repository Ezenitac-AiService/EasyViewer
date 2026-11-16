# 검증 퀵스타트 가이드 (`002-deep-refactoring-overhaul`)

**Feature**: `002-deep-refactoring-overhaul` | **Date**: 2026-11-16
**References**: [`data-model.md`](./data-model.md), [`contracts/reader-port.md`](./contracts/reader-port.md), [`contracts/security-and-streaming.md`](./contracts/security-and-streaming.md), [`contracts/accessibility-and-quality.md`](./contracts/accessibility-and-quality.md)

본 문서는 심층 리팩토링(`US1`~`US5`) 완료 후 모든 성공 기준(`SC-001`~`SC-006`)을 재현 가능하게 검증하는 실행 가이드다.

---

## 1. 사전 요구사항

- **Node.js**: `v24.16.0` (LTS) / `npm` `11.x` (`npm install`)
- **Rust 툴체인**: `rustc >= 1.90.0` (`export PATH="$HOME/.cargo/bin:$PATH"`)
- **브라우저 테스트**: `npx playwright install chromium webkit`

---

## 2. 검증 시나리오

### 시나리오 A: 초기 기동 번들 분할 & 통합 품질 게이트 (`SC-001`, `SC-005`)
1. 실행: `npm run verify` (`vue-tsc -b && vite build`, `vitest run`, `check:boundaries`, `check:version`, `cargo check && cargo test`)
- **확인 사항**:
   - `dist/assets/index-*.js` 초기 엔트리 크기가 기준선(`742.07 kB`) 대비 35% 이상 축소(`<= 480 kB`)되고 `epubjs`/`jszip`/`css-tree`가 별도 지연 청크로 분리됨을 자동 번들 게이트(`check:bundle-budget` / `verify`)로 확인.
   - `npm run check:boundaries`가 전체 루트(`src/`, `src-tauri/src/`, `scripts/`) 계층 위반 **0건** 및 모든 프로덕션 소스 파일 **450줄 이하** 상한(예외 0건)을 통과함 확인.
   - `npm run check:version`이 Android 식별자(`com.edith.easyviewer`), Apple `Info.plist`/`project.yml` 및 버전 일치를 통과함 확인.

### 시나리오 B: 1계층 보안·스트리밍·저장소·접근성 단위 검증 (`US1`~`US5`, `SC-002`, `SC-004`, `SC-006`)
1. 프론트엔드 실행: `npm test`
2. 네이티브 Rust 검증: `cd src-tauri && cargo test`
3. 확인 사항:
   - CSS 이스케이프(`\75\72\6c`)·주석 분할·SVG `foreignObject`/`srcset` 정화, Windows `\\?\` 및 시스템 경로 차단, 비프록시 정적 웹 HTTP 인증 차단·HTTPS 세션 동의, `SHA-256` 동일 크기 온디맨드 중복 방지 테스트 100% 통과.
   - 표지 `Blob` 분리 마이그레이션, unmount/pagehide 즉시 위치 `flush()`, `STORAGE_DIR_WRITE_FAILED` 비폴백 오류, `safe_download_to_storage` 직접 스트리밍 테스트 통과.
   - `ReaderView` 조율·취소 경합(`AbortSignal`), `NetworkDownloadModal`·`WebDavExplorerView`, `TxtPageMeasurer`, 모달 포커스 트랩/`Escape`/초점 복귀 단위 테스트 통과.

### 시나리오 C: 2계층 브라우저 E2E · 접근성 · 성능 회귀 게이트 (`SC-003`, `SC-005`, `SC-006`)
1. 실행: `npm run test:e2e && npm run test:perf`
2. 확인 사항:
   - 키보드 `Tab`/`Shift+Tab`/`Escape` 조작으로 모달·서랍 탐색 및 트리거 요소 초점 복귀, 3테마 인앱 삭제 확인 동작 확인.
   - 대용량 EPUB 첫 페이지 표시(`<= 500ms`) 및 백그라운드 색인 완료 후 캐시 재사용, 조기 이탈 시 위치 보존률 100% 확인.
   - `test:perf` 4개 핵심 구간 중앙값 회귀 0건 확인.
