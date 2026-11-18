# 계약: 데스크톱 데이터 이전과 자격증명 이전

**요구사항**: FR-018, FR-019, US6, SC-006 | **모델**: [data-model.md](../data-model.md) §1–2 | **리서치**: R1, R2

## 1. 시작 단계 이전 (Rust, 메인 창 생성 전)

**적용 플랫폼**: macOS, Linux. Windows는 비지원이므로 이전 코드를 실행하지 않는다. 컴파일은 된다. Android·iOS도 실행하지 않는다.

**핵심 원칙: 이전에 관한 결정이 끝나기 전에는 영속 WebView를 만들지 않는다.**
메인 창(영속 WebView)이 한 번 뜨면 새 식별자 위치에 WebKit 저장소가 생기고(Tauri `webview.rs:559-576`, wry `defaultDataStore`), 다음 실행부터 새 폴더가 "비어 있지 않음"이 되어 이전 기회가 영영 사라진다. 그래서 진행 창·대화상자·버리기 처리는 모두 이 원칙을 따른다.

**실행 흐름**(Rust `setup` 훅)

```text
setup ─▶ 단일 인스턴스 확인 ─(다른 인스턴스 있음)─▶ 초점 넘기고 종료
   │
   ├─▶ 기록이 discard_pending ─▶ 새 데이터 폴더 비움 ─▶ discarded 기록 ─▶ 메인 창
   ├─▶ 기록 있음(최종 상태) 또는 이전 대상 아님 ─▶ 메인 창
   └─▶ 이전 필요(구 폴더 있음 + 새 폴더 비어 있음)
          │
          ├─▶ 이전 잠금 실패 ─▶ 종료(다른 인스턴스가 이전 중)
          ├─▶ 구 앱 실행 중 ─▶ 네이티브 대화상자
          │        [다시 시도] → 감지 반복
          │        [이번엔 건너뛰고 빈 상태로 시작] → declined 기록 → 메인 창
          │        [종료] → 기록 없이 종료(다음 실행에 다시 물음)
          └─▶ 백그라운드 스레드에서 복사 시작, setup은 즉시 반환
                   5초 경과 시 진행 창(incognito + 임시 data_directory)
                   완료 ─▶ 기록 ─▶ 진행 창 닫기 ─▶ 메인 창 생성
```

**선행 단계**
1. **단일 인스턴스**: 이미 실행 중인 포크 인스턴스가 있으면 새 인스턴스는 기존 창에 초점만 넘기고 종료한다.
2. **이전 잠금**:
   - 위치: OS 런타임·임시 폴더 아래 전용 파일. Linux는 `$XDG_RUNTIME_DIR/com.ezenitac.easyviewer/migration.lock`(없으면 `/tmp/com.ezenitac.easyviewer-<uid>/`), macOS는 `NSTemporaryDirectory()/com.ezenitac.easyviewer/migration.lock`.
   - 공용 상위 폴더(`~/Library/Application Support/`, `~/.local/share/`)에는 두지 않는다.
   - 배타적 파일 잠금을 잡지 못하면 이전하지 않고 종료한다. 이 경우 메인 창을 만들지 않는다.
3. **구 앱 실행 감지**(주 방어선):
   - 구 식별자 앱(포크 구버전 또는 원저작자 앱)이 실행 중이면 **메인 창을 만들지 않고** 네이티브 대화상자(`tauri-plugin-dialog`, WebView 아님)로 위 흐름의 세 가지 선택지를 준다.
   - 감지 방법: macOS는 `lsappinfo` 시스템 명령으로 번들 식별자 `com.edith.easyviewer` 실행 여부를 조회한다(새 의존성 없음). Linux는 `/proc/*/exe`가 가리키는 실행 파일 이름(`easy-viewer`)과 경로를 확인한다.
   - 판정할 수 없으면 같은 대화상자에 "다른 EasyViewer가 실행 중인지 확인할 수 없습니다"라는 문구를 넣어 묻는다.

**진행 창**
- 복사는 백그라운드 스레드에서 한다. `setup` 훅은 복사를 기다리지 않고 바로 반환해 이벤트 루프가 돌게 한다.
- 복사가 5초를 넘으면 진행 창을 띄운다. 이 창은 `WebviewWindowBuilder::incognito(true)`(비영속 저장소, `webview_window.rs:1119`)와 OS 임시 폴더 아래 전용 `data_directory`(`webview_window.rs:1089`)로 만든다. 따라서 새 식별자 위치에 아무것도 만들지 않는다.
- 진행 창 내용은 앱에 포함된 정적 페이지이고, 진행률은 이벤트로 받는다.
- 메인 창은 복사와 기록이 끝난 뒤 앱 핸들로 만든다.

