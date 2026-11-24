# Linux 데이터 이전 실측 (T076, quickstart §3)

> **범위 조정 (2026-11-24, 004 T043)**: 테스트 빌드 등급 전환으로 실기기 검증 범위 제외, 이전 동작은 자동 테스트로 확인(004 FR-015). Linux 경로 규칙(데이터 폴더 한 쌍, `WebKitCache` 제외, 되돌리기 대상은 새 데이터 폴더 하나)과 원본 보존·중단 후 되돌리기·재실행 중복 없음은 `src-tauri/src/migration/tests/linux.rs`가 OS를 인자로 받아 macOS 호스트에서도 검증한다. 아래 BLOCKED 기록은 이력으로 남긴다.

| 판정 | **BLOCKED** |
|---|---|
| 날짜 | 2026-11-18 |
| 사유 | 이 작업 환경에 Linux 데스크톱이 없다 |
| 필요한 환경 | Ubuntu 22.04 이상 데스크톱(WebKitGTK 4.1, deb 또는 AppImage). 스파이크 S1(Linux, T005)과 함께 실행하고, WebKitGTK 캐시 하위 폴더 이름(현재 `WebKitCache`만 제외)을 실측해 `src-tauri/src/migration/paths.rs`의 제외 목록을 확정한다 |
