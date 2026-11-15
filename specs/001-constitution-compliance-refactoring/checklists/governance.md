# 구현 무결성 및 품질·거버넌스 체크리스트 (`T055`)

**Feature**: `001-constitution-compliance-refactoring` | **Updated**: `2026-11-16`  
**References**: [`../contracts/quality-gates.md`](../contracts/quality-gates.md), [`../contracts/security-policy.md`](../contracts/security-policy.md), [`../contracts/platform-boundary.md`](../contracts/platform-boundary.md)

## 1. 아키텍처 경계 및 의존성 무결성 (`FR-005`, `SC-002`)

- [x] `scripts/check-boundaries.mjs`로 `src/views/`, `src/stores/`, `src/components/`, `src/engines/`, `src/services/sync/` 내 직접 `@tauri-apps/*`, `localStorage`, `indexedDB`, 비승인 직접 네트워크 `fetch`/`XMLHttpRequest` 호출 `0건` 검증 (`npm run check:boundaries`)
- [x] `src/engines/`에서 `src/views/`, `src/stores/`, `src/services/` 상위 레이어 역의존 `0건` 검증
- [x] `package.json`에서 직접 `@tauri-apps/plugin-http` 의존 제거 및 `src-tauri/capabilities/default.json`의 와일드카드 `"http:default"` 권한 제거 완료

## 2. 보안·Zero Trust·자격증명 분리 검증 (`FR-007`~`FR-010`)

- [x] `index.html` Google Fonts 외부 `<link>` 제거 및 `src-tauri/tauri.conf.json` 명시적 `csp` (`style-src 'self' 'unsafe-inline' blob:`, `connect-src 'self' ipc: http://ipc.localhost blob: data:` 포함) 설정 및 Playwright(Chromium+WebKit) 루트 앱 CSP `connect-src` 차단 단언 E2E 검증 완료 *(10 passed / `T064` 중 SSRF 3자 교차 테스트 항목은 별도 유지)*
- [x] `src/engines/epub/epubEngine.ts` `validateEpubArchiveBounds` 사전 Zip Bomb 상한 검사 및 `sanitizeSectionDocument` 다층 정화(`<base>`, SVG active 태그, CSS `@import`/`expression()`/`url(...)` 차단 + `CONTENT_CSP` 메타 최상단 삽입)
- [x] `src/services/network/ssrfValidator.ts` + `scripts/remoteProxyGuard.mjs` Fail-Closed `Origin`/`Sec-Fetch-Site`, DNS Pinning(`pinnedLookup`), `X-Proxy-Session-Token` 논스 게이트, 5홉 리다이렉트 재검증, WebDAV `PROPFIND` `..`·제어문자 필터링 구현 및 단위·E2E 검증
- [x] `src/services/platform/credentialService.ts` + `src/services/network/webdavService.ts` 세션 메모리 기본 격리, 네이티브 OS 키체인(`tauri-plugin-keyring-store-api`), 웹 명시 동의(`webStorageConsent`), WebDAV `v1 -> v2` 평문 비밀번호 제거 마이그레이션 검증
- [x] `src-tauri/Cargo.toml` 및 `src-tauri/src/lib.rs`에 `safe_remote_fetch`(`reqwest 0.13` 단일 `rustls` 스택 + `PinnedSsrfResolver` 재사용), `allow_storage_dir` 조상 정규화/화이트리스트, `read_validated_book_file` (`#[cfg(desktop)]`·`tauri::ipc::Response`·화이트리스트/민감 경로 차단), `tauri_plugin_opener::init()` 및 `#[cfg(test)] mod tests` 구현·검증 (`npm run verify`, `cargo check && cargo test` `5 passed`, `exit 0`) *(크로스 타겟/실앱 OS·모바일 실기기 수동 검증은 `T059` 추적)*

## 3. 소스 무결성·버전 동기화·거버넌스 게이트 (`FR-011`, `FR-012`)

