/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { sleep } from "@utils/misc";
import { User } from "@vencord/discord-types";
import { IconUtils, UserStore } from "@webpack/common";
import { applyPalette, GIFEncoder, quantize } from "gifenc";
import { decompressFrame, parseGIF } from "gifuct-js";

import { fetchQuoteResource, MediaCandidate, quoteContent, QuoteMedia, refreshQuoteMedia, resolveMissingPageMedia } from "./media";
import { CANVAS_CONFIG, CanvasConfig, FONT_SIZES, FontSizeCalculation, QuoteFont, QuoteImageOptions, SPACING } from "./types";

const CUSTOM_EMOJI_REGEX = /<a?:(\w+):(\d+)>/g;
const CUSTOM_EMOJI_PLACEHOLDER = "\uFFFC";
const CUSTOM_EMOJI_SIZE_MULTIPLIER = 1.15;
const CUSTOM_EMOJI_BASELINE_OFFSET = 0.85;

interface CustomEmojiToken {
    id: string;
    name: string;
    animated: boolean;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(blob => {
            if (!blob) return reject(new Error("Failed to create Blob"));
            resolve(blob);
        }, "image/png");
    });
}

function uniqueStrings(values: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const value of values) {
        if (!value || seen.has(value)) continue;
        seen.add(value);
        out.push(value);
    }
    return out;
}

function stripResizeParams(url: URL): URL {
    const cloned = new URL(url.href);
    ["width", "height", "quality", "format"].forEach(key => cloned.searchParams.delete(key));
    return cloned;
}

function getFetchCandidates(rawUrl: string): string[] {
    let parsed: URL;
    try { parsed = new URL(rawUrl); } catch { return [rawUrl]; }
    const urls = [parsed.href];
    const host = parsed.hostname.toLowerCase();
    const isDiscordAsset = /^\/(?:attachments|stickers)\//.test(parsed.pathname);
    if (isDiscordAsset && ["cdn.discordapp.com", "media.discordapp.net"].includes(host)) {
        const stripped = stripResizeParams(parsed);
        urls.push(stripped.href);
        const cdn = new URL(stripped.href);
        cdn.hostname = "cdn.discordapp.com";
        urls.push(cdn.href);
        const media = new URL(stripped.href);
        media.hostname = "media.discordapp.net";
        urls.push(media.href);
    }
    return uniqueStrings(urls);
}

export async function fetchImageAsBlob(url: string, signal?: AbortSignal): Promise<Blob> {
    let failure = "Media download failed.";
    for (const candidate of getFetchCandidates(url)) {
        try { return await fetchQuoteResource(candidate, false, signal); }
        catch (error) {
            signal?.throwIfAborted();
            failure = error instanceof Error ? error.message : failure;
        }
    }
    throw new Error(failure);
}

export function fixUpQuote(quote: string): string {
    let result = quote;
    const mentionMatches = result.match(/<@!?\d+>/g);
    if (mentionMatches) {
        mentionMatches.forEach(match => {
            const userId = match.replace(/[<@!>]/g, "");
            const user = UserStore.getUser(userId);
            if (user?.username) result = result.replace(match, `@${user.username}`);
        });
    }
    return result;
}

export function generateFileNamePreview(message: string): string {
    const words = message.split(" ");
    const preview = words.length > 6 ? words.slice(0, 6).join(" ") : words.join(" ");
    return preview.slice(0, 10);
}

export function getFileExtension(saveAsGif: boolean): string {
    return saveAsGif ? "gif" : "png";
}

export function getMimeType(saveAsGif: boolean): string {
    return saveAsGif ? "image/gif" : "image/png";
}

let fontLoadingPromise: Promise<void> | null = null;

export async function ensureFontLoaded(): Promise<void> {
    if (fontLoadingPromise) return fontLoadingPromise;

    fontLoadingPromise = (async () => {
        if (!document.getElementById("quoter-font-style")) {
            const style = document.createElement("style");
            style.id = "quoter-font-style";
            style.textContent = `
                @import url('https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@300&display=swap');
                @import url('https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300..800;1,300..800&display=swap');
                @import url('https://fonts.googleapis.com/css2?family=Momo+Signature&display=swap');
                @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400..700;1,400..700&display=swap');
                @import url('https://fonts.googleapis.com/css2?family=Merriweather:wght@300;400;700&display=swap');
                @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700&display=swap');
                @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700&display=swap');
            `;
            document.head.appendChild(style);
            await Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 3500))]);
        }
    })();

    return fontLoadingPromise;
}

export function resetFontLoading() {
    fontLoadingPromise = null;
}

async function loadAvatarImage(avatarUrl: string, signal?: AbortSignal): Promise<HTMLImageElement> {
    const avatarBlob = await fetchImageAsBlob(avatarUrl, signal);
    const avatar = new Image();
    const blobUrl = URL.createObjectURL(avatarBlob);

    try {
        await waitForMedia(avatar, "load", () => { avatar.src = blobUrl; }, signal);
        return avatar;
    } finally {
        URL.revokeObjectURL(blobUrl);
    }
}

