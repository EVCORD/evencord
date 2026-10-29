/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const esbuild = require("esbuild");

test("plugin import preserves general preferences and rejects invalid or unsafe maps", async () => {
    const result = await esbuild.build({
        entryPoints: ["src/api/SettingsSync/offline.ts"], bundle: true, write: false, platform: "node", format: "cjs",
        plugins: [{ name: "fixture-dependencies", setup(build) {
            build.onResolve({ filter: /^@|^\.\.$/ }, args => ({ path: args.path, namespace: "fixture" }));
            build.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: `
                export const PlainSettings = globalThis.fixtureSettings;
                export const Logger = class { warn() {} error() {} };
                export const DataStore = {};
                export const chooseFile = () => {};
                export const saveFile = () => {};
                export const moment = () => {};
                export const showToast = () => {};
            ` }));
        } }]
    });
    const settings = { autoUpdate: true, cloud: { settingsSync: false }, plugins: { Existing: { enabled: true } } };
    let saved = 0;
    const context = { module: { exports: {} }, fixtureSettings: settings, console, VencordNative: { settings: { set: async () => { saved++; } } } };
    vm.runInNewContext(result.outputFiles[0].text, context);
    const { importSettings } = context.module.exports;
    await importSettings(JSON.stringify({ settings: { autoUpdate: false, cloud: { settingsSync: true }, plugins: { NewPlugin: { enabled: true } } } }), "plugins");
    assert.equal(settings.autoUpdate, true);
    assert.equal(settings.cloud.settingsSync, false);
    assert.equal(settings.plugins.Existing.enabled, true);
    assert.equal(settings.plugins.NewPlugin.enabled, true);
    assert.equal(saved, 1);
    for (const plugins of [null, [], "invalid"])
        await assert.rejects(importSettings(JSON.stringify({ settings: { plugins } }), "plugins"), /missing/);
    await assert.rejects(importSettings('{"settings":{"plugins":{"__proto__":{"polluted":true}}}}', "plugins"), /Unsafe/);
    assert.equal(saved, 1);
});
