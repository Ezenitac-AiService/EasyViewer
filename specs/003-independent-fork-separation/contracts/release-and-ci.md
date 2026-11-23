# 계약: 릴리스 산출물, CI 작업, 분리 안전 게이트

**요구사항**: FR-008, FR-017, FR-020, FR-021, FR-022, FR-024, FR-025, US7, SC-003, SC-004, SC-008, SC-010 | **리서치**: R6, R7, R9, R12

## 1. CI (`.github/workflows/ci.yml`, PR과 `main` 푸시)

| 작업 | 러너 | 단계 | 차단 |
|---|---|---|---|
| `verify` | ubuntu-22.04 | `npm ci` → `npm run verify`(빌드·단위 테스트·경계·버전·식별자·지원 범위·라이선스 정책 감사(`--no-notices`, `cargo-about` 불필요)·`cargo check`·`cargo test`) | 예 |
| `licenses` | ubuntu-latest | `cargo-about` 설치 → `cargo deny check`(`src-tauri/deny.toml`) → `node scripts/check-licenses.mjs`(기본 모드: 고지 생성물이 출하 대상 합집합과 일치하는지 검사) | 예 |
| `windows-compile-test` | windows-latest | `npm ci` → `npm test` → `cargo check` → `cargo test`. 번들 생성 없음 | 예 | **(2026-11-24 삭제: 헌법 v5.0.0, Windows는 고려 대상 아님)**
| `macos-build` | macos-latest | `npm run mac:build`(ad-hoc 서명), `codesign --verify` | 예 |
| `ios-sim-build` | macos-latest | `ios:init` → 시뮬레이터 debug 빌드, 서명 비밀값 없음 | 작업 자체는 실패로 표시(`continue-on-error` 금지, FR-021). 다만 2026-11-24부터 `main` 병합 필수 검사와 릴리스 게이트에서 뺐다(헌법 v5.0.0: 핵심 빌드는 macOS뿐, 후순위 플랫폼은 보고만) |
| `android-debug` | ubuntu-latest | debug APK 빌드(비밀값 불필요) | 예 |

- 비밀값이 없는 외부 PR에서도 위 작업이 모두 돈다. 서명이 필요한 단계는 `release.yml`에만 둔다.
- 워크플로가 호출하는 스크립트는 저장소에 실제로 있어야 한다. `check-release-gate.mjs`가 `.github/workflows/*.yml`의 `node scripts/...`·`npm run ...` 참조를 검사한다.
- `build-apple.yml`은 `ci.yml`로 흡수한 뒤 삭제한다.

**공급망·권한 규칙**(`ci.yml`·`release.yml` 공통, research R12·F34)
- 워크플로 최상위 권한은 `permissions: contents: read`다. 쓰기 권한(`contents: write`)은 `release.yml`의 `publish` 작업에만 준다.
- JavaScript 액션은 Node 24 대응 최신 메이저를 쓴다(작성 시점 확인값, 예: `actions/checkout` v6).
- `actions/*` 이외의 서드파티 액션(`dtolnay/rust-toolchain`, `Swatinem/rust-cache`, `android-actions/setup-android`, `EmbarkStudios/cargo-deny-action` 등)은 **커밋 SHA로 고정**하고 버전을 주석으로 병기한다.
- 서명 비밀값은 해당 단계의 `env`에만 넣고, 작업이나 워크플로 수준 `env`에 두지 않는다.
- `check-release-gate.mjs --static`이 위 규칙(최상위 권한, SHA 고정, 비밀값 위치)을 검사한다.

## 2. 릴리스 (`.github/workflows/release.yml`, 태그 `v*`)

| 단계 | 요구 |
|---|---|
| `gate` | `node scripts/check-release-gate.mjs --release --tag $TAG`가 FR-025 1–8과 버전 비중복·Android `versionCode` 증가를 확인(아래 §3). 실패하면 이후 작업 중단 |
| `build-desktop` | 매트릭스 `macos-universal`, `linux-x64`만. `windows-x64`와 포터블 ZIP 단계 삭제 |
| `build-android` | release APK, 포크 소유 키로 서명(`ANDROID_KEYSTORE_BASE64` 등). 비밀값이 없으면 실패 |
| `publish` | 수집 확장자 `*.dmg *.deb *.rpm *.AppImage *.apk`, `SHA256SUMS.txt` 생성·첨부, 제목 `<새 표시명> $TAG` |

