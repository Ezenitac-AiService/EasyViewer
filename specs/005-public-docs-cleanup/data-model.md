# Data Model: 국문·영문 공개 문서 정리

저장소 파일만 다룬다. 데이터베이스는 없다.

## 1. PublicDocPair (공개 문서 쌍)

| 필드 | 값 | 규칙 |
|---|---|---|
| `ko` | `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md`, `NOTICE`, `THIRD_PARTY_LICENSES.md` | 기존 `DOC_PAIRS` 그대로 |
| `en` | 각각의 `*.en.md`(NOTICE는 `NOTICE.en.md`) | 같음 |
| `title` | research R7 표 | 괄호 병기 없음 |
| `switcher` | `**언어 / Language**: …` | 처음 15줄 안, 제목 다음 |
| `purpose` | 한 문장 | 언어 전환 줄 다음 첫 문단. README는 헤더의 소개 문단. 참고 번역 문서(NOTICE.en.md, THIRD_PARTY_LICENSES.en.md)는 목적 문장 바로 다음에 참고 번역 인용 필수 |
| `outline` | `##`·`###` 제목 수준 순서(코드 블록 제외), NOTICE는 번호 절 | 국문·영문 같아야 함 |

## 2. ReadmeHeader (README 헤더)

첫 `## ` 제목 앞의 영역.

| 순서 | 요소 | 규칙 |
|---|---|---|
| 1 | 제목 | `# Pagelight` |
| 2 | 언어 전환 | 기존 형식 |
| 3 | 배지 6개 | §3 순서 |
| 4 | 영문 배너 | `supportScopeBannerEn()`과 같은 글자, 처음 15줄 안 |
| 5 | 소개 문단 | 앱 종류, 버전, 독립 포크, 원저작자 앱 링크 |
| 6 | 처음 실행 안내 | `> [!IMPORTANT]`, "설치와 처음 실행" 절 링크 |
| 7 | 포크·이슈 안내 | `> [!NOTE]`, Issues 링크, SECURITY 링크 |

금지: 지원 범위 원문 블록(`support-scope`·`support-scope-en` 표식), 라이선스 한 줄 안내.

## 3. Badge (배지)

| 필드 | 규칙 |
|---|---|
| `id` | `ci`, `release-build`, `release`, `license`, `platform`, `forked-from` 순서 |
| `label` | 두 언어 같음. `platform`은 `macOS (focus) \| iOS (source build) \| Linux · Android (test build)`, Windows 없음 |
| `target` | research R2 표. `platform`은 같은 언어 README의 지원 플랫폼 절 앵커 |

## 4. TermEntry (용어 대응표)

| 필드 | 예 |
|---|---|
| `ko` / `en` | 원저작자 앱 / original app |
| `context` | `always` 또는 `git`(업스트림) |
| `banned` | 원작, 원본 앱, upstream app |

검사 예외: CHANGELOG 맨 위 릴리스 절 밖(과거 이력), 인용 블록 안 원문 인용.

## 5. ContentInventory (README 정보 항목 대조표)

정리 전 README의 절·표 행·명령 줄 목록. 항목마다 `before`(정리 전 위치), `after`(정리 후 위치: README 절 또는 기여 가이드 절), `status`(kept, moved, merged). `status`가 비어 있는 항목은 0개여야 한다(SC-006). 위치: `specs/005-public-docs-cleanup/verification/readme-inventory.md`.
