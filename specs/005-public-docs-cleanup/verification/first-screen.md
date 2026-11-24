# 첫 화면 점검 (T010, quickstart §2)

기준: `README.md`·`README.en.md`의 헤더(첫 `##` 절 앞)만 읽는다. 2026-11-24 로컬 원문과 GitHub 렌더링(T035) 기준.

| 질문 | 국문 헤더에서 답하는 곳 | 영문 헤더 | 판정 |
|---|---|---|---|
| 무슨 앱인가 | 소개 문단 "텍스트(TXT)와 EPUB 문서를 읽는 간단한 뷰어" | 소개 문단 "simple viewer for plain text (TXT) and EPUB documents" | PASS |
| 원저작자 앱과의 관계 | 소개 문단·`[!NOTE]`·출처 배지("forked from edith2580/EasyViewer (v0.1.6)") | 같음 | PASS |
| 지원 등급 | 플랫폼 배지 `macOS (focus) \| iOS (source build) \| Linux · Android (test build)`, 영문 배너 | 같음 | PASS |
| 받는 곳 | 소개 문단의 Releases 링크, 최신 릴리스 배지 | 같음 | PASS |
| macOS 처음 실행 | `[!IMPORTANT]` 처음 실행 안내 → macOS 설치 절 | 같음 | PASS |

배너는 국문 README 12번째 줄이다(첫 화면 기준 15줄 안, 첫 `##` 앞). 두 언어의 헤더 요소 순서는 같다(D7 통과).

## GitHub 렌더링 (T035, 2026-11-24)

브랜치 `005-public-docs-impl`(커밋 `6b8b7be`)을 GitHub 콘텐츠 API의 HTML 렌더링(`Accept: application/vnd.github.html`)으로 받아 확인했다.

| 항목 | README.md | README.en.md |
|---|---|---|
| 경고 블록(`[!IMPORTANT]`, `[!NOTE]`)이 경고로 렌더링 | 2/2 | 2/2 |
| 배지 이미지 | 6 | 6 |
| 플랫폼 배지·처음 실행 안내 링크의 앵커가 렌더링된 제목 id에 있음 | 지원-플랫폼과-릴리스, 설치와-처음-실행 | supported-platforms-and-releases, installation-and-first-launch |
| 기여 가이드 링크 앵커 4개 | 있음 | 있음 |

배지 이미지 글자(Shields.io 응답의 `<title>`): `platform: macOS (focus) | iOS (source build) | Linux · Android (test build)`, `forked from: edith2580/EasyViewer (v0.1.6)`.

판정: **PASS**(5/5, 로컬 원문과 GitHub 렌더링).
