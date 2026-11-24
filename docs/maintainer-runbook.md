# 메인테이너 운영 절차

독립 포크 운영에 필요한 수동 절차를 모았습니다. 근거는 `specs/003-independent-fork-separation/`(spec FR-011·FR-013·FR-014·FR-025, research R10·R11)입니다.

## 1. 포크 네트워크 분리

**기본은 GitHub Support 요청입니다**(확정 결정 1). Support를 통한 분리는 이슈·PR 이력을 보존합니다.

1. 분리 게이트를 확인합니다. 통과하지 않으면 요청하지 않습니다.
   ```bash
   node scripts/check-release-gate.mjs --separation
   ```
2. 기존 Windows 프리릴리스에 지원 종료 고지를 먼저 게시합니다([문안](windows-eol-notice.md)). 분리 방식에 따라 릴리스가 사라질 수 있기 때문입니다.
3. 모든 릴리스 산출물과 노트를 백업합니다.
   ```bash
   mkdir -p ~/easyviewer-release-backup && cd ~/easyviewer-release-backup && gh release list -R Ezenitac-AiService/EasyViewer --limit 100 --json tagName --jq '.[].tagName' | while read -r t; do gh release download "$t" -R Ezenitac-AiService/EasyViewer -D "$t"; gh release view "$t" -R Ezenitac-AiService/EasyViewer --json body --jq .body > "$t/NOTES.md"; done
   ```
4. GitHub Support에 포크 네트워크 분리를 요청합니다. 요청 전에 실행 시점의 공식 문서 "[Detaching a fork](https://docs.github.com/en/pull-requests/how-tos/work-with-forks/detaching-a-fork)"를 다시 확인합니다.
   - GitHub Support 사이트의 가상 상담사(virtual agent)로도 요청할 수 있습니다. 형제 프로젝트 `Ezenitac-AiService/ImageViewer`가 이 경로로 분리되었고, 분리 뒤에도 릴리스를 게시할 수 있었습니다. 경로와 관계없이 1–3단계를 먼저 끝냅니다.
   - 개인 계정처럼 셀프서비스 지원만 받는 계정은, 저장소가 자체 분리 조건(공개·1 GB 미만·하위 포크 없음)을 만족하면 Support가 직접 분리하라고 답하고 티켓을 닫을 수 있습니다. 이 저장소도 2026-11-23 그렇게 안내받아 아래 자체 분리로 진행했습니다.
5. 완료되면 다음을 확인해 `specs/003-independent-fork-separation/verification/release-gate.md`에 기록합니다: `gh api repos/Ezenitac-AiService/EasyViewer --jq .fork`가 `false`, 릴리스와 지원 종료 고지 보존, 새 PR의 기본 대상, 코드 검색.

**설정의 "Leave fork network"(자체 분리)는 예외로만 씁니다.** 이 방식은 이슈·PR·스타·위키·감시자를 잃고 되돌릴 수 없으며, 릴리스 보존 여부가 문서에 없습니다. Support 요청이 지연·거절되었고, 위 2·3단계와 위키 백업을 마친 경우에만 씁니다.

### 분리가 지연·거절될 때

- **임시 운영**: PR을 만들 때 대상 저장소를 `Ezenitac-AiService/EasyViewer`의 `main`으로 직접 지정합니다(`gh pr create --repo Ezenitac-AiService/EasyViewer --base main`).
- **대안**: 새 저장소로 미러링합니다(`git clone --mirror` 후 새 원격에 `git push --mirror`). 이 경우 URL·스타·이슈가 이어지지 않으므로 README에 이전 안내를 남깁니다.

## 2. 업스트림 원격 제거

```bash
git remote remove upstream
```

```bash
git remote -v
```

결과를 `verification/release-gate.md`에 기록합니다. 기여자 쪽 감지·복구 절차는 [CONTRIBUTING.md](../CONTRIBUTING.md)의 "업스트림과의 관계"에 있습니다.

## 3. 비공개 취약점 신고 켜기

저장소 Settings → Security → "Private vulnerability reporting"을 켭니다. API로도 켤 수 있습니다.

```bash
gh api -X PUT repos/Ezenitac-AiService/EasyViewer/private-vulnerability-reporting
```

