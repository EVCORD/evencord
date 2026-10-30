# Imported plugins

These plugins were imported from the maintainer-provided `main` source folder and adapted to the current EvenCord APIs. Their EvenCord badge identifies the maintained distribution, not exclusive authorship. Original GPL notices are retained.

| Plugin | Credit retained from source | Notes |
| --- | --- | --- |
| BetterMicrophone | viciouscal; contributor philhk | Desktop voice profiles. Experimental native stereo patching is separately opt-in and restricted to Windows x64. |
| PhilsPluginLibrary | viciouscal | Shared desktop profile and voice-panel library required by BetterMicrophone. |
| FollowUser | D3SOX | Follow an explicitly selected user's accessible voice channel. Discord permissions and channel limits still apply. |
| PasscodeLock | Yazan | Local screen lock for casual access. Does not encrypt account data or replace the operating-system lock. |
| DontControlMe | Unknown in imported source | Return to a pinned voice channel. Server mute/deafen requests require existing moderation permissions and are disabled by default. Does not bypass server moderation. |

No verified Discord account ID was supplied for viciouscal or Yazan; their credited names are retained without inventing IDs. User settings exports were not imported. New plugins are disabled by default. BetterMicrophone enables its library dependency through the normal plugin manager.

## Native microphone dependency

The optional addon comes from [sultriness/DiscordVoicePatcher](https://github.com/sultriness/DiscordVoicePatcher/tree/416d53908843622396fef16c87da11d0e92f7ba0), release `416d539`, under [Apache-2.0](https://github.com/sultriness/DiscordVoicePatcher/blob/416d53908843622396fef16c87da11d0e92f7ba0/LICENSE). Original patcher credits include ProdHallow. It is not bundled in this repository or downloaded when native patching is disabled.

`betterMicrophone.desktop/native-assets.json` pins both files by release, size and SHA-256 inside the signed EvenCord payload. Downloads are bounded and reverified before loading; unverified cached files and moving latest-release feeds are not used. The addon is third-party executable code, not a separately signed EvenCord release. Its memory patching depends on the current Discord voice module. Native compatibility has not been runtime-tested here. Users should avoid combining it with other voice patchers.

The generated configuration excludes the upstream video frame-drop and pacer patches; BetterMicrophone applies microphone-related sections only. An addon or configuration update requires review and a new signed EvenCord release. No private settings, passcodes, recordings or downloaded native binaries belong in Git.
