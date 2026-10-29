/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { PassThrough } = require("node:stream");
const { EventEmitter } = require("node:events");
const runtime = require("../branding/runtime.cjs");
const { createUpdater, downloadArtifact } = require("../branding/managed-updater.cjs");
function fixture(t) {
    const cache = path.resolve(__dirname, "../.cache/fixtures");
    fs.mkdirSync(cache, { recursive: true });
    const root = fs.mkdtempSync(path.join(cache, "managed-"));
    t.after(() => { assert.ok(root.startsWith(cache + path.sep)); fs.rmSync(root, { recursive: true }); });
    const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
    const trust = { keys: { fixture: publicKey.export({ format: "der", type: "spki" }).subarray(-32).toString("base64") }, revoked: [], channels: ["beta"] };
    function release(sequence) {
        const bytes = Buffer.from("fixture payload " + sequence);
        const manifest = { schemaVersion: 1, product: "evencord", component: "core", repository: "alrimii/evencord", repositoryId: 1438489516, channel: "beta", version: "0.1.0-beta." + sequence, sequence, sourceCommit: String(sequence).repeat(40), upstreamCommit: "a".repeat(40), platform: "win32", architecture: "x64", discordChannel: "stable", loaderProtocol: 1, publishedAt: new Date(Date.now() - 1000).toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString(), notes: "Focused fixture", discordArchives: ["b".repeat(64)], artifact: { name: "desktop.asar", size: bytes.length, sha256: runtime.sha(bytes) } };
        return { bytes, manifest, envelope: sign(manifest) };
    }
    function sign(manifest) {
        const body = Buffer.from(JSON.stringify(manifest));
        return Buffer.from(JSON.stringify({ keyId: "fixture", signed: body.toString("base64"), signature: crypto.sign(null, Buffer.concat([Buffer.from("EvenCord release v1\n"), body]), privateKey).toString("base64") }));
    }
    const old = release(1), next = release(2);
    runtime.activate(root, old.envelope, old.bytes, trust);
    fs.mkdirSync(path.join(root, "settings"));
    fs.writeFileSync(path.join(root, "settings/settings.json"), "personal settings preserved");
    const context = { root, envelope: old.envelope, payload: runtime.payloadPath(root, old.manifest), sourceCommit: old.manifest.sourceCommit, originalHash: "b".repeat(64) };
    const make = overrides => createUpdater({ trust, context: () => context, latest: async () => next.envelope, download: async (_url, size, progress) => { progress(size, size); return next.bytes; }, ...overrides });
    return { root, trust, old, next, context, make, sign, release };
}
test("signed installed identity, staged progress, restart state and settings preservation", async t => {
    const f = fixture(t); let observed;
    const updater = f.make({ download: async (_url, size, progress) => {
        progress(5, size); observed = updater.status(); return f.next.bytes;
    } });
    assert.equal(updater.status().installedVersion, f.old.manifest.version);
    assert.equal(updater.status().keyId, "fixture");
    assert.equal((await updater.check()).version, f.next.manifest.version);
    assert.equal(await updater.apply(), true);
    assert.equal(observed.phase, "downloading"); assert.equal(observed.received, 5);
    assert.equal(updater.status().phase, "ready");
    assert.equal(f.make().status().phase, "ready", "renderer reload preserves staged status");
    assert.equal(runtime.current(f.root, f.trust, "previous.json").manifest.version, f.old.manifest.version);
    assert.equal(fs.readFileSync(path.join(f.root, "settings/settings.json"), "utf8"), "personal settings preserved");
    f.context.envelope = f.next.envelope; f.context.payload = runtime.payloadPath(f.root, f.next.manifest); f.context.sourceCommit = f.next.manifest.sourceCommit;
    const restarted = f.make(); assert.equal(await restarted.check(), undefined); assert.equal(restarted.status().phase, "current");
});
test("wrong signature, key, repository, running source and unsupported host fail closed", async t => {
    const f = fixture(t);
    const bad = JSON.parse(f.next.envelope); bad.signature = Buffer.alloc(64).toString("base64");
    for (const envelope of [Buffer.from(JSON.stringify(bad)), f.sign({ ...f.next.manifest, repository: "Equicord/Equicord" }), f.sign({ ...f.next.manifest, discordArchives: ["c".repeat(64)] })]) {
        const updater = f.make({ latest: async () => envelope });
        await assert.rejects(updater.check()); assert.equal(updater.status().phase, "error");
    }
    await assert.rejects(f.make({ trust: { ...f.trust, keys: {} } }).check(), /not trusted/);
    f.context.sourceCommit = "e".repeat(40);
    await assert.rejects(f.make().check(), /signed release identity/);
    assert.equal(runtime.current(f.root, f.trust).manifest.version, f.old.manifest.version);
});
test("interrupted or corrupt download never reports ready or replaces current", async t => {
    const f = fixture(t);
    for (const download of [async () => { throw Error("Interrupted"); }, async () => Buffer.from("tampered")]) {
        const updater = f.make({ download }); await updater.check();
        await assert.rejects(updater.apply()); assert.equal(updater.status().phase, "error");
        assert.equal(runtime.current(f.root, f.trust).manifest.version, f.old.manifest.version);
    }
});
test("host change during download and concurrent operations preserve installed payload", async t => {
    const f = fixture(t);
    const updater = f.make({ download: async () => { f.context.originalHash = "d".repeat(64); return f.next.bytes; } });
    await updater.check(); await assert.rejects(updater.apply(), /does not support/);
    assert.equal(runtime.current(f.root, f.trust).manifest.version, f.old.manifest.version);
    f.context.originalHash = "b".repeat(64);
    const retry = f.make(); await retry.check();
    const results = await Promise.all([retry.apply(), retry.check()]);
    assert.equal(results[0], true); assert.equal(retry.status().phase, "ready");
});
test("failed startup recovers to prior build and only a newer release can supersede it", async t => {
    const f = fixture(t), updater = f.make(); await updater.check(); await updater.apply();
    runtime.beginBoot(f.root, f.trust);
    assert.equal(runtime.beginBoot(f.root, f.trust).manifest.version, f.old.manifest.version);
    runtime.completeBoot(f.root, f.old.manifest.artifact.sha256);
    const failed = f.make(); await assert.rejects(failed.check(), /previously failed/); assert.notEqual(failed.status().phase, "ready");
    const newer = f.release(3);
    const recovery = f.make({ latest: async () => newer.envelope, download: async () => newer.bytes });
    await recovery.check(); await recovery.apply();
    assert.equal(recovery.status().phase, "ready");
    assert.equal(runtime.current(f.root, f.trust, "previous.json").manifest.version, f.old.manifest.version);
});
test("update lock and tampered staged payload are not reported as ready", async t => {
    const f = fixture(t), updater = f.make(); await updater.check();
    const lock = path.join(f.root, ".evencord-operation.lock"); fs.writeFileSync(lock, "fixture");
    await assert.rejects(updater.apply()); assert.notEqual(updater.status().phase, "ready"); fs.unlinkSync(lock);
    await updater.check(); await updater.apply();
    fs.writeFileSync(runtime.payloadPath(f.root, f.next.manifest), "tampered");
    await assert.rejects(updater.apply()); assert.equal(updater.status().phase, "error");
});
function response(body, headers = {}, code = 200) {
    return (_url, _options, callback) => {
        const req = new EventEmitter(); req.destroy = error => { req.emit("error", error); req.emit("close"); };
        process.nextTick(() => {
            const res = new PassThrough(); res.headers = headers; res.statusCode = code;
            res.on("close", () => req.emit("close")); callback(res); res.end(body);
        });
        return req;
    };
}
test("bounded downloader rejects redirects, incorrect lengths and truncated bodies", async () => {
    const url = "https://github.com/alrimii/evencord/releases/download/core-v0.1.0-beta.2/desktop.asar";
    let count = 0;
    assert.equal((await downloadArtifact(url, 3, n => { count = n; }, response("abc"))).toString(), "abc"); assert.equal(count, 3);
    await assert.rejects(downloadArtifact(url, 3, () => {}, response("ab")), /incomplete/);
    await assert.rejects(downloadArtifact(url, 3, () => {}, response("abcd")), /exceeds/);
    await assert.rejects(downloadArtifact(url, 3, () => {}, response("abc", { "content-length": "4" })), /size/);
    await assert.rejects(downloadArtifact(url, 3, () => {}, response("", { location: "https://evil.example/payload" }, 302)), /Unapproved/);
});
