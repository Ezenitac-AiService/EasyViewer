# Contract: 릴리스의 테스트 빌드 처리

## 1. 작업 구조 (`release.yml`)

| 작업 | 의존 | 조건 | 실패 시 |
|---|---|---|---|
| `gate` | – | 항상 | 릴리스 전체 중단 |
| `build-macos` | `gate` | 항상 | 릴리스 전체 중단(게시 없음) |
| `build-linux` | `gate` | `needs.gate.outputs.linux == 'true'` | Linux만 빠짐 |
| `build-android` | `gate` | `needs.gate.outputs.android == 'true'` | Android만 빠짐 |
| `publish` | 위 전부 | `!cancelled() && needs.gate.result == 'success' && needs.build-macos.result == 'success'` | – |

- 최상위 권한 `contents: read`, `publish`만 `contents: write`.
- `continue-on-error` 금지.
- 리허설(`workflow_dispatch`)은 입력 `fail_linux`, `fail_android`(기본 false)로 해당 작업을 실제로 실패시켜 격리 동작을 확인할 수 있다. 태그 푸시에서는 이 입력이 없다.

## 2. 게이트 출력 판정 (`gate`, `--phase prebuild`)

| 출력 | true 조건 |
|---|---|
| `linux` | `release-exclusions.json`에 linux 항목이 없음 |
| `android` | 서명 키 비밀값 있음(또는 리허설) **그리고** exclusions에 android 항목 없음 |

연속 누락 검사(research R4): 최근 게시 릴리스 3개 연속으로 같은 플랫폼이 `build-failed` 또는 `security`로 빠졌다면 게이트가 실패한다(종료 코드 1, 메시지에 플랫폼과 릴리스 태그). 조회 실패는 BLOCKED(종료 코드 2).

## 3. 게시 단계

1. 산출물 수집 후 이름 변경: Linux·Android 파일의 확장자 앞에 `-test`를 붙인다.
2. 릴리스 노트 생성: `.github/release-notes.md` 뒤에 다음을 붙인다.
   - "테스트용 빌드" 절(한·영): 포함된 테스트 빌드 플랫폼, 미보장 범위, 테스트 빌드 이슈 양식 링크.
   - 빠진 플랫폼마다 안내 문장(한·영)과 `<!-- pagelight:omitted <platform>=<reason> -->`.
3. `SHA256SUMS.txt` 생성.
4. 게시 전 게이트(`--phase publish`):

| 검사 | 실패 조건 |
|---|---|
| 6 체크섬 | 체크섬에 없는 파일 |
| 7 Windows | Windows 산출물 존재 |
| 테스트 표식 | `.deb`·`.AppImage`·`.rpm`·`.apk` 중 이름이 `/-test(-rehearsal)?\.(deb|AppImage|rpm|apk)$/`에 맞지 않는 파일 |
| macOS 표식 금지 | `.dmg` 이름에 `-test` 포함 |
| 누락 안내 | 빌드 결과가 성공이 아닌 테스트 빌드 플랫폼에 대해 노트에 omitted 표식이 없음 |
| 보안 제외 | exclusions의 플랫폼 산출물이 존재 |
| Android 서명 | 키 없는 릴리스에 APK 존재(기존 `--without-android`) |

## 4. 게이트 명령 형태

```text
node scripts/check-release-gate.mjs --release --tag <t> --phase prebuild [--rehearsal]
node scripts/check-release-gate.mjs --release --tag <t> --phase publish --assets release-assets \
  --notes <렌더된 노트 파일> --linux-result <success|failure|skipped> --android-result <...> [--without-android]
```

`--without-android`는 유지하되, 게이트 출력 `android`에서 자동으로 정해진다.
