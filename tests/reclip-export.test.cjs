/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm"), cp = require("node:child_process"), esbuild = require("esbuild");
function fields(bytes) {
    const result = [];
    for (let pos = 0; pos < bytes.length;) {
        const start = pos;
        function vint(id) {
            let width = 1, mask = 128;
            while (!(bytes[pos] & mask)) { mask >>= 1; width++; }
            let value = id ? bytes[pos] : bytes[pos] & (mask - 1);
            for (let i = 1; i < width; i++) value = value * 256 + bytes[pos+i];
            pos += width;
            return {value,width,unknown:!id && value === 2 ** (7*width)-1};
        }
        const id = vint(true), size = vint(false), data = pos;
        pos = size.unknown ? bytes.length : pos + size.value;
        result.push({id:id.value, body:bytes.subarray(data,pos), raw:bytes.subarray(start,pos), start, data});
    }
    return result;
}
function uint(bytes) { return [...bytes].reduce((n,b) => n*256+b,0); }
test("exported WebM and MKV contain working seek indexes and MP4 converts locally", async () => {
    const root = path.resolve(".cache/reclip-validation"); fs.mkdirSync(root,{recursive:true});
    cp.execFileSync("ffmpeg",["-v","error","-f","lavfi","-i","color=c=blue:s=64x64:r=10","-t","3","-c:v","libvpx","-g","10","-an","-y",path.join(root,"fixture.webm")]);
    const input = fs.readFileSync(path.join(root,"fixture.webm"));
    const segment = fields(input).find(e=>e.id===0x18538067);
    const children = fields(segment.body), tracks = children.find(e=>e.id===0x1654ae6b).raw;
    const packets = [];
    for (const cluster of children.filter(e=>e.id===0x1f43b675)) {
        const items = fields(cluster.body), time = uint(items.find(e=>e.id===0xe7).body);
        for (const block of items.filter(e=>e.id===0xa3)) {
            const data = new Uint8Array(block.body);
            const relative = new DataView(data.buffer).getInt16(1);
            packets.push({time:time+relative,video:true,key:Boolean(data[3]&128),data,timingOffset:1,id:block.id});
        }
    }
    const code = esbuild.buildSync({entryPoints:["src/evencordplugins/reclip.desktop/mux.ts"],bundle:true,write:false,platform:"node",format:"cjs"}).outputFiles[0].text;
    const context = {module:{exports:{}},Uint8Array,DataView,TextEncoder}; vm.runInNewContext(code,context);
    const create = vm.runInNewContext("("+context.module.exports.createReplayMuxer.toString()+")",{Uint8Array,DataView,TextEncoder});
    for (const format of ["webm","mkv"]) {
        const mux = create(packets,new Uint8Array(tracks),1,0,3000,1,format);
        const output = Buffer.concat(Array.from({length:mux.pieces},(_,i)=>Buffer.from(mux.piece(i))));
        const file = path.join(root,"clip."+format); fs.writeFileSync(file,output);
        const seg = fields(output).find(e=>e.id===0x18538067), contents=fields(seg.body);
        const cues = contents.find(e=>e.id===0x1c53bb6b); assert.ok(cues);
        for (const point of fields(cues.body)) {
            const positions=fields(point.body).find(e=>e.id===0xb7);
            const offset=uint(fields(positions.body).find(e=>e.id===0xf1).body);
            assert.equal(seg.body.readUInt32BE(offset),0x1f43b675);
        }
        const info=JSON.parse(cp.execFileSync("ffprobe",["-v","error","-show_format","-of","json",file],{encoding:"utf8"}));
        assert.equal(Number(info.format.duration),3);
        cp.execFileSync("ffmpeg",["-v","error","-ss","1.5","-i",file,"-frames:v","1","-f","null","-"]);
    }
    const built=await esbuild.build({entryPoints:["src/evencordplugins/reclip.desktop/encode.ts"],bundle:true,write:false,platform:"node",format:"cjs",plugins:[{name:"native-fixture",setup(build){
        build.onResolve({filter:/^@main\/settings$|^electron$/},a=>({path:a.path,namespace:"fixture"}));
        build.onLoad({filter:/.*/,namespace:"fixture"},()=>({contents:'export const NativeSettings={store:{plugins:{}}}; export const dialog={};'}));
    }}]});
    const native={module:{exports:{}},require,process,Buffer,setTimeout,clearTimeout}; vm.runInNewContext(built.outputFiles[0].text,native);
    assert.ok(await native.module.exports.findFFmpeg());
    const result=await native.module.exports.convertClip(path.join(root,"clip.webm"),"mp4",new AbortController().signal);
    assert.equal(result.warning,""); assert.ok(result.path.endsWith(".mp4"));
    cp.execFileSync("ffmpeg",["-v","error","-ss","1.5","-i",result.path,"-frames:v","1","-f","null","-"]);
});
