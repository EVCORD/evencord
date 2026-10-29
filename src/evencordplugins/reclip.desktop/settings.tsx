/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Paragraph } from "@components/Paragraph";
import { OptionType } from "@utils/types";
import { MediaEngineStore, Select, useStateFromStores } from "@webpack/common";

import type { CaptureOptions } from "./types";

const MIC_KEYS: ["microphoneDevice"] = ["microphoneDevice"];

function MicrophonePicker() {
    const { microphoneDevice } = settings.use(MIC_KEYS);
    const devices = useStateFromStores([MediaEngineStore], () => MediaEngineStore.getInputDevices());
    const current = useStateFromStores([MediaEngineStore], () => MediaEngineStore.getInputDeviceId());
    const options = [
        { label: "Windows default microphone", value: "default" },
        { label: "Follow Discord's input device", value: "discord" },
        { label: "Windows communications microphone", value: "communications" },
        { label: "Microphone off", value: "off" },
        ...Object.values(devices).filter(device => !device.disabled && device.index !== -1 && !["default", "communications"].includes(device.id))
            .map(device => ({ label: device.name, value: `device:${device.id}` }))
    ];
    if (!options.some(option => option.value === microphoneDevice))
        options.push({ label: "Selected microphone is disconnected", value: microphoneDevice });
    return <div role="group" aria-label="Microphone source">
        <Paragraph>Microphone</Paragraph>
        <Select options={options} serialize={(value: string) => value} isSelected={(value: string) => value === microphoneDevice}
            select={(value: string) => { settings.store.microphoneDevice = value; }} />
        <Paragraph>Discord currently uses {devices[current]?.name || "the default input"}. This selection is saved immediately and applies to the next recording.</Paragraph>
    </div>;
}

export const settings = definePluginSettings({
    clipLength: {
        displayName: "Clip length",
        type: OptionType.SELECT,
        description: "How much recent footage to keep and save.",
        options: [
            { label: "2 minutes", value: 120, default: true }, { label: "5 minutes", value: 300 },
            { label: "10 minutes", value: 600 }, { label: "Custom duration", value: 0 }
        ]
    },
    customMinutes: {
        displayName: "Custom minutes",
        type: OptionType.NUMBER, default: 2,
        description: "Custom clip length in minutes, from 1 to 30. Used when Custom duration is selected.",
        isValid: value => typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 30 || "Enter a whole number from 1 to 30."
    },
    quality: {
        displayName: "Recording quality",
        type: OptionType.SELECT, description: "Picture quality and recording workload.",
        options: [
            { label: "Light: 720p, 15 fps, 1.5 Mbps", value: "light" },
            { label: "Balanced: 1080p, 20 fps, 3 Mbps", value: "balanced", default: true },
            { label: "High: 1080p, 30 fps, 5 Mbps", value: "high" },
            { label: "Smooth: 1080p, 60 fps, 8 Mbps", value: "smooth" },
            { label: "Custom quality", value: "custom" }
        ]
    },
    customHeight: {
        type: OptionType.SELECT, description: "Maximum video resolution for Custom quality.",
        options: [{ label: "720p", value: 720 }, { label: "1080p", value: 1080, default: true }]
    },
    customFps: {
        type: OptionType.SELECT, description: "Maximum frames per second for Custom quality. Lower values use less processing power.",
        options: [{ label: "15 fps", value: 15 }, { label: "20 fps", value: 20, default: true }, { label: "30 fps", value: 30 }, { label: "60 fps", value: 60 }]
    },
    customBitrate: {
        type: OptionType.NUMBER, default: 3,
        description: "Video bitrate in Mbps for Custom quality, from 1 to 8. Higher values use more memory and disk space.",
        isValid: value => typeof value === "number" && Number.isFinite(value) && value >= 1 && value <= 8 || "Enter a bitrate from 1 to 8."
    },
    memoryLimit: {
        displayName: "Buffer memory limit",
        type: OptionType.SELECT, description: "Maximum encoded buffer size. Older footage is discarded if the limit is reached.",
        options: [{ label: "128 MiB", value: 128 }, { label: "256 MiB", value: 256, default: true }, { label: "512 MiB", value: 512 }]
    },
    efficientCapture: {
        type: OptionType.BOOLEAN, default: true,
        description: "Skip repeated canvas redraws when no new video frame is available. Keep periodic frames for reliable clip timing."
    },
    microphoneDevice: {
        type: OptionType.STRING, default: "default", hidden: true,
        description: "Selected microphone device."
    },
    microphone: { type: OptionType.COMPONENT, component: MicrophonePicker },
    microphoneName: {
        type: OptionType.STRING, default: "", hidden: true,
        description: "Microphone name saved by the earlier version."
    },
    recordSystemAudio: {
        type: OptionType.BOOLEAN, default: true,
        description: "Record Windows speaker output, including audible Discord calls. Other apps may also be heard."
    },
    microphoneVolume: {
        type: OptionType.SLIDER, default: 100, markers: [0, 50, 100, 150, 200], stickToMarkers: false,
        description: "Microphone recording volume as a percentage. This does not change your Discord volume."
    },
    systemVolume: {
        type: OptionType.SLIDER, default: 100, markers: [0, 50, 100, 150, 200], stickToMarkers: false,
        description: "Speaker recording volume as a percentage. This does not change your playback volume."
    },
    noiseReduction: {
        type: OptionType.BOOLEAN, default: true,
        description: "Use microphone echo cancellation, noise suppression, and automatic gain control."
    },
    exportFormat: {
        displayName: "Save format",
        type: OptionType.SELECT, description: "WebM saves directly. MP4 and MKV use an installed FFmpeg. If conversion fails, the WebM is kept and a warning is shown.",
        options: [
            { label: "WebM: fastest, no conversion", value: "webm", default: true },
            { label: "MP4: H.264 video and AAC audio", value: "mp4" },
            { label: "MKV: original quality, no re-encoding", value: "mkv" }
        ]
    },
    showIcon: {
        displayName: "Show replay button",
        type: OptionType.BOOLEAN, default: true,
        description: "Show the replay button beside your user controls. Shortcuts and settings controls still work when hidden."
    },
    notifications: { type: OptionType.BOOLEAN, default: true, description: "Show recording and save notifications. Errors are always shown." },
    saveKey: {
        type: OptionType.STRING, default: "Control+Alt+F10",
        description: "Global shortcut to save a clip. Shortcut changes apply after disabling and enabling Reclip."
    },
    toggleKey: {
        type: OptionType.STRING, default: "Control+Alt+F9",
        description: "Global shortcut to start or stop the buffer. Applied after disabling and enabling Reclip."
    },
    autoStart: { type: OptionType.BOOLEAN, default: false, description: "Start the buffer automatically when Discord loads." }
}, {
    customMinutes: { hidden() { return this.store.clipLength !== 0; } },
    customHeight: { hidden() { return this.store.quality !== "custom"; } },
    customFps: { hidden() { return this.store.quality !== "custom"; } },
    customBitrate: { hidden() { return this.store.quality !== "custom"; } }
}).withPrivateSettings<{ microphoneDefaultMigrated?: boolean; replayDefaultsMigrated?: boolean; }>();

