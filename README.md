# EasyViewer

심플한 Text(TXT), EPUB 범용 문서 뷰어 (`v0.1.6-alpha` 프리릴리즈)

> **라이선스**: 본 프로젝트는 [GNU General Public License v3.0 (GPL-3.0)](./LICENSE) 하에 배포됩니다. 서드파티 오픈소스 라이선스 상세 목록은 [THIRD_PARTY_LICENSES.md](./THIRD_PARTY_LICENSES.md)를 참고하세요.

---

## 지원 기능

### 뷰어 옵션 및 테마

- **보기 모드**: 세로 스크롤(`scroll`) / 가로 페이지 넘김(`paginated`) 실시간 전환 및 읽던 위치 보존
- **타이포그래피**: 글꼴(시스템·로컬 폰트 스택, 외부 CDN 미사용), 글자 크기, 줄 간격, 여백 조절
- **컬러 테마**: 기본(라이트) / 다크 모드 / 세피아 모드

### 서재 · 동기화 · 보안

- **EPUB / TXT 열람 및 통합 검색**: 목차(TOC)·챕터 이동(EPUB), 인코딩 자동 감지 및 대용량 청크 로딩(TXT), 책갈피 및 진행률 저장
- **네트워크 다운로드 & WebDAV 동기화**: 원격 파일 다운로드, 로컬 동기화 허브 및 원격 WebDAV/엔드포인트 동기화
  - WebDAV `v1 → v2` 마이그레이션으로 평문 비밀번호를 제거하고, 네이티브(데스크톱/모바일)에서는 OS 키체인(`tauri-plugin-keyring-store`), 웹에서는 세션 메모리 기본 격리(명시 동의 시 로컬 저장)를 사용합니다.
- **Zero-Trust 보안 경계**:
  - **CSP & EPUB 격리**: 앱 수준 `Content-Security-Policy` 활성화, EPUB Zip Bomb 사전 상한 검사(`validateEpubArchiveBounds`) 및 다층 HTML/SVG/CSS 정화(`sanitizeSectionDocument`)
  - **SSRF / DNS Pinning / TLS 검증**: 개발·프리뷰 프록시(`/__remote_proxy`)의 Fail-Closed `Origin`/`Sec-Fetch-Site`·세션 논스·총합 타임아웃 및 네이티브 Rust `safe_remote_fetch`(`reqwest 0.13` `rustls` + `url::Host` IPv4/IPv6 분류 + 전체 수명 데드라인) 단일 신뢰 경계 적용
  - **최소 권한 Capability & 경로 화이트리스트**: 데스크톱 전용 `desktop.json` 분리, `tauri-plugin-opener` 스코프 제한, `allow_storage_dir` 조상 정규화 및 `read_validated_book_file`(`#[cfg(desktop)]`, 대소문자 비구분 OS 민감 경로 차단)

---

## 개발 정보 및 아키텍처

- **프레임워크**: Vue `^3.5.13` (`<script setup lang="ts">`) + TypeScript `~5.6.3` (`strict: true`) + Vite `^6.0.5`
- **상태 / 라우팅 / UI**: Pinia `^2.3.0`, Vue Router `^4.5.0`, Tailwind CSS `^3.4.17`, Lucide Vue Next `^0.468.0`
- **문서 엔진**: `epubjs ^0.3.93` + `jszip ^3.10.1`, Custom TXT Engine(`txtEngine.ts`, `txtMeasuredPagination.ts`)
- **네이티브 백엔드**: Tauri `2` (`@tauri-apps/api ^2.12.4`, `plugin-dialog`, `plugin-fs`, `plugin-store`, `plugin-opener`, `tauri-plugin-keyring-store`), Rust `reqwest 0.13` (`rustls` + `rustls-platform-verifier`)
- **지원 플랫폼**: Windows, macOS, Android, iOS, Web Fallback (`IndexedDB` / 프록시)

### 디렉토리 구조

```text
EasyViewer/
├── src/
│   ├── assets/                 # 글로벌 스타일 및 로컬 폰트 스택 (main.css)
│   ├── components/
│   │   ├── library/            # 원격 다운로드 모달, 동기화 모달 (NetworkDownloadModal, SyncModal)
│   │   └── viewer/             # 뷰어 설정 패널, 목차/책갈피/검색 드로어
│   ├── engines/                # 순수 문서 엔진 (상위 레이어 비의존; @/types만 참조)
│   │   ├── epub/               # epub.js 래퍼, Zip Bomb/HTML/SVG/CSS 정화, 안정 스크롤 관리자
│   │   └── txt/                # 인코딩 감지, 청킹·검색, 실측 기반 가로 페이지네이션
│   ├── services/
│   │   ├── platform/           # 플랫폼 추상화 포트 (dialog, dragDrop, path, credential)
│   │   ├── storage/            # 파일·KV 영속 어댑터 (Tauri FS/Store vs Web IndexedDB)
│   │   ├── network/            # SSRF 검증기(ssrfValidator), 안전 fetch(remoteFetch), download/webdav
│   │   ├── sync/               # 기기 간 읽기 위치·책갈피 병합 및 동기화 서비스
│   │   └── sampleBooks.ts      # 기본 내장 샘플 도서 데이터
│   ├── stores/                 # Pinia 스토어 (useBookStore, useSettingsStore)
│   ├── types/                  # 공통 TypeScript 인터페이스 및 타입 정의
│   └── views/                  # 라우터 뷰 (LibraryView, ReaderView)
├── src-tauri/
│   ├── capabilities/           # 최소 권한 분리 (default.json, desktop.json)
│   └── src/lib.rs              # safe_remote_fetch, 경로 화이트리스트, 바이너리 책 읽기 커맨드
├── scripts/                    # 아키텍처 경계·버전 일치·커밋 규칙·프록시 가드·통합 verify 스크립트
├── tests/                      # 1계층 Vitest 단위/계약 + 2계층 Playwright E2E/성능 기준선 테스트
└── specs/                      # Spec Kit 기능 명세, 아키텍처 계획, 보안 계약 및 검증 체크리스트
```

