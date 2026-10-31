/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const esbuild = require("esbuild");

async function fixture(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "evencord-updater-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const payload = Buffer.from("verified fixture payload");
    let downloads = 0;
    let bytes = payload;
    const release = {
        tag_name: "core-v1.1.1", body: "Upstream update", target_commitish: "a".repeat(40),
        assets: [{ name: "desktop.asar", size: payload.length, digest: "sha256:" + crypto.createHash("sha256").update(payload).digest("hex"), browser_download_url: "https://github.com/alrimii/evencord/releases/download/core-v1.1.1/desktop.asar" }]
    };
    const result = await esbuild.build({
        entryPoints: [path.resolve(__dirname, "../src/main/updater/http.ts")], bundle: true, write: false, platform: "node", format: "cjs",
        define: { VERSION: '"1.1.0"', IS_DISCORD_DESKTOP: "true", IS_VESKTOP: "false", IS_EQUIBOP: "false", IS_UPDATER_DISABLED: "false" },
        plugins: [{ name: "fixtures", setup(build) {
            build.onResolve({ filter: /^(?:@main\/utils\/(?:constants|http)|@shared\/(?:project|vencordUserAgent)|~git-remote|original-fs)$/ }, ({ path }) => ({ path, namespace: "fixture" }));
            build.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path: name }) => {
                const sources = {
                    "@main/utils/constants": `export const DATA_DIR=${JSON.stringify(root)}`,
                    "@main/utils/http": "export const fetchJson=()=>globalThis.__fixture.release; export const checkedFetch=()=>globalThis.__fixture.download()",
                    "@shared/project": 'export const Project={storage:{payload:"evencord.asar"},release:{coreAsset:"desktop.asar"}}',
                    "@shared/vencordUserAgent": 'export const VENCORD_USER_AGENT="Fixture"',
                    "~git-remote": 'export default "alrimii/evencord"',
                    "original-fs": 'export * from "node:fs"'
                };
                return { contents: sources[name] };
            });
        } }]
    });
    globalThis.__fixture = { release, download() { downloads++; return new Response(bytes); } };
    t.after(() => { delete globalThis.__fixture; });
    const module = { exports: {} };
    new Function("require", "module", "exports", "__dirname", result.outputFiles[0].text)(require, module, module.exports, root);
    const target = path.join(root, "evencord.asar");
    fs.writeFileSync(target, "previous payload");
    return { updater: module.exports.default, status: module.exports.getUpdateStatus, restart: module.exports.prepareUpdateRestart, release, payload, target, tamper(value) { bytes = value; }, downloads: () => downloads };
}

test("verified update stages a versioned payload without replacing the running archive", async t => {
    const f = await fixture(t);
    assert.equal((await f.updater.listUpdates()).length, 1);
    assert.equal(await f.restart(), false);
    assert.deepEqual(await Promise.all([f.updater.applyUpdate(), f.updater.applyUpdate()]), [true, true]);
    assert.equal(f.downloads(), 1);
    assert.equal(fs.readFileSync(f.target, "utf8"), "previous payload");
    const activation = JSON.parse(fs.readFileSync(path.join(path.dirname(f.target), "current-core.json"), "utf8"));
    assert.equal(activation.version, "1.1.1");
    assert.equal(activation.size, f.payload.length);
    assert.equal(activation.sha256, crypto.createHash("sha256").update(f.payload).digest("hex"));
    assert.deepEqual(fs.readFileSync(path.join(path.dirname(f.target), "releases", activation.sha256 + ".asar")), f.payload);
    assert.equal(f.status().phase, "ready");
    assert.equal(await f.restart(), true);
    assert.equal(await f.updater.applyUpdate(), true);
    assert.equal(f.downloads(), 1);
});

test("damaged and oversized downloads preserve the working payload", async t => {
    for (const oversized of [false, true]) {
        const f = await fixture(t);
        await f.updater.listUpdates();
        f.tamper(Buffer.alloc(f.payload.length + (oversized ? 1 : 0)));
        await assert.rejects(f.updater.applyUpdate(), oversized ? /published size/ : /digest/);
        assert.equal(fs.readFileSync(f.target, "utf8"), "previous payload");
        assert.equal(await f.restart(), false);
    }
});

test("current and older releases never download or downgrade", async t => {
    const f = await fixture(t);
    for (const tag of ["core-v1.1.0", "core-v1.0.6"]) {
        f.release.tag_name = tag;
        assert.deepEqual(await f.updater.listUpdates(), []);
        assert.equal(await f.updater.applyUpdate(), false);
    }
    assert.equal(f.downloads(), 0);
});

test("foreign payload URLs and missing digests are rejected", async t => {
    const f = await fixture(t);
    f.release.assets[0].browser_download_url = "https://github.com/Equicord/Equicord/releases/download/latest/desktop.asar";
    await assert.rejects(f.updater.listUpdates(), /another repository/);
    f.release.assets[0].digest = "";
    await assert.rejects(f.updater.listUpdates(), /digest/);
    assert.equal(f.downloads(), 0);
});
