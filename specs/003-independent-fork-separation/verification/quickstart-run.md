# quickstart 실행 기록 (T092)

[quickstart.md](../quickstart.md) §1–§6, §9를 실행한 결과다. §7(Windows 전환)은 T048, §8(릴리스 리허설)은 T093에서 따로 기록한다. 실행하지 못한 단계는 `BLOCKED`로 둔다(헌법 제6원칙).

| 필드 | 내용 |
|---|---|
| 날짜 | 2026-11-19 |
| 환경 | macOS (Darwin 27.2), Apple Silicon, Node 24, rustc 1.100.0, cargo-deny·cargo-about 설치됨 |
| 대상 커밋 | `f769a84`(브랜치 `003-separation-records`, PR #3) |

## 요약

| 절 | 판정 | 비고 |
|---|---|---|
| §1 자동 게이트 | **PASS** | 로컬 전체 + PR #3 CI 6개 작업 |
| §2 저장소 상태 | **미완**(메인테이너 단계 대기) | 태그 미게시, `upstream` 원격 남음, 분리 전 |
| §3 데이터 이전 | macOS **부분 PASS**, Linux **BLOCKED** | `migration-macos.md`, `migration-linux.md` |
| §4 공존 설치 | **BLOCKED** | T077 미실행 |
| §5 Android 업데이트 연속성 | **BLOCKED** | 포크 release 키 없음(T062) |
| §6 지원 범위·문구 | 1–3 **PASS**, 4 **BLOCKED** | 4는 사람 검토(T090) |
| §9 보안 조율·사전 고지 | **PASS** | |

## §1 자동 게이트

| 명령 | 결과 |
|---|---|
| `npm run verify` | 통과. 빌드, vitest 274건, 경계, 버전, 라이선스 정책, 지원 범위, 앱 정체성, 워크플로 정적 규칙, `cargo check`, `cargo test` |
| `cd src-tauri && cargo deny check` | `advisories ok, bans ok, licenses ok, sources ok`. 중복 버전 경고는 있으나 실패 아님 |
| `node scripts/check-licenses.mjs` | 통과. 고지 생성물과 `THIRD_PARTY_LICENSES.md` 일치(cargo-about 사용) |
| `node scripts/check-identity.mjs` | 허용 목록 밖 원저작자 정체성 0건 |
| `npm run test:e2e` | 16건 통과(앱 정보 대화상자 시나리오 포함) |
| PR #3 `ci.yml` | 6개 작업 모두 통과(비밀값 없음, `windows-compile-test` 포함) |

판정: **PASS**

## §2 저장소 상태

| 확인 | 결과 | 기대 | 판정 |
|---|---|---|---|
| `git remote -v` | `origin`, `upstream` | `upstream` 없음 | 미완 — T094(메인테이너) |
| `git ls-remote --tags origin upstream-base-v0.1.6` | 결과 없음. 로컬 태그는 `44c4d37`을 가리키는 주석 태그 | 원격 태그가 `44c4d37` | 미완 — T011(메인테이너) |
| `gh api repos/Ezenitac-AiService/EasyViewer --jq .fork` | `true` | 분리 뒤 `false` | 분리 전 — T098 |

판정: 실패가 아니라 메인테이너 단계 대기. 해당 작업 후 다시 확인한다.

## §3 macOS·Linux 데이터 이전

- macOS: 실기기 시나리오 2·3·4·5·7·9 PASS, 1·6·8 BLOCKED. 세부는 `migration-macos.md`.
- Linux: 실기기 없음, `BLOCKED`. 세부는 `migration-linux.md`.

## §4 공존 설치

`BLOCKED`. 새 이름 빌드와 원저작자 최신 앱(`v0.2.2`)을 함께 설치하는 실측(T077)을 아직 하지 않았다. 필요한 환경: macOS·Linux 실기기, Android 기기.

## §5 Android 업데이트 연속성

`BLOCKED`. 포크 release 서명 키(T062)가 아직 없어 같은 키로 서명한 연속 빌드 두 개를 만들 수 없다. 필요한 환경: 서명 키, Android 기기, `apksigner`.

## §6 지원 범위·문구

1. README 첫 12줄에 영문 배너와 support-scope 블록이 있고, Windows 비지원 문장과 원저작자 링크가 보인다. **PASS**
2. `.github/ISSUE_TEMPLATE/bug_report.yml` 플랫폼 선택지는 macOS·iOS·Linux·Android뿐이고, `config.yml`의 Windows 안내 링크는 `https://github.com/edith2580/EasyViewer`다. **PASS**
   - GitHub 이슈 화면에서 직접 열어 보지는 않았다. 파일 내용과 `check-support-scope.mjs`로 확인했다.
3. 앱 정보 화면(`AboutDialog.vue`)은 README 블록과 같은 원문(`renderSupportScopeKo()`)을 그린다. e2e 시나리오가 대화상자에서 `macOS · iOS · Linux`, `GPL-3.0-only`, 서드파티 고지 표시를 확인한다. **PASS**
   - 대화상자 안의 저장소·원저작자 링크를 실제로 눌러 열어 보지는 않았다.
4. 헌법 "지원 플랫폼 등급"과 원문의 의미 비교는 사람 검토 항목이다(T090). **BLOCKED**

## §9 보안 조율·사전 고지

- `security-coordination.md` 통지 날짜 2026-11-18, 정정 통지 2026-11-19.
- 원저작자 앱 비교 문서(README "원저작자 앱과의 차이", `f769a84`)는 2026-11-19 커밋으로 통지보다 뒤다. 분리 공지는 아직 게시하지 않았다.
- `upstream-notice.md`에 고지 날짜(2026-11-18)와 이의 대응 결과(이의 없음)가 있다.

판정: **PASS**