## 4. 원저작자와의 보안 조율

- 원저작자 저장소는 비공개 취약점 신고가 꺼져 있습니다(2026-11-17 확인). 공개 이슈·PR·토론에 결함 내용을 쓰지 않습니다.
- 공개 채널에는 "보안 관련으로 비공개 연락을 원한다"는 내용만 남겨 연락 경로를 받거나, 비공개 취약점 신고 기능을 켜 달라고 요청합니다.
- 연락 요청 후 30일 동안 응답이 없으면, 결함 내용을 쓰지 않은 "통지 시도 기록"으로 `verification/security-coordination.md`를 작성합니다. 원저작자 앱에 남은 결함에 관한 공개 문구는 계속 쓰지 않습니다.
- 미수정 결함 공개 기준: 통지 후 90일.

## 5. 정기 확인 (릴리스마다)

- 원저작자 저장소가 보관(archived)되었는지
- 원저작자 최신 릴리스에 Windows 산출물이 있는지
- 원저작자 앱의 데이터 형식 버전이 바뀌었는지

변화가 있으면 `src/config/supportScope.ts`의 Windows 문구와 [Windows 전환 안내](windows-migration.md)를 갱신하고 `node scripts/check-support-scope.mjs`로 확인합니다.

## 6. 테스트용 빌드 운영 (Linux·Android)

Linux·Android는 테스트용 빌드로만 배포합니다(헌법 v6.1.0). 릴리스 워크플로는 두 플랫폼 파일 이름에 `-test`를 붙이고, 릴리스 노트에 "테스트용 빌드" 절과 빠진 플랫폼마다 누락 안내(`<!-- pagelight:omitted <platform>=<reason> -->`)를 남깁니다. 테스트용 빌드 하나가 실패해도 macOS가 성공하면 릴리스는 게시됩니다.

### 보안상 제외 선언

테스트용 빌드에만 있는 취약점을 아직 고치지 못했다면 다음 순서로 그 플랫폼을 릴리스에서 뺍니다.

1. `.github/release-exclusions.json`에 항목을 추가하는 PR을 엽니다. 형식은 `{ "platform": "linux" | "android", "advisory": "<비공개 식별자>", "since": "YYYY-MM-DD" }`입니다. macOS·iOS는 이 방식으로 뺄 수 없고, 결함 세부는 적지 않습니다.
2. 병합하면 다음 릴리스부터 게이트가 그 플랫폼 빌드를 건너뛰고, 릴리스 노트에 `security` 누락 안내가 붙습니다.
3. 이미 게시된 이전 릴리스에 그 플랫폼 산출물이 있으면, 해당 릴리스 노트에 미수정 취약점 안내를 덧붙입니다(`gh release edit <tag> --notes-file <file>`). 공개 행위이므로 메인테이너가 승인한 뒤에 하고, 결함 세부는 적지 않습니다.
4. 고친 릴리스를 낼 때 항목을 지우는 PR을 엽니다.

### 연속 누락으로 게이트가 멈췄을 때

같은 테스트용 빌드 플랫폼이 3회 연속 빠지면(빌드 실패나 보안상 제외. Android 서명 키 미등록은 세지 않음) 네 번째 릴리스의 게이트가 빌드 전에 멈춥니다. 다음 중 하나를 별도 변경으로 결정합니다.

- 그 플랫폼의 빌드를 고칩니다. 고친 뒤 리허설로 해당 빌드가 성공하는지 확인하고 릴리스합니다.
- 그 플랫폼을 지원 범위에서 뺍니다. 헌법 개정 절차(메인테이너 명시 승인과 PR)를 따르고 `src/config/supportScope.ts`와 공개 문서를 함께 고칩니다.

게이트를 우회하려고 이전 릴리스 노트의 누락 안내를 지우지 않습니다.

### 리허설로 실패 격리 확인

`workflow_dispatch`에서 `rehearsal=true`와 함께 `fail_linux` 또는 `fail_android`를 켜면 해당 빌드를 일부러 실패시켜, 그 플랫폼만 빠지고 초안 릴리스가 만들어지는지 확인할 수 있습니다. 두 입력은 리허설에서만 쓸 수 있습니다.
