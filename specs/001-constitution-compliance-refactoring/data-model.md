# 데이터 모델 및 상태 전이 설계

**Feature**: `001-constitution-compliance-refactoring` | **Date**: 2026-11-15
**Spec**: [`spec.md`](./spec.md) | **Research**: [`research.md`](./research.md)

본 문서는 리팩토링 대상 도메인 모델, 기존 데이터 하위 호환 스키마(`FR-010`), WebDAV 자격증명 분리·마이그레이션 모델(`FR-009`), 신뢰 호스트 동의 상태 및 성능 기준선 데이터 구조를 정의합니다.

---

## 1. 기존 도메인 계약 (하위 호환 불변)

[`src/types/index.ts`](../../src/types/index.ts)에 정의된 핵심 도메인 계약은 스키마 변경 없이 100% 보존합니다(`FR-006`, `FR-010`).

| 엔터티 | 저장 위치 / 키 | 핵심 필드 | 불변식 및 검증 규칙 |
| :--- | :--- | :--- | :--- |
| **`BookMeta`** | `platformStorage` (`library_books`) | `id`, `title`, `author`, `format` (`'txt' \| 'epub'`), `fileSize`, `isOfflineCached`, `fileName?`, `storedPath?`, `addedAt`, `lastOpenedAt`, `lastLocation?` | `id` 고유, `fileSize >= 0`, `format`은 `'txt'` 또는 `'epub'`만 허용 |
| **`ReadingLocation`** | `BookMeta.lastLocation` 및 `SyncPayload.positions` | `bookId`, `locator`, `percentage` (`0~100`), `chapterTitle?`, `updatedAt`, `deviceId` | `0 <= percentage <= 100`, 동기화 병합 시 `remote.updatedAt > local.updatedAt` 우선 |
| **`BookmarkItem`** | `platformStorage` (`library_bookmarks`) | `id`, `bookId`, `locator`, `percentage`, `title`, `excerpt`, `createdAt` | `bookId` 기준 정렬, 중복 `id` 금지 |
| **`ViewerSettings`** | `platformStorage` (`viewer_settings`) | `viewMode` (`'scroll' \| 'paginated'`), `theme` (`'light' \| 'dark' \| 'sepia'`), `fontFamily`, `fontSize` (`12~32`), `lineHeight` (`1.2~2.4`), `pageMargin` (`16~64`), `autoSync`, `syncEndpoint` | 범위 클램핑 유지, 테마는 `light`/`dark`/`sepia` 3종 지원 |

---

## 2. WebDAV 연결 및 자격증명 분리 모델 (`FR-009`, `FR-010`)

### 2.1 연결 프로필 (`WebDavConnection` — `webdav_history`)
기존 `WebDavConnection` 타입에서 `password?` 필드를 **영구 이력 레코드에서는 저장하지 않거나(신규 저장 시 제외) 마이그레이션 시 제거**합니다.

- **유지 필드**: `id`, `alias`, `url`, `username`, `initialPath`, `lastConnectedAt`
- **신규 선택 메타 필드**:
  - `rememberPassword?: boolean` (기본값 `false` — 세션 메모리만 유지)
  - `credentialScope?: 'session' | 'native-secure' | 'web-acknowledged'`
- **하위 호환 마이그레이션 (`v1 → v2`)**:
  1. `loadWebDavHistory()` 최초 실행 시 `item.password`가 비어 있지 않은 레코드를 탐지한다.
  2. 해당 `item.password`를 즉시 세션 메모리 캐시로 적재하고, 사용자가 기존 자동 로그인 편의를 유지한 경우 네이티브 안전 저장소(또는 이관 대기 상태)로 분리 저장할 수 있도록 처리한 뒤 `webdav_history` JSON에서는 `password` 필드를 제거(`delete record.password`)하여 다시 저장한다.
  3. 마이그레이션 중 `id`, `alias`, `url`, `username`, `initialPath`, `lastConnectedAt` 값은 단 1바이트도 손실하지 않는다.

### 2.2 자격증명 상태 전이

```text
[미입력] ──(사용자 입력, 저장 미선택)──▶ [SessionMemoryOnly] (앱 종료 시 파기)
   │
   └──(사용자 입력 + "비밀번호 기억" 명시 체크)──▶ {실행 환경 판별}
         ├─ (Tauri 네이티브) ──▶ [NativeSecureCredential] (`tauri-plugin-keyring-store` OS 키체인/키스토어 분리 보관)
         └─ (웹 브라우저, 경고 동의 시) ──▶ [WebAcknowledgedCredential] (별도 격리 키 보관 + 경고 표시)
```

---

## 3. 신뢰 원격 호스트 및 보안 동의 모델 (`FR-009`)

