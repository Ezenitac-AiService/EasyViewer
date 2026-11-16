# 계약 2: 통합 신뢰 경계·직접 스트리밍·SSOT 네트워크 보안 (`FR-001`, `FR-003`, `FR-006`, `FR-007`, `FR-014`)

**Feature**: `002-deep-refactoring-overhaul` | **Date**: 2026-11-16

---

## 1. 크로스 OS 로컬 경로 신뢰 경계 (`src-tauri/src/security/path_guard.rs`)

1. **`dunce::canonicalize` 기반 정규화**:
   - Windows 환경에서 `std::fs::canonicalize`가 생성하는 `\\?\C:\...` verbatim 접두사를 `dunce::canonicalize`로 정규화하고, `\\?\UNC\` 또는 `//server/share` 네트워크 UNC 공유 경로는 민감/비승인 경로로 거부한다.
2. **크로스 OS 시스템 보호 경로 목록 (`is_sensitive_path_with_case_mode`)**:
   - **POSIX**: `/System`, `/Library`, `/etc`, `/private`, `/proc`, `/sys`, `/dev`, `/root`, `/var/root`, `/var/db`
   - **Windows (대소문자 비구분)**: `C:/Windows`, `C:/Program Files`, `C:/Program Files (x86)`, `C:/ProgramData`, `C:/Recovery`, `C:/System Volume Information`, 사용자 `AppData/Local/Microsoft` 등 시스템 보호 영역 (드라이브 문자 및 `/`·`\` 정규화 포함)
   - **자격증명 컴포넌트**: `.ssh`, `.gnupg`, `.aws`, `.kube`, `.git-credentials`, `.npmrc`, `.netrc`
3. **크로스 플랫폼 단일 읽기·해싱·가져오기·메타 추출 일원화 (`FR-001`, `FR-006`, `FR-007`)**:
   - `PlatformStorageAdapter.loadBookBinary`, `PlatformStorageAdapter.sameFileContent`, 및 **`src/services/platform/dialogService.ts` (`readValidatedLocalFileBuffer`)** 는 Tauri 환경에서 JS `@tauri-apps/plugin-fs` `readFile(...)`을 절대 호출하지 않는다(`plugin-fs` 선행 시도 후 폴백하는 역전 패턴 완전 제거).
   - `read_validated_book_file`, `hash_validated_book_file(storedPath)`, `extract_epub_metadata_from_path(storedPath)`, 및 **`import_validated_book_to_storage(sourcePath, destDir, targetFileName)`** 는 모두 **`#[cfg(desktop)]`**(`AppSecurityState` 승인 폴더 + `dunce::canonicalize` 기반 `fs_scope_allowed` + 드롭 목록) 및 **`#[cfg(mobile)]`**(`app.path().app_data_dir()?.join("books")`) 양쪽을 지원하는 크로스 플랫폼 커맨드로 제공한다. 이를 통해 `src-tauri/capabilities/{default,desktop}.json` 양쪽 모두에서 `fs:allow-read-file`을 완전히 제거해도 Android·iOS 포함 전 플랫폼 도서 열기가 정상 동작한다.
   - 네이티브 로컬 파일 선택/드롭(`dialogService`·`dragDropService` `sourcePath`) 및 원격 다운로드 시 JS 힙에 256MB `ArrayBuffer`를 선행 적재하지 않고 `import_validated_book_to_storage` / `safe_download_to_storage`로 디스크 스트리밍 복사(대상 폴더 쓰기 실패 시 `safe_download_to_storage`와 동일하게 `STORAGE_DIR_WRITE_FAILED:` 반환)+`sha2::Sha256`+`zip`(`9.x`, `deflate`) 선택 메타(`ExtractedEpubMetadata`, `MAX_METADATA_ENTRY_BYTES` ZIP Bomb 상한 가드 포함)를 수행한다(웹·순수 버퍼 경로만 JS `ArrayBuffer` 및 동적 `metadataExtractor` 사용).

---

## 2. 네이티브 원격 다운로드 직접 스트리밍 (`src-tauri/src/commands/remote.rs`)

```rust
#[tauri::command]
pub async fn safe_download_to_storage(
    app: tauri::AppHandle,
    request: SafeDownloadRequest,
    on_progress: tauri::ipc::Channel<DownloadProgressEvent>,
) -> Result<NativeDownloadResult, String>
```

1. **크로스 플랫폼 상태·대상 폴더 해석 (`desktop` vs `mobile`)**:
   - `AppSecurityState`는 데스크톱 전용(`#[cfg(desktop)]`)이므로 커맨드 인자에서 직접 `State<'_, AppSecurityState>`를 요구하지 않고, `#[cfg(desktop)]` 분기 내부에서 `app.state::<AppSecurityState>()` + `validate_and_prepare_storage_dir`로 승인 폴더를 검증하며, `#[cfg(mobile)]` 분기에서는 `app.path().app_data_dir()?.join("books")`를 사용한다(쓰기 불가 시 즉시 `STORAGE_DIR_WRITE_FAILED:` 반환).
2. **SSRF & 리다이렉트 & TLS 오류 매핑**: 기존 `safe_remote_fetch`와 동일한 `security::ssrf` 계층(DNS Pinning, IPv4/IPv6/Zone/정수·8진·IPv6 전환 대역 우회 차단, 최대 5홉 리다이렉트 및 교차 출처 리다이렉트 시 `Authorization`/`Cookie` 민감 헤더 자동 제거, 자체 서명 인증서 실패 시 `SELF_SIGNED_TLS_CONFIRM_REQUIRED:` 에러 코드 매핑, 총합 수명 데드라인 `TIMEOUT:`)을 통과한다.
3. **스트리밍 + 청크 데드라인 + 해시 + 경합 방지 임시 파일명**: `reqwest` (`"stream"` 피처) `bytes_stream()` + `futures-util` `StreamExt` + `tokio::io::BufWriter`로 64 KiB 고정 버퍼를 **고유 전송 난수가 포함된 임시 파일(`<sanitized>.<nonce>.part`)** 에 직접 기록(동시 다운로드 충돌·상호 삭제 방지)하며, **매 청크 수신 시마다 `compute_remaining_budget(deadline, Instant::now())`를 검증**해 저속 스트리밍(Slowloris) 지연을 차단한다. 동시에 `sha2::Sha256`을 점진 계산하고 `MAX_BOOK_BYTES` 또는 데드라인 초과 시 즉시 중단·해당 `.part` 파일만 삭제한다. 완료 후 원자적 rename으로 최종 경로 확정 후 `{ storedPath, fileName, fileSize, contentHash, finalUrl, detectedFormat }` 반환하며, 이후 메타·표지 추출은 `extract_epub_metadata_from_path(storedPath)`로 처리한다.
4. **일반 메타/WebDAV HTTP**: 소형 XML/JSON 동기화·WebDAV 디렉토리 조회는 기존 `safe_remote_fetch` 유지(단, 대용량 도서 다운로드는 `safe_download_to_storage` 전용).

---

## 3. 단일 진실 공급원(SSOT) SSRF 규칙 & 정적 웹 보안 (`FR-003`)

1. **규칙 통합 및 IPv6 전환 대역 차단**: `scripts/ssrfRules.mjs`는 **`node:*` 내장 모듈 임포트가 전혀 없는 순수 ESM**으로 순수 IPv4/IPv6 CIDR·사설망·고위험 주소 분류/정규화 로직을 보유하고, `tsconfig.json` `include` 범위 내 타입 선언(`src/types/scripts-ssrf.d.ts`)을 통해 `src/services/network/ssrfValidator.ts` 및 `scripts/remoteProxyGuard.mjs`가 `vue-tsc -b`·`vite build` 오류 없이 동일 규칙을 공유한다. 또한 `scripts/ssrfRules.mjs`와 `src-tauri/src/security/ssrf.rs`는 모두 `::ffff:0:0/96`(IPv4-mapped) 외에 **NAT64(`64:ff9b::/96`, `64:ff9b:1::/48`), 6to4(`2002::/16`), Teredo(`2001:0000::/32`), 구형 IPv4-compatible(`::/96` 비영 하위 32비트)** 내장 IPv4를 추출·분류(또는 고위험 차단)하여 교차 동등성 테스트 벡터로 동기화한다.
2. **비프록시 정적 웹 정책**:
   - 프록시 가용 여부는 `/__remote_proxy` 응답에서 **긍정 지문 `res.ok && res.headers.get('x-easyviewer-proxy') === '1'`** 여부로만 판정한다(`404`, 네트워크 오류뿐 아니라 SPA 정적 호스트의 `200 OK (text/html)` fallback 응답까지 모두 비프록시 정적 웹 `hasSecurityProxy === false`로 일관 분류).
   - 비프록시 정적 웹 배포 환경에서:
     - 고위험 내부망·사설망 주소: 차단 (`BLOCKED_HIGH_RISK` / `PRIVATE_NETWORK_CONFIRM_REQUIRED`).
     - 인증(`Authorization` / WebDAV 자격증명) 포함 요청: `https:`가 아닌 경우 무조건 거부(`INSECURE_AUTH_BLOCKED`); `https:` 출처라도 기본 차단 후 사용자 위험 고지·CORS 안내에 대한 **명시적 동의** 시에만 **현재 세션 메모리 자격증명**으로 직접 요청 허용(브라우저 영구 저장 금지).
     - 비인증 공개 `https:`/`http:` URL 다운로드: 브라우저 CORS 범위 내 허용.

---

## 4. 콘텐츠 해시, 멀티 플랫폼 앱 식별자 정합 및 프리릴리즈 번들 분기 (`FR-006`, `FR-014`)

- **해시 알고리즘**: 전체 파일 `SHA-256` (`sha256-<lowercase hex>`).
  - 가져오기 시 동일 `fileSize`를 가지며 `contentHash`가 없는 레거시 도서가 있으면 해당 후보만 즉시 해싱(데스크톱은 Rust `hash_validated_book_file` 스트리밍, 웹은 `crypto.subtle`)해 동일 파일 여부를 판정한다.
- **전 플랫폼 식별자·버전 통일 및 레거시 경로 차단**:
  - `src-tauri/tauri.conf.json` (`com.edith.easyviewer`)
  - `src-tauri/tauri.android.conf.json` (`com.edith.easyviewer`), `src-tauri/gen/android/app/build.gradle.kts` (`applicationId`·`namespace`), `MainActivity.kt` (`package com.edith.easyviewer`), `buildSrc/src/main/java/com/edith/easyviewer/kotlin` 경로 일치 및 `src-tauri/gen/android` 내 레거시 `com/easyviewer` 디렉터리 잔존 금지
  - `src-tauri/gen/apple/project.yml` (`bundleIdPrefix: com.edith.easyviewer` + `PRODUCT_BUNDLE_IDENTIFIER: com.edith.easyviewer`) 및 `src-tauri/gen/apple/easy-viewer_iOS/Info.plist` (`CFBundleShortVersionString`/`CFBundleVersion` 동기화)
  - `scripts/check-version-sync.mjs`: 위 Android/Apple 식별자, `MainActivity.kt`·`buildSrc` 패키지 경로, 레거시 `com/easyviewer` 부재 및 버전 일치를 함께 검증한다.
- **저장소·릴리즈 워크플로우 및 프리릴리즈 번들 분기(`scripts/ci-build-desktop.mjs`)**:
  - `build/*.dmg` 대용량 바이너리 Git 추적 제거(`.gitignore` 복원) 및 `.github/workflows/release.yml` 내 레거시 `build/*.dmg` 복사 분기 정리.
  - `scripts/ci-build-desktop.mjs`는 순수 함수 `resolveDesktopBuildCommand(matrixName, version, defaultCmd)`를 export하여, `version.includes('-')`(모든 SemVer 프리릴리즈)일 때 WiX(`.msi`) 및 RPM(`rpmbuild`) 버전 형식 제약을 회피하도록 Windows는 `npx tauri build --bundles nsis`, Linux는 `npx tauri build --bundles deb,appimage`로 일관되게 분기하고, 정식 버전에서는 기본 명령(`nsis,msi` / `deb,rpm,appimage`)을 유지한다.
