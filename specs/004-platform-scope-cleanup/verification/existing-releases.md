# 기존 릴리스·보존 기록 확인 (T050, 2026-11-24)

| 항목 | 결과 |
|---|---|
| `v0.1.6-alpha` | 산출물 6개, 지원 종료 고지 있음, 고지에 `docs/windows-migration.md` 링크 있음 |
| `v0.1.6-beta` | 산출물 6개, 지원 종료 고지 있음, 고지에 `docs/windows-migration.md` 링크 있음 |
| 링크 대상 | `https://github.com/Ezenitac-AiService/EasyViewer/blob/main/docs/windows-migration.md` — 파일은 지우지 않고 보존. 2026-11-24 PR #19 병합 후 확인: `main`의 두 문서 맨 위에 보존 기록 표시가 있고, 지원 종료 고지의 링크가 열린다(HTTP 200) |
| `CHANGELOG.md`·`CHANGELOG.en.md` | Windows 배포·지원 종료 항목과 각 프리릴리스의 "2026-11-17부로 지원 종료" 문장이 그대로 있음 |

판정: **PASS**.

## `v1.0.0-alpha.1` 노트 보강 (T049, 2026-11-24, 메인테이너 승인 후)

- 편집 전 노트와 산출물 목록(이름·크기·SHA-256 다이제스트)을 메인테이너 로컬 백업 폴더에 보관한 뒤 `gh release edit --notes-file`로 노트 끝에 다음을 덧붙였다.
  - "테스트용 빌드 안내 / Test builds" 절(한·영): 이 릴리스의 Linux `.deb`·`.AppImage`는 테스트용 빌드이며, `-test` 규칙 이전에 게시되어 이름에 표시가 없다는 설명, 미보장 범위, 테스트 빌드 버그 양식 링크.
  - `<!-- pagelight:omitted android=no-signing-key -->`
- 기존 본문과 Android 안내 문장은 그대로 두었다. 결함 세부·보안 관련 내용은 없다.
- 편집 후 확인: 산출물 4개(`amd64.AppImage`, `amd64.deb`, `universal.dmg`, `SHA256SUMS.txt`)의 이름·크기·다이제스트가 편집 전과 같다. 게시 상태(프리릴리스, 초안 아님)도 같다.
- 게이트의 연속 누락 계산(실제 릴리스 이력): Linux 0, Android 0.

판정: **PASS**.

