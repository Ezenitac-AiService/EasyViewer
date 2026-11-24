# Contributing guide

**언어 / Language**: [한국어](CONTRIBUTING.md) | **[English](CONTRIBUTING.en.md)**

This repository is an **independent fork** of the original [EasyViewer](https://github.com/edith2580/EasyViewer) by edith2580. Please read the principles below before contributing. The Korean [CONTRIBUTING.md](CONTRIBUTING.md) is the authoritative version.

## Support scope

<!-- support-scope-en:start -->
This fork focuses on **macOS**.
iOS is maintained with lower priority and is provided as a source build only, without a public distribution channel.
Linux and Android are distributed as **test builds** only, with no guarantee of quality, feature parity, real-device verification or response time.
**Windows is outside the scope of this fork. On Windows, use the original [EasyViewer](https://github.com/edith2580/EasyViewer).**
Running in a web browser is a development aid only.
Linux test builds are built for Ubuntu 22.04 or later and equivalent distributions (deb, AppImage, WebKitGTK 4.1, X11 and Wayland). Android test builds target Android 7.0 (API 24) or later.
<!-- support-scope-en:end -->

The source of the support-scope wording is `src/config/supportScope.ts`. To change it, edit the source, update every document that contains the support-scope block (Korean) or the support-scope-en block (English), and run `node scripts/check-support-scope.mjs`.

## Windows issues

- Windows is outside the scope of this fork, so changes that add Windows-only code, settings or files are not accepted (`node scripts/check-windows-exclusion.mjs` checks this).
- Questions about the Windows pre-releases this fork published (`v0.1.6-alpha`, `v0.1.6-beta`) are pointed to the preserved [Windows migration guide](docs/windows-migration.md) (Korean) and closed. Do not file them in the original author's repository.

## Relationship with the upstream

- This fork does **not merge, cherry-pick or sync** the upstream (`edith2580/EasyViewer`). The repository is no longer part of the upstream fork network.
- If an upstream idea is needed, re-implement it here through a separate spec (`/speckit-specify`).
- **The only exception** is security coordination. If a defect found here also affects the original author's latest release, we tell the original author privately or propose a fix before disclosure. That is a contribution, not a sync.
- Rewriting shared history (force pushes) and removing copyright or attribution notices are forbidden. Refactoring or removing code that came from the original author in the normal course of work is fine.

### If upstream changes slipped in

1. Check whether an upstream remote is still configured.
   ```bash
   git remote -v
   ```
2. Remove it if it is.
   ```bash
   git remote remove upstream
   ```
3. If a commit merging upstream changes was already pushed, do not force-push; create a revert commit.
   ```bash
   git revert -m 1 <merge commit>
   ```
4. Make sure no workflow or script contains a sync path.
   ```bash
   node scripts/check-release-gate.mjs --static
   ```

## Operating principles

This fork follows the [project constitution](.specify/memory/constitution.md) (v4.3.0, Korean). In particular, under principle VIII (independent fork governance):

- Public wording describes only this fork's scope. It does not define the original project's role or intent and does not belittle the original app. `node scripts/check-support-scope.mjs` checks for forbidden phrases.
- The license is `GPL-3.0-only`. The license text (`LICENSE`) is not changed, and the attribution and modification notices (`NOTICE`) are kept.
- New source files created in this fork start with `SPDX-License-Identifier: GPL-3.0-only`.
- The public root documents (`README`, `CONTRIBUTING`, `SECURITY`, `CHANGELOG`, `NOTICE`, `THIRD_PARTY_LICENSES`) keep a Korean default and an English counterpart (`*.en.md`) (principle I). A change to one side updates the other side in the same change. If the two disagree, the Korean document wins. `node scripts/check-doc-pairs.mjs` checks the pairs and the language links.

## Expectations by support tier

| Tier | Platforms | Expectation |
|---|---|---|
| Focus | macOS | The only core build. Check macOS behavior for every change; the core CI including `macos-build` must pass |
| Maintained (lower priority) | iOS | Source build only. Try not to break the build or existing behavior. CI results only report and do not block merges, but failures are looked into and fixed |
| Test build | Linux, Android | Distributed as test builds only, with no guarantee of quality, feature parity, real-device verification or response time. Keep the build working; CI results only report. Bug reports go to the test build bug form |
| Excluded | Windows | Outside the scope of this fork. Windows-only code, settings and features are not accepted |
| Development aid | Web | Kept only as a fallback for development and testing |

## Spec process

New features and large changes follow the Spec Kit flow: `/speckit-specify` → `/speckit-clarify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-analyze` → `/speckit-implement`. Artifacts live in `specs/<number>-<name>/` (Korean). The spec (`spec.md`) does not contain implementation details.

## Quality gates

Before submitting a change, these must pass:

```bash
npm run verify
```

```bash
cd src-tauri && cargo deny check
```

`npm run verify` runs the build, unit tests, layer and size boundaries (450 lines or fewer per file), version and identifier sync, the license policy audit, the support-scope wording check, the Korean/English document pair check, `cargo check` and `cargo test`. Code without tests is not accepted (constitution principle II, TDD).

### When the license audit fails

If adding or updating a dependency breaks the audit, handle it in this order. Do not bypass or disable the audit.

1. Confirm with evidence (official license lists, the FSF compatibility list, etc.) whether the new license is compatible with GPLv3.
2. If it is, leave the evidence in a comment and add it to the allow lists in `scripts/license-policy.json` and `src-tauri/deny.toml` (and `src-tauri/about.toml` for Rust).
3. If it is not, replace the dependency.
4. Regenerate the full notices.
   ```bash
   node scripts/check-licenses.mjs --write
   ```

## Commit rules

Commit messages are written **in Korean** with a Conventional Commits prefix (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `ci:`, `chore:`, etc.) and a summary title. The body states ① why, ② what changed, and ③ scope and verification results. `npm run check:commit-msg` checks the format. If you cannot write Korean, open the pull request anyway; a maintainer will help with the message.
