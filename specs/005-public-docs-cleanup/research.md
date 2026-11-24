# Research: 국문·영문 공개 문서 정리

조사일: 2026-11-24. 외부 근거는 공식 문서, 내부 근거는 직접 확인한 파일·심볼·실행 결과다(헌법 제4원칙).

## R1. README 헤더 순서와 첫 화면 규칙

- **Decision**: 국문·영문 README 헤더를 다음 순서로 둔다.
  1. 제목 `# Pagelight`
  2. 언어 전환 줄
  3. 배지 6개(R2), 한 줄에 하나
  4. 영문 한 줄 배너(인용, `supportScopeBannerEn()`)
  5. 한 문단 소개(앱 종류, 현재 버전, 원저작자 앱에서 갈라진 독립 포크, 최신 릴리스 링크)
  6. `> [!IMPORTANT]` 처음 실행 안내(공증 전 macOS 확인, "설치와 처음 실행" 절 링크)
  7. `> [!NOTE]` 독립 포크·이슈 등록 안내(이 저장소에 신고, 원저작자 저장소에 올리지 않기, 보안 신고 경로)

  지원 범위 원문 블록은 헤더에서 빼고 "지원 플랫폼과 릴리스" 절 맨 위로 옮긴다(명확화 2). 라이선스 한 줄 안내는 라이선스 절로 옮긴다.
