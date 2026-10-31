/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const vm = require("node:vm");
const crypto = require("node:crypto");
const runtime = require("../branding/runtime.cjs");

function fixture(t) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "evencord-transition-"));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const root = path.join(directory, "profile");
    const resources = path.join(directory, "resources", "app.asar");
    fs.mkdirSync(root, { recursive: true });
    fs.mkdirSync(resources, { recursive: true });
    const payload = path.join(root, "signed.asar");
    const bytes = Buffer.from("signed transition payload");
    const original = Buffer.from("original Discord archive");
    fs.writeFileSync(payload, bytes);
    fs.writeFileSync(path.join(resources, "..", "_app.asar"), original);
    fs.writeFileSync(path.join(resources, "index.js"), "legacy loader");
    fs.writeFileSync(path.join(root, "settings.json"), "private settings fixture");
    const record = path.join(resources, "..", "evencord-install.json");
    fs.writeFileSync(record, JSON.stringify({ schemaVersion: 1, product: "evencord", dataRoot: root, originalSHA256: runtime.sha(original) }));
    const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
    const trust = { keys: { fixture: publicKey.export({ format: "der", type: "spki" }).subarray(-32).toString("base64") }, revoked: [] };
    const manifest = { schemaVersion: 1, product: "evencord", component: "core", repository: "alrimii/evencord", repositoryId: 1438489516, channel: "stable", version: "1.1.0", sequence: 100, sourceCommit: "a".repeat(40), upstreamCommit: "b".repeat(40), platform: "win32", architecture: "x64", discordChannel: "stable", loaderProtocol: 1, publishedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 86400000).toISOString(), notes: "Transition fixture", discordArchives: [runtime.sha(original)], artifact: { name: "desktop.asar", size: bytes.length, sha256: runtime.sha(bytes) } };
    const body = Buffer.from(JSON.stringify(manifest));
    const envelope = Buffer.from(JSON.stringify({ keyId: "fixture", signed: body.toString("base64"), signature: crypto.sign(null, Buffer.concat([Buffer.from("EvenCord release v1\n"), body]), privateKey).toString("base64") }));
    const env = { EVENCORD_RUNNING_RELEASE: envelope.toString("base64") };
    fs.writeFileSync(path.join(root, "booting.json"), JSON.stringify({ sha256: manifest.artifact.sha256 }));
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, "../branding/upstream-migration.cjs"), "utf8"), {
        module, Buffer, process: { env }, require(name) {
            if (name === "./runtime.cjs") return runtime;
            if (name === "./trust.json") return trust;
            if (name === "original-fs") return fs;
            return require(name);
        }
    });
    return { migrate: () => module.exports.migrate({ resources, root, payload }), root, resources, payload, bytes, original, record, env };
}

test("signed legacy profile transitions to the normal loader and preserves settings and Discord", t => {
    const f = fixture(t);
    f.migrate();
    assert.deepEqual(fs.readFileSync(path.join(f.root, "evencord.asar")), f.bytes);
    assert.deepEqual(fs.readFileSync(path.join(f.resources, "..", "_app.asar")), f.original);
    assert.equal(fs.readFileSync(path.join(f.root, "settings.json"), "utf8"), "private settings fixture");
    assert.equal(fs.existsSync(f.record), false);
    assert.equal(fs.existsSync(path.join(f.root, "booting.json")), false);
    let loaded;
    const process = { env: {} };
    vm.runInNewContext(fs.readFileSync(path.join(f.resources, "index.js"), "utf8"), { process, require(value) { loaded = value; } });
    assert.equal(loaded, path.join(f.root, "evencord.asar", "patcher.js"));
    assert.equal(process.env.EVENCORD_USER_DATA_DIR, f.root);
});

test("changed Discord archive or payload cannot change the legacy loader", t => {
    for (const file of ["payload", "original"]) {
        const f = fixture(t);
        fs.writeFileSync(file === "payload" ? f.payload : path.join(f.resources, "..", "_app.asar"), "changed");
        assert.throws(f.migrate, /changed|mismatch/i);
        assert.equal(fs.readFileSync(path.join(f.resources, "index.js"), "utf8"), "legacy loader");
        assert.equal(fs.existsSync(f.record), true);
    }
});

test("untrusted transition metadata cannot replace the loader", t => {
    const f = fixture(t);
    const envelope = JSON.parse(Buffer.from(f.env.EVENCORD_RUNNING_RELEASE, "base64"));
    envelope.signature = Buffer.alloc(64).toString("base64");
    f.env.EVENCORD_RUNNING_RELEASE = Buffer.from(JSON.stringify(envelope)).toString("base64");
    assert.throws(f.migrate, /signature/);
    assert.equal(fs.readFileSync(path.join(f.resources, "index.js"), "utf8"), "legacy loader");
});