function extractCustomEmojis(text: string): { text: string; emojis: CustomEmojiToken[]; } {
    const emojis: CustomEmojiToken[] = [];
    const cleanText = text.replace(CUSTOM_EMOJI_REGEX, (match, name: string, id: string) => {
        emojis.push({
            id,
            name,
            animated: match.startsWith("<a:")
        });
        return CUSTOM_EMOJI_PLACEHOLDER;
    });

    return { text: cleanText, emojis };
}

async function loadImageFromBlob(blob: Blob, signal?: AbortSignal): Promise<HTMLImageElement> {
    const image = new Image();
    const blobUrl = URL.createObjectURL(blob);

    try {
        await waitForMedia(image, "load", () => { image.src = blobUrl; }, signal);
        return image;
    } finally {
        URL.revokeObjectURL(blobUrl);
    }
}

async function loadCustomEmojiImage(emoji: CustomEmojiToken, signal?: AbortSignal): Promise<HTMLImageElement | null> {
    const animatedVariants = emoji.animated ? [true, false] : [false];
    for (const animated of animatedVariants) {
        try {
            const blob = await fetchImageAsBlob(IconUtils.getEmojiURL({
                id: emoji.id,
                animated,
                size: 96
            }), signal);
            return await loadImageFromBlob(blob, signal);
        } catch {
            signal?.throwIfAborted();
            continue;
        }
    }

    return null;
}

async function loadCustomEmojiImages(emojis: CustomEmojiToken[], signal?: AbortSignal): Promise<Map<string, HTMLImageElement>> {
    if (!emojis.length) return new Map<string, HTMLImageElement>();

    const unique = new Map<string, CustomEmojiToken>();
    emojis.forEach(emoji => {
        const key = `${emoji.id}:${emoji.animated ? "a" : "s"}`;
        if (!unique.has(key)) unique.set(key, emoji);
    });

    const entries = await Promise.all(
        Array.from(unique.entries()).map(async ([key, emoji]) => [key, await loadCustomEmojiImage(emoji, signal)] as const)
    );

    return entries.reduce((acc, [key, image]) => {
        if (image) acc.set(key, image);
        return acc;
    }, new Map<string, HTMLImageElement>());
}

function measureTextWithCustomEmojis(ctx: CanvasRenderingContext2D, text: string, fontSize: number): number {
    const emojiSize = fontSize * CUSTOM_EMOJI_SIZE_MULTIPLIER;
    let width = 0;
    let start = 0;

    for (let i = 0; i < text.length; i++) {
        if (text[i] !== CUSTOM_EMOJI_PLACEHOLDER) continue;
        width += ctx.measureText(text.slice(start, i)).width;
        width += emojiSize;
        start = i + 1;
    }

    width += ctx.measureText(text.slice(start)).width;
    return width;
}

function calculateTextLines(
    ctx: CanvasRenderingContext2D,
    text: string,
    fontSize: number,
    font: QuoteFont,
    maxWidth: number
): string[] {
    ctx.font = `300 ${fontSize}px '${font}', sans-serif`;
    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine: string[] = [];

    words.forEach(word => {
        if (measureTextWithCustomEmojis(ctx, word, fontSize) > maxWidth) {
            if (currentLine.length) {
                lines.push(currentLine.join(" "));
                currentLine = [];
            }

            let chunk = "";
            for (const char of word) {
                const testChunk = chunk + char;
                if (measureTextWithCustomEmojis(ctx, testChunk, fontSize) > maxWidth) {
                    if (chunk) lines.push(chunk);
                    chunk = char;
                } else {
                    chunk = testChunk;
                }
            }
            if (chunk) lines.push(chunk);
        } else {
            const testLine = [...currentLine, word].join(" ");
            if (measureTextWithCustomEmojis(ctx, testLine, fontSize) > maxWidth && currentLine.length) {
                lines.push(currentLine.join(" "));
                currentLine = [word];
            } else {
                currentLine.push(word);
            }
        }
    });

    if (currentLine.length) {
        lines.push(currentLine.join(" "));
    }

    return lines;
}

function calculateOptimalFontSize(
    ctx: CanvasRenderingContext2D,
    quote: string,
    font: QuoteFont,
    config: CanvasConfig
): FontSizeCalculation {
    let fontSize = FONT_SIZES.initial;

    while (fontSize >= FONT_SIZES.minimum) {
        const lines = calculateTextLines(ctx, quote, fontSize, font, config.quoteAreaWidth);
        const lineHeight = fontSize * FONT_SIZES.lineHeightMultiplier;
        const authorFontSize = Math.max(FONT_SIZES.authorMinimum, fontSize * FONT_SIZES.authorMultiplier);
        const usernameFontSize = Math.max(FONT_SIZES.usernameMinimum, fontSize * FONT_SIZES.usernameMultiplier);

        const totalHeight = (lines.length * lineHeight) + SPACING.authorTop + authorFontSize + SPACING.username + usernameFontSize;

        if (totalHeight <= config.maxContentHeight) {
            return { fontSize, lineHeight, authorFontSize, usernameFontSize, lines, totalHeight };
        }
        fontSize -= FONT_SIZES.decrement;
    }

    const lines = calculateTextLines(ctx, quote, FONT_SIZES.minimum, font, config.quoteAreaWidth);
    const lineHeight = FONT_SIZES.minimum * FONT_SIZES.lineHeightMultiplier;
    const authorFontSize = FONT_SIZES.authorMinimum;
    const usernameFontSize = FONT_SIZES.usernameMinimum;
    const totalHeight = (lines.length * lineHeight) + SPACING.authorTop + authorFontSize + SPACING.username + usernameFontSize;

    return { fontSize: FONT_SIZES.minimum, lineHeight, authorFontSize, usernameFontSize, lines, totalHeight };
}

