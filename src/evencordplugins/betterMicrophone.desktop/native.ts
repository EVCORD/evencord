/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
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

import { RendererSettings } from "@main/settings";
import { DATA_DIR } from "@main/utils/constants";
import { createHash, randomUUID } from "crypto";
import type { IpcMainInvokeEvent } from "electron";
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "original-fs";
import { join } from "path";

import { downloadArtifact } from "../../../branding/managed-updater.cjs";
import { safePath } from "../../../branding/runtime.cjs";
import pins from "./native-assets.json";

const cache = join(DATA_DIR, "plugins", "BetterMicrophone", pins.release);
let applying: Promise<{ patcherPath: string; iniPath: string; }> | undefined;
let applied = false;

async function resolveAssets() {
    applying ??= (async () => {
        if (process.platform !== "win32" || process.arch !== "x64") throw new Error("Native microphone patching supports Windows x64 only.");
        safePath(cache);
        mkdirSync(cache, { recursive: true });
        for (const asset of Object.values(pins.assets)) {
            const file = join(cache, asset.name);
            safePath(file);
            const valid = (bytes: Buffer) => bytes.length === asset.size && createHash("sha256").update(bytes).digest("hex") === asset.sha256;
            if (existsSync(file) && valid(readFileSync(file))) continue;
            const url = "https://github.com/" + pins.repository + "/releases/download/" + pins.release + "/" + asset.name;
            const bytes = Buffer.from(await downloadArtifact(url, asset.size, () => {}));
            if (!valid(bytes)) throw new Error("BetterMicrophone native asset failed size or SHA-256 verification.");
            const temp = file + "." + randomUUID() + ".tmp";
            try { writeFileSync(temp, bytes, { flag: "wx", mode: 0o600 }); renameSync(temp, file); }
            finally { if (existsSync(temp)) unlinkSync(temp); }
        }
        const source = readFileSync(join(cache, pins.assets.config.name), "utf8");
        const sections = source.split(/(?=^\[)/m).filter(block => /^\[(?!DropFrameBypass\]|PacerDrainRate\])[^\]]+\]/.test(block));
        const iniPath = join(cache, "microphone.ini");
        safePath(iniPath);
        const temp = iniPath + "." + randomUUID() + ".tmp";
        try { writeFileSync(temp, sections.join(""), { flag: "wx", mode: 0o600 }); renameSync(temp, iniPath); }
        finally { if (existsSync(temp)) unlinkSync(temp); }
        return { patcherPath: join(cache, pins.assets.addon.name), iniPath };
    })();
    try { return await applying; } finally { applying = undefined; }
}

async function invoke(event: IpcMainInvokeEvent, revert: boolean) {
    if (!revert && !RendererSettings.store.plugins?.BetterMicrophone?.nativePatching)
        throw new Error("Enable native microphone patching explicitly in BetterMicrophone settings first.");
    if (revert && !applied) return { ok: 0, failed: 0, skipped: 0, module_base: "" };
    const { patcherPath, iniPath } = await resolveAssets();
    const method = revert ? "revertPatches" : "applyPatches";
    const result: unknown = await event.sender.executeJavaScriptInIsolatedWorld(999, [{ code: `(() => {
        try {
            const requireFn = typeof globalThis.require === "function" ? globalThis.require : globalThis.process.getBuiltinModule("module").createRequire(${JSON.stringify(patcherPath)});
            return requireFn(${JSON.stringify(patcherPath)})[${JSON.stringify(method)}](${JSON.stringify(iniPath)});
        } catch (error) { return { error: error instanceof Error ? error.message : String(error) }; }
    })()` }]);
    if (!result || typeof result !== "object") throw new Error("Native microphone patcher returned no result.");
    if ("error" in result && typeof result.error === "string") throw new Error(result.error);
    if (!("ok" in result) || typeof result.ok !== "number") throw new Error("Native microphone patcher returned an invalid result.");
    const failed = "failed" in result && typeof result.failed === "number" ? result.failed : 0;
    applied = !revert || failed > 0;
    if (revert && failed > 0) throw new Error("Some native patches could not be restored. Restart Discord to complete restoration.");
    return { ok: result.ok, failed, skipped: "skipped" in result && typeof result.skipped === "number" ? result.skipped : 0, module_base: "module_base" in result ? String(result.module_base) : "" };
}

let operation: Promise<unknown> = Promise.resolve();
function queue(event: IpcMainInvokeEvent, revert: boolean) {
    const next = operation.then(() => invoke(event, revert));
    operation = next.catch(() => {});
    return next;
}
export const applyPatches = (event: IpcMainInvokeEvent) => queue(event, false);
export const revertPatches = (event: IpcMainInvokeEvent) => queue(event, true);
