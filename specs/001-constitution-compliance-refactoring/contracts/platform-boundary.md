# 인터페이스 계약: 통합 플랫폼 추상화 경계 (`FR-004`, `FR-005`)

**Location**: `src/services/platform/` & `src/services/storage/platformAdapter.ts`

상위 계층(`src/views/`, `src/stores/`, `src/components/`)은 아래 계약만 호출하며 `@tauri-apps/*`, `localStorage`, `indexedDB`를 직접 참조하지 않습니다. (표준 UI 화면 제어인 `window` 리스너/`getSelection`/`document.documentElement` 클래스 조작은 `FR-005` 예외로 허용)

---

## 1. 파일/폴더 선택 및 확인 대화상자 포트 (`PlatformDialogPort`)

```typescript
export interface SelectedBookFile {
  name: string
  size: number
  sourcePath?: string
  /** 다중 대용량 파일 동시 선택 시 메모리 급증을 방지하기 위한 지연 버퍼 로더 */
  readBuffer(): Promise<ArrayBuffer>
}

export interface PickBookFilesResult {
  files: SelectedBookFile[]
  cancelled: boolean
}

export interface PlatformDialogPort {
  /** 도서 파일 선택 (.txt, .epub). 웹에서는 file input 폴백, Tauri에서는 네이티브 다이얼로그 또는 호환 선택기 사용 */
  pickBookFiles(): Promise<PickBookFilesResult>

  /** 데스크톱 전용 저장 폴더 선택. 미지원 환경에서는 null 반환 */
  pickStorageDirectory(currentDir?: string): Promise<string | null>

  /** 사용자 확인 대화상자 (네이티브 dialog 또는 브라우저 confirm 폴백) */
  confirmAction(options: {
    title: string
    message: string
    kind?: 'info' | 'warning'
    confirmLabel?: string
    cancelLabel?: string
  }): Promise<boolean>
}
```

---

## 2. 경로 해석 포트 (`PlatformPathPort`)

```typescript
export interface PlatformPathPort {
  /** 파일 경로에서 부모 디렉토리 경로 추출 (미지원 시 빈 문자열 또는 문자열 기반 상위 경로) */
  dirname(filePath: string): Promise<string>

  /** 파일명 추출 (Windows/POSIX 구분자 정규화) */
  basename(filePath: string): string
}
```

---

## 3. 드래그앤드롭 입력 포트 (`PlatformDragDropPort`)

```typescript
export interface DroppedBookInput {
  fileName: string
  buffer: ArrayBuffer
  /** 데스크톱 네이티브 드롭 시 원본 절대 경로 */
  sourcePath?: string
}

export interface PlatformDragDropPort {
  /**
   * 단일 정설 드롭 소스(Option A)를 구독한다:
   * - Tauri 환경(`isTauriEnv()` && `tauri.conf.json` `dragDropEnabled: true`): `getCurrentWebview().onDragDropEvent`만 단독 구독(`sourcePath` 유지 + `#[cfg(desktop)]` `read_validated_book_file` 화이트리스트 검증 및 `tauri::ipc::Response` 바이너리 읽기; HTML5 `window` 드롭 리스너 이중 등록 금지)
   * - 웹 브라우저 환경: HTML5 `window` `drag*`/`drop`(`DataTransfer`)만 구독
   * 반환된 cleanup 함수를 호출해 리스너를 해제한다.
   */
  subscribe(handlers: {
    onDragStateChange: (isDragging: boolean) => void
    onFilesDropped: (items: DroppedBookInput[]) => Promise<void> | void
    onError?: (err: unknown) => void
  }): Promise<() => void>
}
```

---

## 4. 원격 자격증명 및 호스트 동의 포트 (`PlatformCredentialPort`)

```typescript
export interface SetCredentialOptions {
  remember?: boolean
  /** 웹 환경에서 로컬 저장 한계 안내에 사용자가 동의했는지 여부 */
  webStorageConsent?: boolean
}

export interface PlatformCredentialPort {
  getPassword(connectionId: string): Promise<string>
  setPassword(connectionId: string, password: string, options?: SetCredentialOptions): Promise<void>
  removePassword(connectionId: string): Promise<void>
  /** 기존 평문 저장 이력 목록을 일괄 스캔해 안전 저장소/세션으로 이관하고 평문 password 필드를 제거 */
  migrateLegacyPlaintext(connections: WebDavConnection[]): Promise<{
    sanitized: WebDavConnection[]
    migratedCount: number
  }>
}
```

---

## 5. 기존 저장소·네트워크 계약과의 통합 규칙

- 기존 [`PlatformStorageAdapter`](../../src/services/storage/platformAdapter.ts)의 `getStorageDir`, `setStorageDir`, `openStorageDir`(@tauri-apps/plugin-opener `openPath` + 사전 `allow_storage_dir` 검증 경유), `allowStorageDirs`, `saveBookFile`, `loadBookBinary`, `removeBookBinary`, `setItem`, `getItem` 시그니처는 하위 호환을 위해 그대로 유지한다.
- `LibraryView.vue`의 `open`, `ask`, `getCurrentWebview`, `readFile` 직접 import는 `PlatformDialogPort` 및 `PlatformDragDropPort` 호출로 대체한다.
- `useBookStore.ts`의 `@tauri-apps/api/path` `dirname` 직접 import는 `PlatformPathPort.dirname` 호출로 대체한다.
