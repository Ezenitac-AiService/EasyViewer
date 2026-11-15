# 보안 정책 및 네트워크·콘텐츠 격리 계약 (`FR-007`, `FR-008`, `FR-009`)

## 1. 앱 콘텐츠 보안 정책 (`src-tauri/tauri.conf.json`)

```json
{
  "app": {
    "security": {
      "csp": {
        "default-src": "'self' customprotocol: asset:",
        "script-src": "'self'",
        "style-src": "'self' 'unsafe-inline' blob:",
        "img-src": "'self' asset: http://asset.localhost blob: data:",
        "font-src": "'self' data: blob:",
        "frame-src": "'self' blob: data:",
        "child-src": "'self' blob: data:",
        "connect-src": "'self' ipc: http://ipc.localhost blob: data:",
        "object-src": "'none'",
        "base-uri": "'self'"
      }
    }
  }
}
```

- **외부 폰트 CDN 금지 및 Preview CSP 검증**: `index.html`의 `https://fonts.googleapis.com` 및 `https://fonts.gstatic.com` `<link>` 태그를 제거해 `font-src`/`style-src`에 외부 도메인 예외를 두지 않는다. 2계층 Playwright 보안 테스트는 `src-tauri/tauri.conf.json`의 `app.security.csp`를 읽어 preview HTTP `Content-Security-Policy` 응답 헤더로 주입한 상태에서 실제 적용 및 위반 0건을 검증한다.
- **EPUB 내부 iframe 격리 (`src/engines/epub/epubEngine.ts`)**:
  - **아카이브 사전 상한 검증(Zip Bomb 차단)**: `ePub(buffer)` 및 `locations.generate(150)` 호출 전에 `jszip`으로 중앙 디렉토리 엔트리 수, 개별 엔트리/누적 압축 해제 크기 상한(예: 최대 엔트리 `10,000`개, 누적 비압축 크기 `256 MiB`, 압축률 이상 급증 거부)을 선검사해 메모리 고갈·비정상 아카이브를 즉시 거부한다.
  - `sanitizeSectionDocument`로 활성 요소(`script`, `iframe`, `frame`, `frameset`, `object`, `embed`, `applet`, `portal`, `base`, SVG `foreignObject`/`use`/`animate`/`set`), `on*` 인라인 이벤트 속성, `javascript:`/`vbscript:`/`data:text/html`/`data:image/svg+xml` 위험 URI, CSS `@import`/`expression()`/`url(...)` 내 위험 스킴을 제거하고, `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; object-src 'none'; frame-src 'none'; child-src 'none'; worker-src 'none'; form-action 'none'; base-uri 'none'; connect-src 'none'; style-src 'self' 'unsafe-inline' blob: data:; img-src 'self' blob: data:; font-src 'self' blob: data:">`를 `<head>` 최상단에 삽입한다.
  - **`<base>`·`hooks.content` 정합성**: `epub.js` 렌더링 시 `hooks.content.register` 콜백이 `<base>`를 주입·제거하는 순서와 `CONTENT_CSP`(`base-uri 'none'`) 간의 충돌 여부를 Chromium 및 WebKit에서 다중 챕터·내부 CSS/이미지/SVG EPUB으로 검증하며, 필요 시 상대 경로 해석을 정적 해석(또는 안전한 blob URL 유지)으로 대체한다.
  - WebKit 탭 이벤트 호환을 위한 `allowScriptedContent: true` 사용 시에도 위 사전 아카이브 상한 검사·정화·메타 CSP를 통해 도서 내부 스크립트 실행·외부 리소스 유출·`@import`·자원 고갈이 100% 차단됨을 1·2계층 보안 테스트로 검증한다.

---

## 2. Tauri v2 플랫폼별 Capability 분리 (`src-tauri/capabilities/`)

- `src-tauri/capabilities/default.json` (공통·모바일 최소 스코프):
  - `core:default`, `fs:default`, `store:default`, `dialog:default`, `keyring-store:default` (와일드카드 `http:default` 및 광범위 `fs:allow-appdata-read-recursive` / `fs:allow-appdata-write-recursive` 제거 — 원격 HTTP는 Rust 전용 `safe_remote_fetch` 커맨드로만 수행)
  - 모바일·공통 내부 책 저장(`books/<id>.bin`)용으로 `fs:allow-exists`, `fs:allow-read-file`, `fs:allow-write-file`, `fs:allow-mkdir`, `fs:allow-remove`는 `{ "path": "$APPDATA/books/**" }` 스코프로만 한정한다. (`fs:allow-appdata-meta-recursive` 대신 필요 시 `$APPDATA/books/**` 메타만 허용)
