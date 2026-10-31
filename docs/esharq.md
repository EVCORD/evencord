# Esharq plugins

EvenCord imports a selected compatible set from [LOSTSTR/Esharq](https://github.com/LOSTSTR/Esharq/tree/main/src/esharqplugins). Its `src/plugins` folder contains shared Vencord plugins, which continue to come from Equicord here. Esharq authors, GPL headers, license and logo are preserved. The source badge and source button link to Esharq.

The selected folders are listed in [branding/esharq.json](../branding/esharq.json). The exact imported commit is recorded in [branding/esharq-lock.json](../branding/esharq-lock.json). The scheduled release workflow checks Equicord and Esharq every six hours, imports changes, bumps the EvenCord version, builds all supported targets and publishes the update. A failed build stops publication. Updates reach users through the normal EvenCord updater; plugins do not download or execute new plugin code directly.

Run `node scripts/sync-esharq.mjs` to import a newer version. Use `--force` to refresh the same commit. The importer changes only the selected Esharq plugin folders and its shared constants, modal helper, logo and license. Its small compatibility layer adapts the older Esharq UI and toast APIs to the current Equicord APIs. Plugin text uses Esharq's English strings; the full Esharq Arabic interface is not imported.

The current selection adds 42 plugins. Existing EvenCord PasscodeLock and shared Equicord plugins are kept instead of registering duplicate names. New plugins remain disabled until enabled by the user.

## Exclusions

The selection omits account automation and moderation bypass plugins, simulated account/permission features, external services that require credentials, and CSS-only visual plugins under the repository's plugin rules. Examples include AutoClaim, NitroSniper, MessageCleaner, FakeDeafen, AutoUnmute, GuildCopier, MyToken, SoundCloudRichPresence, SummarizeAI, Tsunderetalk, TempMail and the standalone vaporwave effects.

Backpack, BetterScreenshare, MicPro and their shared library need Esharq-specific APIs or native voice integrations. DiscordArabicizer depends on Esharq's complete localization/settings layer. DynamicIslande requires MusicControls, which is not present here. These are not imported as partial or non-working plugins. New Esharq folders require a compatibility review before adding them to the selection.
