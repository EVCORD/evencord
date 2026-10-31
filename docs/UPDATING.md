# Updating EvenCord

Equicord is the core upstream. `scripts/sync-upstream.mjs` merges its current main branch while preserving EvenCord identity and plugin discovery. The scheduled workflow checks every six hours, advances the EvenCord patch version and validates before publishing. Conflicting source changes stop the workflow for maintainer review. It never installs Equicord binaries over EvenCord.

To release your own branding or plugin changes, increment package.json, add matching docs/releases/VERSION.md notes and push main. The same workflow validates and publishes compiled EvenCord assets. A version already published is immutable and is not overwritten.

The normal desktop updater follows EvenCord GitHub releases on Windows, macOS and Linux. Downloads must match their exact repository URL, published size and GitHub SHA-256 digest. Settings and themes stay in the EvenCord profile. Startup and Discord host updates use the inherited Equicord loader and hooks.

Release automation signs compatibility metadata using the enrolled key stored as an encrypted repository Actions secret. It runs only on main and scheduled upstream integration, never pull requests. The protected local DPAPI key remains available for recovery. Every release retains compatibility metadata for legacy Windows clients.

Version 1.1.0 is also signed using the existing protocol so managed Windows clients can receive the transition through their existing updater. On successful native startup it copies the signed payload to the stable profile path and switches the owned loader to that path, keeping the original Discord archive and settings. Old clients with automatic downloads disabled must choose Check for Updates. Clients that cannot load EvenCord need the current installer repair path.

The legacy Windows archive allowlist and startup rejection mechanism apply only before transition. New platform support is built through the Equilotl installer matrix. Claims of native runtime verification must state the platforms actually tested.
