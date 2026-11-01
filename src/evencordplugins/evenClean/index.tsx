/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { HeaderBarButton } from "@api/HeaderBar";
import { definePluginSettings, useSettings } from "@api/Settings";
import { Button } from "@components/Button";
import { Paragraph } from "@components/Paragraph";
import { EvenCordAuthors } from "@evencordplugins/_authors";
import definePlugin, { OptionType } from "@utils/types";
import { ChannelStore, PermissionsBits, PermissionStore, React, RestAPI, UserStore } from "@webpack/common";
import type { SVGProps } from "react";

import { createCleaner } from "./engine";
import { closeCleanup, openCleanup } from "./panel";

export const settings = definePluginSettings({
    deleteDelay: {
        type: OptionType.SELECT,
        description: "أقل فاصل بين الرسائل. يُضاف وقت عشوائي حتى نصف هذا الفاصل، مع احترام انتظار Discord بالكامل.",
        options: [
            { label: "1.5 seconds", value: 1500, default: true },
            { label: "3 seconds", value: 3000 },
            { label: "5 seconds", value: 5000 }
        ]
    }
});

export function canAccess(id: string) {
    const channel = ChannelStore.getChannel(id);
    if (!channel || ![0, 1, 2, 3, 5, 10, 11, 12, 13].includes(channel.type)) return false;
    return !channel.guild_id || (PermissionStore.can(PermissionsBits.VIEW_CHANNEL, channel) && PermissionStore.can(PermissionsBits.READ_MESSAGE_HISTORY, channel));
}

export const cleaner = createCleaner({
    currentUser: () => UserStore.getCurrentUser()?.id,
    canAccess,
    request: (method, url, query) => RestAPI[method]({ url, query, retries: 0 })
});

export function CleanupIcon(props: SVGProps<SVGSVGElement>) {
    return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true" {...props}>
        <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7m4-7v7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>;
}

function CleanupButton() {
    const state = React.useSyncExternalStore(cleaner.subscribe, cleaner.snapshot);
    return <HeaderBarButton icon={CleanupIcon} iconSize={20} aria-label="حذف الرسائل" tooltip={cleaner.busy() ? `حذف الرسائل: ${state.phase}` : "حذف الرسائل | EvenClean"} onClick={openCleanup} />;
}

function CleanupSettings() {
    const { enabled } = useSettings(["plugins.EvenClean.enabled"]).plugins.EvenClean;
    return <>
        <section dir="rtl" lang="ar">
            <Paragraph>احذف رسائلك من الخاص أو قنوات تختارها، مع البحث بالنص والتاريخ والمرفقات والروابط. الرسائل المثبتة مستثناة افتراضياً.</Paragraph>
            <Paragraph>حدد المحادثات، اضغط البحث عن رسائلي، ثم راجع النتائج وأكد حذف الدفعة. يمكنك إيقاف العملية واستئنافها من النافذة.</Paragraph>
        </section>
        <Button disabled={!enabled} onClick={openCleanup}>حذف الرسائل</Button>
    </>;
}

export default definePlugin({
    name: "EvenClean",
    searchTerms: ["حذف الرسائل", "Message deletion", "Delete messages"],
    description: "حذف الرسائل: ابحث عن رسائلك وراجعها ثم أكد الحذف بعلامة صح، مع فلاتر وإيقاف مؤقت واستئناف.",
    authors: [EvenCordAuthors.EvenCord],
    enabledByDefault: false,
    tags: ["Chat", "Utility"],
    dependencies: ["HeaderBarAPI"],
    settings,
    settingsAboutComponent: CleanupSettings,
    headerBarButton: { icon: CleanupIcon, render: CleanupButton, location: "headerbar" },
    toolboxActions: { "حذف الرسائل": openCleanup },
    flux: { LOGOUT: () => { cleaner.dispose(); closeCleanup(); } },
    stop: () => { cleaner.dispose(); closeCleanup(); }
});
