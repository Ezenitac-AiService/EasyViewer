# Implementation Plan: 지원 범위 재정렬과 독립 포크 분리 마무리

**Branch**: `004-platform-scope-cleanup` | **Date**: 2026-11-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-platform-scope-cleanup/spec.md`

## Summary

헌법 v6.1.0의 플랫폼 등급(중점 macOS, 유지 iOS, 테스트 빌드 Linux·Android, 제외 Windows)을 저장소 전체에 반영하고 003을 닫는다. 네 갈래로 나눈다.

1. **지원 범위 원문 한·영화**: `src/config/supportScope.ts`가 한국어·영문 문장을 모두 만들고, 공개 문서의 국문·영문 블록을 자동 검사한다.
2. **릴리스의 테스트 빌드 처리**: `release.yml`을 macOS 핵심 작업과 Linux·Android 테스트 빌드 작업으로 나눠 실패를 격리한다. 테스트 빌드 산출물 이름에 `-test` 표식을 붙이고, 게시 전 게이트가 표식·누락 안내·연속 누락·보안 제외를 검사한다.
3. **Windows 전용 요소 제거**: 동작 기준(Windows용으로 빌드·실행할 때만 효과)으로 고른 항목을 지우고, 재유입 검사를 추가한다. 지원 종료 이력은 보존 기록으로 남긴다.
4. **003 정리**: 열린 작업을 완료·범위 제외·이관으로 분류하고 003 스펙 상태를 갱신한다.

## Technical Context

**Language/Version**: TypeScript ~5.6 (Vue 3.5 SFC), Node 24 스크립트(ESM `.mjs`), Rust stable(edition 2021, `rustc >= 1.90`), GitHub Actions YAML

**Primary Dependencies**: Tauri 2 (`@tauri-apps/cli ^2.12`), Vite 6, Vitest 3, Playwright, `cargo-deny`, `cargo-about`, GitHub CLI(`gh`, 릴리스 노트·이전 릴리스 조회)

**Storage**: 저장소 파일만 쓴다. 릴리스 간 상태(연속 누락 횟수)는 별도 저장소 없이 게시된 릴리스의 산출물 목록과 릴리스 노트의 기계 판독 표식에서 다시 계산한다(research R4).

**Testing**: Vitest(스크립트·원문 단위 테스트, 임시 저장소 픽스처), `cargo test`(Rust 변경분), Playwright(앱 정보 화면 문구), 릴리스 리허설(`workflow_dispatch`, 실패 주입 입력)

**Target Platform**: 핵심 macOS 11.0+(universal), 유지 iOS 15.0+(소스 빌드), 테스트 빌드 Linux x64(Ubuntu 22.04+)·Android 7.0+(arm64), 제외 Windows

**Project Type**: desktop/mobile app(Tauri) + 저장소 거버넌스 스크립트·워크플로

**Performance Goals**: 해당 없음. 단, 릴리스 게이트는 `gh` 조회 실패 시 통과가 아니라 BLOCKED(종료 코드 2)를 낸다.

**Constraints**:
- 기존 릴리스 산출물·체크섬·태그를 바꾸지 않는다(FR-007, FR-009).
- `android:init`이 `src-tauri/gen/android`를 다시 만들 때 차이가 없어야 한다(003 S4). 생성물에 들어 있는 Windows용 Gradle 래퍼(`gradlew.bat`)는 지우지 않는다(research R2).
- 최상위 워크플로 권한은 `contents: read`를 유지한다. 이슈 자동 라벨에 쓰기 권한 워크플로를 쓰지 않는다(research R6).
- 파일당 450줄, 초기 번들 480 kB 등 기존 게이트를 그대로 지킨다.

**Scale/Scope**: 스크립트 4~5개(신규 1), 워크플로 1개 재구성, 원문 모듈 1개, 공개 문서 약 14개, 이슈 양식 3개, Rust·설정 파일 약 6개, 003 문서 3개

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 원칙·게이트 | 판정 | 근거 |
|---|---|---|
| I. 언어·공개 문서 병행 | PASS | 영문 지원 범위 블록을 원문에서 생성해 자동 비교(FR-002). 공개 문서 변경은 국문·영문을 같은 변경에서 고친다. 계획·태스크는 한국어 |
| II. TDD | PASS | 원문 렌더러, 게이트 판정(표식·누락·연속 누락·보안 제외), Windows 재유입 검사, 문서 블록 검사 모두 실패 테스트를 먼저 쓴다(quickstart §1) |
| III. 우회 금지 | PASS | 게이트는 실제 산출물 목록·릴리스 노트를 읽는다. 리허설의 실패 주입은 빌드를 실제로 건너뛰게 하는 입력이며 게이트 판정을 바꾸지 않는다 |
| IV. 근거 | PASS | Tauri 아이콘·번들 규칙, GitHub 이슈 양식 기능, Actions 작업 결과 규칙을 research에 출처와 함께 적는다 |
| V. 플랫폼 추상화 | PASS | Windows 분기 제거는 추상화 계층 안에서만 일어난다. Linux 이전 경로는 유지(FR-015) |
| VI. 다층 검증 | PASS | 실기기가 없는 Linux·Android 항목은 BLOCKED가 아니라 헌법상 범위 밖으로 분류하고 근거를 남긴다. macOS 실기기 항목은 BLOCKED로 남긴다 |
| VII. Zero Trust | PASS | Windows 형식 경로 거부 검사는 유지(FR-010). 테스트 빌드 보안 하한을 게이트로 강제(FR-005b) |
| VIII. 독립 포크 운영 | PASS | 지원 종료 고지·링크 문서는 보존 기록(헌법 v6.1.0 제외 조항). 원저작자 앱 비교·표현 원칙 유지 |
| 지원 범위·릴리스 게이트 | PASS | 테스트 빌드 표식 강제, Windows 산출물 금지 유지, 정기 권고 점검 유지 |
| 문서 분리 게이트 | PASS | 경로·도구 이름은 plan·research·contracts에만 둔다 |

위반 없음. Complexity Tracking 불필요.

## Project Structure

### Documentation (this feature)

```text
specs/004-platform-scope-cleanup/
├── plan.md              # 이 파일
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   ├── support-scope-text.md      # 원문 한·영 문장과 블록 규칙
│   ├── release-test-builds.md     # 릴리스 작업 구조, 표식, 게이트 판정
│   └── windows-exclusion.md       # 제거 목록, 허용 목록, 재유입 검사
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
src/config/supportScope.ts               # 등급·한국어 원문·영문 원문·배너
src/components/common/AboutDialog.vue    # 원문 사용(변경 최소)
scripts/
├── check-support-scope.mjs              # 국문·영문 블록 검사, 이슈 양식 규칙
├── check-release-gate.mjs               # 테스트 빌드 표식·누락 안내·연속 누락·보안 제외
├── check-windows-exclusion.mjs          # 신규: Windows 전용 요소 재유입 검사
├── check-identity.mjs                   # icon.ico 해시 항목 정리
└── verify.mjs                           # 새 검사 연결
.github/
├── workflows/release.yml                # macOS 핵심 / Linux·Android 테스트 빌드 분리
├── release-exclusions.json              # 신규: 보안상 제외 선언(R5)
├── release-notes.md                     # 테스트 빌드 안내 자리
└── ISSUE_TEMPLATE/                      # 핵심 버그 / 테스트 빌드 버그 분리
src-tauri/
├── Cargo.toml, src/main.rs, tauri.conf.json, capabilities/desktop.json
├── deny.toml                            # Windows 대상 제거
├── src/security/path_guard.rs, src/migration/engine.rs   # cfg 분기 정리(입력 검증은 유지)
└── icons/                               # Windows 전용 아이콘 제거
docs/                                    # 지원 범위 블록(국문), windows-* 보존 기록 표시
README·CONTRIBUTING·SECURITY·CHANGELOG·NOTICE (+ *.en.md)
specs/003-independent-fork-separation/   # tasks.md·spec.md·verification 정리
tests/unit/                              # 각 검사·원문 테스트
```

**Structure Decision**: 기존 단일 저장소 구조를 그대로 쓴다. 새 파일은 재유입 검사 스크립트 하나와 보안 제외 선언 파일 하나뿐이다.

## Phase 0·1 산출물

- [research.md](./research.md): R1–R8 결정(Windows 전용 판정, 생성물 예외, 표식 형식, 연속 누락 계산, 보안 제외 선언, 이슈 양식 분리, 작업 분리 방식, 기존 릴리스 처리)
- [data-model.md](./data-model.md): 지원 범위 원문, 테스트 빌드 산출물, 누락 기록, 보안 제외 선언, Windows 허용 목록, 003 작업 분류
- [contracts/](./contracts/): 원문 문장·블록, 릴리스 테스트 빌드, Windows 제외
- [quickstart.md](./quickstart.md): 검증 절차

## Post-Design Constitution Check

설계 후 다시 점검했다. 판정은 위 표와 같다(위반 없음). 추가로 확인한 점:

- 릴리스 작업 분리 후에도 `release.yml`의 최상위 권한은 `contents: read`, 게시 작업만 `contents: write`다(정적 게이트 유지).
- `continue-on-error`를 쓰지 않는다. 실패 격리는 작업 결과(`needs.<job>.result`)로 판단한다(research R7).
- Windows 재유입 검사는 단어 등장이 아니라 동작 기준 패턴만 본다(FR-011).
