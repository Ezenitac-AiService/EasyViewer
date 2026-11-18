# 데이터 모델: 독립 포크 분리

**명세**: [spec.md](spec.md) Key Entities | **리서치**: [research.md](research.md)

## 1. MigrationRecord (데스크톱 1회 이전 기록)

새 식별자 앱 데이터 폴더의 `migration-v1.json`에 저장한다. 앱이 직접 쓰고 읽으며, 사용자가 지워도 다시 이전하지 않는다. 새 폴더에 데이터가 있으면 이전하지 않기 때문이다.

| 필드 | 타입 | 규칙 |
|---|---|---|
| `schema` | `1` | 고정값. 다른 값이면 기록을 무시하고 `state = failed`로 취급 |
| `state` | `"migrated" \| "skipped_target_not_empty" \| "skipped_no_source" \| "partial" \| "failed" \| "declined" \| "discard_pending" \| "discarded"` | 아래 상태 전이 참고. `discard_pending`만 중간 상태이고 나머지는 최종 상태다. 사용자가 [종료]를 고르거나 잠금을 잡지 못하면 기록하지 않는다(메인 창도 만들지 않으므로 다음 실행에 다시 시도할 수 있음) |
| `sourceIdentifier` | string | 항상 `com.edith.easyviewer` |
| `startedAt`, `finishedAt` | ISO 8601 UTC | |
| `copied` | `{ dataDir: boolean, webviewStore: boolean }` | 플랫폼별 복사 대상의 성공 여부 |
| `skippedEntries` | number | 심볼릭 링크·민감 경로·정규화 실패로 건너뛴 항목 수(경로 자체는 기록하지 않음) |
| `error` | string? | 사용자에게 보여 줄 수 있는 범주 코드만 저장(`io`, `permission`, `space`, `boundary`, `busy`). 전체 경로·OS 메시지 원문은 저장하지 않음 |
| `credentials` | `{ migrated: number, missing: number, failed: number, skipped?: boolean }?` | R2 이전 결과. 사용자가 건너뛰면 `skipped: true`. 비밀값과 계정 키는 저장하지 않음 |
| `reconstructed` | boolean | 폴백(서재 재구성)을 실행했는지 |
| `noticeAcknowledged` | boolean | 사용자가 안내를 닫았는지 |

**상태 전이**

```text
(없음) ──시작──▶ 구 폴더 없음 ─────────────▶ skipped_no_source
            └─▶ 새 폴더에 데이터 있음 ─────▶ skipped_target_not_empty
            └─▶ 복사 → 검증 성공 ─────────▶ migrated
            └─▶ 일부 대상만 성공 ─────────▶ partial   (예: 서재는 됐고 WebView 저장소 실패)
            └─▶ 복사·검증 실패(롤백) ─────▶ failed

migrated|partial ──서재 비어 있음 감지──▶ reconstructed = true
migrated|partial ──자격증명 이전 1회(또는 건너뛰기)──▶ credentials 채움
migrated|partial ──사용자 "이전 결과 버리기"──▶ discard_pending ──(재시작, 창 생성 전 비움)──▶ discarded
(구 앱 실행 중) ──[이번엔 건너뛰기]──▶ declined (빈 상태로 시작, 다시 묻지 않음)
(구 앱 실행 중) ──[종료]──▶ 기록 없음, 메인 창 만들지 않고 종료 → 다음 실행에 다시 물음
(잠금 실패) ──▶ 기록 없음, 메인 창 만들지 않고 종료
```

**검증 규칙**
- **불변식**: 이전 결정이 최종 상태가 되기 전에는 영속 WebView(메인 창)를 만들지 않는다. 진행 창은 `incognito` + 임시 `data_directory`로만 만든다.
- 기록 파일이 최종 상태면 마이그레이션을 다시 실행하지 않는다(멱등, US6-2).
- `failed`여도 앱은 빈 상태로 정상 시작한다(US6-3).
- 원본 폴더는 어떤 상태에서도 수정·삭제하지 않는다(US6-1).

## 2. LegacyCredentialMigration (자격증명 이전 요청·결과)

| 방향 | 필드 | 규칙 |
|---|---|---|
| 요청 | `accountKeys: string[]` | 각 항목은 `easyviewer:webdav:<connectionId>` 형식, 최대 64개, 다른 형식은 거부 |
| 응답 | `migrated: number`, `missing: number`, `failed: number` | 비밀값·계정 키를 응답에 담지 않음 |

- 새 서비스에 이미 값이 있는 계정은 덮어쓰지 않고 `migrated`에 넣지 않는다(새 위치 우선).
- 구 서비스 항목은 지우지 않는다.

## 3. SupportScope (지원 범위 단일 원문)

`src/config/supportScope.ts`에 둔다.

| 필드 | 값 |
|---|---|
| `focus` | `["macOS", "iOS", "Linux"]` |
| `maintained` | `["Android"]` |
| `unsupported` | `[{ platform: "Windows", recommend: "https://github.com/edith2580/EasyViewer" }]` |
| `devOnly` | `["Web"]` |
| `iosDelivery` | `"source-build-only"` |
| `linuxBaseline` | 보장 범위: Ubuntu 22.04 이상 또는 동급(glibc 2.35 이상), deb·AppImage(정식 버전은 rpm 추가), WebKitGTK 4.1, X11·Wayland. 그 밖은 "검증하지 않음" |
| `bannerEn` | 영문 한 줄(포크 안내 배너 전용) |
| `renderKo()` | 문서 블록·정보 화면에 쓰는 한국어 문구 생성 |

