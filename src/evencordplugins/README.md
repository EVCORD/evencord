# Official EvenCord plugins

Plugins in this tracked directory are maintained in the EvenCord distribution. Their source badge identifies distribution ownership, not exclusive authorship. Keep all original copyrights and author metadata.

Renderer/native discovery, metadata generation and source filters recognize this directory automatically. Existing platform suffixes and dependency rules apply. Reclip retains its logical name and settings. Quoter Enhanced replaces inherited Quoter through the explicit map in `scripts/pluginSources.mjs`; upstream source stays intact but is omitted from renderer, native and generated metadata registrations. A missing replacement fails the build.

New plugin directories must contain index.ts or index.tsx and unique names. Never place recordings, account data, signing keys or binaries here. External tools such as FFmpeg are not automatically downloaded.
