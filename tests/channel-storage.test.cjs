/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const esbuild = require("esbuild");
const vm = require("node:vm");
test("channel browser storage is isolated while Stable keeps its existing namespace", () => {
    const result = esbuild.buildSync({ entryPoints: ["src/shared/project.ts"], bundle: true, write: false, platform: "node", format: "cjs", define: { IS_WEB: "false", IS_REPORTER: "false", IS_DEV: "false" } });
    const names = [];
    for (const channel of ["stable", "ptb", "canary"]) {
        const context = { module: { exports: {} }, VencordNative: { settings: { getHostChannel: () => channel } } };
        vm.runInNewContext(result.outputFiles[0].text, context);
        names.push(context.module.exports.storageName("plugin-data"));
    }
    assert.equal(names[0], "evencord:beta:plugin-data");
    assert.equal(new Set(names).size, 3);
});