**리허설 모드**(`workflow_dispatch` 입력 `rehearsal: true`, 태그 푸시로는 켤 수 없음)
- `gate`는 `--release --rehearsal`로 실행한다. 자동 항목(4–7, 버전 비중복)은 그대로 검사하고, 메인테이너 수동 항목(2·3·8)과 태그 게시 항목(1)이 비어 있으면 실패 대신 **경고**로 보고한다.
- 빌드·서명·체크섬·이름 검사는 정식과 같게 실행한다. Android 서명 비밀값이 없으면 debug 키로 서명하고, 산출물 이름에 `-rehearsal`을 붙인다.
- `publish`는 **초안(draft) 릴리스만** 만들고 제목 앞에 `[REHEARSAL]`을 붙인다. 정식 게시·태그 생성은 하지 않는다.
- 리허설의 `tag_name`은 반드시 `-rehearsal`로 끝나야 한다(아니면 워크플로 실패). 실제 릴리스 게이트(`--release`)는 같은 태그 이름의 초안 릴리스가 남아 있으면 실패한다(남은 초안에 업로드되는 것을 막기 위함).
- 리허설 결과로는 FR-025 항목 1–3·8을 통과로 기록하지 않는다.

**산출물 이름**: `<새 표시명>_<버전>_universal.dmg`, `<새 표시명>_<버전>_amd64.deb`, `<새 표시명>_<버전>_amd64.AppImage`, (정식) `<새 표시명>-<버전>-1.x86_64.rpm`, `<새 표시명>_<버전>_android-arm64.apk`, `SHA256SUMS.txt`

**금지**: `.exe`, `.msi`, Windows `.zip`. 하나라도 있으면 publish 전에 실패한다.

**릴리스 노트 필수 문구**
- 지원 범위 원문
- macOS 격리 해제는 공증 전 **임시 조치**라는 경고와 체크섬 검증 절차(FR-020)
- iOS는 소스 빌드로만 제공한다는 사실(FR-021, `docs/ios-build.md` 링크)
- 첫 독립 릴리스에서는 식별자 변경과 데이터 이전 안내(`docs/mobile-migration.md` 포함)

## 3. 분리 안전 게이트 (FR-025)

`check-release-gate.mjs`는 자동으로 확인할 수 있는 항목은 직접 확인하고, 메인테이너 수동 항목은 `specs/003-independent-fork-separation/verification/release-gate.md`의 서명된 체크 항목을 읽는다.

| 순서 | 항목 | 확인 방법 |
|---|---|---|
| 1 | 기준선 태그 게시 | `git ls-remote --tags origin upstream-base-v0.1.6`이 `44c4d37`을 가리킴 |
| 2 | 보안 조율 완료 | `verification/security-coordination.md`에 통지 날짜가 있음 |
| 3 | 원저작자 사전 고지 완료 | `verification/upstream-notice.md`에 고지 날짜와 이의 대응 결과가 있음 |
| 4 | `main` 전체 CI 통과 | 태그 커밋의 `ci.yml` 결과가 success(GitHub API) |
| 5 | 라이선스 감사 통과 | 같은 실행의 `licenses` 작업 결과 |
| 6 | 체크섬 생성 | publish 단계에서 `SHA256SUMS.txt`가 모든 산출물을 덮음 |
| 7 | Windows 산출물 부재 | 산출물 목록 검사 |
| 8 | Android 서명 키 백업 확인 | `verification/release-gate.md` 메인테이너 체크 + 서명 인증서 지문이 직전 릴리스와 같음 |
| (추가) | 버전 비중복 | 업스트림 공개 릴리스 목록(읽기 전용 API)에 같은 버전이 없음(R9) |
| (추가) | Android `versionCode` 증가 | `tauri.conf.json` `bundle.android.versionCode`가 명시되어 있고, 직전 포크 릴리스 APK의 값보다 큼(research R9, F30) |

FR-025는 두 단계다. 분리 요청(GitHub Support)은 **1–5**가 통과한 뒤에만 제출한다(US3-3). 첫 독립 릴리스는 **1–8**과 버전 비중복·`versionCode` 증가가 모두 통과해야 한다.

## 4. 서명·개인 정보 (FR-017)

- **Android**:
  - `build.gradle.kts` release 서명은 환경 변수 4개만 읽는다(R6).
  - 키스토어 파일을 저장소에 넣지 않고, `.gitignore`에 `*.jks`·`*.keystore`를 둔다.
- **Apple**: `developmentTeam`·`DEVELOPMENT_TEAM` 고정값을 없애고 `APPLE_DEVELOPMENT_TEAM`으로 준다.
- **iOS 설치**: `scripts/ios-install.mjs`는 `IOS_DEVICE_ID`가 없으면 사용법을 출력하고 실패한다.
- **로그**: 워크플로는 비밀값을 `echo`하지 않고, 디코딩한 키스토어는 작업이 끝나면 지운다.

## 5. 테스트 요구

- `releaseWorkflow.spec.ts`:
  - `release.yml`에 Windows 매트릭스·확장자가 없음
  - `SHA256SUMS` 단계 존재
  - `gate`가 publish보다 먼저 실행됨
- `governanceScripts.spec.ts`:
  - `check-release-gate.mjs` 각 항목 실패 사례
  - 존재하지 않는 스크립트를 참조하는 워크플로 탐지
- `ci-build-desktop.mjs` 테스트: `windows-x64` 분기 제거 후 기존 macOS·Linux 규칙 유지
