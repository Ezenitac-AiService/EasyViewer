# Contract: README 구조 (국문·영문)

## 1. 헤더

```text
# Pagelight

**언어 / Language**: **[한국어](README.md)** | [English](README.en.md)

[CI 배지]
[Release build 배지]
[GitHub Release 배지]
[License 배지]
[Platform 배지 → #지원-플랫폼과-릴리스]
[Forked from 배지]

> This is an independent fork. …(supportScopeBannerEn())

[소개 문단]

> [!IMPORTANT]
> [처음 실행 안내 → #설치와-처음-실행]

> [!NOTE]
> [독립 포크·이슈 등록 안내]
```

영문 README는 같은 순서이며 언어 전환 줄의 굵은 표시와 앵커(`#supported-platforms-and-releases`, `#installation-and-first-launch`)만 다르다. 영문 README도 배너를 같은 위치에 둔다.

## 2. 본문 절

| # | 국문 | 영문 |
|---|---|---|
| 1 | `## 원저작자 앱과의 차이` | `## Differences from the original app` |
| 2 | `## 지원 플랫폼과 릴리스` (`### 최소 요구 사양`) | `## Supported platforms and releases` (`### Minimum requirements`) |
| 3 | `## 기능` (기존 하위 절) | `## Features` |
| 4 | `## 조작 방법` | `## Controls` |
| 5 | `## 설치와 처음 실행` (`### macOS`, `### Linux·Android 테스트용 빌드`, `### iOS`, `### Windows 사용자 안내`) | `## Installation and first launch` (`### macOS`, `### Linux and Android test builds`, `### iOS`, `### Windows users`) |
| 6 | `## 소스 빌드` | `## Building from source` |
| 7 | `## 개발·기여와 보안` | `## Development, contributing and security` |
| 8 | `## 라이선스와 저작권 고지` | `## License and copyright notices` |

- 2번 절 맨 위: 지원 범위 원문 블록(국문 `support-scope`, 영문 `support-scope-en`). 그 아래 등급 표:

  | 열 | 내용 |
  |---|---|
  | 플랫폼 | macOS, iOS, Linux, Android, Windows |
  | 등급 | 중점, 유지, 테스트 빌드, 테스트 빌드, 제외 |
  | 최소 버전 | 11.0, 15.0, Ubuntu 22.04(WebKitGTK 4.1), 7.0(API 24), – |
  | 릴리스 파일 | `universal.dmg`, 없음(소스 빌드), `amd64-test.deb`·`amd64-test.AppImage`, `android-arm64-test.apk`(서명 키 준비 후), 없음 |
  | 상태 | 핵심 빌드 / 소스 빌드만 / 테스트용 빌드(보장 없음) / 테스트용 빌드(보장 없음) / 범위 밖 |

  등급·최소 버전은 `src/config/supportScope.ts`와 "최소 요구 사양" 표와 같아야 한다.
- 6번 절: 필요 도구 요약(Node·Rust 버전 한 줄)과 `npm ci`, `npm run dev`, `npm run tauri dev`, `npm run mac:build` 정도. 나머지는 기여 가이드 링크.
- 7번 절: 기여 가이드(개발 환경, 검증 명령, 버전과 빌드, CI와 릴리스), 보안 정책, 운영 절차로 가는 링크와 각 한 줄 설명.
- `## 원저작자 앱과의 차이`와 `### Windows 사용자 안내`/`### Windows users`의 내용 규칙은 기존 테스트(`tests/unit/forkDocs.spec.ts`)를 따른다.

## 3. 기여 가이드에 새로 생기는 절 (국문·영문)

`## 개발 환경과 구조`(기술 스택, 디렉터리 구조), `## 검증 명령`(기존 "품질 게이트"와 합침), `## 버전과 빌드`(버전 동기화 파일, Rust 툴체인, 플랫폼별 빌드), `## CI와 릴리스`(워크플로 구조, 릴리스 절차). README에서 옮긴 내용은 이 절들에 들어간다.
