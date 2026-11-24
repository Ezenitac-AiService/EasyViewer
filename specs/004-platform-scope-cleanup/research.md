# Phase 0 Research: 지원 범위 재정렬과 독립 포크 분리 마무리

기술 맥락에 남은 미정 항목은 없다. 아래는 설계 선택과 근거다. 내부 사실은 2026-11-24 저장소에서 직접 확인했다.

## R1. Windows 전용 요소 목록 (FR-008, 동작 기준)

판정 기준: **Windows용으로 빌드하거나 실행할 때만 효과가 있는가**(스펙 Clarifications, 헌법 v6.1.0).

| 위치 | 내용 | 판정 | 처리 |
|---|---|---|---|
| `src-tauri/Cargo.toml` | `[target.'cfg(any(target_os = "macos", windows, target_os = "linux"))'.dependencies]` | `windows` 항목만 Windows 전용 | 조건에서 `windows` 제거 |
| `src-tauri/src/main.rs` | `#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]` | Windows에서만 효과(콘솔 창 숨김) | 제거 |
| `src-tauri/capabilities/desktop.json` | `"platforms": ["linux", "macOS", "windows"]` | `windows` 값만 Windows 전용 | 값 제거. `"windows": ["main"]`은 앱 창 목록이라 유지 |
| `src-tauri/tauri.conf.json` | `"icons/icon.ico"` | Windows 번들에서만 쓰는 아이콘 형식 | 목록에서 제거 |
| `src-tauri/icons/icon.ico`, `Square*Logo.png`, `StoreLogo.png` | Windows 실행 파일·스토어(AppX/MSIX)용 | Windows 전용 | 파일 제거. `check-identity`의 `icon.ico` 해시 항목도 제거 |
| `src-tauri/deny.toml` | `targets`의 `x86_64-pc-windows-msvc` | Windows 대상 감사 | 제거(`about.toml`에는 이미 없음) |
| `src-tauri/src/security/path_guard.rs` | `cfg!(any(target_os = "macos", target_os = "windows"))` 대소문자 무시 | `windows` 분기는 Windows에서만 효과 | `cfg!(target_os = "macos")`로 축소 |
| `src-tauri/src/migration/engine.rs` | 같은 `cfg!` | 같음 | 같은 처리 |
| `path_guard.rs` 차단 목록 `c:/windows` 등과 T009 테스트 | 모든 OS에서 Windows 형식 입력을 거부 | **Windows 전용 아님**(입력 검증, FR-010) | 유지 |
| `src/config/supportScope.ts` Windows 문장 | 원저작자 안내 | 허용 목록 | 유지 |
| `scripts/check-release-gate.mjs` Windows 산출물 차단 | 게시 금지 강제 | 허용 목록(차단 검사) | 유지 |
| `src-tauri/gen/android/gradlew.bat` | Windows 호스트용 Gradle 래퍼 | Windows 호스트에서만 효과 | **예외로 유지**(R2) |
| `src-tauri/gen/apple/.../main.mm`의 `.windows` | iOS `UIWindow` 목록 | Windows 무관 | 유지 |
| `docs/windows-migration.md`, `docs/windows-eol-notice.md` | 지원 종료 이력·링크 대상 | 보존 기록(헌법 v6.1.0) | 맨 위에 "보존 기록, 갱신하지 않음" 표시만 추가 |

