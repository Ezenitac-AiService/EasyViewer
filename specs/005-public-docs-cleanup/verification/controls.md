# 조작 방법 근거 (T013, FR-005)

README "조작 방법"/"Controls" 표의 항목마다 그 동작을 확인하는 자동 테스트다. 구현: `src/composables/reader/useReaderNavigation.ts`(`handleKeydown`, `handleReaderTap`), `src/composables/ui/useAccessibleDialog.ts`.

| 조작 | 동작 | 테스트 |
|---|---|---|
| `→` / `←` (쪽 넘김 모드) | 다음 / 이전 쪽 | `tests/unit/readerViewOrchestration.spec.ts`(ArrowRight, ArrowLeft), `tests/e2e/reader-txt.spec.ts`(ArrowRight) |
| `↓` / `↑` (스크롤 모드) | 다음 / 이전 화면 | `tests/unit/readerNavigation.spec.ts` "scroll mode uses the up and down arrows" |
| `PageDown` / `PageUp` | 다음 / 이전 | `tests/unit/readerNavigation.spec.ts` "PageUp and PageDown" |
| `Space` | 다음 | `tests/unit/readerViewOrchestration.spec.ts`(' ') |
| `Ctrl`/`Cmd`+`F` | 검색 서랍 열기 | `readerViewOrchestration.spec.ts`(Ctrl), `readerNavigation.spec.ts`(Cmd) |
| `Ctrl`/`Cmd`+`B` | 현재 위치 책갈피 토글 | `readerNavigation.spec.ts` "Ctrl+B or Cmd+B" |
| `Esc` | 서랍·설정 닫기 | `readerViewOrchestration.spec.ts`(서랍), `readerNavigation.spec.ts`(설정) |
| 클릭·탭 (쪽 넘김 모드) | 아래쪽 1/3·가운데 오른쪽 → 다음, 가운데 왼쪽 → 이전, 나머지 → 메뉴 표시 토글 | `readerNavigation.spec.ts` "paginated mode" |
| 클릭·탭 (스크롤 모드) | 메뉴 표시 토글 | `readerNavigation.spec.ts` "scroll mode: a tap only toggles the menu" |
| 대화상자 `Esc` / `Tab` | 닫기 / 초점 순환 | `tests/unit/accessibleDialog.spec.ts`, `tests/e2e/accessibility-and-ux.spec.ts` |

표에서 뺀 조작: 없음. 모든 항목에 테스트가 있다.
