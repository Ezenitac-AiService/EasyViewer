# 첫 실제 게시: v1.0.0-alpha.2 (2026-11-24)

004에서 만든 릴리스 경로(테스트용 빌드 `-test` 표식, 노트 자동 생성, 연속 누락 게이트)로 처음 실제 게시한 기록이다. 리허설 기록은 [release-rehearsal.md](release-rehearsal.md).

## 준비

| 단계 | 결과 |
|---|---|
| 릴리스 전 정기 확인(운영 절차 §5) | 원저작자 저장소 보관 안 됨. 최신 릴리스 `v0.2.4`(2026-11-21, `v0.2.3`·`v0.2.4` 신규)에도 Windows 산출물 게시. 데이터 형식 `DB_VERSION = 1`, 식별자 `com.edith.easyviewer` 유지 → Windows 안내·전환 안내 변경 없음, 문서의 최신 릴리스 표기만 갱신 |
| 버전 올림 | PR #25(병합 `b339642`): 버전 `1.0.0-alpha.2`, Android `versionCode` 1000002, CHANGELOG `[1.0.0-alpha.2]`·`[1.0.0-alpha.1]` |
| `main` CI | 병합 커밋 `b339642`에서 5개 작업 모두 통과(run 45406787027) |
| 리허설 | [run 45407544243](https://github.com/Ezenitac-AiService/EasyViewer/actions/runs/45407544243): 전 작업 성공. `.dmg` 표식 없음, Linux `-test`, APK `-test-rehearsal`, 체크섬 4개 포함. 확인 후 초안 삭제, 리허설 태그 0개 |

## 게시

- 태그: `v1.0.0-alpha.2`(주석 태그, `b339642`), 메인테이너 승인 후 푸시.
- 워크플로 [run 45410950800](https://github.com/Ezenitac-AiService/EasyViewer/actions/runs/45410950800):
  - 첫 시도: `gate` 성공, `build-linux` 성공, `build-android` 건너뜀(서명 키 없음), `build-macos` **취소**. 원인은 GitHub의 macOS arm64 러너 용량 부족("The job was not acquired by Runner of type hosted even after multiple attempts"). 아무것도 게시되지 않았다.
  - `gh run rerun --failed`로 다시 실행: `build-macos`·`publish` 성공.
- 릴리스: [Pagelight v1.0.0-alpha.2](https://github.com/Ezenitac-AiService/EasyViewer/releases/tag/v1.0.0-alpha.2)(프리릴리스).

| 산출물 | 크기 | `shasum -a 256 -c` |
|---|---|---|
| `Pagelight_1.0.0-alpha.2_universal.dmg` | 14,819,595 B | OK |
| `Pagelight_1.0.0-alpha.2_amd64-test.deb` | 8,784,418 B | OK |
| `Pagelight_1.0.0-alpha.2_amd64-test.AppImage` | 86,460,920 B | OK |
| `SHA256SUMS.txt` | 319 B | 위 3개 포함 |

릴리스 노트: "포함된 테스트용 빌드: Linux", Android 안내(국문·영문)와 `<!-- pagelight:omitted android=no-signing-key -->`, "이전 버전에서 옮겨 올 때" 절.

## 게시 후 상태

- 연속 누락 계산(실제 이력 `v1.0.0-alpha.2`, `v1.0.0-alpha.1`, …): Linux 0, Android 0. 서명 키 미등록 누락은 세지 않으므로 다음 릴리스 게이트에 영향 없음.
- 판정: **PASS**(SC-002·SC-003·SC-004의 실제 게시 확인).

## 운영 메모

macOS 빌드가 러너 용량 부족으로 취소되면 릴리스는 게시되지 않고 워크플로가 실패로 끝난다(테스트용 빌드는 이미 성공해도 게시 단계는 macOS 성공을 기다림). 이때는 `gh run rerun <run-id> --failed`로 실패한 작업만 다시 실행하면 된다. 태그를 다시 만들 필요는 없다.
