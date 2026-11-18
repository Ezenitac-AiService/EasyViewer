# 검증 가이드: 독립 포크 분리

**목적**: 구현이 끝났을 때 명세의 성공 기준(SC-001–SC-010)을 끝까지 확인하는 실행 절차다. 세부 규칙은 [contracts/](contracts/)와 [data-model.md](data-model.md)를 따른다. 실행하지 못한 단계는 통과로 보지 않고 `BLOCKED`로 기록한다(헌법 제6원칙).

## 준비

- macOS(Apple Silicon 또는 Intel) 1대, Linux(Ubuntu 22.04 이상) 1대, Windows 10/11 1대, Android 기기 1대
- Node 24, Rust stable, `cargo-deny`
- 원저작자 최신 릴리스 산출물(게시 시점 최신, 2026-11-17 기준 `v0.2.1`)
- 구 식별자 포크 빌드(`v0.1.6-beta` 산출물)와 새 빌드

## 1. 자동 게이트 (SC-001, SC-002, SC-004 일부, SC-010)

```bash
npm ci
```

```bash
npm run verify
```

```bash
cd src-tauri && cargo deny check
```

```bash
node scripts/check-licenses.mjs
```

`check-licenses.mjs`는 `cargo-about`가 있어야 고지 생성물(`src/generated/third-party-notices.txt`)을 검사할 수 있다. 없으면 `BLOCKED`로 기록한다.

**기대 결과**
- 모든 단계가 통과한다(빌드, 단위 테스트, 경계, 버전·식별자, 지원 범위 원문, 라이선스 고지 일치, `cargo check`, `cargo test`).
- `check-identity.mjs`가 허용 목록 밖에서 `com.edith.easyviewer`·원저작자 이름을 0건 보고한다.
- `check-licenses.mjs`가 위반 0건을 보고하고, `THIRD_PARTY_LICENSES.md`와 정보 화면 데이터가 일치한다.

PR을 하나 열어 `ci.yml`의 6개 작업이 비밀값 없이 통과하는지 확인한다. `windows-compile-test`도 포함된다.

## 2. 저장소 상태 (SC-003)

```bash
git remote -v
```

```bash
git ls-remote --tags origin upstream-base-v0.1.6
```

```bash
gh api repos/Ezenitac-AiService/EasyViewer --jq '.fork'
```

**기대 결과**
- `upstream` 원격이 없다.
- 태그는 `44c4d37...`을 가리킨다.
- 분리 완료 뒤 `.fork`는 `false`다.
- 새 PR의 기본 대상이 `Ezenitac-AiService/EasyViewer:main`이고, 저장소 코드 검색 결과가 나온다.

## 3. macOS·Linux 데이터 이전 (SC-006)

[data-migration.md](contracts/data-migration.md)의 상태별로 실행한다.

1. 구 식별자 빌드를 설치한다. 책 3권(EPUB 2, TXT 1)을 가져오고, 진행률·책갈피·표시 설정을 바꾸고, WebDAV 연결 1개를 비밀번호 저장으로 만든다.
2. 새 빌드를 설치해 실행한다.
   - 기대: 서재·진행률·책갈피·설정이 그대로이고, WebDAV 연결은 비밀번호 재입력 없이 동작한다(macOS는 키체인 허용 대화상자를 허용).
   - 구 폴더가 그대로 있다.
3. 새 앱을 다시 실행한다.
   - 기대: 이전을 다시 하지 않고, 데이터가 중복되지 않는다.
4. 새 폴더를 지우고, 구 폴더에 다른 폴더를 가리키는 심볼릭 링크와 0바이트 손상 EPUB을 넣은 뒤 실행한다.
   - 기대: 크래시가 없고, 링크는 건너뛰며, 손상 파일은 기존 오류 안내로 처리된다.
5. 새 폴더 쓰기 권한을 빼고 실행한다.
   - 기대: 앱은 빈 상태로 열리고 이전 실패 안내와 수동 복구 방법이 보인다.
6. 새 폴더를 지우고 원저작자 앱(또는 구 포크 앱)을 실행해 둔 채 새 앱을 실행한다.
   - 기대: **메인 창이 뜨지 않고** 네이티브 대화상자가 [다시 시도]/[이번엔 건너뛰기]/[종료]를 묻는다. 새 식별자 위치(`~/Library/WebKit/com.ezenitac.easyviewer`, `~/.local/share/com.ezenitac.easyviewer`)에 저장소가 생기지 않는다.
   - [종료]를 고른 뒤 구 앱을 끄고 다시 실행하면 이전된다.
   - 다시 처음부터 해서 [이번엔 건너뛰기]를 고르면 빈 서재로 시작하고 `declined` 안내가 나오며, 다음 실행에서 다시 묻지 않는다.
   - 복사가 5초를 넘는 큰 서재로 반복하면 진행 창이 뜨고, 진행 창 때문에 새 식별자 위치에 저장소가 생기지 않는다.
7. 새 폴더를 지우고 새 앱을 빠르게 두 번 실행한다.
   - 기대: 두 번째 실행은 첫 인스턴스로 초점만 넘기고, 이전은 한 번만 일어난다.