- `src-tauri/capabilities/desktop.json` (`"platforms": ["linux", "macOS", "windows"]`):
  - 데스크톱 사용자 폴더·드래그앤드롭·다이얼로그·파일 탐색기 열기 연계용 `fs:allow-exists`, `fs:allow-stat`, `fs:allow-read-file`, `fs:allow-write-file`, `fs:allow-mkdir`, `fs:allow-rename`, `fs:allow-remove`, 그리고 승인된 저장 디렉토리 범위로 스코프를 제한한 `opener:allow-open-path` 권한(`std::process::Command::new("open")` 수동 셸 실행 제거; 프론트엔드는 `platformAdapter.ts` `openStorageDir`에서 `@tauri-apps/plugin-opener` `openPath` 호출 전 `allow_storage_dir` 검증을 선행), 런타임 `allow_storage_dir`(`app.fs_scope().allow_directory`) 및 `$APPDATA/**` 스코프를 정의한다.
  - **Zero-Trust IPC 경로 검증 (`allow_storage_dir`, `read_validated_book_file`)**:
    - `read_validated_book_file`은 `#[cfg(desktop)]` 전용으로 한정한다(모바일 빌드 미등록).
    - `allow_storage_dir`는 미존재 리프 경로 생성 전 가장 가까운 기존 조상 디렉토리까지 올라가 `canonicalize()`로 심볼릭 링크 탈출 및 OS/자격증명 민감 경로(`/System`, `/Library`, `/etc`, `/private`, `~/.ssh`, `~/.gnupg`, `~/.aws`, `~/.kube` 등)를 차단한 뒤 `create_dir_all` 수행 및 생성 후 `canonicalize()` 재검증을 거쳐 Rust 승인 저장소 집합(`Mutex<HashSet<PathBuf>>`)과 `app.fs_scope().allow_directory`에 등록한다(TOCTOU 방어). **macOS(APFS/HFS+)·Windows의 대소문자 비구분 파일시스템 우회(`/system`, `.SSH` 등)를 막기 위해 해당 OS에서는 ASCII 소문자 정규화 비교를 필수로 적용한다.**
    - `read_validated_book_file`은 대상 경로의 `canonicalize()` + 대소문자 정규화 민감 경로 블랙리스트 차단뿐만 아니라, **등록된 `allow_storage_dir` 하위 또는 Tauri 런타임이 부여한 파일 스코프/네이티브 드롭·다이얼로그 승인 경로 화이트리스트에 속하는 `.epub`/`.txt` 일반 파일만** 읽도록 강제해 임의 사용자 파일 읽기 오라클을 차단한다. 또한 JSON 배열 직렬화(수 기가바이트 메모리 폭증)를 피하기 위해 Tauri v2 바이너리 `tauri::ipc::Response`로 반환한다.
  - 데스크톱 드래그앤드롭 파일이 `allow_storage_dir` 외부 경로일 경우 Tauri 네이티브 Webview 드롭 시 부여되는 경로/일시 스코프를 Rust 검증 읽기 커맨드(`read_validated_book_file`) 화이트리스트와 연계해 일관되게 처리·검증한다.
  - **macOS 배포/샌드박스 경계**: 기본 비샌드박스(`.dmg`/Hardened Runtime) 배포를 전제하며, Mac App Store 등 App Sandbox 적용 빌드에서는 `tauri-plugin-persisted-scope` 및 `com.apple.security.files.user-selected.read-write` entitlement 없이는 재실행 시 폴더 스코프가 유지되지 않으므로 반드시 별도 검증한다.
- **원칙**: 모바일(`android`, `ios`) 빌드에는 데스크톱 전용 사용자 폴더, 임의 경로 파일 읽기, 광범위 `$APPDATA` 읽기/쓰기 권한 및 WebView 직접 HTTP fetch(`plugin:http|fetch`) 권한이 부여되지 않도록 분리한다.

---

## 3. 원격 통신·프록시 SSRF·동일 출처·TLS 검증 계약 (`/__remote_proxy` + 네이티브 Rust `safe_remote_fetch`)

