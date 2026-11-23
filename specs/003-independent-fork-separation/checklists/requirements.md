# Specification Quality Checklist: 독립 포크 분리

**Purpose**: 계획 단계로 넘어가기 전에 명세의 완결성과 품질을 검증한다
**Created**: 2026-11-17
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- 명확화 3건 해소(2026-11-17): 제품 표시명 = 구분되는 이름(확정 결정 13, FR-016·FR-024·SC-007), Android = 유지 플랫폼(확정 결정 14, FR-006·US5-2), iOS = 소스 빌드로만 제공(확정 결정 15, FR-006·FR-021). 새 표시명 자체는 첫 독립 릴리스 전에 정한다(FR-016).
- 구현 세부 판단: 파일 경로, 빌드 도구, 라이브러리, 저장 API 이름은 모두 입력 문서 §4로 남기고 명세에 넣지 않았다. 명세에 남은 GitHub·CI·git 태그·커밋 해시·`GPL-3.0-only`·GPLv3 조항 번호는 이 기능의 **업무 도메인**(저장소 거버넌스와 라이선스 준수) 자체의 대상이므로 구현 세부로 보지 않는다.
- 헌법 충돌: 현행 헌법의 기술 제약(식별자 `com.edith.easyviewer` MUST, Windows 지원 명시)과 이 명세의 확정 결정 2·6이 충돌한다. `/speckit-plan` 전에 `/speckit-constitution` 개정이 필요하다(Assumptions, FR-023).
- 검증 1회차에서 명확화 표식 외 실패 항목 없음. 2회차(명확화 반영 후) 16/16 통과.
- T090 헌법 "지원 플랫폼 등급"(v4.2.0)과 `src/config/supportScope.ts` 원문 의미 대조 — 2026-11-23 Claude Code가 준비, **사람 검토 대기**:

  | 항목 | 헌법 | 원문(`renderSupportScopeKo`) | 판단 |
  |---|---|---|---|
  | 중점 | macOS(`11.0+`), iOS(`15.0+`), Linux | macOS · iOS · Linux | 같은 의미. 원문에는 최소 OS 버전이 없다(설정값은 `tauri.conf.json` macOS 11.0, iOS 15.0으로 헌법과 일치) |
  | iOS 제공 방식 | 공개 배포 채널 없이 소스 빌드로만 제공 | 공개 배포 채널 없이 소스 빌드로만 제공 | 같음 |
  | 유지 | Android — 릴리스 산출물, 포크 소유 고정 서명 키, 업데이트 연속성 유지 | Android는 우선순위를 낮춘 유지 플랫폼으로 계속 배포 | 같은 의미. 서명 키·업데이트 연속성은 원문에 없다(사용자 문구로는 불필요하다고 봄) |
  | 비지원 | Windows — 배포·공식 지원 안 함, 원저작자 앱 사용 권장, 코드는 CI에서 컴파일·테스트 | Windows는 지원·배포 대상이 아님, 원저작자 EasyViewer 사용 권장 | 같은 의미. CI 유지는 내부 운영 사항이라 원문에 없다 |
  | 개발 보조 | 웹 브라우저 폴백 | 웹 브라우저 실행은 개발 보조용 | 같음 |
  | Linux 기준 | (언급 없음) | Ubuntu 22.04 이상 또는 동급, deb·AppImage, WebKitGTK 4.1, X11·Wayland | 원문이 더 구체적이다. 헌법과 충돌하지 않는다 |

  결론(준비안): 의미 불일치 없음. 원문에 없는 최소 OS 버전을 공개 문구에 넣을지는 메인테이너가 정한다. 메인테이너가 확인하면 이 줄에 확인 날짜를 적고 T090을 완료로 표시한다.
