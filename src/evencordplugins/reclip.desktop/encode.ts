/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { spawn } from "node:child_process";
import { open, rename, stat, unlink } from "node:fs/promises";
import { delimiter, isAbsolute, join } from "node:path";

import type { ExportFormat } from "./types";

export async function convertClip(source: string, format: Exclude<ExportFormat, "webm">, signal: AbortSignal) {
    const destination = source.replace(/\.webm$/, `.${format}`);
    const partial = `${destination}.part`;
    let created = false;
    let stage = "find";
    try {
        let executable: string | undefined;
        for (const entry of (process.env.PATH ?? "").split(delimiter)) {
            const directory = entry.trim().replace(/^"|"$/g, "");
            if (!isAbsolute(directory)) continue;
            const path = join(directory, "ffmpeg.exe");
            const info = await stat(path).catch(() => undefined);
            if (info?.isFile()) { executable = path; break; }
        }
        if (!executable) return { path: source, warning: "FFmpeg was not found in Discord's PATH. Your WebM clip is saved. Install FFmpeg with H.264 and AAC support, then fully relaunch Discord to enable MP4 and MKV." };
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
                ...(format === "mp4" ? [
                    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
                    "-maxrate", "8M", "-bufsize", "16M", "-pix_fmt", "yuv420p", "-threads", "2",
                    "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart"
                ] : ["-c", "copy"]),
                "-f", format === "mp4" ? "mp4" : "matroska", partial
            ], { windowsHide: true, shell: false, stdio: "ignore" });
            let failed = false;
            const cancel = () => { failed = true; encoder.kill(); };
            const timeout = setTimeout(cancel, 20 * 60 * 1000);
            signal.addEventListener("abort", cancel, { once: true });
            if (signal.aborted) cancel();
            encoder.once("error", () => { failed = true; });
            encoder.once("close", code => {
                clearTimeout(timeout);
                signal.removeEventListener("abort", cancel);
                if (failed || code !== 0) reject(new Error("Conversion failed."));
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
    } catch {
        return { path: source, warning: signal.aborted
            ? "Conversion was cancelled. Your original WebM clip is saved."
            : stage === "find"
                ? "FFmpeg could not be located. Your original WebM clip is saved."
                : `${format.toUpperCase()} conversion failed or timed out. Your original WebM clip is saved. Check disk space and that your FFmpeg supports H.264 and AAC, or choose WebM.` };
    } finally {
        if (created) await unlink(partial).catch(() => undefined);
    }
}