**"새 폴더가 비어 있음"의 정의**
- 새 폴더가 없거나, 안에 다음만 있을 때 비어 있다고 본다.
  - 이번 실행에서 만든 빈 하위 폴더
  - 플러그인이 시작할 때 만드는 0바이트 파일
- 실제 목록은 S1에서 실측해 이 문서에 고정한다.

| 입력 상태 | 동작 | 결과 기록 |
|---|---|---|
| `migration-v1.json` 있음(최종 상태) | 아무것도 하지 않음 | 변경 없음 |
| `migration-v1.json`이 `discard_pending` | 창을 만들기 전에 새 데이터 폴더(앱 데이터·WebKit 저장소)를 비움 | `discarded` |
| 구 앱 실행 중, 사용자가 [이번엔 건너뛰기] 선택 | 이전하지 않고 빈 상태로 시작 | `declined`(다시 묻지 않음) |
| 구 앱 실행 중, 사용자가 [종료] 선택 | 아무것도 하지 않고 종료 | 기록 없음(다음 실행에 다시 물음) |
| 구 폴더 없음 | 아무것도 하지 않음 | `skipped_no_source` |
| 새 폴더에 사용자 데이터 있음(기록 파일 제외) | 아무것도 하지 않음 | `skipped_target_not_empty` |
| 구 폴더 있음, 새 폴더 비어 있음 | 임시 폴더로 복사 → 검증 → 원자적 rename | `migrated` 또는 `partial` |
| 복사·검증 중 오류 | 임시 폴더 삭제, 새 폴더는 빈 상태 유지 | `failed` + `error` 범주 |

**복사 대상과 제외**
- macOS: `~/Library/Application Support/com.edith.easyviewer/`, `~/Library/WebKit/com.edith.easyviewer/WebsiteData/`(`Default/salt` 포함)
- Linux: `~/.local/share/com.edith.easyviewer/`. 단, WebKit 캐시 하위 폴더(S1에서 이름 확정)는 제외한다
- 제외(캐시라 이전하지 않음): `~/Library/Caches/com.edith.easyviewer`, `~/.cache/com.edith.easyviewer`
- macOS 실측(2026-11-17, verification/spikes.md S1): `WebsiteData` 전체와 `books`를 복사하면 새 식별자 앱이 서재·진행률을 그대로 읽는다. 새 앱을 처음 실행하면 `~/Library/Caches/<새 식별자>`가 생기지만 캐시라 이전 판정과 무관하다

**복사 규칙**
- 일반 파일과 폴더만 복사한다. 심볼릭 링크·특수 파일은 건너뛰고 `skippedEntries`를 늘린다.
- SQLite 파일(`*.db`, `*.sqlite3`, 확장자 없는 IndexedDB 파일 포함)과 같은 이름의 `-wal`·`-shm`은 한 묶음으로 복사한다.
- 복사 전후에 원본 묶음의 수정 시각·크기가 바뀌면 다른 프로세스가 쓰는 중으로 보고 `failed`(`error = "busy"`)로 롤백한다. 이 검사는 짧은 복사 중의 쓰기를 놓칠 수 있는 **보조 방어선**이다. 주 방어선은 선행 단계 3(구 앱 실행 감지)이다.
- 모든 경로를 정규화한 뒤 구 루트 아래인지 확인한다. 벗어나면 건너뛴다.
- 기존 `is_sensitive_path` 규칙에 걸리면 건너뛴다.
- 원본 폴더는 읽기만 한다. 권한 변경·삭제·이동은 금지한다.
- 검증: 복사 후 파일 수와 각 파일 크기가 원본과 같아야 한다.
- 디스크 공간이 모자라 실패하면 `error = "space"`로 기록한다.

**보장**
- 멱등: 두 번째 실행부터는 아무것도 바꾸지 않는다.
- 비차단: 어떤 실패도 앱 시작을 막지 않는다. 오류는 패닉이 아니라 기록으로 남긴다.
- 로그에는 전체 경로를 남기지 않는다.

## 2. 프론트엔드 조회 (플랫폼 포트)

`migrationService.getRecord(): Promise<MigrationRecord | null>`
- Tauri 데스크톱에서는 Rust 명령으로 기록을 읽는다. 웹·모바일에서는 `null`이다.

`migrationService.acknowledge(): Promise<void>`
- `noticeAcknowledged = true`로 저장한다.

**안내 표시 규칙**(`MigrationNotice`)

