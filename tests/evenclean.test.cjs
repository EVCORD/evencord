/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path");
const esbuild = require("esbuild");
const cache = path.resolve(__dirname,"../.cache");
fs.mkdirSync(cache,{recursive:true});
const compiled = path.join(cache,"evenclean-engine.cjs");
fs.writeFileSync(compiled,esbuild.transformSync(fs.readFileSync(path.resolve(__dirname,"../src/evencordplugins/evenClean/engine.ts"),"utf8"),{loader:"ts",format:"cjs",target:"node22"}).code);
const {createCleaner} = require(compiled);
const user = "1234567890123456789", channel = "2234567890123456789";
const filters = {contains:"",after:"",before:"",media:"all",includePinned:false,limit:100};
function fixture(override = {}) {
    let clock = 1800000000000, account = user, searches = 0;
    const calls = [];
    const snowflake = time => ((BigInt(time)-1420070400000n)<<22n).toString();
    const message = (delta, fields = {}) => ({id:snowflake(clock-delta),channel_id:channel,author:{id:user},type:0,hit:true,content:"own fixture",attachments:[],...fields});
    const results = [message(1000),message(2000,{author:{id:"3234567890123456789"}}),message(3000,{channel_id:"4234567890123456789"}),message(4000,{pinned:true})];
    let cleaner;
    cleaner = createCleaner({
        currentUser:()=>account,canAccess:id=>id===channel,now:()=>clock,
        sleep:async ms=>{clock+=ms; if(override.sleep)await override.sleep(cleaner);},
        request:async(method,url,query)=>{
            calls.push({method,url,query,time:clock});
            if(override.request){const response=await override.request({method,url,query,calls,cleaner});if(response!==undefined)return response;}
            return method==='get'?{status:200,body:{total_results:searches++===0?results.length:0,messages:searches===1?results.map(m=>[m]):[]}}:{status:204};
        }
    });
    return {cleaner,calls,results,account:value=>{account=value;},preview:()=>cleaner.preview([{id:channel,label:"Synthetic channel"}],filters)};
}

test("preview excludes foreign authors, channels and pinned messages; deletion needs exact confirmation",async()=>{
    const f=fixture();await f.preview();
    assert.equal(f.cleaner.snapshot().phase,"review");assert.equal(f.cleaner.snapshot().messages.length,1);
    assert.ok(f.calls.every(c=>c.method==='get'&&c.query.author_id===user));
    await f.cleaner.remove("DELETE ALL",true,1500);await f.cleaner.remove("DELETE 1",false,1500);
    assert.equal(f.calls.filter(c=>c.method==='del').length,0);
    await f.cleaner.remove("DELETE 1",true,1500);
    assert.equal(f.cleaner.snapshot().deleted,1);assert.equal(f.cleaner.snapshot().phase,"done");
    assert.equal(f.calls.find(c=>c.method==='del').url,`/channels/${channel}/messages/${f.results[0].id}`);
});

test("429 honors fractional server cooldown, including global scope, with no early retry",async()=>{
    let deletes=0;
    const f=fixture({request:({method})=>{if(method==='del'&&++deletes===1)throw {status:429,body:{retry_after:3.25,global:true},headers:{'X-RateLimit-Remaining':'0','X-RateLimit-Reset-After':'5.5'}};}});
    await f.preview();await f.cleaner.remove("DELETE 1",true,1500);
    const times=f.calls.filter(c=>c.method==='del').map(c=>c.time);
    assert.equal(times.length,2);assert.ok(times[1]-times[0]>=5750);assert.equal(f.cleaner.snapshot().deleted,1);
});

test("an inclusive final search boundary does not duplicate or stall the preview",async()=>{
    let pages=0, first;
    const f=fixture({request:({method,query})=>{
        if(method==='get'&&pages++>0)return {status:200,body:{total_results:1,messages:[[{...first,id:query.max_id}]]}};
    }});
    first=f.results[0];await f.preview();
    assert.equal(f.cleaner.snapshot().phase,"review");assert.equal(f.cleaner.snapshot().messages.length,1);
    assert.ok(pages<=3);
});

test("authentication and permission failures stop without retrying; account switch cannot delete",async()=>{
    for(const status of [401,403]){
        const f=fixture({request:()=>{throw {status};}});await f.preview();
        assert.equal(f.calls.length,1);assert.equal(f.cleaner.snapshot().phase,"error");
    }
    const f=fixture();await f.preview();f.account("5234567890123456789");await f.cleaner.remove("DELETE 1",true,1500);
    assert.equal(f.calls.filter(c=>c.method==='del').length,0);assert.equal(f.cleaner.snapshot().messages.length,0);
});

test("stop during cooldown sends no retry; disable clears the in-memory plan",async()=>{
    let stop=false;
    const f=fixture({request:({method})=>{if(method==='del'){stop=true;throw {status:429,body:{retry_after:30}};}},sleep:async cleaner=>{if(stop)cleaner.stop();}});
    await f.preview();await f.cleaner.remove("DELETE 1",true,1500);
    assert.equal(f.calls.filter(c=>c.method==='del').length,1);assert.equal(f.cleaner.snapshot().phase,"stopped");
    f.cleaner.dispose();assert.equal(f.cleaner.snapshot().messages.length,0);assert.equal(f.cleaner.snapshot().phase,"idle");
});

test("an archived thread is skipped after one response instead of requesting every message",async()=>{
    const f=fixture({request:({method})=>{if(method==='del')throw {status:400,body:{code:50083}};}});
    f.results[1].author={id:user};await f.preview();
    await f.cleaner.remove("DELETE 2",true,1500);
    assert.equal(f.calls.filter(c=>c.method==='del').length,1);assert.equal(f.cleaner.snapshot().skipped,2);
});
