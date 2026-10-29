/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const {test} = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const runtime = require("../branding/runtime.cjs");
const cache = path.resolve(__dirname, "../.cache/fixtures");
fs.mkdirSync(cache, {recursive: true});
function fixture(t) {
    const root = fs.mkdtempSync(path.join(cache, "release-"));
    t.after(() => { if (!root.startsWith(cache + path.sep)) throw Error("Unsafe cleanup"); fs.rmSync(root, {recursive: true}); });
    const {privateKey, publicKey} = crypto.generateKeyPairSync("ed25519");
    const trust = {keys: {test: publicKey.export({format: "der", type: "spki"}).subarray(-32).toString("base64")}, revoked: []};
    const bytes = Buffer.from("synthetic core");
    const manifest = {schemaVersion: 1, product: "evencord", component: "core", repository: "alrimii/evencord", repositoryId: 1438489516, channel: "stable", version: "1.0.0", sequence: 1, sourceCommit: "a".repeat(40), upstreamCommit: "b".repeat(40), platform: "win32", architecture: "x64", discordChannel: "stable", loaderProtocol: 1, publishedAt: new Date(Date.now() - 1000).toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString(), notes: "Fixture", discordArchives: ["c".repeat(64)], artifact: {name: "desktop.asar", size: bytes.length, sha256: runtime.sha(bytes)}};
    function sign(m = manifest) {
        const body = Buffer.from(JSON.stringify(m));
        return Buffer.from(JSON.stringify({keyId: "test", signed: body.toString("base64"), signature: crypto.sign(null, Buffer.concat([Buffer.from("EvenCord release v1\n"), body]), privateKey).toString("base64")}));
    }
    return {root, trust, bytes, manifest, sign};
}
test("valid release, independent identity and revocation", t => {
    const f = fixture(t);
    assert.equal(runtime.verify(f.sign(), f.trust).version, "1.0.0");
    for (const change of [{repository: "Equicord/Equicord"}, {repositoryId: 1}, {discordChannel: "canary"}, {component: "installer-cli"}, {version: "1.0.0-dev"}, {expiresAt: "2000-01-01T00:00:00Z"}, {sequence: -1}])
        assert.throws(() => runtime.verify(f.sign({...f.manifest, ...change}), f.trust));
    assert.throws(() => runtime.verify(f.sign(), {...f.trust, revoked: ["test"]}));
    assert.throws(() => runtime.verify(f.sign(), {keys: {}, revoked: []}));
    const env = JSON.parse(f.sign()); env.signature = Buffer.alloc(64).toString("base64");
    assert.throws(() => runtime.verify(Buffer.from(JSON.stringify(env)), f.trust));
});
test("verified updates preserve last build and settings", t => {
    const f = fixture(t);
    runtime.activate(f.root, f.sign(), f.bytes, f.trust);
    fs.writeFileSync(path.join(f.root, "settings.json"), "keep");
    const old = fs.readFileSync(path.join(f.root, "current.json"));
    const nextBytes = Buffer.from("new synthetic core");
    const next = {...f.manifest, version: "1.1.0", sequence: 2, artifact: {...f.manifest.artifact, size: nextBytes.length, sha256: runtime.sha(nextBytes)}};
    assert.throws(() => runtime.activate(f.root, f.sign(next), Buffer.from("bad"), f.trust));
    assert.deepEqual(fs.readFileSync(path.join(f.root, "current.json")), old);
    runtime.activate(f.root, f.sign(next), nextBytes, f.trust);
    assert.deepEqual(fs.readFileSync(path.join(f.root, "previous.json")), old);
    assert.equal(runtime.current(f.root, f.trust).manifest.version, "1.1.0");
    assert.equal(runtime.current(f.root, f.trust, "previous.json").manifest.version, "1.0.0");
    assert.throws(() => runtime.activate(f.root, f.sign(), f.bytes, f.trust));
    assert.equal(fs.readFileSync(path.join(f.root, "settings.json"), "utf8"), "keep");
});
test("interrupted operation lock fails without changing pointer", t => {
    const f = fixture(t); runtime.activate(f.root, f.sign(), f.bytes, f.trust);
    const old = fs.readFileSync(path.join(f.root, "current.json"));
    fs.writeFileSync(path.join(f.root, ".evencord-operation.lock"), "");
    assert.throws(() => runtime.activate(f.root, f.sign(), f.bytes, f.trust));
    assert.deepEqual(fs.readFileSync(path.join(f.root, "current.json")), old);
});
test("untrusted redirect destinations and malformed versions are rejected", () => {
    for (const url of ["http://github.com/x", "https://evil.example", "https://github.com.evil/x", "https://user@github.com/x"])
        assert.throws(() => runtime.safeURL(url));
    assert.equal(runtime.compare("1.10.0", "1.9.9"), 1);
    assert.throws(() => runtime.compare("1.4294967296.0", "1.0.0"));
});

test("failed startup falls back to prior verified payload", t => {
    const f = fixture(t); runtime.activate(f.root, f.sign(), f.bytes, f.trust);
    const first = runtime.beginBoot(f.root, f.trust);
    runtime.completeBoot(f.root, first.manifest.artifact.sha256);
    const bytes = Buffer.from("next payload");
    const next = {...f.manifest, version: "2.0.0", sequence: 2, artifact: {...f.manifest.artifact, size: bytes.length, sha256: runtime.sha(bytes)}};
    runtime.activate(f.root, f.sign(next), bytes, f.trust);
    assert.equal(runtime.beginBoot(f.root, f.trust).manifest.version, "2.0.0");
    assert.equal(runtime.beginBoot(f.root, f.trust).manifest.version, "1.0.0");
    runtime.completeBoot(f.root, f.manifest.artifact.sha256);
    assert.equal(runtime.beginBoot(f.root, f.trust).manifest.version, "1.0.0");
    assert.throws(() => runtime.activate(f.root, f.sign(next), bytes, f.trust));
});

