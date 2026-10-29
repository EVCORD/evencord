# Shipping plugin updates

Official EvenCord plugins live in src/evencordplugins. A new plugin in that directory is discovered during the normal build and receives EvenCord provenance. Keep each plugin name unique, preserve author credits and use the existing settings API.

Plugins ship inside the signed core payload. Users do not download individual plugin scripts. Pushing source to main alone does not send an update.

For each core release:

1. Edit the plugin, increase the core version in package.json and add matching docs/releases/VERSION.md notes. Preserve settings keys or provide an explicit migration when renaming them.
2. Run focused lint/type checks and commit the reviewed source. Build the desktop core from that exact commit.
3. Place desktop.asar in a new ignored candidate directory. Run node scripts/prepare-beta.cjs core DIRECTORY SEQUENCE using a sequence higher than every previous core release.
4. Sign the manifest using the protected beta signing identity through scripts/sign-release.cjs. Keep the private key outside Git, logs and uploaded assets. Verify with node scripts/release-tools.cjs verify core DIRECTORY.
5. Publish immutable artifacts, signed metadata, source identity, checksums and notices as a GitHub prerelease tagged core-vVERSION in alrimii/evencord. Verify the public download before announcing it or updating the website.

Managed beta.3 or newer clients check after startup and every 30 minutes. Users can also choose Check for Updates. Automatic downloads follow the user's existing preference. The client verifies identity, Ed25519 signature, artifact size, SHA-256 and Discord compatibility before staging. Restart is offered only after successful staging.

A core-only plugin change normally needs no installer rebuild: the current installer discovers the newest approved signed core release. Rebuild and independently version the installer when its own code or embedded trust/loader contract changes. Beta.1/beta.2 clients need the one-time manual installer upgrade.

Equicord upstream synchronization is a separate source-review step. Review and integrate upstream changes, then publish an EvenCord release through the same process. An upstream commit never directly updates users.

The read-only Review Equicord upstream workflow checks every 12 hours and supports manual dispatch. Its artifact lists upstream commits, plugin changes and merge conflicts. Review and integrate these changes before building a signed EvenCord release. It has no write permissions or signing credentials.
