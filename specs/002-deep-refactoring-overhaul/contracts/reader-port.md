# 계약 1: 문서 뷰어 포트·비차단 색인·CSS AST 정화 (`FR-002`, `FR-008`, `FR-010`, `FR-012`)

**Feature**: `002-deep-refactoring-overhaul` | **Date**: 2026-11-16

---

## 1. `DocumentReaderPort` (`src/engines/types.ts`)

본 포트는 리치 페이지드 EPUB 어댑터 계층(`EpubViewerEngine`)에 적용되며(TXT 가상/측정 스크롤 엔진은 `useTxtReaderController`·`TxtPaginationSession` 전용 컨트롤러로 분리 유지), 상위 뷰어 조율 계층(`ReaderView.vue`, `useReaderSession.ts`, `useReaderNavigation.ts`)은 특정 서드파티 렌더링 라이브러리(`epubjs` 등)를 직접 `import`하지 않고 본 포트를 통해서만 상호작용한다.

```ts
export interface ReaderLoadOptions {
  buffer: ArrayBuffer
  container: HTMLElement
  settings: ViewerSettings
  contentHash?: string
  initialLocator?: string
  initialPercentage?: number
  signal?: AbortSignal
  onRelocated?: (loc: ReaderLocationChange) => void
  onIndexReady?: (precisionReady: boolean) => void
}

export interface ExtractedEpubMetadata {
  title?: string
  author?: string
  coverBlob?: Blob | null
  coverBytes?: Uint8Array | null
  coverMime?: string | null
}

export interface DocumentReaderPort {
  setTapHandler(handler: ((clientX: number, clientY: number) => void) | null): void
  setKeyHandler(handler: ((event: KeyboardEvent) => void) | null): void
  loadBook(options: ReaderLoadOptions): Promise<{
    title: string
    author: string
    toc: TocItem[]
    precisionReady: boolean
    sectionCount: number
  }>
  goTo(target: string): Promise<void>
  goToPercentage(percentage: number): Promise<void>
  next(): Promise<void>
  prev(): Promise<void>
  scrollByScreen(direction: 1 | -1): void
  search(query: string): Promise<SearchResultItem[]>
  highlightSearchResult(locator: string): void
  applySettings(settings: ViewerSettings): Promise<void>
  destroy(): void
}
```

### 필수 불변식
1. **비동기 취소(`AbortSignal`) & `destroy()` 색인 중단**: `loadBook` 도중 `signal.aborted`가 되거나 `destroy()`가 호출되면 즉시 DOM/이벤트/타이머 및 진행 중인 백그라운드 `locationIndexer` 유휴 루프를 중단·정리하고 후속 `onRelocated`·`onIndexReady` 콜백을 절대 발행하지 않는다 (`FR-010`).
2. **레거시 `contentHash` 선행 확정 & 첫 화면 표시 이후 비차단 색인(`FR-006`, `FR-008`, `SC-003`)**:
   - `location_indexes` IndexedDB 캐시 키가 `contentHash`이므로, 아직 `contentHash`가 없는 레거시 도서를 열 때 `useReaderSession`은 `loadBook` 실행 전(또는 색인 캐시 조회/저장 이전)에 `bookHasher`(데스크톱 `hash_validated_book_file` IPC 또는 로드된 버퍼 `SHA-256`)로 `book.contentHash`를 먼저 확정·저장한 뒤 `options.contentHash`로 전달한다.
   - `loadBook`은 어떠한 경우에도(`options.contentHash` 유무와 무관하게) `rendition.display()` 완료 전까지 전체 도서 `locations.generate()`를 동기 대기(`await`)하거나 먼저 실행해 메인 스레드를 점유해서는 안 된다.
   - `location_indexes` IndexedDB/메모리 캐시에 동일 `contentHash` 색인이 있으면 `rendition.display()` 전에 즉시 로드한다(`precisionReady: true`).
   - 캐시 미적중 시: 섹션 스파인 엔트리 비중 기반 근사 진행률·슬라이더 탐색을 먼저 활성화(`precisionReady: false`)하여 **`rendition.display()`로 첫 페이지 화면 표시를 완료한 직후** 백그라운드에서 `locations.generate(150)` 점진 색인 생성을 시작하고, 완료 시 현재 화면 CFI 위치(`rendition.location.start.cfi`)를 이동시키지 않고 백분율 정밀도만 갱신한 뒤 `onIndexReady(true)`와 캐시 저장을 수행한다.
