# iOS 소스 빌드 안내

<!-- support-scope:start -->
이 포크는 **macOS · iOS · Linux**를 중점 지원합니다. iOS는 공개 배포 채널 없이 소스 빌드로만 제공합니다.
Android는 우선순위를 낮춘 유지 플랫폼으로 계속 배포합니다.
**Windows는 이 포크의 지원·배포 대상이 아닙니다. Windows에서는 원저작자의 [EasyViewer](https://github.com/edith2580/EasyViewer)를 사용하세요.**
웹 브라우저 실행은 개발 보조용입니다.
Linux는 Ubuntu 22.04 이상 또는 동급 배포판(deb·AppImage, WebKitGTK 4.1, X11·Wayland)에서 검증합니다. 그 밖의 배포판은 동작할 수 있으나 검증하지 않습니다.
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

## 데이터

새 식별자(`com.ezenitac.easyviewer`)로 빌드한 앱은 이전 앱과 별개의 앱으로 설치되며, 자동 데이터 이전은 없습니다. 자세한 내용은 [모바일 이전 안내](mobile-migration.md)를 참고하세요.