function drawQuoteText(
    ctx: CanvasRenderingContext2D,
    calculation: FontSizeCalculation,
    font: QuoteFont,
    config: CanvasConfig,
    emojis: CustomEmojiToken[],
    emojiImages: Map<string, HTMLImageElement>
): number {
    ctx.fillStyle = "#fff";
    ctx.font = `300 ${calculation.fontSize}px '${font}', sans-serif`;
    const emojiSize = calculation.fontSize * CUSTOM_EMOJI_SIZE_MULTIPLIER;

    let quoteY = (config.height - calculation.totalHeight) / 2;
    let emojiIndex = 0;

    calculation.lines.forEach(line => {
        const xOffset = (config.quoteAreaWidth - measureTextWithCustomEmojis(ctx, line, calculation.fontSize)) / 2;
        let x = config.quoteAreaX + xOffset;
        let segmentStart = 0;
        quoteY += calculation.lineHeight;

        for (let i = 0; i < line.length; i++) {
            if (line[i] !== CUSTOM_EMOJI_PLACEHOLDER) continue;

            const segment = line.slice(segmentStart, i);
            if (segment) {
                ctx.fillText(segment, x, quoteY);
                x += ctx.measureText(segment).width;
            }

            const emoji = emojis[emojiIndex++];
            if (emoji) {
                const key = `${emoji.id}:${emoji.animated ? "a" : "s"}`;
                const image = emojiImages.get(key);
                if (image) {
                    const y = quoteY - emojiSize * CUSTOM_EMOJI_BASELINE_OFFSET;
                    ctx.drawImage(image, x, y, emojiSize, emojiSize);
                } else {
                    ctx.fillText("□", x, quoteY);
                }
            }

            x += emojiSize;
            segmentStart = i + 1;
        }

        const tail = line.slice(segmentStart);
        if (tail) {
            ctx.fillText(tail, x, quoteY);
        }
    });

    return quoteY;
}

function drawAuthorInfo(
    ctx: CanvasRenderingContext2D,
    author: User,
    calculation: FontSizeCalculation,
    config: CanvasConfig,
    startY: number
): void {
    const name = author.globalName || author.username;

    ctx.font = `italic 300 ${calculation.authorFontSize}px 'M PLUS Rounded 1c', sans-serif`;
    ctx.fillStyle = "#fff";
    const authorText = `- ${name}`;
    const authorX = config.quoteAreaX + (config.quoteAreaWidth - ctx.measureText(authorText).width) / 2;
    const authorY = startY + SPACING.authorTop;
    ctx.fillText(authorText, authorX, authorY);

    ctx.font = `300 ${calculation.usernameFontSize}px 'M PLUS Rounded 1c', sans-serif`;
    ctx.fillStyle = "#888";
    const username = `@${author.username}`;
    const usernameX = config.quoteAreaX + (config.quoteAreaWidth - ctx.measureText(username).width) / 2;
    const usernameY = authorY + SPACING.username + calculation.usernameFontSize;
    ctx.fillText(username, usernameX, usernameY);
}

function drawWatermark(
    ctx: CanvasRenderingContext2D,
    watermark: string,
    config: CanvasConfig
): void {
    ctx.fillStyle = "#888";
    ctx.font = `300 ${FONT_SIZES.watermark}px 'M PLUS Rounded 1c', sans-serif`;
    const watermarkText = watermark.slice(0, 32);
    const watermarkX = config.width - ctx.measureText(watermarkText).width - SPACING.watermarkPadding;
    const watermarkY = config.height - SPACING.watermarkPadding;
    ctx.fillText(watermarkText, watermarkX, watermarkY);
}

/** Layout follows Valenced: avatar on the left, message and media in the
 * centered right-hand quote column. The height increases only as needed. */
