# EasyViewer Constitution

## Core Principles

### I. 언어 및 커뮤니케이션 원칙 (Language & Communication Policy)
사용자에게 제공하는 모든 질문, 답변, 아키텍처 보고서, 명세서(`spec.md`), 구현 계획서(`plan.md`),
작업 목록(`tasks.md`), 체크리스트 및 프로젝트 문서는 반드시 **한국어(Korean)**로 작성해야 한다(MUST).
반면, 에이전트와 개발자의 내부 생각(Thinking), 추론(Reasoning), 사고 과정 및 모든 구현 소스 코드
(변수·함수·타입 식별자, 코드 내 기술 주석, 테스트 코드 등)는 **영어(English)**를 기본으로 작성해야
한다(MUST).

근거(Rationale): 사용자와의 명확한 의사소통과 산출물 가독성을 극대화하는 동시에, 내부 추론의 정확성과
소스 코드의 글로벌 표준 호환성을 유지한다.

### II. 테스트 주도 개발 및 무테스트 구현 금지 (Test-Driven Development — NON-NEGOTIABLE)
**테스트 없는 구현은 엄격히 금지한다(MUST NOT).** 모든 신규 기능, 문서 엔진 로직, 스토리지/네트워크
서비스 및 버그 수정은 반드시 자동화된 테스트 코드로 검증되어야 한다(MUST). 모든 구현 작업의 계획
(`plan.md`, `tasks.md`)은 반드시 **테스트 주도 개발(TDD: Red → Green → Refactor)** 방법론을 기본
바탕으로 수립해야 한다(MUST). 즉, 구현 코드를 작성하기 전에 요구사항을 검증하는 실패하는 테스트(Red)를
먼저 작성하고, 테스트를 통과하는 실제 구현(Green)을 완성한 뒤, 구조를 개선(Refactor)하는 순서를
엄격히 준수해야 한다.

근거(Rationale): 구현 전에 요구사항과 엣지 케이스를 실행 가능한 명세로 먼저 고정함으로써 회귀 결함을
원천 차단하고 설계의 테스트 가능성을 보장한다.

### III. 구현 무결성 및 우회 로직 금지 (Implementation Integrity & Anti-Bypass)
**하드코딩(Hardcoding), 실제 비즈니스/엔진 로직을 대체하는 목업(Mockup/Stub 방치), 또는 오직 테스트
코드를 통과하는 것만을 목적으로 하는 우회 로직(Test-Passing Workaround)의 작성을 엄격히 금지한다
(MUST NOT).** 프로덕션 코드는 테스트 입력값에 맞춘 조건 분기나 고정 반환값을 포함해서는 안 되며,
실제 런타임 데이터와 경계 조건에서 완전하게 동작하는 정식 알고리즘과 아키텍처 경로로 구현되어야 한다
(MUST). 테스트 대역(Mock/Fake)은 외부 I/O 경계를 격리하기 위한 테스트 코드 내부에서만 제한적으로
허용된다.

근거(Rationale): 테스트 통과만을 노린 기만적 우회 구현과 하드코딩은 품질 검증 체계를 무력화하고 실제
사용자 환경에서 치명적인 런타임 장애를 초래한다.

### IV. 리서치 기반 검증 및 근거 확보 (Evidence-Based Research & Verification)
검토(Review), 검증(Verification), 평가(Evaluation), 분석(Analysis)의 근거를 **절대로 독자적인 생각이나
내부 추측만으로 도출해서는 안 된다(MUST NOT).** 모든 아키텍처 설계, 기술 선택, 성능·보안 분석 및 코드
리뷰 판단은 반드시 **공식 레퍼런스(Official References), 공식 가이드(Official Guides), 검증된 우수
예제(Best Practices), 학술 논문(Academic Papers), 업계 최신 트렌드(Latest Industry Trends)**를
리서치하여 객관적인 근거를 확보하고 이를 계획서 및 검토 문서에 명시해야 한다(MUST).

근거(Rationale): 주관적 추측이나 구식 관행에 의존한 설계 오류를 방지하고, 최신 업계 표준과 검증된
레퍼런스에 기반한 엔지니어링 의사결정을 보장한다.

### V. 크로스 플랫폼 추상화 및 포맷 독립 엔진 아키텍처 (Cross-Platform & Engine Modularity)
파일 시스템 접근, 영속 데이터 저장, 네트워크/WebDAV 통신은 반드시 통합 플랫폼 추상화 계층
(`src/services/storage/platformAdapter.ts`, `src/services/network/`)을 경유해야 하며(MUST), Tauri 2
네이티브 환경(Windows, macOS, Android, iOS)과 웹 브라우저(`IndexedDB`, `localStorage`, `File API`)에서
동일하게 동작해야 한다. 또한 EPUB(`src/engines/epub/`) 및 TXT(`src/engines/txt/`) 엔진은 공통 도메인
계약(`src/types/index.ts`의 `ReadingLocation`, `BookmarkItem`, `TocItem`, `SearchResultItem`)을 통해
뷰 및 Pinia 스토어(`src/stores/`)와 분리되어야 하며(MUST), 보기 모드(`scroll` ↔ `paginated`)나 테마·글꼴
변경 시 사용자의 독서 위치를 정확히 보존해야 한다.

