/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
const {test} = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm"), esbuild = require("esbuild");
test("update restart does not relaunch Discord when host preparation fails", async () => {
    const code = esbuild.buildSync({entryPoints:["src/utils/updater.ts"],bundle:true,write:false,platform:"node",format:"cjs",define:{IS_DISCORD_DESKTOP:"true",IS_VESKTOP:"false",IS_EQUIBOP:"false",IS_WEB:"false",IS_UPDATER_DISABLED:"false",IS_DEV:"false"}}).outputFiles[0].text;
    let relaunches=0, prepared=false;
    const context={module:{exports:{}},console,window:{DiscordNative:{app:{relaunch:()=>{relaunches++;}}}},VencordNative:{updater:{
        getStatus:async()=>({ok:true,value:{phase:"ready"}}),
        applyUpdate:async()=>({ok:true,value:true}),
        prepareRestart:async()=>prepared?{ok:true,value:true}:{ok:false,error:{message:"Pending Discord host is not approved"}}
    }}};
    vm.runInNewContext(code,context);
    await assert.rejects(context.module.exports.restartAfterUpdate(),e=>e.message.includes("not approved"));
    assert.equal(relaunches,0);
    prepared=true;
    assert.equal(await context.module.exports.restartAfterUpdate(),true);
    assert.equal(relaunches,1);
});
