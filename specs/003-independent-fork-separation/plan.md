# Implementation Plan: 독립 포크 분리

**Branch**: `003-independent-fork-separation` (아직 만들지 않음 — 현재 체크아웃은 `main`) | **Date**: 2026-11-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-independent-fork-separation/spec.md`

> **개정 메모 (2026-11-24)**: 이 계획의 "Windows 컴파일·테스트는 CI에서 유지"(R12, 원칙 V 판정)는 헌법 v5.0.0에서 Windows CI 작업 삭제로, v6.0.0에서 Windows 완전 제외로 대체되었다. 남은 Windows 전용 요소 제거와 재유입 검사는 `specs/004-platform-scope-cleanup`(US3)이 맡는다. 이 문서는 설계 당시 기록으로 남긴다.

**참고 자료**: 입력 문서 `easyviewer-003-fork-separation-specify-input.md` §4(기술 사실·영향 파일·리서치 항목·작업 순서 제약). 2026-11-17 실측으로 일부를 갱신했다. 특히 업스트림이 `v0.2.1`까지 릴리스했다([research.md](research.md) F3).

## Summary

EasyViewer를 업스트림에서 독립된 포크로 분리한다. 기술적 접근은 다섯 갈래다.

1. **법적 준수**
   - 귀속·변경 고지, `GPL-3.0-only` 선언, 앱 정보 화면을 갖춘다.
   - Rust는 `cargo-deny`로, 프론트엔드는 자체 lockfile 스크립트로 라이선스를 감사한다(R5, R13).
2. **저장소 독립**
   - 기준선 태그를 만들고 업스트림 원격과 동기화 경로를 제거한다.
   - 보안 조율과 원저작자 사전 고지 뒤에 분리를 요청하고, 이 순서를 FR-025 안전 게이트로 강제한다(R10, R11).
3. **지원 범위 전환**
   - 지원 범위 원문을 하나로 두고 검사 스크립트로 일치를 강제한다(R15).
   - 릴리스에서 Windows 산출물을 없애고, Windows 컴파일·테스트는 새 `ci.yml`에서 유지한다(R12).
4. **앱 정체성 분리**
   - 식별자를 `com.ezenitac.easyviewer`로 바꾸고, 새 표시명·패키지 이름을 쓴다.
   - Android는 포크 소유 고정 키로 서명하고, Apple 팀 정보는 환경 변수로 옮긴다(R4, R6, R7).
5. **데이터 보호**
   - 메인 창을 만들기 전에 Rust가 구 식별자 폴더를 복사한다.
   - 자격증명은 Rust 명령으로 구 서비스에서 새 서비스로 이전한다.
   - 실패하면 서재를 재구성하는 폴백을 쓴다(R1, R2).
   - Windows 사용자에게는 실측 검증한 수동 전환 문서를 준다(R3).

구현 전에 스파이크 4개(S1·S2·S4·S5)로 핵심 가정을 실측하고, 결과에 따라 이 계획을 갱신한다. S3(공존 설치)은 새 이름으로 빌드한 뒤에야 잴 수 있으므로 구현 후반(T077)에 둔다.

## Technical Context

**Language/Version**: TypeScript `~5.6`(strict), Vue 3 `^3.5`, Rust edition 2021(`rustc >= 1.90`), Node 24(CI), Kotlin Gradle 스크립트(Android), YAML(GitHub Actions)

**Primary Dependencies**:
- Tauri `2.12.5` / wry `0.57.1`
- `tauri-plugin-keyring-store 0.3.2`
- `@tauri-apps/plugin-opener` (`allow-open-url` 권한 신규)
- `cargo-deny`, `cargo-about`(CI·고지 생성 도구, 앱 의존성 아님)
- 새 런타임 의존성 1개: `tauri-plugin-single-instance`(Tauri 공식 플러그인, 이전 중 이중 실행 방지). 라이선스 감사·고지 생성 범위에 포함한다
- 구 앱 실행 감지는 시스템 명령(macOS `lsappinfo`, Linux `/proc`)으로 해서 의존성을 늘리지 않는다

**Storage**:
- WebView IndexedDB `EasyViewerDB` v2와 `localStorage` `easyviewer:*`
- 앱 데이터 폴더 `books/`
- OS 키체인(서비스명 = 식별자)
- 신규: 마이그레이션 기록 파일(새 앱 데이터 폴더)

**Testing**:
- Vitest + `@vue/test-utils` + `jsdom` + `mockIPC`
- `cargo test`(임시 폴더 기반 마이그레이션 테스트)
- Playwright(정보 화면 접근성)
- 스크립트 단위 테스트(`tests/unit/governanceScripts.spec.ts` 확장)

**Target Platform**:
- 중점: macOS 11+, iOS 15+(소스 빌드), Linux(deb·AppImage·rpm)
- 유지: Android
- 비지원(컴파일·테스트만): Windows
- 개발 보조: 웹

**Project Type**: 크로스 플랫폼 데스크톱·모바일 앱(Tauri 2) + 저장소 거버넌스·릴리스 자동화

**Performance Goals**:
- 첫 실행 마이그레이션은 서재 파일 복사가 대부분을 차지한다. 소요 시간 목표는 **아직 근거가 없다**. S1에서 1 GB 서재 복사 시간(APFS 복제 여부 포함)을 잰 뒤 목표값을 정한다.
- 복사는 백그라운드 스레드에서 하고 `setup` 훅은 바로 반환한다. 복사가 5초를 넘으면 `incognito` + 임시 `data_directory` 진행 창을 띄운다(research R1). 메인 WebView는 이전 결정이 끝난 뒤에만 만든다.
- 캐시 폴더는 복사하지 않는다(macOS `~/Library/Caches/<식별자>`, Linux WebKit 캐시 하위 폴더).
- 기존 초기 번들 예산(`index-*.js <= 480 kB`)을 지킨다.

**Constraints**:
- 프로덕션 파일 450줄 이하. `useBookStore.ts`는 이미 448줄이라 새 로직은 별도 모듈에 둔다.
- 비밀값을 저장소·로그에 노출하지 않는다.
- 이력 재작성을 금지한다.
- 업스트림 병합을 금지한다.
- 공개 문구는 포크 범위만 서술한다.

**Scale/Scope**:
- 영향 파일 약 40개(설정 12, 스크립트 6, 워크플로 3, Rust 3, 프론트엔드 6, 문서 10)
- 신규 문서 8개
- 메인테이너 수동 작업 6건(태그 푸시, 보안 통지, 사전 고지, 분리 요청, 서명 키, 기존 릴리스 고지)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

헌법 v4.0.0 기준이다.

| 원칙·게이트 | 판정 | 근거 |
|---|---|---|
| I. 한국어 문서·커밋, 영어 코드 | PASS | 모든 산출물을 한국어로 작성한다. 배너 영문 한 줄은 명세 확정 결정 11의 예외다. 코드 식별자는 영어로 쓴다 |
| II. TDD | PASS | 마이그레이션(Rust·TS), 자격증명 이전, 검사 스크립트 4종, 정보 화면 모두 실패 테스트를 먼저 쓴다. 문서·워크플로는 검사 스크립트 테스트로 고정한다 |
| III. 무결성·우회 금지 | PASS | 마이그레이션은 실제 파일 시스템 경로로 구현한다. 테스트는 임시 폴더와 `mockIPC`로 경계만 격리한다 |
| IV. 근거 기반 | PASS | research.md F1–F34에 파일·명령·공식 문서 근거를, R7·R10·R16에 재확인 지점을 명시했다. 미실측 항목은 스파이크 S1–S5로 남겼다 |
| V. 플랫폼 추상화·엔진 분리 | PASS | 마이그레이션 결과 조회와 자격증명 이전은 `src/services/platform/` 포트를 거친다. Windows 코드 경로는 유지하고 CI에서 컴파일·테스트한다 |
| VI. 의심·다층 검증 | PASS | 스파이크와 실기기 검증(Windows 전환, 공존 설치)은 실행 전까지 `BLOCKED`로 보고한다 |
| VII. Zero Trust | PASS | 마이그레이션 복사는 심볼릭 링크를 건너뛰고 경로를 정규화하며 민감 경로를 차단한다(`path_guard.rs` 재사용). 외부 링크는 권한과 프론트엔드 양쪽에서 허용 목록으로 검사한다. 자격증명은 IPC로 평문 전달하지 않는다 |
| VIII. 독립 포크 운영 | PASS | 업스트림 원격 제거, 동기화 금지 문서화, 보안 조율 선행, 표현 금지어 검사, `GPL-3.0-only`, 구분되는 이름을 모두 계획에 넣었다 |
| 문서 분리 게이트 | PASS | spec.md에는 구현 세부가 없다. 경로·도구는 plan·research에만 있다 |
| 타입·빌드·테스트·경계 게이트 | PASS(계획) | `npm run verify`에 새 검사 스크립트를 넣는다 |
| 라이선스 감사 게이트 | 현재 `BLOCKED` → 이 기능이 해소 | 도구를 이번 기능에서 도입한다. 도입 전에는 릴리스하지 않는다 |
| 지원 범위·릴리스 게이트 | 현재 위반 → 이 기능이 해소 | `release.yml`이 Windows 산출물을 게시하고 있다(F17). 이 기능의 US7에서 고친다 |
| 버전·식별자 동기화 | 현재 위반 → 이 기능이 해소 | `check:version`이 구 식별자를 기대값으로 쓴다(F16). US5에서 기대값과 차단 규칙을 바꾼다 |

현재 위반 3건은 헌법 개정(v4.0.0)으로 생긴 것이고, 이 기능이 바로 그 해소 작업이다. 따라서 정당화가 필요한 새 위반은 없다.

**Phase 1 설계 후 재검사**: [data-model.md](data-model.md)와 [contracts/](contracts/)를 반영해 다시 점검했다. 결과는 PASS이며 판정은 바뀌지 않았다. 마이그레이션 계약은 원본을 보존하고 멱등이며 실패해도 앱을 막지 않는다. 링크 계약은 허용 목록이 2개뿐이다. 릴리스 계약은 Windows 산출물 0개와 체크섬을 요구한다.

## Project Structure

### Documentation (this feature)

```text
specs/003-independent-fork-separation/
├── spec.md
├── plan.md                 # 이 파일
├── research.md             # Phase 0
├── data-model.md           # Phase 1
├── quickstart.md           # Phase 1
├── contracts/
│   ├── data-migration.md         # 데스크톱 1회 이전·자격증명 이전 계약
│   ├── support-scope-wording.md  # 지원 범위 원문·게시 위치·금지 표현
│   ├── about-screen.md           # 정보 화면 내용·링크 허용 목록
│   └── release-and-ci.md         # 릴리스 산출물·CI 작업·FR-025 게이트
├── verification/           # 구현 단계에서 생성(실측 기록)
├── checklists/requirements.md
└── tasks.md                # /speckit-tasks에서 생성
```

### Source Code (repository root)

```text
src-tauri/
├── tauri.conf.json                 # identifier, productName, app.windows[].create=false, developmentTeam 제거
├── tauri.android.conf.json         # identifier
├── Cargo.toml                      # package name·license·authors
├── deny.toml                       # 신규: cargo-deny 정책
├── capabilities/default.json       # opener:allow-open-url 허용 목록 2개
├── src/lib.rs                      # setup 훅: 마이그레이션 → 메인 창 생성, 신규 명령 등록
├── src/migration/                  # 신규
│   ├── mod.rs                      # 폴더 복사(임시→검증→rename), 기록 파일, 멱등
│   └── credentials.rs              # migrate_legacy_credentials 명령
└── gen/
    ├── android/app/build.gradle.kts            # namespace·applicationId, release 서명(환경 변수)
    ├── android/app/src/main/java/com/ezenitac/easyviewer/MainActivity.kt   # 패키지 이동
    ├── android/buildSrc/src/main/java/com/ezenitac/easyviewer/kotlin/      # 패키지 이동
    ├── android/app/src/main/res/values/strings.xml                         # app_name
    └── apple/project.yml, apple/easy-viewer_iOS/Info.plist                 # 식별자·PRODUCT_NAME·팀 제거

