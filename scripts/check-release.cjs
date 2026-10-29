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
for (const [name, value] of Object.entries(project.capabilities)) assert.equal(value,["distribution","installation","repair","updates"].includes(name),"Unexpected beta capability: " + name);
assert.equal(project.release.channel,"beta");
assert.deepEqual(trust.channels,["beta"]);
assert.equal(Object.keys(trust.keys).length,1,"Beta requires one reviewed signing key.");
for (const key of Object.values(trust.keys)) assert.equal(Buffer.from(key,"base64").length,32);
if (process.argv[2]) {
    const peer = path.resolve(process.argv[2]);
    for (const name of ["project.json","trust.json","runtime.cjs","loader.cjs","host.cjs"]) {
        const normalize = file => fs.readFileSync(file,"utf8").replaceAll("\r\n","\n");
        assert.equal(normalize(path.join(__dirname,"../branding",name)),normalize(path.join(peer,"branding",name)),name+" differs across components");
    }
}
console.log("Release identities, shared protocol and managed beta activation verified.");
