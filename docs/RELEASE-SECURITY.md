# Release security and beta operations

The public beta uses channel `beta` and independent component versions such as `0.1.0-beta.1`. Discord's supported host channel is still Stable. GitHub tags are `core-vVERSION` and `installer-vVERSION`. A prerelease is discovered from the approved repository's release list; `/releases/latest` is not used because GitHub excludes prereleases there.

## Trust

`branding/trust.json` pins the raw Ed25519 public verification key `evencord-beta-2026-01` in both components. This key is separate from the private preview identity. The private beta key is stored locally under current-user Windows DPAPI with an owner-only ACL, outside Git. It is not in GitHub Secrets or any release artifact. Loss of that Windows identity or protected key requires an explicit trust migration, not an insecure fallback. Keep an independently protected recovery copy before relying on long-term release continuity.

The exact manifest bytes are signed with domain separator `EvenCord release v1\n`. The envelope contains only `keyId`, base64 `signed`, and base64 `signature`. The manifest binds product, component, repository slug and numeric ID, beta channel, version, monotonic sequence, source and upstream commits, Windows x64, Discord Stable, loader protocol, validity period, notes, approved original archive hashes, artifact filename, byte length and SHA-256. The Node and Go verifiers enforce this contract. Hashes beside a download alone are not an authenticity guarantee.

Windows Authenticode is separate. EvenCord beta executables are **not Authenticode signed** and can trigger SmartScreen or unknown-publisher warnings. Ed25519 does not suppress those warnings. Users should verify the source and release identity; never disable Windows protections globally.

## Compatibility and recovery

See [discord-compatibility.json](../branding/discord-compatibility.json) for the independently downloaded, Authenticode-verified Discord package used to approve the initial archive. Only that exact original archive is accepted. This is not universal permission for all Discord versions or a machine-specific bypass. Official Discord binaries are not redistributed with EvenCord.

The installer refuses foreign or unknown loaders. It stages a verified payload, preserves the original `_app.asar`, writes an EvenCord ownership record and transaction journal, and uses a directory loader at `app.asar`. Uninstall restores the verified original; recovery retains user settings. Private preview trust is not automatically migrated. Do not delete recovery data manually.

From beta.3, managed core installations automatically check the signed beta channel after startup and every 30 minutes. Background download is controlled by the existing autoUpdate preference; it can be enabled in EvenCord > Updater. The native updater authenticates the running manifest, exact payload hash, compiled source commit and unchanged protocol-1 loader ownership before accepting updates. It stages only compatible verified artifacts, retains the prior payload and displays the restart action only after validating the selected pointer. Settings, plugins and themes stay in the same data root. Installer self-update, cloud sync and automatic Discord repatching remain disabled. Beta.1 and beta.2 require a one-time manual upgrade using the verified beta.3 installer. A Discord update can require a new compatibility review. Unavailable or expired metadata is a blocking error, never an instruction to download upstream binaries. Signed metadata expires after at most 90 days; maintainers must publish a new immutable version before expiry. Existing installed payloads verify their authenticity without requiring a live freshness check at each startup.

The core-only `branding/managed-updater.cjs` adds progress and coordination without modifying the protocol-1 loader runtime. This preserves ownership compatibility with earlier public beta installers. A failed startup is never offered again as a ready update; a newer approved release or reviewed installer recovery is required. Boot recovery detects failure to complete native startup, not every possible rendering or plugin error.

## Publishing procedure

1. Review source, identity, trust, compatibility and dependency changes. Keep the original source repositories and installed client untouched.
2. Run focused protocol/recovery tests, TypeScript and lint checks. Generate the desktop plugin catalog and site. Commit the source before building the final binaries; record full source and upstream commit IDs.
3. Build core and both Windows installer targets with the embedded public trust store and no local-preview environment overrides. Scan distributable files for private keys and personal paths.
4. Create manifests with independent component versions, source IDs, exact sizes and digests. Sign via `scripts/sign-release.cjs` with a private PEM on standard input, decrypted only in memory. Never pass it as a command-line argument or log it. Verify each envelope with the compiled trust key and each artifact with SHA-256.
5. Run the real signed payload against an isolated copy extracted from the authenticated Discord package. Verify install, ownership, repair and restoration. Never run this against the maintainer's Discord installation.
6. Upload reviewed immutable assets to GitHub prereleases, core first. Validate the public core download using the installer's `release.Latest` and `release.Download` path. Then publish the matching installer prerelease and verify both installer downloads. Never silently replace a published binary; increase the version.
7. Only then update `branding/beta-status.json`, regenerate the site and announce Public Beta. Publish checksums, license notices and exact source information with each component.

Only the manual, audited Pages workflow is activated in the core repository. Other workflow sources are archived; installer Actions remains disabled. No signing credentials are accessible to pull requests. The site is static and does not execute plugin code. Its catalog is generated from source metadata, filtered to the Windows desktop target.
