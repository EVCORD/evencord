# Phase 3: signed releases and recoverable installation

Implemented 2026-10-29. This supersedes the Phase 2 implementation status, while preserving its branding, attribution and storage decisions. The production release channel is NOT active. This is engineering infrastructure validated with synthetic fixtures, not a public distribution announcement.

## Implemented components

Core:
- branding/runtime.cjs: Ed25519 verification, bounded HTTPS retrieval, digest checking, immutable payload staging, atomic activation, release sequence protection and startup recovery.
- branding/loader.cjs and branding/host.cjs: the shared directory loader and conservative host-update persistence.
- src/main/updater/secure.ts: independent signed-release updater. Legacy HTTP and Git updater modules route here; no client-side git pull or direct ASAR truncation remains.
- src/main/applyHostPatch.ts and src/main/patcher.ts: shared ownership checks, signed host eligibility and startup confirmation.
- src/utils/updater.ts and updater UI: release-based changelogs, accurate failure propagation and no misleading success before activation.
- tests/release.test.cjs and tests/protocol-vector.json: synthetic activation, signature, rollback, host persistence and interoperability checks.

Installer:
- internal/release: strict release identities, Ed25519 verification, bounded downloads and side-by-side installer handoff.
- internal/install: Windows Stable/x64 eligibility, ownership validation, install/uninstall transactions, repair, quarantine and recovery.
- patcher.go, github_downloader.go, self_updater.go: production adapters using these engines.
- find_discord_windows.go: Stable discovery, verified ownership status and no process termination.
- cli.go: repair errors propagate correctly; recovery command and accurate self-update staging messages.
- secure_gui.go: explicit discovery, release availability, downloading, verifying, installing, completed, failed, foreign-mod and recovery states. No installer GUI was launched during development.
- branding/runtime.go: embedded copies of the shared runtime, loader and trust configuration.
- Internal Go tests cover synthetic Discord layouts only.

Both repositories contain candidate/signing/verification tools and new reviewed CI workflow source. Existing upstream publishing jobs remain guarded and repository Actions remains disabled.

## Release protocol v1

A release envelope has exactly keyId, signed and signature fields. signed is base64 of the exact UTF-8 JSON manifest bytes. signature is base64 Ed25519 over the ASCII domain separator "EvenCord release v1" followed by a newline and those bytes. Public keys are raw 32-byte Ed25519 keys encoded as base64 in branding/trust.json. Private keys are never part of a build, test fixture or repository.

The signed manifest contains:
- schemaVersion=1, product=evencord, component (core, installer-cli or installer-gui).
- Repository slug AND numeric repository ID, channel=stable.
- Independent component version (strict major.minor.patch), monotonically increasing sequence, exact sourceCommit and upstreamCommit SHAs.
- platform=win32, architecture=x64, discordChannel=stable and loaderProtocol=1.
- publishedAt, expiresAt (maximum 90-day validity), signed release notes.
- artifact name, exact byte size (maximum 256 MiB) and lowercase SHA-256.
- discordArchives: reviewed SHA-256 values for original Discord bootstrap archives.

The manifest, including its artifact digest, is authenticated by an independently enrolled public key. A checksum hosted beside an artifact is not itself a trust anchor. Production keys are currently empty. Test keys are generated only in memory; the committed interoperability vector contains only a public key and signature and is never loaded as production trust.

Metadata is retrieved from the exact project's latest approved release: core.release.json, installer-cli.release.json or installer-gui.release.json. Artifact URLs are constructed locally from fixed repository identities and names, using core-vVERSION or installer-vVERSION tags. Arbitrary artifact URLs from metadata are not accepted. HTTPS redirects are restricted to GitHub/API and the exact GitHub release asset hosts. Redirect count, request duration and byte counts are bounded.

Malformed, expired, wrong-project, wrong-platform, untrusted/revoked-key and bad-signature releases fail closed. Already installed signed releases may start offline after metadata expiry; expiry prevents new downloads/activation, not normal startup. Versions and sequences reject downgrade/reuse. accepted.json retains the highest accepted signed release even after local fallback. Deleting local security state or compromising the OS/account is outside this trust model.

## Loader and ownership contract

The only supported installed shim is a DIRECTORY named resources/app.asar. It contains package.json (name=discord, main=index.js), index.js, runtime.cjs, trust.json and evencord-owner.json. Files are normalized to LF. The original archive is resources/_app.asar. resources/evencord-install.json records product/schema, absolute data root, original archive SHA-256 and expected loader/runtime/trust hashes.

Ownership requires exact known loader contents, the matching record and the original archive digest. An _app.asar file or a text match for a mod's name never grants ownership. Name scanning is diagnostic only. Foreign Equicord/Vencord/OpenAsar/unknown modifications are refused. A changed loader or missing/changed original archive requires manual review; automatic repair does not guess ownership or delete foreign recovery files.

Fresh installation additionally requires the original archive digest to appear in authenticated release metadata. No real Discord archive hashes were collected during this session. A production release therefore needs reviewed host compatibility data. Host updates with unfamiliar archives stop safely; they are never patched optimistically.

Data remains in EvenCord's isolated root. Payloads are immutable files under releases/SHA256-desktop.asar; current.json points to a signed manifest. The former single mutable evencord.asar path is replaced by this storage scheme. The distributed core asset remains desktop.asar. Plugin/settings keys and Discord/native APIs are unchanged.

