# <img src="branding/assets/mark.svg" width="36" align="left" alt=""> EvenCord

Discord, with your plugins and your style. Built on [Equicord](https://github.com/Equicord/Equicord).

[Website](https://alrimii.github.io/evencord/) | [Plugins](https://alrimii.github.io/evencord/plugins/) | [Help](https://alrimii.github.io/evencord/faq/)

## Download

| Platform | Intel / AMD (x64) | ARM64 |
| --- | --- | --- |
| Windows | [Download](https://github.com/alrimii/evencord-installer/releases/latest/download/EvenCord.exe) | [Download](https://github.com/alrimii/evencord-installer/releases/latest/download/EvenCord-arm64.exe) |
| macOS | [Download](https://github.com/alrimii/evencord-installer/releases/latest/download/EvenCord.dmg) | [Download](https://github.com/alrimii/evencord-installer/releases/latest/download/EvenCord-arm64.dmg) |
| Linux | [Download](https://github.com/alrimii/evencord-installer/releases/latest/download/EvenCord) | [Download](https://github.com/alrimii/evencord-installer/releases/latest/download/EvenCord-arm64) |

**macOS:** [Universal download](https://github.com/alrimii/evencord-installer/releases/latest/download/EvenCord.dmg) for Apple silicon and Intel.

<details>
<summary>Command line and Linux variants</summary>

| Platform | x64 | ARM64 |
| --- | --- | --- |
| Windows | [Download](https://github.com/alrimii/evencord-installer/releases/latest/download/EvenCord-cli.exe) | [Download](https://github.com/alrimii/evencord-installer/releases/latest/download/EvenCord-cli-arm64.exe) |
| macOS | [Download](https://github.com/alrimii/evencord-installer/releases/latest/download/EvenCord-cli-x64) | [Download](https://github.com/alrimii/evencord-installer/releases/latest/download/EvenCord-cli-arm64) |
| Linux | [Download](https://github.com/alrimii/evencord-installer/releases/latest/download/EvenCord-cli-linux) | [Download](https://github.com/alrimii/evencord-installer/releases/latest/download/EvenCord-cli-linux-arm64) |

Linux: [X11](https://github.com/alrimii/evencord-installer/releases/latest/download/EvenCord-x11) | [Wayland](https://github.com/alrimii/evencord-installer/releases/latest/download/EvenCord-wayland) | [X11 ARM64](https://github.com/alrimii/evencord-installer/releases/latest/download/EvenCord-x11-arm64) | [Wayland ARM64](https://github.com/alrimii/evencord-installer/releases/latest/download/EvenCord-wayland-arm64).

</details>

## Install

1. Close Discord.
2. Open EvenCord and choose your Discord installation.
3. Select **Install**, then reopen Discord. Use **Repair** if EvenCord is already installed.

Your settings are kept when repairing or uninstalling.

## Plugins

Includes Vencord and Equicord plugins, plus EvenCord additions such as Reclip, Quoter Enhanced, BetterMicrophone and EvenClean. [Browse plugins](https://alrimii.github.io/evencord/plugins/).

## Build

```sh
git clone https://github.com/alrimii/evencord.git
cd evencord
pnpm install --frozen-lockfile
pnpm build
```

Use Node.js 22 or newer. [Contributing](CONTRIBUTING.md).

## Credits

Based on [Equicord](https://github.com/Equicord/Equicord), [Vencord](https://github.com/Vendicated/Vencord) and [Equilotl](https://github.com/Equicord/Equilotl). Original plugin authors and license notices are preserved. [GPL-3.0-or-later](LICENSE).

EvenCord is independent of Discord. Client modifications may conflict with Discord's terms.
