/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { readFileSync } from "node:fs";

const repo = "EVCORD/evencord";
const installer = "EVCORD/evencord-installer";
const branch = "community-stats";
const config = JSON.parse(readFileSync("branding/community-stats.json", "utf8"));
const webhook = process.env.DISCORD_DOWNLOADS_WEBHOOK;
const githubToken = process.env.GH_TOKEN;
const site = "https://evcord.github.io/evencord/";
const format = value => new Intl.NumberFormat("en-US").format(value);
const text = content => ({ type: 10, content });
const separator = () => ({ type: 14, divider: true, spacing: 1 });
const button = (label, url, emojiId) => ({ type: 2, style: 5, label, url, ...(emojiId ? { emoji: { id: emojiId } } : {}) });

async function github(path, data, method = data ? "POST" : "GET", optional = false) {
    const response = await fetch(`https://api.github.com/${path}`, {
        method,
        headers: { Authorization: `Bearer ${githubToken}`, Accept: "application/vnd.github+json", "Content-Type": "application/json", "User-Agent": "EvenCord-Community" },
        body: data ? JSON.stringify(data) : undefined,
        signal: AbortSignal.timeout(20000)
    });
    if (optional && response.status === 404) return null;
    if (!response.ok) throw Error(`GitHub statistics request failed (${response.status}).`);
    return response.json();
}

async function discord(path, payload, method) {
    const response = await fetch(`${webhook}${path}?wait=true&with_components=true`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(20000)
    });
    if (response.status === 404 && method === "PATCH") return null;
    if (!response.ok) throw Error(`Discord download card could not be updated (${response.status}).`);
    return response.json();
}

