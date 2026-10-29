# EvenCord privacy information

EvenCord is a client modification running inside Discord, not a separate service. Discord continues to handle its own account data and browser storage.

This Phase 2 source disables cloud synchronization, release downloads, installer operations and self-updates. EvenCord does not operate a cloud service or telemetry backend. Settings and plugin data use EvenCord-specific locations; no upstream settings are imported automatically.

Inherited plugins can contact external services, including upstream badge services, theme services, media providers and services selected by the user. Some plugins process or store messages and media locally. Review each plugin before enabling it. Opening GitHub documentation and support links also contacts GitHub. These services have their own privacy policies.

Local backups can contain plugin data and sensitive preferences. Keep exported files private. Custom cache paths chosen by a user can be outside the default EvenCord directory.

This document describes the current development source. It is not a promise that Discord or every optional third-party plugin collects no data. A distribution privacy review is required before public releases.
