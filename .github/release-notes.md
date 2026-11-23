<!-- Release notes template used by .github/workflows/release.yml (spec 003 FR-020, FR-021, T083). -->

<!-- support-scope:start -->
이 포크는 **macOS**를 중점 지원합니다.
iOS·Linux·Android는 우선순위를 낮춘 유지 플랫폼입니다. iOS는 공개 배포 채널 없이 소스 빌드로만 제공합니다.
**Windows는 이 포크의 지원·배포 대상이 아닙니다. Windows에서는 원저작자의 [EasyViewer](https://github.com/edith2580/EasyViewer)를 사용하세요.**
웹 브라우저 실행은 개발 보조용입니다.
Linux는 Ubuntu 22.04 이상 또는 동급 배포판(deb·AppImage, WebKitGTK 4.1, X11·Wayland)에서 검증합니다. 그 밖의 배포판은 동작할 수 있으나 검증하지 않습니다.
<!-- support-scope:end -->

## 내려받은 파일 확인 (체크섬)

모든 산출물의 SHA-256 값은 `SHA256SUMS.txt`에 있습니다. 산출물과 `SHA256SUMS.txt`를 같은 폴더에 받은 뒤 확인하세요.

```bash
shasum -a 256 -c SHA256SUMS.txt --ignore-missing
```

Linux에서는 `sha256sum -c SHA256SUMS.txt --ignore-missing`을 써도 됩니다. 받은 파일 옆에 `OK`가 나와야 합니다.

## macOS 설치

1. `.dmg`를 열어 `Pagelight.app`을 `응용 프로그램` 폴더로 옮깁니다.
2. 이 앱은 아직 Apple 공증(Notarization)을 받지 않았습니다. 브라우저로 받은 경우 처음 실행할 때 "손상되었기 때문에 열 수 없습니다"가 나올 수 있습니다. 그때는 **위의 체크섬 확인을 먼저 한 뒤** 다음 명령으로 격리 속성을 해제합니다.

   ```bash
   xattr -cr /Applications/Pagelight.app
   ```

> **경고**: 격리 해제는 공증을 받기 전까지 쓰는 **임시 조치**입니다. macOS가 이 앱을 검사하지 않고 실행하게 되므로, 반드시 이 저장소의 릴리스 페이지에서 받은 파일이고 체크섬이 일치할 때만 실행하세요.

## iOS

iOS는 공개 배포 채널 없이 **소스 빌드로만 제공**합니다. 직접 빌드해 설치하는 방법은 [iOS 소스 빌드 안내](https://github.com/Ezenitac-AiService/EasyViewer/blob/main/docs/ios-build.md)를 따르세요.

## 첫 독립 릴리스: 이름·식별자 변경과 데이터 이전

이 릴리스부터 앱 이름이 **Pagelight**로, 앱 식별자가 `com.ezenitac.easyviewer`로 바뀌었습니다.

- **macOS·Linux**: Pagelight를 처음 실행하면 이전 버전의 서재와 설정을 한 번 복사합니다. 원본은 그대로 남습니다. 결과는 앱 안 안내로 알려 드립니다.
- **Android·iOS**: 새 앱으로 따로 설치되며 데이터를 자동으로 옮기지 않습니다. [모바일 이전 안내](https://github.com/Ezenitac-AiService/EasyViewer/blob/main/docs/mobile-migration.md)를 참고하세요.
- **Android 서명**: 이 포크가 소유한 새 서명 키로 서명합니다. 이전 APK 위에 업데이트로 설치되지 않습니다. 서명 키가 준비되지 않은 릴리스에는 APK를 넣지 않습니다(debug 서명 APK는 배포하지 않음).
- **Windows**: 이 포크의 Windows 프리릴리스를 쓰던 경우 [Windows 전환 안내](https://github.com/Ezenitac-AiService/EasyViewer/blob/main/docs/windows-migration.md)를 따르세요.

## 출처와 라이선스

Pagelight는 [edith2580의 EasyViewer](https://github.com/edith2580/EasyViewer) `v0.1.6`에서 갈라진 독립 포크이며 `GPL-3.0-only`로 배포합니다. 변경 고지는 [NOTICE](https://github.com/Ezenitac-AiService/EasyViewer/blob/main/NOTICE)를, 변경 이력은 [CHANGELOG](https://github.com/Ezenitac-AiService/EasyViewer/blob/main/CHANGELOG.md)를 참고하세요.