- **배너 위치 검사**: 지금 `scripts/check-support-scope.mjs`의 `checkBanner`는 README 처음 12줄 안을 본다. 새 순서에서 배너는 12번째 줄(제목 1, 빈 줄, 언어 전환 3, 빈 줄, 배지 5–10, 빈 줄, 배너 12)이라 경계에 걸린다. 배지를 하나만 늘려도 실패하므로, "첫 화면" 판정을 언어 전환 검사(`scripts/check-doc-pairs.mjs`의 `TOP_LINES = 15`)와 같은 15줄로 맞추고, 동시에 "첫 `## ` 절 제목보다 앞"이라는 조건을 더한다. 첫 화면 안이라는 규칙의 의미는 그대로이고 기준 숫자만 두 검사가 같아진다.
- **Rationale**: 독자는 배지(상태)를 보고 앱 설명을 읽은 뒤 처음 실행 경고와 포크 안내를 본다. 처음 실행 경고는 다운로드 직후 막히는 지점이라 포크 안내보다 앞에 둔다. GitHub의 경고 문법(`> [!NOTE]`, `> [!IMPORTANT]`)은 공식 지원 기능이다([GitHub Docs — Basic writing and formatting syntax, Alerts](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax#alerts)).
- **Alternatives considered**: 배너를 배지보다 위에 두는 안은 배지가 첫 줄에서 밀려 상태 확인이 늦어져 거부했다. 12줄 기준을 유지하고 배지를 한 줄에 몰아 쓰는 안은 원문 가독성이 떨어지고 같은 문제가 재발해 거부했다.

## R2. 배지 구성

- **Decision**: 두 언어 모두 같은 순서의 6개.

  | 순서 | 배지 | 독자 판단 | 연결 대상 |
  |---|---|---|---|
  | 1 | CI | 현재 `main`이 건강한가 | `actions/workflows/ci.yml` |
  | 2 | Release build | 릴리스 워크플로가 동작하는가 | `actions/workflows/release.yml` |
  | 3 | GitHub Release(프리릴리스 포함) | 최신 버전은 무엇인가 | 릴리스 페이지 |
  | 4 | License `GPL-3.0-only` | 라이선스 | `LICENSE` |
  | 5 | Platform | 어떤 플랫폼을 어떤 수준으로 지원하나 | 같은 언어 문서의 "지원 플랫폼과 릴리스" 절 |
  | 6 | Forked from `edith2580/EasyViewer` `v0.1.6` | 원저작자 앱과의 관계 | 원저작자 저장소 |

- 플랫폼 배지 글자: `macOS (focus) | iOS (source build) | Linux · Android (test build)`. Windows는 넣지 않는다. 배지 글자는 두 언어 모두 영어로 같게 두고 연결 앵커만 다르다(국문 `#지원-플랫폼과-릴리스`, 영문 `#supported-platforms-and-releases`).
- 원저작자 출처 배지 이름은 "upstream origin" 대신 "forked from"을 쓴다(R4 용어 규칙: "upstream"은 Git 작업 맥락에서만).
- 빌드 도구 버전 배지(Rust·Node 등)는 두지 않는다. 개발자 정보라 기여 가이드로 옮기는 내용과 겹친다(FR-002 "정보가 겹치거나 독자 판단에 쓰이지 않는 배지는 두지 않는다").
- 배지는 shields.io 정적 배지와 GitHub Actions 상태 배지를 쓴다([Shields.io — Static Badge](https://shields.io/badges/static-badge), [Shields.io — GitHub Release](https://shields.io/badges/git-hub-release), [GitHub Docs — Adding a workflow status badge](https://docs.github.com/en/actions/how-tos/monitor-workflows/add-a-status-badge)). 정적 배지 글자에서 공백은 `%20`, `|`는 `%7C`, `-`는 `--`, `_`는 `__`로 쓴다(Static Badge 문서의 경로 규칙).
- **Alternatives considered**: 형제 프로젝트처럼 빌드 도구 배지를 두는 안은 위 이유로 거부했다(명확화 1: 형제 프로젝트는 참고만).

## R3. README 절 구성과 내용 이동

- **Decision**: 두 언어 같은 순서.

  | 국문 | 영문 | 내용 |
  |---|---|---|
  | `## 원저작자 앱과의 차이` | `## Differences from the original app` | 기존 검증 가능한 차이 표(위치만 앞으로) |
  | `## 지원 플랫폼과 릴리스` | `## Supported platforms and releases` | 원문 블록, 등급·최소 버전·파일·상태 표, 테스트용 빌드 표식, 체크섬 확인, `### 최소 요구 사양`(기존 근거 표) |
  | `## 기능` | `## Features` | 기존 "지원 기능" 하위 절 |
  | `## 조작 방법` | `## Controls` | R6 |
  | `## 설치와 처음 실행` | `## Installation and first launch` | macOS 설치·공증 전 확인, Linux·Android 테스트용 빌드 안내, iOS 소스 빌드 안내, `### Windows 사용자 안내`(기존 2문장) |
  | `## 소스 빌드` | `## Building from source` | 필요 도구 요약과 기본 실행·빌드 명령 몇 줄, 플랫폼별 상세는 기여 가이드 링크 |
  | `## 개발·기여와 보안` | `## Development, contributing and security` | 기여 가이드·보안 정책·운영 문서로 가는 요약과 링크 |
  | `## 라이선스와 저작권 고지` | `## License and copyright notices` | 라이선스, NOTICE, 서드파티 고지, CHANGELOG 링크 |

- **기여 가이드로 옮길 내용**(국문·영문 함께, 명확화 1): 기술 스택 목록("개발 정보 및 아키텍처"), 디렉터리 구조, 테스트·검증 스크립트 목록, 버전 동기화 대상 파일, Rust 툴체인 요구, 플랫폼별 빌드 명령(Linux·macOS·iOS·Android), CI·릴리스 구조와 릴리스 절차. 기여 가이드에는 `## 개발 환경과 구조`, `## 검증 명령`, `## 버전과 빌드`, `## CI와 릴리스` 절을 새로 둔다. 기존 "품질 게이트" 절과 겹치는 검증 설명은 한 곳으로 합친다.
- **보존 검사**: 정리 전 README의 정보 항목(절·표 행·명령 줄)을 목록으로 만들고, 정리 후 각 항목이 README 또는 기여 가이드에 있는지 대조표로 확인한다(SC-006).
- **기존 테스트 영향**: `tests/unit/forkDocs.spec.ts`는 README의 `## 원저작자 앱과의 차이` 절과 `### Windows 사용자 안내`/`### Windows users` 절을 읽는다. 두 제목은 유지한다. `scripts/check-identity.mjs`는 README의 원저작자 앱 이름 사용을 차이 표에서 허용한다(117행 주석) — 표를 옮겨도 같은 절 이름이면 그대로 통과한다.
- **Rationale**: 사용자가 필요한 순서(관계 → 지원 → 기능 → 조작 → 설치)를 먼저 두고, 개발자 정보는 기여 가이드 한 곳에 모은다.

## R4. 용어 대응표와 검사 범위

- **Decision**:

  | 국문(표준) | 영문(표준) | 허용 맥락 | 쓰지 않을 말 |
  |---|---|---|---|
  | 원저작자 | original author | 항상 | 원작자 |
  | 원저작자 저장소 | original repository | 항상 | 원본 저장소 |
  | 원저작자 앱 | original app | 항상 | 원작, 원작 앱, 원본 앱, upstream app |
  | 업스트림 | upstream | 병합·동기화·체리픽·원격·기준선 태그 같은 Git 작업 맥락 | 그 밖의 맥락 |
  | 독립 포크 | independent fork | 항상 | – |
  | 중점·유지·테스트 빌드·제외 | focus, maintained, test build, excluded | 지원 등급 | – |
  | 테스트용 빌드 | test build | 항상 | – |
  | 소스 빌드 | source build | 항상 | – |
  | 보존 기록 | preserved record | 항상 | – |

- "원본"은 "원본 파일은 그대로 남습니다"처럼 사용자 데이터 원본을 뜻할 때 허용한다. 검사는 "원작", "원작자", "원본 앱", "원본 저장소", "upstream app" 같은 정확한 구절만 찾는다.
- "업스트림"/"upstream"은 같은 줄에 Git 작업 낱말(병합, 동기화, 체리픽, 원격, `upstream-base`, merge, sync, cherry-pick, remote, fetch)이 있을 때만 허용한다.
- **검사 범위**: 공개 문서 여섯 쌍. CHANGELOG는 맨 위 릴리스 절(가장 최근 항목)만 검사하고 과거 절은 이력 기록 예외로 둔다. NOTICE의 "원작"은 법적 의미를 바꾸지 않고 "원저작자의 프로그램"(original author's program) 등 표준 용어로 고친다. 고지 사실(저작권자, 날짜, 변경 목록)은 바꾸지 않는다.
- 내부 실측(2026-11-24): "원작"은 `CHANGELOG.md` 8회·`NOTICE` 10회·`README.md` 2회, "업스트림"은 `CONTRIBUTING.md` 6회, "upstream"은 README·CONTRIBUTING·CHANGELOG·NOTICE에 걸쳐 있다.

## R5. 자동 검사 설계

- **Decision**: `scripts/check-doc-pairs.mjs`(현재 59줄)를 확장하고, 새 규칙은 `scripts/docs/` 아래 모듈로 나눈다(파일당 450줄 이하).
  - **맨 위 형식**: 각 문서의 처음 15줄 안에 제목 → 언어 전환 → 한 줄 목적(빈 줄 아닌 첫 문단) 순서.
  - **쌍 구조**: 코드 블록(``` 안)을 빼고 `##`·`###` 제목의 수준 순서가 국문·영문에서 같아야 한다. NOTICE(일반 텍스트)는 `^\d+\. ` 번호 절 목록, NOTICE.en.md는 `## \d+\.` 목록을 비교한다.
  - **링크·앵커**: 저장소 안 상대 링크는 파일이 있어야 하고, `#앵커`는 대상 문서의 제목에서 만든 GitHub 앵커와 같아야 한다. 앵커 규칙은 GitHub 문서의 "Section links"를 따른다: 소문자화, 공백은 `-`, 문자·숫자·`-`·`_` 밖의 문장부호 제거, 같은 앵커가 반복되면 `-1`, `-2`를 붙인다([GitHub Docs — Section links](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax#section-links)). 한글은 그대로 남는다. 외부 URL은 검사하지 않는다(spec 경계 상황).
  - **용어**: R4 규칙.
  - **README 헤더**: R1 순서, R2 배지 6개 순서·플랫폼 배지 글자·연결 앵커, 헤더에 지원 범위 원문 블록 없음.
- 기존 `checkBanner`는 15줄·첫 절 제목 앞 기준으로 바꾼다(R1).
- **Rationale**: 형식이 다시 어긋나는 것을 사람 리뷰에만 맡기지 않는다(헌법 공개 문서 병행 게이트). 이미 `npm run verify`에 연결된 "Public Docs Korean/English Pairs" 단계(`node scripts/check-doc-pairs.mjs`)를 쓰면 새 CI 작업이 필요 없다.

## R6. 조작 방법 절의 근거

- **Decision**: 소스에서 확인한 조작만 적는다.
  - 키보드(`src/composables/reader/useReaderNavigation.ts` `handleKeydown`): 쪽 넘김 모드 `←`/`→`, 스크롤 모드 `↑`/`↓`, 두 모드 공통 `PageUp`/`PageDown`, `Space`(다음); `Ctrl`/`Cmd`+`F` 검색, `Ctrl`/`Cmd`+`B` 책갈피 토글, `Esc` 서랍·설정 닫기.
  - 클릭·탭(`handleReaderTap`): 쪽 넘김 모드에서 화면 아래쪽 1/3은 다음 쪽, 가운데 줄 왼쪽 1/3은 이전 쪽, 가운데 줄 오른쪽 1/3은 다음 쪽, 나머지는 메뉴 표시 토글. 스크롤 모드에서는 탭이 메뉴 표시 토글.
  - 대화상자(`src/composables/ui/useAccessibleDialog.ts`): `Esc` 닫기, `Tab` 초점 순환.
- 동작 확인: 기존 테스트(`tests/unit/readerViewOrchestration.spec.ts`, `tests/e2e/reader-txt.spec.ts` 등)가 덮는 조작은 그 결과를 근거로 삼고, 덮지 않는 조작은 구현 단계에서 단위 테스트를 추가하거나 표에서 뺀다(spec 경계 상황 "확인하지 못한 조작은 적지 않는다").

## R7. 공개 문서 제목과 한 줄 목적

- **Decision**:

  | 문서 | 국문 제목 | 영문 제목 |
  |---|---|---|
  | README | Pagelight | Pagelight |
  | CONTRIBUTING | 기여 가이드 | Contributing guide |
  | SECURITY | 보안 정책 | Security policy |
  | CHANGELOG | 변경 이력 | Changelog |
  | NOTICE | Pagelight 저작권 및 변경 고지 | Pagelight copyright and modification notice |
  | THIRD_PARTY_LICENSES | 서드파티 라이선스 고지 | Third-party licenses |

  괄호 병기("(CHANGELOG)", "(Third-Party Licenses)", "(NOTICE)")는 쓰지 않는다. 언어 전환 줄이 같은 역할을 한다. 언어 전환 줄 다음에는 문서 목적을 한 문장으로 둔다(예: "이 문서는 Pagelight의 변경 이력입니다."). NOTICE는 일반 텍스트 형식을 유지한다. 영문판이 참고 번역이라는 기존 표시는 그대로 둔다.
- THIRD_PARTY_LICENSES는 머리말이 손으로 쓴 부분이다(`scripts/`에 생성 문자열 없음, 2026-11-24 `git grep` 확인). 머리말만 고치고 표와 고지 본문은 건드리지 않는다.
