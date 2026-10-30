/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Project } from "@shared/project";
import legacyTrustSource from "file://../../branding/legacy-trust.json?trim=false";
import loaderSource from "file://../../branding/loader.cjs?trim=false";
import engineSource from "file://../../branding/runtime.cjs?trim=false";
import trustSource from "file://../../branding/trust.json?trim=false";
import { readdirSync, statSync } from "original-fs";
import { basename, dirname, join } from "path";

import { migrate } from "../../branding/channel-migration.cjs";
import host from "../../branding/host.cjs";
import trust from "../../branding/trust.json";

const VERSION_PREFIX = "app-";
export const isAlreadyPatched = (resources: string) => {
    try {
        host.ownership(resources, loaderSource.replaceAll("\r\n", "\n"), engineSource.replaceAll("\r\n", "\n"), trustSource.replaceAll("\r\n", "\n"));
        return true;
    } catch {
        return false;
    }
};
export const patchResourcesDir = (resources: string, _patcherJsPath: string): boolean => {
    if (!Project.capabilities.distribution || !Project.capabilities.hostRepatch) return false;
    if (process.platform !== "win32" || process.arch !== "x64") throw new Error("Host persistence supports Windows x64 only.");
    if (process.env.DISABLE_UPDATER_AUTO_PATCHING && !isAlreadyPatched(resources)) throw new Error("Automatic Discord repatching is disabled by the environment. Use the verified installer before restarting.");
    migrate(join(dirname(process.execPath), "resources"), loaderSource.replaceAll("\r\n", "\n"), engineSource.replaceAll("\r\n", "\n"), legacyTrustSource.replaceAll("\r\n", "\n"), trustSource.replaceAll("\r\n", "\n"));
    return host.persist(resources, join(dirname(process.execPath), "resources"), trust,
        loaderSource.replaceAll("\r\n", "\n"), engineSource.replaceAll("\r\n", "\n"), trustSource.replaceAll("\r\n", "\n"));
};

const parsePart = (s: string) => parseInt(s, 10) || 0;

const isNewer = ($new: string, old: string): boolean => {
    const newParts = $new.slice(VERSION_PREFIX.length).split(".").map(parsePart);
    const oldParts = old.slice(VERSION_PREFIX.length).split(".").map(parsePart);
    const len = Math.max(newParts.length, oldParts.length);
    for (let i = 0; i < len; i++) {
        const n = newParts[i] ?? 0;
        const o = oldParts[i] ?? 0;
        if (n > o) return true;
        if (n < o) return false;
    }
    return false;
};

/**
 * find the newest sibling `app-VERSION` directory's `resources/` path.
 *
 * squirrel-only layout. returns `null` on non-win32 platforms, or when
 * the running process is already in the newest sibling.
 */
export const findStaleSibling = (currentExeDir: string): string | null => {
    if (process.platform !== "win32") return null;

    const discordPath = dirname(currentExeDir);
    const currentVersion = basename(currentExeDir);

    let latest = currentVersion;
    try {
        for (const name of readdirSync(discordPath)) {
            if (!name.startsWith(VERSION_PREFIX)) continue;
            let isDir = false;
            try {
                isDir = statSync(join(discordPath, name)).isDirectory();
            } catch (statErr) {
                console.error("[EvenCord] Skipping unreadable sibling", name, statErr);
                continue;
            }
            if (!isDir) continue;
            if (isNewer(name, latest)) latest = name;
        }
    } catch (err) {
        console.error("[EvenCord] Failed to scan for sibling versions", err);
        return null;
    }

    if (latest === currentVersion) return null;
    return join(discordPath, latest, "resources");
};
