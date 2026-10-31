/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
"use strict";
const path = require("node:path");
let fs;
try { fs = require("original-fs"); } catch { fs = require("node:fs"); }
const runtime = require("./runtime.cjs");
const trust = require("./trust.json");
function migrate({resources, root, payload}) {
    runtime.safePath(resources); runtime.safePath(root);
    const record = path.join(resources, "..", "evencord-install.json");
    const owner = JSON.parse(fs.readFileSync(record, "utf8"));
    if (owner.product !== "evencord" || path.resolve(owner.dataRoot) !== path.resolve(root)) throw Error("The legacy loader belongs to another profile.");
    const manifest = runtime.verify(Buffer.from(process.env.EVENCORD_RUNNING_RELEASE, "base64"), trust, "core", false);
    runtime.checkedFile(payload, manifest.artifact);
    const original = path.join(resources, "..", "_app.asar");
    if (runtime.sha(fs.readFileSync(original)) !== owner.originalSHA256) throw Error("The original Discord archive has changed.");
    runtime.completeBoot(root, manifest.artifact.sha256);
    const target = path.join(root, "evencord.asar");
    runtime.atomic(target, fs.readFileSync(payload));
    const index = `process.env.EVENCORD_USER_DATA_DIR=${JSON.stringify(root)};require(${JSON.stringify(path.join(target, "patcher.js"))});`;
    runtime.atomic(path.join(resources, "index.js"), index);
    fs.renameSync(record, path.join(resources, "..", "evencord-legacy-install.json"));
    delete process.env.EVENCORD_MANAGED_ROOT;
    delete process.env.EVENCORD_RUNNING_RELEASE;
}
module.exports = {migrate};
