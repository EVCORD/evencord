/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
"use strict";
const fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process");
const runtime=require("../branding/release-runtime.cjs");
const project=require("../branding/project.json");
const approved=require("../branding/discord-compatibility.json");
const [component,directory,sequenceText] = process.argv.slice(2);
const sequence = Number(sequenceText);
if (!Number.isSafeInteger(sequence) || sequence < 1) throw Error("Explicit positive release sequence required");
const names={core:"desktop.asar","installer-cli":"EvenCordInstallerCli-x64.exe","installer-gui":"EvenCordInstaller-x64.exe"};
if(!Object.hasOwn(names,component)||!directory)throw Error("Usage: prepare-beta.cjs COMPONENT OUTPUT_DIRECTORY SEQUENCE");
if(!["beta","stable"].includes(project.release.channel))throw Error("Approved release channel required");
const git=(...args)=>cp.execFileSync("git",args,{encoding:"utf8"}).trim();
if(git("status","--porcelain","--untracked-files=normal"))throw Error("Commit reviewed source before preparing a release");
const source=git("rev-parse","HEAD"),upstream=git("merge-base","HEAD","upstream/main");
const version=component==="core"?require("../package.json").version:fs.readFileSync("buildinfo/git_data.go","utf8").match(/InstallerTag\s*=\s*"([^"]+)"/)[1];
runtime.compare(version,version);const channel = version.includes("-beta.") ? "beta" : "stable";
const dir=path.resolve(directory),file=path.join(dir,names[component]),bytes=fs.readFileSync(file);
const identity=component==="core"?project.repositories.core:project.repositories.installer;
const published=new Date(),expires=new Date(published.getTime()+89*86400000);
const m={schemaVersion:1,product:project.id,component,repository:identity.slug,repositoryId:identity.id,channel,version,sequence,sourceCommit:source,upstreamCommit:upstream,platform:"win32",architecture:"x64",discordChannel:"stable",loaderProtocol:1,publishedAt:published.toISOString(),expiresAt:expires.toISOString(),notes:fs.readFileSync(path.join("docs", "releases", version + ".md"), "utf8"),artifact:{name:names[component],size:bytes.length,sha256:runtime.sha(bytes)},discordArchives:[...new Set((approved.channels || [approved]).map(host => host.archiveSHA256))]};
fs.writeFileSync(path.join(dir,component+".manifest.json"),JSON.stringify(m,null,2)+"\n",{flag:"wx"});
fs.copyFileSync("LICENSE",path.join(dir,"LICENSE.txt"));
fs.writeFileSync(path.join(dir,component+".source.json"),JSON.stringify({component,version,sourceCommit:source,upstreamCommit:upstream,repository:identity.slug,sourceURL:"https://github.com/"+identity.slug+"/tree/"+source},null,2)+"\n");
console.log("Prepared",component,version,"from",source);
