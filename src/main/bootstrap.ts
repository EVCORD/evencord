/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { createHash } from "crypto";
import { existsSync, readFileSync } from "original-fs";
import { join, resolve } from "path";

import { DATA_DIR } from "./utils/constants";

function loadUpdate() {
    const pointer = join(DATA_DIR, "current-core.json");
    if (!existsSync(pointer)) return false;
    let payload: string;
    try {
        const update: unknown = JSON.parse(readFileSync(pointer, "utf8"));
        if (typeof update !== "object" || update === null ||
            !("version" in update) || typeof update.version !== "string" || !/^\d+\.\d+\.\d+$/.test(update.version) ||
            !("sha256" in update) || typeof update.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(update.sha256) ||
            !("size" in update) || !Number.isSafeInteger(update.size) || typeof update.size !== "number" || update.size <= 0 || update.size > 134217728)
            throw Error("The saved update information is invalid.");
        const running = VERSION.split(".").map(Number);
        const difference = update.version.split(".").map((part, i) => Number(part) - running[i]).find(part => part !== 0) || 0;
        if (difference <= 0) return false;
        payload = join(DATA_DIR, "releases", update.sha256 + ".asar");
        if (resolve(payload) === resolve(__dirname)) return false;
        const bytes = readFileSync(payload);
        if (bytes.length !== update.size || createHash("sha256").update(bytes).digest("hex") !== update.sha256)
            throw Error("The saved update does not match its verified download.");
    } catch (error) {
        console.error("[EvenCord] Could not activate the saved update. Loading the installed version.", error);
        return false;
    }
    require(join(payload, "patcher.js"));
    return true;
}

if (!loadUpdate()) require("./index");
