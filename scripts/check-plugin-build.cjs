/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const asar = require("@electron/asar");
const all = JSON.parse(fs.readFileSync("dist/plugins.json", "utf8"));
const own = JSON.parse(fs.readFileSync("dist/evencord-plugins.json", "utf8"));
const apiNames = new Set();
for (const root of ["src/plugins/_api", "src/equicordplugins/_api"]) {
    for (const entry of fs.readdirSync(root, {withFileTypes: true})) {
        const file = root + "/" + entry.name + (entry.isDirectory() ? "/index.ts" : "");
        const source = fs.existsSync(file) ? file : file.replace(/\.ts$/, ".tsx");
        if (fs.existsSync(source)) {
            const name = fs.readFileSync(source, "utf8").match(/\bname:\s*["']([^"']+)["']/);
            if (name) apiNames.add(name[1]);
        }
    }
}
assert.equal(new Set(all.map(p => p.name)).size, all.length);
assert.equal(all.some(p => p.name === "Quoter" || p.name === "bossclip" || p.name === "BossClip"), false);
for (const name of ["Reclip", "Quoter Enhanced", "BetterMicrophone", "PhilsPluginLibrary", "DontControlMe", "FollowUser", "PasscodeLock", "EvenClean"]) {
    assert.equal(all.filter(p => p.name === name).length, 1);
    assert.equal(own.find(p => p.name === name)?.source, "evencord");
}
assert.equal(all.find(p => p.name === "Reclip").target, "desktop");
const renderer = asar.extractFile("dist/desktop.asar", "renderer.js").toString();
const native = asar.extractFile("dist/desktop.asar", "patcher.js").toString();
for (const folder of ["src/evencordplugins/reclip.desktop", "src/evencordplugins/quoterEnhanced"])
    assert.ok(renderer.includes(folder), "Missing renderer provenance: " + folder);
assert.ok(!renderer.includes('folderName:"src/equicordplugins/quoter"'));
assert.ok(native.includes('"Quoter Enhanced":') && /\bReclip:/.test(native), "Missing native helpers");
assert.ok(renderer.includes("EvenCord Plugin") && renderer.includes("Show EvenCord"));
assert.ok(native.includes(fs.readFileSync("branding/assets/icon-256.png").toString("base64")), "About icon is not current");
for (const value of Object.values(require("../branding/project.json").colors))
    assert.ok(renderer.includes(value), "Missing compiled palette token: " + value);
for (const name of ["BetterMicrophone", "PhilsPluginLibrary", "DontControlMe", "FollowUser", "PasscodeLock", "EvenClean"]) {
    const plugin = own.find(p => p.name === name);
    assert.equal(plugin.enabledByDefault, false, name + " must require opt-in");
    for (const dependency of plugin.dependencies ?? []) assert.ok(all.some(p => p.name === dependency) || apiNames.has(dependency), "Missing dependency: " + dependency);
}
assert.ok(native.includes(require("../src/evencordplugins/betterMicrophone.desktop/native-assets.json").assets.addon.sha256), "Native addon pin is missing");
assert.ok(!native.includes("DiscordVoicePatcher/releases/latest"), "Unpinned native download remains");
console.log("Plugin names, override, provenance, native helpers, palette and packaged icon verified.");
