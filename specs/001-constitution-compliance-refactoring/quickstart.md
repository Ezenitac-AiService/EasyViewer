# 검증 퀵스타트 가이드 (Quickstart Validation)

**Feature**: `001-constitution-compliance-refactoring` | **Date**: 2026-11-15
**References**: [`contracts/platform-boundary.md`](./contracts/platform-boundary.md), [`contracts/security-policy.md`](./contracts/security-policy.md), [`contracts/quality-gates.md`](./contracts/quality-gates.md)

본 문서는 리팩토링 전후에 명세의 모든 성공 기준(`SC-001`~`SC-006`)이 충족되었음을 재현 가능하게 검증하는 실행 가이드입니다.

---

## 1. 사전 요구사항 (Prerequisites)

- **Node.js**: `v24.16.0` (LTS 이상) 및 `npm` `11.x`
- **의존성 설치**: `npm install` (Vitest, `@vue/test-utils`, `jsdom`, `@playwright/test` 포함)
- **브라우저 런타임 (2계층·성능 테스트용)**: `npx playwright install chromium webkit`
- **Rust 툴체인 (네이티브 백엔드 검증용)**: `cargo` 및 `rustc` (`>= 1.90.0` 권장 — 최신 Tauri v2 공식 플러그인 및 `reqwest 0.13` MSRV `1.85.0` 충족; 현재 로컬 환경은 `rustc 1.100.0` / `aarch64-apple-darwin` 설치 완료)
  - *환경 주의*: `cargo`/`rustc`가 PATH에 없는 환경에서는 `PATH="$HOME/.cargo/bin:$PATH"`를 확인하고, Rust 미설치 환경에서는 `npm run verify -- --frontend-only`로 프론트엔드 1·2계층만 분리 확인하며 미설치 크로스 타겟(macOS universal/iOS/Android)은 CI·대상 기기에서 실행합니다.

---

## 2. 검증 시나리오 및 실행 명령

### 시나리오 A: 리팩토링 착수 전 런타임 성능 기준선 확보 (`FR-012`, `SC-006`)
1. 프로덕션 빌드를 생성합니다: `npm run build`
2. 기준선 성능 벤치마크(고정 50권 메타데이터 시드 + 1MB+ TXT 픽스처)를 실행해 워밍업 제외 중앙값을 기록합니다: `npm run test:perf -- --save-baseline`
3. 기대 결과: 동일 `environment` 식별자와 함께 서재 초기화, 1MB+ TXT 열람, 보기 모드/테마 전환 중앙값 기준선이 저장됩니다.

### 시나리오 B: 1계층 단위·경계 격리 테스트 (`FR-001`, `FR-002`, `SC-001`)
1. 실행: `npm test`
2. 기대 결과:
   - 외부 네트워크 및 실제 OS 창 없이 **30초 이내** 완료
   - TXT 엔진(청킹/검색/인코딩), `ReadingLocation`/`BookmarkItem`, 동기화 병합, `useBookStore`/`useSettingsStore`, `platformAdapter`/`dialogService`/`dragDropService`/`credentialService`(`mockIPC` 격리), `ssrfValidator`·`remoteProxyGuard`, WebDAV v1→v2 마이그레이션 테스트 100% 통과

### 시나리오 C: 2계층 실제 브라우저 렌더링·보안·성능 회귀 테스트 (`FR-003`, `FR-007`, `SC-003`, `SC-004`, `SC-006`)
1. 실행: `npm run build && npm run test:e2e`
2. 기대 결과:
   - `TxtPageMeasurer` 기반 실제 레이아웃 페이지네이션 및 보기 모드(`scroll` ↔ `paginated`) 전환 후 위치 보존 통과
   - `src-tauri/tauri.conf.json`의 `app.security.csp`(`connect-src` 임의 `http:`/`https:` 비허용 포함)가 HTTP `Content-Security-Policy` 헤더로 주입된 preview 상태에서 외부 폰트·비인가 리소스 차단 및 정상 앱 렌더링 확인
   - EPUB iframe 내 삽입 `<script>`/`on*`/`javascript:`/`@import`/SVG 위험 요소·외부 트래킹 리소스 차단 및 정상 탭·텍스트 선택·다중 챕터 CSS/이미지/SVG 렌더링(`<base>`/`CONTENT_CSP` 정합)·테마(`light`/`dark`/`sepia`) 유지 확인
   - Zip Bomb/초과 엔트리/초과 용량 EPUB 및 악성 WebDAV `href`(`..`/제어문자) 거부 확인
   - `/__remote_proxy` 타 출처·누락 `Origin`/`Sec-Fetch-Site` 요청, 비허용 메서드(`DELETE` 등), 세션 논스 없는 `x-allow-*` 우회 시도, 요청/응답 크기 초과, 전체 요청 타임아웃, `X-EasyViewer-Proxy: 1` 기반 업스트림 `404` 구분, 루프백(`127.0.0.1`), 메타데이터(`169.254.169.254`), IPv6 매핑(`::ffff:169.254.169.254`), 내부 리다이렉트·교차 출처 `Authorization` 제거, 기본 TLS 거부(`SELF_SIGNED_TLS_CONFIRM_REQUIRED`) 및 명시 승인 사설망 NAS 허용 확인
   - 성능 비교 실행(`npm run test:perf`) 시 Chromium 웹 DOM/레이아웃 기준 동일 `environment` 기준선 대비 모든 핵심 구간 중앙값이 `+10%` 초과 AND `+15ms` 지연 조건을 넘지 않음(`SC-006`; 네이티브 IPC 호출 횟수 상한은 1계층 `mockIPC`로 검증하며 macOS `WKWebView`/대용량 파일 IPC 실측은 실앱 검증 트랙에서 확인)

### 시나리오 D: 플랫폼 경계·버전·커밋 형식·빌드 통합 게이트 (`FR-005`, `FR-011`, `SC-002`, `SC-005`)
1. 실행: `npm run verify` (`PATH="$HOME/.cargo/bin:$PATH"` 기준 `cargo check && cargo test` 포함 전체 통합 실행; Rust 미설치 환경에서 프론트엔드 게이트만 확인할 때는 `npm run verify -- --frontend-only` 사용, 미설치 상태 기본 `npm run verify`는 exit `2` `BLOCKED` 반환)
2. 커밋 형식 부정/긍정 테스트: `npm run check:commit-msg -- <sample-commit-msg-file>`
3. (Rust 단독 점검 및 크로스 플랫폼 빌드) 백엔드 검증: `cd src-tauri && cargo check && cargo test` (크로스 타겟 macOS universal/Windows/Linux/Android 릴리즈 빌드는 대상 환경 또는 `.github/workflows/release.yml` CI에서 수행)
4. 기대 결과:
   - `check:boundaries`: 상위 계층(`views`, `stores`, `components`, `engines`, `services/sync`) 직접 플랫폼/네트워크 API 호출 `0건`
   - `check:version`: `package.json`, `Cargo.toml`, `tauri.conf.json` (및 락파일 `package-lock.json`, `Cargo.lock`) 버전 일치 (`0.1.6-alpha`)
   - 의도적으로 주입한 규범 위반 샘플에 대해 탐지 실패(exit 1) 100% 확인
   - `cargo` 미설치 상태에서 `npm run verify` 기본 실행 시 `BLOCKED`(exit `2`) 반환 확인
