/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { randomUUID } from "node:crypto";
import { lstat, mkdir, open, rename, unlink } from "node:fs/promises";
import { join } from "node:path";

import { app, BrowserWindow, globalShortcut, type IpcMainInvokeEvent, session, shell, type WebContents } from "electron";

import { capture } from "./capture";
import { convertClip } from "./encode";
import type { CaptureOptions, CaptureStatus, ExportFormat, ShortcutAction } from "./types";

let owner: WebContents | undefined;
let helper: BrowserWindow | undefined;
let starting = false;
let saving = false;
let generation = 0;
let problem = "";
let throttling: boolean | undefined;
let shortcuts: string[] = [];
let pending: ShortcutAction | null = null;
let waiter: ((action: ShortcutAction | null) => void) | undefined;
let lastSavedPath: string | undefined;
let conversion: AbortController | undefined;

async function evaluate<T>(contents: WebContents, script: string, userGesture = false): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            contents.executeJavaScript(script, userGesture),
            new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error("Recorder did not respond.")), 15_000); })
        ]);
    } finally { if (timer) clearTimeout(timer); }
}

function authorized(event: IpcMainInvokeEvent) {
    return owner === event.sender && event.senderFrame === event.sender.mainFrame;
}

function stopCapture() {
    generation++;
    const window = helper;
    helper = undefined;
    if (window && !window.isDestroyed()) window.destroy();
    if (owner && !owner.isDestroyed() && throttling !== undefined) owner.setBackgroundThrottling(throttling);
    throttling = undefined;
    starting = false;
}

function cleanup() {
    conversion?.abort();
    stopCapture();
    for (const accelerator of shortcuts) globalShortcut.unregister(accelerator);
    shortcuts = [];
    waiter?.(null);
    waiter = undefined;
    pending = null;
    if (owner) {
        owner.removeListener("destroyed", cleanup);
        owner.removeListener("render-process-gone", cleanup);
        owner.removeListener("did-start-navigation", navigated);
    }
    owner = undefined;
}

function navigated(_event: Electron.Event, _url: string, inPlace: boolean, mainFrame: boolean) {
    if (mainFrame && !inPlace) cleanup();
}

function fire(action: ShortcutAction) {
    if (waiter) waiter(action);
    else pending = action;
}

async function folder() {
    const path = join(app.getPath("videos"), "bossclip");
    await mkdir(path, { recursive: true });
    const info = await lstat(path);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("Invalid clip folder.");
    return path;
}

export function initialize(event: IpcMainInvokeEvent, saveKey: string, toggleKey: string) {
    if (process.platform !== "win32") return { error: "Reclip currently requires Windows.", warnings: [] as string[] };
    if (event.senderFrame !== event.sender.mainFrame || !BrowserWindow.fromWebContents(event.sender))
        return { error: "Reclip must run in the main Discord window.", warnings: [] as string[] };
    if (typeof saveKey !== "string" || typeof toggleKey !== "string" || saveKey.length > 80 || toggleKey.length > 80)
        return { error: "Invalid keyboard shortcut.", warnings: [] as string[] };
    if (owner && owner !== event.sender) return { error: "Reclip is already controlled by another Discord window.", warnings: [] as string[] };
    cleanup();
    owner = event.sender;
    owner.once("destroyed", cleanup);
    owner.once("render-process-gone", cleanup);
    owner.on("did-start-navigation", navigated);
    problem = "";
    const warnings: string[] = [];
    for (const [action, accelerator] of [["save", saveKey], ["toggle", toggleKey]] as const) {
        if (!accelerator) continue;
        try {
            if (shortcuts.includes(accelerator) || !globalShortcut.register(accelerator, () => fire(action)))
                warnings.push(`Could not register ${accelerator}. It may already be in use.`);
            else shortcuts.push(accelerator);
        } catch {
            warnings.push(`Invalid shortcut: ${accelerator}.`);
        }
    }
    return { error: "", warnings };
}

function validOptions(value: unknown): value is CaptureOptions {
    if (typeof value !== "object" || value === null) return false;
    const v = value as Record<string, unknown>;
    const number = (key: string, min: number, max: number) => {
        const n = v[key];
        return typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
    };
    return number("seconds", 60, 1800) && Number.isInteger(v.seconds)
        && typeof v.height === "number" && [720, 1080].includes(v.height)
        && typeof v.fps === "number" && [15, 20, 30, 60].includes(v.fps)
        && number("bitrate", 1_000_000, 8_000_000)
        && typeof v.memoryMiB === "number" && [128, 256, 512].includes(v.memoryMiB)
        && typeof v.microphoneMode === "string" && ["default", "communications", "named", "off"].includes(v.microphoneMode)
        && typeof v.microphoneName === "string" && v.microphoneName.length <= 256
        && (v.microphoneMode !== "named" || v.microphoneName.trim().length > 0)
        && typeof v.systemAudio === "boolean" && typeof v.noiseReduction === "boolean" && typeof v.efficient === "boolean"
        && number("microphoneVolume", 0, 2) && number("systemVolume", 0, 2);
}

