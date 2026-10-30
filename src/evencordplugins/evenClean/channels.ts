/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { Channel } from "@vencord/discord-types";
import { ChannelStore, GuildStore, UserStore } from "@webpack/common";

import { canAccess } from ".";

export type CleanupScope = "current" | "dms" | "server";

export function channelTitle(channel: Channel) {
    if (channel.guild_id) return `#${channel.name || channel.id}`;
    if (channel.name) return channel.name;
    return channel.recipients.map(id => {
        const user = UserStore.getUser(id);
        return user?.globalName || user?.username || `User ${id}`;
    }).join(", ") || `Conversation ${channel.id}`;
}

export function channelLabel(channel: Channel) {
    const context = channel.guild_id ? GuildStore.getGuild(channel.guild_id)?.name ?? "Server" : channel.type === 3 ? "Group DM" : "DM";
    return `${context} / ${channelTitle(channel)}`;
}

export function getCleanupChannels() {
    const channels = new Map<string, Channel>();
    const add = (channel: Channel) => { if (channel && canAccess(channel.id)) channels.set(channel.id, channel); };
    Object.values(ChannelStore.getMutablePrivateChannels()).forEach(add);
    for (const guild of Object.values(GuildStore.getGuilds())) {
        Object.values(ChannelStore.getMutableGuildChannelsForGuild(guild.id)).forEach(add);
        ChannelStore.getAllThreadsForGuild(guild.id).forEach(add);
    }
    ChannelStore.getChannelIds().forEach(id => add(ChannelStore.getChannel(id)));
    return [...channels.values()].sort((a, b) => channelLabel(a).localeCompare(channelLabel(b)));
}

export function filterCleanupChannels(channels: Channel[], scope: CleanupScope, guildId: string, currentId: string | undefined, search: string) {
    const query = search.trim().toLocaleLowerCase();
    return channels.filter(channel => {
        const matchesScope = scope === "current" ? channel.id === currentId : scope === "dms" ? !channel.guild_id : channel.guild_id === guildId;
        return matchesScope && (!query || channelLabel(channel).toLocaleLowerCase().includes(query) || channel.id.includes(query));
    });
}

export function addCleanupChannels(selected: ReadonlySet<string>, channels: Channel[]) {
    const next = new Set(selected);
    for (const channel of channels) {
        if (next.size >= 100) break;
        next.add(channel.id);
    }
    return next;
}
