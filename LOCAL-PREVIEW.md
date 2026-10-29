# Private local preview

This mode keeps every production capability disabled. It does not fetch releases or enroll development keys into production trust.

1. Protect `.cache/local-preview` with an owner-only Windows ACL before running `node scripts/local-preview.cjs init`. The ignored `private/signing.pem` must never be committed, shared, or uploaded. The bundle directory contains only public trust, a signed manifest and the payload.
2. Commit reviewed source. Set `EVENCORD_LOCAL_TRUST` to the absolute `.cache/local-preview/bundle/trust.json` path and run the normal desktop build. The build substitutes only the compiled public trust, never the tracked production trust file. Clear the environment variable afterward.
3. Run `node scripts/local-preview.cjs sign <absolute-original-Discord-archive>`. First independently review that archive and the installed loader; internal archive checksums establish integrity, not publisher authenticity. The command signs the actual archive and payload hashes with a dedicated local key. Private versions use `0.0.<epoch-seconds>` and cannot be accepted by production trust.
4. Build the installer's `cmd/local-preview` with its `main.trustSHA256` linker variable pinned to SHA-256 of the bundle's exact trust.json bytes. Use explicit bundle and Discord Stable resources paths. Ordinary public installer commands remain disabled.

Do not copy this trust into production configuration. The private key remains local; the compiled installer contains only its public trust fingerprint. The core source repository and current commit are recorded in the authenticated manifest. No automatic settings migration occurs.

For a later Discord host update, this preview deliberately does not repatch automatically. Review the new original archive and perform another explicitly authorized local installation. Uninstall/recover uses the same fingerprint-pinned local installer and preserves EvenCord settings.