**게시 위치**(7곳): README, NOTICE, CHANGELOG, CONTRIBUTING, 이슈 양식(`config.yml`), 정보 화면, 헌법. 앞의 6곳은 자동 검사, 헌법은 사람 검토다([contracts/support-scope-wording.md](contracts/support-scope-wording.md)).

## 4. AppIdentity (앱 정체성)

| 항목 | 현재 | 목표 |
|---|---|---|
| 식별자 | `com.edith.easyviewer` | `com.ezenitac.easyviewer` |
| 표시명(`productName`·창 제목·`PRODUCT_NAME`·`app_name`) | `EasyViewer` | **`Pagelight`**(2026-11-17 메인테이너 결정) |
| Cargo·npm 패키지 이름 | `easy-viewer` | `pagelight`(Rust 라이브러리 이름 `pagelight_lib`) |
| 앱 아이콘 | 원저작자 아이콘(보라 바탕 펼친 책) | 새 원본 아이콘: 청록 그라데이션 + 접힌 모서리 한 장 + 빛(`src-tauri/icons/source/pagelight.svg`, 이 포크 제작, GPL-3.0-only) |
| Android 서명 | debug 키 | 포크 소유 release 키(환경 변수) |
| Apple 팀 | 저장소 고정 `GMXNVH8YU9` | 환경 변수 `APPLE_DEVELOPMENT_TEAM` |
| 저작권 표기(`authors`) | `EasyViewer Team` | 포크 기여분 권리 주체(근거 확인 후) |
| 라이선스 선언 | 없음 | `GPL-3.0-only` |

**구 식별자·원저작자 이름을 남겨도 되는 곳**(SC-002 예외, `check-identity.mjs` 허용 목록):
- 마이그레이션 코드와 테스트
- 구 구조 차단 검사
- 출처 고지(NOTICE, README 출처 절, 정보 화면 출처)
- **지원 범위 원문과 Windows 안내**: `src/config/supportScope.ts`, 각 문서의 `<!-- support-scope:start -->`…`end` 블록, README 배너, `.github/ISSUE_TEMPLATE/config.yml`, `docs/windows-migration.md`, `docs/windows-eol-notice.md`. 이 문구는 "원저작자의 EasyViewer"를 반드시 포함한다(FR-006)
- 과거 명세(`specs/001-*`, `specs/002-*`)
- CHANGELOG 과거 항목
- EPUB 테스트 픽스처의 저자명

**바꾸지 않는 내부 저장 키**(데이터 연속성, US6·SC-006). 아래 이름은 새 표시명과 무관하게 **그대로 유지**하며, `check-identity.mjs`는 이 정확한 리터럴만 허용한다.

| 키 | 위치 | 유지 이유 |
|---|---|---|
| IndexedDB 이름 `EasyViewerDB` | `src/services/storage/idbClient.ts` | 이전한 WebView 저장소의 DB를 그대로 열어야 함 |
| `localStorage` 접두사 `easyviewer:` | `src/services/storage/platformAdapter.ts` | 이전한 설정 키를 그대로 읽어야 함 |
| 자격증명 계정 키 접두사 `easyviewer:webdav:` | `src/services/platform/credentialService.ts` | R2 자격증명 이전이 같은 계정 키로 구·새 서비스를 대응시킴 |
| 웹 자격증명 저장 키 `webdav_credentials_web_consent_v2` | `credentialService.ts` | 웹 폴백 기존 데이터 유지 |

출처(origin)와 키체인 서비스명(식별자)이 다르므로, 같은 키 이름을 써도 원저작자 앱과 데이터가 섞이지 않는다.

## 5. Baseline (분기 기준선)

| 필드 | 값 |
|---|---|
| 태그 | `upstream-base-v0.1.6`(주석 태그, 불변) |
| 대상 커밋 | `44c4d37` |
| 관계 | 기존 lightweight `v0.1.6`과 같은 커밋 |
| 미병합 기록 | 업스트림 `v0.2.0`(`eaf6471`), `v0.2.1`(`40c4605`) — 태그 메시지와 CHANGELOG에 기록 |

## 6. SecurityCoordinationRecord (보안 조율 기록)

| 필드 | 규칙 |
|---|---|
| `findings[]` | 포크 수정 커밋, 영향 범주(경로·SSRF·CSP·자격증명 등), 원저작자 최신 릴리스 영향 여부 |
| `notifiedAt`, `channel` | 통지 날짜와 비공개 경로 종류 |
| `response` | 원저작자 응답 요약 |
| `disclosurePolicy` | 미수정 결함의 공개 시점 기준(예: 통지 후 90일) |

공개 저장소에는 통지 이후에만 요약을 커밋한다(R11).

## 7. NoticeRecord (원저작자 사전 고지 기록)

| 필드 | 규칙 |
|---|---|
| `notifiedAt`, `channel` | |
| `content` | 분리 사실, 식별자 변경, 새 표시명, 지원 범위, Windows 안내 방침 |
| `objection` | 없음 / 이름 / Windows 안내 |
| `action` | 확정 결정 10의 대응(이름 변경, Windows 문구 축소) |

## 8. Release (릴리스)

| 필드 | 규칙 |
|---|---|
| `version` | 게시 직전 업스트림 릴리스 목록과 비중복 확인(R9). 첫 독립 릴리스 제안값은 `1.0.0-alpha.1` |
| `title` | `<새 표시명> v<버전>` |
| `assets[]` | macOS universal dmg, Linux deb·AppImage(정식 버전이면 rpm 추가), Android arm64 apk, `SHA256SUMS.txt`. 파일 이름은 새 표시명으로 시작. `.exe`·`.msi`·Windows `.zip`은 0개 |
| `gate` | FR-025 8개 항목 통과 기록 |
