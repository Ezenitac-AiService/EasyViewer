# Implementation Plan: 국문·영문 공개 문서 정리

**Branch**: `005-public-docs-cleanup` | **Date**: 2026-11-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/005-public-docs-cleanup/spec.md`

## Summary

공개 문서 여섯 쌍(README, CONTRIBUTING, SECURITY, CHANGELOG, NOTICE, THIRD_PARTY_LICENSES)의 구조·흐름·용어를 정리한다. README 헤더는 제목 → 언어 전환 → 배지 6개 → 영문 배너 → 소개 → 처음 실행 안내 → 포크·이슈 안내 순서로 바꾸고, 지원 범위 원문 블록은 "지원 플랫폼과 릴리스" 절로 옮긴다. README 본문은 사용자용 절을 앞에 두고, 개발자용 상세는 기여 가이드로 옮긴다. 형제 프로젝트 ImageViewer README는 참고 자료로만 쓴다(명확화 1). 다시 어긋나지 않도록 기존 `scripts/check-doc-pairs.mjs` 검사를 맨 위 형식, 쌍 구조, 링크·앵커, 용어, README 헤더 규칙으로 넓힌다.

## Technical Context

**Language/Version**: Markdown(GitHub Flavored Markdown, 경고 문법 포함), 검사 스크립트는 Node.js 24 ES 모듈(`.mjs`)

**Primary Dependencies**: 새 의존성 없음. 기존 `scripts/check-doc-pairs.mjs`, `scripts/check-support-scope.mjs`, `src/config/supportScope.ts`(배너·원문 블록 원문)

**Storage**: 저장소 파일

**Testing**: Vitest(`tests/unit/docPairs.spec.ts`, `tests/unit/supportScopeCheck.spec.ts`, `tests/unit/forkDocs.spec.ts`), `npm run verify`

**Target Platform**: GitHub 웹의 Markdown 렌더링(저장소 첫 화면)

**Project Type**: 문서 정리와 저장소 검사 스크립트

**Performance Goals**: 해당 없음(검사는 기존 verify 단계 안에서 1초 이내)

**Constraints**: 파일당 450줄 이하(검사 스크립트), 지원 범위 원문 글자 불변, 금지 표현 검사 통과, 국문·영문 같은 변경에서 수정, NOTICE 고지 사실 불변, 외부 URL 접근 없이 검사

**Scale/Scope**: 공개 문서 12개 파일(README 약 300줄 ×2), 기여 가이드에 새 절 4개(×2), 검사 규칙 7개(D1–D7)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 원칙 | 판정 | 근거 |
|---|---|---|
| I. 언어(국문·영문 병행) | PASS | 여섯 쌍을 같은 변경에서 함께 고치고, 쌍 구조 일치를 자동 검사(D4)로 강제한다. 명세·계획은 한국어, 스크립트 코드는 영어 |
| II. TDD | PASS | D2–D7과 배너 검사 변경은 실패하는 테스트를 먼저 쓴다. 문서 정리는 그 검사를 통과시키는 구현이다 |
| III. 무결성 | PASS | 검사는 실제 파일을 읽어 판정한다. 테스트 입력에 맞춘 분기를 두지 않는다 |
| IV. 근거 | PASS | 외부: GitHub 경고·앵커 규칙, shields.io 배지 문서(research R1·R2·R5). 내부: 파일·심볼·실측 횟수(R4·R6) |
| V. 플랫폼 추상화 | 해당 없음 | 앱 코드 변경 없음. 조작 방법 표는 기존 동작을 문서로 옮길 뿐이다 |
| VI. 의심·다층 검증 | PASS | 내용 보존 대조표(SC-006), 첫 화면 점검표(SC-002), 확인하지 못한 조작은 적지 않음 |
| VII. Zero Trust | 해당 없음 | 보안 경계 변경 없음. SECURITY 문서는 형식·용어만 정리 |
| VIII. 독립 포크 운영 | PASS | 표현 원칙·금지 표현 검사 유지, 원저작자 앱 비교는 기존 검증 가능한 사실 표 유지, 형제 프로젝트 문장 복사 금지(FR-012) |
| 지원 범위 단일 원문 | PASS | 원문 블록은 위치만 옮기고 글자는 `src/config/supportScope.ts`에서 만든 그대로(기존 블록 검사) |
| 공개 문서 병행 게이트 | PASS | verify의 기존 "Public Docs Korean/English Pairs" 단계(`scripts/check-doc-pairs.mjs`)를 넓힌다 |

**Phase 1 설계 후 재검사**: [data-model.md](data-model.md)와 [contracts/](contracts/)를 반영해 다시 점검했다. 판정은 바뀌지 않았다. 배너 위치 기준을 12줄에서 15줄·첫 절 앞으로 바꾸는 것은 기존 규칙의 의미("첫 화면 안")를 유지하며 기준 숫자만 언어 전환 검사와 맞춘다(research R1).

## Project Structure

### Documentation (this feature)

```text
specs/005-public-docs-cleanup/
├── plan.md
├── research.md          # R1–R7
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── readme-structure.md
│   └── doc-checks.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks 에서 생성
```

### Source Code (repository root)

```text
README.md, README.en.md                  # 헤더·절 구성 재정리
CONTRIBUTING.md, CONTRIBUTING.en.md      # README에서 옮긴 개발자 절 4개 추가, 용어 정리
SECURITY.md, SECURITY.en.md              # 맨 위 형식·용어
CHANGELOG.md, CHANGELOG.en.md            # 제목·맨 위 형식, 최신 절 용어
NOTICE, NOTICE.en.md                     # 제목·맨 위 형식·용어(고지 사실 불변)
THIRD_PARTY_LICENSES.md, .en.md          # 제목·머리말
scripts/check-doc-pairs.mjs              # D1–D7 진입점
scripts/docs/                            # 새 규칙 모듈(outline, links·anchors, terms, readme header)
scripts/check-support-scope.mjs          # 배너 위치 기준 변경
tests/unit/docPairs.spec.ts              # D2–D7 테스트
tests/unit/supportScopeCheck.spec.ts     # 배너 위치 테스트
specs/005-public-docs-cleanup/verification/readme-inventory.md  # 내용 보존 대조표
```

**Structure Decision**: 앱 소스(`src/`, `src-tauri/`)는 바꾸지 않는다. 검사는 기존 verify 단계 안에서 돈다.

## Complexity Tracking

위반 없음.
