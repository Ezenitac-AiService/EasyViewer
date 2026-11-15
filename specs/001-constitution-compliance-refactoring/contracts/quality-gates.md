# 품질·거버넌스 게이트 계약 (`FR-001`~`FR-003`, `FR-011`, `FR-012`)

## 1. `package.json` 표준 검증 스크립트 계약

| 스크립트 | 목적 | 대응 기준 |
| :--- | :--- | :--- |
| `npm test` | 1계층 Vitest 단위·경계 격리 테스트 실행 (`vitest run`) | `FR-001`, `SC-001` (30초 이내 100% 통과) |
| `npm run test:e2e` | 2계층 Playwright 실제 브라우저(렌더링·페이지네이션·CSP·탭) 테스트 실행 | `FR-001`, `FR-003`, `SC-001`, `SC-004` |
| `npm run test:perf` | 2계층 런타임 성능 기준선 측정 및 비교 검증 | `FR-012`, `SC-006` |
| `npm run check:boundaries` | `src/views/`, `src/stores/`, `src/components/`, `src/engines/`, `src/services/sync/` 내 직접 `@tauri-apps/*`, `localStorage`, `indexedDB`, 비승인 직접 네트워크 `fetch`/`XMLHttpRequest` 참조 탐지 | `FR-005`, `SC-002` (0건) |
| `npm run check:version` | `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json` (및 존재하는 경우 `package-lock.json`, `src-tauri/Cargo.lock`) 버전 일치 검증 | `FR-011`, `SC-005` |
| `npm run check:commit-msg <file>` | Conventional Commits 접두사 + 한국어 요약 + 빈 줄 + 상세 본문 형식 검증 | `FR-011`, `SC-005` |
| `npm run verify` | `build` + `test` + `check:boundaries` + `check:version` + Rust 백엔드 검증(`cargo check && cargo test`) 실행. `cargo` 미설치 시 기본 종료 코드는 **`2` (`BLOCKED`)** 로 실패·차단 처리하며, 프론트엔드 전용 로컬 확인 시 `--frontend-only` 플래그를 명시한 경우에만 `BLOCKED` 로그 출력 후 `0` 반환 | `FR-011`, `SC-005` |

---

## 2. 경계 정적 검사 규칙 (`scripts/check-boundaries.mjs`)

- **검사 대상 디렉토리**: `src/views`, `src/stores`, `src/components`, `src/engines`, `src/services/sync`
- **금지 패턴**:
  - `@tauri-apps/` 문자열 import 또는 동적 import
  - `localStorage` 또는 `indexedDB` 직접 접근
  - 비승인 직접 네트워크 호출(`fetch(` / `XMLHttpRequest` — `epubEngine.ts`의 로컬 `blob:` URL 메타데이터 읽기 등 명시적 비원격 예외 제외)
  - `src/engines/`에서 `src/views/`, `src/stores/`, `src/services/` 상위 레이어 역의존
- **허용 예외**: `src/services/platform/`, `src/services/storage/`, `src/services/network/` (플랫폼 추상화 경계 내부), `tests/` (테스트 파일)
- **종료 코드**: 위반 0건이면 `0`, 1건 이상이면 위반 파일·줄 번호 출력 후 `1`.

---

## 3. 커밋 메시지 검증 규칙 (`scripts/check-commit-msg.mjs`)

1. **첫 줄(Header)**: `^(feat|fix|docs|style|refactor|perf|test|build|ci|chore)(\([a-z0-9-]+\))?!?: .{4,}$` 및 한글(`[가-힣]`) 1자 이상 포함 필수.
2. **둘째 줄**: 빈 줄(`""`) 필수.
3. **본문(Body)**: 3번째 줄 이후 비공백 본문 필수, 한글 포함 및 최소 20자 이상(변경 이유·내용·영향 범위 서술).
4. **예외**: Merge/Revert 자동 커밋 메시지(`^Merge ` / `^Revert `)는 통과.

---

## 4. 리서치·무결성 체크리스트 계약

- 구현/리뷰 단계 산출물(`plan.md`, 리뷰 보고서 등)에는 외부 기술 결정의 공식 레퍼런스 출처와 내부 검증의 관찰된 파일·실행 결과를 기록한다.
- 프로덕션 코드(`src/`, `src-tauri/src/`) 내 `TODO`/`FIXME` 미구현 스텁이나 테스트 전용 고정 반환 우회 분기가 존재하지 않음을 점검한다.
