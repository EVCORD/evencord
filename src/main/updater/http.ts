/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { DATA_DIR } from "@main/utils/constants";
import { checkedFetch, fetchJson } from "@main/utils/http";
import { Project } from "@shared/project";
import type { UpdateStatus } from "@shared/UpdateStatus";
import { VENCORD_USER_AGENT } from "@shared/vencordUserAgent";
import { createHash } from "crypto";
import { existsSync, renameSync, unlinkSync, writeFileSync } from "original-fs";
import { join } from "path";

import gitRemote from "~git-remote";

import type { Updater } from ".";
import { ASAR_FILE } from "./common";

interface Release {
    tag_name: string;
    body: string;
    target_commitish: string;
    assets: { name: string; browser_download_url: string; size: number; digest: string; }[];
}

let pending: Release["assets"][number] | undefined;
let operation: Promise<boolean> | undefined;
const status: UpdateStatus = { phase: "idle", installedVersion: VERSION, availableVersion: "", keyId: "", received: 0, total: 0, error: "" };
const target = IS_DISCORD_DESKTOP ? join(DATA_DIR, Project.storage.payload) : __dirname;
export const getUpdateStatus = (): UpdateStatus => ({ ...status });

async function listUpdates() {
    if (IS_UPDATER_DISABLED || status.phase === "ready") return [];
    status.phase = "checking";
    status.error = "";
    try {
        const release = await fetchJson<Release>(`https://api.github.com/repos/${gitRemote}/releases/latest`, {
            headers: { Accept: "application/vnd.github+json", "User-Agent": VENCORD_USER_AGENT },
            signal: AbortSignal.timeout(30_000)
        });
        const version = release.tag_name.replace(/^core-v/, "");
        if (!/^core-v\d+\.\d+\.\d+$/.test(release.tag_name)) throw new Error("The latest release has an unsupported version.");
        const parts = version.split(".").map(Number);
        const running = VERSION.split(".").map(Number);
        const difference = parts.map((part, i) => part - running[i]).find(part => part !== 0) || 0;
        if (difference <= 0) { pending = undefined; status.phase = "current"; return []; }
        const asset = release.assets.find(asset => asset.name === ASAR_FILE);
        if (!asset || !/^sha256:[a-f0-9]{64}$/.test(asset.digest) || asset.size <= 0 || asset.size > 134217728)
            throw new Error("The release payload or its GitHub digest is unavailable.");
        const expected = `https://github.com/${gitRemote}/releases/download/${release.tag_name}/${ASAR_FILE}`;
        if (asset.browser_download_url !== expected) throw new Error("The release payload belongs to another repository.");
        pending = asset;
        status.availableVersion = version;
        status.total = asset.size;
        status.phase = "available";
        return [{ hash: release.target_commitish, author: "EvenCord", message: version + "\n" + release.body }];
    } catch (error) {
        status.phase = "error";
        status.error = error instanceof Error ? error.message : String(error);
        throw error;
    }
}

async function downloadUpdate() {
    if (IS_UPDATER_DISABLED) return false;
    if (status.phase === "ready") return true;
    if (!pending) return false;
    const asset = pending;
    status.phase = "downloading";
    status.received = 0;
    status.error = "";
    const temporary = target + ".pending";
    try {
        const response = await checkedFetch(asset.browser_download_url, { signal: AbortSignal.timeout(120_000) });
        if (!response.body) throw new Error("The update download is empty.");
        const chunks: Uint8Array[] = [];
        for await (const chunk of response.body) {
            status.received += chunk.byteLength;
            if (status.received > asset.size) throw new Error("The update exceeds its published size.");
            chunks.push(chunk);
        }
        const data = Buffer.concat(chunks);
        status.phase = "verifying";
        if (data.length !== asset.size || "sha256:" + createHash("sha256").update(data).digest("hex") !== asset.digest)
            throw new Error("The update does not match its published digest.");
        writeFileSync(temporary, data, { flush: true });
        renameSync(temporary, target);
        status.phase = "ready";
        pending = undefined;
        return true;
    } catch (error) {
        if (existsSync(temporary)) unlinkSync(temporary);
        status.phase = "error";
        status.error = error instanceof Error ? error.message : String(error);
        throw error;
    }
}

async function applyUpdate() {
    if (operation) return operation;
    operation = downloadUpdate();
    try { return await operation; } finally { operation = undefined; }
}

export async function prepareUpdateRestart() {
    return status.phase === "ready";
}

const httpUpdater: Updater = {
    getRepo: async () => `https://github.com/${gitRemote}`,
    listUpdates,
    fetchUpdate: async () => status.phase === "ready" || Boolean(pending) || (await listUpdates()).length > 0,
    applyUpdate
};
export default httpUpdater;
