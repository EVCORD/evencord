<p align="center"><img src="branding/assets/banner.svg" alt="EvenCord. Make Discord your own." width="960"></p>

# EvenCord

An independent, open-source Discord client modification based on **Equicord and Vencord**. A familiar plugin ecosystem, a distinct identity, and settings that stay separate from other modifications.

**Public Beta:** core `0.1.0-beta.2`, installer `0.1.0-beta.1`. Component versions are independent. Experimental software, not a stable release. Windows x64 and the reviewed Discord Stable 1.0.9266 archive only.

[Download for Windows](https://github.com/alrimii/evencord-installer/releases/download/installer-v0.1.0-beta.1/EvenCordInstaller-x64.exe) | [Website & plugins](https://alrimii.github.io/evencord/) | [Installer release notes and verification](https://github.com/alrimii/evencord-installer/releases/tag/installer-v0.1.0-beta.1) | [Core release](https://github.com/alrimii/evencord/releases/tag/core-v0.1.0-beta.2)

[Explore the source plugins](src) · [Report a problem](https://github.com/alrimii/evencord/issues) · [Release security](docs/RELEASE-SECURITY.md) · [Installer](https://github.com/alrimii/evencord-installer)

## What you get

- Inherited **Vencord**, **Equicord** and **EvenCord** plugin sources, with distinct badges, filters and original author attribution.
- **Reclip:** a local rolling replay buffer for the Discord window, with microphone and speaker capture, duration presets, shortcuts, quality controls and WebM export. MP4/MKV conversion requires optional FFmpeg.
- **Quoter Enhanced:** the customized Quoter with Valenced-inspired layout, additional typography, images, stickers and experimental GIF handling.
- Separate `%APPDATA%\EvenCord` settings, themes and QuickCSS. No automatic import from Equicord or Vencord.
- Signed release metadata, bounded artifact downloads, SHA-256 verification, explicit loader ownership and recovery safeguards.

Plugin availability does not guarantee compatibility with every future Discord update. The maintainer manually tested the preceding private preview for startup, plugin enabling, voice and settings persistence. The new beta packaging receives focused automated validation; additional tester feedback is welcome.

## Windows installation

The initial target is **Windows 10/11 x64 and Discord Stable 1.0.9266**, with the exact reviewed original archive in [compatibility metadata](branding/discord-compatibility.json). Other archives are rejected, including newer ones until reviewed. No standalone, browser, macOS or Linux download is offered.

1. Start with official Discord Stable. If another modification is installed, remove it using its supported uninstaller. EvenCord refuses foreign loaders instead of overwriting them.
2. Fully exit Discord, including its tray process. Download the approved installer from the link above.
3. Choose **Detect Discord Stable**, then **Install / Update**. Start Discord and open EvenCord settings after installation completes.

EvenCord beta installers are **not Windows Authenticode signed**. SmartScreen or unknown-publisher warnings are possible. Ed25519 authenticates the release manifest, not the Windows publisher. Do not disable Windows security globally or run files from untrusted mirrors.

## Updates, repair and removal

This beta uses **manual installer upgrades**. Automatic core updates, installer self-update and Discord repatching are disabled. A Discord update may require a newly reviewed compatibility entry.

Use **Repair** to retrieve and verify an approved payload, **Recover** for an interrupted transaction, or **Uninstall** to restore the verified original loader. Settings remain intact. Never blindly delete `app.asar`, `_app.asar`, ownership records or recovery files. Private previews have separate trust and are not silently migrated by the public installer.

## Recording and media privacy

Reclip starts manually unless Auto Start is enabled. Its video targets the main Discord window, but **Windows loopback audio can include other applications** on the default output. Microphone capture is independent of Discord mute and push-to-talk; choose Microphone off to exclude it. Obtain participants' consent where required.

The rolling buffer lives in memory; saved clips go to `Videos\bossclip`. There is no automatic upload. Stopping or closing Discord discards unsaved footage. Minimized/locked sessions may freeze capture. See [Reclip's full controls and limits](src/evencordplugins/reclip.desktop/README.md).

Quoter Enhanced's media retrieval depends on providers, valid URLs and network access. GIF decoding/export has size and format limits; it is not advertised as universally working. See [its attribution](src/evencordplugins/quoterEnhanced/ATTRIBUTION.md).

## Build from source

Use Node.js 22 and the pnpm version declared by `packageManager` in `package.json`.

```sh
git clone https://github.com/alrimii/evencord.git
cd evencord
corepack pnpm install --frozen-lockfile
corepack pnpm build
corepack pnpm testTsc
```

Building does not install anything. The legacy injection wrapper is not a public distribution path; use the verified installer. Maintainer signing, compatibility review and release checks are described in [RELEASE-SECURITY.md](docs/RELEASE-SECURITY.md).

To regenerate the website catalog and pages:

```sh
node node_modules/tsx/dist/cli.mjs scripts/generatePluginList.ts dist/plugins.json
node scripts/build-site.mjs
```

## Contributing and support

Report bugs in [core/plugin issues](https://github.com/alrimii/evencord/issues) or [installer issues](https://github.com/alrimii/evencord-installer/issues). Include versions and reproducible steps, but remove account tokens, personal messages, recordings and sensitive log content. Do not submit private signing material.

Keep plugin IDs and authors intact. Official EvenCord additions live in `src/evencordplugins`; inherited plugin trees remain upstream-maintainable. Equicord is the sole regular core synchronization source. Source changes are reviewed before release; an upstream push never automatically publishes binaries.

## Credits and license

Based on [Equicord](https://github.com/Equicord/Equicord) and [Vencord](https://github.com/Vendicated/Vencord). The installer derives from [Equilotl](https://github.com/Equicord/Equilotl). Quoter Enhanced retains its original authors and references [Valenced Quoter](https://github.com/Accentaro/Valenced-Plugins/tree/main/plugins/quoter). Source badges identify maintenance origin, not exclusive authorship.

The core is GPL-3.0-or-later; see [LICENSE](LICENSE), retained copyright headers, dependency notices and Git contribution history. Release tags provide corresponding source. Original EvenCord artwork is kept as editable SVG and reproducibly generated raster/icon assets.

EvenCord is not affiliated with or endorsed by Discord Inc., Vencord, Equicord or Valenced. Client modifications may conflict with [Discord's terms](https://discord.com/terms); no account-safety guarantee is made. The working name is not a claim of trademark registration or clearance.

Historical engineering records remain available: [foundation](FOUNDATION.md), [Phase 2](PHASE2.md), [Phase 3](PHASE3.md). Their phase-specific capability descriptions are historical, not current download instructions.
