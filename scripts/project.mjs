/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { readFileSync } from "node:fs";

export const project = JSON.parse(readFileSync(new URL("../branding/project.json", import.meta.url), "utf8"));
export function requireDistribution() {
    if (!project.capabilities.distribution || !project.capabilities.installation)
        throw new Error(project.displayName + " installation and downloads are disabled until Phase 3.");
}