export async function startRecording(event: IpcMainInvokeEvent, options: CaptureOptions) {
    if (!authorized(event)) return { error: "Enable Reclip in the main Discord window first." };
    if (starting || helper) return { error: "The Reclip buffer is already running or starting." };
    if (!validOptions(options)) return { error: "Invalid recording settings. Check clip duration, quality, and audio settings." };
    const source = event.sender;
    starting = true;
    problem = "";
    const token = ++generation;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
        const isolated = session.fromPartition(`bossclip-${randomUUID()}`);
        if (typeof isolated.setDisplayMediaRequestHandler !== "function")
            throw new Error("Unsupported capture API.");
        const window = new BrowserWindow({
            title: "Reclip", width: 400, height: 150, show: false, resizable: false,
            autoHideMenuBar: true, backgroundColor: "#202225",
            webPreferences: {
                session: isolated, nodeIntegration: false, contextIsolation: true,
                sandbox: true, backgroundThrottling: false, autoplayPolicy: "no-user-gesture-required"
            }
        });
        helper = window;
        const contents = window.webContents;
        isolated.setPermissionCheckHandler((webContents, permission) => webContents === contents && ["media", "display-capture"].includes(permission));
        isolated.setPermissionRequestHandler((webContents, permission, callback) => callback(webContents === contents && ["media", "display-capture"].includes(permission)));
        isolated.setDisplayMediaRequestHandler((request, callback) => {
            if (request.frame !== contents.mainFrame || source.isDestroyed() || token !== generation) { callback({}); return; }
            callback({ video: source.mainFrame, ...(options.systemAudio ? { audio: "loopback" as const } : {}) });
        });
        isolated.protocol.handle("https", request => new Response(request.url === "https://bossclip.invalid/"
            ? "<!doctype html><meta charset=utf-8><title>Reclip</title><body style='background:#202225;color:white;font:16px system-ui;padding:20px'>Starting the Discord recording buffer…</body>"
            : "", { status: request.url === "https://bossclip.invalid/" ? 200 : 403, headers: {
                "Content-Type": "text/html; charset=utf-8",
                "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-eval'; connect-src 'none'; media-src blob:"
            } }));
        contents.setWindowOpenHandler(() => ({ action: "deny" }));
        contents.on("will-navigate", e => e.preventDefault());
        contents.once("render-process-gone", () => {
            if (helper !== window) return;
            problem = "The recording process stopped. Start the Reclip buffer again.";
            stopCapture();
        });
        window.once("closed", () => {
            isolated.setDisplayMediaRequestHandler(null);
            isolated.setPermissionCheckHandler(null);
            isolated.setPermissionRequestHandler(null);
            isolated.protocol.unhandle("https");
            if (helper === window) {
                problem = "The recording window was closed. Start the buffer again.";
                stopCapture();
            }
        });
        const result = await Promise.race([
            (async () => {
                await window.loadURL("https://bossclip.invalid/");
                if (token !== generation) return { error: "Recording was cancelled." };
                window.show();
                window.focus();
                const result = await evaluate<{ error: string }>(contents,
                    `(${capture.toString()})(${JSON.stringify(options)}).then(() => ({error: ""}), e => ({error: String(e.message || "Could not start capture.").slice(0, 400)}))`, true
                );
                return result;
            })(),
            new Promise<{ error: string }>(resolve => { timeout = setTimeout(() => resolve({ error: "Recording setup timed out. Check Windows microphone permissions and try again." }), 30_000); })
        ]);
        if (token !== generation) return { error: "Recording was cancelled." };
        if (result.error) { stopCapture(); return result; }
        throttling = source.getBackgroundThrottling();
        source.setBackgroundThrottling(false);
        window.hide();
        return { error: "" };
    } catch {
        if (token === generation) stopCapture();
        return { error: "Could not start the isolated recorder. This Discord build must support Electron display capture and Windows microphone access." };
    } finally {
        if (timeout) clearTimeout(timeout);
        if (token === generation) starting = false;
    }
}

export function stopRecording(event: IpcMainInvokeEvent) {
    if (!authorized(event)) return;
    stopCapture();
    problem = "";
}

