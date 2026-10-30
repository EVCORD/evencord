# Publishing EvenCord plugins

Official plugins live in `src/evencordplugins`. Each plugin needs an `index.ts` or `index.tsx`, a unique logical name, accurate authorship and applicable license notices. Use `.desktop` for desktop-only plugins. Declare required plugin dependencies. This directory is compiled and assigned EvenCord provenance automatically; it is not a remote plugin marketplace.

Pushing a plugin to GitHub publishes its source only. Installed users receive compiled plugins together with a signed EvenCord core release. No installer rebuild is required when its release contract, loader and supported Discord archives remain compatible.

1. Add or update the plugin, preserving its logical name and settings keys where compatible. Exclude personal configuration exports, binaries and secrets. Keep new plugins disabled by default.
2. Adapt it to current Equicord APIs, check dependencies and review external executable downloads. Do not automatically execute an unpinned external addon.
3. Increment the core version and create `docs/releases/VERSION.md`. Use a strictly higher release sequence than the previous signed release.
4. Generate `dist/plugins.json` and `dist/evencord-plugins.json` using `scripts/generatePluginList.ts`, then build and run focused static and packaging checks.
5. Commit the reviewed source, build the final payload from that commit, prepare its manifest with `scripts/prepare-beta.cjs` (the historical filename also supports stable), and sign with the enrolled release key through `scripts/sign-release.cjs`. The private key stays outside Git and public artifacts.
6. Verify signatures, repository identity, source commit, archive compatibility, artifact size and SHA-256 before publishing immutable assets in a regular `core-vVERSION` GitHub release. Do not replace an existing release's payload.
7. Verify the public download through the installer/update verification path. Update the website release status, regenerate its source-derived plugin catalog and deploy Pages.

Managed stable installations check after startup and every 15 minutes, with reconnect/focus checks and retries. They notify the user and follow the existing automatic-download preference. Restart is offered only after verified staging. New plugins become available after the new core is loaded; users enable them themselves.

Old beta installations first receive the signed stable-channel transition. Very old update-disabled or private-preview builds require the current installer. Upstream Equicord synchronization remains a separate reviewed source process; a Git push or upstream commit alone never publishes an installed update.
