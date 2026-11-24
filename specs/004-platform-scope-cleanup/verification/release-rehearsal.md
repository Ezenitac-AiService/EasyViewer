# 릴리스 경로 확인 (T046–T049)

| 작업 | 판정 | 내용 |
|---|---|---|
| T046 PR CI | 대기 | PR을 연 뒤 CI 5개 작업(작업 목록의 "6개"는 Windows 작업 삭제 전 숫자)(필수 `verify`·`licenses`·`macos-build`, 보고 `ios-sim-build`·`android-debug`) 결과와 실행 링크를 적는다. `macos-build`의 번들 서명 검증이 `icon.ico`·`Square*Logo` 제거 후에도 통과하는지 확인한다(research R1) |
| T047 정상 리허설 | 승인 대기 | `gh workflow run release.yml -f rehearsal=true -f tag_name=v1.0.0-alpha.2-rehearsal`. 초안 릴리스를 만들므로 메인테이너 승인 후 실행 |
| T048 실패 주입 리허설 | 승인 대기 | 같은 명령에 `-f fail_linux=true` |
| T049 `v1.0.0-alpha.1` 노트 보강 | 승인 대기 | 게시된 릴리스 편집(`gh release edit`)이라 메인테이너 승인 후 실행 |

## 로컬에서 대신 확인한 것 (2026-11-24)

- `node scripts/check-release-gate.mjs --static`: 통과(새 `release.yml` 구조, 권한, 고정 액션).
- `tests/unit/releaseWorkflow.spec.ts`: `build-macos`·`build-linux`·`build-android` 분리, 게이트 출력 조건, `publish` 조건(`!cancelled()` + 게이트·macOS 성공), `-test` 이름 변경 → 노트 → 체크섬 → 게시 게이트 → 게시 순서, `fail_linux`·`fail_android`는 `workflow_dispatch` 전용.
- `node scripts/release-notes.mjs --linux-result failure --android-result skipped`: "테스트용 빌드" 절과 두 플랫폼 누락 표식이 생성됨.
- 실제 릴리스 이력(`v1.0.0-alpha.1`, `v0.1.6-beta`, `v0.1.6-alpha`)으로 연속 누락 계산: Linux 0, Android 0(`v1.0.0-alpha.1`의 Android는 서명 키 없음으로 판별, 그 이전 릴리스는 계산 제외).
