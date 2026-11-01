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
        if(method==='get') {
            if (pages++ === 0) return {status:200,body:{total_results:100,messages:f.results.map(message=>[message])}};
            return {status:200,body:{total_results:1,messages:[[first]]}};
        }
    }});
    first=f.results[0];await f.preview();
    assert.equal(f.cleaner.snapshot().phase,"review");assert.equal(f.cleaner.snapshot().messages.length,1);
    assert.equal(pages,2);
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

test("a stalled search times out, releases the panel and cannot insert late results", async () => {
    let resolve;
    const f = fixture({ request: () => new Promise(done => { resolve = done; }) });
    await f.preview();
    assert.equal(f.cleaner.snapshot().phase, "error");
    assert.match(f.cleaner.snapshot().error, /30 seconds/);
    assert.equal(f.cleaner.snapshot().requestPending, false);
    assert.equal(f.cleaner.busy(), false);
    assert.equal(f.calls.length, 1);
    resolve({ status: 200, body: { total_results: 1, messages: [[f.results[0]]] } });
    await new Promise(done => setImmediate(done));
    assert.equal(f.cleaner.snapshot().requestPending, false);
    assert.equal(f.cleaner.snapshot().messages.length, 0);
    assert.equal(f.cleaner.snapshot().phase, "error");
});

test("stop releases the UI during a pending request and retains a late 429 cooldown", async () => {
    let reject, sent = false;
    const f = fixture({
        request: () => { sent = true; return new Promise((_, failed) => { reject = failed; }); },
        sleep: cleaner => { if (sent) cleaner.stop(); }
    });
    await f.preview();
    assert.equal(f.cleaner.snapshot().phase, "stopped");
    assert.equal(f.cleaner.snapshot().requestPending, false);
    reject({ status: 429, body: { retry_after: 40 } });
    await new Promise(done => setImmediate(done));
    assert.equal(f.cleaner.snapshot().requestPending, false);
    f.cleaner.clear();
    const times = [];
    const unsubscribe = f.cleaner.subscribe(() => { if (f.cleaner.snapshot().waitUntil) times.push(f.cleaner.snapshot().waitUntil); });
    await f.preview();
    unsubscribe();
    assert.ok(times.length > 0, "A late 429 must retain its cooldown for the next job");
});

test("one complete search page finishes without a redundant empty-page request", async () => {
    const f = fixture();
    await f.preview();
    assert.equal(f.calls.length, 1);
    assert.equal(f.cleaner.snapshot().phase, "review");
    assert.equal(f.cleaner.snapshot().page, 1);
    assert.equal(f.cleaner.snapshot().targetIndex, 1);
});

test("search results without hit markers still enforce local ownership and channel checks", async () => {
    const f = fixture();
    for (const message of f.results) delete message.hit;
    await f.preview();
    assert.equal(f.cleaner.snapshot().phase, "review");
    assert.equal(f.cleaner.snapshot().messages.length, 1);
    assert.equal(f.calls.filter(call => call.method === "del").length, 0);
});

test("indexing waits honor retry_after before a bounded retry", async () => {
    let searches = 0;
    const f = fixture({ request: ({ method }) => {
        if (method === "get" && searches++ === 0) return { status: 202, body: { retry_after: 12.5 } };
    } });
    await f.preview();
    assert.equal(f.cleaner.snapshot().phase, "review");
    assert.equal(f.calls.length, 2);
    assert.ok(f.calls[1].time - f.calls[0].time >= 12750);
});

test("review results now ends search without deleting and still needs exact confirmation", async () => {
    const f = fixture({
        request: ({ method }) => method === "get" ? { status: 200, body: { total_results: 200, messages: [[f.results[0]]] } } : undefined,
        sleep: cleaner => { if (cleaner.snapshot().messages.length) cleaner.finishPreview(); }
    });
    await f.preview();
    assert.equal(f.cleaner.snapshot().phase, "review");
    assert.equal(f.cleaner.snapshot().limited, true);
    assert.equal(f.calls.length, 1);
    await f.cleaner.remove("DELETE 1", false, 1500);
    assert.equal(f.calls.length, 1);
    await f.cleaner.remove("DELETE 1", true, 1500);
    assert.equal(f.cleaner.snapshot().deleted, 1);
});

test("a sparse filtered preview follows its cursor until search is exhausted", async () => {
    let pages = 0;
    const f = fixture({ request: ({ query }) => ++pages > 20 ? { status: 200, body: { total_results: 0, messages: [] } } : { status: 200, body: { total_results: 1000, messages: [[{ ...f.results[0], id: (BigInt(query.max_id) - 1000n).toString() }]] } } });
    await f.cleaner.preview([{ id: channel, label: "Synthetic channel" }], { ...filters, contains: "No matching content" });
    assert.equal(f.calls.length, 21);
    assert.equal(f.cleaner.snapshot().phase, "review");
    assert.equal(f.cleaner.snapshot().limited, false);
    assert.equal(f.cleaner.snapshot().messages.length, 0);
    for (let index = 1; index < f.calls.length; index++) assert.equal(BigInt(f.calls[index - 1].query.max_id) - BigInt(f.calls[index].query.max_id), 1001n);
});

test("an unanswered deletion stops without retrying or reporting success", async () => {
    let resolve;
    const f = fixture({ request: ({ method }) => method === "del" ? new Promise(done => { resolve = done; }) : undefined });
    await f.preview();
    await f.cleaner.remove("DELETE 1", true, 1500);
    assert.equal(f.cleaner.snapshot().phase, "error");
    assert.equal(f.cleaner.snapshot().deleted, 0);
    assert.equal(f.calls.filter(call => call.method === "del").length, 1);
    assert.equal(f.cleaner.snapshot().requestPending, true);
    resolve({ status: 204 });
    await new Promise(done => setImmediate(done));
    assert.equal(f.cleaner.snapshot().deleted, 0);
    assert.equal(f.cleaner.snapshot().phase, "error");
});
