/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface UpdateStatus {
    phase: string;
    installedVersion: string;
    keyId: string;
    availableVersion: string;
    received: number;
    total: number;
    error: string;
}
