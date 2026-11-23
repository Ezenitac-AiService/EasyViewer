# 기여 가이드

**언어 / Language**: **[한국어](CONTRIBUTING.md)** | [English](CONTRIBUTING.en.md)

이 저장소는 [edith2580의 EasyViewer](https://github.com/edith2580/EasyViewer)에서 갈라진 **독립 포크**입니다. 기여하기 전에 아래 원칙을 확인해 주세요.

## 지원 범위

<!-- support-scope:start -->
이 포크는 **macOS**를 중점 지원합니다.
iOS·Linux·Android는 우선순위를 낮춘 유지 플랫폼입니다. iOS는 공개 배포 채널 없이 소스 빌드로만 제공합니다.
**Windows는 이 포크의 지원·배포 대상이 아닙니다. Windows에서는 원저작자의 [EasyViewer](https://github.com/edith2580/EasyViewer)를 사용하세요.**
웹 브라우저 실행은 개발 보조용입니다.
Linux는 Ubuntu 22.04 이상 또는 동급 배포판(deb·AppImage, WebKitGTK 4.1, X11·Wayland)에서 검증합니다. 그 밖의 배포판은 동작할 수 있으나 검증하지 않습니다.
<!-- support-scope:end -->

지원 범위 문구의 원문은 `src/config/supportScope.ts`입니다. 문구를 바꿀 때는 원문을 고친 뒤 위 블록이 있는 문서를 함께 갱신하고 `node scripts/check-support-scope.mjs`로 확인합니다.

## Windows 관련 이슈 처리 방침

- 이 포크가 게시했던 Windows 프리릴리스(`v0.1.6-alpha`·`v0.1.6-beta`)에 관한 이슈는 **이 저장소에서** 받습니다. 지원이 종료되었으므로 [Windows 전환 안내](docs/windows-migration.md)로 안내하고 이슈를 닫습니다.
- 이 포크의 Windows 빌드 문제를 원저작자 저장소에 올리지 마세요. 원저작자 앱과는 데이터 형식이 다른 별개의 빌드입니다.
- Windows는 고려 대상이 아닙니다. CI에서 Windows 코드를 컴파일·테스트하지 않으며, Windows에서만 쓰는 코드를 새로 추가하는 변경은 받지 않습니다.

## 업스트림과의 관계

- 이 포크는 업스트림(`edith2580/EasyViewer`)을 **병합·체리픽·동기화하지 않습니다.** GitHub의 "Sync fork" 버튼도 쓰지 마세요.
- 업스트림의 아이디어가 필요하면 별도 명세(`/speckit-specify`)로 이 포크에서 다시 구현합니다.
- **유일한 예외**는 보안 조율입니다. 이 포크가 찾은 결함이 원저작자 최신 릴리스에도 남아 있으면, 공개하기 전에 원저작자에게 비공개로 알리거나 수정을 제안합니다. 이것은 동기화가 아니라 기여입니다.
- 공유 브랜치의 이력 재작성(강제 푸시 등)과 저작권·출처 고지 삭제는 금지합니다. 원저작자에게서 온 코드를 일반적인 리팩터링으로 고치거나 지우는 것은 괜찮습니다.

### 실수로 업스트림이 섞였을 때

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

이 포크는 [프로젝트 헌법](.specify/memory/constitution.md)(v4.3.0)을 따릅니다. 특히 제8원칙(독립 포크 운영)에 따라 다음을 지킵니다.

- 공개 문구는 이 포크의 범위만 말합니다. 원저작자 프로젝트의 역할·의도를 대신 규정하거나 원저작자 앱을 낮추어 평가하지 않습니다. `node scripts/check-support-scope.mjs`가 금지 표현을 검사합니다.
- 라이선스는 `GPL-3.0-only`입니다. 라이선스 전문(`LICENSE`)을 바꾸지 않고, 원저작자 귀속과 변경 고지(`NOTICE`)를 유지합니다.
- 이 포크에서 새로 만드는 소스 파일 첫 줄에는 `SPDX-License-Identifier: GPL-3.0-only`를 씁니다.
- 저장소 루트의 공개 문서(`README`, `CONTRIBUTING`, `SECURITY`, `CHANGELOG`, `NOTICE`, `THIRD_PARTY_LICENSES`)는 한국어 기본 문서와 영문판(`*.en.md`)을 함께 유지합니다(제1원칙). 한쪽을 고치면 같은 변경에서 다른 쪽도 고칩니다. 두 판이 어긋나면 한국어 문서가 기준입니다. `node scripts/check-doc-pairs.mjs`가 쌍과 언어 전환 링크를 검사합니다.

## 지원 등급별 기여 기대치

| 등급 | 플랫폼 | 기대치 |
|---|---|---|
| 중점 | macOS | 유일한 핵심 빌드입니다. 변경마다 macOS 동작을 확인하고, `macos-build`를 포함한 핵심 CI가 통과해야 합니다 |
| 유지(후순위) | iOS, Linux, Android | 빌드와 기존 동작을 깨지 않도록 노력합니다. CI 결과는 보고만 하며 병합을 막지 않지만, 실패는 확인해 고칩니다 |
| 비지원 | Windows | 고려 대상이 아닙니다. Windows에서만 쓰는 기능이나 코드는 받지 않습니다 |
| 개발 보조 | 웹 | 개발·테스트용 폴백으로만 유지합니다 |

## 명세 절차

기능 추가와 큰 변경은 Spec Kit 흐름을 따릅니다: `/speckit-specify` → `/speckit-clarify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-analyze` → `/speckit-implement`. 산출물은 `specs/<번호>-<이름>/`에 둡니다. 명세(`spec.md`)에는 구현 세부를 쓰지 않습니다.

## 품질 게이트

변경을 올리기 전에 다음을 통과해야 합니다.

```bash
npm run verify
```

```bash
cd src-tauri && cargo deny check
```

`npm run verify`는 빌드, 단위 테스트, 계층·규모 경계(파일당 450줄 이하), 버전·식별자 동기화, 라이선스 정책 감사, 지원 범위 문구 검사, 공개 문서 국문·영문 쌍 검사, `cargo check`, `cargo test`를 실행합니다. 테스트 없이 구현한 코드는 받지 않습니다(헌법 제2원칙, TDD).

### 라이선스 감사가 실패할 때

의존성을 추가하거나 갱신해 감사가 실패하면 다음 순서로 처리합니다. 감사를 우회하거나 끄지 않습니다.

1. 새 라이선스가 GPLv3와 호환되는지 근거(공식 라이선스 목록, FSF 호환성 표 등)를 확인합니다.
2. 호환되면 근거를 주석으로 남기고 `scripts/license-policy.json`과 `src-tauri/deny.toml`(Rust는 `src-tauri/about.toml`도)의 허용 목록에 추가합니다.
3. 호환되지 않으면 그 의존성을 다른 것으로 바꿉니다.
4. 고지 전문을 다시 생성합니다.
   ```bash
   node scripts/check-licenses.mjs --write
   ```

## 커밋 규칙

커밋 메시지는 **한국어**로 쓰고 Conventional Commits 접두사(`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `ci:`, `chore:` 등)와 요약 제목을 붙입니다. 본문에는 ① 변경 이유, ② 핵심 수정 내용, ③ 영향 범위와 검증 결과를 적습니다. `npm run check:commit-msg`로 확인할 수 있습니다.
