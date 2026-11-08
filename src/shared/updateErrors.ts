/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export function formatUpdateError(error: unknown): string {
    const message = typeof error === "string" ? error
        : error && typeof error === "object" && "message" in error && typeof error.message === "string" ? error.message : "";
    if (/\b(?:408|500|502|503|504)\b|timeout|timed? out|could not reach|fetch failed|network|ECONN|ENOTFOUND/i.test(message))
        return "Couldn't reach the update server. Try again shortly. Your current version is unchanged.";
    if (/\b429\b|rate limit/i.test(message))
        return "GitHub is limiting update requests. Please try again later.";
    if (!message || message.length > 240 || /[<>\r\n]|&lt;|data:|https?:\/\//i.test(message))
        return "The update could not complete. Please try again. Details are available in the console.";
    return message;
}
