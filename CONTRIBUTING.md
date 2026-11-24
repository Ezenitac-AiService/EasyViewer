# 기여 가이드

**언어 / Language**: **[한국어](CONTRIBUTING.md)** | [English](CONTRIBUTING.en.md)

이 저장소는 [edith2580의 EasyViewer](https://github.com/edith2580/EasyViewer)에서 갈라진 **독립 포크**입니다. 기여하기 전에 아래 원칙을 확인해 주세요.

## 지원 범위

<!-- support-scope:start -->
이 포크는 **macOS**를 중점 지원합니다.
iOS는 우선순위를 낮춘 유지 플랫폼이며, 공개 배포 채널 없이 소스 빌드로만 제공합니다.
Linux·Android는 **테스트용 빌드**로만 배포합니다. 품질·기능 동등성·실기기 검증·대응 일정을 보장하지 않습니다.
**Windows는 이 포크의 범위가 아닙니다. Windows에서는 원저작자의 [EasyViewer](https://github.com/edith2580/EasyViewer)를 사용하세요.**
웹 브라우저 실행은 개발 보조용입니다.
Linux 테스트용 빌드는 Ubuntu 22.04 이상 또는 동급 배포판(deb·AppImage, WebKitGTK 4.1, X11·Wayland)에서 빌드합니다. Android 테스트용 빌드는 Android 7.0(API 24) 이상이 대상입니다.
<!-- support-scope:end -->

지원 범위 문구의 원문은 `src/config/supportScope.ts`입니다. 문구를 바꿀 때는 원문을 고친 뒤 위 블록(한국어 `support-scope`, 영문 `support-scope-en`)이 있는 문서를 함께 갱신하고 `node scripts/check-support-scope.mjs`로 확인합니다.

## Windows 관련 이슈 처리 방침

- Windows는 이 포크의 범위가 아니므로, Windows에서만 쓰는 코드·설정·파일을 추가하는 변경은 받지 않습니다(`node scripts/check-windows-exclusion.mjs`가 검사합니다).
- 이 포크가 게시했던 Windows 프리릴리스(`v0.1.6-alpha`·`v0.1.6-beta`)에 관한 문의는 보존 기록인 [Windows 전환 안내](docs/windows-migration.md)로 안내하고 닫습니다. 원저작자 저장소에는 올리지 마세요.

## 원저작자 저장소와의 관계

- 이 포크는 업스트림(`edith2580/EasyViewer`)을 **병합·체리픽·동기화하지 않습니다.** GitHub의 "Sync fork" 버튼도 쓰지 마세요.
- 원저작자 앱의 아이디어가 필요하면 별도 명세(`/speckit-specify`)로 이 포크에서 다시 구현합니다.
- **유일한 예외**는 보안 조율입니다. 이 포크가 찾은 결함이 원저작자 최신 릴리스에도 남아 있으면, 공개하기 전에 원저작자에게 비공개로 알리거나 수정을 제안합니다. 이것은 동기화가 아니라 기여입니다.
- 공유 브랜치의 이력 재작성(강제 푸시 등)과 저작권·출처 고지 삭제는 금지합니다. 원저작자에게서 온 코드를 일반적인 리팩터링으로 고치거나 지우는 것은 괜찮습니다.

### 실수로 업스트림 변경이 병합되었을 때

1. 로컬에 업스트림 원격이 남아 있는지 확인합니다.
   ```bash
   git remote -v
   ```
2. 남아 있으면 지웁니다.
   ```bash
   git remote remove upstream
   ```
3. 업스트림 변경을 병합한 커밋을 이미 푸시했다면, 강제 푸시하지 말고 되돌리기 커밋을 만듭니다.
   ```bash
   git revert -m 1 <병합 커밋>
   ```
4. 워크플로와 스크립트에 동기화 경로가 없는지 확인합니다.
   ```bash
   node scripts/check-release-gate.mjs --static
   ```

## 운영 원칙

이 포크는 [프로젝트 헌법](.specify/memory/constitution.md)(v6.1.0)을 따릅니다. 특히 제8원칙(독립 포크 운영)에 따라 다음을 지킵니다.

- 공개 문구는 이 포크의 범위만 말합니다. 원저작자 프로젝트의 역할·의도를 대신 규정하거나 원저작자 앱을 낮추어 평가하지 않습니다. `node scripts/check-support-scope.mjs`가 금지 표현을 검사합니다.
- 라이선스는 `GPL-3.0-only`입니다. 라이선스 전문(`LICENSE`)을 바꾸지 않고, 원저작자 귀속과 변경 고지(`NOTICE`)를 유지합니다.
- 이 포크에서 새로 만드는 소스 파일 첫 줄에는 `SPDX-License-Identifier: GPL-3.0-only`를 씁니다.
- 저장소 루트의 공개 문서(`README`, `CONTRIBUTING`, `SECURITY`, `CHANGELOG`, `NOTICE`, `THIRD_PARTY_LICENSES`)는 한국어 기본 문서와 영문판(`*.en.md`)을 함께 유지합니다(제1원칙). 한쪽을 고치면 같은 변경에서 다른 쪽도 고칩니다. 두 판이 어긋나면 한국어 문서가 기준입니다. `node scripts/check-doc-pairs.mjs`가 쌍과 언어 전환 링크를 검사합니다.

## 지원 등급별 기여 기대치

| 등급 | 플랫폼 | 기대치 |
|---|---|---|
| 중점 | macOS | 유일한 핵심 빌드입니다. 변경마다 macOS 동작을 확인하고, `macos-build`를 포함한 핵심 CI가 통과해야 합니다 |
| 유지(후순위) | iOS | 소스 빌드만 제공합니다. 빌드와 기존 동작을 깨지 않도록 노력합니다. CI 결과는 보고만 하며 병합을 막지 않지만, 실패는 확인해 고칩니다 |
| 테스트 빌드 | Linux, Android | 테스트용 빌드로만 배포하며 품질·기능 동등성·실기기 검증·대응 일정을 보장하지 않습니다. 빌드가 깨지지 않게만 유지하고 CI 결과는 보고만 합니다. 버그는 테스트 빌드 버그 양식으로 받습니다 |
| 제외 | Windows | 이 포크의 범위가 아닙니다. Windows에서만 쓰는 코드·설정·기능은 받지 않습니다 |
| 개발 보조 | 웹 | 개발·테스트용 폴백으로만 유지합니다 |

## 명세 절차

기능 추가와 큰 변경은 Spec Kit 흐름을 따릅니다: `/speckit-specify` → `/speckit-clarify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-analyze` → `/speckit-implement`. 산출물은 `specs/<번호>-<이름>/`에 둡니다. 명세(`spec.md`)에는 구현 세부를 쓰지 않습니다.

## 개발 환경과 구조

### 기술 스택

- **프레임워크**: Vue `^3.5.13` (`<script setup lang="ts">`) + TypeScript `~5.6.3` (`strict: true`) + Vite `^6.0.5`
- **상태 / 라우팅 / UI**: Pinia `^2.3.0`, Vue Router `^4.5.0`, Tailwind CSS `^3.4.17`, Lucide Vue Next `^0.468.0`
- **문서 엔진**: `epubjs ^0.3.93` + `jszip ^3.10.1` + `css-tree ^3.2.1`, Custom TXT Engine(`txtEngine.ts`, `txtMeasuredPagination.ts`)
- **네이티브 백엔드**: Tauri `2` (`@tauri-apps/api ^2.12.4`, `plugin-dialog`, `plugin-fs`, `plugin-store`, `plugin-opener`, `tauri-plugin-keyring-store`), Rust `reqwest 0.13` (`rustls` + `stream`), `dunce`, `sha2`, `zip 9.x`
- **지원 플랫폼**: 중점 macOS(유일한 핵심 빌드), 유지 iOS(소스 빌드만), 테스트 빌드 Linux·Android(테스트용 빌드로 배포만, 보장 없음), Web(개발 보조, `IndexedDB` / 프록시). Windows는 이 포크의 범위가 아닙니다(위 지원 범위 참고)

### 디렉터리 구조

```text
./
├── src/
│   ├── assets/                 # 글로벌 스타일 및 로컬 폰트 스택 (main.css)
│   ├── components/
│   │   ├── common/             # 접근성 확인/복구 모달 (InAppConfirmModal)
│   │   ├── library/            # 원격 다운로드(RemoteUrlDownloadTab, WebDav*), 동기화/폴더 메뉴
│   │   └── viewer/             # 뷰어 설정 패널, 목차/책갈피/검색 드로어
│   ├── composables/            # UI/독서 세션/TXT 가상·페이지 제어/가져오기/표지 URL 컴포저블
│   ├── engines/                # 순수 문서 엔진 (DocumentReaderPort; 상위 레이어 비의존)
│   │   ├── epub/               # epub.js 어댑터, css-tree AST 정화, 비차단 위치 색인, 터치/탭 제어
│   │   └── txt/                # 인코딩 감지, 청킹·검색, 줄박스/실측 기반 가로 페이지네이션
│   ├── services/
│   │   ├── platform/           # 플랫폼 추상화 포트 (dialog, dragDrop, path, credential)
│   │   ├── storage/            # IndexedDB v2(표지 Blob·색인 캐시 분리), SHA-256 해싱, 네이티브 IPC
│   │   ├── network/            # SSRF 검증기, 안전 fetch/스트리밍 다운로드, WebDAV 클라이언트
│   │   ├── sync/               # 기기 간 읽기 위치·책갈피 병합 및 동기화 서비스
│   │   └── sampleBooks.ts      # 기본 내장 샘플 도서 데이터
│   ├── stores/                 # Pinia 스토어 (useBookStore, useSettingsStore) + 마이그레이션/동기화 헬퍼
│   ├── types/                  # 공통 TypeScript 인터페이스 및 타입 정의
│   └── views/                  # 슬림 라우터 뷰 (LibraryView, ReaderView - /reader/:id 지연 로딩)
├── src-tauri/
│   ├── capabilities/           # 최소 권한 분리 (default.json, desktop.json)
│   └── src/                    # Rust 보안/SSRF/경로 가드(security/) + 파일·스트리밍·EPUB 메타 커맨드(commands/)
├── scripts/                    # 450줄/계층 경계, 전 플랫폼(`com.ezenitac.easyviewer`) 버전 일치, 앱 정체성(`check-identity`), 프록시 가드, verify 스크립트
├── tests/                      # 1계층 Vitest 단위/계약 + 2계층 Playwright E2E/성능 기준선 테스트
└── specs/                      # Spec Kit 기능 명세, 아키텍처 계획, 보안 계약 및 검증 체크리스트
```


## 검증 명령

변경을 올리기 전에 다음을 통과해야 합니다.

```bash
npm run verify
```

```bash
cd src-tauri && cargo deny check
```

`npm run verify`는 빌드, 단위 테스트, 계층·규모 경계(파일당 450줄 이하), 버전·식별자 동기화, 라이선스 정책 감사, 지원 범위 문구 검사, 공개 문서 국문·영문 쌍 검사, `cargo check`, `cargo clippy`(경고가 하나라도 있으면 실패), `cargo test`를 실행합니다. 테스트 없이 구현한 코드는 받지 않습니다(헌법 제2원칙, TDD).

개별 검사와 테스트는 다음 명령으로 따로 실행할 수 있습니다.

```bash
# 1계층 단위·플랫폼 경계 테스트 (Vitest + mockIPC, 30초 이내 고속 실행)
npm test

# 정적 아키텍처 경계 위반 검사 (views/stores/components/engines/sync 내 직접 Tauri/웹저장소/fetch 차단)
npm run check:boundaries

# package.json, Cargo.toml, tauri.conf.json 및 락파일(package-lock.json, Cargo.lock) 버전 일치 검증
npm run check:version

# 커밋 메시지 규범 검증 (Conventional Commits + 한국어 요약 및 20자 이상 본문)
npm run check:commit-msg -- <COMMIT_EDITMSG_PATH>

# 전체 통합 검증 게이트 (build + test + check:boundaries + check:version + cargo check && cargo test)
# ※ Rust 미설치 환경에서는 기본 종료 코드 2(BLOCKED)를 반환하며, 프론트엔드만 확인할 때는 --frontend-only 사용
npm run verify

# 2계층 실제 브라우저 렌더링·보안 CSP/프록시·E2E 테스트 (Playwright Chromium + WebKit)
npm run test:e2e

# 2계층 런타임 성능 회귀 비교 게이트 (고정 50권 시드 기준선 대비 중앙값 비교)
npm run test:perf
```

### 라이선스 감사가 실패할 때

의존성을 추가하거나 갱신해 감사가 실패하면 다음 순서로 처리합니다. 감사를 우회하거나 끄지 않습니다.

1. 새 라이선스가 GPLv3와 호환되는지 근거(공식 라이선스 목록, FSF 호환성 표 등)를 확인합니다.
2. 호환되면 근거를 주석으로 남기고 `scripts/license-policy.json`과 `src-tauri/deny.toml`(Rust는 `src-tauri/about.toml`도)의 허용 목록에 추가합니다.
3. 호환되지 않으면 그 의존성을 다른 것으로 바꿉니다.
4. 고지 전문을 다시 생성합니다.
   ```bash
   node scripts/check-licenses.mjs --write
   ```

## 버전과 빌드

### 버전 동기화 대상 파일

버전 변경 시 아래 파일의 버전을 일치시킨 뒤 `npm run check:version`으로 검증합니다.

- `./package.json`
- `./package-lock.json`
- `./src-tauri/Cargo.toml` (및 `cargo check`를 통한 `./src-tauri/Cargo.lock` 반영)
- `./src-tauri/tauri.conf.json`

### Rust 툴체인

- 권장 버전: `rustc >= 1.90.0` (최신 Tauri v2 공식 플러그인 및 `reqwest 0.13` `rustls` MSRV 충족)

```bash
node -v && npm -v
rustc --version && cargo --version
rustup show
```

### 개발 실행

```bash
# 의존성 설치
npm install

# 웹 개발 서버 실행 (http://localhost:1420)
npm run dev

# TypeScript 검증 및 프로덕션 번들 빌드
npm run build

# Tauri 데스크톱 앱 실행 (Rust 툴체인 설치 환경)
npm run tauri dev
```

### Linux 빌드

```bash
# Ubuntu/Debian 계열 사전 의존성: libwebkit2gtk-4.1-dev, libappindicator3-dev, librsvg2-dev, patchelf, rpm
# 정식 버전(`0.1.6` 등)은 deb,rpm,appimage 번들 빌드 지원 (프리릴리즈 하이픈 버전은 deb,appimage 지정)
APPIMAGE_EXTRACT_AND_RUN=1 npm run tauri build -- --bundles deb,rpm,appimage
```

### macOS · iOS 빌드

```bash
# macOS 개발 실행
npm run mac:dev

# macOS 유니버설(Apple Silicon + Intel) 빌드
npm run mac:build

# 아키텍처별 macOS 빌드 (헤드리스/Spotlight 디스크 잠금 회피 필요 시 CI=true 지정)
npm run mac:build:arm
npm run mac:build:intel

# iOS(Xcode) 프로젝트 초기화 · 개발 실행 · 빌드
npm run ios:init
npm run ios:dev
npm run ios:build

# Xcode 직접 열기 (디버깅 / App Store 아카이브)
npx tauri ios dev --open
npx tauri ios build --open
```

- **배포 및 macOS 서명 참고 (`1.0.0-alpha.1` 기준)**: 기본 데스크톱 빌드는 비샌드박스(`.dmg`/Hardened Runtime)를 기준으로 하며, `src-tauri/tauri.conf.json`에 `bundle.macOS.signingIdentity: "-"`(Ad-Hoc 서명 + Hardened Runtime Seal)이 설정되어 `codesign --verify --deep --strict` 무결성 검증을 통과합니다(전 플랫폼 앱 식별자 `com.ezenitac.easyviewer` 통일). Apple Developer 공증(Notarization) 전 `.dmg`를 브라우저로 내려받은 경우 최초 실행 전 `xattr -cr /Applications/Pagelight.app`로 Gatekeeper 격리 속성을 해제해야 "손상되었기 때문에 열 수 없습니다" 오탐을 방지할 수 있습니다. Mac App Store(App Sandbox) 배포 시 `tauri-plugin-persisted-scope`와 `com.apple.security.files.user-selected.read-write` entitlement, 외부 정식 배포 시 Apple Developer 코드 서명·공증(`APPLE_DEVELOPMENT_TEAM`, `APPLE_SIGNING_IDENTITY` 환경변수)이 필요합니다.
- **macOS 개발/빌드 시 포트·락 정리(필요 시)**:

```bash
kill -9 $(lsof -t -i :1420 -i :1421) 2>/dev/null
find src-tauri/target -name "lock.ios" -o -name ".cargo*-lock" -delete 2>/dev/null
```

### Android 빌드

```bash
npm run android:init
npm run android:dev
npm run android:build       # arm64 debug APK
npm run android:release     # arm64 release APK
npm run android:release:all # 전체 ABI release APK
```

## CI와 릴리스

- [`.github/workflows/ci.yml`](.github/workflows/ci.yml): 모든 PR과 `main` 푸시에서 5개 작업을 실행합니다. `verify`(전체 검증 게이트), `licenses`(cargo-deny·고지 일치), `macos-build`(유니버설 빌드·서명 검증), `ios-sim-build`(서명 없는 시뮬레이터 빌드), `android-debug`(debug APK). 비밀값을 쓰지 않으며, `main` 병합과 릴리스 게이트는 핵심 작업 `verify`·`licenses`·`macos-build`만 요구합니다(저장소 관리자는 긴급 시 우회 가능). 후순위 플랫폼 작업(`ios-sim-build`·`android-debug`)은 결과만 보고하며, 실패하면 따로 확인해 고칩니다.
- [`.github/workflows/release.yml`](.github/workflows/release.yml): `v*` 태그 푸시 또는 `workflow_dispatch`로 실행합니다. 빌드 전에 릴리스 게이트(`scripts/check-release-gate.mjs`)를 통과해야 하고, **macOS 유니버설 `.dmg`**(핵심 빌드)와 테스트용 빌드인 **Linux x64 `.deb`·`.AppImage`**(정식 버전은 `.rpm` 추가), **Android arm64 `.apk`**(포크 서명 키)만 만듭니다. Linux·Android 파일 이름에는 `-test`가 붙고, 릴리스 노트에 "테스트용 빌드" 절이 들어갑니다. 테스트용 빌드가 실패하거나 서명 키 비밀값이 없거나 보안상 제외(`.github/release-exclusions.json`)되면 그 플랫폼만 빼고 게시하며 노트에 누락 안내를 남깁니다(debug 서명 APK는 게시하지 않음). macOS 빌드가 실패하면 게시하지 않고, 같은 테스트용 빌드 플랫폼이 3회 연속 빠지면 다음 릴리스 게이트가 멈춥니다. 게시 전에 `SHA256SUMS.txt`를 만들고 표식·누락 안내·Windows 산출물을 다시 확인합니다.

### 릴리스 절차

1. 버전을 맞추고 검증합니다(`package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `src-tauri/tauri.conf.json`, Apple 프로젝트 설정, Android `versionCode`).
   ```bash
   npm run check:version
   npm run verify
   ```
2. 리허설로 전체 흐름을 먼저 확인합니다. 리허설은 `-rehearsal` 태그 이름을 쓰고 초안 릴리스만 만듭니다.
   ```bash
   gh workflow run release.yml -f rehearsal=true -f tag_name=v1.0.0-alpha.1-rehearsal
   ```
3. 태그를 푸시해 실제 릴리스를 게시합니다.
   ```bash
   git tag v1.0.0-alpha.1
   git push origin v1.0.0-alpha.1
   ```

자세한 운영 절차는 [메인테이너 운영 절차](./docs/maintainer-runbook.md)와 [Android 서명 키 관리](./docs/android-signing.md)를 참고하세요.


## 커밋 규칙

커밋 메시지는 **한국어**로 쓰고 Conventional Commits 접두사(`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `ci:`, `chore:` 등)와 요약 제목을 붙입니다. 본문에는 ① 변경 이유, ② 핵심 수정 내용, ③ 영향 범위와 검증 결과를 적습니다. `npm run check:commit-msg`로 확인할 수 있습니다.
