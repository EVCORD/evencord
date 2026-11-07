/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { disableStyle, enableStyle, requireStyle } from "@api/Styles";
import { EvenCordAuthors } from "@evencordplugins/_authors";
import { Logger } from "@utils/Logger";
import definePlugin from "@utils/types";
import { EmojiUtils } from "@webpack/common";

import emojiData from "./emoji.json";
import style from "./style.css?managed";

const source = "https://raw.githubusercontent.com/iamcal/emoji-data/e77759c296ed37beb0dbd63908b43d8619509c6d/sheets-clean/sheet_apple_64_clean.png";
const transparent = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'/%3E";
const logger = new Logger("AppleEmojis");
let image: HTMLImageElement | undefined;

export default definePlugin({
    name: "AppleEmojis",
    description: "Use Apple emoji artwork instead of Discord's default emojis.",
    authors: [EvenCordAuthors.EvenCord],
    tags: ["Appearance"],
    enabledByDefault: true,
    start() {
        const sprite = image = new Image();
        sprite.onload = () => {
            if (image !== sprite) return;
            const positions = new Map<string, string>();
            const ambiguous = new Set<string>();
            for (const [sequence, x, y] of emojiData as [string, number, number][]) {
                const unicode = String.fromCodePoint(...sequence.split("-").map(code => parseInt(code, 16)));
                for (const value of new Set([unicode, unicode.replaceAll("\uFE0F", "")])) {
                    let url: string;
                    try { url = EmojiUtils.getURL(value); } catch { continue; }
                    if (typeof url !== "string") continue;
                    const asset = /\/assets\/[\w.-]+\.(?:svg|png|webp)/.exec(url)?.[0];
                    if (!asset || ambiguous.has(asset)) continue;
                    const position = `${(x * 66 + 1) / (sprite.naturalWidth - 64) * 100}% ${(y * 66 + 1) / (sprite.naturalHeight - 64) * 100}%`;
                    if (positions.has(asset) && positions.get(asset) !== position) {
                        positions.delete(asset);
                        ambiguous.add(asset);
                    } else positions.set(asset, position);
                }
            }
            requireStyle(style).source = Array.from(positions, ([asset, position]) =>
                `.vc-apple-emojis img[src*=${JSON.stringify(asset)}]{content:url("${transparent}");background-image:url("${source}");background-repeat:no-repeat;background-size:${sprite.naturalWidth / 64 * 100}% ${sprite.naturalHeight / 64 * 100}%;background-position:${position};}`
            ).join("\n");
            enableStyle(style);
            document.documentElement.classList.add("vc-apple-emojis");
        };
        sprite.onerror = () => logger.warn("Apple emoji artwork could not load. Keeping Discord emojis.");
        sprite.src = source;
    },
    stop() {
        if (image) {
            image.onload = image.onerror = null;
            image.src = "";
            image = undefined;
        }
        document.documentElement.classList.remove("vc-apple-emojis");
        disableStyle(style);
    }
});
