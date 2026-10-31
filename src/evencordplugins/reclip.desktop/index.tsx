/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { migratePluginSettings } from "@api/Settings";
import { UserAreaButton } from "@api/UserArea";
import ErrorBoundary from "@components/ErrorBoundary";
import { Logger } from "@utils/Logger";
import definePlugin, { type PluginNative } from "@utils/types";
import { ContextMenuApi, Menu, React, showToast } from "@webpack/common";

import { ClipIcon, Controls, duration } from "./components";
import { CAPTURE_KEYS, captureOptions, settings, videoOptions } from "./settings";
import style from "./style.css?managed";
import type { CaptureOptions, CaptureStatus } from "./types";

const Native = VencordNative.pluginHelpers.Reclip as PluginNative<typeof import("./native")>;
const logger = new Logger("Reclip");
const listeners = new Set<() => void>();
let state: CaptureStatus & { busy: string; lastSaved?: string; } = { active: false, seconds: 0, microphone: "", error: "", busy: "" };
let running = false;
let lifecycle = 0;
let operation = 0;
let timer: ReturnType<typeof setInterval> | undefined;
let refreshing = false;

function update(next: Partial<typeof state>) {
    state = { ...state, ...next };
    for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

function useCapture() {
    return React.useSyncExternalStore(subscribe, () => state);
}

function notify(text: string, failed = false) {
    if (!failed && !settings.store.notifications) return;
    showToast({ text: `Reclip: ${text}`, variant: failed ? "critical" : "success" });
}

async function refresh() {
    if (!running || !state.active || refreshing || state.busy) return;
    refreshing = true;
    const token = lifecycle;
    const revision = operation;
    try {
        const next = await Native.status();
        if (token !== lifecycle || revision !== operation || !running) return;
        if (next.error && state.active) {
            notify(next.error, true);
            await Native.stopRecording();
        }
        if (token === lifecycle && revision === operation) update(next);
    } catch (error) {
        logger.error("Could not read recording status", error);
    } finally { refreshing = false; }
}

async function toggle() {
    if (!running) { notify("Enable Reclip in EvenCord before starting a recording.", true); return; }
    if (state.busy) return;
    operation++;
    const token = lifecycle;
    update({ busy: state.active ? "Stopping…" : "Starting…", error: "" });
    try {
        if (state.active) {
            await Native.stopRecording();
            if (token !== lifecycle) return;
            update({ active: false, seconds: 0, microphone: "", shortened: false, memoryMiB: 0 });
            notify("Recording stopped. Unsaved footage was discarded.");
        } else {
            let options: CaptureOptions;
            try { options = captureOptions(); }
            catch (error) {
                const message = error instanceof Error ? error.message : "Check the selected microphone in Reclip settings.";
                update({ error: message });
                notify(message, true);
                return;
            }
            const result = await Native.startRecording(options);
            if (token !== lifecycle) return;
            if (result.error) { update({ error: result.error }); notify(result.error, true); }
            else {
                update({ active: true, seconds: 0, targetSeconds: options.seconds, memoryLimitMiB: options.memoryMiB, memoryMiB: 0, shortened: false, resolution: "", fps: options.fps });
                notify(`Recording started. Keeping up to ${duration(options.seconds)}. Use Save clip or your save shortcut to keep a moment.`);
            }
        }
    } catch (error) {
        logger.error("Could not change recording state", error);
        if (token === lifecycle) notify("Could not contact the recorder. Rebuild and fully relaunch Discord after installing this plugin.", true);
    } finally { if (token === lifecycle) update({ busy: "" }); }
}

async function save() {
    if (!running || state.busy) return;
    if (!state.active) { notify("Start recording first. Previous footage cannot be recovered.", true); return; }
    operation++;
    const token = lifecycle;
    update({ busy: settings.store.exportFormat === "mp4" ? "Saving MP4…" : "Saving clip…" });
    try {
        const format = settings.store.exportFormat;
        if (format !== "webm" && format !== "mp4" && format !== "mkv") throw new Error("Choose WebM, MP4 or MKV in Reclip settings.");
        const result = await Native.saveClip(format, settings.store.saveFolder);
        if (token !== lifecycle) return;
        if (result.error) notify(result.error, true);
        else {
            update({ lastSaved: result.path });
            const actualFormat = result.path?.split(".").pop()?.toUpperCase() || format.toUpperCase();
            notify(`Saved ${actualFormat} clip (${duration(result.seconds ?? 0)}) to your selected clips folder. Recording continues.`);
            if (result.warning) notify(result.warning, true);
        }
    } catch (error) {
        logger.error("Could not save the clip", error);
        if (token === lifecycle) notify("Could not contact the recorder to save the clip.", true);
    } finally { if (token === lifecycle) update({ busy: "" }); }
}

async function openFolder() {
    try { const error = await Native.openFolder(settings.store.saveFolder); if (error) notify(error, true); }
    catch (error) { logger.error("Could not open clip folder", error); notify("Could not open the clip folder.", true); }
}

async function showLastClip() {
    try { const error = await Native.showLastClip(); if (error) notify(error, true); }
    catch (error) { logger.error("Could not show the saved clip", error); notify("Could not locate the last saved clip.", true); }
}

const CaptureButton = ErrorBoundary.wrap(() => {
    const capture = useCapture();
    const { showIcon } = settings.use(CAPTURE_KEYS);
    if (!showIcon) return null;
    const target = capture.active ? capture.targetSeconds ?? videoOptions().seconds : videoOptions().seconds;
    return <UserAreaButton
        icon={<ClipIcon recording={capture.active} busy={Boolean(capture.busy)} />}
        tooltipText={capture.busy || (capture.active ? `Reclip: Save ${duration(capture.seconds)} of ${duration(target)}. Right click for controls.` : `Reclip: Start a ${duration(target)} replay buffer`)}
        redGlow={capture.active}
        disabled={Boolean(capture.busy)}
        onClick={() => { void (capture.active ? save() : toggle()); }}
        onContextMenu={event => ContextMenuApi.openContextMenu(event, () => <Menu.Menu navId="Reclip" onClose={ContextMenuApi.closeContextMenu}>
            <Menu.MenuItem id="Reclip-toggle" label={capture.active ? "Stop recording and discard buffer" : "Start recording"} disabled={Boolean(capture.busy)} action={() => { void toggle(); }} />
            <Menu.MenuItem id="Reclip-save" label={`Save available clip (${duration(capture.seconds)})`} disabled={!capture.active || Boolean(capture.busy)} action={() => { void save(); }} />
            <Menu.MenuItem id="Reclip-last" label="Show last saved clip" disabled={!capture.lastSaved} action={() => { void showLastClip(); }} />
            <Menu.MenuItem id="Reclip-folder" label="Open saved clips" action={() => { void openFolder(); }} />
        </Menu.Menu>)}
    />;
}, { noop: true });

function SettingsPanel() {
    const capture = useCapture();
    return <Controls capture={capture} toggle={() => { void toggle(); }} save={() => { void save(); }}
        openFolder={() => { void openFolder(); }} showLastClip={() => { void showLastClip(); }} />;
}

migratePluginSettings("Reclip", "bossclip");

export default definePlugin({
    name: "Reclip",
    description: "احفظ آخر لحظات نافذة Discord على Windows بضغطة، مع اختيار مدة المقطع والجودة وصوت النظام والميكروفون ومجلد الحفظ.",
    authors: [],
    tags: ["Media", "Utility"],
    searchTerms: ["bossclip", "replay", "recorder", "clips"],
    dependencies: ["UserAreaAPI"],
    settings,
    settingsAboutComponent: SettingsPanel,
    managedStyle: style,
    userAreaButton: { icon: ClipIcon, render: props => <CaptureButton {...props} /> },
    toolboxActions: {
        "Start or stop recording": () => { void toggle(); },
        "Save recent clip": () => { void save(); },
        "Open clips folder": () => { void openFolder(); }
    },
    async start() {
        running = true;
        const token = ++lifecycle;
        try {
            if (!settings.store.replayDefaultsMigrated) {
                if (settings.store.clipLength === 600) settings.store.clipLength = 120;
                settings.store.replayDefaultsMigrated = true;
            }
            if (!settings.store.microphoneDefaultMigrated) {
                if (!settings.store.microphoneDevice || settings.store.microphoneDevice === "discord")
                    settings.store.microphoneDevice = "default";
                settings.store.microphoneDefaultMigrated = true;
            }
            if (!Native) throw new Error("Native helper missing.");
            const result = await Native.initialize(settings.store.saveKey.trim(), settings.store.toggleKey.trim());
            if (token !== lifecycle || !running) return;
            if (result.error) { running = false; update({ error: result.error }); notify(result.error, true); return; }
            for (const warning of result.warnings) notify(warning, true);
            timer = setInterval(() => { void refresh(); }, 3000);
            void (async () => {
                try {
                    while (running && token === lifecycle) {
                        const action = await Native.waitForShortcut();
                        if (!running || token !== lifecycle) break;
                        if (action === "save") void save();
                        else if (action === "toggle") void toggle();
                    }
                } catch (error) {
                    logger.error("Global shortcut listener stopped", error);
                    if (running && token === lifecycle) notify("Global shortcuts are unavailable. The recording buttons still work.", true);
                }
            })();
            if (settings.store.autoStart) void toggle();
        } catch (error) {
            logger.error("Could not initialize recorder", error);
            if (token === lifecycle) {
                running = false;
                update({ error: "The native helper is unavailable. Build and fully relaunch Discord after installing Reclip." });
                notify(state.error, true);
            }
        }
    },
    async stop() {
        running = false;
        lifecycle++;
        if (timer) clearInterval(timer);
        timer = undefined;
        try { await Native?.shutdown(); }
        catch (error) { logger.error("Could not shut down recorder", error); }
        update({ active: false, seconds: 0, microphone: "", busy: "", error: "", shortened: false, memoryMiB: 0 });
    }
});