### 3.1 웹 프록시(`/__remote_proxy`) 요청 수락 조건 (Zero Trust & DoS 방어)
1. **동일 출처(Origin) 및 Fail-Closed 검증**: `Origin` 또는 `Referer` 헤더가 누락되었거나 요청의 `Host` 헤더(허용된 로컬 Dev/Preview 호스트)와 일치하지 않으면 예외 없이 `403 Forbidden`으로 거부한다(Fail-Closed). 또한 브라우저 컨텍스트에서 `Sec-Fetch-Site`가 존재하고 `same-origin`이 아닌 경우에도 `403`으로 차단하며, 응답에 `Access-Control-Allow-Origin: *`를 설정하지 않는다.
2. **HTTP 메서드 화이트리스트·요청/응답 상한·총합 타임아웃·프록시 식별 헤더**:
   - 허용 HTTP 메서드: `GET`, `HEAD`, `OPTIONS`, `PROPFIND`, `POST` 외 메서드는 `405 Method Not Allowed`로 차단한다.
   - 요청 본문 크기 상한(예: `1 MiB` 초과 시 `413 Payload Too Large`), 업스트림 응답 크기 상한(기본 `256 MiB`, 요청 헤더 `x-max-response-bytes` 전달 시 서버 상한 이하로 클램핑; 초과 시 스트림 즉시 중단 및 `413`), 소켓 유휴 및 **전체 요청·스트림 수명 총합 타임아웃**(기본 `30s`, 요청 헤더 `x-request-timeout-ms` 전달 시 `1s~120s` 범위 클램핑; 초과 시 `504 TIMEOUT`)을 강제한다(Slowloris 방어).
   - 프록시가 처리한 모든 응답(업스트림 4xx/5xx 및 프록시 차단 오류 포함)에는 `X-EasyViewer-Proxy: 1` 헤더를 부여한다. 클라이언트(`remoteFetch.ts`)는 이 헤더가 존재하면 업스트림 `404`를 그대로 반환하고, 정적 웹 호스팅 등에서 프록시 미들웨어가 아예 마운트되지 않아 헤더 없는 `404`를 받은 경우에만 `public` URL에 한해 제한적 직접 `fetch()`를 허용한다.
3. **프로토콜 제한**: 정규화된 `URL.protocol`은 `http:` 또는 `https:`만 허용한다.
4. **고위험 내부 IP 무조건 차단 및 DNS Pinning (TOCTOU 방지)**:
   - 공용 순수 검증기(`src/services/network/ssrfValidator.ts`)가 URL·IP 리터럴·CIDR을 분류하고, Node 프록시 가드(`scripts/remoteProxyGuard.mjs`)가 DNS 해석 IP를 검증한 뒤 `http.request`/`https.request`의 커스텀 `lookup` 콜백으로 검증된 단일 IP를 고정(Host 헤더 및 TLS `servername` SNI 유지)하여 DNS Rebinding을 차단한다.
   - IPv4 무조건 차단: `0.0.0.0/8`, `127.0.0.0/8` (루프백), `169.254.0.0/16` (링크로컬/클라우드 메타데이터)
   - IPv6 무조건 차단: `::/128`, `::1/128` (루프백), `fe80::/10` (링크로컬), IPv4-mapped IPv6 (`::ffff:0:0/96` 내부 매핑 IP 추출 후 IPv4 규칙 재적용)
   - 차단 시 `403 Forbidden` 반환 (`"보안 정책에 의해 차단된 내부 네트워크 주소입니다."`).
5. **사설망 개인 NAS·자체 서명 TLS 예외의 서버 측 게이트**:
   - RFC 1918 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), IPv6 ULA (`fc00::/7`), `.local` 호스트는 기본적으로 `403` (`CODE: PRIVATE_NETWORK_CONFIRM_REQUIRED`)으로 차단하고, 자체 서명 TLS 검증 실패는 기본 `rejectUnauthorized: true` 상태에서 `502` (`CODE: SELF_SIGNED_TLS_CONFIRM_REQUIRED`)로 차단한다.
   - `x-allow-private-nas` / `x-allow-insecure-tls` 헤더 단독 신뢰를 금지하고, 프록시 서버가 부팅·세션 단위로 발급해 앱 HTML/핸드셰이크에만 전달하는 임시 세션 논스(`X-Proxy-Session-Token` 등) 및 명시적 호스트 예외 확인 절차를 통과한 요청에만 예외를 허용한다.