export async function createQuoteImage(options: QuoteImageOptions): Promise<Blob> {
    const { avatarUrl, quote: rawQuote, grayScale, author, watermark, showWatermark, saveAsGif, quoteFont, showQuoteMark } = options;
    await ensureFontLoaded();
    const media: MediaSource[] = [];
    const displayed: QuoteMedia[] = [];
    try {
        for (const item of options.media ?? []) {
            options.signal?.throwIfAborted();
            try {
                media.push(await loadQuoteMedia(item, saveAsGif, options.signal, options.onWarning));
                displayed.push(item);
            } catch (error) {
                options.signal?.throwIfAborted();
                options.onWarning?.(`Media could not be included. ${error instanceof Error ? error.message : "Decoding failed."}`);
                const placeholder = document.createElement("canvas");
                placeholder.width = 440; placeholder.height = 80;
                const placeholderCtx = placeholder.getContext("2d");
                if (placeholderCtx) {
                    placeholderCtx.fillStyle = "#999";
                    placeholderCtx.font = "20px sans-serif";
                    placeholderCtx.textAlign = "center";
                    placeholderCtx.fillText("Media unavailable", 220, 45);
                }
                media.push({
                    width: 440, height: 80, duration: 0, boundaries: [0], repeat: -1, sticker: !!item.sticker,
                    async frameAt() { return { image: placeholder, close() {} }; },
                    close() { placeholder.width = 0; }
                });
            }
        }
        const content = options.message ? quoteContent(options.message, displayed) : rawQuote;
        const rawText = fixUpQuote(content || "").trim();
        const quote = showQuoteMark && rawText ? `"${rawText}"` : rawText;
        const { text: quoteText, emojis } = extractCustomEmojis(quote);
        const emojiImages = await loadCustomEmojiImages(emojis, options.signal);
        options.signal?.throwIfAborted();
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: !!saveAsGif });
        if (!ctx) throw new Error("Canvas renderer unavailable");
        const base = CANVAS_CONFIG;
        const cfg = { ...base };
        const calc = calculateOptimalFontSize(ctx, quoteText || " ", quoteFont, cfg);
        const actualTextHeight = quoteText ? calc.lines.length * calc.lineHeight : 0;
        const authorBlockHeight = SPACING.authorTop + calc.authorFontSize + SPACING.username + calc.usernameFontSize;
        const mediaBounds = media.map(item => {
            const targetH = item.sticker ? 256 : 360;
            const scale = Math.min((cfg.quoteAreaWidth - 16) / item.width, targetH / item.height, 1.5);
            return { width: Math.max(1, Math.round(item.width * scale)), height: Math.max(1, Math.round(item.height * scale)), x: 0, y: 0 };
        });
        const mediaHeight = mediaBounds.reduce((sum, b) => sum + b.height + 24, 0);
        const contentH = actualTextHeight + mediaHeight + authorBlockHeight;
        cfg.height = Math.max(base.height, Math.ceil(contentH + 120));
        if (cfg.height > 4096) throw new Error("Quote has too many tall attachments (max canvas height 4096px)");
        canvas.width = cfg.width;
        canvas.height = cfg.height;
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, cfg.width, cfg.height);

        // Keep the avatar ONLY in the left 600px. It never becomes the media image.
        const avatar = await loadAvatarImage(avatarUrl, options.signal);
        const avatarY = (cfg.height - base.height) / 2;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, base.height, cfg.height);
        ctx.clip();
        ctx.drawImage(avatar, 0, avatarY, base.height, base.height);
        if (grayScale) {
            ctx.globalCompositeOperation = "saturation";
            ctx.fillStyle = "#fff";
            ctx.fillRect(0, 0, base.height, cfg.height);
            ctx.globalCompositeOperation = "source-over";
        }
        const gradient = ctx.createLinearGradient(base.height - SPACING.gradientWidth, 0, base.height, 0);
        gradient.addColorStop(0, "rgba(0,0,0,0)");
        gradient.addColorStop(1, "rgba(0,0,0,1)");
        ctx.fillStyle = gradient;
        ctx.fillRect(base.height - SPACING.gradientWidth, 0, SPACING.gradientWidth, cfg.height);
        ctx.restore();

        // Position content in the right-hand column like Valenced.
        const textStartY = Math.max(55, (cfg.height - contentH) / 2);
        let cursorY = textStartY;
        if (quoteText) {
            // drawQuoteText centers based on calculated totalHeight. Shift the
            // canvas origin so the text begins at the chosen content offset.
            ctx.save();
            const originalStart = (cfg.height - calc.totalHeight) / 2;
            const wantedStart = textStartY;
            ctx.translate(0, wantedStart - originalStart);
            drawQuoteText(ctx, calc, quoteFont, cfg, emojis, emojiImages);
            ctx.restore();
            cursorY += actualTextHeight;
        }
        for (const b of mediaBounds) {
            cursorY += 24;
            b.x = Math.round(cfg.quoteAreaX + (cfg.quoteAreaWidth - b.width) / 2);
            b.y = Math.round(cursorY);
            cursorY += b.height;
        }
        const authorStartY = cursorY;
        // drawAuthorInfo measures relative to a baseline for the previous quote
        // line. Match Valenced's author info position below all media.
        drawAuthorInfo(ctx, author, calc, cfg, authorStartY);
        if (showWatermark && watermark) drawWatermark(ctx, watermark, cfg);

        const background = document.createElement("canvas");
        background.width = cfg.width; background.height = cfg.height;
        const backgroundCtx = background.getContext("2d");
        if (!backgroundCtx) throw new Error("Could not preserve quote background.");
        backgroundCtx.drawImage(canvas, 0, 0);
        const drawMediaFrame = async (time: number) => {
            options.signal?.throwIfAborted();
            ctx.resetTransform();
            ctx.globalCompositeOperation = "source-over";
            ctx.globalAlpha = 1;
            ctx.drawImage(background, 0, 0);
            for (let i = 0; i < media.length; i++) {
                const b = mediaBounds[i];
                const frame = await media[i].frameAt(time);
                try {
                    ctx.save();
                    ctx.beginPath(); ctx.rect(b.x, b.y, b.width, b.height); ctx.clip();
                    ctx.fillStyle = "#000";
                    ctx.fillRect(b.x, b.y, b.width, b.height);
                    ctx.drawImage(frame.image, b.x, b.y, b.width, b.height);
                    if (grayScale) {
                        ctx.save();
                        ctx.beginPath(); ctx.rect(b.x, b.y, b.width, b.height); ctx.clip();
                        ctx.globalCompositeOperation = "saturation";
                        ctx.fillStyle = "#fff"; ctx.fillRect(b.x, b.y, b.width, b.height);
                        ctx.restore();
                    }
                } finally { ctx.restore(); frame.close(); }
            }
        };
        await drawMediaFrame(0);
        // Keep static quotes as PNG, exactly as Valenced does. Animated media
        // exports as an actual animated GIF when the option is enabled.
        if (!saveAsGif || !media.some(item => item.duration)) return canvasToBlob(canvas);
        const animated = media.filter(item => item.duration > 0);
        const duration = Math.max(...animated.map(item => item.duration));
        if (duration > 30000) throw new Error("Animation must be 30 seconds or shorter");
        const times = new Set<number>([0]);
        for (const item of media) {
            if (!item.duration) continue;
            for (let loop = 0; loop < duration; loop += item.duration) {
                for (const boundary of item.boundaries) if (loop + boundary < duration) times.add(loop + boundary);
            }
        }
        const timeline = Array.from(times).sort((a, b) => a - b);
        if (timeline.length > 600) throw new Error("Too many animation frames (600 maximum)");
        if (timeline.length * cfg.width * cfg.height > 500_000_000) throw new Error("Animated quote is too large to encode. Use fewer attachments or less text.");
        const gif = GIFEncoder();
        // Build ONE palette from the static quote AND sampled animated frames.
        // A palette from only the first frame would turn later colors gray.
        const sampleCanvas = document.createElement("canvas");
        const sampleCtx = sampleCanvas.getContext("2d", { willReadFrequently: true });
        if (!sampleCtx) throw new Error("Could not sample GIF colors");
        const samples: Uint8ClampedArray[] = [];
        const collect = (size: number) => {
            sampleCanvas.width = size;
            sampleCanvas.height = size;
            sampleCtx.drawImage(canvas, 0, 0, size, size);
            samples.push(sampleCtx.getImageData(0, 0, size, size).data);
        };
        collect(128);
        for (let n = 0; n < Math.min(12, timeline.length); n++) {
            const t = timeline[Math.min(timeline.length - 1, Math.round(n * (timeline.length - 1) / Math.max(1, Math.min(12, timeline.length) - 1)))];
            await drawMediaFrame(t);
            collect(80);
        }
        await drawMediaFrame(0);
        const palettePixels = new Uint8Array(samples.reduce((sum, part) => sum + part.byteLength, 0));
        let sampleOffset = 0;
        for (const part of samples) { palettePixels.set(part, sampleOffset); sampleOffset += part.byteLength; }
        const palette = quantize(palettePixels, 256);
        for (let i = 0; i < timeline.length; i++) {
            await drawMediaFrame(timeline[i]);
            const data = new Uint8Array(ctx.getImageData(0, 0, cfg.width, cfg.height).data);
            const pixels = applyPalette(data, palette);
            if (pixels.length !== cfg.width * cfg.height) throw new Error("GIF frame dimensions do not match the quote canvas.");
            const delay = (timeline[i + 1] ?? duration) - timeline[i];
            gif.writeFrame(pixels, cfg.width, cfg.height, {
                palette: i === 0 ? palette : undefined,
                delay,
                transparent: false,
                dispose: 1,
                repeat: animated.length === 1 ? animated[0].repeat : 0
            });
            if (gif.bytesView().length > 25 * 1024 * 1024) throw new Error("Animated quote exceeds 25 MB");
            if (i % 6 === 0) await sleep(0);
        }
        gif.finish();
        if (gif.bytesView().length > 25 * 1024 * 1024) throw new Error("Animated quote exceeds 25 MB");
        return new Blob([new Uint8Array(gif.bytesView())], { type: "image/gif" });
    } finally { media.forEach(item => item.close()); }
}