| 상태 | 안내 |
|---|---|
| `migrated`, 서재 정상 | 한 번만 "이전 버전 데이터를 옮겼습니다" 안내, 원본 위치는 그대로 있다는 사실. 구 위치는 원저작자 앱과 함께 쓰던 곳이라 원저작자 앱이 만든 데이터가 섞여 있을 수 있다는 사실과 **"이전 결과 버리기"** 버튼. 실행 중에는 WebView가 저장소를 열고 있어 바로 지울 수 없으므로, 확인을 받으면 `discard_pending`을 기록하고 앱을 재시작한다. 다음 시작 때 창을 만들기 전에 비우고 `discarded`로 바꾼다(다시 묻지 않음) |
| `declined` | 한 번만 "이전 버전 데이터를 옮기지 않았습니다. 원본은 그대로 있습니다" 안내와 수동 복구 방법(책 파일 다시 가져오기) |
| `partial` 또는 `migrated`인데 서재 비어 있음 | 서재 재구성 실행 → 잃은 항목(진행률·책갈피·표시 설정) 안내 |
| `failed` | 이전 실패 사실, 원본은 그대로라는 사실, 수동 복구 방법(책 파일 다시 가져오기) |
| `skipped_target_not_empty` + 구 폴더 존재 | "새 위치를 우선했습니다" 안내(병합하지 않음) |

- 사용자 지정 저장 폴더가 구 앱 데이터 폴더 안을 가리키면 새 폴더의 같은 상대 경로로 다시 연결한다.
- 그 밖의 경로는 그대로 둔다.

## 3. 자격증명 이전 명령

`migrate_legacy_credentials(accountKeys: string[]) -> { migrated, missing, failed }`

- **선행 조건**: 기록 상태가 `migrated` 또는 `partial`이고, `credentials`가 아직 비어 있다.
- **입력 검증**:
  - 배열은 최대 64개, 각 항목은 `^easyviewer:webdav:[A-Za-z0-9_-]{1,128}$`이어야 한다.
  - 위반하면 전체를 거부한다.
- **동작**:
  - 구 서비스 `com.edith.easyviewer`에서 읽어, 새 서비스에 값이 없을 때만 쓴다.
  - 구 항목은 지우지 않는다.
- **보안**:
  - 비밀값은 Rust 안에서만 다룬다. 응답·로그·기록에 비밀값과 계정 키를 넣지 않는다.
  - 평문 파일로 대체 저장하지 않는다.
- **실패**: OS가 접근을 거부하면 `failed`를 늘린다. 프론트엔드는 해당 연결에 재입력을 안내한다.
- **macOS 사전 안내**: 레거시 키체인이라 항목마다 암호 허용 창이 뜰 수 있다(research F26). 호출 전에 "연결 N개의 비밀번호를 옮기려면 macOS가 최대 N번 암호를 물을 수 있습니다"를 보여 주고 **[옮기기] / [건너뛰고 나중에 재입력]**을 고르게 한다. 건너뛰면 명령을 호출하지 않고 `credentials = { migrated: 0, missing: 0, failed: 0, skipped: true }`로 기록한다.
- **1회성**: 결과를 기록한 뒤에는 다시 호출해도 아무것도 하지 않는다.

## 4. 모바일 (FR-019)

- iOS·Android는 자동 이전을 하지 않는다.
- `docs/mobile-migration.md`와 릴리스 노트에 다음을 안내한다:
  - 새 앱이 별도 앱으로 설치된다는 사실
  - WebDAV 동기화와 책 파일 다시 가져오기
  - 잃는 항목

## 5. 테스트 요구

**Rust(`cargo test`, 임시 폴더)**
- 각 입력 상태별 결과
- 잠금을 잡지 못한 두 번째 실행은 아무것도 바꾸지 않음(스레드 2개로 동시 실행)
- 결정 흐름 함수(창 생성 여부를 반환)가 다음을 지킴: 구 앱 실행 중·잠금 실패·복사 중에는 "메인 창 생성 안 함"을 반환하고, `declined`·최종 상태·`discarded` 처리 뒤에만 "메인 창 생성"을 반환
- `discard_pending` 기록이 있으면 창 생성 전에 새 데이터 폴더가 비워지고 `discarded`가 됨
- 진행 창 설정이 `incognito = true`이고 `data_directory`가 새 식별자 위치 밖임
- 잠금 파일 경로가 공용 상위 폴더가 아님
- 복사 중 원본 SQLite 묶음이 바뀌면 `busy`로 롤백
- `-wal`·`-shm` 묶음 복사, 캐시 폴더 제외
- "비어 있음" 정의(무시 목록만 있으면 비어 있음)
- 심볼릭 링크·경계 이탈 건너뛰기
- 실패 시 롤백
- 두 번째 실행 무변경
- 원본 불변(실행 전후 해시 비교)

**TS(Vitest, `mockIPC`)**
- 상태별 안내
- 재구성 트리거
- 자격증명 명령 입력 검증
- 응답에 비밀값이 없음

**실측(S1, S2)**: macOS·Linux 실제 빌드 간 이전 결과를 `verification/`에 기록한다.
