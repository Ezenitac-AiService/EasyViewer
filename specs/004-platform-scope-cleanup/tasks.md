---
description: "지원 범위 재정렬과 독립 포크 분리 마무리 — 작업 목록"
---

# Tasks: 지원 범위 재정렬과 독립 포크 분리 마무리

**Input**: `specs/004-platform-scope-cleanup/`의 plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: 헌법 제2원칙(TDD, NON-NEGOTIABLE)에 따라 모든 구현 작업 앞에 실패하는 테스트 작업을 둔다. 테스트가 실패하는 것을 확인한 뒤 구현한다.

**Organization**: 스펙의 사용자 시나리오(US1–US4)별로 묶는다. 각 시나리오는 독립적으로 검증할 수 있다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 다른 파일을 다루고 미완료 작업에 의존하지 않아 병렬 가능
- **[Story]**: US1(지원 범위 문구), US2(테스트 빌드 릴리스), US3(Windows 제거), US4(003 정리)

## Path Conventions

저장소 루트 기준. 프런트엔드 `src/`, Rust `src-tauri/`, 스크립트 `scripts/`, 테스트 `tests/unit/`·`tests/e2e/`, 워크플로 `.github/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 공용 준비. 코드 변경 없음.

- [ ] T001 기준선 확인: `npm run verify`와 `npm run test:e2e`가 현재 `004-platform-scope-cleanup` 브랜치에서 통과하는지 실행하고, 결과(테스트 수, 번들 크기)를 `specs/004-platform-scope-cleanup/verification/baseline.md`에 적는다
- [ ] T002 [P] 저장소에 이슈 라벨 `test-build`(설명 "Linux·Android 테스트용 빌드 / Linux·Android test build")를 만든다. 메인테이너 승인 후 `gh label create test-build --repo Ezenitac-AiService/EasyViewer`로 실행하고 결과를 `specs/004-platform-scope-cleanup/verification/baseline.md`에 적는다(research R6)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 여러 시나리오가 함께 쓰는 지원 범위 원문 모델. US1·US2·US3이 모두 의존한다.

**⚠️ CRITICAL**: 이 단계가 끝나기 전에는 US1–US3 구현을 시작하지 않는다.

- [ ] T003 `tests/unit/supportScope.spec.ts`에 실패하는 테스트를 쓴다: `SUPPORT_SCOPE.focus`=`['macOS']`, `maintained`=`['iOS']`, `testBuild`=`['Linux','Android']`, `excluded`=`[{platform:'Windows', recommend: UPSTREAM_REPO_URL}]`, `androidMinimum`=`'7.0 (API 24)'`; `renderSupportScopeKo()`·`renderSupportScopeEn()`·`supportScopeBannerEn()`가 contracts/support-scope-text.md §1–§3 문장과 글자까지 같음; `windowsWording:'unsupported-only'`이면 두 언어 모두 넷째 줄만 바뀌고 줄 수는 같음
- [ ] T004 `src/config/supportScope.ts`를 고쳐 T003을 통과시킨다. `unsupported` 필드를 `excluded`로 이름을 바꾸고, `testBuild`·`androidMinimum` 필드와 `renderSupportScopeEn()`을 추가한다. `src/components/common/AboutDialog.vue`와 `scripts/check-support-scope.mjs`의 `unsupported` 참조를 `excluded`로 맞춘다

**Checkpoint**: 원문 모델이 한·영 문장을 모두 만든다.

---

## Phase 3: User Story 1 - 사용자가 플랫폼별 약속 수준을 정확히 안다 (Priority: P1) 🎯 MVP

**Goal**: 공개 문서(국문·영문), 배너, 앱 정보 화면, 이슈 양식의 지원 범위가 단일 원문과 같다(FR-001–FR-003, SC-001, SC-001a).

**Independent Test**: `node scripts/check-support-scope.mjs`가 국문·영문 블록과 이슈 양식 규칙을 모두 검사해 0건이고, e2e 앱 정보 화면 시나리오가 새 문구를 확인한다.

### Tests for User Story 1 ⚠️

- [ ] T005 [P] [US1] `tests/unit/supportScopeCheck.spec.ts`에 실패하는 테스트를 쓴다: 영문 필수 문서(`README.en.md`·`NOTICE.en.md`·`CHANGELOG.en.md`·`CONTRIBUTING.en.md`)에 `<!-- support-scope-en:start -->` 블록이 없거나 영문 원문과 다르면 실패; `docs/windows-migration.md`·`docs/windows-eol-notice.md`는 블록 검사에서 제외; 핵심 버그 양식 선택지가 정확히 `macOS, iOS`, 테스트 빌드 버그 양식(`bug_report_test_build.yml`) 선택지가 정확히 `Linux, Android`이고 `labels`에 `test-build` 포함·대응 일정 미보장 안내 포함; 어떤 양식에도 `Windows` 선택지가 없음(contracts/support-scope-text.md §4–§5)
- [ ] T006 [P] [US1] `tests/unit/aboutDialog.spec.ts`와 `tests/e2e/accessibility-and-ux.spec.ts`의 지원 범위 기대 문구를 새 한국어 원문(테스트용 빌드 문장 포함)으로 바꿔 실패를 확인한다

### Implementation for User Story 1

- [ ] T007 [US1] `scripts/check-support-scope.mjs`에 영문 블록 검사(`REQUIRED_EN_BLOCK_FILES`, `renderSupportScopeEn` 비교, 보존 기록 2개 제외)와 두 버그 양식 규칙을 구현해 T005를 통과시킨다. 450줄을 넘으면 `scripts/support-scope/` 아래로 나눈다
- [ ] T008 [US1] 한국어 블록이 있는 모든 문서(`README.md`, `NOTICE`, `CHANGELOG.md`, `CONTRIBUTING.md`, `.github/release-notes.md`, `docs/android-signing.md`, `docs/ios-build.md`, `docs/mobile-migration.md`)의 블록을 새 원문으로 다시 만들고, `README.md` 맨 위 영문 배너를 `supportScopeBannerEn()`으로 바꾼다
- [ ] T009 [US1] 영문 문서(`README.en.md`, `NOTICE.en.md`, `CHANGELOG.en.md`, `CONTRIBUTING.en.md`)에 영문 블록을 넣고, 블록과 겹치던 손으로 쓴 지원 범위 목록·문장을 블록으로 대체한다. `README.en.md` 맨 위 배너도 맞춘다
- [ ] T010 [US1] `README.md`·`README.en.md`의 "지원 플랫폼"·"최소 요구 사양" 문장과 `CONTRIBUTING.md`·`CONTRIBUTING.en.md`의 지원 등급 표를 헌법 v6.1.0 등급(중점·유지·테스트 빌드·제외)으로 고친다
- [ ] T011 [P] [US1] `.github/ISSUE_TEMPLATE/bug_report.yml`의 플랫폼 선택지를 `macOS`, `iOS`로 줄이고, 새 `.github/ISSUE_TEMPLATE/bug_report_test_build.yml`을 만든다: 이름 "테스트 빌드 버그 신고 / Test build bug report", `labels: ["bug", "test-build"]`, 맨 위 한·영 안내 "테스트용 빌드라 품질·대응 일정을 보장하지 않습니다 / Test builds come with no guarantee of quality or response time", 필수 확인 항목, 플랫폼 선택지 `Linux`·`Android`, 기존 버전·OS·재현 절차 항목. `feature_request.yml` 플랫폼 선택지는 4개 유지
- [ ] T012 [US1] `npm run verify`와 `npm run test:e2e`로 T005·T006 통과를 확인한다

**Checkpoint**: US1 단독으로 SC-001·SC-001a 충족.

---

## Phase 4: User Story 2 - 테스트용 빌드가 정식 빌드로 오해받지 않는다 (Priority: P1)

**Goal**: Linux·Android 산출물의 `-test` 표식과 노트 안내, 실패 격리, 연속 누락 제한, 보안 제외, 서명 규칙(FR-004–FR-007, SC-002–SC-004).

**Independent Test**: 게이트 단위 테스트(quickstart §2)와 리허설 2회(정상, `fail_linux=true`, quickstart §3).

### Tests for User Story 2 ⚠️

- [ ] T013 [P] [US2] `tests/unit/releaseGate.spec.ts`에 게시 단계 실패 테스트를 쓴다: `.deb`·`.AppImage`·`.rpm`·`.apk` 이름이 `/-test(-rehearsal)?\.(deb|AppImage|rpm|apk)$/`에 맞지 않으면 실패; `.dmg` 이름에 `-test`가 있으면 실패; `--linux-result failure`인데 `--notes` 파일에 `<!-- pagelight:omitted linux=build-failed -->`가 없으면 실패; `.github/release-exclusions.json`에 있는 플랫폼의 산출물이 있으면 실패(contracts/release-test-builds.md §3)
- [ ] T014 [P] [US2] `tests/unit/releaseGate.spec.ts`에 빌드 전 단계 실패 테스트를 쓴다: 최근 게시 릴리스 3개 연속 Linux `build-failed`면 실패, `security` 누락도 횟수에 포함, Android `no-signing-key`는 횟수에서 제외, 표식 도입 이전 릴리스는 계산 제외, 이전 릴리스 조회 실패는 BLOCKED(종료 코드 2), 게이트 출력 `linux`·`android`가 exclusions와 서명 키 여부를 따름(research R4·R5, data-model §3–§4)
- [ ] T015 [P] [US2] `tests/unit/releaseWorkflow.spec.ts`에 실패 테스트를 쓴다: `release.yml`에 `build-macos`·`build-linux`·`build-android` 작업이 따로 있고, `build-linux`·`build-android`에 `needs.gate.outputs.<p> == 'true'` 조건, `publish`의 `if`가 `!cancelled()`와 `needs.build-macos.result == 'success'`를 포함, `continue-on-error` 없음, `publish`가 Linux·Android 파일 이름에 `-test`를 붙이는 단계와 `--linux-result`·`--android-result`·`--notes` 인자를 쓰는 게시 게이트를 가짐, 리허설 입력 `fail_linux`·`fail_android`가 `workflow_dispatch`에만 있음(contracts/release-test-builds.md §1)
- [ ] T016 [P] [US2] `tests/unit/releaseNotes.spec.ts`(신규)에 실패 테스트를 쓴다: 노트 렌더 함수가 포함된 테스트 빌드 플랫폼 목록·미보장 범위·`bug_report_test_build.yml` 링크를 담은 한·영 "테스트용 빌드" 절을 만들고, 빠진 플랫폼마다 한·영 안내와 `<!-- pagelight:omitted <platform>=<reason> -->`(reason은 `build-failed`·`security`·`no-signing-key` 중 하나)를 붙임

### Implementation for User Story 2

- [ ] T017 [US2] `.github/release-exclusions.json`을 빈 배열 `[]`로 만들고, 형식 `{ "platform": "linux"|"android", "advisory": "<식별자>", "since": "YYYY-MM-DD" }`(macOS·iOS 불가, 결함 세부 금지)를 검증하는 함수를 `scripts/check-release-gate.mjs`에 추가한다
- [ ] T018 [US2] `scripts/release-notes.mjs`(신규)에 T016의 노트 렌더 함수와 CLI(`--linux-result`, `--android-result`, `--android-reason`, `--out`)를 구현한다
- [ ] T019 [US2] `scripts/check-release-gate.mjs`에 게시 단계 검사(테스트 표식, macOS 표식 금지, 누락 표식, 보안 제외)와 CLI 인자 `--notes`·`--linux-result`·`--android-result`를 구현해 T013을 통과시킨다. 450줄을 넘으면 `scripts/release-gate/` 아래로 나눈다
- [ ] T020 [US2] `scripts/check-release-gate.mjs`에 빌드 전 단계 연속 누락 계산(`gh release list`·`gh release view`로 최근 게시 릴리스 3개 조회, 초안·리허설 제외)과 게이트 출력 계산을 구현해 T014를 통과시킨다
- [ ] T021 [US2] `.github/workflows/release.yml`을 contracts/release-test-builds.md §1 구조로 다시 짠다: `build-desktop` 행렬을 `build-macos`·`build-linux`로 나누고, `build-android` 조건을 게이트 출력으로 바꾸고, 리허설 입력 `fail_linux`·`fail_android`를 추가하고, `publish`가 이름 변경(`-test`, 리허설 APK는 `-test-rehearsal`)·노트 렌더(`scripts/release-notes.mjs`)·체크섬·게시 게이트를 차례로 실행하게 한다. 최상위 `contents: read`, `publish`만 `contents: write` 유지. T015 통과 확인
- [ ] T022 [P] [US2] `tests/unit/forkDocs.spec.ts`에 실패 테스트를 쓴다: `SECURITY.md`·`SECURITY.en.md`에 테스트용 빌드 보안 범위 문장(공통 코드 보안 수정은 같은 릴리스에 반영, 테스트 빌드 전용 미수정 취약점은 고칠 때까지 해당 플랫폼 제외)이 국문·영문 모두 있어야 함
- [ ] T023 [US2] `SECURITY.md`·`SECURITY.en.md`에 테스트용 빌드 보안 보장 범위를 적는다: 공통 코드 보안 수정은 같은 릴리스에 반영, 테스트 빌드 전용 미수정 취약점은 고칠 때까지 해당 플랫폼을 릴리스에서 제외(FR-005b, 헌법 v6.1.0)
- [ ] T024 [US2] `.github/release-notes.md`의 Android·Linux 관련 문장을 테스트용 빌드 기준으로 고치고, `docs/maintainer-runbook.md`에 보안 제외 선언·연속 누락 정지 시 대응 절차를 추가한다. 보안 제외 절차에는 "이미 게시된 이전 릴리스 노트에 해당 산출물의 미수정 취약점 안내를 덧붙인다(`gh release edit`, 메인테이너 승인, 결함 세부 금지)"를 포함한다(스펙 경계 상황)
- [ ] T025 [US2] `npm run verify`로 T013–T016·T022 통과를 확인하고, `node scripts/check-release-gate.mjs --static`이 통과하는지 확인한다

**Checkpoint**: US2 단독으로 게이트 단위 시나리오 전부 충족. 리허설은 Phase 7에서 실행.

---

## Phase 5: User Story 3 - 저장소에 Windows를 위한 것이 남지 않는다 (Priority: P2)

**Goal**: 동작 기준 Windows 전용 요소 제거, 보존 기록 표시, 재유입 검사(FR-008–FR-011, SC-005, SC-006, SC-008).

**Independent Test**: `node scripts/check-windows-exclusion.mjs` 0건, `npm run verify`·CI 핵심 작업 통과, Windows 형식 경로 거부 테스트 통과.

### Tests for User Story 3 ⚠️

- [ ] T026 [P] [US3] `tests/unit/windowsExclusion.spec.ts`(신규)에 실패 테스트를 쓴다: 임시 저장소에서 규칙 W1–W7(contracts/windows-exclusion.md §2) 각각을 위반하는 파일이 있으면 실패하고 위반 파일 경로를 메시지에 담음; 허용 목록(data-model §5: 지원 범위 원문, `config.yml`, `docs/windows-*.md`, `specs/00[1-3]-*`, `path_guard.rs` 차단 목록, `check-release-gate.mjs`, 검사 스크립트 자신, `src-tauri/gen/android/gradlew.bat`) 안의 같은 내용은 통과; 단어 "windows"만 있는 파일(예: `tauri.conf.json`의 `"windows": [...]` 창 목록)은 통과; 실제 저장소는 통과
- [ ] T027 [P] [US3] `tests/unit/identityCheck.spec.ts`에서 `src-tauri/icons/icon.ico` 해시 항목을 기대하는 부분을 찾아, 파일이 없어도 아이콘 검사가 통과해야 한다는 실패 테스트로 바꾼다
- [ ] T028 [P] [US3] `src-tauri/src/security/path_guard.rs`의 테스트 모듈에 "대소문자 무시 판정은 macOS에서만 켜진다"(`cfg!(target_os = "macos")`와 같음)를 확인하는 테스트를 추가하고, 기존 Windows 형식 경로 차단 테스트(T009 계열)가 그대로 있는지 확인한다
- [ ] T029 [P] [US3] `src-tauri/src/migration/tests/`에 실패 테스트를 쓴다: Linux 경로 규칙(데이터 기준 폴더 아래 `com.edith.easyviewer`→`com.ezenitac.easyviewer` 한 쌍만 복사, `WebKitCache` 제외, WebKit 저장소 쌍 없음, 되돌리기 대상은 새 데이터 폴더 하나)을 macOS 호스트에서도 시험할 수 있도록 OS를 인자로 받는 경로 생성 함수를 호출해 검증; 원본 보존·중단 후 되돌리기·재실행 중복 없음이 Linux 규칙에서도 성립(FR-015, SC-004a)
- [ ] T030 [P] [US3] `tests/unit/forkDocs.spec.ts`에 실패 테스트를 쓴다: `docs/windows-migration.md`·`docs/windows-eol-notice.md` 맨 위에 contracts/windows-exclusion.md §3 보존 기록 표시가 있음; `README.md`·`README.en.md`의 Windows 절이 원저작자 안내 1문장과 보존 기록 링크 1문장만 담고 CI 컴파일 문장이 없음; `CONTRIBUTING.md`·`CONTRIBUTING.en.md`에 "Windows 전용 코드 불가" 문장이 있고 Windows CI 문장이 없음(contracts/windows-exclusion.md §4)

### Implementation for User Story 3

- [ ] T031 [US3] `scripts/check-windows-exclusion.mjs`(신규)를 구현해 T025를 통과시키고, `scripts/verify.mjs`에 "Windows Exclusion" 단계로 연결한다
- [ ] T032 [P] [US3] `src-tauri/Cargo.toml`의 대상 조건에서 `windows`를 빼고, `src-tauri/src/main.rs`의 `windows_subsystem` 속성을 지운다(research R1)
- [ ] T033 [P] [US3] `src-tauri/src/security/path_guard.rs`와 `src-tauri/src/migration/engine.rs`의 `cfg!(any(target_os = "macos", target_os = "windows"))`를 `cfg!(target_os = "macos")`로 바꾸고 T028 통과를 확인한다. Windows 형식 경로 차단 목록과 그 테스트는 지우지 않는다(FR-010)
- [ ] T034 [US3] `src-tauri/src/migration/paths.rs`의 `MigrationPaths::for_platform`과 `data_dir_excludes`를 OS 식별 값(`macos`·`linux`·기타)을 받는 내부 함수와 현재 OS를 넘기는 공개 함수로 나눠 T029를 통과시킨다. 동작(macOS·Linux 경로, 기타 OS는 `None`)은 바꾸지 않는다. 파일당 450줄을 넘지 않는다
- [ ] T035 [P] [US3] `src-tauri/capabilities/desktop.json`의 `platforms`에서 `"windows"`를 지우고(`"windows": ["main"]` 창 목록은 유지), `src-tauri/tauri.conf.json`의 `bundle.icon`에서 `icons/icon.ico`를 지운다
- [ ] T036 [P] [US3] `src-tauri/icons/icon.ico`, `Square30x30Logo.png`, `Square44x44Logo.png`, `Square71x71Logo.png`, `Square89x89Logo.png`, `Square107x107Logo.png`, `Square142x142Logo.png`, `Square150x150Logo.png`, `Square284x284Logo.png`, `Square310x310Logo.png`, `StoreLogo.png`를 지우고, `scripts/check-identity.mjs`의 `icon.ico` 해시 항목을 지워 T026을 통과시킨다
- [ ] T037 [P] [US3] `src-tauri/deny.toml`의 `targets`에서 `x86_64-pc-windows-msvc`를 지우고 주석을 고친다. `node scripts/check-licenses.mjs --write`로 고지를 다시 만들고 `cd src-tauri && cargo deny check`가 통과하는지 확인한다
- [ ] T038 [US3] `docs/windows-migration.md`·`docs/windows-eol-notice.md` 맨 위에 contracts/windows-exclusion.md §3의 보존 기록 표시를 넣는다(나머지 내용은 바꾸지 않음)
- [ ] T039 [US3] 공개 문서의 Windows 문장을 contracts/windows-exclusion.md §4대로 줄인다: `README.md`·`README.en.md` "Windows 사용자 안내" 절, `CONTRIBUTING.md`·`CONTRIBUTING.en.md` Windows 이슈 처리 절. 국문·영문을 같은 변경에서 고친다
- [ ] T040 [US3] `npm run verify`(cargo check·test 포함), `npm run test:e2e`, `node scripts/check-windows-exclusion.mjs`로 US3을 확인한다

**Checkpoint**: US3 단독으로 SC-005·SC-008 충족. 번들 빌드 확인은 Phase 7 CI·리허설.

---

## Phase 6: User Story 4 - 003 독립 포크 분리가 닫힌다 (Priority: P2)

**Goal**: 003 열린 항목 분류와 스펙 상태 갱신(FR-012–FR-014, SC-007).

**Independent Test**: `grep -n '^- \[ \]' specs/003-independent-fork-separation/tasks.md`가 T062 한 줄만 보여 주고, 003 `spec.md` Status가 실제 결과를 반영한다.

### Tests for User Story 4 ⚠️

- [ ] T041 [US4] `tests/unit/specTasks.spec.ts`(신규)에 실패 테스트를 쓴다: `specs/003-independent-fork-separation/tasks.md`의 `- [ ]` 항목이 T062 하나뿐이고 T062 줄에 "메인테이너 작업"이 있음; 범위 제외 항목에는 "범위 제외:"와 근거, 이관 항목에는 "004로 이관:"이 있음; 003 `spec.md`의 `**Status**:`가 `Draft`가 아님

### Implementation for User Story 4

- [ ] T042 [US4] `specs/003-independent-fork-separation/tasks.md`를 research R10 표대로 분류한다: T048·T049·T005·T102는 범위 제외(사유와 헌법 v6.0.0/v6.1.0 근거), T006·T076(macOS 부분)·T077(macOS 부분)은 "004로 이관: 004 T051", T076·T077의 Linux·Android 부분은 범위 제외, T100은 이 작업으로 완료, T062는 메인테이너 작업으로 유지(data-model §6 표기)
- [ ] T043 [US4] 004로 이관한 macOS 실기기 항목을 이 문서의 Phase 7 작업 T051로 연결하고, `specs/003-independent-fork-separation/verification/migration-linux.md`에 "테스트 빌드 등급 전환으로 실기기 검증 범위 제외, 이전 동작은 자동 테스트로 확인(004 FR-015)"을 적는다
- [ ] T044 [US4] `specs/003-independent-fork-separation/spec.md`의 Status를 "Completed (2026-11-24): 분리·첫 독립 릴리스 완료, Windows 관련·Linux/Android 실기기 항목 범위 제외, macOS 실기기 잔여 항목은 004로 이관"으로 바꾸고, 지원 범위 문단에 헌법 v6.1.0 등급으로 바뀌었다는 개정 메모를 붙인다
- [ ] T045 [US4] T041 통과를 확인하고 `/speckit-analyze`로 003 spec·plan·tasks 정합성을 점검해 결과를 `specs/003-independent-fork-separation/verification/quickstart-run.md` 끝에 요약한다

**Checkpoint**: US4로 SC-007 충족.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 실제 릴리스 경로·기존 릴리스·실기기 확인. 공개 작업은 메인테이너 승인 후 실행한다.

- [ ] T046 CI 6개 작업(필수 `verify`·`licenses`·`macos-build`, 보고 `ios-sim-build`·`android-debug`)이 PR에서 통과하는지 확인하고 실행 링크를 `specs/004-platform-scope-cleanup/verification/release-rehearsal.md`에 적는다(번들 아이콘 제거 후 빌드 확인 포함, research R1)
- [ ] T047 (메인테이너 승인 후) 정상 리허설: `gh workflow run release.yml -f rehearsal=true -f tag_name=v1.0.0-alpha.2-rehearsal`. macOS 표식 없음, Linux `-test`, Android `-test-rehearsal`, 노트의 "테스트용 빌드" 절을 확인하고 `verification/release-rehearsal.md`에 기록한 뒤 초안을 지운다(SC-002)
- [ ] T048 (메인테이너 승인 후) 실패 주입 리허설: 같은 명령에 `-f fail_linux=true`. macOS·Android 게시, Linux 없음, 노트에 Linux 누락 안내와 `<!-- pagelight:omitted linux=build-failed -->`를 확인하고 기록한 뒤 초안을 지운다(SC-003a). 리허설 태그는 남기지 않는다
- [ ] T049 (메인테이너 승인 후) `v1.0.0-alpha.1` 릴리스 노트 끝에 Linux 테스트용 빌드 한·영 안내와 `<!-- pagelight:omitted android=no-signing-key -->`를 `gh release edit`로 덧붙이고, 산출물·체크섬이 그대로인지 확인해 기록한다(FR-007, research R8)
- [ ] T050 `v0.1.6-alpha`·`v0.1.6-beta`의 산출물 수(각 6개)·지원 종료 고지·고지에서 링크한 `docs/windows-migration.md`가 열리고 보존 기록 표시가 보이는지, `CHANGELOG.md`·`CHANGELOG.en.md`의 Windows 지원 종료 항목이 남아 있는지 확인해 기록한다(SC-006, FR-009)
- [ ] T051 (macOS 실기기) 003에서 이관한 항목을 실행한다: 데이터 이전 시나리오 1·6·8(003 quickstart §3), 레거시 키체인 접근 창(003 S2), 원저작자 앱과의 공존 설치(003 S3 macOS 부분). 실행하지 못하면 `BLOCKED`로 기록한다(`verification/macos-followups.md`)
- [ ] T052 `README.md`·`README.en.md`·`CHANGELOG.md`·`CHANGELOG.en.md`에 004 변경(지원 등급, 테스트 빌드 표식, Windows 정리)을 반영하고 `node scripts/check-doc-pairs.mjs`로 국문·영문 쌍을 확인한다
- [ ] T053 quickstart.md §1–§6 전체를 실행해 결과를 `specs/004-platform-scope-cleanup/verification/quickstart-run.md`에 적고, 004 `spec.md` Status를 실제 결과로 갱신한다

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 의존 없음.
- **Foundational (Phase 2)**: Setup 후. US1–US3을 막는다.
- **US1 (Phase 3)**: Phase 2 후.
- **US2 (Phase 4)**: Phase 2 후. US1과 독립(릴리스 노트 링크가 T011의 양식 파일 이름을 쓰므로 T018은 T011 뒤가 안전).
- **US3 (Phase 5)**: Phase 2 후. T039는 US1의 T009·T010과 같은 문서를 고치므로 그 뒤에 한다.
- **US4 (Phase 6)**: 의존 없음(문서만). T042·T043은 Phase 7의 T051을 참조.
- **Polish (Phase 7)**: US1–US4 후. T047–T049는 메인테이너 승인 필요.

### User Story Dependencies

- US1 ↔ US2: 파일이 겹치지 않음(US2는 `release.yml`·게이트·노트·SECURITY). T018 → T011 순서만 지킨다.
- US3: `README`·`CONTRIBUTING`에서 US1과 겹친다 → T039는 T010 뒤.
- US1 ↔ US2: 둘 다 `.github/release-notes.md`를 고친다 → T024는 T008 뒤.
- US4: 독립.

### Within Each User Story

- 테스트 작업이 먼저이고 실패를 확인한 뒤 구현한다(헌법 II).
- 스크립트 구현 → 워크플로·문서 연결 → 통합 확인 순서.

### Parallel Opportunities

- Phase 1: T002는 T001과 병렬.
- US1: T005·T006 병렬, 구현 중 T011은 T007–T010과 병렬.
- US2: T013–T016·T022 병렬.
- US3: T026–T030 병렬, T032·T033·T035·T036·T037 병렬(서로 다른 파일).
- US4는 US1–US3과 병렬.

---

## Parallel Example: User Story 3

```bash
# 실패 테스트 동시 작성:
Task: "T026 tests/unit/windowsExclusion.spec.ts"
Task: "T027 tests/unit/identityCheck.spec.ts icon.ico 기대 변경"
Task: "T028 path_guard.rs 대소문자 판정 테스트"
Task: "T029 Linux 이전 경로 규칙 테스트"
Task: "T030 forkDocs 보존 기록·Windows 문장 테스트"

