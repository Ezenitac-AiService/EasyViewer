---

description: "독립 포크 분리 작업 목록"
---

# Tasks: 독립 포크 분리

**Input**: `specs/003-independent-fork-separation/`의 설계 문서

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: 헌법 제2원칙(TDD, NON-NEGOTIABLE)에 따라 코드·스크립트 변경마다 **실패하는 테스트를 먼저** 작성한다. 테스트 작업은 같은 단계의 구현 작업보다 앞에 둔다.

**Organization**: 사용자 스토리별로 묶었다. 단, plan.md "단계와 순서"의 제약(보안 조율 선행, US5·US6 동시 출시, FR-025 순서)을 지킨다.

**메인테이너 수동 작업**: `(메인테이너)` 표시 작업은 원격 푸시, 외부 연락, 비밀값·키 보관처럼 에이전트가 대신할 수 없거나 사용자 승인이 필요한 일이다. 결과는 `verification/` 기록 파일에 남긴다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 병렬 가능(다른 파일, 미완료 작업에 의존하지 않음)
- **[Story]**: 해당 사용자 스토리(US1–US7)
- 모든 경로는 저장소 루트(`/Users/dev/DEV/EasyViewer`) 기준이다

---

## Phase 1: Setup (공통 준비)

**Purpose**: 브랜치, 기록 폴더, 무시 규칙 준비

- [X] T001 `main`에서 기능 브랜치 `003-independent-fork-separation`을 만들고, 헌법 맨 위의 Sync Impact Report HTML 주석을 지운다(`.specify/memory/constitution.md`). 내용은 커밋 메시지 본문으로 옮긴다
- [X] T002 [P] 실측 기록 폴더 `specs/003-independent-fork-separation/verification/README.md`를 만든다. 기록 파일 목록과 각 파일의 필수 항목(날짜, 환경, 실행 명령, 결과, `PASS`/`FAIL`/`BLOCKED`)을 적는다: `spikes.md`, `security-coordination.md`, `upstream-notice.md`, `migration-macos.md`, `migration-linux.md`, `coexistence.md`, `windows-migration.md`, `release-gate.md`
- [X] T003 [P] `.gitignore`에 `*.jks`, `*.keystore`, `*.p12`, `keystore.properties`를 추가해 서명 키가 커밋되지 않게 한다

---

## Phase 2: Foundational (모든 스토리의 선행 조건)

**Purpose**: 핵심 가정 실측(스파이크), 기준선 태그, 보안 조율, 공통 지원 범위 원문

**⚠️ CRITICAL**: T004–T010의 결과로 plan이 바뀔 수 있다. T014(보안 통지) 전에는 원저작자 앱과의 비교·결함 언급을 공개 문서에 쓰지 않는다.

### 스파이크 (research.md S1, S2, S4, S5)

- [X] T004 스파이크 S1(macOS)을 진행한다. 결과는 `specs/003-independent-fork-separation/verification/spikes.md`에 기록한다.
  - 구 식별자로 `npm run mac:build`를 실행하고, 책 3권·진행률·책갈피·설정을 만든다.
  - 식별자만 `com.ezenitac.easyviewer`로 바꾼 임시 로컬 빌드(커밋 금지)를 실행하기 전에 다음 두 폴더를 새 식별자 위치로 수동 복사한다: `~/Library/Application Support/com.edith.easyviewer`, `~/Library/WebKit/com.edith.easyviewer/WebsiteData`(경로·`Default/salt`·`-wal`/`-shm` 존재는 research F24로 확인됨).
  - 원저작자 앱을 실행한 상태에서 복사했을 때의 결과(WAL 불일치 여부)와, 다른 앱의 `~/Library/WebKit` 폴더를 읽을 때 개인정보 보호 권한 창이 뜨는지 기록한다.
  - 새 데이터 폴더에 시작 시점에 생기는 파일 목록을 기록해 contracts/data-migration.md "비어 있음" 정의에 고정한다.
  - IndexedDB·`localStorage` 데이터가 보이는지, salt 파일 필요 여부, 1 GB 서재 복사 시간(APFS 복제 여부)을 기록한다.
- [ ] T005 [P] 스파이크 S1(Linux)을 T004와 같은 절차로 진행한다. 대상 폴더는 `~/.local/share/com.edith.easyviewer`이다. 결과는 `verification/spikes.md`에 기록한다
- [ ] T006 스파이크 S2를 진행한다. 결과는 `verification/spikes.md`에 기록한다.
  - 일회성 테스트 바이너리로 `tauri_plugin_keyring_store::KeyringStore::new("com.edith.easyviewer").get_password("easyviewer:webdav:<id>")`를 새 식별자 빌드에서 호출한다.
  - macOS에서는 키체인 접근 대화상자 표시 여부와 거부 시 오류 종류를, Linux Secret Service에서는 동작 여부를 기록한다.
- [X] T007 [P] 스파이크 S4를 진행한다. 결과는 `verification/spikes.md`에 기록한다.
  - 깨끗한 체크아웃에서 `npm run android:init`을 실행한 뒤 `git status`로 `src-tauri/gen/android/app/build.gradle.kts`가 덮어써지는지 확인한다
- [X] T008 [P] 스파이크 S5를 진행한다. 결과는 `verification/spikes.md`에 기록한다.
  - 서명 비밀값 없이 `npm run ios:init && npm run ios:build -- --debug --target aarch64-sim`가 통과하는지 확인한다
- [X] T009 T004–T008 결과를 반영해 `specs/003-independent-fork-separation/research.md`(R1·R2·R6·R12)와 `plan.md` 위험 표를 고친다.
  - S1이 실패하면 서재 재구성을 기본 경로로 바꾸고 `contracts/data-migration.md` 상태 표를 갱신한다.
  - macOS WebKit 저장소의 실제 경로를 `contracts/data-migration.md` §1에 적는다

### 분기 기준선 (FR-012)

- [X] T010 `44c4d37`에 주석 태그 `upstream-base-v0.1.6`을 로컬로 만든다. 태그 메시지에 다음을 적는다.
  - 기존 lightweight 태그 `v0.1.6`과 같은 커밋이라는 사실
  - 업스트림 `v0.2.0`(`eaf6471`)·`v0.2.1`(`40c4605`) 미병합 사실
  - 생성 일자
- [X] T011 (메인테이너) `git push origin upstream-base-v0.1.6`으로 태그를 게시하고, `git ls-remote --tags origin upstream-base-v0.1.6` 결과를 `verification/release-gate.md` 항목 1에 기록한다

### 업스트림 보안 조율 (FR-013, R11)