## Transactions and recovery

A new loader is staged before the original archive is renamed. A durable .evencord-transaction.json records the operation and ownership before switching files. Install/uninstall interruption can be recovered by the installer without guessing paths or deleting another mod's backup. Uninstallation restores only the verified original and retains settings and payload history.

Windows installation locks use exclusive file handles with delete-on-close. They release on process exit and can safely take over an abandoned Node lock when no process still holds it. Node updater/persistence locks fail closed if left behind; the installer recovery path provides reviewed recovery rather than blindly deleting an active lock. Unknown/tampered recovery state is preserved and reported.

Downloaded bytes are written to unique staging files, size/hash verified and flushed before use. Updates never truncate the active ASAR. A previously verified pointer is retained as previous.json. Damaged payload repair quarantines the damaged file. Core booting.json records startup attempts; reaching Electron app readiness confirms startup. On the next launch after an unconfirmed attempt, the loader tries the previous verified payload; if neither is usable, it verifies and loads original Discord. failed.json prevents immediately retrying the same failing release.

This health signal covers main-process startup, not complete renderer/plugin correctness. A force-close during startup may conservatively trigger fallback. Physical power-loss durability and live Discord behavior have not been established by fixture tests.

Installer self-update uses verified side-by-side staging and optional launch handoff. The original executable is retained, including when download, verification, permissions or launch fails. There is no destructive in-place replacement of a running Windows executable. CLI/GUI report staging separately from completion; a human can launch the verified candidate. No installer executable or handoff was executed here.

## CI and release preparation

evencord-ci.yml:
- Read-only repository token, no release/signing credentials.
- Windows source checks, fixtures, desktop/CLI/GUI builds and unsigned candidate identity/digest generation.
- Candidate artifact upload only on explicit workflow dispatch, not PR execution.

evencord-upstream-review.yml:
- Manual read-only upstream fetch and conflict/file/plugin change report.
- No branch push, merge, PR creation or automatic publication.

evencord-publish.yml:
- Manual dispatch on this repository's main branch only.
- Requires EVENCORD_RELEASE_ENABLED=true plus a protected evencord-production environment.
- Accepts only an EXISTING unpublished signed draft with exact expected assets.
- Verifies signatures, digests, source/tag/main commit, version and upstream ancestry before publishing.
- No signing private key is available to PR jobs or this publisher; signing is an offline/separately controlled step.
- Does not create tags or unsigned releases. No workflow was run or enabled.

Before enabling this pipeline, configure required environment reviewers and branch protections, enroll verified public signing keys out of band, perform an independent security review, and approve release activation. No secrets, environments, signing credentials or activation variables were configured during this phase.

scripts/sign-release.cjs accepts an Ed25519 private PEM on stdin, verifies it against the enrolled public key and writes only a signed envelope. Do not put private keys in command arguments, source files, logs or repository artifacts. scripts/release-tools.cjs creates explicitly unsigned development candidate receipts or verifies approved signed release directories. Core and installer version sources must be changed from development prerelease values before stable publication.

## Validation performed

- Seven Node fixture groups, including the shared Go/Node signature vector.
- Go installer/release fixture groups covering fresh/owned installation, Equicord/Vencord/OpenAsar/unknown refusal, damaged loader, missing original, unsupported channel, interrupted download/install/uninstall/update, invalid signatures/digests/repositories, failed repair, settings preservation, payload recovery, locking and failed self-update.
- TypeScript noEmit, changed-source ESLint, Go formatting and Go vet.
- Core desktop build and Windows x64 installer CLI/GUI builds.
- Shared protocol/branding consistency and disabled-capability checks.
- Windows resource generation; no installer execution.
- No actual Discord installation, process termination, injection, update or repair was attempted.

Tests create disposable fixtures inside the development workspace. The original Equicord repository, existing Discord profile, Reclip and customized Quoter remain outside this work.

## Remaining activation requirements and limitations

1. Production signing keys, custody/rotation/revocation policy and independently verified public-key enrollment.
2. Real reviewed Discord Stable bootstrap hashes and isolated VM/manual validation of discovery, loader startup, locked-file behavior, permissions, persistence and GUI rendering.
3. Stable component versions, approved source builds, signed manifests, Windows code signing and corresponding-source/license packaging.
4. Protected release environment, CI review/activation and explicit authorization for the first distribution.
5. Loader protocol v1 recognizes the exact reviewed loader/runtime/trust bundle. A future change to that bundle or key rotation needs an explicit reviewed loader migration; unknown older loaders are refused rather than overwritten.
6. Multi-process startup, hard power-loss behavior, full renderer health and real GitHub release transport have not been runtime-tested.
7. The legacy developer injection scripts and OpenAsar mutation routes remain deliberately unavailable.

All production capability flags remain false, including host repatching. Public release readiness is NOT claimed. The next validation step is a disposable Windows VM or isolated Discord test installation with fixture/preview signing, followed by review of production trust and activation.

## Implementation references

- Node crypto verification: https://nodejs.org/api/crypto.html#cryptoverifyalgorithm-data-key-signature-callback
- Go Ed25519 verification: https://pkg.go.dev/crypto/ed25519
- Windows replacement semantics: https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-movefileexw
