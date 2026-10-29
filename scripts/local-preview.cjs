/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const runtime = require("../branding/runtime.cjs");
const project = require("../branding/project.json");
const root = path.resolve(__dirname, "..");
const local = path.join(root, ".cache", "local-preview");
const bundle = path.join(local, "bundle");
const privateFile = path.join(local, "private", "signing.pem");
const trustFile = path.join(bundle, "trust.json");
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
if (Object.values(project.capabilities).some(Boolean)) throw new Error("Production capabilities must remain disabled.");
if (process.argv[2] === "init") {
    fs.mkdirSync(path.dirname(privateFile), { recursive: true, mode: 0o700 });
    fs.mkdirSync(bundle, { recursive: true, mode: 0o700 });
    if (!fs.existsSync(privateFile)) {
        const pair = crypto.generateKeyPairSync("ed25519");
        fs.writeFileSync(privateFile, pair.privateKey.export({ type: "pkcs8", format: "pem" }), { flag: "wx", mode: 0o600 });
    }
    const publicKey = crypto.createPublicKey(fs.readFileSync(privateFile)).export({ type: "spki", format: "der" }).subarray(-32);
    const id = "local-preview-" + runtime.sha(publicKey).slice(0, 16);
    const trust = { schemaVersion: 1, keys: { [id]: publicKey.toString("base64") }, revoked: [], maxArtifactBytes: 268435456, manifestMaxAgeDays: 90 };
    const data = JSON.stringify(trust, null, 2) + "\n";
    if (fs.existsSync(trustFile) && fs.readFileSync(trustFile, "utf8") !== data) throw new Error("Existing local trust differs. Refusing silent key rotation.");
    fs.writeFileSync(trustFile, data);
    console.log("Local public trust fingerprint: " + runtime.sha(Buffer.from(data)));
} else if (process.argv[2] === "sign") {
    const archive = process.argv[3];
    if (!archive || !path.isAbsolute(archive)) throw new Error("An explicitly reviewed original Discord archive is required.");
    if (git("status", "--porcelain")) throw new Error("Commit reviewed source before preparing the private build.");
    const asar = require("@electron/asar");
    const discordPackage = JSON.parse(asar.extractFile(archive, "package.json"));
    if (discordPackage.name !== "discord" || discordPackage.main !== "bundle.js") throw new Error("Not the reviewed Discord bootstrap format.");
    for (let name of asar.listPackage(archive)) {
        name = name.replace(/^[\\/]+/, "");
        const entry = asar.statFile(archive, name);
        if (entry.size !== undefined && (!entry.integrity || entry.integrity.algorithm !== "SHA256" || runtime.sha(asar.extractFile(archive, name)) !== entry.integrity.hash))
            throw new Error("Original archive integrity failed: " + name);
    }
    const trust = JSON.parse(fs.readFileSync(trustFile));
    const keyId = Object.keys(trust.keys)[0];
    const source = path.join(root, "dist", "desktop.asar");
    const patcher = asar.extractFile(source, "patcher.js").toString();
    if (!patcher.includes(trust.keys[keyId]) || !patcher.includes(keyId)) throw new Error("Build does not contain this local preview trust identity.");
    const bytes = fs.readFileSync(source);
    const receipt = JSON.parse(fs.readFileSync(path.join(root, "dist", "local-preview.json")));
    if (receipt.sourceCommit !== git("rev-parse", "HEAD") || receipt.trustSHA256 !== runtime.sha(fs.readFileSync(trustFile)) || receipt.artifactSHA256 !== runtime.sha(bytes))
        throw new Error("Local build receipt does not match the source, trust or payload. Rebuild before signing.");
    const sequence = Math.floor(Date.now() / 1000);
    const manifest = {
        schemaVersion: 1, product: "evencord", component: "core",
        repository: project.repositories.core.slug, repositoryId: project.repositories.core.id,
        channel: "stable", version: "0.0." + sequence, sequence,
        sourceCommit: git("rev-parse", "HEAD"), upstreamCommit: git("merge-base", "HEAD", "upstream/main"),
        platform: "win32", architecture: "x64", discordChannel: "stable", loaderProtocol: 1,
        publishedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
        notes: "Private local development preview. Public distribution, updates and host repatching are disabled.",
        artifact: { name: "desktop.asar", size: bytes.length, sha256: runtime.sha(bytes) },
        discordArchives: [runtime.sha(fs.readFileSync(archive))]
    };
    const body = Buffer.from(JSON.stringify(manifest));
    const signature = crypto.sign(null, Buffer.concat([Buffer.from("EvenCord release v1\n"), body]), fs.readFileSync(privateFile));
    const envelope = Buffer.from(JSON.stringify({ keyId, signed: body.toString("base64"), signature: signature.toString("base64") }));
    runtime.verify(envelope, trust);
    fs.copyFileSync(source, path.join(bundle, "desktop.asar"));
    fs.writeFileSync(path.join(bundle, "core.release.json"), envelope);
    console.log(JSON.stringify({ version: manifest.version, sourceCommit: manifest.sourceCommit, artifactSHA256: manifest.artifact.sha256, discordSHA256: manifest.discordArchives[0] }));
} else {
    throw new Error("Use init or sign <reviewed-original-archive>.");
}
