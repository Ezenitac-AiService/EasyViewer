# Security policy

**언어 / Language**: [한국어](SECURITY.md) | **[English](SECURITY.en.md)**

The Korean [SECURITY.md](SECURITY.md) is the authoritative version.

## Supported versions

Security fixes go only into the **latest release** of this fork (Pagelight). The fork pre-releases published before the first independent release (`v1.0.0-alpha.1`), namely `v0.1.6-alpha` and `v0.1.6-beta`, do not receive security fixes.

| Version | Security fixes |
|---|---|
| Latest release | Supported |
| Earlier releases | Not supported (please update to the latest release) |

## Security scope of test builds

Linux and Android are distributed as test builds only (constitution v6.1.0). Quality and response time are not guaranteed, but for security we keep to the following.

- Security fixes in shared code (the app UI, document engines, Rust backend and other code every platform uses) go into every artifact of the same release.
- If a vulnerability that only affects a test build is not fixed yet, then until it is fixed that platform is left out of releases. The maintainer declares it in `.github/release-exclusions.json` with a private identifier and without defect details.
- If an earlier published release contains that artifact, a notice about the unfixed vulnerability is added to that release's notes.

## Reporting a vulnerability

Report vulnerabilities in this fork through GitHub private vulnerability reporting.

- [Open a private vulnerability report](https://github.com/Ezenitac-AiService/EasyViewer/security/advisories/new)

Do not put vulnerability details or reproduction steps in public issues, pull requests or discussions. If you cannot use private reporting, open a public issue that only says you would like a private security contact. A maintainer will reply with a private channel.

Please include:

- The affected version and platform (macOS, iOS, Linux, Android)
- Reproduction steps and the expected impact
- A suggested fix, if you have one

## Reporting to the original author

Vulnerabilities found in the original EasyViewer app should be reported to its author: <https://github.com/edith2580/EasyViewer>. This fork does not fix or distribute the original app.

## Disclosure

Reported vulnerabilities are disclosed after a fixed release is published. For a vulnerability that cannot be fixed, we decide on disclosure **90 days** after the report (or notification).

## Known limitations

- Personal device identifiers have been removed from the current repository files, but past records in the git history cannot be erased.
- macOS builds are not notarized by Apple yet. Always check the checksum (`SHA256SUMS.txt`) of files downloaded from the releases page.
- Running in a web browser is a development aid and is not covered by security support.
