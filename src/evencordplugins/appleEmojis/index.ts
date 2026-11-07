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
            const selectors = new Map<string, string>();
            const ambiguous = new Set<string>();
            for (const [sequence, x, y, names] of emojiData as [string, number, number, string[]][]) {
                const unicode = String.fromCodePoint(...sequence.split("-").map(code => parseInt(code, 16)));
                const position = `${(x * 66 + 1) / (sprite.naturalWidth - 64) * 100}% ${(y * 66 + 1) / (sprite.naturalHeight - 64) * 100}%`;
                for (const name of names) {
                    selectors.set(`img[src*="/assets/"][alt=${JSON.stringify(`:${name}:`)}]`, position);
                    selectors.set(`[data-type="emoji"][data-name=${JSON.stringify(name)}]:not([data-id]) img`, position);
                }
                for (const value of new Set([unicode, unicode.replaceAll("\uFE0F", "")])) {
                    selectors.set(`img[alt=${JSON.stringify(value)}]:not([src*="/emojis/"])`, position);
                    let url: string;
                    try { url = EmojiUtils.getURL(value); } catch { continue; }
                    if (typeof url !== "string") continue;
                    const asset = /\/assets\/[\w.-]+\.(?:svg|png|webp)/.exec(url)?.[0];
                    if (!asset || ambiguous.has(asset)) continue;
                    if (positions.has(asset) && positions.get(asset) !== position) {
                        positions.delete(asset);
                        ambiguous.add(asset);
                    } else positions.set(asset, position);
                }
            }
            for (const [asset, position] of positions) selectors.set(`img[src*=${JSON.stringify(asset)}]`, position);
            const rules = Array.from(selectors, ([selector, position]) => ({ selector: `.vc-apple-emojis ${selector}`, position }));
            const declarations = `content:url("${transparent}");background-image:url("${source}");background-repeat:no-repeat;background-size:${sprite.naturalWidth / 64 * 100}% ${sprite.naturalHeight / 64 * 100}%;`;
            const groups: string[] = [];
            for (let i = 0; i < rules.length; i += 100) {
                groups.push(`${rules.slice(i, i + 100).map(rule => rule.selector).join(",")}{${declarations}}`);
            }
            requireStyle(style).source = groups.join("\n")
                + rules.map(({ selector, position }) => `${selector}{background-position:${position};}`).join("\n");
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
