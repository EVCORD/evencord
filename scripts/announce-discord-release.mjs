/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { readFileSync } from "node:fs";

const webhook = process.env.DISCORD_RELEASE_WEBHOOK;
if (webhook) {
    const { version } = JSON.parse(readFileSync("package.json", "utf8"));
    const community = JSON.parse(readFileSync("branding/community.json", "utf8"));
    const notes = readFileSync(`docs/releases/${version}.md`, "utf8").replace(/^# .+\n+/, "").trim();
    const release = `https://github.com/EVCORD/evencord/releases/tag/core-v${version}`;
    const links = [
        ["Download / تحميل", "https://evcord.github.io/evencord/download/"],
        ["Release notes", release],
        ["Plugin catalog", "https://evcord.github.io/evencord/plugins/"],
        ["Get help / الدعم", community.support]
    ];
    const payload = {
        flags: 32768,
        allowed_mentions: { parse: [], roles: [community.releaseRoleId] },
        components: [{
            type: 17,
            accent_color: 0x805263,
            components: [
                { type: 10, content: `<@&${community.releaseRoleId}>\n## EvenCord ${version}` },
                { type: 10, content: "A new EvenCord release is available. Update from EvenCord → Updater and restart when ready.\nإصدار جديد من EvenCord متاح. حدّث من Updater ثم أعد التشغيل عند اكتمال التنزيل." },
                { type: 14, divider: true, spacing: 1 },
                { type: 10, content: notes.length > 2200 ? notes.slice(0, 2200) + `\n\n[Full release notes](${release})` : notes },
                { type: 14, divider: true, spacing: 1 },
                { type: 1, components: links.map(([label, url]) => ({ type: 2, style: 5, label, url })) },
                { type: 10, content: "-# EvenCord · Developed by BOSS · Official release" }
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