근거(Rationale): 단일 코드베이스에서 5개 플랫폼과 다중 문서 포맷의 호환성, 오프라인 독서 복원력, 독서
위치 추적의 정밀도를 일관되게 유지한다.

## 기술 스택 및 플랫폼 제약사항 (Technology Stack & Platform Constraints)

- **프레임워크 및 언어**: Vue 3 (Composition API, `<script setup lang="ts">`), TypeScript (`~5.6`,
  `strict: true` 필수), Pinia (`^2.3`), Vue Router (`^4.5`), Tailwind CSS (`^3.4`).
- **문서 렌더링 엔진**: `epub.js` (`^0.3.93`) 및 `jszip` 기반 EPUB 엔진(CFI 정밀 위치 추적 및 스타일
  주입), 자동 인코딩 감지(`TextDecoder`)·청크 분할·측정 기반 페이지네이션을 수행하는 커스텀 TXT 엔진.
- **크로스 플랫폼 런타임**: Tauri 2 (`@tauri-apps/api`, `plugin-fs`, `plugin-store`, `plugin-http`,
  `plugin-dialog`) 및 웹 브라우저 표준 스토리지(`IndexedDB`, `localStorage`).
- **버전 동기화**: 애플리케이션 버전 변경 시 `package.json`, `src-tauri/Cargo.toml`,
  `src-tauri/tauri.conf.json` 세 파일의 버전을 반드시 동일하게 유지해야 한다(MUST).

## 개발 워크플로우 및 품질 게이트 (Development Workflow & Quality Gates)

- **TDD 계획 및 실행 게이트**: 모든 기능 구현 계획(`plan.md`)과 세부 태스크(`tasks.md`)는 각 구현 단계에
  앞서 실패하는 단위/통합 테스트 작성 단계를 명시해야 하며(MUST), 테스트가 존재하지 않거나 통과하지 않은
  코드는 완료 처리할 수 없다.
- **무결성 검증 게이트**: 코드 리뷰 및 검증 단계에서 하드코딩된 상수 반환, 미구현 목업 방치, 테스트 전용
  우회 분기가 발견될 경우 즉시 반려(Reject)하며 정식 구현으로 재작성해야 한다(MUST).
- **근거 기반 리서치 게이트**: 기술 검토, 성능/메모리 분석, 라이브러리 활용 및 아키텍처 평가 시 공식
  문서·가이드·논문·최신 트렌드 출처를 리서치하여 근거를 제시해야 한다(MUST).
- **타입 및 빌드 검증 게이트**: 모든 변경 사항은 `npm run build` (`vue-tsc -b && vite build`) 및 테스트
  스위트를 에러 없이 통과해야 하며(MUST), `light`·`dark`·`sepia` 테마와 데스크톱/모바일 입력 환경을
  모두 지원해야 한다.

## Governance

본 헌법(Constitution)은 EasyViewer 프로젝트의 모든 설계, 계획, 구현 및 검증 작업에서 최우선 규범으로
적용된다.

- **개정 절차 (Amendment Procedure)**: 핵심 원칙, 언어 정책, 테스트 정책 또는 플랫폼 제약사항을 수정할
  때에는 반드시 `.specify/memory/constitution.md`를 업데이트하고 상단에 변경 영향 보고서(Sync Impact
  Report)를 기록해야 한다(MUST).
- **버전 관리 정책 (Versioning Policy)**: 헌법 버전은 시맨틱 버저닝(`MAJOR.MINOR.PATCH`)을 따른다:
  - `MAJOR`: 기존 원칙의 삭제·재정의, 필수 거버넌스 게이트(TDD, 우회 금지 등)의 변경 등 하위 호환되지
    않는 규범 변경.
  - `MINOR`: 새로운 핵심 원칙 또는 섹션의 추가, 개발 가이드라인의 실질적 확장.
  - `PATCH`: 의미 변경 없는 문구 다듬기, 오타 수정, 명확화.
- **규정 준수 검토 (Compliance Review)**: 모든 명세(`spec.md`), 구현 계획(`plan.md`), 태스크(`tasks.md`)
  및 코드 리뷰는 본 헌법의 5대 핵심 원칙(한국어 문서화·영어 추론/코드, TDD 필수화, 하드코딩/목업/우회
  금지, 리서치 기반 근거 확보, 크로스 플랫폼 및 엔진 추상화) 준수 여부를 반드시 검증해야 한다(MUST).

**Version**: 2.0.0 | **Ratified**: 2026-11-15 | **Last Amended**: 2026-11-15