8. macOS에서 WebDAV 연결 2개로 시나리오 2를 반복하며 자격증명 이전 안내에서 [건너뛰고 나중에 재입력]을 고른다.
   - 기대: 키체인 허용 창이 뜨지 않고, 두 연결에 재입력 안내가 나온다.
9. 이전 안내에서 "이전 결과 버리기"를 고른다.
   - 기대: 앱이 재시작되고, 창이 뜨기 전에 새 폴더가 비워져 빈 서재로 시작한다. 다음 실행에서 다시 묻지 않는다. 구 폴더는 그대로다.
10. 결과를 `verification/migration-macos.md`, `verification/migration-linux.md`에 기록한다.

## 4. 공존 설치 (SC-007)

1. 원저작자 최신 앱이 설치된 macOS·Linux·Android에 새 포크 앱을 설치한다.
2. 두 앱을 번갈아 실행한다.
3. **기대 결과**
   - 덮어쓰기·설치 실패가 0건이다.
   - 이름이 서로 다르게 표시된다.
   - 한쪽 서재가 다른 쪽에 보이지 않는다.
   - Linux 패키지 관리자에서 두 패키지가 따로 나타난다.

## 5. Android 업데이트 연속성 (SC-008)

첫 독립 릴리스는 `applicationId`가 새로 바뀌므로, 구 포크 APK 위에 업데이트로 설치되지 않는 것이 정상이다. 연속성은 **같은 포크 키로 서명한 연속 빌드 두 개**로 검증한다.

1. 포크 release 키로 `versionCode`만 다른 빌드 두 개를 만든다. 예: 첫 독립 릴리스 후보(`1.0.0-alpha.1`)와 같은 커밋에서 `versionCode`를 1 올린 확인용 빌드.
2. 두 APK의 인증서를 비교한다.

```bash
apksigner verify --print-certs <빌드 A>.apk
```

```bash
apksigner verify --print-certs <빌드 B>.apk
```

3. 기기에 A를 설치하고 데이터를 만든 뒤 B를 `adb install -r`로 덮어 설치한다.
4. 정식으로 두 번째 독립 릴리스가 나오면 같은 절차를 실제 릴리스 두 개로 반복해 기록을 갱신한다.

**기대 결과**
- 두 인증서 지문이 같고, `verification/release-gate.md` 항목 8의 지문과도 같다.
- B가 업데이트로 설치되고 A의 데이터가 유지된다.
- `docs/android-signing.md`에 백업 2곳과 분실 대응이 적혀 있다.

## 6. 지원 범위·문구 (SC-004)

1. README 첫 화면에서 Windows 비지원 문장과 원저작자 링크가 바로 보이는지 확인한다.
2. 이슈 새로 만들기에서 플랫폼 선택지가 macOS·iOS·Linux·Android뿐이고, Windows 안내 링크가 원저작자 저장소로 가는지 확인한다.
3. 앱 정보 화면의 지원 범위 문구가 README 블록과 같은지 확인한다. 저장소·원저작자 링크가 열리는지도 본다.
4. 헌법 "지원 플랫폼 등급"과 원문의 의미가 같은지 사람이 검토한다.

## 7. Windows 전환 (SC-005)

1. Windows에 포크 `v0.1.6-beta`를 설치하고 책 2권과 진행률을 만든다.
2. `docs/windows-migration.md` 절차를 그대로 따라 원저작자 최신 앱으로 옮긴다.
3. **기대 결과**
   - 원저작자 앱이 정상 실행된다.
   - 백업한 책을 다시 가져올 수 있다.
   - 문서에 적은 손실 항목(진행률·책갈피·표시 설정·WebDAV 자격증명)이 실제 결과와 같다.
4. 3단계(데이터 폴더 이름 바꾸기)를 건너뛴 경우의 증상도 확인해 문서와 대조한다.
5. 결과를 `verification/windows-migration.md`에 기록한다. Windows 실기기가 없으면 `BLOCKED`로 기록한다.

## 8. 릴리스 리허설 (SC-003, SC-004, FR-025)

1. 태그 없이 리허설 모드로 `release.yml`을 실행한다([release-and-ci.md](contracts/release-and-ci.md) §2 리허설 모드).

```bash
gh workflow run release.yml -f rehearsal=true -f tag_name=v1.0.0-alpha.1-rehearsal
```

2. **기대 결과**
   - `gate` 작업이 FR-025 항목을 보고한다. 아직 채우지 않은 수동 항목(1–3·8)은 **경고**로 나오고, 자동 항목(4–7, 버전 비중복)은 실제로 검사된다.
   - 빌드가 끝까지 진행되고 `[REHEARSAL]` 제목의 초안 릴리스가 만들어진다. 확인이 끝나면 초안을 지운다.
   - 산출물에 `.exe`·`.msi`·Windows `.zip`이 없다.
   - `SHA256SUMS.txt`가 모든 파일을 덮는다.
   - 제목과 파일 이름이 새 표시명으로 시작한다.
3. 체크섬 검증 절차(릴리스 노트 안내)를 그대로 실행해 통과하는지 확인한다.

## 9. 보안 조율·사전 고지 (SC-009)

- `verification/security-coordination.md`의 통지 날짜가 비교 문서·분리 공지 커밋 날짜보다 앞서는지 확인한다.
- `verification/upstream-notice.md`에 고지 날짜와 이의 대응 결과가 있는지 확인한다.
