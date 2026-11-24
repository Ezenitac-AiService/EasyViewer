# Contract: Windows 제외와 재유입 검사

## 1. 제거 대상

research R1 표의 "제거" 항목 전부. 제거 후 다음이 그대로 통과해야 한다.

- `npm run verify`(cargo check·test 포함)
- CI `macos-build`(번들 서명 검증), `ios-sim-build`, `android-debug`
- 릴리스 리허설의 macOS·Linux·Android 빌드

## 2. 재유입 검사 (`scripts/check-windows-exclusion.mjs`, `npm run verify`에 포함)

동작 기준 패턴만 본다. 단어 "windows"만으로는 실패하지 않는다. 검사 범위는 모든 규칙에서 Git이 추적하는 파일로 한정한다.

| 규칙 | 대상 | 실패 예 |
|---|---|---|
| W1 Windows 빌드 조건 | `src-tauri/**/*.rs`, `src-tauri/Cargo.toml` | `cfg(windows)`, `target_os = "windows"`, `cfg!(… "windows" …)`, `windows_subsystem` |
| W2 Windows 번들 설정 | `src-tauri/tauri.conf.json` | `bundle.windows` 키, `.ico` 아이콘, `nsis`·`msi`·`wix` 대상 |
| W3 Windows 권한 플랫폼 | `src-tauri/capabilities/*.json` | `platforms`에 `"windows"` |
| W4 Windows 감사 대상 | `src-tauri/deny.toml`, `src-tauri/about.toml` | `*-windows-*` 대상 |
| W5 Windows 전용 파일 | Git이 추적하는 파일(`git ls-files`, 허용 목록 제외). `node_modules`·`target`·`dist` 같은 추적하지 않는 빌드 산출물은 대상이 아니다 | `*.ico`, `*.bat`, `*.ps1`, `*.cmd`, `Square*Logo.png`, `StoreLogo.png` |
| W6 Windows 러너 | `.github/workflows/*.yml` | `windows-latest`, `windows-20xx` |
| W7 Windows 빌드 스크립트 | `scripts/*.mjs`, `package.json` scripts | `x86_64-pc-windows`, `--bundles` 값에 `nsis`/`msi` |

허용 목록(data-model §5)은 파일 경로 단위로 둔다. 허용 목록 파일 안에서도 W1–W7 외 규칙은 적용하지 않는다.

## 3. 보존 기록 표시

`docs/windows-migration.md`, `docs/windows-eol-notice.md` 맨 위:

```text
> **보존 기록**: 이 문서는 이 포크의 Windows 프리릴리스(`v0.1.6-alpha`·`v0.1.6-beta`) 지원 종료 이력으로 남긴 것이며 더 이상 갱신하지 않습니다. Windows는 이 포크의 범위가 아닙니다(헌법 v6.1.0).
```

이 두 파일은 지원 범위 블록 검사에서 제외되고(contracts/support-scope-text.md §4), 링크 대상 보존 확인(quickstart §4)의 대상이다. 보존 기록 표시 외의 내용은 바꾸지 않는다.

## 4. 공개 문서의 Windows 문장

| 문서 | 허용 |
|---|---|
| README(국문·영문) "Windows 사용자 안내" 절 | 원저작자 앱 안내 1문장 + 기존 프리릴리스 사용자를 위한 보존 기록 링크 1문장. CI 컴파일 관련 문장은 삭제 |
| CONTRIBUTING(국문·영문) | "Windows는 범위 밖, Windows 전용 코드 불가" 1문장. Windows 이슈 처리 절은 "기존 프리릴리스 문의는 보존 기록 안내 후 닫음"으로 축소 |
| SECURITY(국문·영문) | Windows 언급 없음(원저작자 신고 경로 문장은 유지) |
| 릴리스 노트 템플릿 | Windows 전환 안내 링크 문장 유지(보존 기록 링크) |