- **Decision**: 위 표대로 처리한다.
- **Rationale**: `.ico`는 Tauri에서 Windows 아이콘 형식이고, `Square*Logo`·`StoreLogo`는 AppX/MS Store용이다([Tauri v1 Icons](https://v1.tauri.app/v1/guides/features/icons), [Tauri v2 Icons](https://v2.tauri.app/develop/icons/)). v2 문서는 이 파일들의 Windows 한정 여부를 명시하지 않으므로, 제거 후 macOS·Linux·Android·iOS 번들 빌드가 그대로 통과하는지로 다시 확인한다(quickstart §3).
- **Alternatives considered**: 단어 기준 일괄 삭제는 앱 창 목록(`windows: ["main"]`)·입력 검증까지 지워 거부했다.

## R2. 생성물 안의 Windows 파일 (`gradlew.bat`)

- **Decision**: `src-tauri/gen/android/gradlew.bat`는 지우지 않고 재유입 검사의 허용 목록에 넣는다.
- **Rationale**: `npm run android:init`이 Android 프로젝트를 다시 만들 때 이 파일도 생성한다. 지우면 CI·릴리스의 "init 후 `gen/android` 차이 없음" 검사(003 S4)가 깨진다. 이 파일은 macOS·Linux 빌드에 아무 효과가 없어 남겨도 위험이 없다.
- **Alternatives considered**: init 후 삭제 단계 추가는 생성물 수정이라 S4 검사의 의미를 흐린다.

## R3. 테스트용 빌드 표식 형식 (FR-004)

- **Decision**:
  - 파일 이름: 기존 이름의 확장자 앞에 `-test`를 붙인다. 예: `Pagelight_1.0.0-alpha.2_amd64-test.deb`, `Pagelight_1.0.0-alpha.2_amd64-test.AppImage`, `Pagelight_1.0.0-alpha.2_android-arm64-test.apk`. 리허설 APK는 `-test-rehearsal`.
  - 릴리스 노트: 게시 단계가 "테스트용 빌드" 절(한·영)을 생성해 붙인다. 포함된 테스트 빌드 플랫폼 목록, 미보장 범위, 이슈 양식 링크를 담는다.
  - macOS 산출물 이름은 바꾸지 않는다.
- **Rationale**: 파일만 내려받아 전달되는 경우에도 표식이 남는다. 접미사는 패키지 관리자가 읽는 메타데이터(deb 패키지 이름·버전)를 바꾸지 않는다.
- **Alternatives considered**: 버전 문자열에 `-test`를 넣는 방식은 deb 버전 비교·rpm 제약(하이픈 금지)과 충돌해 거부했다. 별도 "테스트" 릴리스로 나누는 방식은 체크섬·릴리스 수가 두 배가 되어 거부했다.

## R4. 연속 누락 횟수 계산 (FR-005c)

- **Decision**: 상태 파일을 두지 않고, 게이트가 빌드 전에 최근 게시 릴리스(초안·리허설 제외, 최신순 3개)를 조회해 계산한다.
  - Linux: 산출물에 `amd64-test.(deb|AppImage|rpm)`이 없으면 누락.
  - Android: `android-arm64-test.apk`가 없으면 누락. 단, 릴리스 노트에 `<!-- pagelight:omitted android=no-signing-key -->` 표식이 있으면 세지 않는다.
  - 게시 단계는 빠진 플랫폼마다 `<!-- pagelight:omitted <platform>=<reason> -->`(reason: `build-failed`, `security`, `no-signing-key`)을 릴리스 노트에 남긴다.
  - 표식 도입 이전 릴리스(`v1.0.0-alpha.1` 이전)는 계산에서 제외한다. `v1.0.0-alpha.1`은 Linux 포함, Android는 서명 키 없음으로 본다(릴리스 노트의 기존 안내 문장으로 판별).
  - 조회 실패는 BLOCKED(종료 코드 2).
- **Rationale**: 저장소에 상태를 쓰면 게시 작업이 커밋 권한을 가져야 한다. 게시된 릴리스는 이미 신뢰할 수 있는 이력이다.
- **Alternatives considered**: 저장소 내 카운터 파일(쓰기 권한·경합), Actions 캐시(만료로 유실)는 거부했다.

## R5. 보안상 테스트 빌드 제외 (FR-005b)

- **Decision**: `.github/release-exclusions.json`에 `{ "platform": "linux"|"android", "advisory": "<식별자>", "since": "YYYY-MM-DD" }` 목록을 둔다. 게이트는 목록의 플랫폼을 빌드하지 않게 하고(출력 `linux`/`android` = false), 게시 단계가 보안 제외 안내와 `security` 표식을 남긴다. 결함 세부는 적지 않는다(헌법 VIII 보안 조율). `SECURITY.md`(국문·영문)에 테스트 빌드 보안 보장 범위를 적는다.
- **Rationale**: 메인테이너가 PR로 선언하므로 검토 기록이 남고, 게이트가 기계적으로 따를 수 있다.
- **Alternatives considered**: `workflow_dispatch` 입력은 태그 푸시 릴리스에 적용되지 않아 거부했다.

## R6. 테스트 빌드 이슈 양식과 자동 표시 (FR-003)

- **Decision**: 버그 양식을 둘로 나눈다.
  - `bug_report.yml`(핵심·유지): 플랫폼 선택지 macOS, iOS. 라벨 `bug`.
  - `bug_report_test_build.yml`(테스트 빌드): 플랫폼 선택지 Linux, Android. 라벨 `bug`, `test-build`. 맨 위에 "대응 일정 보장 없음" 안내(한·영)와 필수 확인 항목.
  - `config.yml`은 Windows 사용자 안내(원저작자 링크)와 보안 신고 링크를 유지한다.
  - `test-build` 라벨을 저장소에 만든다(없는 라벨은 자동으로 붙지 않음).
- **Rationale**: GitHub 이슈 양식의 `labels`는 양식 단위로 고정되며 선택값에 따라 라벨을 바꾸는 기능이 없다([Syntax for issue forms](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms)). 양식을 나누면 쓰기 권한 워크플로 없이 자동 표시가 된다.
- **Alternatives considered**: 이슈 열림 이벤트에 라벨을 붙이는 워크플로는 `issues: write` 권한이 필요해 거부했다.
- **영향**: `check-support-scope.mjs`의 "버그 양식 선택지 = macOS·iOS·Linux·Android" 규칙을 "핵심 양식 = macOS·iOS, 테스트 빌드 양식 = Linux·Android"로 바꾼다.

## R7. 릴리스 작업의 실패 격리 (FR-005a)

- **Decision**: `release.yml`을 다음으로 나눈다.
  - `gate`: 빌드 전 게이트. 출력 `linux`, `android`(보안 제외·서명 키·연속 누락 판단 반영).
  - `build-macos`(핵심): 실패하면 게시하지 않는다.
  - `build-linux`, `build-android`(테스트 빌드): `if: needs.gate.outputs.<p> == 'true'`.
  - `publish`: `if: !cancelled() && needs.gate.result == 'success' && needs.build-macos.result == 'success'`. Linux·Android 작업 결과(`success`·`failure`·`skipped`)를 환경 변수로 받아, 실패·건너뜀이면 누락 안내와 표식을 쓴다.
  - `continue-on-error`는 쓰지 않는다.
- **Rationale**: 작업 결과 값은 `success`, `failure`, `cancelled`, `skipped`이고, 상태 함수가 없는 `if`에는 암묵적 `success()`가 붙어 상류 실패 시 건너뛴다. `!cancelled()`와 명시적 결과 비교로 "핵심 성공 + 테스트 빌드 실패 허용"을 표현할 수 있다([Actions contexts](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts), [community discussion #25286](https://github.com/orgs/community/discussions/25286?sort=old)).
- **Alternatives considered**: 행렬 + `fail-fast: false`는 게시 작업이 행렬 전체 결과 하나만 봐 플랫폼별 판단이 어려워 거부했다.

## R8. 이미 게시된 `v1.0.0-alpha.1` (FR-007)

- **Decision**: 산출물·체크섬은 두고, 릴리스 노트 끝에 "Linux 산출물은 테스트용 빌드" 한·영 문장과 `<!-- pagelight:omitted android=no-signing-key -->` 표식을 덧붙인다(`gh release edit`, 메인테이너 승인 후).
- **Rationale**: 파일 이름을 바꾸면 체크섬 파일과 외부 링크가 깨진다. 표식을 덧붙여야 R4 계산이 이 릴리스를 올바르게 해석한다.
- **Alternatives considered**: 재게시는 태그·체크섬 혼란으로 거부했다.

## R9. 영문 지원 범위 블록 (FR-002)

- **Decision**: `renderSupportScopeEn()`을 추가하고, 영문 문서에 `<!-- support-scope-en:start -->`…`<!-- support-scope-en:end -->` 블록을 넣는다. `check-support-scope.mjs`는 `*.en.md`와 `NOTICE.en.md`에서 영문 블록을, 나머지에서 한국어 블록을 검사한다. 영문 배너(README 맨 위)는 영문 원문의 첫 문장 요약을 그대로 쓴다.
- **Rationale**: 한국어 블록과 같은 방식이라 검사 로직을 재사용할 수 있고, 등급이 바뀔 때 수작업 번역 누락이 사라진다.
- **Alternatives considered**: 영문을 사람 검토로만 확인하는 방식은 SC-001 자동 확인을 만족하지 못해 거부했다.

## R10. 003 남은 작업 분류 (FR-012–FR-014)

| 작업 | 분류 | 사유 |
|---|---|---|
| T048·T049 Windows 전환 검증 | 범위 제외 | 헌법 v6.0.0 Windows 제외 |
| T005 S1 Linux 이전 스파이크 | 범위 제외 | Linux 테스트 빌드, 이전 동작은 자동 테스트로 보장(FR-015) |
| T076 이전 시나리오 | macOS 부분은 004 이관(남은 시나리오 1·6·8, BLOCKED 유지), Linux 부분 범위 제외 | 핵심 플랫폼 유지, 테스트 빌드 실기기 미보장 |
| T077 공존 설치 | macOS는 004 이관, Linux·Android 부분은 범위 제외 | FR-013(테스트 빌드는 실기기 검증 미보장, 실기기 미보유) |
| T102 Android release 서명 강제 로컬 확인 | 범위 제외로 낮춤, 게이트·CI 규칙 테스트(`checkAndroidReleaseSigning`)로 대체 | 테스트 빌드, 로컬 SDK 미보유 |
| T006 S2 macOS 키체인 창 | 004 이관(macOS 실기기, BLOCKED 유지) | 핵심 플랫폼 |
| T062 Android 서명 키 | 메인테이너 작업으로 유지(완료 조건 아님) | 스펙 Assumptions |
| T100 003 스펙 상태 갱신 | 004에서 수행 | FR-014 |
