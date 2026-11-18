# 스파이크 실측 기록

## S1 (macOS) — 복사한 WebKit 저장소를 새 식별자 앱이 읽는가 (T004)

| 필드 | 내용 |
|---|---|
| 날짜 | 2026-11-17 |
| 환경 | macOS (Darwin 27.2), Apple Silicon, Tauri 2.12.5 / wry 0.57.1, debug `.app` 번들(`npx tauri build --debug --bundles app`) |
| 구 데이터 | 이 Mac에 이미 있던 구 식별자 데이터: `~/Library/WebKit/com.edith.easyviewer/WebsiteData`(파일 18개, 568 KB), `~/Library/Application Support/com.edith.easyviewer/books`(책 2권: EPUB 1, TXT 1, EPUB 진행률 100%) |
| 절차 | 1) 식별자만 `com.ezenitac.easyviewer`로 바꾼 임시 빌드(작업 트리 밖 worktree, 커밋 안 함). 2) 새 식별자 위치가 없음을 확인. 3) 구 앱이 실행 중이 아님을 확인(`pgrep`). 4) `cp -Rp`로 `WebsiteData` 전체와 `books`를 새 식별자 위치로 복사(`Default/salt` 해시 동일 확인). 5) 새 앱 실행 후 창 캡처 |
| 결과 | 새 식별자 앱의 서재에 책 2권, 메타데이터, 읽기 진행률(100%, "3장…")이 그대로 보였다. 실행 후 구 저장소 파일 중 수정된 것 0개(원본 불변) |
| 판정 | **PASS**(복사 후 읽기). R1의 기본 경로(폴더 복사)를 유지한다 |
| 정리 | 스파이크가 만든 `~/Library/WebKit/com.ezenitac.easyviewer`, `~/Library/Application Support/com.ezenitac.easyviewer`, `~/Library/Caches/com.ezenitac.easyviewer`(앱 실행 시 생성)와 임시 빌드를 삭제했다 |

**추가로 확인한 사실**
- 새 앱을 처음 실행하면 `~/Library/Caches/<새 식별자>`가 생긴다. 캐시라 이전 대상이 아니며, "비어 있음" 판정과 무관한 위치다.

**이번에 확인하지 못한 것(남은 S1 항목)**
- 앱 **자신이**(Rust 코드로) 다른 식별자의 `~/Library/WebKit` 폴더를 읽을 때 macOS 개인정보 보호 권한 창이 뜨는지. 이번 복사는 셸에서 했다. T068 구현 후 T076에서 확인한다.
- 원저작자 앱 실행 중 복사(WAL 불일치), 1 GB 서재 복사 시간. 이 Mac에는 큰 서재와 원저작자 앱 설치본이 없다. T076에서 확인한다.
- 새 데이터 폴더에 시작 시점에 생기는 파일 목록("비어 있음" 무시 목록). T068 구현 후 실측한다.

## S1 (Linux) — T005

| 판정 | **BLOCKED** |
|---|---|
| 사유 | 이 작업 환경에 Linux 데스크톱이 없다 |
| 필요한 환경 | Ubuntu 22.04 이상 데스크톱(WebKitGTK 4.1). T076에서 함께 실측한다 |

## S2 — macOS 레거시 키체인 접근 창 (T006)

| 판정 | **BLOCKED** |
|---|---|
| 사유 | 이 Mac에는 `com.edith.easyviewer` 서비스의 키체인 항목이 없다(`security find-generic-password -s com.edith.easyviewer` 결과 없음). 또 접근 허용 창은 사용자가 직접 눌러야 하므로 자동으로 확인할 수 없다 |
| 필요한 환경 | WebDAV 연결 1개 이상을 비밀번호 저장으로 만든 구 식별자 빌드 + 사용자 입력. T076(quickstart §3 시나리오 2·8)에서 확인한다 |
| 설계 영향 | 없음. 계약은 이미 "항목마다 창이 뜰 수 있음"을 가정하고 [건너뛰기]를 둔다 |

## S4 — `android:init`이 Gradle 파일을 덮어쓰는가 (T007)