# 파일이 겹치지 않는 제거 작업 동시 진행:
Task: "T032 Cargo.toml·main.rs"
Task: "T035 desktop.json·tauri.conf.json"
Task: "T036 Windows 아이콘·check-identity"
Task: "T037 deny.toml·고지 재생성"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 → Phase 2(원문 모델) → Phase 3(US1).
2. 멈추고 `check-support-scope`·e2e로 SC-001·SC-001a 확인.
3. 사용자에게 보이는 약속이 먼저 맞춰진다.

### Incremental Delivery

1. Setup + Foundational → 원문 모델 준비.
2. US1 → 공개 문구 일치(MVP).
3. US2 → 다음 릴리스부터 테스트 빌드 표식·격리.
4. US3 → Windows 정리와 재유입 차단.
5. US4 → 003 종료.
6. Polish → 리허설·기존 릴리스 노트·macOS 실기기.

### Parallel Team Strategy

Phase 2 이후 US1·US2·US4를 동시에, US3은 US1의 문서 작업(T009·T010) 뒤에 시작한다.

---

## Notes

- 공개 문서를 고칠 때는 국문·영문을 같은 변경에서 고친다(헌법 I).
- 릴리스 편집·리허설·라벨 생성은 외부에 보이는 작업이라 메인테이너 승인 후 실행한다.
- 실기기가 필요한 작업은 실행하지 못하면 통과로 쓰지 않고 `BLOCKED`로 남긴다(헌법 VI).
- 커밋 메시지는 한국어 Conventional Commits 형식(헌법 I)을 따른다.