---

## 실행 및 품질 검증 (테스트 · 거버넌스 게이트)

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

### 테스트 및 통합 검증 스크립트

```bash
# 1계층 단위·플랫폼 경계 테스트 (Vitest + mockIPC, 30초 이내 고속 실행)
npm test

# 정적 아키텍처 경계 위반 검사 (views/stores/components/engines/sync 내 직접 Tauri/웹저장소/fetch 차단)
npm run check:boundaries

# package.json, Cargo.toml, tauri.conf.json 버전 일치 검증
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

---

## 버전 관리 및 크로스 플랫폼 빌드

### 버전 동기화 대상 파일

버전 변경 시 아래 파일의 버전을 일치시킨 뒤 `npm run check:version`으로 검증합니다.

- `./package.json`
- `./package-lock.json`
- `./src-tauri/Cargo.toml` (및 `cargo check`를 통한 `./src-tauri/Cargo.lock` 반영)
- `./src-tauri/tauri.conf.json`

### Rust 툴체인 사전 요구사항

- 권장 버전: `rustc >= 1.90.0` (최신 Tauri v2 공식 플러그인 및 `reqwest 0.13` `rustls` MSRV 충족)
- Windows 빌드 시 Visual Studio C++ 빌드 도구(`MSVC x64/x86`, Windows 10/11 SDK) 필요

```bash
node -v && npm -v
rustc --version && cargo --version
rustup show
```

### Windows 빌드

```bash
# 단독 실행 파일만 빌드 (--no-bundle)
npm run tauri build -- --no-bundle

# NSIS 설치 프로그램 빌드
npm run tauri build -- --bundles nsis

# MSI 설치 패키지 빌드
npm run tauri build -- --bundles msi
```

생성 경로 (`<version>` 예: `0.1.6-alpha`):
- 포터블 실행 파일: `src-tauri/target/release/easy-viewer.exe`
- NSIS 설치 프로그램: `src-tauri/target/release/bundle/nsis/EasyViewer_<version>_x64-setup.exe`
- MSI 설치 패키지: `src-tauri/target/release/bundle/msi/EasyViewer_<version>_x64_en-US.msi`

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

- **배포 및 macOS 서명 참고 (`0.1.6-alpha` 프리릴리즈 기준)**: 기본 데스크톱 빌드는 비샌드박스(`.dmg`/Hardened Runtime)를 기준으로 하며, `src-tauri/tauri.conf.json`에 `bundle.macOS.signingIdentity: "-"`(Ad-Hoc 서명 + Hardened Runtime Seal)이 설정되어 `codesign --verify --deep --strict` 무결성 검증을 통과합니다(로컬 검증 아티팩트: `build/EasyViewer_0.1.6-alpha_aarch64.dmg`). Apple Developer 공증(Notarization) 전 프리릴리즈 `.dmg`를 브라우저로 내려받은 경우 최초 실행 전 `xattr -cr /Applications/EasyViewer.app`로 Gatekeeper 격리 속성을 해제해야 "손상되었기 때문에 열 수 없습니다" 오탐을 방지할 수 있습니다. Mac App Store(App Sandbox) 배포 시 `tauri-plugin-persisted-scope`와 `com.apple.security.files.user-selected.read-write` entitlement, 외부 정식 배포 시 Apple Developer 코드 서명·공증(`APPLE_DEVELOPMENT_TEAM`, `APPLE_SIGNING_IDENTITY` 환경변수)이 필요합니다.
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

### GitHub Actions 멀티 플랫폼 자동 릴리즈

- [`.github/workflows/release.yml`](.github/workflows/release.yml): `v*` 태그 푸시 또는 `workflow_dispatch` 수동 실행 시 `npm run verify` 게이트 통과 후 **macOS Universal (`.dmg`)**, **Windows x64 (`-setup.exe`, `.msi`)**, **Linux x64 (`.deb`, `.rpm`, `.AppImage`)**, **Android arm64 (`.apk`)** 설치 패키지를 병렬 빌드하여 GitHub Release에 자동 첨부(`gh release upload --clobber` 또는 신규 릴리즈 생성, `-` 포함 프리릴리즈 태그 자동 감지)합니다.
- [`.github/workflows/build-apple.yml`](.github/workflows/build-apple.yml): `main` PR 및 수동 실행용 macOS Universal + iOS 시뮬레이터(`--debug --target aarch64-sim`) 빌드 검증 워크플로우입니다.

---

## 라이선스 (License)

- 주 라이선스: **GNU General Public License v3.0 (GPL-3.0)** — 자세한 내용은 [`LICENSE`](./LICENSE)를 확인하세요.
- 서드파티 의존성 라이선스: 프론트엔드(npm) 및 Rust 백엔드(Cargo) 오픈소스 고지 목록은 [`THIRD_PARTY_LICENSES.md`](./THIRD_PARTY_LICENSES.md)를 참고하세요.
