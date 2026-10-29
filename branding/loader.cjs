/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
"use strict";
const path = require("node:path");
const fs = require("original-fs");
const runtime = require("./runtime.cjs");
const owner = require("./evencord-owner.json");
const trust = require("./trust.json");
const selected = runtime.beginBoot(owner.dataRoot, trust);
if (selected) {
    process.env.EVENCORD_USER_DATA_DIR = owner.dataRoot;
    process.env.EVENCORD_MANAGED_ROOT = owner.dataRoot;
    process.env.EVENCORD_RUNNING_RELEASE = selected.data.toString("base64");
    require(runtime.payloadPath(owner.dataRoot, selected.manifest));
} else {
    const original = path.join(__dirname, "..", "_app.asar");
    if (runtime.sha(fs.readFileSync(original)) !== owner.originalSHA256) throw new Error("EvenCord recovery archive has changed. Use installer recovery.");
    const pkg = require(path.join(original, "package.json"));
    require("electron").app.setAppPath(original);
    require.main.filename = path.join(original, pkg.main);
    require(require.main.filename);
}
