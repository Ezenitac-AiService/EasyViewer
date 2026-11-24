# 릴리스 경로 확인 (T046–T049)

| 작업 | 판정 | 내용 |
|---|---|---|
| T046 PR CI | **PASS** | PR #19: `verify`·`licenses`·`macos-build`·`ios-sim-build` 통과(`android-debug`는 병합 시점 진행 중). 병합 후 `main`(`5a03a58`) CI 5개 작업 모두 통과([run 45332038593](https://github.com/Ezenitac-AiService/EasyViewer/actions/runs/45332038593)). `icon.ico`·`Square*Logo` 제거 후에도 macOS 번들 서명 검증 통과(research R1). 작업 목록의 "6개"는 Windows 작업 삭제 전 숫자 |
| T047 정상 리허설 | **PASS** | 아래 1 |
| T048 실패 주입 리허설 | **PASS** | 아래 2 |
| T049 `v1.0.0-alpha.1` 노트 보강 | 승인 대기 | 게시된 릴리스 편집이라 별도 승인 후 실행 |

리허설 태그는 게이트가 매니페스트 버전과 맞춰 보므로 quickstart의 `v1.0.0-alpha.2-rehearsal`이 아니라 `v1.0.0-alpha.1-rehearsal`을 썼다(매니페스트 `1.0.0-alpha.1`).

## 0. 첫 시도: 게이트 BLOCKED (2026-11-24)

[run 45332206998](https://github.com/Ezenitac-AiService/EasyViewer/actions/runs/45332206998): 병합 직후 `main` CI가 끝나기 전이라 항목 4·5가 "결과를 조회할 수 없습니다"로 BLOCKED(종료 코드 2), 빌드 작업 전부 건너뜀. 게이트가 설계대로 동작했다. `main` CI 완료 후 다시 실행했다.

## 1. 정상 리허설 (T047, SC-002)

[run 45332923988](https://github.com/Ezenitac-AiService/EasyViewer/actions/runs/45332923988): `gate`·`build-macos`·`build-linux`·`build-android`·`publish` 모두 성공. 초안 `[REHEARSAL] Pagelight v1.0.0-alpha.1-rehearsal`.

| 산출물 | 크기 | 표식 |
|---|---|---|
| `Pagelight_1.0.0-alpha.1_universal.dmg` | 14,819,247 B | 없음(macOS) |
| `Pagelight_1.0.0-alpha.1_amd64-test.deb` | 8,785,978 B | `-test` |
| `Pagelight_1.0.0-alpha.1_amd64-test.AppImage` | 86,465,016 B | `-test` |
| `Pagelight_1.0.0-alpha.1_android-arm64-test-rehearsal.apk` | 216,175,174 B | `-test-rehearsal`(debug 서명) |
| `SHA256SUMS.txt` | 442 B | 위 4개 파일 모두 포함 |

릴리스 노트 끝에 "테스트용 빌드 / Test builds" 절(한·영): 포함된 테스트용 빌드 Linux, Android, 미보장 범위, 테스트 빌드 버그 양식 링크. 누락 표식 없음. 확인 후 초안을 지웠다.

## 2. 실패 주입 리허설 (T048, SC-003a)

[run 45334090024](https://github.com/Ezenitac-AiService/EasyViewer/actions/runs/45334090024)(`fail_linux=true`): `build-linux` 실패, `gate`·`build-macos`·`build-android`·`publish` 성공.

- 산출물: `universal.dmg`, `android-arm64-test-rehearsal.apk`, `SHA256SUMS.txt`. Linux 파일 없음.
- 노트: "포함된 테스트용 빌드: Android", Linux 누락 안내(한·영)와 `<!-- pagelight:omitted linux=build-failed -->`.
- 확인 후 초안을 지웠다. 원격에 `*rehearsal*` 태그 0개, 남은 릴리스는 `v1.0.0-alpha.1`·`v0.1.6-beta`·`v0.1.6-alpha`(모두 게시본)뿐이다.