- [X] T012 보안 영향 목록 초안을 **저장소 밖**(메인테이너 비공개 위치)에 만든다.
  - `git diff 44c4d37 8248627 -- src src-tauri scripts`에서 보안 수정(경로 검증, SSRF, CSP, 자격증명, 콘텐츠 정화)을 추린다.
  - 각 항목이 업스트림 최신 릴리스(조회 시점 최신, 현재 `v0.2.1`) 소스에 남아 있는지 대조한다.
  - 001 수정(PR #2)은 회귀 여부만 확인한다.
  - 초안은 커밋하지 않는다
- [X] T013 (메인테이너) T012 목록을 원저작자에게 비공개 경로로 전달하거나 수정을 제안한다.
  - 원저작자 저장소는 비공개 취약점 신고가 **꺼져 있다**(research F31). 공개 이슈·PR·토론에 결함 내용을 쓰는 것은 금지한다.
  - 먼저 비공개 연락 경로를 확보한다. 방법: 공개 채널에 "보안 관련 비공개 연락을 원한다"는 내용만 남기기, 또는 비공개 취약점 신고 기능을 켜 달라고 요청하기.
  - 경로를 확보하기 전에는 T014·T038·T095를 진행하지 않는다
  - 공개 채널에 연락을 요청한 날부터 30일 동안 응답이 없으면(research R11), T014에 "통지 시도 기록"(요청 날짜, 채널, 결함 내용을 쓰지 않았다는 사실)을 남기고 다음 단계로 간다. 이 경우에도 T038의 원저작자 앱 비교와 결함 언급은 쓰지 않는다
- [X] T014 통지가 끝나면 `specs/003-independent-fork-separation/verification/security-coordination.md`에 다음 요약만 기록한다(data-model §6): 통지 날짜, 경로 종류, 항목 범주와 개수, 원저작자 응답, 미수정 결함 공개 기준(통지 후 90일). 결함 세부와 재현 방법은 쓰지 않는다

### 지원 범위 원문 (FR-006, R15)

- [X] T015 [P] `tests/unit/supportScope.spec.ts`에 실패하는 테스트를 작성한다.
  - 값 검사: `focus`=`["macOS","iOS","Linux"]`, `maintained`=`["Android"]`, `unsupported`=Windows + 원저작자 URL `https://github.com/edith2580/EasyViewer`, `devOnly`=`["Web"]`, `iosDelivery`=`"source-build-only"`
  - `renderKo()` 결과가 `contracts/support-scope-wording.md` §1 원문과 일치
  - `bannerEn`이 한 줄
  - Windows 축소 문구 옵션(`windowsWording: 'recommend' | 'unsupported-only'`)이 원문만 바꾸는지
  - `linuxBaseline`(보장 범위: Ubuntu 22.04 이상 또는 동급 배포판, deb·AppImage 형식, WebKitGTK 4.1, X11·Wayland)이 `renderKo()` 결과에 포함되는지(spec 엣지 케이스 "Linux 배포판 차이")
- [X] T016 `src/config/supportScope.ts`를 구현해 T015를 통과시킨다. 프레임워크 의존 없는 순수 모듈로 만든다

**Checkpoint**: 스파이크 결과가 반영되었고, 기준선 태그가 게시되었으며, 보안 통지가 끝났다 → 공개 문서 작업을 시작할 수 있다

---

## Phase 3: User Story 1 - 라이선스 준수와 출처·저작권 귀속 (Priority: P1) 🎯 MVP

**Goal**: 귀속·변경 고지, `GPL-3.0-only` 선언, 라이선스 자동 감사, 앱 정보 화면

**Independent Test**: `npm run verify`와 `cd src-tauri && cargo deny check`가 통과한다. NOTICE·CHANGELOG·README·정보 화면 4곳에 귀속·변경 고지가 있다. 모든 메타데이터가 `GPL-3.0-only`이고 LICENSE 해시는 그대로다(SC-001).

### Tests for User Story 1 ⚠️

- [X] T017 [P] [US1] `tests/unit/licenseAudit.spec.ts`에 `scripts/check-licenses.mjs`의 실패하는 테스트를 작성한다.
  - (a) `package-lock.json` 비개발 패키지에 `license` 필드가 없으면 실패
  - (b) 허용 목록 밖 라이선스면 실패
  - (c) `dev: true` 패키지는 무시
  - (d) 복수 라이선스(`jszip` `MIT OR GPL-3.0-or-later`)는 `scripts/license-policy.json`의 선택값이 있어야 통과
  - (e) `THIRD_PARTY_LICENSES.md` 요약 표·`src/generated/about.json` `thirdParty[]`가 실제 직접 의존성과 다르거나, `src/generated/third-party-notices.txt`에 빠진 런타임 구성요소(직접·전이 전체: npm 비개발 항목 + `cargo-about` 출력 크레이트)가 있으면 실패
  - (f) `--write` 모드가 `about.json`과 `third-party-notices.txt`를 결정적으로 생성
  - (i) 비개발 판정은 `dev`와 `devOptional`을 모두 제외
  - (j) SPDX 식 해석: `(MIT AND Zlib)`은 두 항 모두 허용되어야 통과, `MIT OR Apache-2.0`은 한 항만 허용되어도 통과, 괄호 중첩 처리
  - (g) `LICENSE` SHA-256이 저장된 기준값과 다르면 실패(FR-001)
  - (h) `package.json`·`Cargo.toml`·`tauri.conf.json` `bundle.license`가 `GPL-3.0-only`가 아니면 실패
- [X] T018 [P] [US1] `tests/unit/aboutDialog.spec.ts`에 실패하는 테스트를 작성한다(contracts/about-screen.md §2·§4).
  - 렌더 항목 8개: 앱 이름·버전·라이선스·저장소·원저작자 출처·변경 일자·지원 범위·서드파티
  - "법적 의무" 문자열 부재
  - 허용 목록 밖 URL 거부: `https://github.com.evil/`, `https://github.com/edith2580/EasyViewerX`, `http://github.com/Ezenitac-AiService/EasyViewer`, `javascript:alert(1)`
  - 대화상자 속성 `role="dialog"`, `aria-modal="true"`, `Escape` 닫기, 초점 복귀
- [X] T019 [P] [US1] `tests/unit/externalLink.spec.ts`에 실패하는 테스트를 작성한다. `src/services/platform/externalLink.ts`의 허용 목록 판정(정확히 2개 접두사, `https:`·`github.com`만), Tauri 환경에서 `@tauri-apps/plugin-opener` `openUrl` 호출, 웹 환경에서 `window.open(url,'_blank','noopener,noreferrer')` 호출을 `mockIPC`로 검증한다

### Implementation for User Story 1

- [X] T020 [US1] `scripts/license-policy.json`을 만든다. 허용 SPDX 목록은 실제 의존성에 쓰이는 것만 둔다(research F27 실측: `MIT`, `Apache-2.0`, `ISC`, `BSD-2-Clause`, `BSD-3-Clause`, `CC0-1.0`, `Zlib`). 복수 라이선스 선택 맵에는 `jszip: "MIT"`를 넣는다. Rust 쪽은 `cargo deny list` 결과로 같은 원칙의 목록을 `src-tauri/deny.toml`과 `src-tauri/about.toml`(`cargo-about` 설정)에 둔다
- [X] T021 [US1] `scripts/check-licenses.mjs`를 구현해 T017을 통과시킨다. 450줄 이하로, `--write` 옵션은 `src/generated/about.json`(`name`, `version`, `license`, `repository`, `upstream`, `separatedAt`, `thirdParty[]`)과 `src/generated/third-party-notices.txt`(npm 비개발 항목 전체의 `LICENSE*` 전문·저작권 + `cargo about generate` 출력)를 생성한다. `cargo-about`가 없으면 `BLOCKED`로 종료 코드 2를 낸다. `--no-notices` 모드는 정책·SPDX 감사와 `about.json` 일치만 검사하고 `cargo-about`를 요구하지 않는다(로컬 `npm run verify`와 CI `verify` 작업용). 고지 생성물 일치 검사는 CI `licenses` 작업의 기본 모드에서만 돈다. `cargo about generate`는 `src-tauri/about.toml`의 출하 대상 전체(`aarch64-apple-darwin`, `x86_64-apple-darwin`, `x86_64-unknown-linux-gnu`, `aarch64-linux-android`, `aarch64-apple-ios`) 합집합으로 실행하고, 크레이트 이름·버전 순으로 정렬해 결과가 결정적이게 한다
- [X] T022 [US1] `cargo deny list`로 실제 Rust 의존성 라이선스를 확인한 뒤 `src-tauri/deny.toml`을 만든다.
  - `[licenses]` 허용 목록은 실사용 라이선스만, `[bans]` `multiple-versions = "warn"`, `[advisories]`, `[sources]`는 crates.io만 둔다.
  - `cargo deny check`를 통과할 때까지 위반을 정리하고, 예외는 근거와 함께 주석으로 남긴다
- [X] T023 [US1] `package.json`에 `"license": "GPL-3.0-only"`를 추가한다. `src-tauri/Cargo.toml`에는 `license = "GPL-3.0-only"`를 넣고, `authors`를 포크 기여분 권리 주체로 바꾼다(research "열린 입력" 결정값, 근거 없으면 기여자 개인). `src-tauri/tauri.conf.json`에는 `bundle.license = "GPL-3.0-only"`와 `bundle.licenseFile = "../LICENSE"`를 넣는다. 이어서 `npm install --package-lock-only`로 lockfile을 갱신한다
- [X] T024 [P] [US1] 루트에 `NOTICE`를 새로 만든다.
  - 원저작자 귀속 표기: **새로 작성**하며 "보존된 원문"이라고 쓰지 않는다. 주체·연도는 원저작자 저장소·릴리스에 공개된 표기를 확인해 따른다.
  - 포크 기여분 저작권 표기
  - GPLv3 §5(a) 변경 고지: 분기 기준 `v0.1.6`/`44c4d37`, 분리 일자, 주요 변경 요약(001·002 리팩토링, 식별자·이름 변경, 지원 범위 전환)
  - `GPL-3.0-only`가 포크의 선택이라는 점과 재검토 조건(원저작자가 "이후 버전"을 허용하면)
  - 지원 범위 블록(`<!-- support-scope:start -->`…`end`, T032가 내용 검사)
  - 변경 고지는 NOTICE 3절의 중앙 고지를 기본으로 하고, 이번 기능에서 새로 만드는 소스 파일에만 `SPDX-License-Identifier: GPL-3.0-only` 한 줄을 단다(research R16, 2026-11-17 갱신: GPLv3 §5(a)는 작품 단위 고지)
- [X] T025 [US1] `node scripts/check-licenses.mjs --write`로 `src/generated/about.json`을 만들고, `THIRD_PARTY_LICENSES.md`를 같은 데이터와 일치시킨다. 프로젝트 라이선스는 `GPL-3.0-only`로 쓰고, `jszip` 선택 라이선스 열을 추가하며, Rust 직접 의존성 표를 갱신하고, 갱신 일자를 바꾼다. 표 위에 "전이 의존성을 포함한 전체 고지와 라이선스 전문은 `src/generated/third-party-notices.txt`(앱 정보 화면에서 열람)"라는 안내를 둔다
- [X] T026 [P] [US1] `src/services/platform/externalLink.ts`를 구현해 T019를 통과시키고 `src/services/platform/index.ts`에서 내보낸다
- [X] T027 [US1] `src-tauri/capabilities/default.json`에 `opener:allow-open-url` 권한을 추가한다. 허용 URL은 정확히 4항목이다: `https://github.com/Ezenitac-AiService/EasyViewer`, `https://github.com/Ezenitac-AiService/EasyViewer/*`, `https://github.com/edith2580/EasyViewer`, `https://github.com/edith2580/EasyViewer/*`. 저장소 이름 바로 뒤에 `*`를 붙이지 않는다(glob `*`가 `/`까지 포함해 `EasyViewerX`를 허용하므로, research F29)
- [X] T028 [US1] `src/components/common/AboutDialog.vue`를 구현해 T018을 통과시킨다.
  - `about.json`과 `supportScope.ts`를 쓴다.
  - 링크는 `externalLink.ts`를 거친다.
  - 기존 접근성 대화상자 규약과 `light`·`dark`·`sepia` 테마를 지원한다
- [X] T029 [US1] `src/views/LibraryView.vue`에 키보드로 접근할 수 있는 "정보" 버튼을 추가하고, `AboutDialog`는 `defineAsyncComponent`로 지연 로드한다. 파일은 450줄 이하를 유지하고, `npm run build` 후 초기 번들 `index-*.js <= 480 kB`를 확인한다
- [X] T030 [US1] `tests/e2e/accessibility-and-ux.spec.ts`에 정보 대화상자 시나리오를 추가한다(열기, 포커스 트랩, `Escape`, 초점 복귀)
- [X] T031 [US1] `scripts/verify.mjs` 프론트엔드 단계에 `['License Audit', 'node', ['scripts/check-licenses.mjs', '--no-notices']]`를 추가하고(`cargo-about` 없이 동작해야 함), `README.md`에 "출처와 라이선스" 절(원저작자 귀속, 변경 고지 요약, NOTICE 링크)을 추가한다

**Checkpoint**: US1 독립 검증 통과(SC-001)

---

## Phase 4: User Story 2 - 지원 범위 전환과 사용자 안내 (Priority: P1)

**Goal**: 지원 범위 원문이 게시 위치 7곳에 같은 의미로 실리고, Windows 사용자는 원저작자 앱으로 안내된다

**Independent Test**: `node scripts/check-support-scope.mjs`가 통과한다. README 첫 화면에 Windows 비지원 문장과 원저작자 링크가 있다. 이슈 양식 플랫폼 선택지가 4개다(macOS·iOS·Linux·Android). 금지 표현은 0건이다(SC-004).

### Tests for User Story 2 ⚠️

- [X] T032 [P] [US2] `tests/unit/supportScopeCheck.spec.ts`에 `scripts/check-support-scope.mjs`의 실패하는 테스트를 작성한다(contracts/support-scope-wording.md §2–§3).
  - (a) 각 문서의 `support-scope` 블록이 `renderKo()` 결과와 다르면 실패
  - (b) README 맨 위 배너에 `bannerEn`이 없으면 실패
  - (c) 금지 표현 `역할 분담`·`역할을 나눠`·`경쟁하지 않`, 원저작자 앱을 `Windows 전용`·`레거시`·`구버전`으로 부르는 표현이 검사 범위에 있으면 실패하고, 예외 목록 파일 `scripts/wording-exceptions.json`이 있으면 통과
  - (d) `.github/ISSUE_TEMPLATE/bug_report.yml` 플랫폼 선택지가 정확히 `macOS, iOS, Linux, Android`가 아니면 실패
  - (e) `config.yml`에 원저작자 저장소 안내 링크가 없으면 실패
  - (f) `verification/security-coordination.md` 통지 날짜가 없는데 공개 문서에 `취약점`·`보안 결함`과 `원저작자`가 같은 문단에 나오면 실패

### Implementation for User Story 2

- [X] T033 [US2] `scripts/check-support-scope.mjs`를 구현해 T032를 통과시키고(450줄 이하), `scripts/verify.mjs`에 단계를 추가한다
- [X] T034 [US2] `README.md`를 고친다.
  - 맨 위에 포크 안내 배너(영문 한 줄 + 한국어 원문 블록)를 둔다.
  - Windows 설치 안내를 지우고, Windows 사용자 안내(원저작자 링크, `docs/windows-migration.md` 링크)로 바꾼다.
  - 지원 플랫폼 표를 원문 등급대로 바꾸고, Linux 보장 범위(`linuxBaseline`)와 그 밖의 배포판은 "동작할 수 있으나 검증하지 않음"이라는 문장을 함께 쓴다
- [X] T035 [P] [US2] `CONTRIBUTING.md`를 새로 만든다. 이 단계에서는 지원 범위 블록과 "Windows 관련 이슈 처리 방침"(포크 저장소 접수 → 전환 안내로 종결, 원저작자 저장소에 올리지 말 것)만 쓰고, 나머지 절은 T079에서 채운다
- [X] T036 [P] [US2] `CHANGELOG.md`를 새로 만든다. 이 단계에서는 "독립 분리" 항목 머리(분리 일자, 지원 범위 블록)만 쓰고, 과거 이력은 T080에서 채운다
- [X] T037 [P] [US2] `.github/ISSUE_TEMPLATE/bug_report.yml`(플랫폼 드롭다운 `macOS`, `iOS`, `Linux`, `Android`, 앱 버전, 재현 절차), `.github/ISSUE_TEMPLATE/feature_request.yml`, `.github/ISSUE_TEMPLATE/config.yml`을 만든다. `config.yml`은 `blank_issues_enabled: false`이고 `contact_links`에 "Windows 사용자: 원저작자 EasyViewer" → `https://github.com/edith2580/EasyViewer`를 둔다
- [X] T038 [US2] (T014 이후) README에 "원저작자 앱과의 차이" 절을 추가한다. 검증 가능한 사실만 쓴다: 지원 플랫폼, 식별자, 데이터 형식 버전, 이름. 원저작자 앱 평가 문구와 보안 결함 비교는 쓰지 않는다. 쓴 뒤 `check-support-scope.mjs`를 통과시킨다

**Checkpoint**: US1·US2 완료 = 법적 준수와 사용자 안내 MVP

---

## Phase 5: User Story 3 - 저장소 분리와 분기 기준선 보존 (Priority: P2)

**Goal**: 분리 안전 게이트, 동기화 금지 규칙, 분리 지연 대비 절차

**Independent Test**: `node scripts/check-release-gate.mjs --separation`이 기준선 태그·보안 조율·사전 고지·CI·라이선스 감사 항목을 보고하고, 하나라도 빠지면 실패한다. 워크플로·스크립트에 업스트림 동기화 경로가 0건이다(SC-002 일부, SC-003).

### Tests for User Story 3 ⚠️

- [X] T039 [P] [US3] `tests/unit/releaseGate.spec.ts`에 `scripts/check-release-gate.mjs`의 실패하는 테스트를 작성한다(contracts/release-and-ci.md §3). git·GitHub 조회는 주입 가능한 함수로 대역 처리한다.
  - `--separation` 모드: 항목 1–5만 검사
  - `--release --tag <t>` 모드: 1–8 + 버전 비중복 검사
  - 각 항목의 실패 사례
  - 기록 파일(`verification/security-coordination.md`, `upstream-notice.md`, `release-gate.md`)에 날짜·체크가 없으면 실패
  - `.github/workflows/*.yml`이 존재하지 않는 `scripts/*.mjs`나 정의되지 않은 `npm run` 스크립트를 참조하면 실패
  - 워크플로·`scripts/`에 `edith2580`·`upstream` 원격 동기화 명령(`git fetch upstream`, `git merge upstream`, `gh repo sync`)이 있으면 실패
  - `--static` 공급망 규칙: 워크플로 최상위 권한이 `contents: read`가 아니거나, `publish` 밖에 `contents: write`가 있거나, `actions/*` 이외 액션이 40자 커밋 SHA로 고정되지 않았거나, `secrets.*`가 단계 `env` 밖에 있으면 실패
  - `--release` 모드: `bundle.android.versionCode`가 없거나 직전 포크 릴리스 값 이하이면 실패

### Implementation for User Story 3

- [X] T040 [US3] `scripts/check-release-gate.mjs`를 구현해 T039를 통과시킨다(450줄 이하). 버전 비중복 조회는 `gh api repos/edith2580/EasyViewer/releases`(읽기 전용)를 쓰고, 네트워크가 없으면 `BLOCKED`로 종료 코드 2를 낸다
- [X] T041 [US3] `scripts/verify.mjs`에 워크플로 스크립트 참조·동기화 경로 검사(`check-release-gate.mjs --static`)를 추가한다
- [X] T042 [US3] `specs/003-independent-fork-separation/verification/release-gate.md` 양식을 만든다. FR-025 1–8 항목별 체크 칸, 확인자, 날짜, 근거 링크를 두고 항목 1에는 T011 결과를 옮긴다
- [X] T043 [US3] `docs/maintainer-runbook.md`를 새로 만든다.
  - 분리 요청 절차: **GitHub Support 요청이 기본**이다(확정 결정 1, 이슈·PR 이력 보존). 설정의 "Leave fork network"는 이슈·PR·스타·위키를 잃고 되돌릴 수 없으며 릴리스 보존이 문서화되어 있지 않다(research F33). 그래서 Support가 지연·거절되고, `gh release download`로 모든 릴리스 산출물·노트를 백업하고, 위키를 백업하고, 지원 종료 고지(T097)를 게시한 뒤에만 쓴다. 실행 시점에 공식 문서를 다시 확인한다
  - 요청 전 `check-release-gate.mjs --separation` 통과 필수
  - 지연·거절 시 임시 운영(PR 대상 수동 지정)과 대안(새 저장소 미러링)
  - 업스트림 원격 제거 명령
  - 비공개 취약점 신고 활성화
  - 정기 확인 항목(릴리스마다): 원저작자 저장소의 보관(archived) 여부, 최신 릴리스의 Windows 산출물 유무, 데이터 형식 버전 변화. 변화가 있으면 `supportScope.ts` Windows 문구와 `docs/windows-migration.md`를 갱신한다(spec 엣지 케이스·가정)
- [X] T044 [US3] `CONTRIBUTING.md`에 "업스트림과의 관계" 절을 추가한다.
  - 업스트림 병합·체리픽·"Sync fork" 버튼 사용 금지
  - 보안 조율 기여만 예외
  - 업스트림 아이디어는 별도 명세로 재구현
  - 로컬에 `upstream` 원격이 남았을 때 감지(`git remote -v`)와 실수로 병합했을 때 되돌리기(`git revert -m 1`, 강제 푸시 금지)
  - 이력 재작성·저작권 고지 삭제 금지, 원저작자 유래 코드의 일반 수정은 허용

**Checkpoint**: 분리 요청을 위한 게이트와 절차가 준비됨(실제 요청은 Final Phase)

---

## Phase 6: User Story 4 - 포크 Windows 빌드 사용자의 지원 종료와 전환 (Priority: P2)

**Goal**: 실측으로 검증한 Windows 전환 절차와 지원 종료 고지 문안

**Independent Test**: `docs/windows-migration.md`를 실제 Windows에서 따라 했을 때 원저작자 최신 앱에서 책을 다시 가져올 수 있고, 손실 항목이 문서와 같다(SC-005).

### Tests for User Story 4 ⚠️

- [X] T045 [P] [US4] `tests/unit/supportScopeCheck.spec.ts`에 케이스를 추가한다. `docs/windows-migration.md`가 원저작자 앱과 "호환", "그대로 열립니다" 같은 호환 단정 문구를 포함하면 실패하고, 손실 항목 4개(읽기 진행률·책갈피·표시 설정·WebDAV 자격증명)가 모두 있어야 통과한다

### Implementation for User Story 4

- [X] T046 [US4] `docs/windows-migration.md`를 작성한다(research R3).
  - 비호환 사실: 포크 데이터 형식 버전 2, 원저작자 버전 1
  - 절차 5단계:
    1. `%APPDATA%\com.edith.easyviewer\books` 백업
    2. 포크 앱 제거
    3. `%LOCALAPPDATA%\com.edith.easyviewer` 이름 바꾸기
    4. 원저작자 최신 앱 설치
    5. 책 다시 가져오기
  - 손실 항목
  - 3단계를 건너뛰었을 때의 증상과 복구
  - 백업 없이 원저작자 앱을 먼저 설치했을 때의 복구
  - 그 뒤 `check-support-scope.mjs`를 통과시킨다
- [X] T047 [P] [US4] `docs/windows-eol-notice.md`에 기존 Windows 프리릴리스(`v0.1.6-alpha`, `v0.1.6-beta`) 릴리스 노트 맨 위에 붙일 지원 종료 고지 문안을 쓴다. 지원 범위 원문, 전환 문서 링크, 산출물은 삭제하지 않는다는 사실을 담는다
- [ ] T048 [US4] (메인테이너·Windows 실기기) quickstart §7을 실행하고 `verification/windows-migration.md`에 기록한다. 원저작자 최신 릴리스 버전, Windows 버전, 각 단계 결과, 실제 손실 항목, 3단계를 건너뛴 경우의 증상을 적는다. 실기기가 없으면 `BLOCKED`로 기록하고 첫 독립 릴리스 게이트에서 미해결로 표시한다
- [ ] T049 [US4] T048 결과가 문서와 다르면 `docs/windows-migration.md`를 고치고 T048을 다시 실행한다

**Checkpoint**: Windows 사용자 전환 경로 준비(고지 게시는 Final Phase)

---

## Phase 7: User Story 5 - 앱 정체성 분리와 원저작자 앱과의 공존 (Priority: P3)

**Goal**: 새 식별자·새 표시명·패키지 이름, Android 고정 서명, Apple 팀 정보와 개인 기기 식별자 제거

**Independent Test**: `npm run check:version`과 `node scripts/check-identity.mjs`가 통과하고, 원저작자 앱과 함께 설치해도 충돌이 0건이다(SC-002, SC-007, SC-008). **US6와 같은 릴리스로만 출시한다.**

**⚠️ 선행**: 새 제품 표시명 결정(research "열린 입력")

### Tests for User Story 5 ⚠️

- [X] T050 [US5] (메인테이너 결정) 새 제품 표시명과 kebab-case 패키지 이름을 정해 `specs/003-independent-fork-separation/data-model.md` §4 표와 `research.md` R4에 기록한다. 원저작자 `v0.2.1` 산출물 이름·Linux 패키지 이름과 겹치지 않는지 확인 결과도 함께 적는다. **새 앱 아이콘**(원저작자 아이콘과 구분되는 원본, 출처와 라이선스 기록)도 이때 정한다(FR-016)
- [X] T051 [P] [US5] `tests/unit/governanceScripts.spec.ts`의 버전·식별자 동기화 테스트를 실패하도록 고친다.
  - `EXPECTED_APP_ID = 'com.ezenitac.easyviewer'`
  - 구 패키지 경로 `src-tauri/gen/android/app/src/main/java/com/edith`·`buildSrc/.../com/edith`가 남아 있으면 실패
  - `MainActivity.kt` 경로 `com/ezenitac/easyviewer`, buildSrc 경로 `com/ezenitac/easyviewer/kotlin/RustPlugin.kt`
- [X] T052 [P] [US5] `tests/unit/identityCheck.spec.ts`에 `scripts/check-identity.mjs`의 실패하는 테스트를 작성한다(data-model §4).
  - `com.edith.easyviewer`·원저작자 표시명(`EasyViewer`)·패키지 이름(`easy-viewer`)이 허용 목록 밖에 있으면 실패. 허용 목록: 마이그레이션 코드·테스트, 구 구조 차단 검사, NOTICE·README 출처 절·정보 화면 출처, 지원 범위 원문과 Windows 안내(`src/config/supportScope.ts`, 모든 `support-scope` 블록, README 배너, `.github/ISSUE_TEMPLATE/config.yml`, `docs/windows-migration.md`, `docs/windows-eol-notice.md`), `specs/001-*`, `specs/002-*`, CHANGELOG 과거 항목, `src-tauri/src/commands/epub_meta.rs` EPUB 픽스처 저자명
  - 내부 저장 키 리터럴 `EasyViewerDB`, `easyviewer:`, `easyviewer:webdav:`, `webdav_credentials_web_consent_v2`는 통과(data-model §4 "바꾸지 않는 내부 저장 키"). 이 키가 **다른 값으로 바뀌면** 실패하는 회귀 테스트도 둔다
  - 지원 범위 블록 안의 "원저작자의 EasyViewer"는 통과, 블록 밖 README 본문에서 원저작자 이름을 포크 앱 이름처럼 쓰면 실패
  - `tauri.conf.json` `bundle.iOS.developmentTeam`이나 `project.yml` `DEVELOPMENT_TEAM`에 값이 있으면 실패
  - `package.json` 스크립트에 iOS 기기 UDID 패턴(`[0-9A-F]{8}-[0-9A-F]{16}`)이 있으면 실패
  - `productName`, Cargo 패키지 이름, npm 이름, `PRODUCT_NAME`, Android `app_name`이 T050 값과 다르면 실패

### Implementation for User Story 5

- [X] T053 [US5] `scripts/check-version-sync.mjs`를 고쳐 T051을 통과시킨다. `EXPECTED_APP_ID`를 바꾸고, 구 `com/edith` 경로 차단을 추가하고, 새 패키지 경로를 검사한다
- [X] T054 [US5] `scripts/check-identity.mjs`를 구현해 T052를 통과시키고(450줄 이하), `scripts/verify.mjs`에 단계를 추가한다
- [X] T055 [US5] `src-tauri/tauri.conf.json`을 고친다: `identifier` → `com.ezenitac.easyviewer`, `productName`·`app.windows[0].title` → 새 표시명, `bundle.iOS.developmentTeam` 삭제. `src-tauri/tauri.android.conf.json` `identifier`도 바꾼다. 이어서 T050의 새 아이콘 원본으로 `npx tauri icon <원본.png>`를 실행해 `src-tauri/icons/*`, Android `mipmap-*`, iOS `AppIcon.appiconset`을 교체하고, 아이콘 출처·라이선스를 NOTICE에 적는다. `check-identity.mjs`(T052)에 아이콘 파일 해시가 `44c4d37`의 원저작자 아이콘과 같으면 실패하는 검사를 더한다
- [X] T056 [US5] Android 패키지를 옮긴다.
  - `git mv`로 `src-tauri/gen/android/app/src/main/java/com/edith/easyviewer` → `.../com/ezenitac/easyviewer`, `src-tauri/gen/android/buildSrc/src/main/java/com/edith/easyviewer/kotlin` → `.../com/ezenitac/easyviewer/kotlin`.
  - `MainActivity.kt`, `BuildTask.kt`, `RustPlugin.kt`의 `package` 선언과 `buildSrc/build.gradle.kts` 플러그인 id·구현 클래스 경로를 바꾼다.
  - `src-tauri/gen/android/app/src/main/res/values/strings.xml` `app_name`을 새 표시명으로 바꾼다
- [X] T057 [US5] `src-tauri/gen/android/app/build.gradle.kts`를 고친다. `namespace`·`applicationId`를 새 식별자로 바꾸고, `signingConfigs { create("release") { ... } }`가 환경 변수 `ANDROID_KEYSTORE_PATH`·`ANDROID_KEYSTORE_PASSWORD`·`ANDROID_KEY_ALIAS`·`ANDROID_KEY_PASSWORD`를 읽게 한다. release 빌드 타입은 이 설정을 쓰고, 환경 변수가 없으면 `GradleException`으로 실패한다. T007(S4)에서 덮어쓰기가 확인되면 같은 내용을 init 이후 주입하는 `scripts/android.mjs` 단계로 구현한다
- [X] T058 [US5] `src-tauri/gen/apple/project.yml`의 `bundleIdPrefix`·`PRODUCT_BUNDLE_IDENTIFIER`를 새 식별자로, `PRODUCT_NAME`을 새 표시명으로 바꾸고 `DEVELOPMENT_TEAM` 고정값을 지운다. `src-tauri/gen/apple/easy-viewer_iOS/Info.plist` 표시 이름을 확인하고, 필요하면 `ios:init`으로 재생성해 diff를 검토한다
- [X] T059 [US5] `src-tauri/Cargo.toml` `[package] name`과 `[lib] name`을 새 이름으로, `package.json` `name`을 새 kebab-case 이름으로 바꾼다. `src-tauri/src/main.rs`의 `easy_viewer_lib::run()` 참조를 고치고, `npm install --package-lock-only`와 `cargo generate-lockfile --offline`(실패 시 `cargo check`)로 lockfile을 갱신한다. 내부 저장 키(`EasyViewerDB`, `easyviewer:`, `easyviewer:webdav:`, `webdav_credentials_web_consent_v2`)는 **바꾸지 않는다**(data-model §4)
- [X] T060 [P] [US5] `scripts/ios-install.mjs`를 만든다. `IOS_DEVICE_ID`가 없으면 사용법을 출력하고 종료 코드 1로 끝나며, 있으면 `xcrun devicectl device install app --device $IOS_DEVICE_ID <새 이름>.app` 경로로 실행한다. `package.json` `ios:install`을 `node scripts/ios-install.mjs`로 바꾼다
- [X] T061 [P] [US5] `docs/android-signing.md`를 작성한다.
  - `keytool` 키 생성 명령(RSA 4096, 유효기간 25년 이상)
  - 백업: 서로 다른 보관 장소 2곳 이상, 하나는 오프라인
  - 접근 통제
  - CI 비밀값 `ANDROID_KEYSTORE_BASE64`·`ANDROID_KEYSTORE_PASSWORD`·`ANDROID_KEY_ALIAS`·`ANDROID_KEY_PASSWORD` 등록
  - 서명 인증서 지문 확인 방법
  - 분실·유출 시 사용자 고지와 재설치 안내
- [ ] T062 [US5] (메인테이너, 첫 독립 릴리스 이후로 연기 — 2026-11-23 메인테이너 결정, 키가 없으면 릴리스에서 Android를 뺀다) T061 절차대로 서명 키를 만들고 백업 2곳을 확인한 뒤, GitHub 저장소 비밀값을 등록한다. `verification/release-gate.md` 항목 8에 인증서 SHA-256 지문만 기록한다(비밀값은 기록하지 않음)
- [X] T063 [US5] `npm run verify`가 통과하는지 확인한다. 모든 식별자·이름 검사를 통과하고, Windows 대상 컴파일 경로(`cfg(windows)`)를 바꾸지 않았는지 확인한다

**Checkpoint**: 정체성 분리 코드 완료(US6 없이 출시 금지)

---

## Phase 8: User Story 6 - macOS·Linux·모바일 기존 사용자의 데이터 연속성 (Priority: P3)

**Goal**: 창을 만들기 전에 1회 이전, 자격증명 이전, 실패 시 폴백과 안내, 모바일 안내

**Independent Test**: quickstart §3의 다섯 시나리오가 macOS·Linux에서 데이터 손실·중복·크래시·평문 노출 0건으로 통과한다(SC-006).

### Tests for User Story 6 ⚠️

- [X] T064 [P] [US6] `src-tauri/src/migration/tests.rs`에 `tempfile` 기반 실패하는 테스트를 작성한다(contracts/data-migration.md §1, data-model §1). 필요하면 `tempfile`을 `[dev-dependencies]`에 추가한다.
  - 상태 5종: `skipped_no_source`, `skipped_target_not_empty`, `migrated`, `partial`, `failed`
  - 기록 파일이 있으면 두 번째 실행에서 아무것도 바꾸지 않음
  - 심볼릭 링크와 루트 밖 경로 건너뛰기(`skippedEntries` 증가)
  - 민감 경로 차단(`is_sensitive_path` 재사용)
  - 복사 실패 시 임시 폴더 삭제와 새 폴더 빈 상태 유지
  - 실행 전후 원본 트리의 파일 목록·크기·SHA-256 동일
  - 기록의 `error`는 `io`·`permission`·`space`·`boundary` 중 하나이고 경로 문자열을 포함하지 않음
  - `schema`가 `1`이 아니면 `failed`로 취급
  - 동시성: 스레드 2개가 동시에 실행하면 잠금을 잡은 쪽만 이전하고 다른 쪽은 아무것도 바꾸지 않음
  - 결정 흐름 함수(`decide(&env) -> Decision`)가 "결정 전 영속 WebView 금지" 불변식을 지킴(contracts/data-migration.md §1 흐름도): 구 앱 실행 중이면 `AskUser`, 잠금 실패면 `Exit`, 복사 필요면 `CopyInBackground`를 반환하고, 최종 상태·`declined`·`discarded` 처리 뒤에만 `OpenMainWindow`를 반환
  - 사용자 선택 반영: [이번엔 건너뛰기] → `declined` 기록 후 `OpenMainWindow`, [종료] → 기록 없이 `Exit`, [다시 시도] → 감지 반복
  - `discard_pending` 기록이 있으면 창 생성 전에 새 데이터 폴더(앱 데이터·WebKit 저장소)가 비워지고 `discarded`가 됨
  - 진행 창 설정값이 `incognito = true`이고 `data_directory`가 새 식별자 위치 밖(OS 임시 폴더)임
  - 잠금 파일 경로가 OS 런타임·임시 폴더 아래이고 공용 상위 폴더(`~/Library/Application Support/`, `~/.local/share/`)가 아님
  - 복사 중 원본 SQLite 묶음(`*.db`·`-wal`·`-shm`)의 크기·수정 시각이 바뀌면 `error = "busy"`로 롤백
  - `-wal`·`-shm`이 본 파일과 함께 복사되고, 캐시 폴더는 제외됨
  - "비어 있음" 정의(무시 목록만 있는 새 폴더는 비어 있음)
- [X] T065 [P] [US6] `src-tauri/src/migration/credentials.rs` 하단 `#[cfg(test)]`에 실패하는 테스트를 작성한다(data-model §2).
  - 입력 64개 초과 거부, `^easyviewer:webdav:[A-Za-z0-9_-]{1,128}$` 위반 시 전체 거부
  - 새 서비스에 값이 있으면 덮어쓰지 않음
  - 구 항목 삭제 금지
  - 응답에 비밀값·계정 키 없음
  - 두 번째 호출 무변경
  - 키체인 접근은 trait으로 추상화해 메모리 대역으로 테스트
- [X] T066 [P] [US6] `tests/unit/migrationService.spec.ts`에 실패하는 테스트를 작성한다(`mockIPC`).
  - `getRecord()`는 웹·모바일에서 `null`, 데스크톱에서 기록 반환
  - `acknowledge()` 호출
  - 자격증명 이전은 WebDAV 연결 목록에서 계정 키를 만들고 1회만 호출
  - 응답을 화면 상태로 변환
- [X] T067 [P] [US6] `tests/unit/migrationNotice.spec.ts`에 실패하는 테스트를 작성한다(contracts/data-migration.md §2 안내 표).
  - 상태별 안내 문구
  - `migrated`인데 서재가 비어 있거나 `partial`이면 재구성 실행 후 손실 항목 안내
  - `failed`면 원본 보존과 수동 복구 안내
  - 사용자 지정 저장 폴더가 구 앱 데이터 폴더 안이면 새 폴더의 같은 상대 경로로 다시 연결
  - 자격증명 이전 `failed > 0`이면 해당 연결 재입력 안내
  - macOS에서 자격증명 이전 전 "최대 N번 암호 허용 창" 안내와 [옮기기]/[건너뛰고 나중에 재입력] 선택, 건너뛰면 명령을 호출하지 않고 `skipped: true` 기록
  - `migrated` 안내에 원저작자 앱 데이터가 섞여 있을 수 있다는 문구와 "이전 결과 버리기". 확인하면 `discard_pending` 기록 명령 호출 → 재시작 요청이 순서대로 일어나고, 현재 실행에서는 데이터를 지우지 않음
  - `declined` 상태 안내(원본은 그대로, 수동 복구 방법)
  - 재구성은 `books/` 파일을 복사하지 않고 제자리 등록하며, 두 번 실행해도 서재 항목·파일 수가 늘지 않음(T072)
  - `light`·`dark`·`sepia` 테마별 렌더와 키보드·터치 닫기

### Implementation for User Story 6

- [X] T068 [US6] `src-tauri/src/migration/mod.rs`를 구현해 T064를 통과시킨다(450줄 이하, 필요하면 `paths.rs`·`lock.rs`로 분리).
  - contracts/data-migration.md §1 흐름도를 순수 결정 함수 `decide()`와 실행부로 나눠 구현한다. 불변식: 이전 결정이 최종 상태가 되기 전에는 영속 WebView를 만들지 않는다
  - 단일 인스턴스: `tauri-plugin-single-instance`(Tauri 공식)를 추가하고, `deny.toml`·고지 생성(T022·T025) 범위에 반영한다
  - 이전 잠금: OS 런타임·임시 폴더 아래 전용 파일(`$XDG_RUNTIME_DIR/com.ezenitac.easyviewer/migration.lock`, macOS `NSTemporaryDirectory()/com.ezenitac.easyviewer/migration.lock`)
  - 구 앱 실행 감지: macOS `lsappinfo`로 번들 식별자 `com.edith.easyviewer` 조회, Linux `/proc/*/exe` 확인. 실행 중이면 메인 창 없이 `tauri-plugin-dialog` 네이티브 대화상자로 [다시 시도]/[이번엔 건너뛰기]/[종료]
  - `discard_pending` 처리: 창 생성 전에 새 데이터 폴더를 비우고 `discarded` 기록
  - SQLite `-wal`·`-shm` 묶음 복사와 복사 전후 변경 감지(`busy`, 보조 방어선)
  - 캐시 폴더 제외, "비어 있음" 정의
  - 복사는 백그라운드 스레드에서 한다. 5초가 넘으면 `WebviewWindowBuilder::incognito(true)`와 OS 임시 폴더 `data_directory`로 진행 창(앱에 포함된 정적 페이지, 진행률은 이벤트)을 띄운다
  - 플랫폼별 대상 경로: Linux는 `~/.local/share/com.edith.easyviewer`, macOS는 앱 데이터 폴더와 T009에서 확정한 WebKit 저장소 경로
  - 임시 폴더 복사 → 파일 수·크기 검증 → `rename`
  - `migration-v1.json` 기록
  - 오류가 나도 패닉하지 않음
  - Windows·모바일에서는 `skipped_no_source`를 반환하지만 컴파일은 됨
- [X] T069 [US6] `src-tauri/src/migration/credentials.rs`에 `migrate_legacy_credentials` 명령과 기록 조회 명령 `get_migration_record`·`acknowledge_migration_notice`를 구현해 T065를 통과시킨다. 실제 저장소는 `tauri_plugin_keyring_store::KeyringStore::new("com.edith.easyviewer")`와 앱에 관리되는 플러그인 저장소를 쓴다
- [X] T070 [US6] `src-tauri/tauri.conf.json` `app.windows[0]`에 `"label": "main"`, `"create": false`를 둔다. `src-tauri/src/lib.rs`는 다음처럼 고친다.
  - `.setup()` 훅은 데스크톱에서 `migration::decide()`를 호출하고 **바로 반환**한다(동기로 복사하면 이벤트 루프가 멈춰 진행 창이 그려지지 않음). 결정이 `OpenMainWindow`이면 즉시, `CopyInBackground`이면 복사 스레드가 기록을 마친 뒤 앱 핸들로 `WebviewWindowBuilder::from_config(app.handle(), &app.config().app.windows[0])?.build()?`를 실행해 메인 창을 만든다. `AskUser`·`Exit`면 메인 창을 만들지 않는다
  - 재시작 명령 `request_restart_for_discard`(기록을 `discard_pending`으로 바꾼 뒤 `app.restart()`)를 등록한다
  - 모바일에서도 같은 방식으로 창을 만든다
  - 데스크톱 `invoke_handler`에 새 명령 4개 등록(`get_migration_record`, `acknowledge_migration_notice`, `migrate_legacy_credentials`, `request_restart_for_discard`)
  - `capabilities`의 `windows: ["main"]` 라벨이 유지되는지 확인
- [X] T071 [US6] `src/services/platform/migrationService.ts`를 구현해 T066을 통과시키고 `src/services/platform/index.ts`에서 내보낸다. 상위 계층이 `@tauri-apps/api`를 직접 호출하지 않는다(헌법 제5원칙, `check:boundaries`)
- [X] T072 [US6] `src/services/platform/libraryReconstruction.ts`를 구현한다. 새 앱 데이터 폴더 `books/`에 이미 있는 파일은 **복사하지 않고 그 자리에서** 서재에 등록한다. 검증은 기존 경계(`read_validated_book_file`·`hash_validated_book_file`·`extract_epub_metadata_from_path`)를 거친다. 해시가 이미 등록된 파일은 건너뛰어(기존 `bookHashDedupe` 규칙) 중복 항목·중복 파일이 0건이어야 한다. `useBookStore.ts`(448줄)에는 코드를 더하지 않고 공개 API만 쓴다
- [X] T073 [US6] `src/components/library/MigrationNotice.vue`를 구현해 T067을 통과시키고, `src/views/LibraryView.vue`에 배치한다. 450줄 이하를 유지하고, 접근성 대화상자 또는 알림 영역 규약, `light`·`dark`·`sepia` 테마, 데스크톱·모바일 입력 환경을 모두 지원한다(헌법 품질 게이트)
- [X] T074 [P] [US6] `docs/mobile-migration.md`를 작성한다. 새 식별자 앱은 별도 앱으로 설치되고 자동 이전이 없다는 사실, 대체 경로(WebDAV 동기화, 책 파일 다시 가져오기), 잃는 항목, 이전 앱 제거 시점을 담는다
- [X] T075 [US6] `npm run verify`와 `cd src-tauri && cargo test`가 통과하는지 확인한다. 이어서 `rustup target add x86_64-pc-windows-msvc` 후 `cd src-tauri && cargo check --target x86_64-pc-windows-msvc`로 Windows 경로가 컴파일되는지 로컬에서 확인한다(헌법 제5원칙). 크로스 확인이 툴체인·C 의존성 때문에 실패하면 `BLOCKED`로 기록하고 T084 `windows-compile-test` 결과로 대신한다
- [ ] T076 [US6] (실기기) quickstart §3 시나리오 1–9를 macOS와 Linux에서 실행해 `verification/migration-macos.md`·`verification/migration-linux.md`에 기록한다. 실행하지 못한 시나리오는 `BLOCKED`로 둔다
- [ ] T077 [US6] (실기기) 스파이크 S3를 진행한다. 새 이름으로 macOS `.app`·Linux deb·AppImage·(정식 버전 빌드로) rpm, Android APK를 만들어 원저작자 최신 앱과 함께 설치하고 quickstart §4 결과를 `verification/coexistence.md`에 기록한다(SC-007)

**Checkpoint**: US5+US6 함께 출시 가능

---

## Phase 9: User Story 7 - 거버넌스·기여 문서와 릴리스 파이프라인 전환 (Priority: P4)

**Goal**: CI 재구성(Windows 컴파일·테스트 유지), 릴리스 전환(Windows 0개, 체크섬, 서명, 게이트), 거버넌스 문서

**Independent Test**: PR에서 `ci.yml` 6개 작업이 비밀값 없이 통과한다. 리허설 태그 릴리스에서 Windows 산출물이 0개이고 `SHA256SUMS.txt`가 있다. 헌법과 원문의 의미가 같다(SC-003, SC-004, SC-010).

### Tests for User Story 7 ⚠️

- [X] T078 [P] [US7] `tests/unit/releaseWorkflow.spec.ts`를 실패하도록 고친다(contracts/release-and-ci.md §5).
  - `release.yml`: `windows-x64` 매트릭스·`*.exe`·`*.msi`·포터블 ZIP 단계가 없음, `SHA256SUMS.txt` 생성 단계가 있음, `gate` 작업이 `publish`의 `needs`에 있음, 제목이 새 표시명으로 시작, Android 서명 비밀값 환경 변수가 있음
  - `ci.yml`: 작업 6개(`verify`, `licenses`, `windows-compile-test`, `macos-build`, `ios-sim-build`, `android-debug`), `pull_request`와 `push: main` 트리거
  - `ci-build-desktop.mjs`의 `resolveDesktopBuildCommand`에 `windows-x64` 분기가 없고, macOS·Linux 프리릴리스 규칙(`deb,appimage`)은 유지

### Implementation for User Story 7

- [X] T079 [US7] `CONTRIBUTING.md`를 완성한다. 독립 운영 원칙(헌법 제8원칙 요약), 명세 절차(`/speckit-*` 흐름), 품질 게이트(`npm run verify`, `cargo deny check`), 한국어 커밋 규칙(헌법 제1원칙), 지원 플랫폼 등급별 기여 기대치를 담는다. 의존성 갱신으로 라이선스 감사가 실패할 때의 절차도 넣는다: 새 라이선스의 GPLv3 호환성 검토 → 근거와 함께 `scripts/license-policy.json`·`src-tauri/deny.toml` 허용 목록 갱신 또는 의존성 교체. 감사 우회·비활성화는 금지한다
- [X] T080 [US7] `CHANGELOG.md` 과거 이력을 채운다. 업스트림 `v0.1.0`–`v0.1.6` 요약(태그 메시지 기준), 포크 프리릴리스 `v0.1.6-alpha`·`v0.1.6-beta`, 001·002 리팩토링, PR #2 기여, 분리 일자, 업스트림 `v0.2.0`·`v0.2.1` 미병합, Windows 지원 종료를 쓴다
- [X] T081 [P] [US7] (T014 이후) `SECURITY.md`를 새로 만든다. "원저작자 앱 취약점은 원저작자에게 신고" 문장은 T032(f) 금지어 검사의 예외로 `scripts/wording-exceptions.json`에 등록한다(결함 내용 언급이 아니라 신고 경로 안내이므로).
  - 지원 버전(첫 독립 릴리스 이후 최신만)
  - 비공개 취약점 신고 채널(GitHub Private vulnerability reporting)
  - 원저작자 앱 취약점은 원저작자에게 신고하라는 안내
  - 개인 기기 식별자가 git 이력에 남아 있다는 한계(FR-017)
  - 미수정 결함 공개 기준(T014와 같은 값)
- [X] T082 [P] [US7] `docs/ios-build.md`를 작성한다. 소스 빌드로만 제공한다는 사실과 `APPLE_DEVELOPMENT_TEAM`·`IOS_DEVICE_ID` 환경 변수를 쓰는 빌드·설치 절차를 담는다. 작성 전에 Tauri 2 공식 문서(iOS 코드 서명)로 `APPLE_DEVELOPMENT_TEAM` 지원을 재확인하고 링크한다
- [X] T083 [P] [US7] `.github/release-notes.md` 템플릿을 만든다. 지원 범위 원문, macOS 격리 해제는 공증 전 **임시 조치**라는 경고, `shasum -a 256 -c SHA256SUMS.txt` 체크섬 검증 절차, iOS 소스 빌드 안내 링크, 첫 독립 릴리스용 식별자 변경·데이터 이전 안내(`docs/mobile-migration.md`)를 담는다. 같은 경고와 체크섬 절차를 README macOS 설치 절에도 반영한다(FR-020)
- [X] T084 [US7] `.github/workflows/ci.yml`을 만든다(contracts/release-and-ci.md §1).
  - 작업 6개: `verify`, `licenses`(`cargo deny check` + `node scripts/check-licenses.mjs`), `windows-compile-test`(`npm ci`·`npm test`·`cargo check`·`cargo test`, 번들 생성 없음), `macos-build`, `ios-sim-build`, `android-debug`
  - `ios-sim-build`는 차단 작업이다(FR-021). `continue-on-error`를 쓰지 않는다. (2026-11-24 메인테이너 결정·헌법 v5.0.0: 핵심 빌드는 macOS뿐이라 `ios-sim-build`·`android-debug`는 `main` 필수 검사와 릴리스 게이트에서 빼고 결과만 보고한다. `windows-compile-test`는 삭제했다) T008이 실패했다면 이 작업 안에서 원인을 먼저 고친다. 고칠 수 없으면 구현을 멈추고 스펙 예외 개정을 요청한다
  - 비밀값 참조 없음
  - 최상위 `permissions: contents: read`. JavaScript 액션은 Node 24 대응 최신 메이저(작성 시점 확인값, 예: `actions/checkout` v6)를 쓰고, 서드파티 액션은 커밋 SHA로 고정하며 버전을 주석으로 병기한다(research F34, contracts/release-and-ci.md §1)
  - `licenses` 작업에 `cargo-about` 설치와 `node scripts/check-licenses.mjs`(고지 생성물 일치 검사)를 넣는다
- [X] T085 [US7] `.github/workflows/build-apple.yml`을 삭제한다(ci.yml로 흡수)
- [X] T086 [US7] `.github/workflows/release.yml`을 고친다.
  - `gate` 작업(`node scripts/check-release-gate.mjs --release --tag $TAG`)을 맨 앞에 두고 모든 빌드의 `needs`에 넣는다
  - `build-desktop` 매트릭스에서 `windows-x64`와 "Package Windows portable ZIP" 단계를 지운다
  - `build-android`에서 `ANDROID_KEYSTORE_BASE64`를 `$RUNNER_TEMP`에 풀어 환경 변수 4개를 넘기고, 끝나면 지운다(로그 출력 금지)
  - `publish`의 수집 확장자를 `*.dmg *.deb *.rpm *.AppImage *.apk`로 바꾸고, `.exe`·`.msi`·`.zip`이 있으면 실패하게 한다
  - `sha256sum * > SHA256SUMS.txt`를 첨부한다
  - 최상위 권한을 `contents: read`로 내리고 `contents: write`는 `publish` 작업에만 준다. 액션은 T084와 같은 규칙(Node 24 대응 메이저, 서드파티 SHA 고정)으로 올리고, 서명 비밀값은 해당 단계 `env`에만 둔다
  - 제목을 `<새 표시명> $TAG`로, 본문은 `.github/release-notes.md`로 한다
  - `workflow_dispatch` 입력 `rehearsal`(boolean, 기본 false)을 추가한다(contracts/release-and-ci.md §2 리허설 모드). `true`이면 `gate`는 `--release --rehearsal`로 수동 항목을 경고로 낮추고, Android는 비밀값이 없을 때 debug 서명과 `-rehearsal` 이름을 쓰며, `publish`는 `[REHEARSAL]` 제목의 초안만 만든다. 태그 푸시 트리거에서는 `rehearsal`을 켤 수 없어야 한다
  - T039·T040에 `--rehearsal` 모드 테스트와 구현을 더한다(수동 항목 경고, 자동 항목은 그대로 실패)
- [X] T087 [US7] `scripts/ci-build-desktop.mjs`에서 `windows-x64` 분기를 지워 T078을 통과시킨다
- [X] T088 [P] [US7] `specs/001-*/spec.md`와 `specs/002-*/spec.md` 머리말 바로 아래에 안내 한 줄을 추가한다: "식별자·지원 범위는 003에서 변경되었습니다. [003 명세](../003-independent-fork-separation/spec.md) 참고". 본문은 재작성하지 않는다
- [X] T089 [US7] 버전을 첫 독립 릴리스 후보 `1.0.0-alpha.1`(R9)로 올린다. `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, `Cargo.lock`, `tauri.conf.json`, `project.yml`, `Info.plist`를 바꾸고 `npm run check:version`을 통과시킨다. 자동 계산은 프리릴리스를 무시하므로(research F30) `tauri.conf.json`에 `bundle.android.versionCode`를 명시한다. 값은 구 포크 `0.1.6-beta`의 자동값 `1006`보다 크고 이후 릴리스마다 늘어나야 한다(예: `1000001`). `check-release-gate.mjs`(T039·T040)에 `versionCode` 명시·증가 검사를 더한다
- [X] T090 [US7] 헌법 "지원 플랫폼 등급"(`.specify/memory/constitution.md`)과 `src/config/supportScope.ts` 원문의 의미가 같은지 사람이 검토하고, 결과를 `specs/003-independent-fork-separation/checklists/requirements.md` Notes에 기록한다
- [X] T091 [US7] PR을 하나 만들어 `ci.yml` 6개 작업 결과를 확인하고 `verification/release-gate.md` 항목 4·5 근거로 링크한다. PR 생성은 사용자 승인 후 진행하며, 업스트림에는 PR을 보내지 않는다

**Checkpoint**: 모든 사용자 스토리 구현 완료

---

## Phase 10: Polish & 분리 실행 (Cross-Cutting)

**Purpose**: 전체 검증, 원격 정리, 원저작자 고지, 안전 게이트, 분리 요청, 첫 독립 릴리스, 기존 릴리스 고지. plan.md 단계 10–14 순서를 지킨다.

- [X] T092 quickstart §1–§6, §9를 실행해 결과를 `verification/`에 기록한다. `BLOCKED` 항목은 사유와 필요한 환경을 적는다
- [X] T093 (사용자 승인 후) `gh workflow run release.yml -f rehearsal=true -f tag_name=v1.0.0-alpha.1-rehearsal`로 리허설을 실행한다(quickstart §8). 실제 태그 이름은 쓰지 않는다. 그래야 남은 초안에 실제 릴리스가 업로드되는 일이 없다. `rehearsal=true`일 때 `tag_name`이 `-rehearsal`로 끝나지 않으면 워크플로가 실패해야 하고, `--release` 게이트는 같은 태그의 초안 릴리스가 남아 있으면 실패해야 한다(T086·T040에 반영). 태그는 만들지 않는다. `gate` 경고 목록, 산출물 구성(Windows 0개)·체크섬·이름을 확인해 `verification/release-gate.md`에 기록하고, `[REHEARSAL]` 초안 릴리스를 지운다
- [X] T094 (메인테이너) 로컬에서 `git remote remove upstream`을 실행하고 `git remote -v` 결과를 `verification/release-gate.md`에 기록한다
- [X] T095 (메인테이너) 원저작자에게 분리 사실, 식별자 변경, 새 표시명, 지원 범위, Windows 사용자 안내 방침을 정중히 알리고 `verification/upstream-notice.md`에 기록한다(data-model §7). 이의가 있으면 이름을 바꾸거나(T050부터 반복) `supportScope.ts`의 `windowsWording: 'unsupported-only'`로 문구를 줄인 뒤 T033 검사를 다시 통과시킨다
- [X] T096 `node scripts/check-release-gate.mjs --separation`이 통과하는지 확인한다(FR-025 1–5)
- [X] T097 (메인테이너) `docs/windows-eol-notice.md` 문안을 기존 `v0.1.6-alpha`·`v0.1.6-beta` 릴리스 노트 맨 위에 추가한다(`gh release edit`, 산출물 삭제 금지). 분리 방식에 따라 릴리스가 사라질 수 있으므로 **분리 요청 전에** 게시하고, `gh release download`로 모든 릴리스 산출물·노트를 백업한다(research R10)
- [X] T098 (메인테이너) `docs/maintainer-runbook.md`대로 GitHub 저장소 설정에서 비공개 취약점 신고를 켜고 **GitHub Support에** 포크 네트워크 분리를 요청한다. 완료 후 `gh api repos/Ezenitac-AiService/EasyViewer --jq .fork`가 `false`인지, 릴리스와 지원 종료 고지가 남아 있는지, 새 PR 기본 대상과 코드 검색을 확인해 기록한다(SC-003)
- [X] T099 (메인테이너) `node scripts/check-release-gate.mjs --release --tag v1.0.0-alpha.1`이 통과하면(FR-025 1–8, 버전 비중복, `versionCode` 증가) 태그를 푸시해 첫 독립 릴리스를 게시하고, 산출물·체크섬·서명 지문을 `verification/release-gate.md`에 기록한다
- [ ] T100 `specs/003-independent-fork-separation/spec.md` Status를 실제 상태(구현 완료 범위와 `BLOCKED` 항목)로 갱신하고, `/speckit-analyze`로 spec·plan·tasks 정합성을 다시 확인한다

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 바로 시작
- **Foundational (Phase 2)**: Setup 후 진행하며 모든 스토리를 막는다.
  - 스파이크(T004–T009)는 US6·US5·US7 설계를 바꿀 수 있다.
  - 보안 통지(T014)는 공개 비교 문서(T038)와 원저작자 사전 고지(T095)보다 먼저 끝나야 한다.
- **US1(P1)·US2(P1)**: Foundational 후 병렬 가능. 둘 다 `README.md`·`scripts/verify.mjs`를 고치므로 그 파일 작업은 순서대로 한다
- **US3(P2)**: Foundational 후 시작. `CONTRIBUTING.md`(T044)는 T035 이후
- **US4(P2)**: Foundational 후 시작. 지원 범위 검사(T045)는 T033 이후
- **US5(P3)·US6(P3)**: T050(표시명 결정) 후 시작. **함께 출시**. US6의 `tauri.conf.json`·`lib.rs` 변경(T070)은 US5의 T055·T059 이후
- **US7(P4)**: US5 이름 결정(T050) 후 릴리스 제목 작업 가능. T086은 T040(게이트 스크립트)과 T057(서명) 이후
- **Polish (Phase 10)**: 모든 스토리 후, T092 → T093 → T094 → T095 → T096 → T097(지원 종료 고지·릴리스 백업) → T098(Support 분리 요청) → T099(첫 독립 릴리스) → T100 순서. 지원 종료 고지는 반드시 분리 요청 전이다

### User Story Dependencies

```text
Setup → Foundational ─┬─▶ US1 ─┐
                      ├─▶ US2 ─┤ (README·verify.mjs 순차)
                      ├─▶ US3 ─┤
                      ├─▶ US4 ─┤ (T045는 T033 이후)
                      └─▶ [T050 표시명] ─▶ US5 ─▶ US6 ─┐
                                              └──▶ US7 ┘
                                                    ▼
                                         Polish(분리 실행)
```

### Within Each User Story

- 테스트(실패 확인) → 구현 → 검증 순서
- 스크립트 → `verify.mjs` 연결 → 문서
- 메인테이너 작업은 기록 파일 양식이 준비된 뒤

## Parallel Opportunities

- **Phase 1**: T002, T003
- **Phase 2**: T005·T007·T008(스파이크, 서로 다른 OS·도구), T015(테스트)
- **US1**: T017·T018·T019(테스트 3개), T024(NOTICE)·T026(externalLink)
- **US2**: T035·T036·T037(서로 다른 새 파일)
- **US4**: T047은 T046과 병렬
- **US5**: T051·T052(테스트), T060·T061(서로 다른 새 파일)
- **US6**: T064·T065·T066·T067(테스트 4개), T074(문서)
- **US7**: T081·T082·T083·T088(서로 다른 문서)

### Parallel Example: User Story 6

```text
동시에: T064 Rust 이전 테스트 (src-tauri/src/migration/tests.rs)
        T065 자격증명 테스트 (src-tauri/src/migration/credentials.rs)
        T066 migrationService 테스트 (tests/unit/migrationService.spec.ts)
        T067 MigrationNotice 테스트 (tests/unit/migrationNotice.spec.ts)
그다음: T068 → T069 → T070 (Rust, 순차)
        T071 → T072 → T073 (프론트엔드, 순차)
```

## Implementation Strategy

### MVP First (US1 + US2)

1. Phase 1 → Phase 2. 스파이크·기준선 태그·보안 통지를 끝낸다
2. US1(라이선스·고지·정보 화면) → US2(지원 범위 안내)
3. **멈추고 검증**: SC-001, SC-004 확인. 이 상태는 커밋하고 푸시할 수 있다. 다만 릴리스는 하지 않는다(식별자가 아직 원저작자와 같음)

### Incremental Delivery

1. MVP(US1+US2) → US3(게이트·절차) → US4(Windows 전환 문서·실측)
2. US5+US6을 함께 묶어 하나의 증분으로 완성한다(데이터 보호 없이 식별자만 바꾼 상태로 배포 금지)
3. US7(CI·릴리스 전환) → Polish(분리 실행)

### 주의

- `(메인테이너)` 작업과 원격 푸시·PR·릴리스·외부 연락은 사용자 승인 없이 실행하지 않는다
- 업스트림 저장소에는 PR·이슈를 만들지 않는다(보안 통지는 T013의 비공개 경로만)
- 실행하지 못한 검증은 통과로 기록하지 않는다(`BLOCKED`)

## Phase 11: Convergence

- [X] T101 이름을 바꾼 Apple 프로젝트(`src-tauri/gen/apple/pagelight.xcodeproj`, `pagelight_iOS/`, `Sources/pagelight/`)를 Tauri CLI가 그대로 쓰는지 iOS 시뮬레이터 빌드(`APPLE_DEVELOPMENT_TEAM` 지정 후 `npm run tauri ios build -- --target aarch64-sim`)로 확인한다. 실패하면 `xcodegen` 설치 후 `npm run ios:init`으로 재생성해 diff를 검토하고 `project.yml` 수동 변경(팀 ID 제거, 식별자·`PRODUCT_NAME`)을 다시 적용한다. 결과를 `verification/spikes.md`에 기록한다 per FR-015, FR-021, T058 (partial)
- [ ] T102 Android 패키지 이동(`com/ezenitac/easyviewer`)과 release 서명 설정 후 `npm run android:build`(debug APK)가 성공하는지, 서명 환경 변수 없이 `npm run android:release`를 실행하면 `GradleException`으로 실패하는지 로컬에서 확인하고 `verification/spikes.md`에 기록한다 per FR-015, FR-017, T056, T057 (partial)
- [X] T103 `README.md` "출처와 라이선스" 절의 라이선스 버전 선택 근거 참조를 `NOTICE` 4절에서 5절로 고친다(NOTICE에 "앱 이름과 아이콘" 절이 4절로 들어가며 번호가 밀림) per FR-003 (contradicts)
- [X] T104 `docs/ios-build.md`에 저장소에서 지운 개인 기기 UDID와 Apple 팀 ID가 git 이력에는 남아 있고 이력 재작성 금지(헌법 VIII) 때문에 지울 수 없다는 한계를 명시한다 per FR-017 (partial)
- [X] T105 `CHANGELOG.md` `[미출시]` 항목에 US5 변경(식별자 `com.ezenitac.easyviewer`, 표시명 `Pagelight`, 패키지 이름 `pagelight`, 새 아이콘, Android 고정 서명 키, Apple 팀 정보 환경 변수화, `check-identity` 검사)을 추가한다 per FR-002, FR-023 (partial)
- [X] T106 `scripts/check-identity.mjs` 검사 범위에 `.github/workflows/`를 더해 자동화 안의 구 식별자·원저작자 이름 잔존도 막는다. T086(release.yml 이름 전환) 이후 진행하고, `tests/unit/identityCheck.spec.ts`에 실패 케이스를 먼저 추가한다 per SC-002 (partial)
- [X] T107 `npm run test:e2e`를 실행해 샘플 도서 제목 변경(`tests/e2e/reader-epub.spec.ts`)과 정보 대화상자 시나리오(T030)를 포함한 기존 e2e 게이트의 회귀가 0건인지 확인한다 per SC-010 (partial)
