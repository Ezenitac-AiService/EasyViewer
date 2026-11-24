# FR-025 분리·릴리스 안전 게이트 기록

`node scripts/check-release-gate.mjs --separation`(1–5)과 `--release --tag <태그> --assets <폴더>`(1–8)가 이 파일을 읽는다. 자동으로 확인할 수 있는 항목도 근거 링크를 남긴다. 비밀값은 적지 않는다.

| 항목 | 내용 | 판정 | 확인자 | 날짜 | 근거 |
|---|---|---|---|---|---|
| 1 | 기준선 태그 `upstream-base-v0.1.6`이 원격에서 `44c4d37`을 가리킴 | **통과** | Claude Code(메인테이너 승인) | 2026-11-19 | `git ls-remote --tags origin upstream-base-v0.1.6` → `d6a56ab4…`(주석 태그), `^{}` → `44c4d37749d29bd070e7a07aea4622eef0b97306` |
| 2 | 보안 조율 완료 | 미완 | — | — | `security-coordination.md` |
| 3 | 원저작자 사전 고지 완료 | 미완 | — | — | `upstream-notice.md` |
| 4 | `main` 전체 CI 통과 | **통과**(6/6) | Claude Code | 2026-11-19 | [`main` ci.yml 실행 44335120998](https://github.com/Ezenitac-AiService/EasyViewer/actions/runs/44335120998) (병합 커밋 `83b1825`). `ios-sim-build`는 macOS arm64 러너 부족으로 취소된 뒤 재실행에서 통과. 병합 전 PR 실행: [44298183848](https://github.com/Ezenitac-AiService/EasyViewer/actions/runs/44298183848). 이 기록은 시점 근거이며, 게이트는 릴리스 때 `main` 최신 결과를 다시 조회한다 |
| 5 | 라이선스 감사 통과 | **통과** | Claude Code | 2026-11-19 | [같은 `main` 실행의 `licenses` 작업](https://github.com/Ezenitac-AiService/EasyViewer/actions/runs/44335120998) (`cargo deny check`, `check-licenses.mjs`) |
| 6 | 체크섬 생성 | 미완 | — | — | 릴리스 `SHA256SUMS.txt` |
| 7 | Windows 산출물 부재 | 미완 | — | — | 릴리스 산출물 목록 |
| 8 | Android 서명 키 백업 확인 | 미완 | — | — | 아래 체크와 지문 |

## 메인테이너 확인

- [ ] 8. Android 서명 키 백업 확인 — 서로 다른 보관 장소 2곳 이상, 그중 하나는 오프라인(`docs/android-signing.md`)

서명 인증서 SHA-256:
직전 포크 릴리스 versionCode: 1000001

## 업스트림 원격 제거 기록 (T094)

`git remote -v` 결과 (2026-11-19, 메인테이너가 `git remote remove upstream` 실행 후):

```text
origin	https://github.com/Ezenitac-AiService/EasyViewer.git (fetch)
origin	https://github.com/Ezenitac-AiService/EasyViewer.git (push)
```

## 분리 요청·결과 기록 (T097, T098)

- 분리 게이트 확인(T096): 2026-11-19, 최신 `main`(`95f087d`, CI 실행 44488872183 6개 작업 통과)에서 `node scripts/check-release-gate.mjs --separation` → `분리 게이트 통과`(종료 코드 0)
- 지원 종료 고지 게시: 2026-11-19, `docs/windows-eol-notice.md` 문안을 `v0.1.6-alpha`·`v0.1.6-beta` 릴리스 노트 맨 위에 추가(`gh release edit`). 기존 노트는 고지 아래에 그대로 두었고, 산출물은 두 릴리스 모두 6개로 변화 없음
- 릴리스 산출물·노트 백업 위치: 메인테이너 로컬 `~/easyviewer-release-backup/`(2026-11-19). 두 릴리스 산출물 12개와 수정 전 노트(`NOTES.md`). 파일 크기를 GitHub 값과 대조해 12개 모두 일치, SHA-256 목록은 `SHA256SUMS-backup.txt`. 저장소 밖 두 번째 보관처로의 복사는 메인테이너 확인 항목
- 비공개 취약점 신고: 2026-11-19 켬(메인테이너 승인, `gh api -X PUT repos/Ezenitac-AiService/EasyViewer/private-vulnerability-reporting`). 확인 결과 `enabled: true`
- GitHub Support 요청일: 2026-11-19, help.github.com 가상 도우미(Detaching/unforking a repository)로 요청. 선택: "GitHub Support가 detach/extract를 도움" → Detach, 대상 `Ezenitac-AiService/EasyViewer`, 포크에 커밋 있음, 사유 "부모 저장소와 크게 갈라짐". 이슈·PR·릴리스 보존을 요청 본문에 적음. 도우미가 지원 티켓을 자동 생성(처리 후 통지 예정). 요청 직후 `.fork`는 아직 `true`
- Support 답변(티켓 #5027746, 2026-11-23 확인): 처리하지 않고 닫힘. 담당자는 저장소가 공개·1 GB 미만·하위 포크 없음이므로 설정의 "Leave fork network"로 직접 분리하라고 안내했고, 이 계정의 지원 범위는 셀프서비스뿐이라는 자동 종료 메시지가 붙었다
- 자체 분리 실행: 2026-11-23, 메인테이너 승인 후 저장소 Settings → Danger Zone → "Leave fork network"(경고 확인, 저장소 이름 입력). research R10의 자체 분리 조건(Support 거절, 릴리스 백업, 위키 없음, 지원 종료 고지 게시)을 모두 만족한 상태였다. 약 40초 뒤 분리 완료
- 분리 완료 확인(`.fork == false`, 릴리스·고지 보존, PR 기본 대상, 코드 검색): 2026-11-23
  - `gh api repos/Ezenitac-AiService/EasyViewer --jq .fork` → `false`, `parent` 없음
  - 릴리스 `v0.1.6-alpha`·`v0.1.6-beta` 보존, 각 산출물 6개, 노트 맨 위 지원 종료 고지 유지
  - 병합된 PR #1–#4가 그대로 조회된다(문서 경고와 달리 이번 분리에서는 PR이 남았다). 기준선 태그 `upstream-base-v0.1.6`, 비공개 취약점 신고 설정도 유지
  - PR 기본 대상: 부모 저장소가 없어져 새 PR의 대상은 이 저장소뿐이다(`gh repo view` 결과 `isFork: false`, `parent` 없음)
  - 코드 검색: 분리 직후에는 색인 대기로 결과가 없었다(`BLOCKED`). 2026-11-24 `gh search code "relinkLegacyLibraryPaths" --repo Ezenitac-AiService/EasyViewer`가 3건(`src/main.ts` 등)을 돌려줘 **PASS**. SC-003의 분리 항목(포크 아님, PR 대상, 업스트림 원격 없음, 기준선 태그, 코드 검색)이 모두 확인되었다
  - main 규칙·게이트 변경(2026-11-24, 메인테이너 결정, 헌법 v5.0.0): 핵심 빌드는 macOS 하나다. `main` 필수 검사와 릴리스 게이트 항목 4는 핵심 작업 `verify`·`licenses`·`macos-build`만 요구하고, `ios-sim-build`·`android-debug`는 보고만 한다. `windows-compile-test`는 CI에서 삭제했다
  - 후속 정비(2026-11-23): 이슈 기능 켬, 저장소 설명·토픽을 Pagelight 기준으로 갱신, `main` 규칙(삭제·강제 푸시 금지, CI 6개 작업 필수, 관리자 우회 허용) 적용, 병합된 원격 브랜치 정리. 코드 검색은 이 시점에도 결과 0건으로 `BLOCKED` 유지

## 첫 독립 릴리스 기록 (T099)

- 날짜: 2026-11-24
- 태그: `v1.0.0-alpha.1`(주석 태그, 커밋 `aa342af`). 태그 전 `main` CI [실행 45204054709](https://github.com/Ezenitac-AiService/EasyViewer/actions/runs/45204054709) 6개 작업 모두 통과, 로컬에서 `check-release-gate.mjs --release --tag v1.0.0-alpha.1 --phase prebuild --without-android` 통과
- 워크플로: [실행 45206035956](https://github.com/Ezenitac-AiService/EasyViewer/actions/runs/45206035956) — `gate`·`build-desktop`(macOS·Linux)·`publish` 성공, `build-android` 건너뜀(서명 키 비밀값 없음, 헌법 v4.3.0)
- 릴리스: [Pagelight v1.0.0-alpha.1](https://github.com/Ezenitac-AiService/EasyViewer/releases/tag/v1.0.0-alpha.1)(공개 프리릴리스)
- 산출물과 SHA-256:
  - `Pagelight_1.0.0-alpha.1_universal.dmg` `090cc19142d397351bcb4e39e9684699451f29514bd322929321209d666e15a3`
  - `Pagelight_1.0.0-alpha.1_amd64.deb` `20230089620738c64516ecb012355da03e6ddae787419317e48e39d0916939ee`
  - `Pagelight_1.0.0-alpha.1_amd64.AppImage` `b05ae8f5aa623de37362dac026e3aa1d99bdb0b60dfb7bcc3e43d12f52f0a42a`
  - `SHA256SUMS.txt`
- 확인: 게시된 파일을 내려받아 `shasum -a 256 -c SHA256SUMS.txt` 3개 모두 OK. dmg `hdiutil verify` VALID, 번들 식별자 `com.ezenitac.easyviewer`, 버전 `1.0.0-alpha.1`, `codesign --verify --deep --strict` 통과. Windows 산출물·APK 0개. 릴리스 노트 끝에 Android 미포함 안내(한·영)가 붙음
- 서명 인증서 지문: 해당 없음(Android 미포함). Android는 서명 키(T062) 준비 후 릴리스부터 포함한다

