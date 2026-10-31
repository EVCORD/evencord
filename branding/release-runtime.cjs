/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
"use strict";
const crypto = require("node:crypto");
const path = require("node:path");
const https = require("node:https");
let fs;
try { fs = require("original-fs"); } catch { fs = require("node:fs"); }
const DOMAIN = "EvenCord release v1\n";
const identities = {
    core: ["EVCORD/evencord", 1438489516, "desktop.asar"],
    "installer-cli": ["EVCORD/evencord-installer", 1438489594, "EvenCordInstallerCli-x64.exe"],
    "installer-gui": ["EVCORD/evencord-installer", 1438489594, "EvenCordInstaller-x64.exe"]
};
const sha = data => crypto.createHash("sha256").update(data).digest("hex");
function exact(value, keys) {
    if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join() !== keys.slice().sort().join())
        throw new Error("Invalid release fields.");
}
function base64(value) {
    if (typeof value !== "string" || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))
        throw new Error("Invalid base64 encoding.");
    return Buffer.from(value, "base64");
}
function compare(a, b) {
    const parts = value => {
        const match = typeof value === "string" && /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-beta\.(0|[1-9][0-9]*))?$/.exec(value);
        if (!match) throw new Error("Versions must use major.minor.patch or major.minor.patch-beta.N.");
        const result = match.slice(1).map((n, i) => n === undefined && i === 3 ? Infinity : Number(n));
        if (result.some(n => n !== Infinity && n > 4294967295)) throw new Error("Version exceeds supported range.");
        return result;
    };
    const aa = parts(a), bb = parts(b);
    for (let i = 0; i < 4; i++) if (aa[i] !== bb[i]) return aa[i] > bb[i] ? 1 : -1;
    return 0;
}
function verify(data, trust, component = "core", freshness = true, now = Date.now()) {
    if (Buffer.byteLength(data) > 131072) throw new Error("Release envelope too large.");
    const env = JSON.parse(data.toString());
    exact(env, ["keyId", "signed", "signature"]);
    if (!Object.hasOwn(trust.keys, env.keyId) || trust.revoked.includes(env.keyId)) throw new Error("Release signing key is not trusted.");
    const raw = base64(trust.keys[env.keyId]), body = base64(env.signed), signature = base64(env.signature);
    if (raw.length !== 32 || signature.length !== 64) throw new Error("Invalid release signature.");
    const key = crypto.createPublicKey({key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), raw]), format: "der", type: "spki"});
    if (!crypto.verify(null, Buffer.concat([Buffer.from(DOMAIN), body]), key, signature)) throw new Error("Invalid release signature.");
    const m = JSON.parse(body.toString());
    exact(m, ["schemaVersion", "product", "component", "repository", "repositoryId", "channel", "version", "sequence", "sourceCommit", "upstreamCommit", "platform", "architecture", "discordChannel", "loaderProtocol", "publishedAt", "expiresAt", "notes", "artifact", "discordArchives"]);
    exact(m.artifact, ["name", "size", "sha256"]);
    const id = identities[component];
    if (!id || m.schemaVersion !== 1 || m.product !== "evencord" || m.component !== component || m.repository !== id[0] || m.repositoryId !== id[1] || !(trust.channels || ["stable"]).includes(m.channel) || (m.channel !== "stable" && m.channel !== "beta") || (m.channel === "beta") !== m.version.includes("-beta.") || m.platform !== "win32" || m.architecture !== "x64" || m.discordChannel !== "stable" || m.loaderProtocol !== 1 || m.artifact.name !== id[2])
        throw new Error("Release identity or compatibility mismatch.");
    compare(m.version, m.version);
    if (!Number.isSafeInteger(m.sequence) || m.sequence < 1 || !/^[a-f0-9]{40}$/.test(m.sourceCommit) || !/^[a-f0-9]{40}$/.test(m.upstreamCommit) || !/^[a-f0-9]{64}$/.test(m.artifact.sha256) || !Number.isSafeInteger(m.artifact.size) || m.artifact.size < 1 || m.artifact.size > 268435456 || typeof m.notes !== "string" || Buffer.byteLength(m.notes) > 16384)
        throw new Error("Invalid release metadata.");
    if (!Array.isArray(m.discordArchives) || m.discordArchives.length < 1 || m.discordArchives.length > 64 || m.discordArchives.some(hash => !/^[a-f0-9]{64}$/.test(hash))) throw new Error("Approved Discord archive hashes are required.");
    const published = Date.parse(m.publishedAt), expires = Date.parse(m.expiresAt);
    if (!Number.isFinite(published) || !Number.isFinite(expires) || expires <= published || expires - published > 90 * 86400000) throw new Error("Invalid release validity period.");
    if (freshness && (published > now + 300000 || expires <= now)) throw new Error("Release metadata expired or not yet valid.");
    return m;
}
function advance(next, old) {
    if (next.component !== old.component || next.channel !== old.channel || next.sequence < old.sequence || compare(next.version, old.version) < 0) throw new Error("Release rollback rejected.");
    if (compare(next.version, old.version) === 0 && next.artifact.sha256 !== old.artifact.sha256) throw new Error("Release version reused for different artifact.");
    if (next.sequence === old.sequence && (next.artifact.sha256 !== old.artifact.sha256 || next.version !== old.version || next.sourceCommit !== old.sourceCommit))
        throw new Error("Release sequence reused.");
    if (compare(next.version, old.version) > 0 && next.sequence <= old.sequence) throw new Error("New release requires higher sequence.");
}
async function latest(trust, component = "core") {
    const id = identities[component];
    if (!id) throw new Error("Unsupported release component.");
    const channel = (trust.channels || ["stable"])[0];
    const prefix = component === "core" ? "core-v" : "installer-v";
    const releases = JSON.parse((await download("https://api.github.com/repos/" + id[0] + "/releases?per_page=100", 2097152)).toString());
    let version;
    for (const release of releases) {
        if (release.draft || release.prerelease !== (channel === "beta") || !release.tag_name.startsWith(prefix)) continue;
        const candidate = release.tag_name.slice(prefix.length);
        try { compare(candidate, candidate); } catch { continue; }
        if ((channel === "beta") !== candidate.includes("-beta.")) continue;
        if (!version || compare(candidate, version) > 0) version = candidate;
    }
    if (!version) throw new Error("No approved " + channel + " release is available.");
    const data = await download("https://github.com/" + id[0] + "/releases/download/" + prefix + version + "/" + component + ".release.json", 131072);
    const manifest = verify(data, trust, component);
    if (manifest.version !== version || manifest.channel !== channel) throw new Error("Release tag and signed identity differ.");
    return data;
}
function safePath(file) {
    let current = path.resolve(file);
    while (true) {
        if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw new Error("Linked filesystem paths are unsupported.");
        const parent = path.dirname(current);
        if (parent === current) break;
        current = parent;
    }
    return path.resolve(file);
}
function checkedFile(file, artifact) {
    safePath(file);
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.size !== artifact.size || sha(fs.readFileSync(file)) !== artifact.sha256) throw new Error("Artifact size or SHA-256 mismatch.");
    return file;
}
function atomic(file, data) {
    safePath(file);
    const tmp = file + "." + crypto.randomUUID() + ".tmp";
    const fd = fs.openSync(tmp, "wx", 0o600);
    try { fs.writeFileSync(fd, data); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    try { fs.renameSync(tmp, file); } finally { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); }
}
function safeURL(raw) {
    const u = new URL(raw);
    if (u.protocol !== "https:" || u.username || u.password || u.port || u.hash || !["github.com", "api.github.com", "release-assets.githubusercontent.com", "objects.githubusercontent.com"].includes(u.hostname))
        throw new Error("Unapproved release URL.");
    return u;
}
async function download(raw, maxBytes) {
    const deadline = Date.now() + 120000;
    async function request(url, redirects) {
        safeURL(url);
        if (redirects > 4 || Date.now() >= deadline) throw new Error("Release request timed out or redirected too often.");
        return new Promise((resolve, reject) => {
            const req = https.get(url, {headers: {"User-Agent": "EvenCord"}}, res => {
                if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
                    res.resume();
                    if (!res.headers.location) return reject(new Error("Missing redirect destination."));
                    request(new URL(res.headers.location, url).href, redirects + 1).then(resolve, reject);
                    return;
                }
                if (res.statusCode !== 200) { res.resume(); reject(new Error("Release unavailable: HTTP " + res.statusCode)); return; }
                if (Number(res.headers["content-length"]) > maxBytes) { res.destroy(); reject(new Error("Download exceeds size limit.")); return; }
                const chunks = []; let size = 0;
                res.on("data", chunk => {
                    size += chunk.length;
                    if (size > maxBytes) { res.destroy(new Error("Download exceeds size limit.")); return; }
                    chunks.push(chunk);
                });
                res.on("end", () => resolve(Buffer.concat(chunks)));
                res.on("error", reject);
                res.on("aborted", () => reject(new Error("Download interrupted.")));
            });
            const timer = setTimeout(() => req.destroy(new Error("Release request timed out.")), Math.max(1, deadline - Date.now()));
            req.on("close", () => clearTimeout(timer));
            req.on("error", reject);
        });
    }
    return request(raw, 0);
}
function payloadPath(root, m) { return path.join(root, "releases", m.artifact.sha256 + "-" + m.artifact.name); }
function current(root, trust, name = "current.json") {
    const data = fs.readFileSync(path.join(root, name));
    const manifest = verify(data, trust, "core", false);
    checkedFile(payloadPath(root, manifest), manifest.artifact);
    return {manifest, data};
}
function accepted(root, trust) {
    const file = path.join(root, "accepted.json");
    return fs.existsSync(file) ? verify(fs.readFileSync(file), trust, "core", false) : undefined;
}
function activate(root, data, bytes, trust) {
    const m = verify(data, trust);
    if (bytes.length !== m.artifact.size || sha(bytes) !== m.artifact.sha256) throw new Error("Artifact size or SHA-256 mismatch.");
    const failure = path.join(root, "failed.json");
    if (fs.existsSync(failure) && JSON.parse(fs.readFileSync(failure, "utf8")).sha256 === m.artifact.sha256) throw new Error("This release failed startup. A newer release or reviewed recovery is required.");
    safePath(root); fs.mkdirSync(path.join(root, "releases"), {recursive: true});
    const lock = path.join(root, ".evencord-operation.lock");
    const fd = fs.openSync(lock, "wx");
    try {
        const highest = accepted(root, trust);
        if (highest) advance(m, highest);
        const pointer = path.join(root, "current.json");
        if (fs.existsSync(pointer)) {
            const previous = fs.readFileSync(pointer);
            const old = verify(previous, trust, "core", false);
            advance(m, old);
            if (m.artifact.sha256 !== old.artifact.sha256 && !(fs.existsSync(failure) && JSON.parse(fs.readFileSync(failure, "utf8")).sha256 === old.artifact.sha256)) {
                checkedFile(payloadPath(root, old), old.artifact);
                atomic(path.join(root, "previous.json"), previous);
            }
        }
        const target = payloadPath(root, m);
        if (fs.existsSync(target)) checkedFile(target, m.artifact); else atomic(target, bytes);
        atomic(path.join(root, "accepted.json"), data);
        atomic(pointer, data);
        return m;
    } finally { fs.closeSync(fd); fs.unlinkSync(lock); }
}

