# Phase 0 리서치: 독립 포크 분리

**작성일**: 2026-11-17 | **명세**: [spec.md](spec.md) | **계획**: [plan.md](plan.md)

헌법 제4원칙에 따라 내부 사실은 직접 확인한 파일·심볼·명령 출력으로, 외부 판단은 공식 문서·소스로 근거를 단다. 아직 실측하지 못한 항목은 **스파이크(S#)**로 표시하고 결론을 확정하지 않는다(제6원칙: 미검증을 통과로 보지 않음).

## 사실 확인 (2026-11-17 실측)

| # | 사실 | 근거 |
|---|---|---|
| F1 | 원격: `origin` = 포크, `upstream` = `edith2580/EasyViewer`(fetch·push 모두 설정) | `git remote -v` |
| F2 | 저장소는 여전히 포크(`fork: true`, parent `edith2580/EasyViewer`) | `gh api repos/Ezenitac-AiService/EasyViewer` |
| F3 | 업스트림은 입력 문서 작성 뒤 **`v0.2.1`(2026-11-17 05:25 UTC)**까지 릴리스했다. 업스트림이 이미 쓴 버전: `0.1.0`–`0.1.6`, `0.2.0`, `0.2.1` | `gh api repos/edith2580/EasyViewer/releases` |
| F4 | 업스트림 `44c4d37..v0.2.1` 커밋: `eaf6471`(UNC 경로), `f80c33a`(Android WebDAV), `40c4605`(릴리스). `v0.2.1`도 식별자 `com.edith.easyviewer`, 제품명 `EasyViewer`, `DB_VERSION = 1` | `gh api .../compare`, `contents/...?ref=v0.2.1` |
| F5 | 포크 앱 내부 DB: `IDB_NAME = 'EasyViewerDB'`, `IDB_VERSION = 2` | `src/services/storage/idbClient.ts:1-2` |
| F6 | 설정·진행률·책갈피·서재 메타데이터는 **WebView 저장소**(IndexedDB `key_value` + `localStorage` `easyviewer:*` 키)에 있다. 데스크톱 파일 저장소 플러그인(`plugin-store`)은 프론트엔드에서 쓰지 않는다 | `src/services/storage/platformAdapter.ts:272-308`, `grep plugin-store src` 결과 없음 |
| F7 | 서재 파일 기본 위치 = `appDataDir()/books`, 사용자 지정 폴더는 `setStorageDir` | `platformAdapter.ts:113-127` |
| F8 | Linux·Windows에서 Tauri는 WebView 데이터 폴더를 `app_local_data_dir()`(식별자 종속)로 강제한다 | `tauri-2.12.5/src/manager/webview.rs:559-570`, `wry-0.57.1/src/webkitgtk/web_context.rs:32-47` |
| F9 | macOS에서 wry는 `data_store_identifier`가 없으면 `WKWebsiteDataStore::defaultDataStore`를 쓴다 | `wry-0.57.1/src/wkwebview/mod.rs:268-290` |
| F10 | 설정 파일에 선언된 창은 사용자 `setup` 훅 **이전에** 만들어진다 | `tauri-2.12.5/src/app.rs:2688-2699` |
| F11 | 키체인 서비스명 기본값 = 앱 식별자. `KeyringStore::new(service)`와 `get_password`·`set_password`가 공개 API다 | `tauri-plugin-keyring-store-0.3.2/src/lib.rs:70,116,155`, `store.rs:125,213,225` |
| F12 | 자격증명 계정 키 = `easyviewer:webdav:<connectionId>` | `src/services/platform/credentialService.ts:22-24` |
| F13 | Android: `namespace`·`applicationId` = `com.edith.easyviewer`, release 빌드가 `signingConfigs.getByName("debug")` | `src-tauri/gen/android/app/build.gradle.kts:19,22,42` |
| F14 | Apple: `bundleIdPrefix`·`PRODUCT_BUNDLE_IDENTIFIER` = `com.edith.easyviewer`, `DEVELOPMENT_TEAM: GMXNVH8YU9`(`project.yml:73`, `tauri.conf.json` `bundle.iOS.developmentTeam`) | 파일 직접 확인 |
| F15 | `ios:install` 스크립트에 기기 UDID가 하드코딩됨 | `package.json` `scripts.ios:install` |
| F16 | `check-version-sync.mjs`의 `EXPECTED_APP_ID = 'com.edith.easyviewer'`, 구 디렉터리 차단 대상은 `com/easyviewer` | `scripts/check-version-sync.mjs` |
| F17 | 릴리스: `release.yml` 매트릭스에 `windows-x64`(NSIS·MSI·포터블 ZIP), publish 단계가 `*.exe *.msi *.zip`을 수집, 제목 `EasyViewer $TAG`, 체크섬 없음 | `.github/workflows/release.yml` |
| F18 | PR 검증은 `build-apple.yml`(macOS 빌드 + iOS 시뮬레이터 빌드 `continue-on-error: true`)뿐. Linux·Windows PR 검증과 라이선스 감사는 없음 | `.github/workflows/build-apple.yml` |
| F19 | `package.json`·`Cargo.toml`에 `license` 필드 없음, `authors = ["EasyViewer Team"]` | 파일 직접 확인 |
| F20 | 외부 URL을 여는 코드는 없다(`openPath`만 사용). 따라서 "링크 허용 범위 규칙"은 새로 정의해야 한다 | `grep openUrl src` 결과 없음, `capabilities/desktop.json` |
| F21 | `ezenitac.com`에는 A·NS 레코드가 없다 | `dig +short ezenitac.com A/NS` 빈 결과 |
| F22 | 이 체크아웃은 `main` 브랜치에 있다. 기능 브랜치 `003-independent-fork-separation`은 아직 없다 | `git branch --show-current` |
| F23 | 로컬에 `cargo-deny`가 설치되어 있다 | `which cargo-deny` |
| F24 | macOS WebKit 기본 저장소 실제 경로 = `~/Library/WebKit/com.edith.easyviewer/WebsiteData/`. 하위에 `Default/salt`, `Default/<해시>/`, `IndexedDB/`, `LocalStorage/`, SQLite `-wal`/`-shm` 파일이 있다. 캐시는 `~/Library/Caches/com.edith.easyviewer`(이전 대상 아님) | 이 Mac에서 `find ~/Library/WebKit/com.edith.easyviewer -maxdepth 4` |
| F25 | 구 식별자 폴더는 **포크 구버전과 원저작자 앱이 함께 쓰는 위치**다(F4: 원저작자도 같은 식별자) | F4, F8, F24 |
| F26 | macOS 키체인 백엔드는 **레거시 키체인**(`apple_native_keyring_store::keychain::Store`)이다. iOS는 보호 데이터 저장소 | `tauri-plugin-keyring-store-0.3.2/src/backend.rs:54-67` |
| F27 | 프론트엔드 런타임 패키지(전이 포함)는 68개, 라이선스 표기 누락 0개. 실제 라이선스 식: `MIT`, `Apache-2.0`, `Apache-2.0 OR MIT`, `MIT OR Apache-2.0`, `ISC`, `BSD-2-Clause`, `BSD-3-Clause`, `CC0-1.0`, `(MIT AND Zlib)`, `(MIT OR GPL-3.0-or-later)` | `package-lock.json` 비개발 항목 집계 |
| F28 | 앱에 링크되는 Rust 크레이트는 macOS 대상 300개, Linux 대상 383개다. 현재 `THIRD_PARTY_LICENSES.md` 표는 약 50행(직접 의존성 위주) | `cargo tree -e normal --prefix none --target …` 중복 제거 |
| F29 | opener URL 권한은 원문 URL 문자열에 대한 glob 일치다. `*`는 `/`도 포함한다 | `tauri-plugin-opener-2.7.3/src/scope.rs:19-40,80-84` |
| F30 | Android `versionCode`를 따로 지정하지 않으면 `major*1000000 + minor*1000 + patch`로 계산하며 프리릴리스 부분은 무시한다. `bundle.android.versionCode`·`autoIncrementVersionCode` 설정이 있다 | `tauri-utils` `config.rs:3662-3675` |
| F31 | 원저작자 저장소의 비공개 취약점 신고는 **꺼져 있다** | `gh api repos/edith2580/EasyViewer/private-vulnerability-reporting` → `{"enabled":false}` |
| F32 | 포크 저장소: 공개, 136 MB, 하위 포크 0, 스타 0, 열린 이슈 0, 위키 사용 | `gh api repos/Ezenitac-AiService/EasyViewer` |
| F33 | GitHub는 이제 저장소 설정 Danger Zone의 **Leave fork network**로 직접 분리할 수 있다(공개·1 GB 미만·하위 포크 없음 조건). 이 방식은 이슈·PR·스타·위키·감시자를 **잃고 되돌릴 수 없으며**, 릴리스 보존 여부는 문서에 없다. GitHub Support를 통한 분리는 이슈·PR 이력을 보존한다 | [GitHub Docs — Detaching a fork](https://docs.github.com/en/pull-requests/how-tos/work-with-forks/detaching-a-fork) (2026-11-17 조회) |
| F34 | GitHub Actions의 Node 20 런타임이 2026년에 폐지된다. JavaScript 액션은 Node 24 대응 메이저(예: `actions/checkout` v6)로 올려야 한다 | [GitHub Changelog — Deprecation of Node 20](https://github.blog/changelog/2026-09-23-deprecation-of-node-20-on-github-actions-runners/) |

## R1. 데스크톱 데이터 마이그레이션 방식 (FR-018, US6)

- **Decision**: 새 식별자 앱의 Rust 시작 단계에서, **메인 창을 만들기 전에** 구 식별자 폴더를 새 식별자 폴더로 **복사**한다.
  - 메인 창은 설정 파일에서 `"create": false`로 바꾸고 `setup` 훅에서 마이그레이션 뒤에 만든다(F10 때문에 필수).
  - 복사 대상:
    - Linux: `~/.local/share/com.edith.easyviewer/` 전체(서재 `books/`와 WebView 데이터가 같은 폴더, F7·F8). 단, WebKit 캐시 하위 폴더는 제외한다(wry가 캐시 폴더도 같은 위치로 지정함, `web_context.rs:38`)
    - macOS: `~/Library/Application Support/com.edith.easyviewer/`(서재)와 `~/Library/WebKit/com.edith.easyviewer/WebsiteData/`(F24, `Default/salt` 포함). `~/Library/Caches/com.edith.easyviewer`는 캐시라 제외한다
  - 조건: 구 폴더가 있고 새 폴더가 "비어 있을" 때만. 새 폴더에 데이터가 있으면 아무것도 하지 않는다(멱등). "비어 있음"의 정의는 [contracts/data-migration.md](contracts/data-migration.md) §1에 둔다.
  - **불변식**: 이전 결정이 끝나기 전에는 영속 WebView(메인 창)를 만들지 않는다. 메인 창이 뜨는 순간 새 식별자 위치에 WebKit 저장소가 생겨(F8·F9, Tauri `webview.rs:559-576`) 다음 실행부터 이전 기회가 사라지기 때문이다. 아래 모든 흐름이 이 불변식을 따른다. 전체 흐름도는 [contracts/data-migration.md](contracts/data-migration.md) §1에 있다.
  - **동시 실행 방지**(F25):
    - 단일 인스턴스를 보장한다(공식 플러그인 `tauri-plugin-single-instance`, 새 런타임 의존성).
    - OS 런타임·임시 폴더의 전용 잠금 파일을 잡은 인스턴스만 이전한다.
    - 구 폴더를 쓰는 앱(포크 구버전 또는 원저작자 앱)이 실행 중이면 SQLite WAL이 어긋날 수 있다. 그래서 **메인 창을 만들지 않고** 네이티브 대화상자로 [다시 시도]/[이번엔 건너뛰기(`declined`)]/[종료]를 묻는다. 감지는 macOS `lsappinfo`, Linux `/proc/*/exe`로 하며 새 의존성이 없다.
    - `-wal`·`-shm` 파일은 본 DB 파일과 한 묶음으로 복사하고, 복사 전후 변경 감지(`busy`)는 보조 방어선으로 둔다.
  - **진행 표시**:
    - `setup` 훅은 복사를 백그라운드 스레드로 넘기고 바로 반환한다. 동기로 실행하면 이벤트 루프가 멈춰 어떤 창도 그려지지 않는다.
    - 복사가 5초를 넘으면 진행 창을 `incognito(true)`와 OS 임시 폴더 `data_directory`로 띄운다(Tauri `webview_window.rs:1089,1119`). 이렇게 하면 새 식별자 위치에 저장소를 만들지 않는다.
    - 메인 창은 복사와 기록이 끝난 뒤 만든다.
  - **출처 혼재**(F25): 구 폴더 데이터가 원저작자 앱이 만든 것일 수도 있다. 복사만 하고 원본은 건드리지 않으며, 안내에서 이 사실을 밝히고 "이전 결과 버리기"를 제공한다.
    - 실행 중에는 WebView가 저장소를 열고 있으므로, 버리기를 고르면 `discard_pending`을 기록하고 재시작한다.
    - 다음 시작 때 창을 만들기 전에 비우고 `discarded`로 바꾼다.
  - 방식: 임시 폴더에 복사 → 검증 → 원자적 이름 변경. 원본은 지우지 않는다. 결과는 새 폴더의 마이그레이션 기록 파일에 남긴다([data-model.md](data-model.md) `MigrationRecord`).
  - 경계 규칙: 심볼릭 링크는 따라가지 않고 건너뛰며, 모든 경로를 정규화해 구 루트 밖으로 나가지 않는지 확인한다(기존 `security/path_guard.rs` 재사용).
  - 실패하면 기록만 남기고 앱은 빈 상태로 시작하며, 프론트엔드가 기록을 읽어 안내한다.
- **대체 경로(폴백)**: 복사 후에도 WebView 저장소를 새 앱이 읽지 못하면(서재 파일은 있는데 IndexedDB가 비어 있음), 복사된 `books/`를 기존 가져오기 경로로 다시 등록해 서재를 재구성하고, 잃는 항목(진행률·책갈피·표시 설정)을 안내한다.
- **Rationale**:
  - WebKit 내부 IndexedDB 파일 형식(SQLite + 직렬화 값)을 직접 해석하는 것은 비현실적이다.
  - 폴더 통째 복사는 출처(origin)가 `tauri://localhost`로 같으므로 WebKit이 그대로 읽을 가능성이 높다.
  - 창 생성 전 단계라 잠금 충돌도 없다.
- **Alternatives considered**:
  - 구 식별자 "브리지 릴리스"가 내보내기 파일을 만드는 방식: 사용자가 브리지를 먼저 실행해야 하고, 구 식별자로 또 배포해야 하므로 기각.
  - 마이그레이션 없이 재구성만 하는 방식: FR-018(데이터 손실 최소화)을 어기므로 폴백으로만 둠.
  - 원본 이동(move): "원본 보존"(US6-1)을 어기므로 기각.
- **스파이크 S1**(구현 전 필수): macOS·Linux 각각 구 식별자 빌드로 데이터를 만든 뒤, 새 식별자 빌드에서 복사한 IndexedDB·`localStorage`가 실제로 읽히는지 확인한다. 경로와 salt 파일 존재는 F24로 확인했으므로, 여기서는 "복사 후 읽기"와 다음을 잰다.
  - 대용량 서재 복사 시간과 APFS 복제 여부. 성능 목표 "1 GB 30초"는 **근거 없는 가정**이므로 이 측정값으로 바꾼다.
  - 원저작자 앱이 실행 중일 때 복사한 경우의 결과
  - macOS에서 다른 앱의 `~/Library/WebKit` 폴더를 읽을 때 개인정보 보호 권한 창이 뜨는지
  - 실패하면 폴백을 기본 경로로 올리고 plan을 갱신한다.

## R2. 자격증명 이전 (FR-018, US6-4)

- **Decision**: Rust 명령 `migrate_legacy_credentials(account_ids)`를 추가한다.
  - `KeyringStore::new("com.edith.easyviewer")`로 구 항목을 읽어 현재 플러그인 저장소(새 식별자 서비스)에 쓴다(F11).
  - 프론트엔드는 R1 이후 서재가 열린 뒤 WebDAV 연결 목록에서 계정 키(F12)를 만들어 한 번 호출한다.
  - 구 항목은 지우지 않는다(원본 보존). 하지만 앱은 다시 읽지 않는다(서비스명 공유 금지, 확정 결정 8).
  - 반환값에는 성공·누락·실패 개수만 담고 비밀값은 담지 않는다.
- **Rationale**: 플러그인 공개 API만으로 가능하고 평문이 IPC 경계를 넘지 않는다.
- **Alternatives considered**: 구 서비스명으로 고정(`.service("com.edith.easyviewer")`) — 원저작자 앱과 키체인을 공유하므로 기각(D4).
- **macOS 사실**(F26): 레거시 키체인 항목은 만든 앱의 코드 서명으로 접근 목록이 정해진다. ad-hoc 서명은 빌드마다 달라지므로, 새 앱이 구 항목을 읽으면 **항목마다** 로그인 암호를 묻는 허용 창이 뜰 것으로 예상한다. 연결이 N개면 최대 N번이다.
  - 그래서 이전 전에 "N개 연결의 비밀번호를 옮기려면 macOS가 N번 암호를 물을 수 있음" 안내와 **"건너뛰고 나중에 재입력"** 선택지를 둔다.
- **스파이크 S2**: 위 예상(항목별 창, 거부 시 오류 종류)을 실측한다. Linux Secret Service는 접근 목록이 없으므로 잠김(locked) 상태에서의 동작만 확인한다.

## R3. Windows 전환 절차 (FR-010, US4, SC-005)

- **Decision**: 문서 `docs/windows-migration.md`에 다음 순서로 안내한다.
  1. `%APPDATA%\com.edith.easyviewer\books` 백업
  2. 포크 앱 제거
  3. `%LOCALAPPDATA%\com.edith.easyviewer` 이름 바꾸기(WebView2 데이터, F8)
  4. 원저작자 최신 앱 설치
  5. 백업한 책 파일 다시 가져오기
  - 손실 항목: 읽기 진행률, 책갈피, 표시 설정, WebDAV 자격증명(재입력).
  - 원저작자 앱은 같은 식별자를 쓰므로(F4) 3단계를 건너뛰면 버전 1 앱이 버전 2 DB를 열다 실패한다. 그 증상과 복구 방법도 적는다.
- **검증**: 실제 Windows 10/11에서 원저작자 최신 릴리스(현재 `v0.2.1`)로 끝까지 수행하고, 기록을 `specs/003-independent-fork-separation/verification/windows-migration.md`에 남긴다. 실기기가 없으면 `BLOCKED`로 보고한다.
- **Alternatives considered**: 내보내기 기능 — 확정 결정 7로 범위 외.

## R4. 제품 표시명·설치 이름 (FR-016, FR-024, 확정 결정 13)

- **결정(2026-11-17)**: 표시명 **Pagelight**, 패키지 이름 `pagelight`, Rust 라이브러리 이름 `pagelight_lib`.
  - 비중복 확인: 원저작자 `v0.2.1` 산출물(`EasyViewer_*`, `EasyViewer-*.rpm`)·패키지 이름(`easy-viewer`)과 겹치지 않는다. 웹 검색(2026-11-17)에서 같은 이름의 리더 앱을 찾지 못했다. 앱스토어 전수·상표 조사는 아니다.
  - 기각한 후보: `Leafer`(같은 이름의 JS 캔버스 라이브러리와 검색 혼동), `Ezen Reader`(`EZ Viewer`·`EZView` 등 유사 이름 다수), `EasyViewer ○○`(구분 목적에 어긋나고 `EasyViewer Plus` iOS 앱이 이미 있음).
  - 아이콘: 이 포크가 직접 그린 원본(`src-tauri/icons/source/pagelight.svg`, 1024px 렌더 `pagelight-1024.png`). 원저작자 아이콘(보라 바탕 펼친 책)과 색·모양이 다르다.
- **Decision**: 새 표시명은 위 결정값이다. 이름이 정해지면 다음을 모두 같은 이름 계열로 바꾼다.
  - `tauri.conf.json` `productName`·창 제목
  - Cargo 패키지·바이너리 이름(Linux deb·rpm 패키지 이름과 실행 파일 이름에 쓰임)
  - npm `name`
  - Apple `PRODUCT_NAME`, Android `app_name`
  - 릴리스 산출물 이름·제목
  - 새 검사 스크립트가 원저작자 이름(`EasyViewer`, `easy-viewer`)이 이 위치들에 남아 있으면 실패하게 한다. 예외는 출처 고지·마이그레이션 코드뿐이다.
- **스파이크 S3**: 새 이름으로 Linux deb·rpm·AppImage, macOS `.app`을 만들어 원저작자 `v0.2.1` 산출물과 패키지 이름·설치 경로가 겹치지 않는지 실측한다(SC-007).
- **Rationale**: Linux 패키지 관리자는 패키지 이름으로, macOS는 `.app` 폴더 이름으로 덮어쓴다. 식별자만 바꿔서는 공존이 보장되지 않는다.

## R5. 라이선스 감사 (FR-005, 헌법 라이선스 감사 게이트)

- **Decision**:
  - **감사 범위는 직접·전이 의존성 전체**다(FR-005). 프론트엔드 68개(F27), Rust 300–383개(F28).
  - **Rust**: `cargo-deny`(F23)와 `src-tauri/deny.toml`을 쓴다. `licenses` 허용 목록과 `bans`·`advisories`·`sources`를 검사하고, 출하 대상(macOS·Linux·Android·iOS, 그리고 컴파일만 하는 Windows)만 본다.
  - **프론트엔드**: 새 의존성 없이 `scripts/check-licenses.mjs`를 만든다.
    - `package-lock.json`의 비개발 항목(`dev`·`devOptional`이 아닌 것) 전체의 `license` 필드를 검사하고, 필드가 없으면 실패한다.
    - SPDX 식(`AND`·`OR`·괄호)을 해석한다. `AND`는 모든 항이, `OR`는 정책에서 선택한 한 항이 허용 목록에 있어야 한다.
    - 초기 허용 목록(F27 실측): `MIT`, `Apache-2.0`, `ISC`, `BSD-2-Clause`, `BSD-3-Clause`, `CC0-1.0`, `Zlib`. 선택 맵: `jszip` → `MIT`.
  - **고지 생성**(배포물과 함께 제공):
    - Rust는 `cargo-about`로 크레이트별 저작권·라이선스 전문을 모은다. 대상 플랫폼마다 크레이트 집합이 다르므로(F28: macOS 300, Linux 383), `src-tauri/about.toml`의 `targets`에 출하 대상 전체(`aarch64-apple-darwin`, `x86_64-apple-darwin`, `x86_64-unknown-linux-gnu`, `aarch64-linux-android`, `aarch64-apple-ios`)를 고정해 **합집합**으로 생성한다. 결과는 크레이트 이름·버전 순으로 정렬해 어디서 실행해도 같은 파일이 나오게 한다.
    - npm은 `node_modules/<pkg>/LICENSE*` 파일과 `package.json` 저자 정보를 모은다.
    - 결과는 `src/generated/third-party-notices.txt` 하나로 만들고 프론트엔드 빌드에 포함해 정보 화면에서 연다.
    - `THIRD_PARTY_LICENSES.md`는 요약 표(직접 의존성과 선택 라이선스) + 전문 파일 안내로 둔다. 스크립트는 생성물과 실제 의존성 집합이 다르면 실패한다.
- **Rationale**: MIT·BSD·Apache 계열은 바이너리 배포 때도 저작권 고지와 라이선스 전문을 함께 제공하라고 요구한다. 빌드에 실제로 들어가는 것은 전이 의존성까지이므로, 직접 의존성 표만으로는 의무를 다하지 못한다. lockfile v3에는 전이 항목까지 라이선스 필드가 있다(F27, 누락 0).
- **Alternatives considered**: `license-checker` 계열 npm 도구 — 유지보수 상태가 들쭉날쭉하고 의존성이 늘어나므로 기각.

## R6. Android 서명 (FR-017, SC-008)

- **Decision**: `build.gradle.kts`에 `release` 서명 설정을 추가한다.
  - 값은 환경 변수에서 읽는다: `ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
  - CI는 비밀값 `ANDROID_KEYSTORE_BASE64`를 임시 파일로 풀어 쓴다.
  - 환경 변수가 없으면 release 빌드는 실패한다. 외부 PR은 release APK를 만들지 않고 debug 빌드 검증만 한다.
  - 키 생성·백업(서로 다른 보관 장소 2곳 이상)·분실 대응은 `docs/android-signing.md`에 적는다.
- **주의**: `applicationId`가 바뀌므로 Android는 새 앱으로 설치된다. 기존 포크 Android 사용자의 데이터는 자동 이전되지 않는다(FR-019 안내).
- **스파이크 S4**: CI의 `npm run android:init`(`tauri android init --ci`)이 저장소에 추적되는 `build.gradle.kts`를 덮어쓰는지 확인한다. 덮어쓰면 init 이후 서명 설정을 주입하는 단계로 바꾼다.

## R7. Apple 팀 정보·개인 기기 식별자 (FR-017)

- **Decision**:
  - `tauri.conf.json` `bundle.iOS.developmentTeam`과 `project.yml` `DEVELOPMENT_TEAM`을 지우고, Tauri CLI가 읽는 환경 변수 `APPLE_DEVELOPMENT_TEAM`으로 준다.
  - `ios:install`은 `scripts/ios-install.mjs`로 바꿔 `IOS_DEVICE_ID` 환경 변수를 요구한다.
  - git 이력에는 UDID가 남는다는 한계를 `SECURITY.md`에 적는다.
- **확인 필요**: Tauri 2 CLI의 `APPLE_DEVELOPMENT_TEAM` 지원을 구현 시점의 공식 문서(v2.tauri.app, iOS 코드 서명)로 다시 확인한다.

## R8. 역DNS 식별자 근거 (D2 리서치 7번)

- **사실**: `ezenitac.com`에는 DNS 레코드가 없다(F21). 따라서 `com.ezenitac.easyviewer`는 소유 도메인에 근거하지 않는다.
- **Decision**: 명세·헌법 v4.0.0이 정한 `com.ezenitac.easyviewer`를 유지한다.
  - Apple 번들 ID와 Android `applicationId`는 도메인 소유를 검증하지 않는다. 충돌 위험은 낮다.
  - 형제 프로젝트 ImageViewer와 일관된다.
  - 다만 위험(제3자가 같은 접두사를 쓸 가능성)을 기록하고, 도메인을 확보하면 그대로 근거가 된다.
- **Alternatives considered**: `io.github.ezenitac-aiservice.easyviewer` — 명세·헌법 재개정이 필요하고, 하이픈은 Android 패키지명에 쓸 수 없어 변환이 필요하다. 메인테이너가 원하면 `/speckit-clarify`로 되돌린다.

## R9. 첫 독립 릴리스 버전 (FR-024, 확정 결정 12)

- **Decision**: 첫 독립 릴리스는 `1.0.0-alpha.1`을 제안한다.
  - 업스트림이 쓴 버전(F3)과 겹치지 않고, `0.x` 계열에서 업스트림과 경쟁적으로 번호를 앞서가는 모양을 피한다.
  - 게시 직전 업스트림 릴리스 목록을 다시 조회해 비중복을 확인하고 결과를 릴리스 체크리스트에 기록한다. 조회는 읽기 전용 공개 API이며 동기화 경로가 아니다.
  - 하이픈 포함 버전이므로 기존 `ci-build-desktop.mjs` 규칙대로 Linux는 deb·AppImage만 만든다(rpm 제외).
  - **Android `versionCode`**: 자동 계산은 프리릴리스 부분을 무시하므로(F30) `1.0.0-alpha.1`과 `alpha.2`가 같은 값(1000000)이 된다. `tauri.conf.json` `bundle.android.versionCode`를 릴리스마다 명시적으로 올리고, `check-release-gate.mjs`가 직전 포크 릴리스 APK의 `versionCode`보다 큰지 검사한다.
- **Alternatives considered**: `0.3.0` — 업스트림이 곧 쓸 가능성이 높아 기각.

## R10. 포크 네트워크 분리·비공개 취약점 신고 (FR-011, FR-023)

- **Decision**:
  - 분리는 확정 결정 1대로 **GitHub Support 요청을 기본**으로 한다(메인테이너 수행). Support 분리는 이슈·PR 이력을 보존한다(F33).
  - 설정의 **Leave fork network**(자체 분리)는 이슈·PR·스타·위키를 잃고 되돌릴 수 없으며 릴리스 보존이 문서화되어 있지 않다(F33). 현재 잃을 것은 적지만(F32: 스타·이슈 0), 기존 Windows 프리릴리스에 지원 종료 고지를 달아야 하므로(US4) 기본으로 쓰지 않는다.
  - 자체 분리를 쓰려면 다음을 모두 만족해야 한다: Support 요청이 지연·거절됨, `gh release download`로 모든 릴리스 산출물과 노트를 백업함, 위키 백업, 지원 종료 고지(T097)가 이미 게시됨.
  - 비공개 취약점 신고는 저장소 설정 → Security에서 활성화한다(공개 API `PUT /repos/{owner}/{repo}/private-vulnerability-reporting`도 있음).
  - 업스트림 원격 제거는 `git remote remove upstream`이다. 기여 가이드에 "Sync fork" 버튼 사용 금지와 감지·복구 절차(`git log upstream/...` 흔적 확인, 병합 커밋 되돌리기)를 적는다.
- **대안(지연·거절 시)**: 새 저장소로 미러링(D1 대안). 임시로는 PR 대상을 수동으로 지정한다.

## R11. 업스트림 보안 조율 (FR-013, SC-009)

- **Decision**:
  - 포크 002(`8248627`)의 보안 수정 목록을 원저작자 최신 릴리스(현재 `v0.2.1`)와 대조해 영향 목록을 만든다. 001 수정은 PR #2로 이미 업스트림에 들어갔으므로 회귀 여부만 확인한다.
  - 목록과 통지 기록은 **공개 저장소에 올리기 전** 원저작자에게 비공개로 전달한다.
  - 원저작자 저장소는 비공개 취약점 신고가 **꺼져 있다**(F31). 따라서:
    - 공개 이슈·PR·토론으로 결함 내용을 알리는 것은 금지한다.
    - 공개 채널에는 "보안 관련으로 비공개 연락을 원한다"는 내용만 남겨 연락 경로(이메일 등)를 받거나, 원저작자에게 비공개 취약점 신고 기능을 켜 달라고 요청한다.
    - 비공개 경로를 확보하기 전에는 공개 비교 문서(T038)와 분리 공지를 진행하지 않는다.
  - **경로를 끝내 확보하지 못할 때**(무기한 정지 방지):
    - 공개 채널에 연락 요청을 남긴 날부터 **30일** 동안 응답이 없으면, "통지 시도 기록"(요청 날짜, 사용한 공개 채널, 결함 내용은 쓰지 않았다는 사실)으로 FR-025 2번 항목을 대체한다.
    - 이 경우에도 결함 세부와 원저작자 앱 비교 문서(T038)는 계속 공개하지 않는다. 원저작자 앱에 남아 있는 결함에 관한 공개 문구는 쓰지 않는다.
    - 나중에 연락이 닿으면 즉시 비공개 통지를 하고 기록을 갱신한다.
  - 저장소에는 통지 이후 날짜로 `specs/003-independent-fork-separation/verification/security-coordination.md`에 요약만 남긴다.
- **주의**: 002 명세가 이미 결함과 수정 내용을 공개하고 있으므로(입력 문서 §1.4), 통지는 늦출수록 원저작자 사용자 위험이 커진다. 작업 순서에서 가장 앞쪽에 둔다.

## R12. CI 재구성 (FR-008, FR-022, 헌법 품질 게이트)

- **Decision**: 새 `ci.yml`(PR과 `main` 푸시)을 만든다.

  | 작업 | 내용 | 차단 여부 |
  |---|---|---|
  | `verify` | ubuntu, `npm run verify` | 차단 |
  | `licenses` | `cargo deny check`, `node scripts/check-licenses.mjs` | 차단 |
  | `windows-compile-test` | windows-latest, `npm ci`, `npm test`, `cargo check`, `cargo test`. 번들 생성은 하지 않음 | 차단 |
  | `macos-build` | 기존 `build-apple.yml`의 macOS 빌드를 옮김 | 차단 |
  | `ios-sim-build` | 서명 없이 시뮬레이터 빌드 | 차단(FR-021). S5 실패 시 원인부터 고침 |
  | `android-debug` | debug APK 빌드(비밀값 불필요) | 차단 |

  - `ios-sim-build`: 현재 `build-apple.yml`에서는 `continue-on-error: true`다. 새 `ci.yml`에서는 차단 작업으로 둔다. **스파이크 S5**로 서명 없이 통과하는지 미리 확인하고, 실패하면 원인을 먼저 고친다(아래 공급망·권한 절의 FR-021 항목).
  - `release.yml`:
    - `windows-x64` 매트릭스, 포터블 ZIP 단계, `*.exe *.msi *.zip` 수집을 없앤다.
    - `SHA256SUMS.txt`를 만들고 제목·산출물 이름에 새 표시명을 쓴다.
    - Android 서명 비밀값을 주입한다.
    - FR-025 안전 게이트 검사 단계(`scripts/check-release-gate.mjs`)를 publish 앞에 둔다.
  - `ci-build-desktop.mjs`의 `windows-x64` 분기는 매트릭스에서 빠지므로 제거하되, 테스트(`releaseWorkflow.spec.ts`)를 먼저 고친다.
  - **공급망·권한**(F34):
    - 새·변경 워크플로의 JavaScript 액션은 Node 24 대응 최신 메이저로 올리고, 서드파티 액션은 커밋 SHA로 고정한다(버전은 주석으로 병기).
    - 워크플로 기본 권한은 `contents: read`로 두고, 쓰기 권한은 릴리스 `publish` 작업에만 준다.
    - 서명 비밀값은 해당 단계의 `env`에만 둔다.
  - **iOS 검증은 FR-021 MUST**다. S5가 실패해도 `continue-on-error`로 덮지 않는다. 원인을 고치는 작업(T084 하위)을 먼저 하고, 고칠 수 없으면 스펙 예외를 명시적으로 개정한다.
- **Rationale**: 헌법 제5원칙은 비지원 Windows 코드의 컴파일·테스트 유지를 요구한다(검증되지 않는 보안 코드 방지).

## R13. 앱 정보 화면과 외부 링크 (FR-004)

- **Decision**:
  - 라이브러리 화면에서 여는 접근성 대화상자(기존 WAI-ARIA 대화상자 규약)로 만든다.
  - 내용: 앱 이름, 버전, `GPL-3.0-only`, 저장소 주소, 원저작자 출처, 변경 일자, 지원 범위 문구, 주요 서드파티 고지.
  - 데이터는 빌드 때 생성되는 JSON(버전은 `package.json`, 서드파티는 R5 스크립트 출력)에서 읽어 실제와 일치시킨다.
  - 외부 링크는 `opener:allow-open-url` 권한으로 제한한다. 권한 범위는 glob이고 `*`가 `/`까지 포함하므로(F29) 접두사 하나에 `*`를 붙이지 않는다. 저장소마다 정확한 주소와 `주소/*` 두 항목씩, 모두 4항목으로 둔다(`https://github.com/Ezenitac-AiService/EasyViewer`, `…/EasyViewer/*`, `https://github.com/edith2580/EasyViewer`, `…/EasyViewer/*`). 프론트엔드도 같은 허용 목록으로 다시 검사한다(제7원칙 이중 검증).
  - "법적 의무" 문구를 쓰지 않는다.

## R14. 웹 폴백 영향 (가정 검증)

- **Decision**: 영향 없음으로 확정한다. 웹 저장은 출처 기준 IndexedDB `EasyViewerDB`와 `localStorage` `easyviewer:*` 키를 쓰며 식별자를 참조하지 않는다(F5·F6). 개발 서버 출처가 바뀌지 않는 한 데이터는 그대로다.

## R15. 지원 범위 단일 원문 강제 (FR-006, SC-004)

- **Decision**: 원문을 `src/config/supportScope.ts`(한국어 문구와 영문 한 줄 배너)로 두고, `scripts/check-support-scope.mjs`가 다음을 검사한다.
  - 각 문서의 `<!-- support-scope:start -->`…`<!-- support-scope:end -->` 블록이 원문 렌더 결과와 같은지 확인한다. 대상: README, NOTICE, CHANGELOG, CONTRIBUTING, 이슈 양식.
  - 금지 표현(`역할 분담`, `경쟁하지 않`)이 공개 문서에 없는지 확인한다.
  - 정보 화면은 같은 모듈을 직접 가져다 쓴다. 헌법은 문구가 다르므로 사람 검토 항목으로 남긴다.

## 열린 입력 (메인테이너 결정 필요, 구현 차단 아님)

| 항목 | 필요 시점 | 비고 |
|---|---|---|
| ~~새 제품 표시명~~ | 해결(2026-11-17) | `Pagelight` |
| ~~새 앱 아이콘~~ | 해결(2026-11-17) | 직접 제작 원본 `src-tauri/icons/source/pagelight.svg` |
| 원저작자 비공개 연락 경로 | T013 전 | F31(비공개 취약점 신고 꺼짐) |
| 포크 기여분 저작권 표기 주체 | US1 구현 전 | 조직 명의 근거가 없으면 기여자 개인(커밋 작성자 표기 `M5`). 실명·연락처를 공개할지는 메인테이너가 정함 |
| Android 서명 키 생성·보관 | US5 릴리스 전 | R6 |
| 원저작자 연락 경로(일반 고지용) | 사전 고지 전 | R11, T095 |

## R16. GPLv3 §5(a) 변경 고지 위치

- **Decision**(2026-11-17 구현 중 갱신): 중앙 고지(`NOTICE` 3절·README·CHANGELOG·정보 화면)를 기본으로 한다. 파일별 고지는 **이 포크가 새로 만든 파일**에만 SPDX 한 줄(`// SPDX-License-Identifier: GPL-3.0-only`)로 단다. 원작에서 온 파일에 일괄 헤더를 다는 일은 하지 않는다.
- **Rationale**:
  - GPLv3 §5(a)는 "**the work** must carry prominent notices stating that you modified it, and giving a relevant date"라고 정한다. GPLv2 2(a)가 "modified **files**"에 고지를 요구하던 것과 달리 작품 단위로 바뀌었다. 이는 [GPLv3 전문](https://www.gnu.org/licenses/gpl-3.0.en.html)과 초안 변경 논의([FSFE 토론, 2007](https://lists.fsfe.org/pipermail/discussion/2007-June/007045.html))에서 확인했다. 따라서 작품 전체에 붙는 중앙 고지는 문언에 부합한다.
  - 원작 파일 수십 개에 헤더를 다는 것은 변경량이 크고, 이후 diff·리뷰 비용에 비해 법적 이득이 작다.
- **한계**: FSF GPL FAQ와 GPLv3 공식 해설은 접속 오류(429·ECONNRESET)로 **확인하지 못했다**. 위 판단은 조문 문언과 공개 논의에 근거한 해석이며 법률 자문이 아니다. 원저작자나 이용자가 파일별 고지를 요청하면 다시 검토한다.
