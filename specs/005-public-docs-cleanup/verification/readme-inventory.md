# README 정보 항목 대조표 (T002 → T017)

정리 전 `README.md`(139개)·`README.en.md`(140개)의 내용 줄 279개를 `readme-inventory.json`에 기록했다(제목, 빈 줄, 코드 울타리, 구분선, 주석 표식, 표 구분 줄 제외). 각 항목은 `id`(K=국문, E=영문 + 원래 줄 번호), `file`, `line`, `text`다.

T017에서 정리 후 각 항목을 같은 언어의 `README` 또는 `CONTRIBUTING`에서 찾아 `status`를 정한다.

| status | 뜻 |
|---|---|
| kept | 같은 글자로 README에 남음 |
| moved | 같은 글자로 기여 가이드로 옮김 |
| rewritten | 글자가 바뀜(헤더 재구성, 용어 정리, 배지). 새 위치와 사유를 아래 표에 적음 |

## 결과 (T017에서 채움)

2026-11-24 대조 결과(`readme-inventory.json` 279개, 정리 후 같은 언어의 README·기여 가이드에서 줄 단위로 찾음):

| status | 개수 |
|---|---|
| kept(README에 같은 글자로 남음) | 113 |
| moved(기여 가이드로 같은 글자로 옮김) | 153 |
| rewritten(글자가 바뀜, 아래 표) | 13 |
| 위치 없음 | **0** |

| id | 원래 내용 | 새 위치와 사유 |
|---|---|---|
| K016 / E007 | 한 줄 소개("심플한 Text(TXT), EPUB 범용 문서 뷰어…" / "A simple viewer…") | README 헤더 소개 문단으로 다시 씀(FR-001: 앱 종류·버전·독립 포크·Releases 링크) |
| E025 | "The Korean README.md is the authoritative version…" | 영문 README 소개 문단 끝 문장으로 합침 |
| K019 / E010 | `Release` 배지 | 같은 배지, 대체 글자를 `Release build`로(R2) |
| K022 / E013 | 플랫폼 배지(4개 플랫폼 같은 무게, `#지원-기능`·`#supported-platforms`) | 등급 표시 배지, 지원 플랫폼 절 앵커(R2, FR-002) |
| K023 / E014 | `Upstream Origin` 배지 | `Forked from` 배지(R2·R4: "upstream"은 Git 작업 맥락만) |
| K032 / E023 | 헤더의 라이선스 한 줄 안내 | 헤더에서 빼고 "라이선스와 저작권 고지" 절의 기존 항목(라이선스, NOTICE, 서드파티 고지)으로 합침(FR-001) |
| K293 | "이 포크는 원작 `v0.1.6`…원작의 이후 릴리스…" | 같은 절에 남기고 "원작"을 "원저작자 앱"으로(R4) |
| E066 | 기술 스택의 Platforms 항목 | 기여 가이드 "Tech stack"으로 옮기고 링크를 `./README.en.md#supported-platforms-and-releases`로(기여 가이드에 없는 앵커를 가리키지 않도록) |

판정: **PASS**(SC-006, 위치 없는 정보 0개).