| 판정 | **BLOCKED** |
|---|---|
| 사유 | 이 Mac에 Android SDK·NDK가 없다(`ANDROID_HOME` 미설정, `~/Library/Android/sdk` 없음) |
| 필요한 환경 | Android SDK·NDK가 있는 환경 또는 CI `android-debug` 작업. T057에서 init 후 `git status`로 확인한다 |
| 설계 영향 | T057은 두 경우를 모두 다룬다(덮어쓰면 init 후 주입) |

## S5 — 서명 없는 iOS 시뮬레이터 빌드 (T008)

| 판정 | **BLOCKED** |
|---|---|
| 사유 | Xcode는 있으나 설치된 iOS 시뮬레이터 런타임이 없다(`xcrun simctl list runtimes`에 iOS 없음) |
| 필요한 환경 | iOS 시뮬레이터 런타임이 있는 macOS 또는 CI `ios-sim-build` 작업. T084에서 확인하고, 실패하면 원인을 먼저 고친다(FR-021) |

## 수렴 검증 — US5 이름 변경 후 빌드·회귀 실측 (T101, T102, T107)

### T101 — 이름을 바꾼 Apple 프로젝트로 iOS 시뮬레이터 빌드

| 필드 | 내용 |
|---|---|
| 날짜 | 2026-11-18 |
| 환경 | macOS (Darwin 27.2), Apple Silicon, Xcode 27.2(iPhoneSimulator SDK 27.2), tauri-cli 2.12.4, Rust 타깃 `aarch64-apple-ios-sim` |
| 실행 명령 | `rustup target add aarch64-apple-ios-sim` 후 `npx tauri ios build --target aarch64-sim --debug`(`APPLE_DEVELOPMENT_TEAM` 미지정) |
| 결과 | 종료 코드 0. `src-tauri/gen/apple/build/arm64-sim/Pagelight.app` 생성. 번들 `CFBundleIdentifier` = `com.ezenitac.easyviewer`, `CFBundleName` = `Pagelight`. Tauri CLI가 `pagelight.xcodeproj`·스킴 `pagelight_iOS`를 그대로 썼고 `xcodegen`·`ios:init` 재생성은 필요 없었다. 경고는 `main.mm`의 기존 `UIApplication.windows` 사용 중단 경고 1건뿐(이번 변경과 무관) |
| 부수 효과 | 빌드가 `pagelight_iOS/Info.plist`의 `CFBundleShortVersionString`·`CFBundleVersion`을 `0.1.6-beta` → `0.1.6`으로 덮어썼다(프리릴리스 접미사 제거, 이름 변경 전부터 있던 Tauri 동작). `check:version`을 깨므로 되돌렸다. T089 버전 상향 때 같은 동작을 고려한다 |
| 판정 | **PASS**(서명 없는 시뮬레이터 빌드). S5(T008)의 "서명 없는 iOS 시뮬레이터 빌드"도 이 결과로 확인된다. 기기 빌드·서명은 확인하지 않았다 |

### T102 — Android debug APK 빌드와 release 서명 강제

| 판정 | **BLOCKED** |
|---|---|
| 날짜 | 2026-11-18 |
| 사유 | 이 Mac에 Android SDK·NDK가 없다(`ANDROID_HOME`·`NDK_HOME`·`JAVA_HOME` 미설정, `~/Library/Android/sdk` 없음) |
| 필요한 환경 | Android SDK·NDK가 있는 환경 또는 CI `android-debug` 작업(T084). 확인 항목: `npm run android:build` 성공, 서명 환경 변수 없이 `npm run android:release` 시 `GradleException`, `android:init` 후 `git status`로 Gradle 덮어쓰기 여부(S4) |

### T107 — e2e 회귀

| 필드 | 내용 |
|---|---|
| 날짜 | 2026-11-18 |
| 실행 명령 | `npm run test:e2e`(Playwright, WebKit) |
| 결과 | 16건 모두 통과. 샘플 도서 제목 변경(`reader-epub.spec.ts`)과 정보 대화상자 시나리오(T030) 포함 |
| 판정 | **PASS** |
