/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { project } from "./project.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const installer = process.argv[2] && resolve(process.argv[2]);
assert.equal(project.schemaVersion, 1);
assert.equal(project.id, "evencord");
assert.equal(project.repositories.core.id, 1438489516);
assert.equal(project.repositories.installer.id, 1438489594);
assert.equal(project.repositories.core.slug, "alrimii/evencord");
assert.equal(project.repositories.installer.slug, "alrimii/evencord-installer");
assert.equal(project.release.platform, "win32");
assert.equal(project.release.architecture, "x64");
assert.equal(project.release.discordChannel, "stable");
for (const [name, enabled] of Object.entries(project.capabilities))
    assert.equal(enabled, ["distribution", "installation", "repair", "updates", "hostRepatch"].includes(name), "Unexpected release capability: " + name);
for (const asset of Object.values(project.artwork))
    assert.ok(existsSync(resolve(root, asset)), "Missing branding asset: " + asset);
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
assert.equal(pkg.name, project.id);
assert.equal(pkg.homepage, project.links.documentation);
assert.equal(pkg.description, project.description);
const launcher = readFileSync(resolve(root, "scripts/runInstaller.mjs"), "utf8");
assert.ok(launcher.includes("requireDistribution();"));
assert.ok(!launcher.includes("fetch(") && !launcher.includes("execFileSync("));
assert.ok(!launcher.includes("Equicord/Equilotl"));
const constants = readFileSync(resolve(root, "src/main/utils/constants.ts"), "utf8");
assert.ok(!constants.includes("EQUICORD_USER_DATA_DIR"));
assert.ok(!constants.includes("copyFileSync"));
if (installer) {
    assert.deepEqual(JSON.parse(readFileSync(resolve(installer, "branding/project.json"), "utf8")), project);
    const installerConstants = readFileSync(resolve(installer, "constants.go"), "utf8");
    assert.ok(!installerConstants.includes("equicord.org/releases"));
    for (const name of ["icon-256.png", "icon.ico", "mark.svg", "banner.svg"])
        assert.deepEqual(readFileSync(resolve(root, "branding/assets", name)), readFileSync(resolve(installer, "branding/assets", name)));
    const resources = JSON.parse(readFileSync(resolve(installer, "winres/winres.json"), "utf8"));
    assert.equal(resources.RT_VERSION["#1"]["0000"].info["0409"].ProductName, project.installerName);
}
console.log("EvenCord identity, managed release capabilities, storage boundary and assets are consistent.");
