/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";

export const officialPluginRoots = ["plugins", "equicordplugins", "evencordplugins"];
export const pluginOverrides = {
    "src/equicordplugins/quoter": "src/evencordplugins/quoterEnhanced"
};
export function includePlugin(folder) {
    const replacement = pluginOverrides[folder.replaceAll("\\", "/")];
    if (!replacement) return true;
    if (!existsSync(resolve(replacement, "index.tsx")) && !existsSync(resolve(replacement, "index.ts")))
        throw new Error("Missing official plugin override: " + replacement);
    return false;
}
export function pluginSource(folder) {
    if (folder.startsWith("src/evencordplugins/")) return "evencord";
    if (folder.startsWith("src/equicordplugins/")) return "equicord";
    if (folder.startsWith("src/plugins/")) return "vencord";
    return "user";
}
