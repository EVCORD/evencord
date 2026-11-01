# <img src="branding/assets/mark.svg" width="36" align="left" alt=""> EvenCord

Discord, with your plugins and your style. Built on [Equicord](https://github.com/Equicord/Equicord).

[![Installer downloads](https://raw.githubusercontent.com/EVCORD/evencord/community-stats/downloads.svg)](https://discord.com/channels/1396464693169885315/1566070959696515232)

[Website](https://evcord.github.io/evencord/) | [Plugins](https://evcord.github.io/evencord/plugins/) | [Help](https://evcord.github.io/evencord/faq/) | [Discord](https://discord.gg/X9ZPfzEe9b)

## Discord community

**[Join the official EvenCord server](https://discord.gg/X9ZPfzEe9b)** for plugins, release news and help in Arabic or English.

[Get support](https://discord.com/channels/1396464693169885315/1566071279864512574) | [Suggest a feature](https://discord.com/channels/1396464693169885315/1566071265649889421)

## Download

| Platform | Intel / AMD (x64) | ARM64 |
| --- | --- | --- |
| Windows | [Download](https://github.com/EVCORD/evencord-installer/releases/latest/download/EvenCord.exe) | [Download](https://github.com/EVCORD/evencord-installer/releases/latest/download/EvenCord-arm64.exe) |
| macOS | [Download](https://github.com/EVCORD/evencord-installer/releases/latest/download/EvenCord.dmg) | [Download](https://github.com/EVCORD/evencord-installer/releases/latest/download/EvenCord-arm64.dmg) |
| Linux | [Download](https://github.com/EVCORD/evencord-installer/releases/latest/download/EvenCord) | [Download](https://github.com/EVCORD/evencord-installer/releases/latest/download/EvenCord-arm64) |

**macOS:** [Universal download](https://github.com/EVCORD/evencord-installer/releases/latest/download/EvenCord.dmg) for Apple silicon and Intel.

<details>
<summary>Command line and Linux variants</summary>

| Platform | x64 | ARM64 |
| --- | --- | --- |
| Windows | [Download](https://github.com/EVCORD/evencord-installer/releases/latest/download/EvenCord-cli.exe) | [Download](https://github.com/EVCORD/evencord-installer/releases/latest/download/EvenCord-cli-arm64.exe) |
| macOS | [Download](https://github.com/EVCORD/evencord-installer/releases/latest/download/EvenCord-cli-x64) | [Download](https://github.com/EVCORD/evencord-installer/releases/latest/download/EvenCord-cli-arm64) |
| Linux | [Download](https://github.com/EVCORD/evencord-installer/releases/latest/download/EvenCord-cli-linux) | [Download](https://github.com/EVCORD/evencord-installer/releases/latest/download/EvenCord-cli-linux-arm64) |

Linux: [X11](https://github.com/EVCORD/evencord-installer/releases/latest/download/EvenCord-x11) | [Wayland](https://github.com/EVCORD/evencord-installer/releases/latest/download/EvenCord-wayland) | [X11 ARM64](https://github.com/EVCORD/evencord-installer/releases/latest/download/EvenCord-x11-arm64) | [Wayland ARM64](https://github.com/EVCORD/evencord-installer/releases/latest/download/EvenCord-wayland-arm64).

</details>

## Install

1. Close Discord.
2. Open EvenCord and choose your Discord installation.
3. Select **Install**, then reopen Discord. Use **Repair** if EvenCord is already installed.

Your settings are kept when repairing or uninstalling.

## Plugins

Includes Vencord and Equicord plugins, EvenCord additions such as Reclip, Quoter Enhanced and EvenClean, and adapted [community plugins with original credits](docs/community-plugin-sources.md). [Browse plugins](https://evcord.github.io/evencord/plugins/).

## Build

```sh
git clone https://github.com/EVCORD/evencord.git
cd evencord
pnpm install --frozen-lockfile
pnpm build
```

Use Node.js 22 or newer. [Contributing](CONTRIBUTING.md).

## Credits

Based on [Equicord](https://github.com/Equicord/Equicord), [Vencord](https://github.com/Vendicated/Vencord) and [Equilotl](https://github.com/Equicord/Equilotl). Original plugin authors and license notices are preserved. [GPL-3.0-or-later](LICENSE).

EvenCord is independent of Discord. Client modifications may conflict with Discord's terms.

Developed by **BOSS**. Discord: **bss** / [Instagram: _w0d](https://www.instagram.com/_w0d/).

Compatible [Esharq plugins](docs/esharq.md) keep their original logo and credits and receive upstream updates through EvenCord.
