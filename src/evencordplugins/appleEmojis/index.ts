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
const positionProperty = "--ec-apple-emoji";
const styledImage = `img[style*="${positionProperty}:"]`;
let image: HTMLImageElement | undefined;
let observer: MutationObserver | undefined;

export default definePlugin({
    name: "AppleEmojis",
    description: "Use Apple emoji artwork instead of Discord's default emojis.",
    authors: [EvenCordAuthors.EvenCord],
    tags: ["Appearance"],
    enabledByDefault: false,
    start() {
        const sprite = image = new Image();
        sprite.onload = () => {
            if (image !== sprite) return;
            const assets = new Map<string, string>();
            const aliases = new Map<string, string>();
            const characters = new Map<string, string>();
            const ambiguous = new Set<string>();
            for (const [sequence, x, y, names] of emojiData as [string, number, number, string[]][]) {
                const unicode = String.fromCodePoint(...sequence.split("-").map(code => parseInt(code, 16)));
                const position = `${(x * 66 + 1) / (sprite.naturalWidth - 64) * 100}% ${(y * 66 + 1) / (sprite.naturalHeight - 64) * 100}%`;
                for (const name of names) aliases.set(name, position);
                for (const value of new Set([unicode, unicode.replaceAll("\uFE0F", "")])) {
                    characters.set(value, position);
                    let url: string;
                    try { url = EmojiUtils.getURL(value); } catch { continue; }
                    if (typeof url !== "string") continue;
                    const asset = /\/assets\/[\w.-]+\.(?:svg|png|webp)/.exec(url)?.[0];
                    if (!asset || ambiguous.has(asset)) continue;
                    if (assets.has(asset) && assets.get(asset) !== position) {
                        assets.delete(asset);
                        ambiguous.add(asset);
                    } else assets.set(asset, position);
                }
            }
            function update(img: HTMLImageElement) {
                const src = img.getAttribute("src") ?? "";
                const picker = img.closest<HTMLElement>('[data-type="emoji"]');
                let position: string | undefined;
                if (!src.includes("/emojis/") && !picker?.hasAttribute("data-id")) {
                    const asset = /\/assets\/[\w.-]+\.(?:svg|png|webp)/.exec(src)?.[0];
                    position = characters.get(img.alt) ?? aliases.get(picker?.dataset.name ?? "")
                        ?? (src.includes("/assets/") && img.alt.startsWith(":") && img.alt.endsWith(":") ? aliases.get(img.alt.slice(1, -1)) : undefined)
                        ?? (asset && assets.get(asset));
                }
                if (position) img.style.setProperty(positionProperty, position);
                else img.style.removeProperty(positionProperty);
            }

            function visit(node: Node) {
                if (!(node instanceof Element) || !node.isConnected) return;
                if (node instanceof HTMLImageElement) update(node);
                else if (node.childElementCount) node.querySelectorAll("img").forEach(update);
            }

            requireStyle(style).source = `${styledImage}{content:url("${transparent}");background-image:url("${source}");background-repeat:no-repeat;background-size:${sprite.naturalWidth / 64 * 100}% ${sprite.naturalHeight / 64 * 100}%;background-position:var(${positionProperty});}`;
            enableStyle(style);
            visit(document.documentElement);
            observer = new MutationObserver(records => {
                for (const record of records) {
                    if (record.type === "attributes") visit(record.target);
                    else record.addedNodes.forEach(visit);
                }
            });
            observer.observe(document.documentElement, {
                subtree: true, childList: true, attributes: true,
                attributeFilter: ["src", "alt", "data-name", "data-id", "data-type"]
            });
        };
        sprite.onerror = () => logger.warn("Apple emoji artwork could not load. Keeping Discord emojis.");
        sprite.src = source;
    },
    stop() {
        observer?.disconnect();
        observer = undefined;
        if (image) {
            image.onload = image.onerror = null;
            image.src = "";
            image = undefined;
        }
        disableStyle(style);
        document.querySelectorAll<HTMLImageElement>(styledImage).forEach(img => img.style.removeProperty(positionProperty));
    }
});
