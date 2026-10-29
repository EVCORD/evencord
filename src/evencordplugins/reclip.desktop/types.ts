/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export type ShortcutAction = "save" | "toggle";
export type ExportFormat = "webm" | "mp4" | "mkv";

export interface CaptureOptions {
    seconds: number;
    height: number;
    fps: number;
    bitrate: number;
    memoryMiB: number;
    microphoneMode: "default" | "communications" | "named" | "off";
    microphoneName: string;
    systemAudio: boolean;
    microphoneVolume: number;
    systemVolume: number;
    noiseReduction: boolean;
    efficient: boolean;
}

export interface CaptureStatus {
    active: boolean;
    seconds: number;
    microphone: string;
    error: string;
    targetSeconds?: number;
    memoryMiB?: number;
    memoryLimitMiB?: number;
    shortened?: boolean;
    resolution?: string;
    fps?: number;
}
