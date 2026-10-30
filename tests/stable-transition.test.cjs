/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const legacy = require("../branding/runtime.cjs"), runtime = require("../branding/stable-runtime.cjs");
const {migrate} = require("../branding/channel-migration.cjs");
const {createUpdater} = require("../branding/managed-updater.cjs");

test("installed beta loader reaches stable with settings and rollback preserved", async t => {
    const cache = path.resolve(__dirname, "../.cache/fixtures");
    fs.mkdirSync(cache, {recursive:true});
    const base = fs.mkdtempSync(path.join(cache, "stable-"));
    t.after(() => { assert.ok(base.startsWith(cache+path.sep)); fs.rmSync(base,{recursive:true}); });
    const {publicKey,privateKey} = crypto.generateKeyPairSync("ed25519");
    const oldTrust = {keys:{test:publicKey.export({format:"der",type:"spki"}).subarray(-32).toString("base64")},revoked:[],channels:["beta"]};
    const trust = {...oldTrust,channels:["stable","beta"]};
    const oldData = JSON.stringify(oldTrust), data = JSON.stringify(trust);
    const loader = fs.readFileSync(path.resolve(__dirname,"../branding/loader.cjs"),"utf8").replaceAll("\r\n","\n");
    const engine = fs.readFileSync(path.resolve(__dirname,"../branding/runtime.cjs"),"utf8").replaceAll("\r\n","\n");
    const original = Buffer.from("verified Discord original"), hash=runtime.sha(original);
    const root=path.join(base,"profile");
    const resources=path.join(base,"Discord","app-1.0.1","resources"), app=path.join(resources,"app.asar");
    fs.mkdirSync(app,{recursive:true});
    const exe=Buffer.alloc(128);exe.write("MZ");exe.writeUInt32LE(64,60);exe.write("PE\0\0",64);exe.writeUInt16LE(0x8664,68);
    fs.writeFileSync(path.join(resources,"..","Discord.exe"),exe);
    fs.writeFileSync(path.join(resources,"build_info.json"),JSON.stringify({releaseChannel:"stable"}));
    fs.writeFileSync(path.join(resources,"_app.asar"),original);
    const owner={schemaVersion:1,product:"evencord",dataRoot:root,originalSHA256:hash,files:{"index.js":runtime.sha(loader),"runtime.cjs":runtime.sha(engine),"trust.json":runtime.sha(oldData)}};
    function reset() {
        for(const [name,value] of Object.entries({"package.json":'{"name":"discord","main":"index.js"}',"index.js":loader,"runtime.cjs":engine,"trust.json":oldData,"evencord-owner.json":JSON.stringify(owner)})) fs.writeFileSync(path.join(app,name),value);
        fs.writeFileSync(path.join(resources,"evencord-install.json"),JSON.stringify(owner));
    }
    reset();
    const bytes=Buffer.from("beta bridge"), nextBytes=Buffer.from("stable payload");
    const beta={schemaVersion:1,product:"evencord",component:"core",repository:"alrimii/evencord",repositoryId:1438489516,channel:"beta",version:"1.0.0-beta.9",sequence:9,sourceCommit:"a".repeat(40),upstreamCommit:"b".repeat(40),platform:"win32",architecture:"x64",discordChannel:"stable",loaderProtocol:1,publishedAt:new Date(Date.now()-1000).toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString(),notes:"Bridge",discordArchives:[hash],artifact:{name:"desktop.asar",size:bytes.length,sha256:runtime.sha(bytes)}};
    const stable={...beta,channel:"stable",version:"1.0.0",sequence:10,sourceCommit:"c".repeat(40),artifact:{...beta.artifact,size:nextBytes.length,sha256:runtime.sha(nextBytes)}};
    const sign = m => { const body=Buffer.from(JSON.stringify(m)); return Buffer.from(JSON.stringify({keyId:"test",signed:body.toString("base64"),signature:crypto.sign(null,Buffer.concat([Buffer.from("EvenCord release v1\n"),body]),privateKey).toString("base64")})); };
    legacy.activate(root,sign(beta),bytes,oldTrust);
    fs.writeFileSync(path.join(root,"settings.json"),"keep settings");
    for (const stop of ["trust","inner-owner","outer-owner"]) {
        reset();
        assert.throws(()=>migrate(resources,loader,engine,oldData,data,step=>{if(step===stop)throw Error("interrupted");}));
        const boot=legacy.beginBoot(root,JSON.parse(fs.readFileSync(path.join(app,"trust.json"))));
        assert.equal(boot.manifest.version,beta.version);legacy.completeBoot(root,beta.artifact.sha256);
        migrate(resources,loader,engine,oldData,data);
        assert.equal(fs.existsSync(path.join(resources,".evencord-trust-migration.json")),false);
    }
    const updater=createUpdater({trust,context:()=>({root,envelope:sign(beta),payload:runtime.payloadPath(root,beta),sourceCommit:beta.sourceCommit,originalHash:hash}),latest:async()=>sign(stable),download:async()=>nextBytes});
    assert.equal((await updater.check()).version,"1.0.0");
    await updater.apply();assert.equal(updater.status().phase,"ready");
    const installedTrust=JSON.parse(fs.readFileSync(path.join(app,"trust.json")));
    assert.equal(legacy.beginBoot(root,installedTrust).manifest.version,"1.0.0");
    assert.equal(legacy.beginBoot(root,installedTrust).manifest.version,beta.version,"unfinished stable startup falls back to signed bridge");
    assert.equal(fs.readFileSync(path.join(root,"settings.json"),"utf8"),"keep settings");
    assert.equal(runtime.sha(fs.readFileSync(path.join(resources,"_app.asar"))),hash);
    assert.throws(()=>runtime.advance({...beta,sequence:11},stable));
    fs.writeFileSync(path.join(app,"trust.json"),"unknown");
    assert.throws(()=>migrate(resources,loader,engine,oldData,data));
});
