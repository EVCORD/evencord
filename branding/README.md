# Branding and release contract

`project.json` defines the shared EvenCord identity, palette, repository ownership and capability flags. `mark.json` is the editable geometry for the standalone E; SVG, PNG and ICO outputs are in `assets`.

The core and installer preserve matching `runtime.cjs`, `loader.cjs`, `host.cjs` and `trust.json` files. The installer records their source commit in `contract-source.json`. Keep compatibility identifiers and upstream attribution intact.

Beta installation and repair are available; automatic updates, self-update, cloud sync and host repatching remain disabled. See [release security](../docs/RELEASE-SECURITY.md) for signing and distribution details.
