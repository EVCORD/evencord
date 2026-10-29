/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { PluginNative } from "@utils/types";
import { Constants, RestAPI } from "@webpack/common";

export interface MediaCandidate {
    url: string;
    kind: "image" | "video";
    animated?: boolean;
}

export interface QuoteMedia extends MediaCandidate {
    sticker?: boolean;
    sources?: MediaCandidate[];
    aliases?: string[];
    pageUrl?: string;
    expectAnimation?: boolean;
}

type OptionalUrl = { url?: string; proxy_url?: string; proxyURL?: string; content_type?: string; contentType?: string; srcIsAnimated?: boolean; };
type AttachmentLike = OptionalUrl & { filename?: string; };
type StickerLike = { id?: string; format_type?: number; formatType?: number; };
type EmbedLike = { type?: string; url?: string; image?: OptionalUrl; thumbnail?: OptionalUrl; video?: OptionalUrl; };
export interface MediaMessage {
    content?: string;
    attachments?: AttachmentLike[];
    embeds?: EmbedLike[];
    stickerItems?: StickerLike[];
    sticker_items?: StickerLike[];
}

const DIRECT_IMAGE = /\.(?:gif|png|jpe?g|webp|avif|apng)(?:[?#]|$)/i;
const DIRECT_VIDEO = /\.(?:mp4|webm)(?:[?#]|$)/i;
const URLS_IN_TEXT = /https?:\/\/[^\s<>"']+/gi;
const PROVIDER_PAGE = /^https:\/\/(?:www\.)?(?:klipy\.com\/gifs\/|tenor\.com\/view\/|giphy\.com\/(?:gifs|clips)\/)/i;

function asUrl(value: unknown): string | undefined {
    if (typeof value !== "string" || value.length > 8192) return;
    try {
        const url = new URL(value);
        if (url.protocol !== "https:" || url.username || url.password) return;
        return url.href;
    } catch { return; }
}

function trimLink(value: string): string { return value.replace(/[),.;!?]+$/, ""); }

function animatedUrl(url: string): boolean {
    const parsed = new URL(url);
    return /\.(?:gif|apng)(?:[?#]|$)/i.test(url) && !/^(?:png|jpe?g)$/i.test(parsed.searchParams.get("format") || "");
}

function candidates(value?: OptionalUrl, kind: MediaCandidate["kind"] = "image"): MediaCandidate[] {
    if (!value) return [];
    const type = value.content_type ?? value.contentType ?? "";
    return [...new Set([value.url, value.proxy_url, value.proxyURL])].flatMap(raw => {
        const url = asUrl(raw);
        if (!url) return [];
        const actualKind: MediaCandidate["kind"] = DIRECT_IMAGE.test(url) ? "image" : DIRECT_VIDEO.test(url) || type.startsWith("video/") ? "video" : kind;
        return [{ url, kind: actualKind, animated: actualKind === "video" || animatedUrl(url) || !!value.srcIsAnimated }];
    });
}

function mediaKey(raw: string): string {
    const url = new URL(raw);
    const proxy = /^\/external\/[^/]+\/https?\/(.+)$/.exec(url.pathname);
    if (/^images-ext-[12]\.discordapp\.net$/.test(url.hostname) && proxy) {
        const original = asUrl(`https://${proxy[1]}${url.search}`);
        if (original) {
            const parsed = new URL(original);
            for (const key of ["width", "height", "format", "quality"]) parsed.searchParams.delete(key);
            return mediaKey(parsed.href);
        }
    }
    if (url.hostname === "media.tenor.com") {
        const tenor = /^\/([^/]+)\/(?:[^/]+\/)?tenor\.(?:gif|png|jpe?g|webp|mp4|webm)$/.exec(url.pathname);
        if (tenor) return `tenor:${tenor[1]}`;
    }
    if (/^(?:i|media[0-4]?)\.giphy\.com$/.test(url.hostname)) {
        const giphy = /^\/media\/(?:v1\.[^/]+\/)?([^/]+)\//.exec(url.pathname);
        if (giphy) return `giphy:${giphy[1]}`;
    }
    if (["cdn.discordapp.com", "media.discordapp.net"].includes(url.hostname)) {
        const attachment = /^\/attachments\/\d+\/(\d+)\//.exec(url.pathname);
        if (attachment) return `attachment:${attachment[1]}`;
        const sticker = /^\/stickers\/(\d+)\./.exec(url.pathname);
        if (sticker) return `sticker:${sticker[1]}`;
    }
    url.hash = "";
    return url.href.replace(/\/$/, "");
}

function sourceRank(source: MediaCandidate): number {
    const url = new URL(source.url);
    const expiry = url.searchParams.get("ex");
    const expired = expiry && /^[\da-f]+$/i.test(expiry) && parseInt(expiry, 16) * 1000 <= Date.now();
    return (source.animated ? 10 : 0) + (animatedUrl(source.url) ? 2 : 0) - (expired ? 4 : 0);
}

export async function refreshQuoteMedia(media: QuoteMedia[], warn: (message: string) => void, signal?: AbortSignal, force = false): Promise<QuoteMedia[]> {
    const urls = [...new Set(media.flatMap(item => (item.sources ?? [item]).map(source => source.url)))].filter(raw => {
        const url = new URL(raw);
        if (!["cdn.discordapp.com", "media.discordapp.net"].includes(url.hostname) || !/^\/attachments\/\d+\/\d+\//.test(url.pathname)) return false;
        const expiry = url.searchParams.get("ex");
        return force || !expiry || !/^[\da-f]+$/i.test(expiry) || parseInt(expiry, 16) * 1000 <= Date.now() + 60000;
    }).slice(0, 50);
    if (!urls.length) return media;
    signal?.throwIfAborted();
    try {
        const response = await RestAPI.post({ url: Constants.Endpoints.ATTACHMENTS_REFRESH_URLS, body: { attachment_urls: urls }, retries: 0 });
        signal?.throwIfAborted();
        const { body } = response;
        if (!response.ok || !body || typeof body !== "object" || !("refreshed_urls" in body) || !Array.isArray(body.refreshed_urls)) throw new Error("Discord did not return refreshed attachment URLs.");
        const refreshed = new Map<string, string>();
        for (const value of body.refreshed_urls) {
            if (!value || typeof value !== "object" || !("original" in value) || !("refreshed" in value)) continue;
            const url = asUrl(value.refreshed);
            const original = asUrl(value.original);
            if (original && url && mediaKey(url) === mediaKey(original)) {
                const host = new URL(url).hostname;
                if (["cdn.discordapp.com", "media.discordapp.net"].includes(host)) {
                    for (const requested of urls) if (mediaKey(requested) === mediaKey(original)) refreshed.set(requested, url);
                }
            }
        }
        if (!refreshed.size) warn("Discord could not refresh the attachment link. Trying the available media URLs.");
        return consolidate(media.map(item => {
            const sources = item.sources ?? [item];
            return { ...item, sources: [...sources.flatMap(source => {
                const url = refreshed.get(source.url);
                return url ? [{ ...source, url }] : [];
            }), ...sources] };
        }));
    } catch {
        signal?.throwIfAborted();
        warn("Discord could not refresh the attachment link. Trying the available media URLs.");
        return media;
    }
}

function consolidate(items: QuoteMedia[]): QuoteMedia[] {
    const result: QuoteMedia[] = [];
    for (const item of items) {
        const aliases = [...new Set([item.url, ...(item.aliases ?? []), ...(item.sources ?? []).map(source => source.url)])];
        const keys = new Set(aliases.map(mediaKey));
        const matches = result.filter(other => [other.url, ...(other.aliases ?? [])].some(url => keys.has(mediaKey(url))));
        const sources = [...matches.flatMap(other => other.sources ?? [other]), ...(item.sources ?? [item])];
        const byUrl = new Map<string, MediaCandidate>();
        for (const source of sources) byUrl.set(source.url, { ...source, animated: source.animated || byUrl.get(source.url)?.animated });
        const unique = [...byUrl.values()].sort((a, b) => sourceRank(b) - sourceRank(a));
        const merged: QuoteMedia = {
            ...item, ...unique[0], sources: unique,
            aliases: [...new Set([...aliases, ...matches.flatMap(other => other.aliases ?? [other.url])])],
            sticker: item.sticker || matches.some(other => other.sticker),
            pageUrl: item.pageUrl ?? matches.find(other => other.pageUrl)?.pageUrl,
            expectAnimation: item.expectAnimation || sources.some(source => source.animated) || matches.some(other => other.expectAnimation)
        };
        const index = matches.length ? result.indexOf(matches[0]) : result.length;
        for (const match of matches) result.splice(result.indexOf(match), 1);
        result.splice(index, 0, merged);
    }
    return result;
}

export function getQuoteMedia(message: MediaMessage): QuoteMedia[] {
    const items: QuoteMedia[] = [];
    const add = (sources: MediaCandidate[], aliases: string[] = [], extra: Partial<QuoteMedia> = {}) => {
        if (sources.length) items.push({ ...sources[0], ...extra, sources, aliases: aliases.filter(url => !!asUrl(url)) });
    };
    for (const file of message.attachments ?? []) {
        const type = file.content_type ?? file.contentType ?? "";
        const url = file.url ?? file.proxy_url ?? file.proxyURL ?? "";
        if (type.startsWith("image/") || DIRECT_IMAGE.test(url) || DIRECT_IMAGE.test(file.filename ?? "")) add(candidates(file));
        else if (type.startsWith("video/") || DIRECT_VIDEO.test(url)) add(candidates(file, "video"));
    }
    for (const sticker of [...(message.stickerItems ?? []), ...(message.sticker_items ?? [])]) {
        if (!sticker.id || !/^\d+$/.test(sticker.id)) continue;
        const format = sticker.format_type ?? sticker.formatType ?? 1;
        // Discord: 1 PNG, 2 APNG, 3 Lottie, 4 GIF. Lottie requires a vector
        // renderer; Discord CDN's PNG preview is used for now (static frame).
        const url = `https://media.discordapp.net/stickers/${sticker.id}.${format === 4 ? "gif" : "png"}?size=320`;
        add([{ url, kind: "image", animated: format === 2 || format === 4 }], [], { sticker: true });
    }
    for (const embed of message.embeds ?? []) {
        const pageUrl = asUrl(embed.url);
        const isProvider = !!pageUrl && PROVIDER_PAGE.test(pageUrl);
        const sources = [
            ...candidates(embed.video, "video"), ...candidates(embed.image), ...candidates(embed.thumbnail)
        ];
        if (!sources.length && pageUrl && (DIRECT_IMAGE.test(pageUrl) || DIRECT_VIDEO.test(pageUrl))) {
            sources.push({ url: pageUrl, kind: DIRECT_VIDEO.test(pageUrl) ? "video" : "image", animated: animatedUrl(pageUrl) });
        }
        add(sources, pageUrl ? [pageUrl] : [], { pageUrl: isProvider ? pageUrl : undefined, expectAnimation: isProvider || embed.type === "gifv" });
    }
    for (const match of (message.content ?? "").matchAll(URLS_IN_TEXT)) {
        const url = asUrl(trimLink(match[0]));
        if (!url) continue;
        if (DIRECT_IMAGE.test(url) || DIRECT_VIDEO.test(url)) add([{ url, kind: DIRECT_VIDEO.test(url) ? "video" : "image", animated: animatedUrl(url) || DIRECT_VIDEO.test(url) }]);
    }
    return consolidate(items).slice(0, 4);
}

/** Hide stand-alone media page URLs only when media actually resolved. */
export function quoteContent(message: MediaMessage, media: QuoteMedia[]): string {
    const displayed = new Set(media.flatMap(item => [item.url, ...(item.aliases ?? [])]).map(mediaKey));
    return (message.content ?? "").replace(URLS_IN_TEXT, raw => {
        const url = asUrl(trimLink(raw));
        return url && displayed.has(mediaKey(url)) ? raw.slice(trimLink(raw).length) : raw;
    }).trim();
}

export async function fetchQuoteResource(raw: string, page = false, signal?: AbortSignal): Promise<Blob> {
    const url = asUrl(raw);
    if (!url) throw new Error("Media requires a valid HTTPS URL.");
    signal?.throwIfAborted();
    const Native = !IS_WEB ? VencordNative.pluginHelpers["Quoter Enhanced"] as PluginNative<typeof import("./native")> | undefined : undefined;
    let nativeError = "";
    if (Native?.fetchResource) {
        const result = await Native.fetchResource(url, page ? "page" : "media").catch(() => undefined);
        signal?.throwIfAborted();
        if (result?.ok) return new Blob([new Uint8Array(result.data)], { type: result.type });
        if (result && !result.ok) {
            nativeError = result.error;
            if (!result.unsupported) throw new Error(nativeError);
        }
    }
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(abort, 12000);
    try {
        const response = await fetch(url, { credentials: "omit", referrerPolicy: "no-referrer", signal: controller.signal });
        if (!response.ok) {
            await response.body?.cancel();
            throw new Error(`Media server returned HTTP ${response.status}. The URL may be expired or access restricted.`);
        }
        const limit = (page ? 2 : 30) * 1024 * 1024;
        if (!response.body) throw new Error("Media response is empty.");
        const reader = response.body.getReader();
        const chunks: Uint8Array<ArrayBuffer>[] = [];
        let size = 0;
        try {
            for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                size += value.byteLength;
                if (size > limit) { await reader.cancel(); throw new Error(page ? "GIF page exceeds 2 MB." : "Media exceeds 30 MB."); }
                chunks.push(new Uint8Array(value));
            }
        } finally { reader.releaseLock(); }
        if (!size) throw new Error("Media response is empty.");
        return new Blob(chunks, { type: response.headers.get("content-type") ?? "application/octet-stream" });
    } catch (error) {
        signal?.throwIfAborted();
        throw new Error(controller.signal.aborted ? "Media download timed out." : error instanceof TypeError ? "Media download was blocked by CORS, the client security policy, or the network." : error instanceof Error ? error.message : nativeError || "Media download failed.");
    } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
    }
}

/** Resolve a provider webpage when Discord did not include a usable embed.
 * Browser CORS may block this; fail visibly rather than silently quote the URL.
 * Never invent a GIF URL from a page slug.
 */
export async function resolveMissingPageMedia(message: MediaMessage, media: QuoteMedia[], warn: (message: string) => void, signal?: AbortSignal): Promise<QuoteMedia[]> {
    const pages = [...new Set([
        ...Array.from((message.content ?? "").matchAll(URLS_IN_TEXT), match => trimLink(match[0])),
        ...(message.embeds ?? []).map(embed => embed.url ?? "")
    ].filter(url => !!asUrl(url) && PROVIDER_PAGE.test(url)))].slice(0, 4);
    let result = media;
    for (const page of pages) {
        const existing = result.find(item => [item.url, ...(item.aliases ?? [])].some(url => mediaKey(url) === mediaKey(page)));
        if (existing?.sources?.some(source => source.animated)) continue;
        try {
            const html = await (await fetchQuoteResource(page, true, signal)).text();
            const doc = new DOMParser().parseFromString(html, "text/html");
            const sources: MediaCandidate[] = [];
            const add = (raw: unknown, kind?: MediaCandidate["kind"]) => {
                if (typeof raw !== "string") return;
                let url: string | undefined;
                try { url = asUrl(new URL(raw, page).href); } catch { return; }
                if (!url || (!DIRECT_IMAGE.test(url) && !DIRECT_VIDEO.test(url) && !kind)) return;
                const actualKind = DIRECT_VIDEO.test(url) ? "video" : DIRECT_IMAGE.test(url) ? "image" : kind ?? "image";
                sources.push({ url, kind: actualKind, animated: actualKind === "video" || animatedUrl(url) });
            };
            for (const meta of doc.getElementsByTagName("meta")) {
                const key = (meta.getAttribute("property") ?? meta.getAttribute("name") ?? "").toLowerCase();
                if (/^(?:og:video(?::(?:url|secure_url))?|twitter:player:stream)$/.test(key)) add(meta.content, "video");
                else if (/^(?:og:image(?::(?:url|secure_url))?|twitter:image(?::src)?)$/.test(key)) add(meta.content, "image");
            }
            const slug = new URL(page).pathname.split("/").filter(Boolean).at(-1);
            const visit = (value: unknown, depth = 0, current = false) => {
                if (!value || typeof value !== "object" || depth > 12) return;
                if (Array.isArray(value)) { value.slice(0, 100).forEach(item => visit(item, depth + 1, current)); return; }
                const object = value as Record<string, unknown>;
                const type = object["@type"];
                if (typeof object.slug === "string" && object.slug !== slug) return;
                const selected = current || type === "VideoObject" || type === "ImageObject" || object.slug === slug;
                const video = type === "VideoObject";
                for (const [key, child] of Object.entries(object)) {
                    if (/^(?:related|recommendations?|suggested|trending|results|itemListElement)$/i.test(key)) continue;
                    if (selected && ["url", "contentUrl", "content_url", "gif", "gifUrl", "gif_url", "mp4", "mp4Url", "mp4_url", "webm"].includes(key)) {
                        if (typeof child === "string") add(child, /mp4|webm/i.test(key) || video && key !== "url" ? "video" : undefined);
                        else if (child && typeof child === "object" && "url" in child) add(child.url, /mp4|webm/i.test(key) ? "video" : "image");
                    }
                    visit(child, depth + 1, selected || /^(?:gif|clip|media|post)$/.test(key) && !Array.isArray(child));
                }
            };
            for (const script of doc.getElementsByTagName("script")) {
                if (script.type !== "application/ld+json" && script.id !== "__NEXT_DATA__") continue;
                try { visit(JSON.parse(script.textContent ?? "")); } catch { continue; }
            }
            const animated = sources.filter(source => source.animated);
            const usable = animated.length ? animated : sources;
            if (usable.length) {
                result = consolidate([...result, { ...usable[0], sources: usable, aliases: [page], pageUrl: page, expectAnimation: true }]).slice(0, 4);
            } else warn("The GIF provider did not expose an animated resource. Its link or available preview was retained.");
        } catch (error) {
            signal?.throwIfAborted();
            warn(`Could not resolve the GIF page. ${error instanceof Error ? error.message : "Provider access failed."} Its link or available preview was retained.`);
        }
    }
    return result;
}
