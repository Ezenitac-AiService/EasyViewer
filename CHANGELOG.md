# 변경 이력 (CHANGELOG)

**언어 / Language**: **[한국어](CHANGELOG.md)** | [English](CHANGELOG.en.md)

이 문서는 [edith2580의 EasyViewer](https://github.com/edith2580/EasyViewer)에서 갈라진 독립 포크의 변경 이력입니다. 형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)를 따릅니다.

## [미출시] — 독립 포크 분리 (2026-11-17)

이 포크는 원작 `v0.1.6`(커밋 `44c4d37`, 태그 `upstream-base-v0.1.6`)에서 갈라져 2026-11-17에 독립 분리되었습니다. GitHub 포크 네트워크 분리는 2026-11-23에 끝났습니다. 원작의 이후 릴리스(`v0.2.0`, `v0.2.1`, `v0.2.2`)는 병합하지 않았습니다.

<!-- support-scope:start -->
이 포크는 **macOS**를 중점 지원합니다.
iOS·Linux·Android는 우선순위를 낮춘 유지 플랫폼입니다. iOS는 공개 배포 채널 없이 소스 빌드로만 제공합니다.
**Windows는 이 포크의 지원·배포 대상이 아닙니다. Windows에서는 원저작자의 [EasyViewer](https://github.com/edith2580/EasyViewer)를 사용하세요.**
웹 브라우저 실행은 개발 보조용입니다.
Linux는 Ubuntu 22.04 이상 또는 동급 배포판(deb·AppImage, WebKitGTK 4.1, X11·Wayland)에서 검증합니다. 그 밖의 배포판은 동작할 수 있으나 검증하지 않습니다.
<!-- support-scope:end -->

### 추가

- 원저작자 귀속과 GPLv3 §5(a) 변경 고지를 담은 `NOTICE`
- `GPL-3.0-only` 라이선스 선언(`package.json`, `Cargo.toml`, 설치 패키지 메타데이터)
- 직접·전이 의존성 전체의 라이선스 자동 감사(`scripts/check-licenses.mjs`, `cargo deny`)와 서드파티 고지 전문(`src/generated/third-party-notices.txt`)
- 앱 정보 화면: 버전, 라이선스, 저장소, 원저작자 출처, 지원 범위, 서드파티 고지
- 지원 범위 원문(`src/config/supportScope.ts`)과 공개 문구 검사(`scripts/check-support-scope.mjs`)
- 이슈 등록 양식(지원 플랫폼 선택지, Windows 사용자 안내, 한·영 병기, 포크 확인 항목)
- macOS·Linux 기존 사용자 데이터 1회 이전(서재·설정·OS 자격증명, 원본 보존), 모바일 이전 안내
- 지원 플랫폼만 빌드하는 CI(`ci.yml` 6개 작업)와 릴리스 파이프라인(`release.yml`, 빌드 전·게시 전 안전 게이트, `SHA256SUMS.txt`)
- 보안 정책(`SECURITY.md`)과 비공개 취약점 신고, README의 원저작자 앱과의 차이 절
- 저장소 루트 공개 문서의 영문판(`*.en.md`)과 국문·영문 쌍 검사(`scripts/check-doc-pairs.mjs`)

### 변경

- 지원 범위를 macOS 중점으로 전환했습니다. iOS·Linux·Android는 후순위 유지 플랫폼이고, Windows는 고려 대상이 아닙니다(CI의 Windows 컴파일·테스트도 중단).
- 앱 정체성을 원저작자 앱과 구분되도록 바꿨습니다. 원저작자 앱과 같은 기기에 함께 설치하기 위한 변경입니다.
  - 앱 식별자: `com.edith.easyviewer` → `com.ezenitac.easyviewer`(전 플랫폼)
  - 표시명: `Pagelight`, 패키지 이름: `pagelight`(Rust 라이브러리 `pagelight_lib`)
  - 앱 아이콘: 이 포크에서 새로 만든 원본(`src-tauri/icons/source/pagelight.svg`)으로 교체
  - Android 패키지 경로를 `com/ezenitac/easyviewer`로 옮기고, release 빌드는 포크 소유 고정 서명 키(환경 변수)로만 서명합니다([Android 서명 안내](docs/android-signing.md))
  - Apple 개발 팀 ID와 개인 기기 UDID를 저장소에서 지우고 환경 변수(`APPLE_DEVELOPMENT_TEAM`, `IOS_DEVICE_ID`)로 옮겼습니다([iOS 빌드 안내](docs/ios-build.md))
  - 구 식별자·원저작자 이름 잔존, 내부 저장 키 변경, 고정 팀 ID·UDID, 원저작자 아이콘 재사용을 막는 검사(`scripts/check-identity.mjs`)를 `npm run verify`에 추가했습니다
  - 내부 저장 키(`EasyViewerDB`, `easyviewer:` 등)는 기존 데이터를 이어 쓰기 위해 바꾸지 않았습니다

### 보안

- 의존성 `url`을 2.5.9로 올려 RUSTSEC-2026-0592(중첩 `blob:` URL 처리 시 스택 오버플로)를 해소했습니다.
- 의존성 `cookie`를 0.18.3으로 올려 RUSTSEC-2026-0594(fork한 프로세스에서 비공개 쿠키 nonce 반복)를 해소했습니다. 이 앱은 해당 기능을 쓰지 않지만 권고 대상 버전을 없앴습니다.
- EPUB 엔진이 쓰는 `@xmldom/xmldom`을 0.9.12로 고정해 XML 주입·DoS 권고를 해소했습니다.

### 지원 종료

- Windows 배포와 공식 지원을 중단했습니다. 이 포크의 Windows 프리릴리스를 쓰던 경우 [Windows 전환 안내](docs/windows-migration.md)를 참고하세요.

## 포크 프리릴리스

### [0.1.6-beta] — 2026-11-16 (포크 전용 프리릴리스)

- 002 심층 리팩토링: 문서 엔진·저장소·동기화 계층 재구성, 성능·접근성·보안 게이트 수렴. 앱 내부 데이터 형식을 버전 2로 올렸습니다(원작은 버전 1).
- 프리릴리스 번들 분기와 Android `buildSrc` 경로 정합화, 서드파티 라이선스 고지 갱신.
- 게시 산출물: macOS(universal `.dmg`), Linux(`.deb`, `.AppImage`), Android(`.apk`), Windows(`x64-setup.exe`, `x64_portable.zip`). **Windows 산출물은 2026-11-17부로 지원 종료**입니다.

### [0.1.6-alpha] — 2026-11-16 (포크 프리릴리스)

- 001 헌법 준수 리팩토링: 경로 검증, SSRF 방어, CSP, 자격증명 분리 보관(OS 키체인), 플랫폼 추상화 계층.
- 이 변경은 원작에 기여(PR #2)되어 병합되었습니다.
- 게시 산출물에 Windows `x64-setup.exe`가 포함되었습니다. **2026-11-17부로 지원 종료**입니다.

## 원작 이력 요약 (edith2580/EasyViewer, 분기 이전)

아래는 원작 저장소 태그 메시지를 요약한 것입니다. 자세한 내용은 [원작 릴리스](https://github.com/edith2580/EasyViewer/releases)를 참고하세요.

- **0.1.6** (2026-11-16): Windows 무설치 포터블(`portable.zip`) 패키지와 멀티 플랫폼 릴리스 설정. **이 포크의 분기 기준(`44c4d37`, 태그 `upstream-base-v0.1.6`)**.
- **0.1.5** (2026-11-15): `package-lock.json` 버전 정리, macOS `.dmg` 외 빌드 산출물 정리.
- **0.1.4** (2026-11-13): Windows·Android 릴리스 빌드 산출물 추가와 버전 동기화.
- **0.1.3** (2026-11-11): Windows·Android 릴리스 빌드 산출물 추가와 버전 동기화.
- **0.1.2** (2026-11-08): TXT 목차 이동과 현재 목차 스크롤 수정.
- **0.1.1** (2026-11-08): TXT 스크롤 시 화면이 튀는 문제 수정.
- **0.1.0** (2026-11-07): 최초 릴리스, macOS 패키지 추가.

분기 이후 원작은 0.2.0(2026-11-17, Windows 네트워크 폴더 수정), 0.2.1(2026-11-17, Android WebDAV 접속 수정), 0.2.2(2026-11-18, macOS 서명·공증 적용)를 릴리스했습니다. 이 포크는 세 릴리스를 병합하지 않았습니다.