async function main() {
    if (!githubToken || !webhook) throw Error("Community statistics credentials are missing.");
    const ref = await github(`repos/${repo}/git/ref/heads/${branch}`, undefined, "GET", true);
    const previousFile = ref ? await github(`repos/${repo}/contents/stats.json?ref=${branch}`) : null;
    const previous = previousFile ? JSON.parse(Buffer.from(previousFile.content, "base64").toString("utf8")) : null;
    const downloads = { total: 0, windows: 0, macos: 0, linux: 0 };
    const releases = [];
    for (let page = 1; ; page++) {
        const batch = await github(`repos/${installer}/releases?per_page=100&page=${page}`);
        releases.push(...batch.filter(release => !release.draft));
        if (batch.length < 100) break;
    }
    const assets = [];
    for (const release of releases) {
        for (const asset of release.assets) {
            if (!/^EvenCord(?:Installer)?(?:Cli|-cli)?(?:-[\w-]+)?(?:\.exe|\.dmg)?$/.test(asset.name)) continue;
            const platform = asset.name.endsWith(".exe") ? "windows" : asset.name.endsWith(".dmg") || /(?:Cli|-cli)-(?:x64|universal)$/.test(asset.name) ? "macos" : "linux";
            downloads[platform] += asset.download_count;
            downloads.total += asset.download_count;
            assets.push({ release: release.tag_name, name: asset.name, downloads: asset.download_count });
        }
    }
    const latest = await github(`repos/${repo}/releases/latest`);
    const updatedAt = new Date().toISOString();
    const timestamp = Math.floor(Date.parse(updatedAt) / 1000);
    const stats = { updatedAt, firstUpdatedAt: previous?.firstUpdatedAt ?? updatedAt, metric: "Installer asset downloads, not unique users", source: `https://github.com/${installer}/releases`, downloads, latestRelease: latest.tag_name, assets };
    const payload = {
        flags: 32768,
        content: null,
        embeds: [],
        allowed_mentions: { parse: [] },
        components: [{ type: 17, accent_color: 0x805263, components: [
            { type: 9, components: [text(`## <:ev_logo:${config.logoEmojiId}> تحميل EvenCord`), text("‏اختر نظام جهازك، وحمّل النسخة المناسبة من المصدر الرسمي.")], accessory: { type: 11, media: { url: "https://raw.githubusercontent.com/EVCORD/evencord/main/branding/assets/icon-256.png" } } },
            separator(),
            ...[
                ["Windows", "‏للأجهزة التي تعمل بنظام ويندوز.", "Windows"],
                ["macOS", "‏لأجهزة ماك بمعالجات آبل وإنتل.", "macOS"],
                ["Linux", "‏للأجهزة التي تعمل بنظام لينكس.", "Linux"]
            ].map(([name, description, os]) => ({ type: 9, components: [text(`### ${name}\n${description}`)], accessory: button("تحميل", `${site}download/?os=${os}`, config.downloadEmojiId) })),
            { type: 1, components: [button("جميع النسخ والمعماريات", `${site}download/`, config.downloadEmojiId), button("المساعدة في التثبيت", `${site}faq/`, config.guideEmojiId)] },
            separator(),
            text("### طريقة التثبيت\n‏أغلق ديسكورد بالكامل، افتح المثبت وحدد نسخة ديسكورد، ثم اختر **Install**.\n‏لإصلاح تثبيت سابق، اختر **Repair** من المثبت."),
            separator(),
            text(`### التحميلات\n# ${format(downloads.total)}\n‏عمليات تحميل المثبت عبر الإصدارات المنشورة.`),
            text(`**Windows**　${format(downloads.windows)}\n**macOS**　${format(downloads.macos)}\n**Linux**　${format(downloads.linux)}`),
            text("-# ‏تشمل إعادة التنزيل؛ لا تمثل عدد مستخدمين فريدين."),
            separator(),
            { type: 9, components: [text(`### أحدث إصدار\n${latest.tag_name.replace(/^core-v/, "")}`)], accessory: button("تفاصيل التحديث", latest.html_url) },
            text(`-# ‏تحديث الإحصائيات كل ساعة · آخر تحديث <t:${timestamp}:R>`),
            text("-# EvenCord · BOSS")
        ] }]
    };
    let message = previous?.discordMessageId ? await discord(`/messages/${previous.discordMessageId}`, payload, "PATCH") : null;
    if (!message) {
        const create = { ...payload };
        delete create.content;
        delete create.embeds;
        message = await discord("", create, "POST");
    }
    stats.discordMessageId = message.id;
    stats.discordChannelId = config.channelId;
    const count = format(downloads.total);
    const width = 150 + count.length * 10;
    const badge = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="36" role="img" aria-label="Installer downloads: ${count}"><title>Installer downloads: ${count}</title><rect width="${width}" height="36" rx="8" fill="#191A1E"/><path d="M8 0h4v36H8z" fill="#805263"/><g fill="#F0EDEB" font-family="Verdana,Arial,sans-serif" font-size="12"><text x="25" y="23">Downloads</text><text x="${width - 16}" y="23" text-anchor="end" font-weight="bold">${count}</text></g></svg>\n`;
    const currentCommit = ref ? await github(`repos/${repo}/git/commits/${ref.object.sha}`) : null;
    const tree = await github(`repos/${repo}/git/trees`, {
        ...(currentCommit ? { base_tree: currentCommit.tree.sha } : {}),
        tree: [
            { path: "stats.json", mode: "100644", type: "blob", content: JSON.stringify(stats, null, 2) + "\n" },
            { path: "downloads.svg", mode: "100644", type: "blob", content: badge }
        ]
    });
    const commit = await github(`repos/${repo}/git/commits`, { message: "Update community download statistics", tree: tree.sha, parents: ref ? [ref.object.sha] : [] });
    if (ref) await github(`repos/${repo}/git/refs/heads/${branch}`, { sha: commit.sha, force: false }, "PATCH");
    else await github(`repos/${repo}/git/refs`, { ref: `refs/heads/${branch}`, sha: commit.sha });
    console.log(JSON.stringify({ downloads, messageId: message.id, updatedAt }));
}

main().catch(() => { console.error("Community statistics update failed. Check the GitHub token and scoped download webhook."); process.exitCode = 1; });
