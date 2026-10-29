# EvenCord public beta release preparation

This work adds the standalone E geometry, transparent SVG/PNG/ICO artwork, a static five-page website and a source-generated desktop plugin catalog. It preserves the three plugin origins and original authors. READMEs now explain installation, manual upgrades, compatibility, privacy and limitations.

Release changes: an independent pinned beta Ed25519 identity; `major.minor.patch-beta.N` comparison in Node and Go; explicit beta trust; prerelease discovery with signed tag/version matching; no upstream fallback. Automatic updates, host repatching, self-update and cloud remain disabled. The first archive authorization was obtained independently from an Authenticode-verified official Discord distribution. The private key is locally DPAPI-protected and ignored by Git.

Only the audited, manually dispatched Pages workflow is eligible for activation. Inherited core workflows are archived and disabled. Installer Actions stays disabled. Binary signing and publishing remain local/manual.

Validation: core compilation, TypeScript, focused modified-file lint and release/recovery tests. A disposable official-package fixture and public download verification are mandatory before publishing installer binaries. Functional UI, plugins, recording and voice evaluation are left to human testers; the installed Discord client is untouched.

See docs/RELEASE-SECURITY.md for current release policy. PHASE2.md and PHASE3.md remain historical records.