export const CAPTURE_KEYS: (keyof typeof settings.def)[] = [
    "clipLength", "customMinutes", "quality", "customHeight", "customFps", "customBitrate",
    "memoryLimit", "efficientCapture", "microphoneDevice", "recordSystemAudio", "microphoneVolume", "systemVolume", "noiseReduction", "exportFormat", "showIcon"
];

export function videoOptions() {
    const s = settings.store;
    const preset = s.quality === "light" ? [720, 15, 1.5] : s.quality === "smooth" ? [1080, 60, 8] : s.quality === "high" ? [1080, 30, 5] : [1080, 20, 3];
    return {
        seconds: s.clipLength || s.customMinutes * 60,
        height: s.quality === "custom" ? s.customHeight : preset[0],
        fps: s.quality === "custom" ? s.customFps : preset[1],
        bitrate: Math.round((s.quality === "custom" ? s.customBitrate : preset[2]) * 1_000_000),
        memoryMiB: s.memoryLimit, efficient: s.efficientCapture
    };
}

export function captureOptions(): CaptureOptions {
    const s = settings.store;
    let microphoneMode: CaptureOptions["microphoneMode"] = "default";
    let microphoneName = "";
    if (s.microphoneDevice === "off") microphoneMode = "off";
    else if (s.microphoneDevice === "communications") microphoneMode = "communications";
    else if (s.microphoneDevice !== "default") {
        const id = s.microphoneDevice === "discord" ? MediaEngineStore.getInputDeviceId() : s.microphoneDevice.replace(/^device:/, "");
        if (id === "communications") microphoneMode = "communications";
        if (id && id !== "default" && id !== "communications") {
            const device = MediaEngineStore.getInputDevices()[id];
            if (!device || device.disabled) throw new Error("The selected microphone is unavailable. Choose an available device in Reclip settings.");
            if (device.index !== -1) {
                microphoneName = device.name;
                microphoneMode = "named";
            }
        }
    }
    return {
        ...videoOptions(),
        microphoneMode, microphoneName, systemAudio: s.recordSystemAudio,
        microphoneVolume: s.microphoneVolume / 100, systemVolume: s.systemVolume / 100,
        noiseReduction: s.noiseReduction
    };
}
