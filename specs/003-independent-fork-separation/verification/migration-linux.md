# Linux 데이터 이전 실측 (T076, quickstart §3)

| 판정 | **BLOCKED** |
|---|---|
| 날짜 | 2026-11-18 |
| 사유 | 이 작업 환경에 Linux 데스크톱이 없다 |
| 필요한 환경 | Ubuntu 22.04 이상 데스크톱(WebKitGTK 4.1, deb 또는 AppImage). 스파이크 S1(Linux, T005)과 함께 실행하고, WebKitGTK 캐시 하위 폴더 이름(현재 `WebKitCache`만 제외)을 실측해 `src-tauri/src/migration/paths.rs`의 제외 목록을 확정한다 |