사용자가 사설 IP/로컬 호스트(`.local`) 개인 NAS 또는 자체 서명 TLS 인증서 서버에 접속할 때 명시적 동의를 추적하기 위한 엔터티입니다.

```typescript
export interface TrustedRemoteHostConsent {
  /** 정규화된 호스트 식별자 (예: "192.168.0.10:5006" 또는 "nas.local") */
  hostKey: string
  /** 사설망(RFC 1918 / .local) 접속에 대한 사용자 명시적 확인 여부 */
  allowPrivateNetwork: boolean
  /** 자체 서명/비신뢰 TLS 인증서 예외에 대한 사용자 명시적 동의 여부 */
  allowSelfSignedTls: boolean
  /** 동의 일시 (Unix timestamp ms) */
  consentedAt: number
}
```

- **검증 규칙**:
  - `127.0.0.0/8`, `0.0.0.0/8`, `::1`, `169.254.0.0/16`, `fe80::/10` 등 **고위험 내부 주소**는 `TrustedRemoteHostConsent`로도 절대 허용 불가(`MUST NOT`).
  - `allowPrivateNetwork === false`인 사설 IP/로컬 도메인은 연결 시 사용자 확인 프롬프트 승인 후 `true`로 전이된다.
  - `allowSelfSignedTls === false`인 상태에서 TLS 인증서 검증 실패 시 연결을 즉시 중단하고, 사용자가 명시적으로 예외를 승인한 경우에만 `true`로 기록한다.

---

## 4. 플랫폼 기능 역량 매트릭스 (`PlatformCapabilities`, `FR-004`)

| 기능 역량 | 데스크톱 (Windows/macOS/Linux) | 모바일 (Android/iOS) | 웹 브라우저 |
| :--- | :---: | :---: | :---: |
| 커스텀 저장 폴더 선택/열기 | 지원 (`allow_storage_dir`, `tauri-plugin-opener` `openPath`; 비샌드박스 또는 Sandbox 시 `tauri-plugin-persisted-scope` 필요) | 미지원 (앱 내부 `books/<id>.bin`) | 미지원 (`IndexedDB`) |
| 삭제 시 로컬 파일 삭제 확인 다이얼로그 | 지원 (네이티브 확인 다이얼로그) | 미지원 (내부 캐시 즉시 삭제) | 미지원 (UI 확인 또는 즉시 삭제) |
| 파일 선택기 (`.txt`, `.epub`) | 네이티브 파일 다이얼로그 | 네이티브 파일 다이얼로그 | HTML `<input type="file">` |
| 파일 드래그앤드롭 | 네이티브 Webview 경로 드롭(`dragDropEnabled: true` 단일 경로, `sourcePath` 인플레이스 보존) | 해당 없음 / 폴백 | HTML5 `DataTransfer` |
| 원격 HTTP/WebDAV 요청 | Rust `safe_remote_fetch` 단일 게이트 (`tauri-plugin-http` 제거) | Rust `safe_remote_fetch` 단일 게이트 (`tauri-plugin-http` 제거) | 동일 출처 `/__remote_proxy` (Dev/Preview; 프록시 미마운트 정적 호스팅에서는 `public` URL에 한해 제한적 직접 `fetch`) |

---

## 5. 성능 기준선 기록 모델 (`PerformanceBaselineRecord`, `FR-012`, `SC-006`)

```typescript
export interface PerformanceMetricSample {
  /** 측정 구간 식별자 */
  metric: 'library_init_ms' | 'large_txt_open_ms' | 'view_mode_toggle_ms' | 'theme_switch_ms'
  /** 워밍업 제외 반복 측정 raw 샘플 (ms) */
  samplesMs: number[]
  /** 중앙값 p50 (ms) */
  medianMs: number
}

export interface PerformanceBaselineReport {
  capturedAt: string
  /** OS/CPU/Playwright 브라우저 식별자 (동일 environment 일치 검증용) */
  environment: string
  /** library_init_ms 측정을 위해 고정 시드된 메타데이터 권수 (예: 50) */
  seededBookCount: number
  warmupRuns: number
  measuredRuns: number
  metrics: PerformanceMetricSample[]
}
```

- **회귀 판정 식**: `deltaMs = after.medianMs - before.medianMs`, `ratio = deltaMs / Math.max(before.medianMs, 1)`. `deltaMs > 15 && ratio > 0.10`이면 회귀 실패(`SC-006`).
- **환경 일치 규칙**: `after.environment !== before.environment`이거나 `after.seededBookCount !== before.seededBookCount`이면 직접 수치 비교를 거부하고, 동일 환경의 기준 커밋에서 기준선을 재측정한 뒤 비교한다.
