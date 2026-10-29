/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

"use strict";
let fs;
try { fs = require("original-fs"); } catch { fs = require("node:fs"); }
const path = require("node:path");
const runtime = require("./runtime.cjs");
const goJSON = value => JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, char => "\\u" + char.charCodeAt(0).toString(16).padStart(4, "0"));
function validate(resources) {
    runtime.safePath(resources);
    if (path.basename(resources) !== "resources" || !/^app-\d+\.\d+\.\d+$/.test(path.basename(path.dirname(resources)))) throw new Error("Unsupported Discord layout.");
    const info = JSON.parse(fs.readFileSync(path.join(resources, "build_info.json"), "utf8"));
    const executable = {stable: "Discord.exe", ptb: "DiscordPTB.exe", canary: "DiscordCanary.exe"}[info.releaseChannel];
    if (!executable) throw new Error("Unsupported Discord channel.");
    const exe = fs.readFileSync(path.join(resources, "..", executable));
    if (exe.length < 64 || exe.toString("ascii", 0, 2) !== "MZ") throw new Error("Invalid Discord executable.");
    const offset = exe.readUInt32LE(60);
    if (offset < 64 || offset > exe.length - 6 || exe.toString("ascii", offset, offset + 4) !== "PE\0\0" || exe.readUInt16LE(offset + 4) !== 0x8664) throw new Error("Windows x64 Discord is required.");
    if (fs.existsSync(path.join(resources, "app"))) throw new Error("Another app loader is present.");
    return info.releaseChannel;
}
function ownership(resources, loader, engine, trustData) {
    validate(resources);
    runtime.safePath(path.join(resources, "evencord-install.json"));
    const owner = JSON.parse(fs.readFileSync(path.join(resources, "evencord-install.json"), "utf8"));
    if (owner.schemaVersion !== 1 || owner.product !== "evencord" || !path.isAbsolute(owner.dataRoot)) throw new Error("Unknown loader ownership.");
    if (owner.files["index.js"] !== runtime.sha(loader) || owner.files["runtime.cjs"] !== runtime.sha(engine) || owner.files["trust.json"] !== runtime.sha(trustData)) throw new Error("Loader identity differs.");
    const files = {"package.json": '{"name":"discord","main":"index.js"}', "index.js": loader, "runtime.cjs": engine, "trust.json": trustData, "evencord-owner.json": goJSON(owner)};
    const directory = path.join(resources, "app.asar");
    runtime.safePath(directory);
    if (fs.readdirSync(directory).length !== Object.keys(files).length) throw new Error("Unknown loader files.");
    for (const [name, value] of Object.entries(files)) {
        runtime.safePath(path.join(directory, name));
        if (!fs.readFileSync(path.join(directory, name)).equals(Buffer.from(value))) throw new Error("Loader contents changed.");
    }
    runtime.safePath(path.join(resources, "_app.asar"));
    if (runtime.sha(fs.readFileSync(path.join(resources, "_app.asar"))) !== owner.originalSHA256) throw new Error("Recovery archive missing or changed.");
    return owner;
}
function persist(resources, source, trust, loader, engine, trustData, afterStep = () => {}) {
    validate(resources);
    if (path.resolve(resources) === path.resolve(source) || path.dirname(resources) === path.dirname(source)) throw new Error("A different host version is required.");
    if (path.dirname(path.dirname(resources)) !== path.dirname(path.dirname(source))) throw new Error("Target belongs to another Discord installation.");
    if (runtime.compare(path.basename(path.dirname(resources)).slice(4), path.basename(path.dirname(source)).slice(4)) <= 0) throw new Error("Host persistence requires a newer Discord version.");
    const owner = ownership(source, loader, engine, trustData);
    const release = runtime.current(owner.dataRoot, trust);
    runtime.verify(release.data, trust, "core", true);
    const app = path.join(resources, "app.asar"), backup = path.join(resources, "_app.asar");
    if (fs.existsSync(path.join(resources, "evencord-install.json"))) {
        const existing = ownership(resources, loader, engine, trustData);
        if (path.resolve(existing.dataRoot) !== path.resolve(owner.dataRoot)) throw new Error("Target uses another EvenCord data root.");
        return false;
    }
    if (fs.existsSync(backup) || fs.existsSync(path.join(resources, ".evencord-transaction.json"))) throw new Error("Modification or unfinished transaction detected.");
    runtime.safePath(app);
    if (!fs.lstatSync(app).isFile()) throw new Error("Unknown loader.");
    const original = runtime.sha(fs.readFileSync(app));
    if (!release.manifest.discordArchives.includes(original)) throw new Error("Discord archive is not approved by the signed release.");
    const lock = path.join(resources, ".evencord-operation.lock");
    const fd = fs.openSync(lock, "wx");
    try {
        const stage = path.join(resources, ".evencord-loader");
        fs.mkdirSync(stage);
        const next = {...owner, originalSHA256: original};
        const files = {"package.json": '{"name":"discord","main":"index.js"}', "index.js": loader, "runtime.cjs": engine, "trust.json": trustData, "evencord-owner.json": goJSON(next)};
        for (const [name, value] of Object.entries(files)) runtime.atomic(path.join(stage, name), value);
        runtime.atomic(path.join(resources, ".evencord-transaction.json"), goJSON({operation: "install", owner: next}));
        fs.renameSync(app, backup);
        afterStep("original-preserved");
        fs.renameSync(stage, app);
        afterStep("loader-activated");
        runtime.atomic(path.join(resources, "evencord-install.json"), goJSON(next));
        fs.unlinkSync(path.join(resources, ".evencord-transaction.json"));
        return true;
    } finally { fs.closeSync(fd); fs.unlinkSync(lock); }
}
module.exports = {validate, ownership, persist};
