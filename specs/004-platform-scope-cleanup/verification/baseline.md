# 기준선 (T001)

| 필드 | 내용 |
|---|---|
| 날짜 | 2026-11-24 |
| 커밋 | `f6946a1`(main, 004 스펙 병합) 기준 브랜치 `004-platform-scope-impl` |
| 환경 | macOS (Darwin 27.2), Apple Silicon, Node 24, rustc 1.100.0 |
| `npm run verify` | 통과. vitest 306건, 경계·버전·라이선스·지원 범위·문서 쌍·앱 정체성·워크플로 규칙, `cargo check`·`cargo test` |
| `cargo test` | 45건 통과 |
| `npm run test:e2e` | 16건 통과 |
| 초기 번들 `dist/assets/index-*.js` | 337,281 B(한도 480 kB) |

## 라벨 (T002)

`test-build` 라벨 생성은 메인테이너 승인 대기.
