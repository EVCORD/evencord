/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), vm = require("node:vm"), esbuild = require("esbuild");
test("automatic checks start, repeat, retry and retain background notifications until focus", async () => {
    const source = fs.readFileSync("src/Vencord.ts","utf8");
    const logic = source.slice(source.indexOf("let notifiedUpdate"),source.indexOf("async function init()"));
    const begin = source.indexOf("    if (!IS_DEV && !IS_WEB && !IS_UPDATER_DISABLED) {");
    const schedule = source.slice(begin,source.indexOf("    if (IS_DEV) {",begin));
    const code = esbuild.transformSync(logic+schedule,{loader:"ts",target:"esnext"}).code;
    let focused = false, now = 1000, fail = false, calls = 0;
    const timers=[], intervals=[], events={}, notices=[];
    const context={
        IS_DEV:false,IS_WEB:false,IS_UPDATER_DISABLED:false,
        document:{hasFocus:()=>focused}, window:{addEventListener:(name,fn)=>{events[name]=fn;}},
        Date:{now:()=>now}, setTimeout:(fn,delay)=>{timers.push({fn,delay});return timers.length;},clearTimeout:()=>{},setInterval:(fn,delay)=>intervals.push({fn,delay}),
        checkForUpdates:async()=>{calls++;if(fail)throw Error("offline");return true;},
        getUpdateStatus:async()=>({phase:"available",availableVersion:"0.1.0-beta.99"}),
        Settings:{autoUpdate:false}, UpdaterTab:{},UpdateLogger:{error:()=>{}},openSettingsTabModal:()=>{},
        showNotification:data=>notices.push(data)
    };
    vm.createContext(context);vm.runInContext(code,context);
    assert.equal(timers[0].delay,5000);assert.equal(intervals[0].delay,15*60_000);
    await timers[0].fn(); assert.equal(calls,1);assert.equal(notices.length,0);
    focused=true;events.focus();await timers.find(t=>t.delay===0).fn();
    assert.equal(notices.length,1);assert.equal(notices[0].useNative,false);
    assert.equal(calls,1,"focus must not cause repeated network checks");
    now+=11*60_000; events.focus();await new Promise(r=>setImmediate(r)); assert.equal(calls,2);
    fail=true; await intervals[0].fn();assert.ok(timers.some(t=>t.delay===60_000));
    await vm.runInContext("runUpdateCheck()",context);assert.ok(timers.some(t=>t.delay===120_000));
});