function beginBoot(root, trust) {
    const attempt = path.join(root, "booting.json"), failed = path.join(root, "failed.json");
    if (fs.existsSync(attempt)) {
        const previousAttempt = JSON.parse(fs.readFileSync(attempt, "utf8"));
        atomic(failed, JSON.stringify(previousAttempt));
    }
    const rejected = fs.existsSync(failed) ? JSON.parse(fs.readFileSync(failed, "utf8")).sha256 : undefined;
    for (const name of ["current.json", "previous.json"]) {
        try {
            const candidate = current(root, trust, name);
            if (candidate.manifest.artifact.sha256 === rejected) continue;
            atomic(attempt, JSON.stringify({sha256: candidate.manifest.artifact.sha256}));
            return candidate;
        } catch (error) {
            console.error("[EvenCord] Recovery candidate unavailable: " + error.message);
        }
    }
    return undefined;
}
function completeBoot(root, hash) {
    const marker = path.join(root, "booting.json");
    if (fs.existsSync(marker) && JSON.parse(fs.readFileSync(marker, "utf8")).sha256 === hash) fs.unlinkSync(marker);
}
module.exports = {latest, accepted, beginBoot, completeBoot, verify, compare, advance, sha, safeURL, download, checkedFile, atomic, safePath, payloadPath, current, activate};
