/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { IpcMainInvokeEvent } from "electron";

const MEDIA_HOSTS = new Set([
    "cdn.discordapp.com", "media.discordapp.net", "images-ext-1.discordapp.net", "images-ext-2.discordapp.net",
    "media.tenor.com", "static.klipy.com", "media.klipy.com", "media.giphy.com", "i.giphy.com",
    "media0.giphy.com", "media1.giphy.com", "media2.giphy.com", "media3.giphy.com", "media4.giphy.com"
]);

function allowedUrl(raw: unknown, page: boolean): URL | undefined {
    if (typeof raw !== "string" || raw.length > 8192) return;
    try {
        const url = new URL(raw);
        if (url.protocol !== "https:" || url.username || url.password || url.port) return;
        if (page) {
            if (/^(?:www\.)?(?:klipy\.com|tenor\.com|giphy\.com)$/.test(url.hostname)
                && /^\/(?:gifs|view|clips)\//.test(url.pathname)) return url;
        } else if (MEDIA_HOSTS.has(url.hostname)) {
            if (url.hostname.endsWith("discordapp.com") && !/^\/(?:attachments|stickers|avatars|guilds|emojis|embed)\//.test(url.pathname)) return;
            if (url.hostname === "media.discordapp.net" && !/^\/(?:attachments|stickers|avatars|guilds|emojis|embed|external)\//.test(url.pathname)) return;
            if (url.hostname.startsWith("images-ext-") && !url.pathname.startsWith("/external/")) return;
            return url;
        }
    } catch { return; }
}

type ResourceResult = { ok: true; data: Uint8Array; type: string; } | { ok: false; error: string; unsupported?: boolean; };

export async function fetchResource(_: IpcMainInvokeEvent, raw: unknown, mode: unknown): Promise<ResourceResult> {
    if (mode !== "page" && mode !== "media") return { ok: false, error: "Invalid media request." };
    const page = mode === "page";
    let url = allowedUrl(raw, page);
    if (!url) return { ok: false, error: "This host or path is not supported by the desktop media downloader.", unsupported: true };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const limit = page ? 2 * 1024 * 1024 : 30 * 1024 * 1024;
    try {
        for (let redirect = 0; redirect <= 4; redirect++) {
            const response = await fetch(url, {
                redirect: "manual", signal: controller.signal, credentials: "omit",
                headers: { Accept: page ? "text/html,application/xhtml+xml" : "image/*,video/*,application/octet-stream" }
            });
            if ([301, 302, 303, 307, 308].includes(response.status)) {
                const location = response.headers.get("location");
                await response.body?.cancel();
                url = location ? allowedUrl(new URL(location, url).href, page) : undefined;
                if (!url) return { ok: false, error: "Media redirected to an unsupported host or path." };
                continue;
            }
            if (!response.ok) {
                await response.body?.cancel();
                return { ok: false, error: `Media server returned HTTP ${response.status}.${response.status === 403 || response.status === 404 || response.status === 410 ? " The link may be expired, unavailable, or access restricted." : ""}` };
            }
            const type = (response.headers.get("content-type") || "application/octet-stream").split(";")[0].toLowerCase();
            if (!page && !/^(?:image|video)\//.test(type) && /(?:html|json|xml)/.test(type)) {
                await response.body?.cancel();
                return { ok: false, error: "The media URL returned a page instead of an image or video." };
            }
            if (Number(response.headers.get("content-length")) > limit) {
                await response.body?.cancel();
                return { ok: false, error: page ? "GIF page exceeds 2 MB." : "Media exceeds 30 MB." };
            }
            if (!response.body) return { ok: false, error: "The media server returned an empty response." };
            const reader = response.body.getReader();
            const chunks: Uint8Array[] = [];
            let length = 0;
            try {
                for (;;) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    length += value.byteLength;
                    if (length > limit) {
                        await reader.cancel();
                        return { ok: false, error: page ? "GIF page exceeds 2 MB." : "Media exceeds 30 MB." };
                    }
                    chunks.push(value);
                }
            } finally { reader.releaseLock(); }
            if (!length) return { ok: false, error: "The media server returned an empty response." };
            const data = new Uint8Array(length);
            let offset = 0;
            for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.byteLength; }
            return { ok: true, data, type };
        }
        return { ok: false, error: "Media redirected too many times." };
    } catch {
        return { ok: false, error: controller.signal.aborted ? "Media download timed out." : "Desktop media download failed. The server may be unavailable or access restricted." };
    } finally { clearTimeout(timer); }
}
