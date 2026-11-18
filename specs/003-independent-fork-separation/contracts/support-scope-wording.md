# 계약: 지원 범위 원문과 공개 문구

**요구사항**: FR-006, FR-007, FR-009, US2, SC-004 | **모델**: [data-model.md](../data-model.md) §3 | **리서치**: R15

## 1. 원문 (`src/config/supportScope.ts`가 렌더하는 한국어 문구)

> 이 포크는 **macOS · iOS · Linux**를 중점 지원합니다. iOS는 공개 배포 채널 없이 소스 빌드로만 제공합니다.
> Android는 우선순위를 낮춘 유지 플랫폼으로 계속 배포합니다.
> **Windows는 이 포크의 지원·배포 대상이 아닙니다. Windows에서는 원저작자의 [EasyViewer](https://github.com/edith2580/EasyViewer)를 사용하세요.**
> 웹 브라우저 실행은 개발 보조용입니다.
> Linux는 Ubuntu 22.04 이상 또는 동급 배포판(deb·AppImage, WebKitGTK 4.1, X11·Wayland)에서 검증합니다. 그 밖의 배포판은 동작할 수 있으나 검증하지 않습니다.

**영문 배너 한 줄**(README 최상단 배너에만 사용):

> This is an independent fork. It supports macOS, iOS (source build only) and Linux; Android is maintained. For Windows, please use the original EasyViewer by edith2580.

- 원저작자 이의(확정 결정 10)가 있으면 Windows 문장을 "이 포크는 Windows를 지원하지 않습니다."로 줄인다. 원문 모듈 한 곳만 바꾸면 모든 게시 위치가 따라 바뀐다.

## 2. 게시 위치와 검사

| 위치 | 형식 | 검사 |
|---|---|---|
| `README.md` | 맨 위 배너(영문 한 줄 + 한국어 원문) | `check-support-scope.mjs` 블록 일치 |
| `NOTICE` | `<!-- support-scope:start/end -->` 블록 | 블록 일치 |
| `CHANGELOG.md` | 독립 분리 항목 안 블록 | 블록 일치 |
| `CONTRIBUTING.md` | 블록 | 블록 일치 |
| `.github/ISSUE_TEMPLATE/config.yml` + 버그 양식 | Windows 사용자 → 원저작자 저장소 링크, 플랫폼 선택지는 macOS·iOS·Linux·Android만 | 선택지 집합 검사 |
| 정보 화면 | `supportScope.ts` 직접 사용 | 단위 테스트 |
| 헌법 "지원 플랫폼 등급" | 의미 일치 | 사람 검토(체크리스트 항목) |

## 3. 금지 표현 (FR-007)

공개 문서와 앱 문자열에서 다음이 발견되면 `check-support-scope.mjs`가 실패한다. 원저작자 동의 기록이 있으면 예외 목록에 추가한다.

- `역할 분담`, `역할을 나눠`
- `경쟁하지 않`
- 원저작자 앱을 "Windows 전용", "레거시", "구버전"으로 부르는 표현
- 원저작자에게 통지하지 않은 보안 결함 언급(R11 통지 기록 날짜 전까지 `security`·`취약점` + `원저작자` 동시 등장 금지)

검사 범위는 `README.md`, `NOTICE`, `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md`, `docs/**`, `.github/ISSUE_TEMPLATE/**`, `src/**/*.vue`, `src/config/**`다. 과거 명세는 제외한다.

## 4. 이슈 처리 방침 (FR-009)

`CONTRIBUTING.md`와 이슈 양식에 적는다.
- 포크 Windows 빌드 이슈는 포크 저장소에서 받는다.
- `docs/windows-migration.md` 안내로 종결한다.
- 포크 빌드 문제를 원저작자 저장소에 올리지 말 것을 안내한다.
