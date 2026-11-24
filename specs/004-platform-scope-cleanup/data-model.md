# Data Model: 지원 범위 재정렬과 독립 포크 분리 마무리

저장소 파일과 게시된 릴리스만 다룬다. 데이터베이스는 없다.

## 1. SupportScope (지원 범위 단일 원문)

위치: `src/config/supportScope.ts`

| 필드 | 값 | 규칙 |
|---|---|---|
| `focus` | `['macOS']` | 중점 등급. 하나뿐 |
| `maintained` | `['iOS']` | 유지 등급 |
| `testBuild` | `['Linux', 'Android']` | 새 필드. 테스트 빌드 등급 |
| `excluded` | `[{ platform: 'Windows', recommend: UPSTREAM_REPO_URL }]` | 기존 `unsupported`를 이름 변경 |
| `devOnly` | `['Web']` | 그대로 |
| `iosDelivery` | `'source-build-only'` | 그대로 |
| `linuxBaseline` | Ubuntu 22.04+, deb·AppImage, WebKitGTK 4.1, X11·Wayland | "검증 기준"이 아니라 "빌드 환경 기준" 문장으로 렌더 |
| `androidMinimum` | `'7.0 (API 24)'` | 새 필드 |

렌더 함수: `renderSupportScopeKo(options)`, `renderSupportScopeEn(options)`, `supportScopeBannerEn(options)`. `windowsWording: 'recommend' | 'unsupported-only'` 축소 경로를 두 언어 모두 유지한다.

## 2. TestBuildArtifact (테스트 빌드 산출물)

| 필드 | 규칙 |
|---|---|
| `platform` | `linux` 또는 `android` |
| `fileName` | 확장자 앞에 `-test` 포함(리허설 APK는 `-test-rehearsal`). 정규식은 contracts/release-test-builds.md §2 |
| `signing` | Android는 포크 서명 키(리허설만 debug) |
| `sha256` | `SHA256SUMS.txt`에 포함 |

검증: 게시 전 게이트가 `.deb`·`.AppImage`·`.rpm`·`.apk` 중 `-test` 표식이 없는 파일을 하나라도 찾으면 실패.

## 3. OmissionRecord (누락 기록)

릴리스 노트 안의 기계 판독 표식으로만 존재한다.

```text
<!-- pagelight:omitted <platform>=<reason> -->
```

| 필드 | 값 |
|---|---|
| `platform` | `linux`, `android` |
| `reason` | `build-failed`, `security`, `no-signing-key` |

상태 전이(플랫폼별, 최신 게시 릴리스 기준):

```text
포함 ──(누락: build-failed | security)──▶ 누락 1 ─▶ 누락 2 ─▶ 누락 3 ─▶ [다음 릴리스 게이트 정지]
  ▲                                                                 │
  └──────────────────────(포함되어 게시)─────────────────────────────┘
no-signing-key 누락은 횟수에 넣지 않는다(상태 유지).
```

## 4. ReleaseExclusion (보안상 제외 선언)

위치: `.github/release-exclusions.json`

```json
[{ "platform": "linux", "advisory": "PAGELIGHT-2026-001", "since": "2026-12-01" }]
```

| 필드 | 규칙 |
|---|---|
| `platform` | `linux` 또는 `android`(macOS·iOS는 이 방식으로 뺄 수 없음) |
| `advisory` | 비공개 식별자. 결함 세부 금지 |
| `since` | ISO 날짜 |

빈 배열이 기본값. 항목이 있으면 그 플랫폼은 빌드·게시하지 않고 `security` 누락으로 기록한다.

## 5. WindowsAllowlist (Windows 허용 목록)

위치: `scripts/check-windows-exclusion.mjs`

| 종류 | 예 |
|---|---|
| 원저작자 안내 | 지원 범위 원문의 Windows 문장, 이슈 양식 `config.yml` 링크 |
| 보존 기록 | `docs/windows-migration.md`, `docs/windows-eol-notice.md`, CHANGELOG의 지원 종료 기록 |
| 과거 기록 | `specs/001-*`, `specs/002-*`, `specs/003-*` |
| 입력 검증 | `path_guard.rs`의 Windows 형식 경로 차단 목록·테스트 |
| 차단 검사 | `check-release-gate.mjs`의 Windows 산출물 차단, `check-windows-exclusion.mjs` 자신 |
| 생성물 | `src-tauri/gen/android/gradlew.bat`(R2) |

## 6. FollowUpClassification (003 작업 분류)

`specs/003-independent-fork-separation/tasks.md`의 열린 항목마다 하나:

| 상태 | 표기 |
|---|---|
| 완료 | `- [X]` |
| 범위 제외 | `- [X] ~~…~~ (범위 제외: <사유>, <근거 조항>)` |
| 이관 | `- [X] … (004로 이관: <004 작업 번호>)` |

검증: 003 `tasks.md`에 `- [ ]` 항목이 남지 않는다. 단, 메인테이너 작업 T062는 "메인테이너 작업, 완료 조건 아님"으로 표시하고 `- [ ]`로 남길 수 있다.