export async function status(event: IpcMainInvokeEvent): Promise<CaptureStatus> {
    if (!authorized(event)) return { active: false, seconds: 0, microphone: "", error: "Reclip is not initialized." };
    const window = helper;
    if (!window || starting) return { active: false, seconds: 0, microphone: "", error: problem };
    try {
        return await evaluate<CaptureStatus>(window.webContents, "bossclipCapture.status()");
    } catch {
        return { active: false, seconds: 0, microphone: "", error: "The recording process is unavailable. Stop and restart the buffer." };
    }
}

export async function saveClip(event: IpcMainInvokeEvent, format: ExportFormat) {
    const window = helper;
    if (!authorized(event) || !window || starting) return { error: "Start the buffer before saving a clip." };
    if (saving) return { error: "A clip is already being saved." };
    if (format !== "webm" && format !== "mp4" && format !== "mkv") return { error: "Choose WebM, MP4, or MKV in Save format." };
    saving = true;
    let partial: string | undefined;
    let stage = "buffer";
    try {
        const snapshot = await evaluate<{ error?: string; pieces: number; seconds: number }>(window.webContents,
            "bossclipCapture.beginSave().catch(e => ({error: String(e.message).slice(0, 400)}))"
        );
        if (snapshot.error) return { error: snapshot.error };
        if (!Number.isInteger(snapshot.pieces) || snapshot.pieces < 2 || snapshot.pieces > 2000) return { error: "The clip buffer is invalid." };
        stage = "disk";
        const directory = await folder();
        const filename = `reclip-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}.webm`;
        const destination = join(directory, filename);
        const temporary = `${destination}.part`;
        const file = await open(temporary, "wx");
        partial = temporary;
        try {
            let size = 0;
            for (let i = 0; i < snapshot.pieces; i++) {
                const data = await evaluate<unknown>(window.webContents, `bossclipCapture.piece(${i})`);
                if (!(data instanceof Uint8Array)) throw new Error("Invalid clip data.");
                size += data.byteLength;
                if (size > 600 * 1024 * 1024) throw new Error("Invalid clip data.");
                let offset = 0;
                while (offset < data.byteLength) {
                    const { bytesWritten } = await file.write(data, offset, data.byteLength - offset);
                    if (!bytesWritten) throw new Error("Could not write the clip.");
                    offset += bytesWritten;
                }
            }
            await file.sync();
        } finally { await file.close(); }
        await rename(partial, destination);
        partial = undefined;
        lastSavedPath = destination;
        if (!window.isDestroyed()) await evaluate(window.webContents, "bossclipCapture.endSave()").catch(() => undefined);
        if (format === "webm") return { error: "", path: destination, seconds: snapshot.seconds };
        if (!authorized(event) || helper !== window) return {
            error: "", path: destination, seconds: snapshot.seconds,
            warning: "Recording stopped during saving. Your clip was preserved as WebM."
        };
        conversion = new AbortController();
        const result = await convertClip(destination, format, conversion.signal);
        lastSavedPath = result.path;
        return { error: "", ...result, seconds: snapshot.seconds };
    } catch {
        return { error: stage === "buffer"
            ? "Could not read the video buffer. Check that recording is still active."
            : "Could not save the clip. Check free space and access to your Videos folder, and keep the buffer running until saving finishes." };
    } finally {
        conversion = undefined;
        if (partial) await unlink(partial).catch(() => {});
        if (!window.isDestroyed()) await evaluate(window.webContents, "bossclipCapture.endSave()").catch(() => {});
        saving = false;
    }
}

export function waitForShortcut(event: IpcMainInvokeEvent): Promise<ShortcutAction | null> {
    if (!authorized(event)) return Promise.resolve(null);
    if (pending) { const action = pending; pending = null; return Promise.resolve(action); }
    waiter?.(null);
    return new Promise(resolve => {
        const timer = setTimeout(() => settle(null), 25_000);
        const settle = (action: ShortcutAction | null) => {
            clearTimeout(timer);
            if (waiter === settle) waiter = undefined;
            resolve(action);
        };
        waiter = settle;
    });
}

export async function openFolder(event: IpcMainInvokeEvent) {
    if (!authorized(event)) return "Enable Reclip first.";
    try { return (await shell.openPath(await folder())) ? "Could not open the Videos/bossclip folder." : ""; }
    catch { return "Could not access the Videos/bossclip folder."; }
}

export async function showLastClip(event: IpcMainInvokeEvent) {
    if (!authorized(event) || !lastSavedPath) return "No clip has been saved in this session.";
    try {
        const file = await lstat(lastSavedPath);
        if (!file.isFile() || file.isSymbolicLink()) return "The last clip is no longer at its saved location.";
        shell.showItemInFolder(lastSavedPath);
        return "";
    } catch { return "The last clip was moved or deleted. Open the clips folder to find your recordings."; }
}

export function shutdown(event: IpcMainInvokeEvent) {
    if (authorized(event)) cleanup();
}
