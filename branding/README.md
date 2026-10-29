# EvenCord identity contract

project.json is the shared, embedded identity contract. Core is authoritative; installer contains a reviewed identical copy. No runtime network lookup, submodule, or third repository is involved. Schema version 1 pins the product ID, repository IDs, release asset names, storage roots, support/documentation links, palette and capabilities. Component versions live outside this file.

To change the contract, review both repositories together, copy the exact JSON and artwork, and update contract-source.json in the installer with the originating core commit and SHA-256. Never source production update ownership from a developer's Git remote. No upstream binary fallback is allowed.

All capabilities are false in Phase 2. Flipping a boolean is not completion of Phase 3: verified downloads, loader ownership, rollback, error handling and release review are still required. GitHub Actions must stay disabled.

## Compatibility

Keep VencordNative, DiscordNative, Vencord globals, IPC names, webpack aliases, plugin identifiers, settings keys, contributor identities and resource protocols unchanged. Upstream plugin labels and service links describe their real provenance. Do not replace author names or upstream licenses.

## Artwork

The geometric E uses three open horizontal bands with diagonal endings. The official palette uses #191A1E backgrounds, #34353B secondary surfaces, #805263 brand accent and #F0EDEB text. Light marks on accent tiles stay legible at small sizes. SVG masters and PNG/ICO exports are in assets. Icons have no external image dependency.

Core branding/generate_assets.py regenerates exports with Pillow and Windows Segoe UI for banner text; the symbol is entirely original geometry. No font binaries are redistributed. The SVG wordmark remains editable. Artwork copyright 2026 EvenCord contributors, GPL-3.0-or-later.

## Review after upstream merges

Classify upstream references as attribution, compatibility identifiers, optional service provenance, or product/distribution identity. Audit new download URLs, fallback hosts, database names, env vars and support text. Keep the Phase 1 job guards and repository-level Actions disablement. Preserve merge ancestry and review conflicts explicitly.

## Release and loader protocol

See [PHASE3.md](../PHASE3.md). runtime.cjs, host.cjs, loader.cjs and trust.json are identical reviewed copies across repositories, in addition to project.json. Run scripts/check-release.cjs with the peer checkout path after changing them. No production public keys are enrolled yet.
