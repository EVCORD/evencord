/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const project = require("../branding/project.json"), trust = require("../branding/trust.json");
assert.equal(project.id,"evencord");
assert.equal(project.repositories.core.slug,"alrimii/evencord");
assert.equal(project.repositories.installer.slug,"alrimii/evencord-installer");
assert.equal(trust.schemaVersion,1);
for (const value of Object.values(project.capabilities)) assert.equal(value,false,"Production activation requires a separate reviewed change.");
assert.equal(Object.keys(trust.keys).length,0,"Production key enrollment requires a separate review.");
if (process.argv[2]) {
    const peer = path.resolve(process.argv[2]);
    for (const name of ["project.json","trust.json","runtime.cjs","loader.cjs","host.cjs"]) {
        const normalize = file => fs.readFileSync(file,"utf8").replaceAll("\r\n","\n");
        assert.equal(normalize(path.join(__dirname,"../branding",name)),normalize(path.join(peer,"branding",name)),name+" differs across components");
    }
}
console.log("Release identities, shared protocol and disabled production activation verified.");