6. **리다이렉트 홉 검증 (최대 5회) 및 WebDAV 경로 정규화**:
   - 모든 `301/302/303/307/308` `Location` 대상에 대해 3~5번 검증 및 DNS Pinning을 재실행하고, 리다이렉트 대상 Origin이 최초 요청 Origin과 다를 경우 `Authorization` 헤더를 제거한다.
   - WebDAV `PROPFIND` XML 응답 파싱 시 `href`/`displayname`에 포함된 `..` 경로 탐색 세그먼트·제어 문자·비정상 절대 경로를 거부해 기준 디렉토리 이탈을 차단한다.

### 3.2 네이티브 앱(Rust `safe_remote_fetch` 통합 커맨드) 방어 조건
1. **WebView 직접 HTTP 권한 제거**: `capabilities/default.json`에서 `"http:default"` 와일드카드 및 `@tauri-apps/plugin-http` 클라이언트 직접 `fetch` 표면(`plugin:http|fetch`)을 제거해 WebView XSS가 JS URL 사전검사를 우회하는 경로 자체를 원천 봉쇄한다.
2. **Rust 단일 신뢰 계층(`safe_remote_fetch`)**: `src-tauri/Cargo.toml`의 `reqwest`(`0.13`, 기본 `rustls` + `rustls-platform-verifier`로 macOS `Security.framework` / Keychain 루트 CA 신뢰 확보) 기반 Rust 커맨드(`safe_remote_fetch`)가 URL 정규화·`url::Host`(`Ipv4`/`Ipv6`/`Domain`) 기반 IP 리터럴 즉시 분류·DNS 해석·고위험/사설 IP 검증·연결 IP 고정(대괄호 제거 호스트명 키 기반 DNS Pinning)을 소켓 연결 직전에 원자적으로 수행하며, 리다이렉트 루프 내 불필요한 클라이언트 재생성을 최소화해 연결 오버헤드를 제어한다. (`http://[::1]/`, `http://[::ffff:169.254.169.254]/`, `http://[fc00::1]/` 등 대괄호 IPv6 리터럴이 `to_socket_addrs` DNS 오류로 누락되지 않아야 한다.)
3. **수동 리다이렉트·총합 수명 데드라인·상한·TLS 제어**: `reqwest::redirect::Policy::none()`으로 자동 리다이렉트를 비활성화하고 최대 5홉을 Rust 내부에서 재검증(교차 출처 시 `Authorization` 제거)하며, 홉별 리셋이 아닌 **전체 요청·리다이렉트·스트림 읽기 총합 수명 데드라인**(`remaining_budget` + 초과 시 `TIMEOUT:` 오류) 및 응답 바이트 상한(`256 MiB`)을 강제한다. 기본값은 `danger_accept_invalid_certs(false)`를 유지하고, 사용자가 UI에서 승인한 `TrustedRemoteHostConsent`에 대응하는 요청별 플래그(`allowPrivateNas`, `allowSelfSignedTls`)가 명시된 경우에만 해당 단일 요청에 예외를 적용한다(무분별한 `/__remote_proxy` 자동 폴백 금지).

### 3.3 공통 동기화 보안 예외·오프라인 폴백 경계 (`syncService.ts`, `SyncModal.vue`)
1. **프록시(§3.1)·네이티브(§3.2) 공통 적용 규칙**: 원격 동기화 서버(`syncEndpoint`) `GET`/`POST` 호출은 HTTP `response.ok`(`2xx`)를 확인한 경우에만 원격 동기화 성공(`mode: 'remote'`)으로 판정한다. 일시적 네트워크 단절(오프라인)·`5xx` 서버 장애 시에는 `local-hub` 동기화로 안전하게 폴백하되, `4xx` 응답 및 `RemoteFetchConsentError`(`BLOCKED_HIGH_RISK`, `PRIVATE_NETWORK_CONFIRM_REQUIRED`, `SELF_SIGNED_TLS_CONFIRM_REQUIRED`)는 절대 삼키지 않고 상위로 전파하여 `SyncModal.vue`에서 오류 안내 또는 명시적 `TrustedRemoteHostConsent` 승인·재시도 UI를 제공한다.
