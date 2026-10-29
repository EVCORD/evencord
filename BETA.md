# EvenCord public beta release preparation

This work adds the standalone E geometry, transparent SVG/PNG/ICO artwork, a static five-page website and a source-generated desktop plugin catalog. It preserves the three plugin origins and original authors. READMEs now explain installation, manual upgrades, compatibility, privacy and limitations.

Release changes: an independent pinned beta Ed25519 identity; `major.minor.patch-beta.N` comparison in Node and Go; explicit beta trust; prerelease discovery with signed tag/version matching; no upstream fallback. Automatic updates, host repatching, self-update and cloud remain disabled. The first archive authorization was obtained independently from an Authenticode-verified official Discord distribution. The private key is locally DPAPI-protected and ignored by Git.

Only the audited, manually dispatched Pages workflow is eligible for activation. Inherited core workflows are archived and disabled. Installer Actions stays disabled. Binary signing and publishing remain local/manual.

Validation: core compilation, TypeScript, focused modified-file lint and release/recovery tests. A disposable official-package fixture and public download verification are mandatory before publishing installer binaries. Functional UI, plugins, recording and voice evaluation are left to human testers; the installed Discord client is untouched.

See docs/RELEASE-SECURITY.md for current release policy. PHASE2.md and PHASE3.md remain historical records.

## Published beta and validation

Published as GitHub prereleases on 2026-10-29:
- Core 0.1.0-beta.2 from `64594901db0a18d67d4ca4e19d3e513e1148b2e3`.
- Installer 0.1.0-beta.1 from `3a6d4226ac3aaee3d0a465969275afba7e3c0701`.
- Core beta.1 remains immutable, superseded by beta.2's manual-updater wording correction.
- Live site: https://alrimii.github.io/evencord/ with 363 source-derived desktop plugin entries.

Core and Windows CLI/GUI builds succeeded. TypeScript and targeted modified-file lint passed. Eight focused Node protocol/recovery tests and Go release/install tests passed. A disposable copy extracted from the Authenticode-verified official Discord package passed install, ownership, repair, uninstall and settings-preservation checks. The original archive digest was preserved.

The public core beta.2, GUI and CLI downloads passed the installer's real release discovery/download path, including pinned Ed25519 verification, identity, channel, size and SHA-256. Windows product metadata and transparent icons are embedded. Dependency inspection found system Windows/UCRT/OpenGL DLL imports. Artifacts passed private-key and personal-path scans. Windows Authenticode signing is not present.

The installed Discord client was untouched. No real-client startup, recording, voice or plugin runtime test was performed for this release. Human functional testing remains necessary. Automatic updates, host repatching and installer self-update are disabled. Future compatibility entries, trust/loader migrations, signing-key recovery arrangements and Authenticode signing remain maintenance work.