type MediaFrame = { image: CanvasImageSource; close(): void; };
type MediaSource = {
    width: number; height: number; duration: number; boundaries: number[]; repeat: number; sticker: boolean;
    frameAt(time: number): Promise<MediaFrame>; close(): void;
};

async function waitForMedia(target: HTMLImageElement | HTMLVideoElement, eventName: string, action: () => void, signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted();
    await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => finish(new Error("Media decode timed out")), 15000);
        const ok = () => finish();
        const fail = () => finish(new Error("Could not decode quote media"));
        const abort = () => finish(new Error("Quote rendering was cancelled."));
        const finish = (error?: Error) => {
            clearTimeout(timer);
            target.removeEventListener(eventName, ok);
            target.removeEventListener("error", fail);
            signal?.removeEventListener("abort", abort);
            error ? reject(error) : resolve();
        };
        target.addEventListener(eventName, ok, { once: true });
        target.addEventListener("error", fail, { once: true });
        signal?.addEventListener("abort", abort, { once: true });
        try { action(); } catch { fail(); }
    });
}

async function loadQuoteMedia(item: QuoteMedia, preserve: boolean, signal?: AbortSignal, warn?: (message: string) => void, allowRefresh = true): Promise<MediaSource> {
    let preview: MediaSource | undefined;
    let failure = "";
    try {
        const sources = item.sources ?? [item];
        const attempts = [...sources, ...sources.flatMap(source => getFetchCandidates(source.url).slice(1).map(url => ({ ...source, url })))];
        const tried = new Set<string>();
        for (const source of attempts) {
            const { url } = source;
            if (tried.has(url)) continue;
            tried.add(url);
            signal?.throwIfAborted();
            try {
                const blob = await fetchQuoteResource(url, false, signal);
                const decoded = await decodeQuoteMedia(blob, { ...source, url }, !!item.sticker, signal);
                if (preserve && item.expectAnimation && !decoded.duration) {
                    if (!preview) preview = decoded;
                    else decoded.close();
                    continue;
                }
                preview?.close();
                preview = undefined;
                return decoded;
            } catch (error) {
                signal?.throwIfAborted();
                failure = error instanceof Error ? error.message : "Media decoding failed.";
            }
        }
        if (allowRefresh) {
            const refreshed = await refreshQuoteMedia([item], message => warn?.(message), signal, true);
            const freshSources = (refreshed[0].sources ?? [refreshed[0]]).filter(source => !tried.has(source.url));
            if (freshSources.length) {
                try {
                    const decoded = await loadQuoteMedia({ ...item, sources: freshSources, pageUrl: undefined }, preserve, signal, warn, false);
                    preview?.close(); preview = undefined;
                    return decoded;
                } catch (error) {
                    signal?.throwIfAborted();
                    failure = error instanceof Error ? error.message : failure;
                }
            }
        }
        if (item.pageUrl && item.sources?.some(source => source.animated)) {
            const resolved = await resolveMissingPageMedia({ content: item.pageUrl }, [], message => warn?.(message), signal);
            if (resolved.length) {
                try {
                    const decoded = await loadQuoteMedia({ ...resolved[0], pageUrl: undefined }, preserve, signal, warn);
                    preview?.close();
                    preview = undefined;
                    return decoded;
                } catch (error) {
                    signal?.throwIfAborted();
                    failure = error instanceof Error ? error.message : failure;
                }
            }
        }
        if (preview) {
            warn?.(`Animation could not be preserved. Using the available static preview. ${failure || "The source contained only one decoded frame."}`);
            const result = preview;
            preview = undefined;
            return result;
        }
        throw new Error(failure || "No usable media source was provided.");
    } finally { preview?.close(); }
}