src/
├── config/supportScope.ts          # 신규: 지원 범위 단일 원문
├── generated/about.json            # 신규(스크립트 생성): 버전·서드파티 목록
├── services/platform/migrationService.ts      # 신규: 마이그레이션 기록 조회·자격증명 이전 포트
├── components/common/AboutDialog.vue           # 신규: 정보 화면
├── components/library/MigrationNotice.vue      # 신규: 이전 결과·복구 안내
└── views/LibraryView.vue           # 정보 화면 진입점·안내 배치(450줄 이하 유지)

scripts/
├── check-version-sync.mjs          # EXPECTED_APP_ID 변경, 구 구조(com/edith) 차단 추가
├── check-licenses.mjs              # 신규: 프론트엔드 라이선스 감사 + 고지 일치
├── check-support-scope.mjs         # 신규: 원문 블록 일치·금지 표현
├── check-identity.mjs              # 신규: 구 식별자·원저작자 이름 잔존 검사(예외 목록)
├── check-release-gate.mjs          # 신규: FR-025 안전 게이트
├── ios-install.mjs                 # 신규: IOS_DEVICE_ID 환경 변수
├── ci-build-desktop.mjs            # windows-x64 분기 제거
└── verify.mjs                      # 신규 검사 단계 추가

.github/
├── workflows/ci.yml                # 신규: verify·licenses·windows-compile-test·macos·ios-sim·android-debug
├── workflows/release.yml           # Windows 제거, 체크섬, 서명, 안전 게이트, 새 이름
├── workflows/build-apple.yml       # ci.yml로 흡수 후 삭제
└── ISSUE_TEMPLATE/                 # 신규: 버그·기능 양식(지원 플랫폼 선택지), config.yml(Windows→원저작자)

