/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Project } from "@shared/project";
import type { UpdateStatus } from "@shared/UpdateStatus";
import loaderSource from "file://../../../branding/loader.cjs?trim=false";
import engineSource from "file://../../../branding/runtime.cjs?trim=false";
import trustSource from "file://../../../branding/trust.json?trim=false";
import { dirname, join, resolve } from "path";

import gitHash from "~git-hash";

import host from "../../../branding/host.cjs";
import { createUpdater } from "../../../branding/managed-updater.cjs";
import runtime from "../../../branding/runtime.cjs";
import trust from "../../../branding/trust.json";
import type { Updater } from ".";

const managed = createUpdater({
    trust,
    context() {
        if (!Project.capabilities.distribution || !Project.capabilities.updates || Object.keys(trust.keys).length === 0)
            throw new Error("Beta updates are unavailable in this build. Use the verified EvenCord installer for the one-time upgrade.");
        if (process.platform !== "win32" || process.arch !== "x64") throw new Error("EvenCord updates support Windows x64 only.");
        const root = process.env.EVENCORD_MANAGED_ROOT;
        const encoded = process.env.EVENCORD_RUNNING_RELEASE;
        if (!root || !encoded) throw new Error("This is not a managed signed EvenCord installation. Source checkouts must be updated manually.");
        const resources = join(dirname(process.execPath), "resources");
        const owner = host.ownership(resources, loaderSource.replaceAll("\r\n", "\n"), engineSource.replaceAll("\r\n", "\n"), trustSource.replaceAll("\r\n", "\n"));
        if (resolve(root) !== resolve(owner.dataRoot)) throw new Error("The running data root does not match the EvenCord loader.");
        return { root: runtime.safePath(root), envelope: Buffer.from(encoded, "base64"), payload: __dirname, sourceCommit: gitHash, originalHash: owner.originalSHA256 };
    }
});

export const getUpdateStatus = (): UpdateStatus => managed.status();
const secureUpdater: Updater = {
    getRepo: async () => Project.links.source,
    listUpdates: async () => {
        const next = await managed.check();
        return next ? [{ hash: next.sourceCommit, author: "EvenCord release", message: next.version + "\n" + next.notes }] : [];
    },
    fetchUpdate: async () => Boolean(await managed.check()),
    applyUpdate: () => managed.apply()
};
export default secureUpdater;
