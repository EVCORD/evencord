/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { existsSync, readFileSync } from "node:fs";

const webhook = process.env.DISCORD_RELEASE_WEBHOOK;
if (webhook) {
    const { version } = JSON.parse(readFileSync("package.json", "utf8"));
    const community = JSON.parse(readFileSync("branding/community.json", "utf8"));
    const icons = JSON.parse(readFileSync("branding/community-stats.json", "utf8"));
    const arabicNotes = `docs/releases/ar/${version}.md`;
    const hasArabic = existsSync(arabicNotes);
    const notes = readFileSync(hasArabic ? arabicNotes : `docs/releases/${version}.md`, "utf8").replace(/^# .+\n+/, "").trim();
    const summary = notes.split(/\r?\n/).filter(line => line.trim() && !line.startsWith("#")).slice(0, 3).join("\n").slice(0, 600);
    const release = `https://github.com/EVCORD/evencord/releases/tag/core-v${version}`;
    const links = [
        ["تحميل البرنامج", "https://evcord.github.io/evencord/download/"],
        ["تفاصيل الإصدار", release],
        ["الإضافات", "https://evcord.github.io/evencord/plugins/"],
        ["الدعم", community.support]
    ];
    const payload = {
        flags: 32768,
        allowed_mentions: { parse: [], roles: [community.releaseRoleId] },
        components: [{
            type: 17,
            accent_color: 0x805263,
            components: [
                { type: 10, content: `<@&${community.releaseRoleId}>\n## <:ev_logo:${icons.logoEmojiId}> تحديث جديد\nEvenCord ${version}` },
                { type: 10, content: "‏حدّث EvenCord من الإعدادات، ثم أعد تشغيل Discord." },
                { type: 14, divider: true, spacing: 1 },
                { type: 10, content: hasArabic ? summary : "‏تحسينات وإصلاحات جديدة. التفاصيل من زر تفاصيل الإصدار." },
                { type: 14, divider: true, spacing: 1 },
                { type: 1, components: links.map(([label, url], index) => ({ type: 2, style: 5, label, url, ...(index === 0 ? { emoji: { id: icons.downloadEmojiId } } : {}) })) },
                { type: 10, content: "-# EvenCord · BOSS" }
            ]
        }]
    };
    try {
        const response = await fetch(webhook + "?wait=true&with_components=true", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(20_000)
        });
        if (!response.ok) throw Error("Discord rejected the announcement.");
        const message = await response.json();
        console.log(JSON.stringify({ version, messageId: message.id }));
    } catch {
        console.error("Could not publish the Discord release announcement.");
        process.exitCode = 1;
    }
}