- [x] 프로덕션 소스(`src/`, `src-tauri/src/`) 내 `TODO`/`FIXME`/테스트 전용 우회 분기 및 직접 `@tauri-apps/plugin-http` 잔존 `0건` 확인 (`grep` 점검)
- [x] `scripts/check-version-sync.mjs`를 통한 `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json` (및 락파일 `package-lock.json`, `src-tauri/Cargo.lock`) 버전 일치(`0.1.6-alpha`) 검증
- [x] `scripts/check-commit-msg.mjs`를 통한 Conventional Commits + 한국어 요약 + 빈 줄 + 20자 이상 한국어 본문 검증 및 Merge/Revert 예외 검증
- [x] `scripts/verify.mjs` `cargo` 미설치 시 Fail-Closed exit `2` (`BLOCKED`) 및 `--frontend-only` 명시 시 exit `0` 동작 검증

## 4. Phase 9 수렴 검증 항목 (`T068`~`T071`)

- [x] `T068`: Rust `resolve_and_pin_host` `url::Host` 직접 분기로 대괄호 IPv6 리터럴(`http://[::1]/`, `http://[::ffff:169.254.169.254]/`, `http://[fc00::1]/`) 즉시 차단·DNS Pinning 키 정규화 및 `#[cfg(test)]` 단위 테스트 통과 (`resolve_and_pin_host_handles_ipv6_literals_without_dns`)
- [x] `T069`: Rust `is_sensitive_path` macOS/Windows 대소문자 비구분 ASCII 소문자 정규화(`/system`, `.SSH` 등 차단) 및 `#[cfg(test)]` 부정 단위 테스트 통과 (`is_sensitive_path_blocks_case_variants_when_case_insensitive`)
- [x] `T070`: Rust `safe_remote_fetch` 전체 요청·리다이렉트·스트림 수명 총합 데드라인(`compute_remaining_budget` / `TIMEOUT:`) 적용 및 `#[cfg(test)]` 단위 테스트 통과 (`compute_remaining_budget_enforces_total_deadline`)
- [x] `T071`: `src/services/sync/syncService.ts` `POST`/`GET` HTTP `response.ok` 검사(`SyncHttpError` + `isFatalSyncError` + `5xx` `local-hub` 폴백 / `4xx`·동의 오류 전파) + `tests/unit/syncService.spec.ts` 단위 테스트 통과 (`7 passed`)

## 5. Phase 10 (`0.1.6-alpha` 프리릴리즈 기준) 수렴 검증 항목 (`T072`~`T076`)

- [x] `T072`: `plan.md`, `quickstart.md`, `governance.md` 내 `0.1.5` 잔존 표기 → `0.1.6-alpha` 및 `macOS.signingIdentity: "-"`·`README.md`·`THIRD_PARTY_LICENSES.md`·`build-apple.yml` 정합성 반영
- [x] `T073`: `scripts/check-version-sync.mjs` 락파일(`package-lock.json`, `Cargo.lock`) 버전 일치 검증 확장 및 `tests/unit/governanceScripts.spec.ts` `0.1.6-alpha` 프리릴리즈/불일치 거부 단위 테스트 통과
- [x] `T074`: `.specify/memory/constitution.md` 상단 임시 `Sync Impact Report` HTML 주석 제거 및 버전 동기화 규범 정합 확인
- [x] `T075`: 루트 `build/` 구 `0.1.5` `.dmg` 제거 및 `0.1.6-alpha` Ad-Hoc 서명 `.dmg` 정합 반영 + `.github/workflows/build-apple.yml` Node `24` LTS 및 `npm run verify` 선행 게이트 추가
- [x] `T076`: `README.md` macOS Ad-Hoc 서명(`signingIdentity: "-"`)·`xattr -cr` 안내 반영 및 `THIRD_PARTY_LICENSES.md`·`codesign --verify --deep --strict` 검증 완료
