# EvenCord foundation status

Phase 3 implementation and current limitations are recorded in [PHASE3.md](PHASE3.md). Actions and production distribution remain disabled.

Phase 2 branding and identity are implemented. See [PHASE2.md](PHASE2.md). The following Phase 1 record is historical; its references to unchanged runtime branding describe the initial foundation, not the current source.

# Phase 1 foundation

This repository is an independent, open-source fork of [Equicord](https://github.com/Equicord/Equicord), which derives from [Vencord](https://github.com/Vendicated/Vencord). It is not an official release of either project. The repository name is temporary; final branding has not been selected.

## Repository relationships

| Component | Repository | Upstream | Local checkout |
| --- | --- | --- | --- |
| Core | [alrimii/evencord](https://github.com/alrimii/evencord) | Equicord/Equicord | `<workspace>\core` |
| Installer | [alrimii/evencord-installer](https://github.com/alrimii/evencord-installer) | Equicord/Equilotl | `<workspace>\installer` |

Each checkout has its own `.git` directory. `origin` points to the corresponding alrimii fork, and `upstream` points to the official repository above. `main` tracks `origin/main`. Local pulls are configured as fast-forward only, with pushes defaulting to `origin`.

The core fork started at `a5753f70a1e4ccde881ea516a5d1b2fc51cadd86`. Existing upstream history, authorship, copyright notices, and licenses are retained. The separate development repository at `<legacy-source>` is outside this project and must remain untouched. Reclip and the locally customized Quoter were not imported; upstream's normal Quoter remains part of the inherited source.

## Current scope and safeguards

The planned target is a modification of existing Discord Stable on Windows x64. There is no standalone application integration.

GitHub Actions is disabled at repository level. The main-branch jobs in these inherited distribution workflows also have unconditional false guards:

- `.github/workflows/build.yml`
- `.github/workflows/buildBranches.yml`
- `.github/workflows/publish.yml`
- `.github/workflows/nixosBuild.yml`
- `.github/workflows/codeberg-mirror.yml`

Build infrastructure and existing upstream conditions are retained. Other workflows remain present but cannot execute while repository Actions is disabled. Inherited branches and tags preserve history; they are not releases of this project. Before enabling Actions, review workflows on every branch or tag that could run, not only `main`.

No release binaries, repository secrets, signing credentials, synchronization automation, or publishing automation were added. Phase 1 changes are limited to documentation, workflow guards, and repository configuration. Runtime source and updater/installer destinations are unchanged. Do not distribute this source as a finished branded product or run its install instructions against the existing development installation.

## Synchronization policy for a later phase

Equicord is the sole direct upstream for the core. Vencord changes arrive through Equicord; do not maintain a second automatic merge stream. Prepare future upstream merges on review branches, record the upstream SHA, and preserve merge ancestry. Report conflicts without blanket ours/theirs resolutions. Review plugin additions/removals, settings migrations, native code, dependencies, branding, and distribution endpoints. Recheck workflow guards after every merge.

Human approval and validation must precede merging and release promotion. Do not squash upstream synchronization merges or force-push the public main branch. No scheduled checks or synchronization workflows are configured in this phase.

## Next phase

Obtain approval for the final project name and identity. Then design a centralized branding configuration, isolated data paths, and explicit ownership of download/update destinations. CI/CD activation, installer redesign, updater hardening, signing, and releases require their own later approval. GitHub Actions must remain disabled until the owner explicitly approves CI/CD configuration.

Phase 1 was prepared with OpenAI Codex assistance. Verification is limited to source/configuration inspection and GitHub/Git metadata; no build, test, installation, or runtime compatibility validation was performed.
