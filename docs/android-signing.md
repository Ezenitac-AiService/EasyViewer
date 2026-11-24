# Android 릴리스 서명 키 운영 안내

<!-- support-scope:start -->
이 포크는 **macOS**를 중점 지원합니다.
iOS는 우선순위를 낮춘 유지 플랫폼이며, 공개 배포 채널 없이 소스 빌드로만 제공합니다.
Linux·Android는 **테스트용 빌드**로만 배포합니다. 품질·기능 동등성·실기기 검증·대응 일정을 보장하지 않습니다.
**Windows는 이 포크의 범위가 아닙니다. Windows에서는 원저작자의 [EasyViewer](https://github.com/edith2580/EasyViewer)를 사용하세요.**
웹 브라우저 실행은 개발 보조용입니다.
Linux 테스트용 빌드는 Ubuntu 22.04 이상 또는 동급 배포판(deb·AppImage, WebKitGTK 4.1, X11·Wayland)에서 빌드합니다. Android 테스트용 빌드는 Android 7.0(API 24) 이상이 대상입니다.
<!-- support-scope:end -->

Pagelight의 Android APK(`com.ezenitac.easyviewer`)는 이 포크가 소유한 **release 키 하나**로만 서명합니다. 키를 아직 만들지 않았으면 릴리스 워크플로가 Android를 빼고 게시합니다(헌법 v4.3.0). 첫 APK를 서명한 키가 이후 모든 업데이트의 키가 되므로, debug 키나 임시 키로 서명한 APK는 게시하지 않습니다. Android는 같은 패키지 이름이라도 서명 인증서가 바뀌면 업데이트 설치를 거부합니다. 그래서 이 키를 잃으면 기존 사용자는 앱을 지우고 다시 설치해야 하고, 그 과정에서 앱 데이터가 사라집니다. 아래 절차는 키를 잃거나 유출하지 않기 위한 것입니다.

이 저장소에는 키 파일, 비밀번호, `keystore.properties`를 절대 넣지 않습니다. `.gitignore`가 `*.jks`, `*.keystore`, `*.p12`, `keystore.properties`를 막고 있습니다.

## 1. 키 생성

JDK의 `keytool`로 RSA 4096비트, 유효기간 25년 이상(아래는 약 30년)인 키를 만듭니다. 저장소 밖의 폴더에서 실행합니다.

```bash
keytool -genkeypair -v \
  -keystore pagelight-release.jks \
  -storetype PKCS12 \
  -alias pagelight \
  -keyalg RSA -keysize 4096 \
  -validity 11000 \
  -dname "CN=Pagelight, O=Pagelight contributors"
```

- 키스토어 비밀번호와 키 비밀번호는 비밀번호 관리자에서 생성한 긴 무작위 값을 씁니다.
- 별칭(`-alias`)은 이후 바꾸지 않습니다.

## 2. 백업

키를 만든 직후, 첫 서명 전에 백업을 끝냅니다.

- 서로 다른 보관 장소 **2곳 이상**에 둡니다. 그중 **1곳은 오프라인**(암호화한 USB 저장 장치 등, 네트워크에 연결하지 않고 보관)입니다.
- 나머지 1곳은 암호화된 비밀번호 관리자 또는 암호화 저장소입니다.
- 키 파일과 비밀번호를 같은 장소에 두지 않습니다.
- 백업마다 아래 4절의 지문을 확인해 원본과 같은지 검증합니다.

## 3. 접근 통제

- 키 파일과 비밀번호에 접근할 수 있는 사람은 메인테이너로 한정하고, 그 목록을 비공개로 관리합니다.
- 개인 개발 기기에 키를 상시 두지 않습니다. 로컬 release 빌드가 필요할 때만 꺼내고 끝나면 지웁니다.
- CI에서는 GitHub 저장소 비밀값(Secrets)으로만 씁니다. 로그에 비밀값이 나오지 않게 `echo`·`set -x`를 쓰지 않습니다.

## 4. 서명 인증서 지문 확인

```bash
keytool -list -v -keystore pagelight-release.jks -alias pagelight | grep 'SHA256:'
```

APK에서 확인할 때는 Android SDK build-tools의 `apksigner`를 씁니다.

```bash
apksigner verify --print-certs app-release.apk | grep 'SHA-256'
```

SHA-256 지문만 `specs/003-independent-fork-separation/verification/release-gate.md` 항목 8에 기록합니다. 지문은 공개 정보이므로 릴리스 노트에 실어도 됩니다. 비밀번호와 키 파일은 어디에도 기록하지 않습니다.

## 5. 빌드에서 쓰는 환경 변수

`src-tauri/gen/android/app/build.gradle.kts`의 `release` 서명 설정은 다음 환경 변수만 읽습니다.

| 환경 변수 | 내용 |
|---|---|
| `ANDROID_KEYSTORE_PATH` | 키스토어 파일 경로 |
| `ANDROID_KEYSTORE_PASSWORD` | 키스토어 비밀번호 |
| `ANDROID_KEY_ALIAS` | 키 별칭(예: `pagelight`) |
| `ANDROID_KEY_PASSWORD` | 키 비밀번호 |

release 작업을 실행할 때 하나라도 없으면 빌드가 `GradleException`으로 실패합니다. debug 키로 몰래 서명되는 일은 없습니다. debug 빌드(`npm run android:build`)는 영향을 받지 않습니다.

로컬 예시:

```bash
export ANDROID_KEYSTORE_PATH="$HOME/secure/pagelight-release.jks"
export ANDROID_KEYSTORE_PASSWORD='<키스토어 비밀번호>'
export ANDROID_KEY_ALIAS=pagelight
export ANDROID_KEY_PASSWORD='<키 비밀번호>'
npm run android:release
```

## 6. CI 비밀값 등록

GitHub 저장소 **Settings → Secrets and variables → Actions**에 다음을 등록합니다.

| 비밀값 | 내용 |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | 키스토어 파일을 base64로 인코딩한 값 |
| `ANDROID_KEYSTORE_PASSWORD` | 키스토어 비밀번호 |
| `ANDROID_KEY_ALIAS` | 키 별칭 |
| `ANDROID_KEY_PASSWORD` | 키 비밀번호 |

base64 값은 다음처럼 만들어 클립보드로 바로 옮깁니다(파일로 남기지 않음).

```bash
base64 -i pagelight-release.jks | pbcopy
```

릴리스 워크플로는 `ANDROID_KEYSTORE_BASE64`를 러너의 임시 파일로 복원하고 그 경로를 `ANDROID_KEYSTORE_PATH`로 넘깁니다. 작업이 끝나면 임시 파일을 지웁니다.

## 7. 분실·유출 시 대응

- **유출이 의심되면** 그 키로 서명한 새 릴리스를 즉시 멈추고, 저장소 비밀값을 지운 뒤 새 키를 만듭니다.
- **분실·교체 시** 새 키로 서명한 APK는 기존 설치본을 업데이트할 수 없습니다. 릴리스 노트와 README에 다음을 알립니다.
  - 서명 키가 바뀐 이유(분실 또는 유출)와 날짜, 새 인증서 SHA-256 지문
  - 기존 앱을 지우고 새 APK를 설치해야 한다는 사실
  - 재설치 전에 WebDAV 동기화로 읽기 위치·책갈피를 올려 두고, 재설치 후 책 파일을 다시 가져오는 방법([모바일 이전 안내](./mobile-migration.md))
- 교체 내역은 `verification/release-gate.md` 항목 8에 지문과 함께 덧붙입니다.
