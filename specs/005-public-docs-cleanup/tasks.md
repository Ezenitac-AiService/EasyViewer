---
description: "국문·영문 공개 문서 정리 — 작업 목록"
---

# Tasks: 국문·영문 공개 문서 정리

**Input**: `specs/005-public-docs-cleanup/`의 plan.md, spec.md, research.md(R1–R7), data-model.md, contracts/readme-structure.md, contracts/doc-checks.md, quickstart.md

**Tests**: 헌법 제2원칙(TDD)에 따라 검사 규칙(D2–D7, 배너 위치)마다 실패하는 테스트를 먼저 쓴다. 문서 정리 작업은 그 검사를 통과시키는 구현이다.

**Organization**: 스펙의 사용자 시나리오(US1 첫 화면, US2 README 본문, US3 공개 문서 전체)별로 묶는다.

**국문·영문 동시 수정**: 헌법 제1원칙에 따라 한 쌍을 고치는 작업은 국문·영문을 같은 작업(같은 커밋)에서 함께 고친다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 다른 파일을 다루고 미완료 작업에 의존하지 않아 병렬 가능
- **[Story]**: US1, US2, US3

## Path Conventions

저장소 루트 기준. 공개 문서는 루트, 검사 스크립트 `scripts/`·`scripts/docs/`, 테스트 `tests/unit/`, 기록 `specs/005-public-docs-cleanup/verification/`.

---

## Phase 1: Setup

- [ ] T001 기준선: `npm run verify`를 실행해 통과를 확인하고, 공개 문서 12개 파일의 줄 수와 README 국문·영문 절 제목 목록을 `specs/005-public-docs-cleanup/verification/baseline.md`에 적는다
- [ ] T002 정리 전 README 정보 항목 대조표를 만든다: `README.md`·`README.en.md`의 절, 표 행, 명령 줄을 항목마다 한 줄로 적고 `before` 위치를 채운다(`after`·`status`는 비워 둠). 파일 `specs/005-public-docs-cleanup/verification/readme-inventory.md`(data-model §5)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 검사 규칙이 쓰는 Markdown 읽기 도구. 이 단계가 끝나야 D4–D7을 만들 수 있다.

