/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import { Paragraph } from "@components/Paragraph";
import { EvenCordAuthors } from "@evencordplugins/_authors";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy, findStoreLazy } from "@webpack";
import { ChannelStore, Menu, PermissionsBits, PermissionStore, React,RestAPI, SelectedChannelStore, showToast, UserStore } from "@webpack/common";

const VoiceStateStore: VoiceStateStore = findStoreLazy("VoiceStateStore");
const ChannelActions: {
    disconnect: () => void;
    selectVoiceChannel: (channelId: string) => void;
} = findByPropsLazy("disconnect", "selectVoiceChannel");

interface VoiceStateStore {
    getAllVoiceStates(): VoiceStateEntry;
    getVoiceStatesForChannel(channelId: string): VoiceStateMember;
}

interface VoiceStateEntry {
    [guildIdOrMe: string]: VoiceStateMember;
}

interface VoiceStateMember {
    [userId: string]: VoiceState;
}

interface VoiceState {
    userId: string;
    channelId?: string;
    oldChannelId?: string;
    guildId?: string;
    deaf: boolean;
    mute: boolean;
    selfDeaf: boolean;
    selfMute: boolean;
    selfStream: boolean;
    selfVideo: boolean;
    sessionId: string;
    suppress: boolean;
    requestToSpeakTimestamp: string | null;
    communicationDisabledUntil?: string | null;
}

let lastChannelId: string | null = null;
let isHandlingAction = false;
let lastMoveTimestamp = 0;
let pinnedChannelId: string | null = null;
const debounceTime = 1500; // Reduced from 3000ms to 1500ms for faster response

const settings = definePluginSettings({
    reconnect: {
        type: OptionType.BOOLEAN,
        description: "Automatically reconnect if disconnected",
        default: true,
    },
    autoUndeafen: {
        type: OptionType.BOOLEAN,
        description: "Request server undeafen when you have Deafen Members permission.",
        default: false,
    },
    autoUnmute: {
        type: OptionType.BOOLEAN,
        description: "Request server unmute when you have Mute Members permission.",
        default: false,
    },
    moveToPinned: {
        type: OptionType.BOOLEAN,
        description: "Return to pinned channel if moved",
        default: true,
    },
    cooldown: {
        type: OptionType.SLIDER,
        description: "Cooldown between actions (in seconds)",
        default: 1, // Reduced from 2 to 1 second
        markers: [0.5, 1, 1.5, 2, 3],
    },
});

async function addCooldown() {
    isHandlingAction = true;
    await new Promise(resolve => setTimeout(resolve, settings.store.cooldown * 1000));
    isHandlingAction = false;
}

function handleVoiceStateUpdate(voiceStates: VoiceState[]) {
    if (isHandlingAction) return;

    const myId = UserStore.getCurrentUser().id;
    const myVoiceState = voiceStates.find(state => state.userId === myId);

    // Handle disconnection and reconnection
    if ((!myVoiceState || !myVoiceState.channelId) && lastChannelId && pinnedChannelId) {
        const now = Date.now();

        if (settings.store.reconnect && now - lastMoveTimestamp > debounceTime) {
            const voiceStates = VoiceStateStore.getVoiceStatesForChannel(lastChannelId);
            const isAlreadyInChannel = voiceStates && Object.keys(voiceStates).includes(myId);

            if (!isAlreadyInChannel && pinnedChannelId === lastChannelId) {
                lastMoveTimestamp = now;
                ChannelActions.selectVoiceChannel(lastChannelId);
                showToast({ text: "Returning to the pinned voice channel." });
                addCooldown();
            }
        }
        return;
    }

    if (!myVoiceState?.channelId) return;
    const channel = ChannelStore.getChannel(myVoiceState.channelId);
    if (!channel || !PermissionStore.can(PermissionsBits.CONNECT, channel)) return;

    // Prevent moving from pinned channel
    if (settings.store.moveToPinned && pinnedChannelId && myVoiceState.channelId !== pinnedChannelId) {
        ChannelActions.selectVoiceChannel(pinnedChannelId);
        showToast({ text: "You are pinned to this channel!", variant: "critical" });
        addCooldown();
        return;
    }

    // Auto undeafen
    if (settings.store.autoUndeafen && myVoiceState.deaf && myVoiceState.guildId && PermissionStore.can(PermissionsBits.DEAFEN_MEMBERS, channel)) {
        RestAPI.patch({
            url: `/guilds/${myVoiceState.guildId}/members/${myId}`,
            body: { deaf: false },
        }).catch(() => showToast({ text: "Discord rejected the server undeafen request.", variant: "critical" }));
        addCooldown();
    }

    // Auto unmute
    if (settings.store.autoUnmute && myVoiceState.mute && myVoiceState.guildId && PermissionStore.can(PermissionsBits.MUTE_MEMBERS, channel)) {
        RestAPI.patch({
            url: `/guilds/${myVoiceState.guildId}/members/${myId}`,
            body: { mute: false },
        }).catch(() => showToast({ text: "Discord rejected the server unmute request.", variant: "critical" }));
        addCooldown();
    }

    lastChannelId = myVoiceState.channelId ?? null;
    lastMoveTimestamp = Date.now();
}

const fluxListener = {
    VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: VoiceState[]; }) {
        handleVoiceStateUpdate(voiceStates);
    },
};

const addPinChannelContextMenu: NavContextMenuPatchCallback = (children, { channel }) => {
    if (!channel || channel.type !== 2) return;

    children.push(
        <Menu.MenuItem
            id="pin-channel"
            label={pinnedChannelId === channel.id ? "Unpin Channel" : "Pin Channel"}
            action={() => {
                pinnedChannelId = pinnedChannelId === channel.id ? null : channel.id;
                showToast({ text: pinnedChannelId ? `Pinned channel: ${channel.name}` : "Channel unpinned", variant: "success" });
            }}
        />
    );
};

export default definePlugin({
    name: "DontControlMe",
    description: "Return to a pinned voice channel, with optional permission-checked server mute and deafen requests.",
    authors: [EvenCordAuthors.Unknown],
    settings,
    settingsAboutComponent: () => <Paragraph>Pin a channel from its context menu. Reconnection still requires access to that channel. Server mute and deafen changes require your existing Discord permissions; this plugin cannot bypass moderation or access controls.</Paragraph>,

    flux: fluxListener,

    contextMenus: {
        "channel-context": addPinChannelContextMenu,
    },

    start() {
        const channelID = SelectedChannelStore.getVoiceChannelId();
        if (channelID) {
            const voiceStates = VoiceStateStore.getVoiceStatesForChannel(channelID);
            lastChannelId = voiceStates?.[UserStore.getCurrentUser().id]?.channelId ?? null;
        }
    },

    stop() {
        lastChannelId = null;
        pinnedChannelId = null;
        isHandlingAction = false;
    },
});
