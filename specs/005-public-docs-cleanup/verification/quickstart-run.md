# Quickstart 실행 결과 (T034, 2026-11-24)

| 절 | 판정 | 결과 |
|---|---|---|
| §1 자동 검사 | **PASS** | `npm run verify` 통과: vitest 460건(기준선 393), 공개 문서 검사 D1–D7, 지원 범위·배너 위치·금지 표현·정체성·Windows 재유입, `cargo test` 53건 |
| §2 첫 화면 점검 | **PASS** | [first-screen.md](first-screen.md): 다섯 질문 5/5, GitHub 렌더링(경고 블록, 배지 6개, 앵커) 확인 |
| §3 내용 보존 | **PASS** | [readme-inventory.md](readme-inventory.md): 279개 중 kept 113, moved 153, rewritten 13, 위치 없음 0 |
| §4 조작 방법 | **PASS** | [controls.md](controls.md): 표의 모든 조작에 자동 테스트 있음, 뺀 조작 없음 |
| §5 형제 프로젝트 문장 복사 없음 | **PASS** | ImageViewer `README.md`·`README.en.md`의 20자 이상 문장 125개를 공개 문서 12개와 대조. 일치 1건은 언어 전환 줄(`**언어 / Language**: …`)로, 헌법 제1원칙이 정한 양식이라 복사가 아니다 |

다른 위치의 옛 앵커 링크(T032): `docs/`, `.github/`, `src/`, 릴리스 노트 템플릿에서 README·기여 가이드의 옛 앵커(`#지원-기능`, `#supported-platforms`, `#macos-설치-…`, `#업스트림과의-관계`, `#quality-gates` 등)를 찾았고 0건이다. 남은 앵커 링크는 모두 새 앵커이며 D5가 확인한다.
