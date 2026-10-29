# Testing EvenCord

The beta is suitable for volunteer testing on Windows x64 with the exact Stable, PTB or Canary archive approved in branding/discord-compatibility.json. Other archives are rejected. It is not a stable release or a promise that every inherited plugin works.

Download the installer from the official EvenCord installer releases. Fully close Discord before installation. If another client modification owns Discord's loader, first export its settings, then remove that modification using its own supported installer. Two modifications cannot own the same loader. EvenCord preserves its separate settings root.

## Importing plugin preferences

Export a JSON settings backup from Vencord or Equicord. Export an EvenCord backup too, then open EvenCord > Backup & Restore > Import Plugins and choose the compatible backup. Restart Discord and review enabled plugins. This merges plugin preferences only. It cannot install custom plugin code or make unsupported plugins compatible. Missing custom plugins must be reviewed and included in the EvenCord source distribution separately.

Import All Settings additionally imports general settings, QuickCSS and optional DataStore records. Use it only when you intend that broader transfer. Local theme files and external dependencies are not embedded in a JSON settings backup.

## Update testing

The inherited notification popup opens the updater when a release is available. Once an update is verified and staged, the ready notification can restart Discord after another staging check. Background downloads follow the saved updater preference. Otherwise use Download update. Report the running version, Discord version and exact error via GitHub Issues; do not upload tokens, private settings or recordings.

Test the native folder picker, your enabled plugins and restart persistence manually. Reclip may record other apps through Windows loopback, and microphone capture is independent of Discord mute. Review recording consent and privacy before use.

Stable settings remain at %APPDATA%/EvenCord. PTB uses the channels/ptb subdirectory and Canary uses channels/canary, including independent themes, plugin preferences, selected releases and recovery. Browser storage also includes the host channel. No automatic profile import or movement occurs. User-chosen recording/output folders remain user-controlled.
