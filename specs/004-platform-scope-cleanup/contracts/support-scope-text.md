# Contract: 지원 범위 원문(한·영)과 블록

## 1. 한국어 원문 (`renderSupportScopeKo()`, 기본 `windowsWording: 'recommend'`)

```text
이 포크는 **macOS**를 중점 지원합니다.
iOS는 우선순위를 낮춘 유지 플랫폼이며, 공개 배포 채널 없이 소스 빌드로만 제공합니다.
Linux·Android는 **테스트용 빌드**로만 배포합니다. 품질·기능 동등성·실기기 검증·대응 일정을 보장하지 않습니다.
**Windows는 이 포크의 범위가 아닙니다. Windows에서는 원저작자의 [EasyViewer](https://github.com/edith2580/EasyViewer)를 사용하세요.**
웹 브라우저 실행은 개발 보조용입니다.
Linux 테스트용 빌드는 Ubuntu 22.04 이상 또는 동급 배포판(deb·AppImage, WebKitGTK 4.1, X11·Wayland)에서 빌드합니다. Android 테스트용 빌드는 Android 7.0(API 24) 이상이 대상입니다.
```

`windowsWording: 'unsupported-only'`이면 넷째 줄만 `**이 포크는 Windows를 지원하지 않습니다.**`로 바뀐다(줄 수 동일).

## 2. 영문 원문 (`renderSupportScopeEn()`)

```text
This fork focuses on **macOS**.
iOS is maintained with lower priority and is provided as a source build only, without a public distribution channel.
Linux and Android are distributed as **test builds** only, with no guarantee of quality, feature parity, real-device verification or response time.
**Windows is outside the scope of this fork. On Windows, use the original [EasyViewer](https://github.com/edith2580/EasyViewer).**
Running in a web browser is a development aid only.
Linux test builds are built for Ubuntu 22.04 or later and equivalent distributions (deb, AppImage, WebKitGTK 4.1, X11 and Wayland). Android test builds target Android 7.0 (API 24) or later.
```

`unsupported-only`이면 넷째 줄이 `**This fork does not support Windows.**`.

## 3. 영문 배너 (`supportScopeBannerEn()`)

```text
This is an independent fork. It focuses on macOS; iOS is a source build only, and Linux and Android are test builds. For Windows, please use the original EasyViewer by edith2580.
```

README 맨 위 12줄 안에 있어야 한다(기존 규칙).

## 4. 블록 규칙

| 문서 | 블록 |
|---|---|
| `README.md`, `NOTICE`, `CHANGELOG.md`, `CONTRIBUTING.md`, `.github/release-notes.md`, `docs/*.md`(보존 기록 제외) | `<!-- support-scope:start -->` … `<!-- support-scope:end -->` 한국어 |
| `README.en.md`, `NOTICE.en.md`, `CHANGELOG.en.md`, `CONTRIBUTING.en.md` | `<!-- support-scope-en:start -->` … `<!-- support-scope-en:end -->` 영문 |
| `docs/windows-migration.md`, `docs/windows-eol-notice.md` | 블록을 갱신하지 않는다(보존 기록). 검사 대상에서 제외하고 맨 위에 보존 기록 표시 |

- 블록 본문은 원문과 글자까지 같아야 한다(인용 접두사 `> `는 허용, 기존 규칙과 같음).
- `REQUIRED_BLOCK_FILES`(한국어)는 그대로, 영문 필수 목록 `README.en.md`, `NOTICE.en.md`, `CHANGELOG.en.md`, `CONTRIBUTING.en.md`를 추가한다.

## 5. 이슈 양식 규칙

| 양식 | 플랫폼 선택지 | 라벨 | 필수 안내 |
|---|---|---|---|
| `bug_report.yml` | `macOS`, `iOS` | `bug` | 포크 확인 항목(기존) |
| `bug_report_test_build.yml` | `Linux`, `Android` | `bug`, `test-build` | 맨 위 "테스트용 빌드, 대응 일정 보장 없음" 한·영 안내 + 필수 확인 항목 |
| `config.yml` | – | – | 원저작자 링크(Windows), 보안 신고 링크 |

Windows는 어떤 양식의 선택지에도 없다.
