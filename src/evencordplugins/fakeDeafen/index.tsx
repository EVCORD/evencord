/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

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
    mute: { type: OptionType.BOOLEAN, description: "Appear muted while active.", default: true },
    deafen: { type: OptionType.BOOLEAN, description: "Appear deafened while active.", default: true },
    cam: { type: OptionType.BOOLEAN, description: "Appear to have your camera on while active.", default: false },
    hideIcon: { type: OptionType.BOOLEAN, description: "Hide the user panel button.", default: false },
    keybind: { type: OptionType.STRING, description: "Toggle shortcut, such as F9 or Ctrl+Shift+D.", default: "F9" },
    active: { type: OptionType.BOOLEAN, description: "Current state.", default: false, hidden: true }
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

function DeafenIcon({ className, active = false }: { className?: string; active?: boolean; }) {
    return <svg className={className} viewBox="0 0 32 32" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M8 15v-3a8 8 0 0 1 16 0v3M8 13H6v7h5v-7zm16 0h2v7h-5v-7z" />
        {active && <path d="m7 3 18 18" />}
        <rect x="3" y="22" width="26" height="10" rx="4" fill={active ? "var(--status-positive)" : "var(--background-modifier-accent)"} stroke="none" />
        <text x="16" y="29.5" textAnchor="middle" fill={active ? "var(--white)" : "var(--text-muted)"} stroke="none" fontSize="9" fontWeight="800">{active ? "ON" : "OFF"}</text>
    </svg>;
}

const controlSettings = ["active", "hideIcon"] as const;
const Control = ErrorBoundary.wrap(() => {
    const { active, hideIcon } = settings.use(controlSettings);
    const label = `FakeDeafen: ${active ? "ON" : "OFF"}`;
    return hideIcon ? null : <UserAreaButton className={active ? "vc-fakedeafen-active" : undefined} icon={<DeafenIcon active={active} />} tooltipText={`${label} · Click to ${active ? "disable" : "enable"}`} role="switch" aria-checked={active} aria-label={label} onClick={toggle} />;
}, { noop: true });

export default definePlugin({
    name: "FakeDeafen",
    description: "Customize the voice status others see while keeping your local audio controls.",
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
    toolboxActions: { "Toggle FakeDeafen": toggle },
    start() { settings.store.active = false; document.addEventListener("keydown", onKey); },
    stop() {
        document.removeEventListener("keydown", onKey);
        if (settings.store.active) { settings.store.active = false; if (!syncing) void refreshVoice().catch(error => logger.error("Could not restore voice state.", error)); }
    }
});