function checkMediaSize(width: number, height: number, count = 1): void {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 || width * height > 16_777_216) throw new Error("Media dimensions are invalid or exceed 16 megapixels.");
    if (count > 600 || width * height * count > 256_000_000) throw new Error("Animated media exceeds 600 frames or the decoded pixel limit.");
}

function frameDelay(delay: number): number { return Math.max(20, Math.round(delay / 10) * 10); }

function frameIndex(time: number, duration: number, boundaries: number[]): number {
    const local = duration ? time % duration : 0;
    let index = 0;
    while (index + 1 < boundaries.length && boundaries[index + 1] <= local) index++;
    return index;
}

type DecodedImage = CanvasImageSource & { displayWidth: number; displayHeight: number; duration: number | null; close(): void; };
interface QuoteImageDecoder {
    tracks: { ready: Promise<void>; selectedTrack: { frameCount: number; repetitionCount: number; } | null; };
    completed: Promise<void>;
    decode(options: { frameIndex: number; completeFramesOnly: boolean; }): Promise<{ image: DecodedImage; }>;
    close(): void;
}
interface QuoteImageDecoderConstructor {
    new(options: { data: ArrayBuffer; type: string; preferAnimation: boolean; }): QuoteImageDecoder;
    isTypeSupported(type: string): Promise<boolean>;
}

