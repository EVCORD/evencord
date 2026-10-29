/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
"use strict";
const fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process");
const runtime=require("../branding/runtime.cjs");
const project=require("../branding/project.json");
const approved=require("../branding/discord-compatibility.json");
const [component,directory]=process.argv.slice(2);
const names={core:"desktop.asar","installer-cli":"EvenCordInstallerCli-x64.exe","installer-gui":"EvenCordInstaller-x64.exe"};
if(!Object.hasOwn(names,component)||!directory)throw Error("Usage: prepare-beta.cjs COMPONENT OUTPUT_DIRECTORY");
if(project.release.channel!=="beta")throw Error("Beta channel required");
const git=(...args)=>cp.execFileSync("git",args,{encoding:"utf8"}).trim();
if(git("status","--porcelain","--untracked-files=normal"))throw Error("Commit reviewed source before preparing a release");
const source=git("rev-parse","HEAD"),upstream=git("merge-base","HEAD","upstream/main");
const version=component==="core"?require("../package.json").version:fs.readFileSync("buildinfo/git_data.go","utf8").match(/InstallerTag\s*=\s*"([^"]+)"/)[1];
runtime.compare(version,version);if(!/-beta\./.test(version))throw Error("Beta version required");
const dir=path.resolve(directory),file=path.join(dir,names[component]),bytes=fs.readFileSync(file);
const identity=component==="core"?project.repositories.core:project.repositories.installer;
const published=new Date(),expires=new Date(published.getTime()+89*86400000);
const m={schemaVersion:1,product:project.id,component,repository:identity.slug,repositoryId:identity.id,channel:"beta",version,sequence:1,sourceCommit:source,upstreamCommit:upstream,platform:"win32",architecture:"x64",discordChannel:"stable",loaderProtocol:1,publishedAt:published.toISOString(),expiresAt:expires.toISOString(),notes:"Initial public beta. Windows x64 and the reviewed Discord Stable 1.0.9266 archive only. Includes Vencord, Equicord and EvenCord plugins, Reclip and Quoter Enhanced. Manual upgrades only. Executables are not Authenticode signed. Preserve original archives and recovery records. Read release notes and recording privacy information before use.",artifact:{name:names[component],size:bytes.length,sha256:runtime.sha(bytes)},discordArchives:[approved.archiveSHA256]};
fs.writeFileSync(path.join(dir,component+".manifest.json"),JSON.stringify(m,null,2)+"\n",{flag:"wx"});
fs.copyFileSync("LICENSE",path.join(dir,"LICENSE.txt"));
fs.writeFileSync(path.join(dir,component+".source.json"),JSON.stringify({component,version,sourceCommit:source,upstreamCommit:upstream,repository:identity.slug,sourceURL:"https://github.com/"+identity.slug+"/tree/"+source},null,2)+"\n");
console.log("Prepared",component,version,"from",source);
