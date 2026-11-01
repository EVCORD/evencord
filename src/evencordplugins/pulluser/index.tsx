/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Link } from "@components/Link";
import { Paragraph } from "@components/Paragraph";
import { EvenCordAuthors } from "@evencordplugins/_authors";
import { Logger } from "@utils/Logger";
import definePlugin from "@utils/types";
import { ChannelStore, Menu, PermissionsBits, PermissionStore, RestAPI, SelectedChannelStore, UserStore, VoiceStateStore } from "@webpack/common";

const users = new Set<string>();
const pending = new Set<string>();
const movedAt = new Map<string, number>();
const logger = new Logger("PullUser");
let active = false;
let retryAt = 0;

function pull() {
    if (!active || Date.now() < retryAt) return;
    const myId = UserStore.getCurrentUser()?.id;
    if (!myId) return;
    const mine = VoiceStateStore.getVoiceStateForUser(myId);
    const target = mine?.channelId ? ChannelStore.getChannel(mine.channelId) : null;
    if (!target?.guild_id || !PermissionStore.can(PermissionsBits.MOVE_MEMBERS, target) || !PermissionStore.can(PermissionsBits.CONNECT, target)) return;
    for (const id of users) {
        const voice = VoiceStateStore.getVoiceStateForUser(id);
        const source = voice?.channelId ? ChannelStore.getChannel(voice.channelId) : null;
        if (!source || source.id === target.id || source.guild_id !== target.guild_id || pending.has(id) || Date.now() - (movedAt.get(id) ?? 0) < 5000 || !PermissionStore.can(PermissionsBits.MOVE_MEMBERS, source)) continue;
        pending.add(id);
        movedAt.set(id, Date.now());
        void RestAPI.patch({ url: `/guilds/${target.guild_id}/members/${id}`, body: { channel_id: target.id }, retries: 0 }).catch((error: unknown) => {
            if (typeof error === "object" && error !== null && "status" in error && error.status === 429) {
                const body = "body" in error && typeof error.body === "object" && error.body !== null ? error.body : {};
                const seconds = "retry_after" in body ? Number(body.retry_after) : 5;
                retryAt = Date.now() + (Number.isFinite(seconds) ? Math.max(1, seconds) : 5) * 1000 + 250;
            }
            logger.error("Could not move a selected member.", error);
        }).finally(() => pending.delete(id));
    }
}

export default definePlugin({
    name: "PullUser",
    description: "ينقل أعضاء تختارهم معك بين الرومات الصوتية ضمن صلاحياتك.",
    authors: [EvenCordAuthors.viciouscal],
    tags: ["Voice"],
    settingsAboutComponent: () => <Paragraph dir="rtl">أضف العضو من قائمته بزر الفأرة الأيمن. المصدر: <Link href="https://github.com/viciouscal/Vencord/tree/main/src/plugins/pulluser">viciouscal</Link>.</Paragraph>,
    contextMenus: {
        "user-context": (children, { user }) => {
            if (!user || user.id === UserStore.getCurrentUser()?.id) return;
            const voice = VoiceStateStore.getVoiceStateForUser(user.id);
            const channelId = voice?.channelId ?? SelectedChannelStore.getVoiceChannelId();
            const channel = channelId ? ChannelStore.getChannel(channelId) : null;
            if (!channel || !PermissionStore.can(PermissionsBits.MOVE_MEMBERS, channel)) return;
            children.push(<Menu.MenuGroup key="pulluser"><Menu.MenuCheckboxItem id="evencord-pulluser" label="نقله معي بين الرومات" checked={users.has(user.id)} action={() => { if (users.has(user.id)) users.delete(user.id); else users.add(user.id); pull(); }} /></Menu.MenuGroup>);
        },
        "channel-context": children => {
            if (users.size) children.push(<Menu.MenuItem key="pulluser-clear" id="evencord-pulluser-clear" label="إفراغ قائمة النقل" color="danger" action={() => users.clear()} />);
        }
    },
    flux: { VOICE_STATE_UPDATES: pull, LOGOUT: () => users.clear() },
    start() { active = true; },
    stop() { active = false; users.clear(); movedAt.clear(); }
});