async function decodeQuoteMedia(blob: Blob, source: MediaCandidate, sticker: boolean, signal?: AbortSignal): Promise<MediaSource> {
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const ascii = (offset: number, length: number) => String.fromCharCode(...bytes.subarray(offset, offset + length));
    const isGif = /^GIF8[79]a$/.test(ascii(0, 6));
    const isPng = bytes[0] === 137 && ascii(1, 3) === "PNG";
    const isWebp = ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP";
    const brands = ascii(4, 4) === "ftyp" && bytes.length >= 16
        ? Array.from({ length: Math.floor((Math.min(new DataView(buffer).getUint32(0), bytes.length, 256) - 8) / 4) }, (_, i) => ascii(8 + i * 4, 4)) : [];
    const isAvif = brands.includes("avif") || brands.includes("avis") || blob.type === "image/avif";
    const isVideo = !isAvif && (ascii(4, 4) === "ftyp" || ascii(0, 4) === "\x1a\x45\xdf\xa3" || source.kind === "video" || blob.type.startsWith("video/"));
    if (isGif) return decodeGif(buffer, sticker, signal);
    if (isVideo) {
        const type = ascii(4, 4) === "ftyp" ? "video/mp4" : blob.type.startsWith("video/") ? blob.type : "video/webm";
        const blobUrl = URL.createObjectURL(new Blob([buffer], { type }));
        const video = document.createElement("video");
        video.muted = true;
        video.preload = "auto";
        video.playsInline = true;
        const close = () => { video.removeAttribute("src"); video.load(); URL.revokeObjectURL(blobUrl); };
        try {
            await waitForMedia(video, "loadeddata", () => { video.src = blobUrl; video.load(); }, signal);
            const duration = frameDelay(video.duration * 1000);
            if (!Number.isFinite(duration) || video.duration <= 0 || duration > 30000) throw new Error("Video must be 30 seconds or shorter.");
            checkMediaSize(video.videoWidth, video.videoHeight, Math.ceil(duration / 80));
            const boundaries = Array.from({ length: Math.ceil(duration / 80) }, (_, i) => i * 80);
            return {
                width: video.videoWidth, height: video.videoHeight, duration, boundaries, repeat: 0, sticker,
                async frameAt(time) {
                    signal?.throwIfAborted();
                    const target = Math.min((time % duration) / 1000, Math.max(0, video.duration - 0.001));
                    if (Math.abs(video.currentTime - target) > 0.001) await waitForMedia(video, "seeked", () => { video.currentTime = target; }, signal);
                    return { image: video, close() {} };
                }, close
            };
        } catch (error) { close(); throw error; }
    }
    let animatedContainer = isAvif && brands.includes("avis");
    const view = new DataView(buffer);
    if (isPng) {
        if (bytes.length < 24) throw new Error("PNG header is incomplete.");
        checkMediaSize(view.getUint32(16), view.getUint32(20));
        for (let offset = 8; offset + 12 <= bytes.length;) {
            const length = view.getUint32(offset);
            const chunk = ascii(offset + 4, 4);
            if (chunk === "acTL") { animatedContainer = true; break; }
            if (chunk === "IDAT" || chunk === "IEND") break;
            offset += 12 + length;
        }
    }
    if (isWebp) {
        for (let offset = 12; offset + 8 <= bytes.length;) {
            const length = view.getUint32(offset + 4, true);
            const chunk = ascii(offset, 4);
            if (chunk === "VP8X" && length >= 10 && offset + 18 <= bytes.length) {
                const width = 1 + bytes[offset + 12] + (bytes[offset + 13] << 8) + (bytes[offset + 14] << 16);
                const height = 1 + bytes[offset + 15] + (bytes[offset + 16] << 8) + (bytes[offset + 17] << 16);
                checkMediaSize(width, height);
            }
            if (chunk === "ANIM" || chunk === "ANMF" || chunk === "VP8X" && length >= 10 && (bytes[offset + 8] & 2) !== 0) { animatedContainer = true; break; }
            offset += 8 + length + (length & 1);
        }
    }
    const type = isPng ? "image/png" : isWebp ? "image/webp" : isAvif ? "image/avif" : blob.type.split(";")[0];
    const ctor: unknown = (globalThis as { ImageDecoder?: unknown; }).ImageDecoder;
    const Decoder = typeof ctor === "function" ? ctor as QuoteImageDecoderConstructor : undefined;
    let decoderFailure = "This client does not support ImageDecoder for this image format.";
    if (Decoder && await Decoder.isTypeSupported(type)) {
        const decoder = new Decoder({ data: buffer, type, preferAnimation: true });
        try {
            await decoder.tracks.ready;
            await decoder.completed;
            const track = decoder.tracks.selectedTrack;
            if (track && track.frameCount > 1) animatedContainer = true;
            if (!track || !track.frameCount || track.frameCount > 600) throw new Error("Image has no frames or exceeds 600 frames.");
            const count = track.frameCount;
            const boundaries: number[] = [];
            let duration = 0, width = 0, height = 0;
            for (let i = 0; i < count; i++) {
                signal?.throwIfAborted();
                const { image } = await decoder.decode({ frameIndex: i, completeFramesOnly: true });
                try {
                    checkMediaSize(image.displayWidth, image.displayHeight, count);
                    if (i && (width !== image.displayWidth || height !== image.displayHeight)) throw new Error("Decoded image frames have inconsistent dimensions.");
                    width = image.displayWidth; height = image.displayHeight;
                    boundaries.push(duration);
                    duration += frameDelay((image.duration ?? 100000) / 1000);
                    if (count > 1 && duration > 30000) throw new Error("Animated media exceeds 30 seconds.");
                } finally { image.close(); }
                if (i % 12 === 0) await sleep(0);
            }
            return {
                width, height, duration: count > 1 ? duration : 0, boundaries,
                repeat: track.repetitionCount === Infinity ? 0 : track.repetitionCount > 0 ? track.repetitionCount : -1, sticker,
                async frameAt(time) {
                    signal?.throwIfAborted();
                    const { image } = await decoder.decode({ frameIndex: frameIndex(time, duration, boundaries), completeFramesOnly: true });
                    return { image, close() { image.close(); } };
                }, close() { decoder.close(); }
            };
        } catch (error) {
            decoder.close();
            signal?.throwIfAborted();
            if (animatedContainer) throw error;
            decoderFailure = error instanceof Error ? error.message : "ImageDecoder could not decode this image.";
        }
    }
    if (animatedContainer) throw new Error(`Animated ${isPng ? "PNG" : isWebp ? "WebP" : "AVIF"} could not be decoded. ${decoderFailure}`);
    const image = await loadImageFromBlob(new Blob([buffer], { type }), signal);
    checkMediaSize(image.naturalWidth, image.naturalHeight);
    return {
        width: image.naturalWidth, height: image.naturalHeight, duration: 0, boundaries: [0], repeat: -1, sticker,
        async frameAt() { return { image, close() {} }; }, close() {}
    };
}

