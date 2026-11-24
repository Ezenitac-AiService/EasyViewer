# iOS 소스 빌드 안내

<!-- support-scope:start -->
이 포크는 **macOS**를 중점 지원합니다.
iOS는 우선순위를 낮춘 유지 플랫폼이며, 공개 배포 채널 없이 소스 빌드로만 제공합니다.
Linux·Android는 **테스트용 빌드**로만 배포합니다. 품질·기능 동등성·실기기 검증·대응 일정을 보장하지 않습니다.
**Windows는 이 포크의 범위가 아닙니다. Windows에서는 원저작자의 [EasyViewer](https://github.com/edith2580/EasyViewer)를 사용하세요.**
웹 브라우저 실행은 개발 보조용입니다.
Linux 테스트용 빌드는 Ubuntu 22.04 이상 또는 동급 배포판(deb·AppImage, WebKitGTK 4.1, X11·Wayland)에서 빌드합니다. Android 테스트용 빌드는 Android 7.0(API 24) 이상이 대상입니다.
<!-- support-scope:end -->

이 포크는 TestFlight나 App Store로 iOS 앱을 배포하지 않습니다. iOS에서 쓰려면 소스에서 직접 빌드해 자신의 기기에 설치해야 합니다.

## 준비물

- macOS와 Xcode(iOS 15 이상 SDK 포함)
- Apple Developer 팀 ID(무료 개인 팀도 개발용 설치는 가능)
- Node 24, Rust stable과 iOS 타깃: `rustup target add aarch64-apple-ios aarch64-apple-ios-sim`

## 팀 정보 지정

이 저장소에는 개발 팀 ID를 고정값으로 넣지 않습니다. 빌드할 때 환경 변수 `APPLE_DEVELOPMENT_TEAM`으로 지정합니다. Tauri CLI는 이 환경 변수를 먼저 읽고, 없으면 설정 파일의 `bundle.iOS.developmentTeam`을 씁니다([tauri-cli 소스](https://docs.rs/crate/tauri-cli/2.11.1/source/src/mobile/ios/mod.rs), [Tauri iOS 코드 서명 문서](https://v2.tauri.app/distribute/sign/ios/)).

```bash
export APPLE_DEVELOPMENT_TEAM=<자신의 팀 ID>
```

## 빌드

```bash
npm ci
```

```bash
npm run ios:init
```

```bash
npm run ios:build
```

## 기기에 설치

기기 식별자도 저장소에 넣지 않습니다. `xcrun devicectl list devices`로 확인한 식별자를 환경 변수 `IOS_DEVICE_ID`로 지정한 뒤 설치합니다.

```bash
IOS_DEVICE_ID=<기기 식별자> npm run ios:install
```

### 이미 지운 값과 git 이력의 한계

이전 버전의 저장소에는 Apple 개발 팀 ID(`tauri.conf.json`, `project.yml`)와 메인테이너 개인 기기 UDID(`package.json`의 `ios:install` 스크립트)가 고정값으로 들어 있었습니다. 현재 파일에서는 모두 지웠지만, **과거 커밋에는 그대로 남아 있습니다.** 이력 재작성(강제 푸시 등)은 헌법 제8원칙에 따라 금지되므로 git 이력에서는 지울 수 없습니다. 이 값들은 비밀값이 아니지만, 새로 기여할 때 개인 식별자를 커밋하지 않도록 주의하세요. `npm run check:identity`가 `package.json` 스크립트의 UDID 패턴과 저장소에 고정된 팀 ID를 막습니다.

## 데이터

새 식별자(`com.ezenitac.easyviewer`)로 빌드한 앱은 이전 앱과 별개의 앱으로 설치되며, 자동 데이터 이전은 없습니다. 자세한 내용은 [모바일 이전 안내](mobile-migration.md)를 참고하세요.
