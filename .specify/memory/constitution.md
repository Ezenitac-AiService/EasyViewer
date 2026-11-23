# EasyViewer Constitution

## Core Principles

### I. 언어 및 커뮤니케이션 원칙 (Language & Communication Policy)
사용자에게 제공하는 모든 질문, 답변, 아키텍처 보고서, 명세서(`spec.md`), 구현 계획서(`plan.md`),
작업 목록(`tasks.md`), 체크리스트 및 프로젝트 문서는 반드시 **한국어(Korean)**로 작성해야 한다(MUST).
모든 **Git 커밋 메시지** 역시 반드시 **한국어(Korean)**로 작성해야 하며(MUST), Conventional Commits
타입 접두사(`feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `perf:`, `test:`, `build:`, `ci:`, `chore:` 등)와
핵심 목적을 드러내는 한국어 요약 제목을 작성한 뒤, 빈 줄을 두고 본문에 ① 변경 이유(Why), ② 핵심 수정 내용(What),
③ 영향 범위·검증 결과(Scope & Verification)를 누락 없이 구체적으로 서술해야 한다(MUST). 구현 소스 코드
(변수·함수·타입 식별자, 코드 내 기술 주석, 테스트 코드 등)는 **영어(English)**를 기본으로 작성해야
하며(MUST), 에이전트의 내부 추론(Thinking/Reasoning) 역시 **영어(English)** 사용을 권장한다(SHOULD).

**GitHub 공개 문서 국문·영문 병행 정책**: 저장소 루트의 공개 문서(`README`, `CONTRIBUTING`,
`SECURITY`, `CHANGELOG`, `NOTICE`, `THIRD_PARTY_LICENSES`)는 한국어 기본 문서(`*.md`, 고지 문서는
`NOTICE`)와 내용이 동기화된 영문판(`*.en.md`, 고지 문서는 `NOTICE.en.md`)을 함께 유지해야 한다(MUST).

- 두 문서의 맨 위에는 양방향 언어 전환 링크(`**언어 / Language**: [한국어](…) | [English](….en.md)`)를
  두어야 한다(MUST).
- 한쪽 문서를 고치는 변경은 같은 변경 안에서 다른 쪽 문서도 고쳐야 한다(MUST). 영문판만 늦게 맞추는
  분리 커밋은 허용하지 않는다(MUST NOT).
- 원문이 기준이다. 두 판이 어긋나면 한국어 기본 문서를 따르며, 법적 고지(`NOTICE`, 라이선스 표)의
  영문판은 참고 번역임을 밝혀야 한다(MUST).
- `.github/ISSUE_TEMPLATE/` 양식은 한·영 병기 라벨과 안내를 써야 한다(MUST).
- `specs/`, `.specify/`, `.agents/`, `.claude/`, `docs/`의 상세 문서·명세와 커밋 메시지는 병행 대상이
  아니며 위의 한국어 규칙을 따른다.

근거(Rationale): 산출물과 변경 이력의 가독성·추적성을 극대화하는 동시에 소스 코드의 글로벌 표준
호환성을 유지하며, 자동 검사 가능한 구조 중심으로 언어 규범을 명확히 적용한다. 독립 포크로 분리된 뒤
저장소 첫 화면과 신고·기여·고지 문서는 한국어를 읽지 못하는 사용자에게도 닿아야 하므로 공개 문서만
영문판을 병행하고, 형제 프로젝트 `Ezenitac-AiService/ImageViewer`(헌법 v2.2.0)와 같은 방식을 따른다.

### II. 테스트 주도 개발 및 무테스트 구현 금지 (Test-Driven Development — NON-NEGOTIABLE)
**테스트 없는 기능 구현은 엄격히 금지한다(MUST NOT).** 모든 신규 기능, 문서 엔진 로직, 스토리지/
네트워크/동기화 서비스 및 버그 수정은 반드시 자동화된 테스트 코드로 검증되어야 한다(MUST). 프론트엔드
단위·컴포넌트 테스트는 **Vitest + `@vue/test-utils` + `jsdom` + `@tauri-apps/api/mocks`**를,
Rust 백엔드 테스트는 **`cargo test`**를 표준으로 사용하며, `jsdom`으로 재현할 수 없는 실제 레이아웃·CSP
동작은 실제 브라우저 렌더링 테스트로 보완해야 한다(MUST). 모든 구현 계획(`plan.md`, `tasks.md`)은
**테스트 주도 개발(TDD: Red → Green → Refactor)** 주기에 따라 실패하는 테스트 작성(Red) → 구현
(Green) → 리팩터링(Refactor) 순서로 구성해야 한다(MUST). 단, 저장소에 테스트 러너가 아직 구축되지
않은 초기 상태에서는 최초 기능 구현 또는 테스트 도입 작업의 최우선 선행 태스크로 `npm test` 스크립트와
표준 테스트 하네스를 먼저 구축해야 한다(MUST).

근거(Rationale): 구현 전에 요구사항과 엣지 케이스를 실행 가능한 명세로 고정해 회귀 결함을 방지하며,
테스트 도구가 부재한 저장소에서도 실행 가능한 부트스트랩 경로를 보장한다.

### III. 구현 무결성 및 우회 로직 금지 (Implementation Integrity & Anti-Bypass)
**하드코딩(Hardcoding), 실제 비즈니스/엔진 로직을 대체하는 목업(Mockup/Stub 방치), 또는 오직 테스트
코드를 통과하는 것만을 목적으로 하는 우회 로직(Test-Passing Workaround)의 작성을 엄격히 금지한다
(MUST NOT).** 프로덕션 코드는 테스트 입력값에 맞춘 조건 분기나 고정 반환값을 포함해서는 안 되며(MUST NOT),
실제 런타임 데이터와 경계 조건에서 완전하게 동작하는 정식 알고리즘과 아키텍처 경로로 구현되어야 한다
(MUST). 테스트 대역(Mock/Fake/Spy)은 테스트 코드 내부에서 외부 I/O 및 플랫폼·런타임 API 경계(Tauri
IPC `mockIPC`, 파일 시스템, 네트워크, `IndexedDB`/`localStorage`, 브라우저 DOM/레이아웃 API)를
격리하기 위한 용도로만 제한적으로 허용된다(MUST).

근거(Rationale): 테스트 통과만을 노린 기만적 우회 구현을 차단하면서도, Tauri v2 공식 `mockIPC` 및
프론트엔드 단위 테스트 패턴에 부합하는 안전한 경계 격리를 허용한다.

### IV. 리서치 기반 검증 및 근거 확보 (Evidence-Based Research & Verification)
검토(Review), 검증(Verification), 평가(Evaluation), 분석(Analysis)의 근거를 **독자적인 추측이나
검증되지 않은 가정만으로 도출해서는 안 된다(MUST NOT).**
- **외부 기술·아키텍처·보안·성능 판단**: 라이브러리 선택, Tauri/웹 API 활용, 보안(CSP·권한),
  성능 최적화, 최신 보안 권고·의존성 호환성 및 코드 리뷰의 기술적 기준은 반드시 **공식 레퍼런스,
  공식 가이드, 검증된 우수 사례(Best Practices), 표준 명세**를 리서치하여 객관적 출처를 계획서·
  검토 문서에 명시해야 한다(MUST).
- **내부 정합성·사실 검증**: 기존 코드와 문서의 일치 여부를 점검할 때에는 반드시 **직접 확인한
  파일 경로, 심볼, 설정값, 빌드·테스트 실행 출력** 등 관찰 가능한 아티팩트를 근거로 제시해야
  한다(MUST).

근거(Rationale): 외부 기술 결정에는 최신 공식 표준을 적용하고 내부 검증에는 실측 코드 사실을 요구해
추측성 오류와 불필요한 리서치 오버헤드를 동시에 방지한다.

### V. 크로스 플랫폼 추상화 및 포맷 독립 엔진 아키텍처 (Cross-Platform & Engine Modularity)
파일 시스템 접근, 영속 데이터 저장, 네트워크/WebDAV/동기화 원격 통신, 시스템 다이얼로그, 경로
처리, 네이티브 드래그앤드롭 등 플랫폼 분기가 필요한 기능은 통합 플랫폼 추상화 계층
(`src/services/platform/`, `src/services/storage/`, `src/services/network/`)을 경유해야 하며(MUST),
지원 플랫폼 등급(기술 스택 및 플랫폼 제약사항의 "지원 플랫폼 등급")에 따라 중점 플랫폼(macOS, iOS,
Linux)과 유지 플랫폼(Android), 그리고 개발 보조 웹 폴백(`IndexedDB`, `localStorage`, `File API`)에서
일관되게 동작해야 한다(MUST). 비지원 플랫폼(Windows)을 대상으로 하는 코드 경로는 별도 명세로 제거하기
전까지 추상화 계층 안에 유지하고, 컴파일과 자동 테스트를 계속 통과해야 한다(MUST). 검증되지 않는
플랫폼 코드를 방치해서는 안 된다(MUST NOT). 기존 뷰·스토어·동기화 서비스(`LibraryView.vue`,
`useBookStore.ts`, `syncService.ts` 등)에 남아 있는 직접 `@tauri-apps/*` 및 외부 `fetch` 호출부는
신규 기능 추가나 해당 모듈 수정 시 추상화 계층으로 점진 이관해야 하며(MUST), 신규 코드에서 상위 계층이
플랫폼 플러그인이나 환경 분기 API를 직접 호출하는 것은 금지한다(MUST NOT). 데스크톱 전용 사용자 저장
폴더 권한(`allow_storage_dir`, `open_folder`, `storedPath`)과 모바일·웹 내부 저장소(`books/<id>.bin`)의
동작 차이는 추상화 계층 내부에서 캡슐화해야 한다(MUST). 또한 EPUB(`src/engines/epub/`) 및 TXT
(`src/engines/txt/`) 엔진은 공통 도메인 계약(`src/types/index.ts`의 `ReadingLocation`, `BookmarkItem`,
`TocItem`, `SearchResultItem`)을 통해 뷰 및 Pinia 스토어(`src/stores/`)와 분리되어야 하며(MUST),
보기 모드(`scroll` ↔ `paginated`)나 테마·글꼴 변경 시 사용자의 독서 위치를 정확히 보존해야 한다(MUST).

근거(Rationale): 지원 등급별 플랫폼과 다중 문서 포맷 간 호환성을 유지하면서도, 현행 코드베이스의 직접
호출부를 무리 없이 어댑터 계층으로 수렴시킬 수 있는 현실적 아키텍처 경계를 정의한다. 배포하지 않는
플랫폼 코드도 검증을 유지해야 보안 결함이 숨지 않는다.

### VI. 지속적 의심과 다층 검증 원칙 (Skeptical Verification & Non-Complacency)
어떠한 명세, 설계, 코드, 설정, 외부 응답 또는 테스트 결과도 **완벽하거나 오류가 없다고 가정해서는
안 된다(MUST NOT).** 모든 산출물과 변경은 완료를 선언하기 전에 반드시 다음 4단계 절차를 수행해야
한다(MUST):
1. **의심(Question)**: 정상 경로 외에 모순, 충돌, 엣지 케이스, 악용 가능성, 환경 차이, 거짓 통과
   (False Confidence)가 없는지 적대적·비판적 시각으로 점검한다.
2. **확인(Check)**: 실제 파일 내용, 심볼, 의존성 버전, 권한 범위, 실행 명령 결과를 직접 대조한다.
3. **검토(Review)**: 일관성, 정합성, 정확성, 적합성, 성능, 보안, 최신성 기준에 대해 다각도로 교차
   평가한다.
4. **검증(Verify)**: 긍정 케이스와 부정/경계 위반 케이스 모두를 재현 가능한 자동화 검증으로 확인한다.
툴체인 부재·실기기 미보유 등으로 검증이 실행되지 못한 항목은 통과로 간주하거나 완료 처리해서는 안 되며
(MUST NOT), `BLOCKED` 미검증 범위와 후속 필수 검증 환경을 명확히 구분해 보고해야 한다(MUST).

근거(Rationale): 소프트웨어와 설계에는 완결된 무결점이 존재하지 않으므로, 합리적 의심과 실증 기반
다층 검증을 상시 규율로 고정해 누락·오류·회귀를 조기에 차단한다.

### VII. 제로 트러스트 보안 원칙 (Zero Trust Security & Untrusted Input Assumption)
**사용자, 도서 파일, 네트워크 경로, 원격 서버, 실행 환경을 이성적이고 정상적인 행위자로 신뢰해서는
안 되며(MUST NOT), 보안의 제1원칙으로 제로 트러스트(Zero Trust: "절대 신뢰하지 않고 항상 검증한다")를
적용해야 한다(MUST).**
- **비신뢰 기본 가정 및 기본 거부(Default-Deny)**: 로컬·원격에서 유입되는 모든 도서 콘텐츠(EPUB
  XHTML/CSS/SVG, TXT), 파일명·경로, URL·DNS 해석 결과·HTTP 리다이렉트 홉·응답 헤더, 자격증명 및
  클라이언트·플러그인 경계 요청은 악의적이거나 손상되었을 수 있다고 간주하고 기본 거부(Fail-Closed) 및
  엄격한 허용 목록(Allowlist)으로 검증해야 한다(MUST).
- **유입·저장·송신 전 경계 재검증**: 출처 검증(`Origin`/`Referer`), URL 정규화 및 소켓 IP 고정
  (DNS Rebinding/TOCTOU 방지), 매 리다이렉트 홉 재검증, 최소 권한 스코프(Capabilities/FS Scope),
  명시적 콘텐츠 보안 정책(CSP), 다중 콘텐츠 정화·샌드박스 격리, 플랫폼 안전 저장소를 이용한 자격증명
  분리 보관은 최초 진입 시점뿐 아니라 경계 이동 시마다 강제되어야 한다(MUST). 암호화 키와 암호문을
  동일 저장 영역에 보관하는 등 실효성 없는 보안 허상(Security Theater)은 금지한다(MUST NOT).
- **명시적·국소적 예외 승인**: 사설망 접속, 비신뢰 TLS 인증서, 자격증명 영구 저장 등 보안 위험을
  수반하는 동작은 암묵적으로 허용되거나 자동 우회되어서는 안 되며(MUST NOT), 위험 고지 후 사용자가
  해당 대상에 대해 명시적으로 승인한 범위에서만 최소 권한으로 허용해야 한다(MUST).

근거(Rationale): 정상 사용자·안전한 파일·선한 서버라는 암묵적 가정이 무너질 때 XSS, SSRF, 경로 탈출,
권한 상승, 자격증명 유출 등 치명적 침해가 발생하므로 모든 신뢰 경계를 코드와 정책으로 강제한다.

### VIII. 독립 포크 운영 원칙 (Independent Fork Governance)
EasyViewer 저장소(`Ezenitac-AiService/EasyViewer`)는 `edith2580/EasyViewer`의 `v0.1.6`(`44c4d37`, 불변
주석 태그 `upstream-base-v0.1.6`)에서 갈라진 **독립 포크**이며, 이 저장소가 배포하는 앱의 제품 표시명은
**`Pagelight`**이다. 다음을 지켜야 한다.
- **업스트림 병합·동기화 금지**: 업스트림 변경을 병합·체리픽·동기화해서는 안 된다(MUST NOT). 업스트림
  아이디어가 필요하면 별도 명세로 재구현한다(MUST). 단, 포크가 찾은 보안 결함이 원저작자 최신 릴리스에도
  남아 있으면 공개 비교나 공지 전에 원저작자에게 비공개로 알리거나 수정을 제안하고 그 기록을 남겨야
  한다(MUST). 이 보안 조율 기여는 병합 금지의 유일한 예외다.
- **표현 원칙**: 공개 문구(문서, 릴리스 노트, 앱 화면, 이슈 양식)는 포크 자신의 범위만 서술해야
  한다(MUST). 원저작자 프로젝트의 역할·의도·지원 범위를 대신 규정하거나, 원저작자가 동의하지 않은
  "역할 분담"·"경쟁하지 않는다" 같은 표현을 쓰거나, 원저작자 앱을 낮추어 평가해서는 안 된다(MUST NOT).
  원저작자 앱과의 비교는 검증 가능한 사실만 담아야 한다(MUST).
- **라이선스와 귀속**: 라이선스는 `GPL-3.0-only`로 선언하고 모든 패키지·설치 메타데이터에서 일치시켜야
  한다(MUST). 라이선스 전문을 바꾸지 않으며(MUST NOT), 원저작자 귀속 표기와 GPLv3 §5(a) 변경 사실·날짜
  고지를 유지해야 한다(MUST). 원래 없던 고지를 "보존된 원문"처럼 표현해서는 안 된다(MUST NOT).
- **구분되는 정체성**: 포크 앱은 원저작자 앱과 구분되는 제품 표시명(`Pagelight`)·설치 이름·패키지
  이름(`pagelight`, Rust 라이브러리 `pagelight_lib`)·앱 아이콘과 고유 앱 식별자를 써야 하며(MUST),
  원저작자 앱과 같은 기기에 함께 설치되어도 서로 덮어쓰거나 데이터·자격증명을 공유해서는 안
  된다(MUST NOT). 버전 번호만으로 포크를 구분해서는 안 되며, 릴리스 제목과 산출물 이름에 포크 정체성이
  드러나야 한다(MUST). 저장소 이름(`EasyViewer`)은 URL·이력 보존을 위해 유지하지만, 앱 안과 공개
  문서에서 원저작자 앱 이름은 출처 표기와 Windows 사용자 안내 목적으로만 써야 한다(MUST).
- **이력 보존**: 공유 브랜치의 이력 재작성(강제 푸시 등)과 저작권·출처 고지 삭제는 금지한다(MUST NOT).
  원저작자 유래 코드의 일반적인 수정·삭제는 허용한다.

근거(Rationale): 원저작자가 같은 이름의 멀티플랫폼 앱을 계속 배포하므로, 법적 의무·사용자 혼동·
원저작자에 대한 예의를 규범으로 고정해야 독립 운영이 지속 가능하다.

## 기술 스택 및 플랫폼 제약사항 (Technology Stack & Platform Constraints)

- **프레임워크 및 빌드 도구**: Vue 3 (`^3.5`, Composition API, `<script setup lang="ts">`),
  TypeScript (`~5.6`, `strict: true` 필수), Vite (`^6.0`), `vue-tsc` (`^2.2`), Pinia (`^2.3`),
  Vue Router (`^4.5`), Tailwind CSS (`^3.4`), `lucide-vue-next` (`^0.468`).
- **문서 렌더링 엔진**: `epubjs` (`^0.3.93`) 및 `jszip` (`^3.10`) 기반 EPUB 엔진(`DocumentReaderPort`
  추상화 포트 뒤로 격리, `css-tree` `^3.2.1` AST 기반 정화 및 비차단 CFI 위치 색인·캐시), 자동
  인코딩 감지(`TextDecoder`)·청크 분할·실측 기반 페이지네이션을 수행하는 커스텀 TXT 엔진.
- **크로스 플랫폼 런타임 및 Rust 백엔드**: Tauri 2 (`@tauri-apps/api`, `@tauri-apps/cli` `^2.12.x`, 공식
  플러그인 `plugin-fs`, `plugin-store`, `plugin-dialog`, `plugin-opener` 최신 `2.x` 및 OS 키체인/키스토어
  자격증명 분리 `tauri-plugin-keyring-store` — WebView 직접 `plugin-http` 비허용), Rust
  (`src-tauri/Cargo.toml`, edition `2021`, `rustc >= 1.90.0` 권장, `tauri` v2, `reqwest` `0.13`
  `rustls` + `stream`, `tokio`, `futures-util`, `dunce`, `sha2`, `hex`, `zip` `9.x`, `serde`,
  `serde_json`), 웹 브라우저 `IndexedDB v2`(`book_files`, `book_covers`, `location_indexes`,
  `key_value`) 및 소형 설정 전용 `localStorage` 폴백. 전 플랫폼 앱 식별자는
  `com.ezenitac.easyviewer` 단일 기준으로 통일해야 하며(MUST), 구 식별자 `com.edith.easyviewer`와
  원저작자 앱 이름(`EasyViewer`, `easy-viewer`)은 기존 사용자 데이터 마이그레이션, 구 구조 재발 차단
  검증, 출처 고지, 지원 범위 원문과 Windows 안내, 과거 명세 이력에서만 남길 수 있다(MUST NOT 그 밖의
  사용). 단, 기존 사용자 데이터 연속성을 위해 내부 저장 키(IndexedDB 이름 `EasyViewerDB`,
  `localStorage` 접두사 `easyviewer:`, 자격증명 계정 키 접두사 `easyviewer:webdav:`, 웹 자격증명 키
  `webdav_credentials_web_consent_v2`)는 별도 명세와 이전 경로 없이 바꿔서는 안 된다(MUST NOT).
- **지원 플랫폼 등급 (단일 원문)**: 공개 문서·이슈 양식·앱 정보 화면의 지원 범위 문구는 이 항목과
  같은 의미여야 한다(MUST).
  - **중점**: macOS(`11.0+`), iOS(`15.0+`), Linux — 설계·검증·품질 투자의 기준. iOS는 공개 배포
    채널 없이 **소스 빌드로만 제공**한다.
  - **유지(우선순위 낮음)**: Android(`scripts/android.mjs`) — 릴리스 산출물, 포크 소유 고정 서명 키,
    업데이트 연속성을 유지한다. Android 산출물은 포크 소유 고정 서명 키로 서명할 수 있는 릴리스에서만
    게시해야 하며(MUST), 키가 아직 없으면 그 릴리스에서 Android 산출물을 빼고 게시할 수 있다. 이때
    debug 서명이나 임시 키로 서명한 APK를 대신 게시해서는 안 된다(MUST NOT). 첫 APK의 서명 키가
    이후 모든 업데이트의 서명 키가 되기 때문이다.
  - **비지원**: Windows — 배포·공식 지원을 하지 않으며 Windows 사용자에게는 원저작자
    (`edith2580/EasyViewer`) 애플리케이션 사용을 권장한다. 해당 코드는 유지하고 CI에서 컴파일·자동
    테스트를 계속 수행한다(MUST).
  - **개발 보조**: 웹 브라우저 폴백.
- **표준 테스트 스택**: 프론트엔드 단위·통합 테스트는 Vitest(`vite ^6.0` 호환 버전) +
  `@vue/test-utils` + `jsdom` + `@tauri-apps/api/mocks`(`mockIPC`, `clearMocks`), 실제 브라우저
  레이아웃·CSP·접근성·성능 검증은 브라우저 E2E 러너(`Playwright` 등), Rust 백엔드는 `cargo test`를
  표준으로 채택한다(MUST).
- **보안 및 권한 제약**: 제로 트러스트(제7원칙)에 따라 `src-tauri/tauri.conf.json`의 `security.csp`를
  `null`(비활성화) 상태로 두어서는 안 되며(MUST NOT), 명시적 기본 거부 CSP, AST 기반 콘텐츠 정화
  (`css-tree` 허용 목록 — 정규식 단독 CSS 치환 금지), 플랫폼별 최소 권한 Capabilities(`desktop` vs
  `mobile` 분리, `fs:allow-read-file` 제거 및 단일 `read_validated_book_file` 경계 일원화), `dunce`
  기반 경로 정규화(`allow_storage_dir`), SSOT SSRF/TLS 검증 및 안전 자격증명 격리를 반드시 적용해야
  한다(MUST). Android 서명 키·비밀번호, Apple 개발 팀 ID, 개인 기기 식별자(UDID)는 저장소에 고정하지
  않고 빌드 환경 변수(`ANDROID_KEYSTORE_*`·`ANDROID_KEY_*`, `APPLE_DEVELOPMENT_TEAM`,
  `IOS_DEVICE_ID`)로만 전달해야 하며(MUST), release 빌드는 서명 정보가 없을 때 debug 키로 대체 서명하지
  않고 실패해야 한다(MUST).
- **버전·식별자 동기화**: 애플리케이션 버전 및 식별자 변경 시 `package.json`, `src-tauri/Cargo.toml`,
  `src-tauri/tauri.conf.json`, `package-lock.json`, `src-tauri/Cargo.lock`, Android
  (`tauri.android.conf.json`, `build.gradle.kts`, `MainActivity.kt`) 및 Apple (`project.yml`,
  `Info.plist`) 메타데이터를 `npm run check:version`으로 검증해 반드시 동일하게 유지해야 하며(MUST),
  제품 표시명·패키지 이름·내부 저장 키·원저작자 이름 잔존·아이콘 재사용은 `npm run check:identity`로
  검증해야 한다(MUST).

## 개발 워크플로우 및 품질 게이트 (Development Workflow & Quality Gates)

- **Spec Kit 문서 분리 게이트**: 명세서(`spec.md`)는 사용자 가치·기능 요구사항·수용 기준(What & Why)만
  기술하며 특정 프레임워크·라이브러리·파일 경로 등 구현 세부를 배제해야 한다(MUST NOT contain tech
  choices). 모든 기술 스택, 아키텍처, 데이터 모델 및 API 계약(How)은 구현 계획서(`plan.md`)에만
  작성해야 한다(MUST).
- **TDD 계획 및 실행 게이트**: 모든 구현 계획(`plan.md`)과 세부 태스크(`tasks.md`)는 구현 단계에
  앞서 실패하는 테스트 작성 단계(및 테스트 환경 미구축 시 하네스 선행 구축 단계)를 명시해야 하며(MUST),
  테스트가 존재하지 않거나 통과하지 않은 코드는 완료 처리할 수 없다(MUST NOT).
- **지속적 의심·무결성 및 Zero Trust 검증 게이트**: 코드 리뷰·분석·검증 단계에서는 제6원칙(의심·확인·
  검토·검증)과 제7원칙(Zero Trust)에 따라 정상 케이스뿐 아니라 경계 위반·악성 입력·SSRF·XSS·권한
  우회 부정 케이스를 반드시 검증해야 하며(MUST), 하드코딩 상수 반환·미구현 목업 방치·테스트 전용
  우회 분기·미실행 게이트의 허위 PASS 보고가 발견될 경우 즉시 반려(Reject)한다(MUST).
- **근거 기반 검증 게이트**: 외부 기술·아키텍처·보안·성능 결정에는 공식 문서·표준·우수 사례 출처를,
  내부 코드·문서 점검에는 관찰된 파일 경로·심볼·실행 결과를 명시해야 한다(MUST).
- **타입·빌드·테스트·경계 검증 게이트**: 모든 프론트엔드 변경은 `npm run build` (`vue-tsc -b && vite build`),
  단위·통합 테스트(`npm test`), 계층·규모 경계 게이트(`npm run check:boundaries`: 전 프로덕션 파일
  `src/**/*.{ts,vue}`·`src-tauri/src/**/*.rs`·`scripts/**/*.mjs` **450줄 이하** 및 뷰 계층 저장소 직접
  호출 금지), 초기 번들 예산(`dist/assets/index-*.js <= 480 kB`)을 통과해야 하며(MUST), `src-tauri/`
  Rust 코드 변경 시 `cargo check` 및 `cargo test`를 통과해야 한다(MUST). 도구 부재 환경에서 미실행된
  검증은 `BLOCKED` 미검증 상태로 구분 보고해야 하며, 해당 Rust 변경분의 최종 완료는 CI 또는 Rust
  툴체인 보유 호스트 검증 통과 전까지 보류한다(MUST). UI 변경은 `light`·`dark`·`sepia` 테마,
  데스크톱/모바일 입력 환경 및 WAI-ARIA 대화상자 규약(`role="dialog"`, `aria-modal="true"`, 포커스
  트랩, `Escape` 닫기, 초점 복귀)을 모두 지원해야 한다(MUST).
- **라이선스 감사 게이트**: 네이티브와 프론트엔드 런타임 의존성 모두 GPLv3 호환 허용 목록 기반 자동
  감사를 모든 PR과 `main` 반영 시 통과해야 하며(MUST), 서드파티 고지 문서는 실제 의존성과 일치해야
  한다(MUST). 감사 도구가 갖춰지기 전에는 이 게이트를 `BLOCKED`로 보고하고 릴리스를 게시하지
  않는다(MUST NOT 게시).
- **지원 범위·릴리스 게이트**: 릴리스는 지원 등급의 중점·유지 플랫폼 산출물과 체크섬 목록만 게시해야
  하며(MUST), Windows 설치 파일을 게시해서는 안 된다(MUST NOT). 워크플로는 저장소에 실제로 있는
  스크립트만 호출해야 하고(MUST), 비밀값이 없는 외부 PR 빌드에서도 서명을 제외한 검증은 수행해야
  한다(MUST).
- **공개 문서 병행 게이트**: 제1원칙의 국문·영문 공개 문서 쌍이 모두 존재하고 양방향 언어 전환 링크가
  있는지 자동 검사로 확인해야 하며(MUST), 한쪽만 바뀐 변경은 리뷰에서 반려한다(MUST).
- **커밋 메시지 게이트**: 모든 Git 커밋 메시지는 Conventional Commits 타입 접두사와 한국어 요약 제목을
  갖추고, 본문에 ① 변경 이유(Why), ② 핵심 수정 내용(What), ③ 영향 범위 및 검증 결과(Scope &
  Verification)를 구체적으로 담아 누구나 변경 맥락을 쉽게 파악할 수 있어야 한다(MUST).

## Governance

본 헌법(Constitution)은 EasyViewer 저장소(제품 Pagelight)의 모든 설계, 계획, 구현, 리뷰 및 커밋 작업에서 최우선
규범으로 적용된다(MUST). 규범 키워드(`MUST`, `MUST NOT`, `SHOULD`)는 RFC 2119 / RFC 8174 정의를
따른다.

- **개정 절차 (Amendment Procedure)**: 핵심 원칙, 언어·커밋 정책, 테스트 정책 또는 플랫폼 제약사항을
  수정할 때에는 반드시 `.specify/memory/constitution.md`를 업데이트하고 상단에 변경 영향 보고서
  (Sync Impact Report)를 작성해 검토한 뒤(MUST), 실제 커밋 시에는 해당 임시 HTML 주석을 제거해야
  한다(SHOULD).
- **버전 관리 정책 (Versioning Policy)**: 헌법 버전은 시맨틱 버저닝(`MAJOR.MINOR.PATCH`)을 따른다:
  - `MAJOR`: 기존 원칙의 삭제, 기존 `MUST` 규범 경계의 재정의, 필수 거버넌스 게이트 변경 등 하위
    호환되지 않는 규범 변경.
  - `MINOR`: 새로운 핵심 원칙 또는 섹션의 추가, 개발 가이드라인의 실질적 확장.
  - `PATCH`: 의미 변경 없는 문구 다듬기, 오타 수정, 명확화.
- **규정 준수 검토 (Compliance Review)**: 모든 명세(`spec.md`), 구현 계획(`plan.md`), 태스크(`tasks.md`),
  커밋 이력 및 코드 리뷰는 본 헌법의 8대 핵심 원칙(한국어 문서·커밋, 공개 문서 국문·영문 병행 및 영어 코드, TDD 및 테스트
  부트스트랩, 무결성 및 정당한 경계 격리, 외부 리서치·내부 실측 근거 확보, 플랫폼 추상화·엔진 분리,
  지속적 의심·다층 검증, Zero Trust 보안, 독립 포크 운영)과 문서 분리 게이트 준수 여부를 반드시 검증해야
  한다(MUST).

**Version**: 4.3.0 | **Ratified**: 2026-11-15 | **Last Amended**: 2026-11-23
