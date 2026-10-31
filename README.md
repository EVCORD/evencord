# <img src="branding/assets/mark.svg" width="36" align="left" alt=""> EvenCord

A Discord client modification based on [Equicord](https://github.com/Equicord/Equicord) and [Vencord](https://github.com/Vendicated/Vencord), with additional plugins and its own identity.

[Website](https://alrimii.github.io/evencord/) · [Plugins](https://alrimii.github.io/evencord/plugins/) · [Support](https://github.com/alrimii/evencord/issues)

## Download

EvenCord follows Equicord's core and the Equilotl based installation paths for Windows, macOS and Linux. Download the artifact for your platform from the [installer releases](https://github.com/alrimii/evencord-installer/releases/latest). Available release assets show the current platform builds.

1. Save your work and close Discord.
2. Open the EvenCord installer and choose your Discord installation.
3. Install or repair EvenCord, then reopen Discord.

Settings and themes remain in the EvenCord profile. Uninstall restores Discord's original archive. Version 1.1.0 transitions existing managed Windows clients through a signed update to the normal loader. If EvenCord cannot start, use the current installer Repair operation. Windows executables are not Authenticode signed; macOS builds use ad hoc signing.

Equicord source changes are checked every six hours and rebuilt with EvenCord customizations after validation. Source conflicts stop publishing for review. Your own branding and plugin changes ship through the same release workflow. Downloads use EvenCord's repository, preserving your customizations. [Update and migration details](docs/UPDATING.md).

## Plugins

Browse the [plugin library](https://alrimii.github.io/evencord/plugins/) for descriptions and authors. Vencord, Equicord and EvenCord plugins retain distinct source badges.

- **Reclip** saves recent footage of your Discord window with a button or shortcut. Choose the replay duration, quality and audio sources.
- **Quoter Enhanced** adds a Valenced-inspired quote layout, typography, images, stickers and experimental GIF support.
- **BetterMicrophone**, **FollowUser**, **PasscodeLock** and **DontControlMe** are available under EvenCord, with PhilsPluginLibrary supporting microphone profiles. New plugins are opt-in. [Capabilities and limitations](src/evencordplugins/IMPORTED-PLUGINS.md).
- **EvenClean** previews your own messages and removes only explicitly confirmed batches, with pause controls and request cooldowns. [Usage and account-automation limitations](src/evencordplugins/evenClean/README.md).
- Inherited plugins keep their original names, settings and author credits.

Reclip's speaker audio may include other applications, and microphone capture is independent of Discord mute. [Recording controls and privacy](https://alrimii.github.io/evencord/faq/#recording)

For volunteer testing and transferring compatible plugin preferences, see the [testing and settings-transfer guide](docs/BETA-TESTING.md). Custom plugin code is not installed by settings import.

To contribute or distribute an EvenCord plugin, follow the [plugin publishing process](docs/PLUGIN-RELEASES.md). A GitHub source push alone does not update installed clients.

## Building from source

Use Node.js 22 and the pnpm version declared in `package.json`.

```sh
git clone https://github.com/alrimii/evencord.git
cd evencord
corepack pnpm install --frozen-lockfile
corepack pnpm build
```

Building does not install EvenCord. Use the installer for your platform for installation. See [contributing](CONTRIBUTING.md) and [release documentation](docs/RELEASE-SECURITY.md) for development details.

## Credits

Built on [Equicord](https://github.com/Equicord/Equicord) and [Vencord](https://github.com/Vendicated/Vencord). The installer derives from [Equilotl](https://github.com/Equicord/Equilotl). Quoter Enhanced retains its original authors and [Valenced attribution](src/evencordplugins/quoterEnhanced/ATTRIBUTION.md).

Licensed under [GPL-3.0-or-later](LICENSE). Original copyright notices and contribution history are preserved.

EvenCord is independent and is not affiliated with Discord Inc. Client modifications may conflict with Discord's terms; no guarantee against account restrictions is made.
