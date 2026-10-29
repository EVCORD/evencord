/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
"use strict";
// Kept outside runtime.cjs: protocol-1 installations pin the loader runtime bytes.
const https = require("node:https");
const path = require("node:path");
let fs;
try { fs = require("original-fs"); } catch { fs = require("node:fs"); }
const runtime = require("./runtime.cjs");

async function downloadArtifact(raw, size, progress, get = https.get) {
    const deadline = Date.now() + 120000;
    async function request(url, redirects) {
        runtime.safeURL(url);
        if (redirects > 4 || Date.now() >= deadline) throw Error("Release download timed out or redirected too often.");
        return new Promise((resolve, reject) => {
            const req = get(url, { headers: { "User-Agent": "EvenCord", "Accept-Encoding": "identity" } }, res => {
                if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
                    res.resume();
                    if (!res.headers.location) return reject(Error("Missing download redirect."));
                    try { request(new URL(res.headers.location, url).href, redirects + 1).then(resolve, reject); }
                    catch (error) { reject(error); }
                    return;
                }
                if (res.statusCode !== 200) { res.resume(); return reject(Error("Release download failed: HTTP " + res.statusCode)); }
                if (res.headers["content-length"] !== undefined && Number(res.headers["content-length"]) !== size) {
                    res.destroy(); return reject(Error("Download size differs from the signed release."));
                }
                const chunks = []; let received = 0;
                res.on("error", reject);
                res.on("aborted", () => reject(Error("Download interrupted. Your installed build is unchanged.")));
                res.on("data", chunk => {
                    received += chunk.length;
                    if (received > size) { res.destroy(Error("Download exceeds signed size.")); return; }
                    chunks.push(chunk);
                    progress(received, size);
                });
                res.on("end", () => {
                    if (received !== size || res.complete === false) return reject(Error("Download incomplete. Your installed build is unchanged."));
                    resolve(Buffer.concat(chunks));
                });
            });
            const timer = setTimeout(() => req.destroy(Error("Release download timed out.")), Math.max(1, deadline - Date.now()));
            req.on("close", () => clearTimeout(timer));
            req.on("error", reject);
        });
    }
    return request(raw, 0);
}

function createUpdater({ trust, context, latest = () => runtime.latest(trust), download = downloadArtifact }) {
    let pending, initialized = false;
    let state = { phase: "idle", installedVersion: "", keyId: "", availableVersion: "", received: 0, total: 0, error: "" };
    let tail = Promise.resolve();
    const set = values => { state = { ...state, ...values }; };
    const failed = (root, hash) => {
        const file = path.join(root, "failed.json");
        runtime.safePath(file);
        return fs.existsSync(file) && JSON.parse(fs.readFileSync(file, "utf8")).sha256 === hash;
    };
    function validate() {
        const c = context();
        runtime.safePath(c.root);
        const installed = runtime.verify(c.envelope, trust, "core", false);
        const envelope = JSON.parse(c.envelope.toString());
        if (path.resolve(c.payload) !== path.resolve(runtime.payloadPath(c.root, installed)) || c.sourceCommit !== installed.sourceCommit)
            throw Error("Running payload does not match its signed release identity. Reinstall with the verified EvenCord installer.");
        runtime.checkedFile(c.payload, installed.artifact);
        set({ installedVersion: installed.version, keyId: envelope.keyId });
        return { ...c, installed };
    }
    function compatible(c, manifest) {
        if (!manifest.discordArchives.includes(c.originalHash)) throw Error("This EvenCord release does not support your Discord Stable archive. Your current build is preserved. Wait for a compatible signed release; do not force installation.");
        if (failed(c.root, manifest.artifact.sha256)) throw Error("This release previously failed startup and was rolled back. Wait for a newer release or use the verified installer for reviewed recovery.");
    }
    function staged(c) {
        const selected = runtime.current(c.root, trust);
        if (selected.manifest.artifact.sha256 === c.installed.artifact.sha256) return undefined;
        // An authenticated previous build can be running after rollback. Never offer
        // restart into the failed selected build, or lose its recovery record.
        compatible(c, selected.manifest);
        runtime.advance(selected.manifest, c.installed);
        const highest = runtime.accepted(c.root, trust);
        if (highest) runtime.advance(selected.manifest, highest);
        set({ phase: "ready", availableVersion: selected.manifest.version, error: "", received: selected.manifest.artifact.size, total: selected.manifest.artifact.size });
        return selected.manifest;
    }
    function serial(work) {
        const job = tail.then(async () => {
            try { return await work(); }
            catch (error) { pending = undefined; set({ phase: "error", error: error.message }); throw error; }
        });
        tail = job.catch(() => {});
        return job;
    }
    return {
        status() {
            if (!initialized) {
                initialized = true;
                try { staged(validate()); }
                catch (error) { set({ phase: "error", error: error.message }); }
            }
            return { ...state };
        },
        check() {
            return serial(async () => {
                const c = validate();
                // Do not fetch another release while a verified update awaits restart.
                try { const ready = staged(c); if (ready) return ready; }
                catch (error) {
                    // A failed boot may recover directly to a later authenticated release.
                    const selected = runtime.current(c.root, trust);
                    if (!failed(c.root, selected.manifest.artifact.sha256)) throw error;
                }
                set({ phase: "checking", error: "", received: 0, total: 0 });
                const data = Buffer.from(await latest());
                const next = runtime.verify(data, trust);
                runtime.advance(next, c.installed);
                const highest = runtime.accepted(c.root, trust);
                if (highest) runtime.advance(next, highest);
                compatible(c, next);
                pending = runtime.compare(next.version, c.installed.version) > 0 ? data : undefined;
                set({ phase: pending ? "available" : "current", availableVersion: pending ? next.version : "" });
                return pending ? next : undefined;
            });
        },
        apply() {
            return serial(async () => {
                let c = validate();
                if (state.phase === "ready") {
                    if (staged(c)) return true;
                    throw Error("The staged update changed. Check for updates again.");
                }
                if (!pending) throw Error("Check for an approved update before downloading.");
                const data = pending; // Stable snapshot across asynchronous network operations.
                const next = runtime.verify(data, trust);
                runtime.advance(next, c.installed);
                compatible(c, next);
                set({ phase: "downloading", error: "", received: 0, total: next.artifact.size });
                const url = "https://github.com/" + next.repository + "/releases/download/core-v" + next.version + "/" + next.artifact.name;
                const bytes = Buffer.from(await download(url, next.artifact.size, (received, total) => set({ received, total })));
                set({ phase: "verifying" });
                // Revalidate the actual host and running identity after download.
                c = validate();
                compatible(c, next);
                runtime.verify(data, trust);
                if (bytes.length !== next.artifact.size || runtime.sha(bytes) !== next.artifact.sha256) throw Error("Artifact size or SHA-256 mismatch. Your installed build is unchanged.");
                set({ phase: "staging" });
                runtime.activate(c.root, data, bytes, trust);
                pending = undefined;
                const ready = staged(c);
                if (!ready || ready.artifact.sha256 !== next.artifact.sha256) throw Error("Update activation was not confirmed. Keep Discord open and use the installer to recover.");
                return true;
            });
        }
    };
}
module.exports = { createUpdater, downloadArtifact };
