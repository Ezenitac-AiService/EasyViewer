# Quickstart: 검증 절차

구현이 끝났을 때 스펙의 성공 기준(SC)을 확인하는 순서다. 실행하지 못한 단계는 `BLOCKED`로 남긴다(헌법 VI). 세부 규칙은 [contracts/](./contracts/)와 [data-model.md](./data-model.md)를 따른다.

## 준비

- macOS(Apple Silicon), Node 24, Rust stable, `cargo-deny`, `cargo-about`, `gh`(저장소 쓰기 권한)
- 저장소에 `test-build` 라벨이 있어야 한다(R6)

## 1. 자동 검사 (SC-001, SC-001a 일부, SC-005, SC-008)

```bash
npm run verify
```

기대 결과:
- 지원 범위 검사: 국문 블록, **영문 블록**, 영문 배너가 원문과 일치(SC-001).
- 이슈 양식 검사: 핵심 양식 macOS·iOS, 테스트 빌드 양식 Linux·Android + `test-build` 라벨 + 안내(SC-001a).
- Windows 재유입 검사: 허용 목록 밖 0건(SC-005).
- `cargo test`: Windows 형식 경로 거부 테스트 통과(SC-008), Linux 경로를 포함한 이전 테스트 통과(SC-004a).

```bash
npm run test:e2e
```

기대 결과: 앱 정보 화면이 새 한국어 원문을 보여 준다.

## 2. 게이트 단위 검증 (SC-002, SC-003, SC-003a–c, SC-004)

`tests/unit/releaseGate.spec.ts`의 임시 저장소 픽스처로 확인한다.

| 시나리오 | 기대 |
|---|---|
| Linux·Android 파일에 `-test` 없음 | 게시 게이트 실패 |
| `.dmg`에 `-test` 있음 | 실패 |
| Linux 결과 failure, 노트에 omitted 표식 없음 | 실패 |
| exclusions에 linux, 산출물에 Linux 파일 존재 | 실패 |
| 최근 3개 릴리스 Linux `build-failed` | 빌드 전 게이트 실패 |
| 최근 3개 릴리스 Android `no-signing-key` | 통과(횟수 제외) |
| 이전 릴리스 조회 실패 | BLOCKED(종료 코드 2) |

## 3. 릴리스 리허설 (SC-002, SC-003a, SC-004, SC-006)

메인테이너 승인 후 실행한다.

```bash
gh workflow run release.yml -f rehearsal=true -f tag_name=v1.0.0-alpha.2-rehearsal
```

기대 결과:
- macOS `.dmg`는 표식 없음, Linux 파일은 `-test`, Android는 `-test-rehearsal`.
- 노트에 "테스트용 빌드" 절(한·영).

```bash
gh workflow run release.yml -f rehearsal=true -f tag_name=v1.0.0-alpha.2-rehearsal -f fail_linux=true
```

기대 결과: macOS·Android 게시, Linux 없음, 노트에 Linux 누락 안내와 `<!-- pagelight:omitted linux=build-failed -->`(SC-003a).

확인 후 초안 릴리스를 지운다.

## 4. 기존 릴리스·보존 기록 (SC-006, FR-007)

```bash
gh release view v1.0.0-alpha.1 --json body,assets
```

기대 결과: 산출물·체크섬 그대로, 노트 끝에 Linux 테스트용 빌드 안내와 Android omitted 표식(메인테이너 승인 후 편집).

```bash
gh release view v0.1.6-beta --json body,assets
```

기대 결과: 산출물 6개, 지원 종료 고지 그대로. 고지의 Windows 전환 안내 링크가 열리고 맨 위에 보존 기록 표시가 있다.

## 5. 003 정리 (SC-007)

```bash
grep -n '^- \[ \]' specs/003-independent-fork-separation/tasks.md
```

기대 결과: 메인테이너 작업 T062 한 줄만 남는다. 003 `spec.md`의 Status가 실제 결과를 반영한다.

## 6. 보안 정책 (SC-003b)

`SECURITY.md`·`SECURITY.en.md`에 테스트용 빌드 보안 보장 범위(공통 코드 수정 반영, 테스트 빌드 전용 취약점은 플랫폼 제외)가 있는지 확인한다.
