# <img src="branding/assets/mark.svg" width="36" align="left" alt=""> EvenCord

A Discord client modification based on [Equicord](https://github.com/Equicord/Equicord) and [Vencord](https://github.com/Vendicated/Vencord), with additional plugins and its own identity.

[Website](https://alrimii.github.io/evencord/) · [Plugins](https://alrimii.github.io/evencord/plugins/) · [Support](https://github.com/alrimii/evencord/issues)

## Download

**Windows x64 · Stable, PTB and Canary · Public beta**

| Installer | Download |
| --- | --- |
| Windows GUI | [Download EvenCord Installer](https://github.com/alrimii/evencord-installer/releases/download/installer-v0.1.0-beta.8/EvenCordInstaller-x64.exe) |
| Windows CLI | [Download CLI](https://github.com/alrimii/evencord-installer/releases/download/installer-v0.1.0-beta.8/EvenCordInstallerCli-x64.exe) |

1. Download and open the installer.
2. Save any unsaved clips or work. The installer closes the selected Discord channel.
3. Select **Install EvenCord**, then reopen Discord.

To remove EvenCord, open the installer and select **Uninstall**. Your settings are kept. Remove other client modifications using their own installer first.

The beta supports reviewed Stable **1.0.9266**, PTB **1.0.1229** and Canary **1.0.1285/1.0.1286** archives. Channel profiles are separate. Beta.1 and beta.2 require a one-time upgrade with the new installer. From beta.3, EvenCord checks for signed updates automatically; control background downloads in EvenCord > Updater. Restart only after a verified update is ready. Windows executables are unsigned and may show a SmartScreen warning. [Release notes and checksums](https://github.com/alrimii/evencord-installer/releases) · [Installation help](https://alrimii.github.io/evencord/faq/)

## Plugins

Browse the [plugin library](https://alrimii.github.io/evencord/plugins/) for descriptions and authors. Vencord, Equicord and EvenCord plugins retain distinct source badges.

- **Reclip** saves recent footage of your Discord window with a button or shortcut. Choose the replay duration, quality and audio sources.
- **Quoter Enhanced** adds a Valenced-inspired quote layout, typography, images, stickers and experimental GIF support.
- Inherited plugins keep their original names, settings and author credits.

Reclip's speaker audio may include other applications, and microphone capture is independent of Discord mute. [Recording controls and privacy](https://alrimii.github.io/evencord/faq/#recording)

For volunteer testing and transferring compatible plugin preferences, see the [beta testing guide](docs/BETA-TESTING.md). Custom plugin code is not installed by settings import.

## Building from source

Use Node.js 22 and the pnpm version declared in `package.json`.

```sh
git clone https://github.com/alrimii/evencord.git
cd evencord
corepack pnpm install --frozen-lockfile
corepack pnpm build
```

Building does not install EvenCord. Use the verified installer for installation. See [contributing](CONTRIBUTING.md) and [release documentation](docs/RELEASE-SECURITY.md) for development details.

## Credits

Built on [Equicord](https://github.com/Equicord/Equicord) and [Vencord](https://github.com/Vendicated/Vencord). The installer derives from [Equilotl](https://github.com/Equicord/Equilotl). Quoter Enhanced retains its original authors and [Valenced attribution](src/evencordplugins/quoterEnhanced/ATTRIBUTION.md).

Licensed under [GPL-3.0-or-later](LICENSE). Original copyright notices and contribution history are preserved.

EvenCord is independent and is not affiliated with Discord Inc. Client modifications may conflict with Discord's terms; no guarantee against account restrictions is made.
