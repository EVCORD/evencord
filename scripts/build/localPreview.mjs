/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { readFileSync } from "node:fs";
import { project } from "../project.mjs";

export const localPreviewPlugin = {
    name: "evencord-local-preview-trust",
    setup(build) {
        const file = process.env.EVENCORD_LOCAL_TRUST;
        if (!file) return;
        if (Object.values(project.capabilities).some(Boolean))
            throw new Error("Local previews require all production capabilities to remain disabled.");
        const contents = readFileSync(file, "utf8");
        const trust = JSON.parse(contents);
        const keys = Object.entries(trust.keys);
        if (trust.schemaVersion !== 1 || keys.length !== 1 || !keys[0][0].startsWith("local-preview-") || Buffer.from(keys[0][1], "base64").length !== 32)
            throw new Error("Expected a dedicated local preview public key.");
        build.onLoad({ filter: /[\\/]branding[\\/]trust\.json$/ }, () => ({ contents, loader: "json" }));
        console.log("Building a private EvenCord preview. Public distribution and updates remain disabled.");
    }
};