docs/
├── windows-migration.md            # 신규: Windows 전환 절차
├── mobile-migration.md             # 신규: iOS·Android 안내
├── android-signing.md              # 신규: 키 생성·백업·분실 대응
└── ios-build.md                    # 신규: 소스 빌드 절차

README.md, NOTICE(신규), CHANGELOG.md(신규), CONTRIBUTING.md(신규), SECURITY.md(신규), THIRD_PARTY_LICENSES.md
specs/001-*/spec.md, specs/002-*/spec.md   # 머리말 안내 한 줄만 추가

tests/
├── unit/governanceScripts.spec.ts  # 식별자·라이선스·지원 범위·안전 게이트 스크립트
├── unit/migrationService.spec.ts   # 신규
├── unit/aboutDialog.spec.ts        # 신규
├── unit/releaseWorkflow.spec.ts    # Windows 분기 제거 반영
└── e2e/accessibility-and-ux.spec.ts  # 정보 화면 대화상자 규약
```

**Structure Decision**:
- 기존 단일 저장소 구조(`src/` 프론트엔드 + `src-tauri/` 백엔드 + `scripts/` 거버넌스)를 그대로 쓴다.
- 새 Rust 로직은 `src-tauri/src/migration/` 모듈로 분리하고, `lib.rs`에는 호출과 명령 등록만 더한다.
- 새 프론트엔드 로직은 `services/platform/` 포트와 독립 컴포넌트로 둔다. `useBookStore.ts`가 448줄이라 여기에 더하면 상한을 넘기 때문이다.

## 단계와 순서 (입력 문서 §4.3 반영)

FR-025와 R11 때문에 순서 제약이 있다. `/speckit-tasks`는 이 순서를 지켜야 한다.

| 단계 | 내용 | 사용자 스토리 | 비고 |
|---|---|---|---|
| 0 | 기능 브랜치 생성, 스파이크 S1·S2·S4·S5 | — | S1 실패 시 R1 폴백을 기본으로 바꾸고 plan 갱신 |
| 1 | 기준선 태그 `upstream-base-v0.1.6` 생성·푸시, 미병합 기록 | US3 | 메인테이너 푸시 |
| 2 | 보안 영향 목록 작성 → 비공개 연락 경로 확보 → 원저작자 비공개 통지 | — (FR-013) | 원저작자 저장소는 비공개 취약점 신고가 꺼져 있음(R11). 공개 문서에 결함 비교를 쓰기 전에 완료 |
| 3 | 라이선스 정책·감사 게이트, 귀속·변경 고지 | US1 | |
| 4 | 지원 범위 원문·검사, README 배너, 이슈 양식, 정보 화면 | US2 | 표시명 확정 필요(열린 입력) |
| 5 | 식별자·이름 변경 + 마이그레이션(테스트 우선) | US5 + US6 | 같은 릴리스로 묶음 |
| 6 | Android 서명 키 생성·백업, Apple 팀 정보 이동 | US5 | 메인테이너 키 보관 |
| 7 | CI·릴리스 전환 | US7 | |
| 8 | 거버넌스 문서, 과거 명세 안내, 헌법 7곳 일치 확인 | US7 | 헌법은 v4.0.0으로 이미 개정 |
| 9 | Windows 전환 절차 실측 | US4 | 실기기 없으면 `BLOCKED` |
| 10 | 전체 검증(quickstart) | — | |
| 11 | 업스트림 원격 제거 | US3 | |
| 12 | 원저작자 사전 고지 | — (FR-014) | 이의 시 확정 결정 10 |
| 13 | 기존 Windows 프리릴리스에 지원 종료 고지 | US4 | 분리 **전에** 게시. 분리 방식에 따라 릴리스가 사라질 수 있음(research R10). 산출물은 삭제하지 않음 |
| 14 | 분리 게이트(FR-025 1–5) 확인 → GitHub Support 분리 요청 → 릴리스 게이트(1–8) 확인 → 첫 독립 릴리스 | US3, US7 | FR-025 두 단계 |

## 위험

| 위험 | 영향 | 대응 |
|---|---|---|
| S1 실패: 복사한 WebKit 저장소를 새 앱이 못 읽음 | 진행률·책갈피·설정 손실 | 서재 재구성 폴백 + 손실 안내. 사용자에게 알리는 문구를 계약에 포함 |
| S2: macOS 키체인 접근 대화상자 | 사용자 혼란 | 첫 실행 안내에서 미리 설명하고, 거부하면 재입력 |
| S4: `android:init`이 Gradle 파일을 덮어씀 | 서명 설정 소실 | init 이후 주입 단계로 전환 |
| 업스트림이 더 높은 버전을 계속 냄 | 버전 충돌 | 게시 직전 재조회(R9) + 이름 구분 |
| `com.ezenitac` 도메인 미소유(F21) | 장기 식별자 신뢰 | 기록하고, 도메인 확보를 권장. 바꾸려면 clarify·헌법 재개정 |
| 분리 요청 지연 | PR 대상 혼선 | 임시 운영 절차 문서화(R10) |
| 자체 분리(Leave fork network) 사용 시 이슈·PR·스타·위키 손실, 릴리스 보존 불명 | 지원 종료 고지 불가, 이력 손실 | Support 요청을 기본으로, 자체 분리는 백업 후 예외로만(R10) |
| 이전 중 구 앱 실행·이중 실행 | SQLite WAL 불일치로 데이터 손상 | 잠금 파일, 단일 인스턴스, 구 앱 실행 시 메인 창 없이 네이티브 대화상자로 결정(R1) |
| 이전 결정 전에 영속 WebView 생성 | 새 위치에 저장소가 생겨 이전 기회가 영구 소멸 | "결정 전 영속 WebView 금지" 불변식, 진행 창은 incognito + 임시 폴더(R1, data-model §1) |
| 구 폴더에 원저작자 앱 데이터가 섞임 | 출처 불명 데이터 유입 | 복사만 하고 안내, "이전 결과 버리기" 제공(R1) |
| 전이 의존성 고지 누락 | MIT·BSD·Apache 고지 의무 위반 | `cargo-about`와 npm 고지 생성, 정보 화면에서 전문 제공(R5) |
| 원저작자 비공개 연락 경로 부재 | 보안 결함이 공개 채널로 새는 사고 | 경로 확보 전 공개 비교·공지 금지(R11) |
| Android `versionCode` 프리릴리스 충돌 | 프리릴리스 간 업데이트 불가 | 명시적 `versionCode`와 게이트 검사(R9) |
| GitHub Actions Node 20 폐지·태그 참조 | CI 중단, 공급망 위험 | 최신 메이저로 올리고 SHA 고정, 작업별 최소 권한(R12) |

## Complexity Tracking

> 헌법 위반을 정당화할 항목은 없다. 위의 "현재 위반 3건"은 이 기능이 해소하는 대상이다.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (없음) | — | — |
