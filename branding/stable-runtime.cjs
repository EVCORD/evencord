/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
"use strict";
const legacy = require("./runtime.cjs");
const path = require("node:path");
let fs;
try { fs = require("original-fs"); } catch { fs = require("node:fs"); }
const {verify, sha, safePath, accepted, checkedFile, payloadPath, atomic, compare} = legacy;
function advance(next, old) {
    if (old.channel === "beta" && next.channel === "stable" && compare(next.version, old.version) > 0 && next.sequence > old.sequence)
        return legacy.advance(next, {...old, channel: "stable"});
    return legacy.advance(next, old);
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

module.exports = {...legacy, advance, activate};
