# 데이터 모델 및 저장소 마이그레이션 계약 (`002-deep-refactoring-overhaul`)

**Feature**: `002-deep-refactoring-overhaul` | **Date**: 2026-11-16 | **Spec**: [spec.md](./spec.md)

---

## 1. IndexedDB 스키마 (`EasyViewerDB`, `DB_VERSION = 2`)

단일 연결 싱글턴(`src/services/storage/idbClient.ts`)이 아래 4개 Object Store를 관리한다. 멀티탭 스키마 업그레이드 교착을 방지하기 위해 연결 수립 시 `db.onversionchange = () => { db.close(); resetIdbSingleton(); }` 및 `req.onblocked` 핸들러를 반드시 등록하고, 테스트 격리를 위한 `resetIdbClientForTests()`를 제공한다.

| Store 이름 | 키(Key) | 값(Value) | 비고 |
| :--- | :--- | :--- | :--- |
| `book_files` | `bookId: string` | `ArrayBuffer` | 웹/모바일 fallback 및 비저장폴더 도서 바이너리 |
| `book_covers` | `bookId: string` | `CoverAssetRecord` (`{ blob: Blob, mimeType: string, updatedAt: number }`) | UI 렌더링 시 `URL.createObjectURL(blob)` 생성, **`LibraryView`/도서 삭제/표지 교체/언마운트 시 `revokeObjectURL`** 해제 (`FR-004`) |
| `location_indexes` | `contentHash: string` | `LocationIndexCacheRecord` (`{ schemaVersion: 1, stepChars: number, locations: string[], sectionCounts: number[], updatedAt: number }`) | 지문별 EPUB 위치 색인 재사용 캐시 (`FR-008`) |
| `key_value` | `string` | 직렬화 문자열 (`library_books_v1`, `reading_positions_v1`, `bookmarks_v1`, `trusted_remote_host_consents_v1`, `easyviewer_settings_v1`, `webdav_history_v2`) | 페이지 전환 시 `reading_positions_v1` 단독 기록 가능 (`FR-004`) |

> **`localStorage` 정책 (`FR-004`)**:
> - `library_books_v1`, `reading_positions_v1`, `bookmarks_v1` 같은 가변 대용량 목록은 **더 이상 `localStorage`에 중복 쓰기하지 않는다**(읽기 시 레거시 폴백/마이그레이션 전용).
> - `localStorage`에는 소형 UI 설정 플래그 또는 레거시 호환 키만 제한적으로 남긴다.

---

## 2. 핵심 엔티티 변경 명세

### 2.1 `BookMeta` (경량 메타데이터)

| 필드 | 타입 | 변경/제약 |
| :--- | :--- | :--- |
| `id` | `string` | 기존 도서 ID 보존 (`FR-006`); 신규 추가 도서는 `sha256-...` 기반 또는 콘텐츠 지문 파생 ID 사용 (`SyncPayload` 병합 시 `bookId` 우선 매칭 후 미적중 항목 중 로컬 도서의 `contentHash`가 일치하는 경우 해당 로컬 `id`로 연결해 구버전·신규 ID 간 동기화 일관성 보장) |
| `contentHash` | `string \| undefined` | *(신규)* 전체 파일 `SHA-256` 해시 (`sha256-<hex>`). 미보완 레거시 도서는 동일 `fileSize` 재등록 시 온디맨드 계산 또는 열람·유휴 시 점진 보완 |
| `hasCover` | `boolean \| undefined` | *(신규)* `book_covers` 스토어에 표지 바이너리 존재 여부 |
| `coverUrl` | `string \| undefined` | *(폐기/런타임 전용)* **영속 JSON(`library_books_v1`)에는 Base64 `data:` URI를 저장하지 않음**. 런타임 표시 시에만 메모리 캐시된 `blob:` Object URL을 바인딩하고 정리 시 해제 |
| `title`, `author`, `format`, `fileSize`, `sourceUrl`, `storedPath`, `fileName`, `addedAt`, `lastOpenedAt`, `lastLocation` | 기존 유지 | 하위 호환 유지 |

### 2.2 `BookMetaMigrationV1toV2` (무손실 업그레이드 상태 전이)

1. `initLibrary()`가 `library_books_v1`을 로드할 때, 어떤 항목이 Base64 `data:` URI 형태의 `coverUrl`을 갖고 있으면:
   - `data:` URI를 디코딩해 `Blob`으로 변환 → `book_covers` 스토어에 `bookId` 키로 저장
   - 메타 객체에 `hasCover = true` 설정 및 `coverUrl` 필드 제거
   - `library_books_v1`을 `key_value` 스토어에 재저장하고, 레거시 `localStorage`의 비대 키(`library_books_v1`, `reading_positions_v1`, `bookmarks_v1` 폴백 잔여물)를 안전 정리한다(다른 기기/세션 영향 없이 무손실).
2. `positions` 갱신(`saveReadingLocation`)은 `reading_positions_v1`만 별도 키로 기록하며, `lastOpenedAt` 변경이 필요한 경우(열람 시작 또는 위치 플러시 시점)에만 경량 `library_books_v1`(표지 제거 상태)을 저장한다. 또한 `ReaderView` 언마운트·`beforeunload`·`visibilitychange === 'hidden'` 시 디바운스 타이머를 즉시 `flush()`한다 (`FR-005`).

### 2.3 `WebDavConnection` (`FR-003` 정적 웹 강화)

- **네이티브 및 보안 프록시 활성화 환경**: 기존 `v2` 규칙(`tauri-plugin-keyring-store` 분리 또는 프록시 세션 논스) 유지.
- **비프록시 정적 웹 환경 (`hasSecurityProxy === false`)**:
  - `url` 스킴이 `https:`가 아닌 상태에서 인증 정보(`username`/`password`) 포함 요청 시 **항상 거부**.
  - `rememberPassword` / 브라우저 영구 저장 비활성화 — 비밀번호는 현재 메모리 세션(`SessionCredentialMap`)에만 유지.
  - 해당 HTTPS 오리진에 대한 사용자 명시적 직접 연결 동의(`allowDirectWebDavOrigin: boolean` in-memory or session consent) 이후에만 `fetch(..., { headers: Authorization })` 허용.

### 2.4 `StorageWriteError` (`FR-005`)

- 데스크톱에서 `writeFile`/`allow_storage_dir` 실패 시 IndexedDB로 폴백하지 않고 `StorageWriteError` (`code: 'STORAGE_DIR_WRITE_FAILED'`, `targetDir`, `causeMessage`)를 던져 라이브러리 UI의 복구 모달(`기본 앱 저장 폴더로 전환 후 재저장` / `다른 폴더 선택`)을 트리거한다.

### 2.5 `NativeDownloadResult` (`FR-007`)

- Rust `safe_download_to_storage` 반환 계약:
  - `storedPath: string` (승인된 저장 폴더 내 저장 경로)
  - `fileName: string` (정화된 최종 파일명)
  - `fileSize: number`
  - `contentHash: string` (`sha256-<hex>`)
  - `finalUrl: string`
  - `detectedFormat: 'epub' | 'txt'`
- Rust → UI 진행률 `Channel<DownloadProgressEvent>`: `{ receivedBytes: number, totalBytes?: number, percent: number }`
