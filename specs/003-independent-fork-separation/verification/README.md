# 실측 기록 (003 독립 포크 분리)

이 폴더는 자동 테스트로 대신할 수 없는 실측·수동 작업의 기록을 모은다. 헌법 제6원칙에 따라 실행하지 못한 항목은 통과로 쓰지 않고 `BLOCKED`로 남긴다.

## 기록 형식

각 항목은 다음을 모두 적는다.

| 필드 | 내용 |
|---|---|
| 날짜 | ISO 8601(UTC) |
| 환경 | OS·버전, 기기, 앱 버전, 관련 도구 버전 |
| 실행 명령·절차 | 그대로 재현할 수 있는 수준 |
| 결과 | 관찰한 사실(로그 발췌·스크린샷 경로) |
| 판정 | `PASS` / `FAIL` / `BLOCKED`(사유와 필요한 환경) |

비밀값, 결함 재현 세부, 개인 기기 식별자는 기록하지 않는다.

## 파일 목록

| 파일 | 내용 | 관련 작업 |
|---|---|---|
| `spikes.md` | 스파이크 S1–S5 실측 결과 | T004–T009, T077 |
| `security-coordination.md` | 원저작자 보안 통지 요약(통지 이후에만 작성) | T013, T014 |
| `upstream-notice.md` | 원저작자 사전 고지와 이의 대응 | T095 |
| `migration-macos.md` | macOS 데이터 이전 실측(quickstart §3) | T076 |
| `migration-linux.md` | Linux 데이터 이전 실측(quickstart §3) | T076 |
| `coexistence.md` | 원저작자 앱과 공존 설치 실측(quickstart §4) | T077 |
| `windows-migration.md` | Windows 전환 절차 실측(quickstart §7) | T048 |
| `release-gate.md` | FR-025 안전 게이트 체크 기록 | T011, T042, T062, T091–T099 |
