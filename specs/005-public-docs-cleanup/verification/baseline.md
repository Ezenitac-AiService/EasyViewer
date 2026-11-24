# 기준선 (T001)

| 필드 | 내용 |
|---|---|
| 날짜 | 2026-11-24 |
| 커밋 | `86b421d`(main, 005 스펙 병합) 기준 브랜치 `005-public-docs-impl` |
| `npm run verify` | 통과. vitest 393건, `cargo test` 53건 |

## 공개 문서 줄 수

```text
     295 README.md
     300 README.en.md
     102 CONTRIBUTING.md
     102 CONTRIBUTING.en.md
      48 SECURITY.md
      50 SECURITY.en.md
      96 CHANGELOG.md
      96 CHANGELOG.en.md
      85 NOTICE
      60 NOTICE.en.md
      82 THIRD_PARTY_LICENSES.md
      84 THIRD_PARTY_LICENSES.en.md
    1400 total
```

## README 제목 목록 (코드 블록 제외)

| 국문 `README.md` | 영문 `README.en.md` |
|---|---|
| # Pagelight | # Pagelight |
| ## 지원 기능 | ## Supported platforms |
| ### 뷰어 옵션 및 테마 | ## Features |
| ### 서재 · 동기화 · 보안 | ### Viewer options and themes |
| ## 개발 정보 및 아키텍처 | ### Library, sync and security |
| ### 최소 요구 사양 | ## Development and architecture |
| ### 디렉토리 구조 | ### Minimum requirements |
| ## 실행 및 품질 검증 (테스트 · 거버넌스 게이트) | ### Directory layout |
| ### 개발 실행 | ## Running and quality gates |
| ### 테스트 및 통합 검증 스크립트 | ### Development |
| ## 버전 관리 및 크로스 플랫폼 빌드 | ### Tests and verification scripts |
| ### 버전 동기화 대상 파일 | ## Versioning and cross-platform builds |
| ### Rust 툴체인 사전 요구사항 | ### Files kept at the same version |
| ### macOS 설치 (릴리스 산출물) | ### Rust toolchain |
| ### Windows 사용자 안내 | ### Installing on macOS (release files) |
| ### Linux 빌드 | ### Windows users |
| ### macOS · iOS 빌드 | ### Linux build |
| ### Android 빌드 | ### macOS and iOS builds |
| ### GitHub Actions CI·릴리스 | ### Android build |
| ## 원저작자 앱과의 차이 | ### GitHub Actions CI and releases |
| ## 출처와 라이선스 (Attribution & License) | ## Differences from the original app |
|  | ## Attribution and license |

국문 21개, 영문 22개 제목(`#`–`###`, `####` 제외). 영문에만 `## Supported platforms`가 따로 있고 국문은 지원 범위 원문이 헤더 인용 안에 있어 순서가 한 칸씩 어긋난다.
