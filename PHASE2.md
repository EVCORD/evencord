# Phase 2 implementation record

Implemented 2026-10-29. This is a source-only development foundation, not a public release or an installation guide.

## Identity and repository relationships

EvenCord is an independent GPL client modification based on Equicord and Vencord. The core repository is https://github.com/alrimii/evencord; the installer repository is https://github.com/alrimii/evencord-installer. Both existing forks were renamed, preserving repository IDs, upstream relationships and history. Local checkout paths remain DiscordModFoundation/core and DiscordModFoundation/installer. Core upstream remains Equicord/Equicord; installer upstream remains Equicord/Equilotl.

branding/project.json is the shared contract, consumed by src/shared/project.ts, scripts/project.mjs and the installer's embedded branding package. Component versions are separate. Repository IDs, release names and future stable Windows x64/Discord Stable routing are explicit. Installer branding/contract-source.json records the reviewed core source revision and contract digest. No runtime remote configuration is fetched.

Original editable E-symbol artwork, monochrome/settings variants, PNG sizes 16 through 1024, a multi-resolution ICO, SVG banner and social preview are in branding/assets. The core contains the Pillow generator. No font binaries are redistributed. No domain, support server or donation service was invented.

## Storage isolation

Native data directory precedence:

1. A nonempty EVENCORD_USER_DATA_DIR explicitly selects the root.
2. DISCORD_USER_DATA_DIR selects its sibling EvenCordData directory (portable convention).
3. Otherwise the normal Discord userData sibling is EvenCord: %APPDATA%/EvenCord on Windows.

Core development builds use a dev subdirectory unless an explicit EvenCord root was supplied. Settings, native settings, themes, QuickCSS and native caches derive from this root. No Equicord/Vencord settings migration runs. EVENCORD_DIRECTORY is the future installer payload override; the default payload is evencord.asar. EVENCORD_DEV_INSTALL and EVENCORD_HASH replace inherited product environment overrides.

Renderer databases use evencord:stable:, evencord:dev: or evencord:reporter: prefixes. DataStore applies the prefix to physical database names while preserving logical store names and plugin settings keys. MessageLoggerEnhanced's direct database and deletion path share the new prefix. Cloud sync keys and CursorBuddy position use product namespaces. The retained unsupported browser stub also namespaces its local settings. Discord-owned storage is not renamed; the Equibop-only host state reader remains untouched and is excluded from the desktop build.

Separate mod storage does not permit two mods to own the same Discord loader simultaneously. Safe loader ownership and switching remain Phase 3 work. No existing settings are imported automatically. Local backup/export remains available; cloud sync is disabled in UI and backend.

## Distribution boundary

All contract capabilities are false. Backend guards cover core HTTP/git updating, installer launching/downloading, host-update repatching, installer patch/unpatch/repair, OpenAsar changes, payload writes and self-update/relaunch/cleanup. GUI shows a non-operational preview before Discord discovery; CLI metadata is available but mutation commands stop before discovery. The installer computes paths without creating its data directory while disabled.

Future URLs point to the two EvenCord repositories. Upstream distribution fallbacks were removed. Legacy shell/PowerShell bootstrap installers refuse execution. GitHub Actions remains disabled at repository level, with Phase 1 job guards retained unchanged. Inherited publishing recipes are dormant upstream infrastructure, not approved EvenCord CI; they must be replaced/reviewed before enabling Actions. No release credentials, binaries, tags or downloads are published.

## Compatibility and attribution

VencordNative, DiscordNative, IPC names, webpack aliases, plugin identifiers, source directories, logical settings keys and Go module equilotl remain compatible. Plugin authorship, license files, source notices and Git ancestry are preserved. Upstream plugin provenance and optional third-party service links are intentionally retained. Product-facing settings/About/tray/editor text, icons, metadata, support destinations and installer UI use EvenCord. No custom Reclip or customized Quoter was imported.

Use reviewed upstream merge proposals from Equicord only for core; use Equilotl for installer. Do not synchronize Vencord directly. Keep history and resolve conflicts explicitly; review new branding, storage keys, download URLs, capability gates and workflows after every merge. No automated synchronization was enabled.

## Validation and limits

Core: frozen-lockfile dependency installation with scripts disabled; TypeScript noEmit; ESLint on changed source; Stylelint on changed CSS; shared identity/assets consistency check; desktop esbuild/ASAR build. Installer: Windows x64 CLI and GUI compilation, gofmt and CLI go vet. Resource generation embeds original icons and separate CLI/GUI product metadata. Windows PE resources were inspected without executing installer binaries.

Tooling: Node 22.18.0, pnpm 10.34.9 (project manager auto-download disabled; inherited packageManager declaration remains), Go 1.26.2, pinned go-winres, SHA-256-verified llvm-mingw 20260908. Portable Go/compiler tools and caches were kept inside the installer checkout and ignored by Git. GUI dependency compilation emits inherited imgui C++ warnings; dependencies were not rewritten to suppress them.

No Discord runtime testing, installer execution, injection, repair, updater execution, Discord restart or public distribution occurred. Build/static checks do not establish runtime compatibility. Existing Equicord development sources and installed Discord were not modified.

## Phase 3 requirements

- Implement explicit loader ownership, foreign-mod refusal, safe switching and matching loader formats. An _app.asar backup is not proof of EvenCord ownership.
- Replace release-title/hash inference with reviewed release identity, repository/asset allowlists and verified metadata.
- Implement integrity/authenticity verification, staged replacement, failure recovery and rollback for payload and self-updates. Existing inherited direct-write paths remain disabled.
- Review installer repair/error handling and Windows x64/Stable eligibility before enabling any operation.
- Design and approve CI, release permissions, signing and controlled publication; keep repository Actions disabled until separately authorized.
- Perform isolated installation/uninstallation/recovery and Discord runtime validation under separate approval.
- Complete name/trademark clearance and corresponding-source/license packaging before public distribution.

Enabling capability booleans alone is not Phase 3 completion. EvenCord is not ready for public distribution.
