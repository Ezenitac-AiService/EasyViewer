# 003에서 이관한 macOS 실기기 항목 (T051)

| 항목 | 판정 | 사유 |
|---|---|---|
| 데이터 이전 시나리오 1·6·8(003 quickstart §3) | **BLOCKED** | 원저작자 앱 `v0.1.6`으로 만든 실제 사용자 데이터가 있는 macOS 계정에서, 앱을 설치·실행하고 화면 안내를 직접 확인해야 한다. 에이전트 세션은 GUI 앱 설치·조작을 하지 않는다 |
| 레거시 키체인 접근 창(003 S2) | **BLOCKED** | macOS 키체인 접근 허용 창은 사용자가 직접 응답해야 한다(권한 창 대리 승인 금지) |
| 원저작자 앱과의 공존 설치(003 S3 macOS 부분) | **BLOCKED** | 원저작자 앱과 Pagelight `.app`을 함께 설치하고 실행해 봐야 한다 |

자동 테스트로 대신 확인한 범위: 이전 엔진의 원본 보존·멱등·되돌리기(`src-tauri/src/migration/tests/`), macOS 경로 규칙(`linux.rs`의 `macos_paths_keep_the_webkit_store_pair`).

메인테이너가 macOS 실기기에서 실행하면 위 표의 판정과 날짜를 고친다.

## 실행 환경 점검 (2026-11-24)

| 항목 | 상태 |
|---|---|
| 원저작자 앱·구 포크 앱·Pagelight `.app` 설치 | 없음(`/Applications`) |
| 구 식별자 데이터 `~/Library/Application Support/com.edith.easyviewer` | 있음(12K, `books/`만) — 개발 중 실행 흔적이며 시나리오 1의 준비 상태(책 3권, 진행률·책갈피·설정, WebDAV 연결)가 아님 |
| 구 식별자 WebKit 저장소 `~/Library/WebKit/com.edith.easyviewer` | 있음(500K) |
| 새 식별자 폴더 | 없음 |

판정 유지: **BLOCKED**. 시나리오 1·6·8과 S2·S3는 앱 설치·GUI 조작·WebDAV 자격증명·키체인 허용 창 응답이 필요하고, 이전을 실행하면 이 Mac의 실제 사용자 폴더(`~/Library`)에 새 식별자 폴더가 생긴다. 키체인 허용 창은 메인테이너가 직접 응답해야 하므로 메인테이너가 실기기에서 실행한다. 실행할 때는 003 quickstart §3·§4 절차를 따르고, 이전을 되돌리려면 앱의 "이전 결과 버리기"를 쓴다(구 폴더는 그대로 남는다).

