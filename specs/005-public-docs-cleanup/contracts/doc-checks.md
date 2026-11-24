# Contract: 공개 문서 자동 검사

`npm run verify`의 기존 "Public Docs Korean/English Pairs" 단계(`node scripts/check-doc-pairs.mjs`)가 다음을 모두 검사한다. 실패하면 종료 코드 1, 메시지는 `[check:doc-pairs] <파일>: <이유>`.

| 규칙 | 실패 조건 |
|---|---|
| D1 쌍·언어 전환(기존) | 쌍 파일 없음, 처음 15줄 안 언어 전환 줄 없음 |
| D2 맨 위 형식 | 첫 줄이 제목이 아님, 언어 전환이 제목 다음이 아님, 언어 전환 다음 첫 문단(목적 문장)이 없음. README는 예외: 언어 전환 다음 헤더 순서는 D7이 검사하고, 헤더의 소개 문단을 목적 문장으로 본다. NOTICE.en.md·THIRD_PARTY_LICENSES.en.md는 목적 문장 바로 다음에 참고 번역 인용(`reference translation`)이 없으면 실패 |
| D3 제목 형식 | research R7 표와 다른 제목, 괄호 병기 |
| D4 쌍 구조 | `##`·`###` 수준 순서(코드 블록 제외)가 국문·영문에서 다름. NOTICE는 번호 절 수가 다름 |
| D5 링크·앵커 | 상대 링크 대상 파일 없음, `#앵커`가 대상 문서 제목 앵커(GitHub 규칙)에 없음 |
| D6 용어 | research R4의 쓰지 않을 구절이 검사 범위에 있음, "업스트림"/"upstream"이 Git 작업 낱말 없는 줄에 있음 |
| D7 README 헤더 | 헤더 요소 순서가 다름, 배지 수·순서·플랫폼 배지 글자·앵커가 다름, 헤더에 지원 범위 원문 블록 또는 라이선스 한 줄이 있음 |

`scripts/check-support-scope.mjs`의 배너 검사는 "README.md 처음 15줄 안이고 첫 `## ` 제목 앞"으로 바뀐다. 나머지 기존 검사(지원 범위 블록, 금지 표현, 이슈 양식, 정체성, Windows 재유입)는 바뀌지 않는다.
