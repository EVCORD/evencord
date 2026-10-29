/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Project } from "@shared/project";
import { resolve } from "path";

import runtime from "../../../branding/runtime.cjs";
import trust from "../../../branding/trust.json";
import type { Updater } from ".";

let pending: Buffer | undefined;
function requireChannel() {
    if (!Project.capabilities.distribution || !Project.capabilities.updates || Object.keys(trust.keys).length === 0)
        throw new Error("EvenCord releases are unavailable. Production signing and release activation are not configured.");
    if (process.platform !== "win32" || process.arch !== "x64")
        throw new Error("EvenCord updates support Windows x64 only.");
    const root = process.env.EVENCORD_MANAGED_ROOT;
    if (!root) throw new Error("This is not a managed EvenCord installation. Source checkouts are never updated by the client.");
    return runtime.safePath(root);
}
function running(root: string) {
    const encoded = process.env.EVENCORD_RUNNING_RELEASE;
    if (!encoded) throw new Error("The running release has no authenticated identity.");
    const m = runtime.verify(Buffer.from(encoded, "base64"), trust, "core", false);
    if (resolve(runtime.payloadPath(root, m)) !== resolve(__dirname))
        throw new Error("Running payload does not match its release identity.");
    return m;
}
async function check() {
    const root = requireChannel();
    const installed = running(root);
    const bytes = await runtime.download("https://github.com/" + Project.repositories.core.slug + "/releases/latest/download/core.release.json", 131072);
    const data = Buffer.from(bytes as Uint8Array);
    const next = runtime.verify(data, trust);
    runtime.advance(next, installed);
    const highest = runtime.accepted(root, trust);
    if (highest) runtime.advance(next, highest);
    const newer = runtime.compare(next.version, installed.version) > 0;
    pending = newer ? data : undefined;
    return newer ? next : undefined;
}
const secureUpdater: Updater = {
    getRepo: async () => Project.links.source,
    listUpdates: async () => {
        const next = await check();
        return next ? [{ hash: next.sourceCommit, author: "EvenCord release", message: next.version + "\n" + next.notes }] : [];
    },
    fetchUpdate: async () => Boolean(await check()),
    applyUpdate: async () => {
        const root = requireChannel();
        if (!pending) throw new Error("No verified release is pending.");
        const next = runtime.verify(pending, trust);
        runtime.advance(next, running(root));
        const url = "https://github.com/" + next.repository + "/releases/download/core-v" + next.version + "/" + next.artifact.name;
        const bytes = await runtime.download(url, next.artifact.size);
        runtime.activate(root, pending, Buffer.from(bytes as Uint8Array), trust);
        pending = undefined;
        return true;
    }
};
export default secureUpdater;
