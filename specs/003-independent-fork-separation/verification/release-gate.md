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
직전 포크 릴리스 versionCode: 1006

## 업스트림 원격 제거 기록 (T094)

`git remote -v` 결과 (2026-11-19, 메인테이너가 `git remote remove upstream` 실행 후):

```text
origin	https://github.com/Ezenitac-AiService/EasyViewer.git (fetch)
origin	https://github.com/Ezenitac-AiService/EasyViewer.git (push)
```

## 분리 요청·결과 기록 (T097, T098)

- 지원 종료 고지 게시:
- 릴리스 산출물·노트 백업 위치:
- GitHub Support 요청일:
- 분리 완료 확인(`.fork == false`, 릴리스·고지 보존, PR 기본 대상, 코드 검색):
