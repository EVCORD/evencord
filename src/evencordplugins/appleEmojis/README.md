# AppleEmojis

Enabled by default. Toggle it in EvenCord's plugin list. Disabling it immediately restores Discord's artwork. Custom server emojis are unchanged.

Uses the Apple Emoji 17.0 artwork provided by [iamcal/emoji-data](https://github.com/iamcal/emoji-data/tree/e77759c296ed37beb0dbd63908b43d8619509c6d), whose documented source is macOS 26.4 beta 4. This is the newest Apple artwork in that source, not a guarantee of every subsequent iOS design revision.

Artwork loads as one browser-cached sprite from the pinned GitHub revision. Discord's images remain visible until loading succeeds. Missing Apple artwork and unsupported Discord characters retain their original appearance. This changes rendered Unicode emoji images, not plain system-font text or the available emoji keyboard entries.

Apple artwork is copyright Apple Inc.; the source states it is not licensed for commercial usage. The dataset's MIT license does not grant rights to Apple's artwork. No Apple image files are bundled with EvenCord.

`emoji.json` contains Unicode sequences and sprite coordinates from the source above. Dataset copyright (c) 2013 Cal Henderson; MIT license in `LICENSE-data`.
