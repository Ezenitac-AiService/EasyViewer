# Pagelight

**언어 / Language**: **[한국어](README.md)** | [English](README.en.md)

[![CI](https://github.com/Ezenitac-AiService/EasyViewer/actions/workflows/ci.yml/badge.svg)](https://github.com/Ezenitac-AiService/EasyViewer/actions/workflows/ci.yml)
[![Release build](https://github.com/Ezenitac-AiService/EasyViewer/actions/workflows/release.yml/badge.svg)](https://github.com/Ezenitac-AiService/EasyViewer/actions/workflows/release.yml)
[![GitHub Release](https://img.shields.io/github/v/release/Ezenitac-AiService/EasyViewer?include_prereleases&sort=semver&label=release&logo=github)](https://github.com/Ezenitac-AiService/EasyViewer/releases)
[![License: GPL-3.0-only](https://img.shields.io/badge/license-GPL--3.0--only-blue.svg)](./LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS%20(focus)%20%7C%20iOS%20(source%20build)%20%7C%20Linux%20%C2%B7%20Android%20(test%20build)-lightgrey.svg)](#지원-플랫폼과-릴리스)
[![Forked from](https://img.shields.io/badge/forked%20from-edith2580%2FEasyViewer%20(v0.1.6)-informational?logo=github)](https://github.com/edith2580/EasyViewer)

> This is an independent fork. It focuses on macOS; iOS is a source build only, and Linux and Android are test builds. For Windows, please use the original EasyViewer by edith2580.

Pagelight는 텍스트(TXT)와 EPUB 문서를 읽는 간단한 뷰어입니다(`v1.0.0-alpha.2`). 원저작자의 [EasyViewer](https://github.com/edith2580/EasyViewer) `v0.1.6`에서 갈라진 독립 포크이며, 실행 파일과 체크섬은 [Releases](https://github.com/Ezenitac-AiService/EasyViewer/releases)에서 받을 수 있습니다.

> [!IMPORTANT]
> **처음 실행 안내**: 아직 Apple 공증을 받지 않아 macOS에서 처음 실행할 때 "손상되었기 때문에 열 수 없습니다"가 나올 수 있습니다. 체크섬을 확인한 뒤 [설치와 처음 실행](#설치와-처음-실행)의 macOS 절차를 따르세요.

> [!NOTE]
> **독립 포크 안내와 이슈 등록 예절**
>
> - 이 저장소([Ezenitac-AiService/EasyViewer](https://github.com/Ezenitac-AiService/EasyViewer))는 원저작자의 [EasyViewer](https://github.com/edith2580/EasyViewer) `v0.1.6`에서 갈라져 Pagelight라는 이름으로 독립 운영되는 프로젝트입니다. 원저작자의 저작권과 `GPL-3.0-only` 라이선스를 그대로 따릅니다.
> - **Pagelight에서 생긴 문제와 요청은 이 저장소의 [Issues](https://github.com/Ezenitac-AiService/EasyViewer/issues)에 올려 주세요.** 원저작자 저장소에는 올리지 마세요.
> - 보안 취약점은 공개 이슈 대신 [SECURITY.md](./SECURITY.md)의 비공개 신고 경로를 이용해 주세요.

---

## 원저작자 앱과의 차이

<!-- upstream-diff:start -->
이 포크(Pagelight)와 원저작자 앱([EasyViewer](https://github.com/edith2580/EasyViewer))의 차이 중 확인할 수 있는 사실만 적습니다. 원저작자 쪽 값은 이 포크가 갈라진 `v0.1.6`과 2026-11-24에 확인한 최신 릴리스 `v0.2.4` 기준입니다.

| 항목 | Pagelight (이 포크) | EasyViewer (원저작자) |
|---|---|---|
| 표시 이름 | Pagelight | EasyViewer |
| 앱 식별자 | `com.ezenitac.easyviewer` | `com.edith.easyviewer` |
| 배포 플랫폼 | macOS, Linux·Android(테스트용 빌드), iOS는 소스 빌드만 | `v0.2.4` 기준 Windows, macOS, Linux, Android |
| Windows | 배포·지원하지 않음 | 원저작자가 배포 |
| 앱 내부 데이터 형식 버전 | 2 | 1 |

- 식별자가 달라서 두 앱을 한 기기에 함께 설치할 수 있고, 서로의 데이터를 공유하지 않습니다.
- 원저작자 앱은 이 포크가 만든 데이터(데이터 형식 2)를 열 수 없습니다. Windows로 옮기는 방법은 [Windows 전환 안내](./docs/windows-migration.md)를 참고하세요.
- 원저작자 앱의 이후 버전에서 위 값이 바뀔 수 있습니다.
<!-- upstream-diff:end -->

## 지원 플랫폼과 릴리스

<!-- support-scope:start -->
이 포크는 **macOS**를 중점 지원합니다.
iOS는 우선순위를 낮춘 유지 플랫폼이며, 공개 배포 채널 없이 소스 빌드로만 제공합니다.
Linux·Android는 **테스트용 빌드**로만 배포합니다. 품질·기능 동등성·실기기 검증·대응 일정을 보장하지 않습니다.
**Windows는 이 포크의 범위가 아닙니다. Windows에서는 원저작자의 [EasyViewer](https://github.com/edith2580/EasyViewer)를 사용하세요.**
웹 브라우저 실행은 개발 보조용입니다.
Linux 테스트용 빌드는 Ubuntu 22.04 이상 또는 동급 배포판(deb·AppImage, WebKitGTK 4.1, X11·Wayland)에서 빌드합니다. Android 테스트용 빌드는 Android 7.0(API 24) 이상이 대상입니다.
<!-- support-scope:end -->

| 플랫폼 | 등급 | 최소 버전 | 릴리스 파일 | 상태 |
|---|---|---|---|---|
| **macOS** | 중점 | 11.0 Big Sur | `Pagelight_<버전>_universal.dmg`(Apple Silicon·Intel) | 핵심 빌드 |
| **iOS** | 유지 | 15.0 | 없음 | 소스 빌드만([iOS 소스 빌드 안내](./docs/ios-build.md)) |
| **Linux** | 테스트 빌드 | Ubuntu 22.04 이상(WebKitGTK 4.1) | `Pagelight_<버전>_amd64-test.deb`, `Pagelight_<버전>_amd64-test.AppImage`(정식 버전은 `.rpm` 추가) | 테스트용 빌드, 보장 없음 |
| **Android** | 테스트 빌드 | 7.0 (API 24) | `Pagelight_<버전>_android-arm64-test.apk` | 테스트용 빌드, 포크 서명 키가 준비된 릴리스부터 |
| **Windows** | 제외 | – | 없음 | 이 포크의 범위 밖 |

실행 파일과 체크섬 목록(`SHA256SUMS.txt`)은 [Releases](https://github.com/Ezenitac-AiService/EasyViewer/releases)에 있습니다. 파일 이름 끝에 `-test`가 붙은 Linux·Android 파일은 테스트용 빌드이며, 품질·대응 일정을 보장하지 않습니다. 받은 파일은 체크섬으로 확인하세요.

```bash
shasum -a 256 -c SHA256SUMS.txt --ignore-missing   # macOS
sha256sum -c SHA256SUMS.txt --ignore-missing        # Linux
```

### 최소 요구 사양

앱은 각 OS의 내장 WebView에서 실행되므로, 최소 버전은 프레임워크(Tauri 2)·빌드 도구(Vite 6)가 요구하는 값과 앱이 쓰는 WebView 기능으로 정했습니다.

| 플랫폼 | 최소 버전 | 근거 |
|---|---|---|
| macOS | 11.0 Big Sur | Tauri 2 기본값은 10.13이지만, Vite 6 빌드 결과물이 Safari 14 문법을 쓰고 접근성 대화상자의 `inert`가 Safari 15.5 이상에서 동작합니다. Big Sur는 Safari 16.6까지 받을 수 있습니다 |
| iOS | 15.0 | Tauri 2 기본값. iOS의 WebView는 OS 버전을 따르며 Vite 6 결과물(Safari 14 문법)을 실행할 수 있습니다 |
| Android (테스트 빌드) | 7.0 (API 24) | Tauri 2 기본값. 업데이트 가능한 Android System WebView(Chrome 87 이상)가 필요합니다 |
| Linux (테스트 빌드) | Ubuntu 22.04 이상(WebKitGTK 4.1) | 테스트용 빌드의 빌드 환경 기준(검증 보장 아님). 22.04도 보안 업데이트로 WebKitGTK 2.50대를 받습니다 |

EPUB 열기 취소 처리에 쓰던 `AbortSignal.any`(Safari·iOS 17.4 이상 필요)는 같은 동작의 대체 구현으로 바꿔, 위 최소 버전에서도 EPUB을 열 수 있게 했습니다.

## 기능

### 뷰어 옵션 및 테마

- **보기 모드**: 세로 스크롤(`scroll`) / 가로 페이지 넘김(`paginated`) 실시간 전환 및 읽던 위치 보존
- **타이포그래피**: 글꼴(시스템·로컬 폰트 스택, 외부 CDN 미사용), 글자 크기, 줄 간격, 여백 조절
- **컬러 테마**: 기본(라이트) / 다크 모드 / 세피아 모드

### 서재 · 동기화 · 보안

- **EPUB / TXT 열람 및 통합 검색**: 목차(TOC)·챕터 이동(EPUB), 인코딩 자동 감지 및 대용량 청크 로딩(TXT), 책갈피 및 진행률 저장
- **네트워크 다운로드 & WebDAV 동기화**: 원격 파일 다운로드, 로컬 동기화 허브 및 원격 WebDAV/엔드포인트 동기화
  - WebDAV `v1 → v2` 마이그레이션으로 평문 비밀번호를 제거하고, 네이티브(데스크톱/모바일)에서는 OS 키체인(`tauri-plugin-keyring-store`), 웹에서는 세션 메모리 기본 격리(명시 동의 시 로컬 저장)를 사용합니다.
- **Zero-Trust 보안 경계**:
  - **CSP & EPUB 격리**: 앱 수준 `Content-Security-Policy` 활성화, EPUB Zip Bomb 사전 상한 검사(`validateEpubArchiveBounds`) 및 다층 HTML/SVG/CSS 정화(`sanitizeSectionDocument`)
  - **SSRF / DNS Pinning / TLS 검증**: 개발·프리뷰 프록시(`/__remote_proxy`)의 Fail-Closed `Origin`/`Sec-Fetch-Site`·세션 논스·총합 타임아웃 및 네이티브 Rust `safe_remote_fetch`(`reqwest 0.13` `rustls` + `url::Host` IPv4/IPv6 분류 + 전체 수명 데드라인) 단일 신뢰 경계 적용
  - **최소 권한 Capability & 경로 화이트리스트**: 데스크톱 전용 `desktop.json` 분리, `tauri-plugin-opener` 스코프 제한, `allow_storage_dir` 조상 정규화 및 `read_validated_book_file`(`#[cfg(desktop)]`, 대소문자 비구분 OS 민감 경로 차단)

## 조작 방법

읽기 화면의 조작입니다. `Cmd`는 macOS, `Ctrl`은 그 밖의 플랫폼에서 씁니다.

| 동작 | 입력 |
|---|---|
| 다음 / 이전 쪽 (쪽 넘김 모드) | `→` / `←`, `PageDown` / `PageUp`, `Space`(다음) |
| 다음 / 이전 화면 (스크롤 모드) | `↓` / `↑`, `PageDown` / `PageUp`, `Space`(다음) |
| 검색 | `Ctrl`/`Cmd`+`F` |
| 현재 위치 책갈피 추가·삭제 | `Ctrl`/`Cmd`+`B` |
| 목차·검색 서랍, 설정 닫기 | `Esc` |
| 화면 클릭·탭 (쪽 넘김 모드) | 아래쪽 1/3 또는 가운데 오른쪽: 다음 쪽, 가운데 왼쪽: 이전 쪽, 그 밖: 메뉴 보이기·숨기기 |
| 화면 클릭·탭 (스크롤 모드) | 메뉴 보이기·숨기기 |
| 대화상자 | `Esc` 닫기, `Tab` 초점 이동 |

## 설치와 처음 실행

### macOS

릴리스 페이지에서 `.dmg`와 `SHA256SUMS.txt`를 같은 폴더에 받아 먼저 체크섬을 확인합니다.

```bash
shasum -a 256 -c SHA256SUMS.txt --ignore-missing
```

앱은 아직 Apple 공증을 받지 않았습니다. 처음 실행할 때 "손상되었기 때문에 열 수 없습니다"가 나오면, 체크섬이 일치하는 것을 확인한 뒤 격리 속성을 해제합니다.

```bash
xattr -cr /Applications/Pagelight.app
```

> **경고**: 격리 해제는 공증을 받기 전까지 쓰는 **임시 조치**입니다. macOS가 이 앱을 검사하지 않고 실행하게 되므로, 이 저장소의 릴리스 페이지에서 받았고 체크섬이 일치하는 파일에만 쓰세요.

### Linux·Android 테스트용 빌드

Linux(`.deb`, `.AppImage`)와 Android(`.apk`) 파일은 테스트용 빌드입니다. 품질·기능 동등성·실기기 검증·대응 일정을 보장하지 않습니다. 문제는 [테스트 빌드 버그 양식](https://github.com/Ezenitac-AiService/EasyViewer/issues/new?template=bug_report_test_build.yml)으로 알려 주세요. Android APK는 이 포크가 소유한 서명 키로만 서명하며, 키가 준비되지 않은 릴리스에는 넣지 않습니다.

### iOS

iOS는 공개 배포 채널 없이 소스 빌드로만 제공합니다. [iOS 소스 빌드 안내](./docs/ios-build.md)를 따르세요.

### Windows 사용자 안내

Windows는 이 포크의 범위가 아니므로 원저작자의 [EasyViewer](https://github.com/edith2580/EasyViewer)를 사용하세요. 이 포크의 Windows 프리릴리스(`v0.1.6-alpha`·`v0.1.6-beta`)를 쓰던 경우에는 보존 기록인 [Windows 전환 안내](./docs/windows-migration.md)를 따르세요.

## 소스 빌드

Node.js, npm, Rust 툴체인(`rustc >= 1.90.0`)이 필요합니다. 플랫폼별로 Xcode(macOS·iOS), Android SDK·NDK(Android), WebKitGTK 개발 패키지(Linux)가 추가로 필요합니다.

```bash
# 의존성 설치
npm install

# 웹 개발 서버 실행 (http://localhost:1420)
npm run dev

# Tauri 데스크톱 앱 실행 (Rust 툴체인 설치 환경)
npm run tauri dev

# macOS 유니버설(Apple Silicon + Intel) 빌드
npm run mac:build
```

Linux·iOS·Android 빌드 명령과 버전 동기화는 기여 가이드의 [버전과 빌드](./CONTRIBUTING.md#버전과-빌드)를 보세요.

## 개발·기여와 보안

- [기여 가이드](./CONTRIBUTING.md): 독립 포크 운영 원칙, [개발 환경과 구조](./CONTRIBUTING.md#개발-환경과-구조)(기술 스택, 디렉터리 구조), [검증 명령](./CONTRIBUTING.md#검증-명령)(`npm run verify` 등), [버전과 빌드](./CONTRIBUTING.md#버전과-빌드), [CI와 릴리스](./CONTRIBUTING.md#ci와-릴리스) 절차.
- [보안 정책](./SECURITY.md): 취약점 비공개 신고 경로와 테스트용 빌드의 보안 범위.
- 버그 신고: [Issues](https://github.com/Ezenitac-AiService/EasyViewer/issues)의 버그 양식(macOS·iOS)과 테스트 빌드 버그 양식(Linux·Android).
- 운영 문서: [메인테이너 운영 절차](./docs/maintainer-runbook.md), [Android 서명 키 관리](./docs/android-signing.md).

## 라이선스와 저작권 고지

- **원저작물**: 이 저장소는 [edith2580의 EasyViewer](https://github.com/edith2580/EasyViewer)를 바탕으로 한 파생 저작물입니다. Copyright (C) 2026 edith2580.
- **이 포크의 변경분**: Copyright (C) 2026 M5. 이 포크는 원저작자 앱 `v0.1.6`(커밋 `44c4d37`, 태그 `upstream-base-v0.1.6`)에서 갈라져 2026-11-17에 독립 분리되었고, GitHub 포크 네트워크 분리는 2026-11-23에 끝났습니다. 원저작자 앱의 이후 릴리스(`v0.2.0`–`v0.2.4`)는 병합하지 않았습니다. 주요 변경 요약은 [NOTICE](./NOTICE) 3절과 [CHANGELOG](./CHANGELOG.md)에 있습니다.
- **라이선스**: [GNU General Public License v3.0 only (`GPL-3.0-only`)](./LICENSE). 라이선스 전문은 바꾸지 않았습니다. "only"는 이 포크의 선택이며, 그 근거와 재검토 조건은 [NOTICE](./NOTICE) 5절에 있습니다.
- **서드파티 구성요소**: 직접 의존성 요약은 [`THIRD_PARTY_LICENSES.md`](./THIRD_PARTY_LICENSES.md), 전이 의존성을 포함한 전체 고지와 라이선스 전문은 [`src/generated/third-party-notices.txt`](./src/generated/third-party-notices.txt)(앱 정보 화면에서도 열람 가능)에 있습니다.
