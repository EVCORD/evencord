/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
"use strict";
const fs = require("node:fs"), path = require("node:path"), cp = require("node:child_process");
const runtime = require("../branding/release-runtime.cjs");
const trust = require("../branding/trust.json");
const [command, component, directory] = process.argv.slice(2);
const names = {core:"desktop.asar","installer-gui":"EvenCordInstaller-x64.exe","installer-cli":"EvenCordInstallerCli-x64.exe"};
if (!Object.hasOwn(names,component) || !directory) throw Error("Usage: release-tools.cjs candidate|verify core|installer-gui|installer-cli DIRECTORY");
const dir = path.resolve(directory);
if (command === "candidate") {
    const file = path.join(dir,names[component]);
    const bytes = fs.readFileSync(file);
    const head = cp.execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim();
    const dirty = cp.execFileSync("git",["status","--porcelain","--untracked-files=no"],{encoding:"utf8"}).trim().length > 0;
    const info = {sourceDirty:dirty,schemaVersion:1,product:"evencord",component,sourceCommit:head,artifact:{name:names[component],size:bytes.length,sha256:runtime.sha(bytes)},status:"UNSIGNED DEVELOPMENT CANDIDATE, NOT INSTALLABLE"};
    fs.writeFileSync(path.join(dir,component+".candidate.json"),JSON.stringify(info,null,2)+"\n");
    console.log("Created unsigned candidate identity; no release was signed or published.");
} else if (command === "verify") {
    const data = fs.readFileSync(path.join(dir,component+".release.json"));
    const m = runtime.verify(data,trust,component);
    runtime.checkedFile(path.join(dir,m.artifact.name),m.artifact);
    const head = cp.execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim();
    if (head !== m.sourceCommit) throw Error("Release source does not match reviewed checkout.");
    cp.execFileSync("git",["merge-base","--is-ancestor",m.upstreamCommit,head]);
    if (fs.existsSync("package.json") && component === "core" && JSON.parse(fs.readFileSync("package.json")).version !== m.version) throw Error("Manifest version does not match source.");
    if (component !== "core") {
        const version = fs.readFileSync("buildinfo/git_data.go","utf8").match(/InstallerTag\s*=\s*"([^"]+)"/);
        if (!version || version[1] !== m.version) throw Error("Installer manifest version does not match source.");
    }
    if (component === "core") {
        const asar = require("@electron/asar");
        const archive = path.join(dir, m.artifact.name);
        const native = asar.extractFile(archive, "patcher.js").toString();
        const renderer = asar.extractFile(archive, "renderer.js").toString();
        for (const code of [native, renderer]) {
            if (!code.includes("// EvenCord " + m.sourceCommit) || !code.includes("// Updater Disabled: false")) throw Error("Packaged source identity or updater capability differs.");
        }
        for (const key of Object.values(trust.keys)) if (!native.includes(key)) throw Error("Packaged trusted key differs.");
        if (!native.includes("payload:__dirname") || !native.includes("EVENCORD_RUNNING_RELEASE")) throw Error("Managed running identity is not included.");
        if (!native.includes("Choose Reclip save folder") || !renderer.includes("Choose folder")) throw Error("Folder picker missing from packaged build.");
        for (const name of asar.listPackage(archive)) {
            const entry = name.replace(/^[\\/]+/, "");
            if (asar.statFile(archive, entry).files) continue;
            const text = asar.extractFile(archive, entry).toString();
            if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|C:[\\/]+Users[\\/]+MainRec/i.test(text)) throw Error("Sensitive material in packaged file: " + entry);
        }
    }
    console.log("Verified release "+m.version+" from "+m.sourceCommit);
} else throw Error("Unknown release tool command.");
