/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { UserAreaButton } from "@api/UserArea";
import ErrorBoundary from "@components/ErrorBoundary";
import { Link } from "@components/Link";
import { Paragraph } from "@components/Paragraph";
import { EvenCordAuthors } from "@evencordplugins/_authors";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import { VoiceActions } from "@webpack/common";

const settings = definePluginSettings({
    mute: { type: OptionType.BOOLEAN, description: "إظهار حالة كتم الميكروفون للآخرين عند التفعيل.", default: true },
    deafen: { type: OptionType.BOOLEAN, description: "إظهار حالة كتم السماعات للآخرين عند التفعيل.", default: true },
    cam: { type: OptionType.BOOLEAN, description: "إظهار حالة الكاميرا للآخرين عند التفعيل.", default: false },
    hideIcon: { type: OptionType.BOOLEAN, description: "إخفاء زر الإضافة بجانب أدوات المستخدم.", default: false },
    keybind: { type: OptionType.STRING, description: "اختصار التفعيل، مثل F9 أو Ctrl+Shift+D.", default: "F9" },
    active: { type: OptionType.BOOLEAN, description: "الحالة الحالية.", default: false, hidden: true }
});

const logger = new Logger("FakeDeafen");
let syncing = false;

async function refreshVoice() {
    await VoiceActions.toggleSelfDeaf();
    await VoiceActions.toggleSelfDeaf();
}

function toggle() {
    if (syncing) return;
    settings.store.active = !settings.store.active;
    syncing = true;
    void refreshVoice().catch(error => { settings.store.active = false; logger.error("Could not refresh voice state.", error); }).finally(() => { syncing = false; });
}

function onKey(event: KeyboardEvent) {
    if (event.repeat || event.target instanceof HTMLElement && (event.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName))) return;
    const parts = settings.store.keybind.toLowerCase().split("+").map(part => part.trim());
    if (event.key.toLowerCase() !== parts[parts.length - 1] || event.ctrlKey !== parts.includes("ctrl") || event.altKey !== parts.includes("alt") || event.shiftKey !== parts.includes("shift") || event.metaKey) return;
    event.preventDefault();
    toggle();
}

function DeafenIcon({ className }: { className?: string; }) {
    return <svg className={className} viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 15v-3a8 8 0 0 1 16 0v3M4 13H2v7h5v-7zm16 0h2v7h-5v-7zM3 3l18 18" /></svg>;
}

const Control = ErrorBoundary.wrap(() => {
    const { active, hideIcon } = settings.use(["active", "hideIcon"]);
    return hideIcon ? null : <UserAreaButton icon={<DeafenIcon />} tooltipText={active ? "إيقاف FakeDeafen" : "تفعيل FakeDeafen"} redGlow={active} onClick={toggle} />;
}, { noop: true });

export default definePlugin({
    name: "FakeDeafen",
    description: "يخصص حالة الميكروفون والسماعات والكاميرا المعروضة للآخرين.",
    authors: [EvenCordAuthors.desu, EvenCordAuthors.viciouscal],
    dependencies: ["UserAreaAPI"],
    tags: ["Voice"],
    settings,
    settingsAboutComponent: () => <Paragraph dir="rtl">المصدر: <Link href="https://github.com/viciouscal/Vencord/tree/main/src/plugins/fakeDeafen">desu وviciouscal</Link>.</Paragraph>,
    patches: [{
        find: "}voiceStateUpdate(",
        replacement: {
            match: /self_mute:([^,]{1,80}),self_deaf:([^,]{1,80}),self_video:([^,]{1,80})/,
            replace: "self_mute:$self.flag($1,'mute'),self_deaf:$self.flag($2,'deafen'),self_video:$self.flag($3,'cam')"
        }
    }],
    flag(value: boolean, key: "mute" | "deafen" | "cam") { return settings.store.active ? settings.store[key] : value; },
    userAreaButton: { icon: DeafenIcon, render: () => <Control /> },
    toolboxActions: { "تفعيل أو إيقاف FakeDeafen": toggle },
    start() { settings.store.active = false; document.addEventListener("keydown", onKey); },
    stop() {
        document.removeEventListener("keydown", onKey);
        if (settings.store.active) { settings.store.active = false; if (!syncing) void refreshVoice().catch(error => logger.error("Could not restore voice state.", error)); }
    }
});
