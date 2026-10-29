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
assert.equal(new Set(all.map(p => p.name)).size, all.length);
assert.equal(all.some(p => p.name === "Quoter" || p.name === "bossclip" || p.name === "BossClip"), false);
for (const name of ["Reclip", "Quoter Enhanced"]) {
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
console.log("Plugin names, override, provenance, native helpers, palette and packaged icon verified.");
