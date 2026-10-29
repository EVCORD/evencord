/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { spawn } from "node:child_process";
import { open, readdir, rename, stat, unlink } from "node:fs/promises";
import { basename, delimiter, isAbsolute, join } from "node:path";

import { NativeSettings } from "@main/settings";
import { type BrowserWindow, dialog } from "electron";

async function executable(path: unknown) {
    if (typeof path !== "string" || !isAbsolute(path) || path.startsWith("\\\\") || basename(path).toLowerCase() !== "ffmpeg.exe") return false;
    return (await stat(path).catch(() => undefined))?.isFile() || false;
}

export async function findFFmpeg(): Promise<string | undefined> {
    const chosen: unknown = NativeSettings.store.plugins.Reclip?.ffmpegPath;
    if (typeof chosen === "string" && await executable(chosen)) return chosen;
    const local = process.env.LOCALAPPDATA;
    const candidates = [
        ...(process.env.PATH || "").split(delimiter).map(p => join(p.trim().replace(/^"|"$/g, ""), "ffmpeg.exe")),
        ...(local ? [join(local, "Microsoft", "WinGet", "Links", "ffmpeg.exe")] : []),
        join(process.env.ProgramFiles || "C:\\Program Files", "ffmpeg", "bin", "ffmpeg.exe"),
        join(process.env.SystemDrive || "C:", "\\", "ffmpeg", "bin", "ffmpeg.exe")
    ];
    for (const path of candidates) if (await executable(path)) return path;
    if (local) {
        const root = join(local, "Microsoft", "WinGet", "Packages");
        const packages = (await readdir(root, { withFileTypes: true }).catch(() => [])).filter(p => p.isDirectory() && /ffmpeg/i.test(p.name)).slice(0, 20);
        const queue = packages.map(p => ({ path: join(root, p.name), depth: 0 }));
        for (let i = 0; i < queue.length && i < 100; i++) {
            const item = queue[i];
            const path = join(item.path, "ffmpeg.exe");
            if (await executable(path)) return path;
            if (item.depth < 3) for (const dir of await readdir(item.path, { withFileTypes: true }).catch(() => []))
                if (dir.isDirectory() && !dir.isSymbolicLink()) queue.push({ path: join(item.path, dir.name), depth: item.depth + 1 });
        }
    }
}

export async function selectFFmpeg(window: BrowserWindow) {
    const result = await dialog.showOpenDialog(window, { title: "Choose ffmpeg.exe for MP4 export", properties: ["openFile"], filters: [{ name: "FFmpeg executable", extensions: ["exe"] }] });
    if (result.canceled || !result.filePaths[0]) return null;
    const path = result.filePaths[0];
    if (!await executable(path)) throw new Error("Choose a local ffmpeg.exe file.");
    NativeSettings.store.plugins.Reclip ||= {};
    NativeSettings.store.plugins.Reclip.ffmpegPath = path;
    return path;
}

export async function convertClip(source: string, format: "mp4", signal: AbortSignal) {
    const destination = source.replace(/\.webm$/, `.${format}`);
    const partial = `${destination}.part`;
    let created = false;
    let stage = "find";
    try {
        const executable = await findFFmpeg();
        if (!executable) return { path: source, warning: "MP4 needs FFmpeg. Your seekable WebM clip is preserved. In Reclip settings, choose ffmpeg.exe or select WebM/MKV, which need no converter." };
        signal.throwIfAborted();
        stage = "convert";
        const file = await open(partial, "wx");
        created = true;
        await file.close();
        await new Promise<void>((resolve, reject) => {
            const encoder = spawn(executable, [
                "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
                "-threads", "2", "-protocol_whitelist", "file", "-i", source,
                "-map", "0:v:0", "-map", "0:a:0?", "-map_metadata", "-1",
                ...[
                    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
                    "-maxrate", "8M", "-bufsize", "16M", "-pix_fmt", "yuv420p", "-threads", "2",
                    "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart"
                ],
                "-f", "mp4", partial
            ], { windowsHide: true, shell: false, stdio: ["ignore", "ignore", "pipe"] });
            let failed = false;
            let details = "";
            encoder.stderr?.on("data", (chunk: Buffer) => { details = (details + chunk.toString()).slice(-2000); });
            const cancel = () => { failed = true; encoder.kill(); };
            const timeout = setTimeout(cancel, 20 * 60 * 1000);
            signal.addEventListener("abort", cancel, { once: true });
            if (signal.aborted) cancel();
            encoder.once("error", () => { failed = true; });
            encoder.once("close", code => {
                clearTimeout(timeout);
                signal.removeEventListener("abort", cancel);
                if (failed || code !== 0) reject(new Error(details.trim().slice(-500) || "Conversion failed."));
                else resolve();
            });
        });
        signal.throwIfAborted();
        const info = await stat(partial);
        if (!info.isFile() || !info.size) throw new Error("No converted video.");
        const output = await open(partial, "r+");
        try { await output.sync(); } finally { await output.close(); }
        await rename(partial, destination);
        created = false;
        try { await unlink(source); }
        catch { return { path: destination, warning: "The converted clip is saved. Its WebM intermediate could not be removed and is also in your clips folder." }; }
        return { path: destination, warning: "" };
    } catch (error) {
        const details = error instanceof Error ? error.message.slice(-500) : "";
        return { path: source, warning: signal.aborted
            ? "Conversion was cancelled. Your original WebM clip is saved."
            : stage === "find"
                ? "FFmpeg could not be located. Your original WebM clip is saved."
                : `${format.toUpperCase()} conversion failed or timed out. Your original WebM clip is saved. Check disk space and that your FFmpeg supports H.264 and AAC, or choose WebM/MKV. ${details}` };
    } finally {
        if (created) await unlink(partial).catch(() => undefined);
    }
}