- [ ] T003 `tests/unit/docsMarkdown.spec.ts`(신규)에 실패하는 테스트를 쓴다: (1) 코드 블록(``` 안)의 `#` 줄은 제목으로 세지 않고 `##`·`###` 제목 목록(수준·글자)을 순서대로 뽑음, (2) GitHub 앵커 규칙(research R5: 소문자화, 공백→`-`, 문자·숫자·`-`·`_` 밖 문장부호 제거, 한글 유지, 중복은 `-1`·`-2`)으로 `## 지원 플랫폼과 릴리스`→`지원-플랫폼과-릴리스`, `## Supported platforms and releases`→`supported-platforms-and-releases`, `## 개발·기여와 보안`→`개발기여와-보안`, 같은 제목 두 번→두 번째 `-1`, (3) 첫 `## ` 제목 앞 헤더 영역 추출, (4) NOTICE 일반 텍스트의 번호 절(`^\d+\. `) 목록 추출
- [ ] T004 `scripts/docs/markdown.mjs`(신규)에 T003의 함수(`headings`, `githubAnchor`, `headerArea`, `numberedSections`)를 구현해 T003을 통과시킨다. 450줄 이하

**Checkpoint**: Markdown 도구 준비 완료.

---

## Phase 3: User Story 1 - 처음 온 사용자가 첫 화면에서 앱과 받는 곳을 이해한다 (Priority: P1) 🎯 MVP

**Goal**: README 국문·영문 헤더를 contracts/readme-structure.md §1 순서로 정리(FR-001, FR-002, SC-001, SC-002, SC-005).

**Independent Test**: D7 검사 통과, 헤더만 읽고 다섯 질문 답변(quickstart §2).

### Tests for User Story 1 ⚠️

- [ ] T005 [P] [US1] `tests/unit/readmeHeader.spec.ts`(신규)에 D7 실패 테스트를 쓴다: 임시 저장소에서 헤더 요소 순서(제목 → 언어 전환 → 배지 6개 → 영문 배너 → 소개 → `> [!IMPORTANT]` → `> [!NOTE]`)가 다르면 실패; 배지 수가 6이 아니거나 순서(`ci`·`release-build`·`release`·`license`·`platform`·`forked-from`)가 다르면 실패; 플랫폼 배지 글자에 `Windows`가 있거나 등급 표시(`focus`·`source build`·`test build`)가 없으면 실패; 플랫폼 배지 앵커가 같은 언어 문서의 지원 플랫폼 절 앵커와 다르면 실패; 헤더 영역에 `support-scope:start`·`support-scope-en:start` 표식이나 라이선스 한 줄 안내가 있으면 실패; 국문·영문 헤더 요소 순서가 다르면 실패; 실제 저장소는 통과(정리 후)
- [ ] T006 [P] [US1] `tests/unit/supportScopeCheck.spec.ts`의 배너 테스트를 바꿔 실패를 확인한다: 배너가 13–15번째 줄이면서 첫 `## ` 제목 앞이면 통과, 16번째 줄 이후이거나 첫 `## ` 제목 뒤면 실패(research R1)

### Implementation for User Story 1

- [ ] T007 [US1] `scripts/docs/readmeHeader.mjs`(신규)에 D7을 구현하고 `scripts/check-doc-pairs.mjs`에서 호출해 T005의 규칙 테스트를 통과시킨다(실제 저장소 테스트는 T009 뒤 통과)
- [ ] T008 [US1] `scripts/check-support-scope.mjs`의 `checkBanner`를 "처음 15줄 안이고 첫 `## ` 제목 앞"으로 바꿔 T006을 통과시킨다
- [ ] T009 [US1] `README.md`·`README.en.md` 헤더를 contracts/readme-structure.md §1대로 다시 쓴다: 배지 6개(research R2, 출처 배지 이름 "forked from", 플랫폼 배지 `macOS (focus) | iOS (source build) | Linux · Android (test build)`), 배너는 배지 다음, 소개 문단, `> [!IMPORTANT]` 처음 실행 안내(→ `#설치와-처음-실행`/`#installation-and-first-launch`, 절은 US2에서 생기므로 그 전까지는 기존 macOS 설치 절 앵커를 쓰고 T016에서 바꿈), `> [!NOTE]` 포크·이슈 안내. 지원 범위 원문 블록은 헤더에서 빼고 국문·영문 모두 새 `## 지원 플랫폼과 릴리스`/`## Supported platforms and releases` 절 맨 위로 옮긴다(영문의 기존 "Supported platforms" 절 내용 포함). 라이선스 한 줄 안내는 기존 라이선스 절로 옮긴다. 완료 조건: `npm run check:identity`가 새 출처 배지 글자("forked from edith2580/EasyViewer")를 허용하는지 확인(실패하면 배지 글자를 정체성 검사의 허용 용도에 맞게 고치고, 검사 규칙은 바꾸지 않음)
- [ ] T010 [US1] `npm run verify`로 T005·T006 통과를 확인하고, quickstart §2 다섯 질문 점검표를 `specs/005-public-docs-cleanup/verification/first-screen.md`에 적는다(로컬 Markdown 미리보기 기준, GitHub 렌더링 확인은 T035)

**Checkpoint**: US1 단독으로 SC-001·SC-005 충족.

---

## Phase 4: User Story 2 - 사용자 정보가 앞에, 개발자 정보가 기여 가이드에 있다 (Priority: P2)

**Goal**: README 본문 절 구성(contracts/readme-structure.md §2)과 개발자용 상세의 기여 가이드 이동(FR-003–FR-006, SC-003 일부, SC-006, SC-009).

**Independent Test**: README 절 순서 대조, 정보 항목 대조표 빈칸 0, D4 통과.

### Tests for User Story 2 ⚠️

- [ ] T011 [P] [US2] `tests/unit/docPairs.spec.ts`에 D4 실패 테스트를 쓴다: 임시 저장소에서 쌍의 `##`·`###` 수준 순서가 다르면 실패(코드 블록 안 `#` 줄은 무시), NOTICE 번호 절 수와 NOTICE.en.md `## N.` 절 수가 다르면 실패, 같으면 통과
- [ ] T012 [P] [US2] `tests/unit/forkDocs.spec.ts`에 실패 테스트를 쓴다: `README.md`·`README.en.md`의 `##` 절이 contracts §2의 8개 순서와 같음; 사용자용 절이 "개발·기여와 보안"보다 앞; README에 디렉터리 구조 트리·검증 스크립트 목록·버전 동기화 파일 목록·릴리스 절차 본문이 없음(SC-009); `CONTRIBUTING.md`에 `## 개발 환경과 구조`·`## 검증 명령`·`## 버전과 빌드`·`## CI와 릴리스`, `CONTRIBUTING.en.md`에 대응 영문 절이 있음; 지원 플랫폼 절 맨 위에 원문 블록이 있고 등급 표에 5개 플랫폼 행이 있음; 기존 "원저작자 앱과의 차이"·"Windows 사용자 안내" 테스트는 그대로 통과
- [ ] T013 [P] [US2] 조작 방법 근거 확인(FR-005: 자동 테스트가 확인하는 조작만 표에 넣음): research R6의 키보드·탭 조작마다 이를 확인하는 기존 테스트를 찾아 `specs/005-public-docs-cleanup/verification/controls.md`에 적고, 덮지 않는 조작은 `tests/unit/readerNavigation.spec.ts`(신규)에 실패→통과 테스트를 추가한다(`useReaderNavigation`의 `handleKeydown`·`handleReaderTap` 실제 경로 사용, 테스트 대역은 엔진·DOM 경계만). 확인하지 못한 조작은 표에서 뺀다고 기록

### Implementation for User Story 2

- [ ] T014 [US2] `scripts/docs/outline.mjs`(신규)에 D4를 구현하고 `scripts/check-doc-pairs.mjs`에 연결해 T011을 통과시킨다. 실제 저장소에서 어긋난 쌍은 T015·T016·US3에서 고친다(그 전까지 해당 검사 실패를 허용하지 않도록 T014는 T015와 같은 커밋으로 묶는다)
- [ ] T015 [US2] `README.md`·`README.en.md` 본문을 contracts §2의 8개 절 순서로 재구성한다: 차이 표 이동, 지원 플랫폼 등급 표(src/config/supportScope.ts·최소 요구 사양과 일치)와 체크섬·테스트용 빌드 표식 안내, `### 최소 요구 사양`, 기능, `## 조작 방법` 표(T013에서 확인한 항목만), 설치와 처음 실행(macOS, Linux·Android 테스트용 빌드, iOS, `### Windows 사용자 안내` 기존 2문장), 소스 빌드 요약, 개발·기여와 보안 링크, 라이선스와 저작권 고지
- [ ] T016 [US2] README에서 빼낸 개발자용 상세(기술 스택, 디렉터리 구조, 검증 스크립트, 버전 동기화 파일, Rust 툴체인, 플랫폼별 빌드 명령, CI·릴리스 구조와 절차)를 `CONTRIBUTING.md`·`CONTRIBUTING.en.md`의 새 절 4개로 옮기고, 기존 "품질 게이트" 절과 겹치는 설명을 합친다. T009의 처음 실행 안내 링크를 새 `#설치와-처음-실행`/`#installation-and-first-launch`로 바꾼다
- [ ] T017 [US2] `verification/readme-inventory.md`의 모든 항목에 `after` 위치와 `status`(kept·moved·merged)를 채우고 빈칸 0을 확인한다(SC-006)
- [ ] T018 [US2] `npm run verify`로 T011·T012·T013 통과를 확인한다

**Checkpoint**: US2로 SC-006·SC-009 충족, README 쌍 D4 통과.

---

## Phase 5: User Story 3 - 모든 공개 문서가 같은 형식과 용어를 쓴다 (Priority: P3)

**Goal**: 여섯 쌍의 맨 위 형식·제목·쌍 구조·링크·용어(FR-007–FR-010, SC-003, SC-004, SC-007).

**Independent Test**: D2–D6 통과.

### Tests for User Story 3 ⚠️

- [ ] T019 [P] [US3] `tests/unit/docPairs.spec.ts`에 D2·D3 실패 테스트를 쓴다: 첫 줄이 제목이 아니거나 언어 전환이 제목 바로 다음이 아니거나 언어 전환 다음 목적 문단이 없으면 실패; README는 예외로 언어 전환 다음에 배지가 와도 통과하고 헤더 소개 문단을 목적 문장으로 봄(D7과 중복 판정하지 않음); NOTICE.en.md·THIRD_PARTY_LICENSES.en.md는 목적 문장 바로 다음 참고 번역 인용이 없으면 실패; 제목이 research R7 표와 다르거나 괄호 병기가 있으면 실패; NOTICE는 일반 텍스트 첫 줄을 제목으로 인정
- [ ] T020 [P] [US3] `tests/unit/docLinks.spec.ts`(신규)에 D5 실패 테스트를 쓴다: 상대 링크 대상 파일이 없으면 실패, `파일#앵커`·`#앵커`가 대상 문서 제목 앵커에 없으면 실패, 외부 `http(s)` 링크는 검사하지 않음, 코드 블록 안 링크는 무시
- [ ] T021 [P] [US3] `tests/unit/docTerms.spec.ts`(신규)에 D6 실패 테스트를 쓴다: "원작", "원작자", "원본 앱", "원본 저장소", "upstream app"이 있으면 실패; "원본 파일은 그대로"처럼 데이터 원본 뜻의 "원본"은 통과; "업스트림"/"upstream"은 같은 줄에 Git 작업 낱말(병합·동기화·체리픽·원격·`upstream-base`·merge·sync·cherry-pick·remote·fetch)이 있으면 통과, 없으면 실패; CHANGELOG는 맨 위 릴리스 절만 검사; 인용 블록 안 원문 인용은 예외

### Implementation for User Story 3

- [ ] T022 [US3] `scripts/docs/topFormat.mjs`(신규)에 D2·D3을 구현하고 `scripts/check-doc-pairs.mjs`에 연결해 T019를 통과시킨다
- [ ] T023 [US3] `scripts/docs/links.mjs`(신규)에 D5를 구현하고 연결해 T020을 통과시킨다
- [ ] T024 [US3] `scripts/docs/terms.mjs`(신규)에 D6을 구현하고 연결해 T021을 통과시킨다. `scripts/check-doc-pairs.mjs`는 450줄 이하로 유지
- [ ] T025 [P] [US3] `SECURITY.md`·`SECURITY.en.md`: 제목·목적 문장(R7), 용어(R4), 깨진 링크 수정
- [ ] T026 [P] [US3] `CHANGELOG.md`·`CHANGELOG.en.md`: 제목 "변경 이력"/"Changelog"(괄호 병기 제거), 목적 문장, 맨 위 릴리스 절 용어 정리. 과거 절 내용은 바꾸지 않음
- [ ] T027 [P] [US3] `NOTICE`·`NOTICE.en.md`: 제목 "Pagelight 저작권 및 변경 고지"/"Pagelight copyright and modification notice", 목적 문장, "원작" 등을 표준 용어로(고지 사실·날짜·저작권자 불변), 번호 절 수 일치, 영문 참고 번역 표시 유지
- [ ] T028 [P] [US3] `THIRD_PARTY_LICENSES.md`·`THIRD_PARTY_LICENSES.en.md`: 제목 "서드파티 라이선스 고지"/"Third-party licenses", 머리말 목적 문장. 표·고지 본문은 바꾸지 않음
- [ ] T029 [US3] `CONTRIBUTING.md`·`CONTRIBUTING.en.md`(T016 뒤): 목적 문장, "업스트림"/"upstream"을 Git 작업 맥락만 남기고 나머지는 "원저작자 저장소"/"original repository"로, 깨진 링크 수정
- [ ] T030 [US3] `README.md`·`README.en.md`(T015 뒤): 용어(R4)와 링크·앵커 최종 정리
- [ ] T031 [US3] `npm run verify`로 D1–D7 전부와 기존 공개 문구 검사 통과를 확인한다

**Checkpoint**: US3로 SC-003·SC-004·SC-007 충족.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T032 저장소의 다른 위치(`docs/`, `.github/`, `src/`, 릴리스 노트 템플릿)에서 README·CONTRIBUTING의 옛 앵커(예: `#지원-기능`, `#supported-platforms`)를 가리키는 링크를 찾아 고친다. `docs/windows-*.md` 보존 기록은 고치지 않는다
- [ ] T033 `CHANGELOG.md`·`CHANGELOG.en.md` 맨 위 미출시 절에 005 변경(README 헤더·절 구성, 기여 가이드 이동, 공개 문서 형식·용어, 검사 D2–D7)을 적는다
- [ ] T034 quickstart §1·§3·§4·§5를 실행해 결과를 `specs/005-public-docs-cleanup/verification/quickstart-run.md`에 적는다. §5는 ImageViewer README(국문·영문)와 같은 문장이 공개 문서에 없는지 대조한다(FR-012)
- [ ] T035 브랜치를 푸시한 뒤 GitHub에서 `README.md`·`README.en.md` 렌더링을 열어 경고 문법(`[!IMPORTANT]`·`[!NOTE]`) 표시, 배지 6개 연결 대상, 앵커 이동을 확인하고 `verification/first-screen.md`를 갱신한다(quickstart §2, SC-002). 실행하지 못하면 `BLOCKED`로 적는다
- [ ] T036 005 `spec.md` Status를 실제 결과로 갱신한다

---

## Dependencies & Execution Order

- **Setup (Phase 1)** → **Foundational (Phase 2)** → 사용자 시나리오.
- **US1 (Phase 3)**: Phase 2 후. MVP.
- **US2 (Phase 4)**: US1 후(같은 README 파일, T009가 지원 플랫폼 절을 먼저 만듦). T014는 T015와 같은 커밋.
- **US3 (Phase 5)**: Phase 2 후 검사(T019–T024)는 US1·US2와 병렬 가능. 문서 수정 T025–T028은 병렬, T029는 T016 뒤, T030은 T015 뒤.
- **Polish (Phase 6)**: 모든 시나리오 후. T035는 푸시가 필요하다.

### Within Each User Story

- 실패하는 테스트 → 검사 구현 → 문서 수정 → verify.
- 국문·영문은 같은 작업에서 함께 고친다.

### Parallel Opportunities

- US1: T005·T006 병렬.
- US2: T011·T012·T013 병렬.
- US3: T019·T020·T021 병렬, T025·T026·T027·T028 병렬.

---

## Parallel Example: User Story 3

```text
T019 tests/unit/docPairs.spec.ts (D2·D3)
T020 tests/unit/docLinks.spec.ts (D5)
T021 tests/unit/docTerms.spec.ts (D6)
```

```text
T025 SECURITY 쌍
T026 CHANGELOG 쌍
T027 NOTICE 쌍
T028 THIRD_PARTY_LICENSES 쌍
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1·2 완료.
2. US1 완료 → 첫 화면 다섯 질문 점검(T010).
3. 여기서 멈춰도 첫 화면 문제(헤더 순서, 배지 등급, 처음 실행 안내)는 해결된다.

### Incremental Delivery

1. US1 → README 헤더.
2. US2 → README 본문과 기여 가이드 이동.
3. US3 → 나머지 공개 문서 형식·용어와 검사.
4. Polish → 다른 위치 링크, CHANGELOG, 렌더링 확인.