test("host persistence shares directory loader contract and refuses foreign hosts", t => {
    const f = fixture(t), host = require("../branding/host.cjs");
    const loader = fs.readFileSync(path.join(__dirname, "../branding/loader.cjs"), "utf8").replaceAll("\r\n", "\n");
    const engine = fs.readFileSync(path.join(__dirname, "../branding/runtime.cjs"), "utf8").replaceAll("\r\n", "\n");
    const trustData = JSON.stringify(f.trust);
    const original = Buffer.from("approved host bootstrap");
    f.manifest.discordArchives = [runtime.sha(original)];
    const dataRoot = path.join(f.root, "data");
    runtime.activate(dataRoot, f.sign(), f.bytes, f.trust);
    function target(version) {
        const resources = path.join(f.root, "Discord", "app-" + version, "resources");
        fs.mkdirSync(resources, {recursive: true});
        const exe = Buffer.alloc(128);exe.write("MZ");exe.writeUInt32LE(64,60);exe.write("PE\0\0",64);exe.writeUInt16LE(0x8664,68);
        fs.writeFileSync(path.join(resources,"..","Discord.exe"),exe);
        fs.writeFileSync(path.join(resources,"build_info.json"),JSON.stringify({releaseChannel:"stable"}));
        fs.writeFileSync(path.join(resources,"app.asar"),original);
        return resources;
    }
    const source = target("1.0.1");
    const owner = {schemaVersion:1,product:"evencord",dataRoot,originalSHA256:runtime.sha(original),files:{"index.js":runtime.sha(loader),"runtime.cjs":runtime.sha(engine),"trust.json":runtime.sha(trustData)}};
    fs.renameSync(path.join(source,"app.asar"),path.join(source,"_app.asar"));
    fs.mkdirSync(path.join(source,"app.asar"));
    for (const [name,data] of Object.entries({"package.json":'{"name":"discord","main":"index.js"}',"index.js":loader,"runtime.cjs":engine,"trust.json":trustData,"evencord-owner.json":JSON.stringify(owner)}))
        fs.writeFileSync(path.join(source,"app.asar",name),data);
    fs.writeFileSync(path.join(source,"evencord-install.json"),JSON.stringify(owner));
    const older = target("1.0.0");
    assert.throws(() => host.persist(older,source,f.trust,loader,engine,trustData), /newer Discord/);
    assert.equal(fs.readFileSync(path.join(older,"app.asar"),"utf8"),original.toString());
    const next = target("1.0.2");
    assert.equal(host.persist(next,source,f.trust,loader,engine,trustData),true);
    assert.equal(host.ownership(next,loader,engine,trustData).originalSHA256,runtime.sha(original));
    const unknown = target("1.0.3");
    fs.writeFileSync(path.join(unknown,"app.asar"),"unknown modification");
    assert.throws(() => host.persist(unknown,source,f.trust,loader,engine,trustData));
    assert.equal(fs.readFileSync(path.join(unknown,"app.asar"),"utf8"),"unknown modification");
    const expired = {...f.manifest, publishedAt: new Date(Date.now()-86400000*2).toISOString(), expiresAt: new Date(Date.now()-86400000).toISOString()};
    fs.writeFileSync(path.join(dataRoot,"current.json"),f.sign(expired));
    const unapproved = target("1.0.5");
    assert.throws(() => host.persist(unapproved,source,f.trust,loader,engine,trustData), /expired/);
    assert.equal(fs.existsSync(path.join(unapproved,"_app.asar")),false);
    fs.writeFileSync(path.join(dataRoot,"current.json"),f.sign());
    const interrupted = target("1.0.4");
    assert.throws(() => host.persist(interrupted,source,f.trust,loader,engine,trustData,()=>{throw Error("interrupted")}));
    assert.equal(fs.readFileSync(path.join(interrupted,"_app.asar"),"utf8"),original.toString());
    assert.equal(JSON.parse(fs.readFileSync(path.join(interrupted,".evencord-transaction.json"))).operation,"install");
});

test("shared Go and Node signature vector", () => {
    const vector = require("./protocol-vector.json");
    assert.equal(runtime.verify(Buffer.from(JSON.stringify(vector.envelope)),vector.trust,"core",false).artifact.size,3);
});

test("beta versions and channel trust stay isolated", t => {
    const f = fixture(t);
    const beta = {...f.manifest, channel: "beta", version: "0.1.0-beta.1"};
    const trust = {...f.trust, channels: ["beta"]};
    assert.equal(runtime.verify(f.sign(beta), trust).version, beta.version);
    assert.throws(() => runtime.verify(f.sign(beta), f.trust));
    assert.throws(() => runtime.verify(f.sign(), trust));
    assert.ok(runtime.compare("0.1.0-beta.10", "0.1.0-beta.2") > 0);
    assert.ok(runtime.compare("0.1.0", "0.1.0-beta.10") > 0);
    assert.throws(() => runtime.compare("0.1.0-beta.01", "0.1.0-beta.1"));
    assert.throws(() => runtime.advance({...beta, channel: "stable", version: "0.1.0"}, beta));
});
