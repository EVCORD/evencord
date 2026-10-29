# EvenCord

![EvenCord](branding/assets/banner.svg)

An open-source Discord client modification based on Equicord.

**Development source only.** Installation, repair, automatic updates, self-update, and automatic host repatching are disabled pending Phase 3. No EvenCord binaries are distributed. Do not inject this development build into an existing Discord installation.

## Project

- Core: https://github.com/alrimii/evencord
- Installer: https://github.com/alrimii/evencord-installer
- Initial target: Windows x64 and Discord Stable.
- Inherits compatible Equicord and Vencord plugins without changing their authors or setting names.
- No standalone client, cloud synchronization, Reclip, or customized Quoter integration.

## Development

The inherited toolchain uses Node.js, pnpm, TypeScript and esbuild. Install dependencies within this checkout, then use the non-installing commands:

    pnpm install --frozen-lockfile
    pnpm build
    pnpm testTsc

The default build produces desktop bundles and desktop.asar under dist. Installation commands intentionally refuse to run. GitHub Actions and publishing workflows remain disabled. Do not enable them without a separate CI/CD review.

See [branding/README.md](branding/README.md) for the shared identity contract, [FOUNDATION.md](FOUNDATION.md) for repository relationships, and [PHASE2.md](PHASE2.md) for implementation and validation details.

## Storage

The Windows default is %APPDATA%\EvenCord. EVENCORD_USER_DATA_DIR overrides that root; DISCORD_USER_DATA_DIR selects the sibling EvenCordData directory. Development defaults add a dev subdirectory. IndexedDB and mod-owned cloud preference keys use separate evencord:stable, evencord:dev or evencord:reporter namespaces. No Equicord settings are imported automatically.

Separate settings do not allow two mods to patch the same Discord installation. Ownership-aware installation and switching remain Phase 3 work.

## Support

This experimental fork is maintained in this repository. There is no EvenCord support server or external support service. Review [PHASE2.md](PHASE2.md) and the source before reporting a problem to the maintainer. Do not request EvenCord support from Equicord or Vencord maintainers.

## Attribution and license

Based on [Equicord](https://github.com/Equicord/Equicord), derived from [Vencord](https://github.com/Vendicated/Vencord), with inherited work from [Suncord](https://github.com/verticalsync/Suncord) and all original contributors. Existing plugin authorship, copyright notices and Git history are preserved.

The core is GPL-3.0-or-later. See [LICENSE](LICENSE), preserved third-party licenses, and [PRIVACY_POLICY.md](PRIVACY_POLICY.md). EvenCord is independent and not affiliated with Discord Inc., Equicord or Vencord. Client modifications may violate Discord's terms; account safety is not guaranteed.

EvenCord is a working brand pending legal and trademark clearance. Original artwork is provided with editable SVG sources and is licensed under GPL-3.0-or-later.
