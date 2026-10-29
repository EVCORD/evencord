# EvenCord plugin ecosystem and identity update

The official palette is #191A1E / #34353B / #805263 / #F0EDEB. The geometric E was recentered, small icons use a light silhouette on the accent tile, and editable SVG, PNG, ICO and social artwork were regenerated. Branding is scoped to EvenCord surfaces; Discord's global theme is not replaced.

## Plugins

`src/evencordplugins` is tracked and discovered by renderer/native builds and plugin metadata generation. `scripts/pluginSources.mjs` contains the single override map. A missing override fails the build, and duplicate plugin names are rejected. Existing plugin roots and authors are retained.

- Reclip is copied from the maintainer's latest local source into `reclip.desktop`. Its name, settings, replay icon, manual recording default, Windows restriction, microphone controls, duration presets, up-to-60 FPS settings and WebM/MP4/MKV handling remain. FFmpeg is optional and not downloaded; failed conversion retains WebM. Speaker recording uses Windows loopback and may include other apps. No recordings are imported. Individual Discord author IDs were not declared by the local source and have not been invented.
- Quoter Enhanced is copied into `quoterEnhanced`, retains upstream author metadata and records Valenced/Benjii attribution. The upstream Quoter directory stays intact but is excluded from renderer/native/metadata registration. Only settings already inside EvenCord migrate from `Quoter` when the new name has no settings; no external profiles are read. The enhanced native helper uses the same new registration name. Existing GIF/media code is retained, not claimed runtime-correct by this integration.

Cards and details share one provenance component. EvenCord gets the new local icon, label and filter. Vencord/Equicord retain their existing source identity and icons. Contributor matching uses declared IDs rather than substituting the distribution maintainer. Website/source destinations identify the maintained source.

## Update and installer changes

The desktop updater and existing-install updater now reject releases that do not approve the actual Discord bootstrap archive. Host persistence refuses older targets, expired compatibility metadata and conflicting EvenCord data roots. Linked ownership files are rejected. Production activation and host repatching remain disabled.

The installer rechecks staged bytes immediately before activation, refreshes stale payload staging, cleans successful installer-owned staging, clears stale GUI discovery selections, and rejects rollback/reused release identities in its release UI. Self-update proof metadata is staged and flushed before replacement. Installer theme and Windows resources use the same palette and artwork.

## Validation and delivery

Focused TypeScript/lint checks, desktop/Windows CLI/GUI builds, plugin metadata/package checks, the host-persistence fixture and relevant Go installer/self-update fixtures cover the modified paths. `scripts/check-plugin-build.cjs` checks emitted source identity and native helpers, not just source text. CI candidate preparation includes complete and EvenCord-only plugin metadata. Actions remain disabled; there is no public release or signing-key enrollment.

The current installed preview is deliberately untouched. A later local preview build/sign/install is a separate action. No recording, voice, GIF, GUI or live-update runtime testing was performed for these changes. Production signing, approved release assets and explicit activation remain prerequisites for public updates.
