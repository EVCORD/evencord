# Branding and release contract

`project.json` defines the shared EvenCord identity, palette, repository ownership and capability flags. `mark.json` is the editable geometry for the standalone E; SVG, PNG and ICO outputs are in `assets`.

The core and installer preserve matching `runtime.cjs`, `loader.cjs`, `host.cjs` and `trust.json` files. The installer records their source commit in `contract-source.json`. Keep compatibility identifiers and upstream attribution intact.

Installation, repair and signed core updates are enabled for reviewed Windows x64 Discord archives. Stable releases are preferred; the legacy beta policy is retained only for migration and rollback. Installer self-update and cloud synchronization remain disabled. Host repatching is limited to verified compatible archives. See [release security](../docs/RELEASE-SECURITY.md) for signing and distribution details.
