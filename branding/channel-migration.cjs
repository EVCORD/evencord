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
const host = require("./host.cjs");
const json = value => JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, char => "\\u" + char.charCodeAt(0).toString(16).padStart(4, "0"));

function migrate(resources, loader, engine, legacyTrust, trustData, afterStep = () => {}) {
    host.validate(resources);
    const journal = path.join(resources, ".evencord-trust-migration.json");
    runtime.safePath(journal);
    if (!fs.existsSync(journal)) {
        try { return host.ownership(resources, loader, engine, trustData); }
        catch { host.ownership(resources, loader, engine, legacyTrust); }
    }
    const lock = path.join(resources, ".evencord-operation.lock");
    const fd = fs.openSync(lock, "wx");
    try {
        let owner;
        if (fs.existsSync(journal)) {
            const record = JSON.parse(fs.readFileSync(journal, "utf8"));
            if (record.operation !== "trust") throw Error("Unknown loader migration.");
            owner = record.owner;
        } else {
            owner = host.ownership(resources, loader, engine, legacyTrust);
        }
        if (owner.schemaVersion !== 1 || owner.product !== "evencord" || !path.isAbsolute(owner.dataRoot) || !/^[a-f0-9]{64}$/.test(owner.originalSHA256)
            || Object.keys(owner.files).length !== 3 || owner.files["index.js"] !== runtime.sha(loader) || owner.files["runtime.cjs"] !== runtime.sha(engine) || owner.files["trust.json"] !== runtime.sha(legacyTrust))
            throw Error("Unknown legacy loader ownership.");
        const next = {...owner, files: {...owner.files, "trust.json": runtime.sha(trustData)}};
        const app = path.join(resources, "app.asar"), record = path.join(resources, "evencord-install.json");
        const files = {"package.json": ['{"name":"discord","main":"index.js"}'], "index.js": [loader], "runtime.cjs": [engine], "trust.json": [legacyTrust, trustData], "evencord-owner.json": [json(owner), json(next)]};
        runtime.safePath(app);
        runtime.safePath(record);
        if (fs.readdirSync(app).length !== Object.keys(files).length) throw Error("Unknown loader files block migration.");
        for (const [name, choices] of Object.entries(files)) {
            const file = path.join(app, name);
            runtime.safePath(file);
            if (!choices.some(data => fs.readFileSync(file).equals(Buffer.from(data)))) throw Error("Loader changed during migration: " + name);
        }
        const outer = fs.readFileSync(record);
        if (![json(owner), json(next)].some(data => outer.equals(Buffer.from(data)))) throw Error("Ownership changed during migration.");
        const original = path.join(resources, "_app.asar");
        runtime.safePath(original);
        if (runtime.sha(fs.readFileSync(original)) !== owner.originalSHA256) throw Error("Recovery archive changed.");
        if (!fs.existsSync(journal)) runtime.atomic(journal, json({operation:"trust", owner}));
        runtime.atomic(path.join(app, "trust.json"), trustData); afterStep("trust");
        runtime.atomic(path.join(app, "evencord-owner.json"), json(next)); afterStep("inner-owner");
        runtime.atomic(record, json(next)); afterStep("outer-owner");
        host.ownership(resources, loader, engine, trustData);
        fs.unlinkSync(journal);
        return next;
    } finally { fs.closeSync(fd); fs.unlinkSync(lock); }
}
module.exports = {migrate};