3. **EPUB 2/3 메타데이터 및 표지 추출 호환 계약 (`ExtractedEpubMetadata`, `FR-007`)**:
   - 네이티브(`extract_epub_metadata_from_path`) 및 웹(`extractEpubMetadata`) 추출기는 모두 EPUB 3 표준(`properties="cover-image"`)뿐 아니라 레거시 EPUB 2 표준(`<meta name="cover" content="<item-id>"/>` → `<item id="<item-id>" href="..."/>`) 표지 선언을 지원해야 한다.
   - OPF 기준 상대 경로(`../Images/cover.jpg`, `./cover.png`) 및 퍼센트 인코딩(`%20` 등)을 정규화하여 ZIP 엔트리를 조회하고, 제목·저자 텍스트의 기본 XML 엔티티(`&amp;`, `&lt;`, `&gt;`, `&quot;`, `&apos;`, 숫자형 `&#...;`/`&#x...;`)를 디코딩해야 한다.

---

## 2. CSS AST·XHTML/SVG 허용 목록 정화 계약 (`src/engines/epub/sanitizer.ts`)

`sanitizeSectionDocument(doc: Document)` 및 `sanitizeCssWithAst(cssText: string, isInlineStyle: boolean)` 규약:

1. **DOM·SVG 허용/차단 규약**:
   - 기존 `ACTIVE_ELEMENTS`에 더해 SVG/XML 능동 및 혼동 위험 태그(`foreignObject`, `use`, `animate`, `animateMotion`, `animateTransform`, `set`, `mpath`, `feImage`, `discard`, `script`, `handler`, `listener`, `iframe`, `frame`, `object`, `embed`, `applet`, `portal`, `base`, `meta[http-equiv=refresh]`)를 네임스페이스·대소문자 무관하게 `localName.toLowerCase()` 기준으로 제거한다.
   - `<link>` 요소 중 안전 내부 CSS 스타일시트(`rel="stylesheet"` 이면서 허용된 로컬/상대/`blob:` URI) 외 `rel="preload"`, `rel="prefetch"`, `rel="icon"` 또는 외부 `http:`/`https:` 스타일시트 링크는 차단·제거한다.
   - URL 검사 대상 속성(`href`, `xlink:href`, `src`, `srcset`, `poster`, `ping`, `background`, `action`, `formaction`, `data`, `srcdoc`)에 대해 **명시적 안전 URI 허용 목록(상대 경로, `#fragment`, `blob:`, 안전한 래스터 `data:image/{png,jpeg,jpg,gif,webp,avif}`)** 을 적용한다. 리소스 적재·폼 전송 속성(`src`, `srcset`, `poster`, `ping`, `background`, `action`, `formaction`, `data`, `srcdoc`, 비앵커 `href`/`xlink:href`)에서 외부 `http:`/`https:` 및 모든 위험 스킴(`javascript:`, `vbscript:`, `data:text/html`, `data:image/svg+xml`)을 기본 거부(Default-Deny)로 제거한다.
2. **CSS AST 파서 허용 목록 정화 규약 (`css-tree ^3.2.1`)**:
   - `<head>`·본문·`<svg>` 내부의 모든 `<style>` 요소 내용과 인라인 `style=""` 값을 `csstree.parse()`(`context: isInlineStyle ? 'declarationList' : 'stylesheet'`)로 일괄 파싱·순회한다.
   - **허용 목록 기반 URI/규칙 검증**: `@import`, `@namespace`는 무조건 제거하고, `@media`·`@supports`·`@container`·`@font-face` 및 일반 선언 내부의 모든 `Url`/`String` URI는 안전 허용 목록(내부 상대 경로, `#fragment`, `blob:`, 안전한 래스터 `data:image/{png,jpeg,jpg,gif,webp,avif}`)에 부합하지 않으면(외부 `http:`/`https:`, `javascript:`, `vbscript:`, `data:text/html`, `data:image/svg+xml` 등) 해당 선언/규칙을 제거한다. 또한 비표준 `expression()`/`attr()` 함수와 속성 선택자(`input[value...]` 등) 결합 외부 URI 유출 패턴을 차단한다.
   - **파싱 실패 폴백(Fail-Closed)**: 구문 오류가 심해 `css-tree`가 복구 불가능한 악의적/기형 CSS 블록은 통과시키지 않고 비워 차단한다.
   - 생성 결과는 `csstree.generate()`로 정규화해 인라인 `style` 또는 `<style>`에 재기록한다.
3. **메타 CSP & WebKit 상호작용 보존 방어**: 기존 `<head>` 내 `Content-Security-Policy` 메타 태그 주입(`CONTENT_CSP`: `script-src 'none'`, `object-src 'none'`, `frame-src 'none'`, `worker-src 'none'`, `form-action 'none'`, `base-uri 'none'`, `connect-src 'none'`)을 최상단에 삽입한다. macOS WKWebView·iOS WebKit에서 `sandbox`가 스크립트를 막으면 부모 앱의 터치/클릭 리스너까지 차단되므로 `epubjs` `rendition`의 `allowScriptedContent: true` 설정(`FR-002`·`FR-015` 상호작용 보존)은 유지하고, 대신 위 `CONTENT_CSP` + DOM/SVG 허용목록 + `css-tree` AST 다층 정화로 콘텐츠 스크립트·외부 유출을 원천 차단한다.