function decodeGif(buffer: ArrayBuffer, sticker: boolean, signal?: AbortSignal): MediaSource {
    // Fallback for Discord/Electron builds without the WebCodecs
    // ImageDecoder API. gifuct-js is already a dependency of Equicord.
    const parsed = parseGIF(buffer);
    const frames = parsed.frames.filter(frame => "image" in frame);
    if (!frames.length || frames.length > 600) throw new Error("GIF has no frames or exceeds 600 frames.");
    const { width } = parsed.lsd, { height } = parsed.lsd;
    checkMediaSize(width, height);
    let decodedPixels = 0, duration = 0;
    const boundaries: number[] = [];
    for (const frame of frames) {
        const dims = frame.image.descriptor;
        checkMediaSize(dims.width, dims.height);
        if (dims.left + dims.width > width || dims.top + dims.height > height) throw new Error("GIF frame extends outside its logical screen.");
        decodedPixels += dims.width * dims.height;
        if (decodedPixels > 256_000_000) throw new Error("GIF exceeds the decoded pixel limit.");
        boundaries.push(duration);
        duration += frameDelay((frame.gce?.delay || 10) * 10);
    }
    if (frames.length > 1 && duration > 30000) throw new Error("Animated GIF exceeds 30 seconds.");
    let repeat = -1;
    for (const frame of parsed.frames) {
        if ("application" in frame && /^(?:NETSCAPE2\.0|ANIMEXTS1\.0)$/.test(frame.application.id)) {
            const { blocks } = frame.application;
            if (blocks[0] === 1 && blocks.length >= 3) repeat = blocks[1] | blocks[2] << 8;
        }
    }
    const work = document.createElement("canvas");
    work.width = width; work.height = height;
    const ctx = work.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Could not create GIF decoder canvas.");
    const patchCanvas = document.createElement("canvas");
    const patchCtx = patchCanvas.getContext("2d");
    if (!patchCtx) throw new Error("Could not create GIF frame canvas.");
    const background = parsed.gct?.[parsed.lsd.backgroundColorIndex];
    const clearBackground = (x: number, y: number, w: number, h: number, transparent: boolean) => {
        ctx.clearRect(x, y, w, h);
        if (!transparent && background) {
            ctx.fillStyle = `rgb(${background.join(",")})`;
            ctx.fillRect(x, y, w, h);
        }
    };
    let at = -1;
    let previousRestore: ImageData | null = null;
    const drawFrame = async (index: number) => {
        if (index < at) { at = -1; previousRestore = null; }
        if (at === -1) clearBackground(0, 0, width, height, !!frames[0].gce?.extras.transparentColorGiven);
        for (let next = at + 1; next <= index; next++) {
            signal?.throwIfAborted();
            if (next > 0) {
                const prev = frames[next - 1];
                const dims = prev.image.descriptor;
                if (prev.gce?.extras.disposal === 2) clearBackground(dims.left, dims.top, dims.width, dims.height, !!prev.gce.extras.transparentColorGiven);
                if (prev.gce?.extras.disposal === 3 && previousRestore) ctx.putImageData(previousRestore, 0, 0);
            }
            const frame = frames[next];
            previousRestore = frame.gce?.extras.disposal === 3 ? ctx.getImageData(0, 0, width, height) : null;
            const decoded = decompressFrame(frame, parsed.gct, true);
            patchCanvas.width = decoded.dims.width; patchCanvas.height = decoded.dims.height;
            patchCtx.putImageData(new ImageData(new Uint8ClampedArray(decoded.patch), decoded.dims.width, decoded.dims.height), 0, 0);
            ctx.drawImage(patchCanvas, decoded.dims.left, decoded.dims.top);
            at = next;
            if (next % 12 === 0) await sleep(0);
        }
    };
    return {
        width, height, duration: frames.length > 1 ? duration : 0, boundaries, repeat, sticker,
        async frameAt(time) {
            await drawFrame(frameIndex(time, duration, boundaries));
            return { image: work, close() {} };
        }, close() { work.width = 0; patchCanvas.width = 0; previousRestore = null; }
    };
}
