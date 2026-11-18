# 계약: 앱 정보 화면

**요구사항**: FR-004, FR-005, SC-001 | **리서치**: R5, R13

## 1. 진입

- 라이브러리 화면의 "정보" 버튼에서 연다. 키보드로 접근할 수 있어야 한다.
- 모달 대화상자 규약을 지킨다: `role="dialog"`, `aria-modal="true"`, 포커스 트랩, `Escape`로 닫기, 닫으면 초점 복귀.
- `light`·`dark`·`sepia` 테마, 데스크톱·모바일 입력을 지원한다.

## 2. 내용 (위에서 아래 순서)

| 항목 | 출처 | 규칙 |
|---|---|---|
| 앱 이름 | `src/generated/about.json` ← `tauri.conf.json` `productName` | 새 표시명 |
| 버전 | `about.json` ← `package.json` | 빌드 시점 값 |
| 라이선스 | 고정 `GPL-3.0-only` + 전문 링크(앱에 포함된 `LICENSE`) | "법적 의무" 표현 금지 |
| 저장소 | `https://github.com/Ezenitac-AiService/EasyViewer` | 링크 허용 목록 1 |
| 원저작자 출처 | "edith2580의 EasyViewer `v0.1.6`에서 파생" + `https://github.com/edith2580/EasyViewer` | 링크 허용 목록 2 |
| 변경 일자 | 분리 일자와 이 빌드 날짜 | NOTICE와 같은 값 |
| 지원 범위 | `supportScope.ts` 렌더 결과 | [support-scope-wording.md](support-scope-wording.md) 원문 |
| 서드파티 고지 | `about.json` `thirdParty[]`(직접 의존성 요약: 이름·버전·선택한 SPDX) + **전체 고지 전문** `src/generated/third-party-notices.txt`(직접·전이 전체의 저작권 고지와 라이선스 전문, 지연 로드) | `check-licenses.mjs`가 생성. `THIRD_PARTY_LICENSES.md`·실제 의존성 집합과 불일치하면 실패 |

## 3. 외부 링크

- **권한**: `opener:allow-open-url`을 다음 4개 URL 패턴으로만 허용한다. 범위는 원문 URL 문자열에 대한 glob이고 `*`가 `/`까지 포함하므로(research F29), 저장소 이름 뒤에 바로 `*`를 붙이지 않는다(`EasyViewerX` 같은 다른 저장소가 허용되는 것을 막기 위함).
  - `https://github.com/Ezenitac-AiService/EasyViewer`
  - `https://github.com/Ezenitac-AiService/EasyViewer/*`
  - `https://github.com/edith2580/EasyViewer`
  - `https://github.com/edith2580/EasyViewer/*`
- **프론트엔드 재검사**: `URL`로 파싱한 결과가 `https:`, 호스트 `github.com`, 경로가 두 접두사 중 하나로 시작할 때만 연다. 그 밖은 열지 않고 무시한다.
- **웹 폴백**: `window.open(url, '_blank', 'noopener,noreferrer')`, 같은 허용 목록을 쓴다.

## 4. 테스트 요구

- 단위 테스트:
  - 모든 항목 렌더
  - 허용 목록 밖 URL 거부(스킴·호스트·경로 우회 시도: `https://github.com.evil`, `https://github.com/edith2580/EasyViewerX/..`, `javascript:`)
  - "법적 의무" 문자열 부재
- E2E: 대화상자 접근성 규약(기존 `accessibility-and-ux.spec.ts` 확장)
- 번들 예산: 정보 화면은 지연 로드(dynamic import)로 초기 번들 480 kB를 지킨다.
