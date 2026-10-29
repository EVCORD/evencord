/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { createReplayMuxer } from "./mux";
import type { CaptureOptions } from "./types";

export async function capture(config: CaptureOptions, createMuxer: typeof createReplayMuxer) {
    type Packet = { time: number; video: boolean; key: boolean; data: Uint8Array<ArrayBuffer>; timingOffset: number; id: number; };
    const streams: MediaStream[] = [];
    let context: AudioContext | undefined;
    let recorder: MediaRecorder | undefined;
    let error = "";
    let pending = new Uint8Array(0);
    let ebml: Uint8Array<ArrayBuffer> | undefined;
    let tracks: Uint8Array<ArrayBuffer> | undefined;
    let videoTrack = -1;
    let scale = 1;
    let level = 0;
    let clusterRemaining = Infinity;
    let clusterTime = 0;
    let hasClusterTime = false;
    let packets: Packet[] = [];
    let bytes = 0;
    let lastTime = 0;
    let chain = Promise.resolve();
    let snapshot: ReturnType<typeof createReplayMuxer> | undefined;
    let flush: (() => void) | undefined;
    let microphone = "";
    let redraw: ReturnType<typeof setInterval> | undefined;
    let preview: HTMLVideoElement | undefined;
    const keepMs = config.seconds * 1000;
    const byteLimit = config.memoryMiB * 1024 * 1024;
    let shortened = false;
    let resolution = "";

    function vint(data: Uint8Array, offset: number, id = false) {
        if (offset >= data.length) return;
        let length = 1;
        let mask = 0x80;
        while (length <= 8 && !(data[offset] & mask)) { length++; mask >>= 1; }
        if (length > 8) throw new Error("Invalid WebM element.");
        if (offset + length > data.length) return;
        let value = id ? data[offset] : data[offset] & (mask - 1);
        let unknown = !id && value === mask - 1;
        for (let i = 1; i < length; i++) {
            value = value * 256 + data[offset + i];
            unknown = unknown && data[offset + i] === 255;
        }
        return { value, length, unknown };
    }

    function element(data: Uint8Array, offset: number) {
        const id = vint(data, offset, true);
        if (!id) return;
        const size = vint(data, offset + id.length);
        if (!size) return;
        if (!size.unknown && (!Number.isSafeInteger(size.value) || size.value > byteLimit + 32 * 1024 * 1024))
            throw new Error("WebM element exceeds the recording limit.");
        const start = offset + id.length + size.length;
        return { id: id.value, start, end: size.unknown ? Infinity : start + size.value };
    }

    function uint(data: Uint8Array) {
        let value = 0;
        for (const byte of data) value = value * 256 + byte;
        return value;
    }

    function children(data: Uint8Array, visit: (id: number, body: Uint8Array) => void) {
        for (let offset = 0; offset < data.length;) {
            const item = element(data, offset);
            if (!item || item.end > data.length) throw new Error("Incomplete WebM metadata.");
            visit(item.id, data.subarray(item.start, item.end));
            offset = item.end;
        }
    }

    function stop() {
        if (redraw) clearInterval(redraw);
        redraw = undefined;
        if (preview) { preview.pause(); preview.srcObject = null; }
        if (recorder && recorder.state !== "inactive") recorder.stop();
        for (const stream of streams) for (const track of stream.getTracks()) track.stop();
        if (context && context.state !== "closed") void context.close();
        flush?.();
        flush = undefined;
    }

    function fail(reason: string) {
        if (!error) error = reason;
        stop();
    }

    function prune() {
        let first = 0;
        for (let i = 0; i < packets.length; i++) {
            const packet = packets[i];
            if (packet.video && packet.key && packet.time <= lastTime - keepMs) first = i;
        }
        if (first) {
            for (let i = 0; i < first; i++) bytes -= packets[i].data.length;
            packets = packets.slice(first);
        }
        while (bytes > byteLimit) {
            const next = packets.findIndex((packet, i) => i > 0 && packet.video && packet.key);
            if (next < 0) break;
            shortened = true;
            for (let i = 0; i < next; i++) bytes -= packets[i].data.length;
            packets = packets.slice(next);
        }
        if (bytes > byteLimit + 32 * 1024 * 1024) throw new Error("The recording exceeded its memory limit without a usable keyframe.");
    }

    function append(data: Uint8Array) {
        if (pending.length + data.length > 32 * 1024 * 1024) throw new Error("The video encoder stopped producing usable WebM blocks.");
        const joined = new Uint8Array(pending.length + data.length);
        joined.set(pending);
        joined.set(data, pending.length);
        pending = joined;
        let offset = 0;
        while (offset < pending.length) {
            if (level === 2 && clusterRemaining === 0) level = 1;
            const item = element(pending, offset);
            if (!item) break;
            if (item.id === 0x18538067) {
                level = 1;
                offset = item.start;
                continue;
            }
            if (item.id === 0x1f43b675) {
                level = 2;
                clusterRemaining = item.end - item.start;
                hasClusterTime = false;
                offset = item.start;
                continue;
            }
            if (item.end > pending.length) break;
            const body = pending.subarray(item.start, item.end);
            if (level === 0 && item.id === 0x1a45dfa3) ebml = pending.slice(offset, item.end);
            if (level === 1 && item.id === 0x1549a966) children(body, (id, value) => {
                if (id === 0x2ad7b1) scale = uint(value) / 1_000_000;
            });
            if (level === 1 && item.id === 0x1654ae6b) {
                tracks = pending.slice(offset, item.end);
                children(body, (id, value) => {
                    if (id !== 0xae) return;
                    let number = -1;
                    let type = -1;
                    children(value, (field, contents) => {
                        if (field === 0xd7) number = uint(contents);
                        if (field === 0x83) type = uint(contents);
                    });
                    if (type === 1) videoTrack = number;
                });
            }
            if (level === 2) {
                clusterRemaining -= item.end - offset;
                if (clusterRemaining < 0) throw new Error("Invalid WebM cluster length.");
                if (item.id === 0xe7) {
                    clusterTime = uint(body);
                    hasClusterTime = true;
                }
                if (item.id === 0xa3 || item.id === 0xa0) {
                    let block: Uint8Array = body;
                    let key = true;
                    if (item.id === 0xa0) {
                        let found = false;
                        children(body, (id, value) => {
                            if (id === 0xa1) { block = value; found = true; }
                            if (id === 0xfb) key = false;
                        });
                        if (!found) throw new Error("A WebM block group is missing its frame.");
                    }
                    const track = vint(block, 0);
                    if (!hasClusterTime || !track || block.length < track.length + 3 || !(scale > 0))
                        throw new Error("Invalid WebM frame timing.");
                    const relative = new DataView(block.buffer, block.byteOffset + track.length, 2).getInt16(0);
                    const time = (clusterTime + relative) * scale;
                    packets.push({
                        time, video: track.value === videoTrack,
                        key: item.id === 0xa3 ? (block[track.length + 2] & 0x80) !== 0 : key,
                        data: body.slice(), timingOffset: block.byteOffset - body.byteOffset + track.length, id: item.id
                    });
                    bytes += body.length;
                    lastTime = Math.max(lastTime, time);
                }
            }
            offset = item.end;
        }
        pending = pending.slice(offset);
        prune();
    }

    Object.assign(globalThis, {
        bossclipCapture: {
            status: () => ({
                active: recorder?.state === "recording", error, microphone, resolution,
                shortened: shortened && packets.length > 0 && lastTime - packets[0].time < keepMs - 2000,
                targetSeconds: config.seconds, memoryMiB: bytes / 1024 / 1024, memoryLimitMiB: config.memoryMiB, fps: config.fps,
                seconds: packets.length ? Math.min(config.seconds, Math.max(0, (lastTime - packets[0].time) / 1000)) : 0
            }),
            async beginSave(format: "webm" | "mkv" = "webm") {
                if (snapshot) throw new Error("A clip is already being saved.");
                if (!recorder || recorder.state !== "recording") throw new Error(error || "Start recording first.");
                const current = recorder;
                await new Promise<void>((resolve, reject) => {
                    const timer = setTimeout(() => { flush = undefined; reject(new Error("The encoder did not flush. Try saving again.")); }, 5000);
                    flush = () => { clearTimeout(timer); resolve(); };
                    current.requestData();
                });
                await chain;
                if (error) throw new Error(error);
                const first = packets.find(packet => packet.video && packet.key && packet.time >= lastTime - keepMs);
                if (!first || !ebml || !tracks || videoTrack < 0) throw new Error("The video is still warming up. Wait a few seconds.");
                const selected = packets.filter(packet => packet.time >= first.time).sort((a, b) => a.time - b.time);
                const duration = Math.min(keepMs, lastTime - first.time + 20);
                snapshot = createMuxer(selected, tracks, videoTrack, first.time, duration, scale, format);
                return { pieces: snapshot.pieces, seconds: duration / 1000 };
            },
            piece(index: number) {
                if (!snapshot || !ebml || !tracks) throw new Error("The saved clip buffer is no longer available.");
                return snapshot.piece(index);
            },
            endSave() { snapshot = undefined; },
            stop
        }
    });

    try {
        const video = await navigator.mediaDevices.getDisplayMedia({
            video: { width: { ideal: config.height * 16 / 9, max: config.height * 16 / 9 }, height: { ideal: config.height, max: config.height }, frameRate: { ideal: config.fps, max: config.fps } },
            audio: config.systemAudio ? { echoCancellation: false, noiseSuppression: false, autoGainControl: false } : false
        });
        streams.push(video);
        if (!video.getVideoTracks().length || config.systemAudio && !video.getAudioTracks().length)
            throw new Error("Discord capture did not provide video and speaker audio. This Electron version may not support the recorder.");
        let mic: MediaStream | undefined;
        const processing = { echoCancellation: config.noiseReduction, noiseSuppression: config.noiseReduction, autoGainControl: config.noiseReduction };
        if (config.microphoneMode !== "off") {
            mic = await navigator.mediaDevices.getUserMedia({ audio: {
                ...processing, ...(config.microphoneMode === "communications" ? { deviceId: { exact: "communications" } } : {})
            } });
            streams.push(mic);
        }
        if (mic && config.microphoneMode === "named") {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const normalize = (label: string) => label.trim().toLowerCase().replace(/^(default|communications)\s*[-–]\s*/, "");
            const matches = devices.filter(device => device.kind === "audioinput" && normalize(device.label) === normalize(config.microphoneName));
            const physical = matches.filter(device => !["default", "communications"].includes(device.deviceId));
            if (physical.length > 1) throw new Error("Multiple microphones have the same name. Choose Windows default in Reclip and set that input as the Windows default device.");
            const device = physical[0] ?? matches[0];
            if (!device) throw new Error("The selected Discord microphone could not be matched to a Windows input. Choose another microphone or Windows default in Reclip settings.");
            for (const track of mic.getTracks()) track.stop();
            mic = await navigator.mediaDevices.getUserMedia({ audio: {
                deviceId: { exact: device.deviceId }, ...processing
            } });
            streams.push(mic);
        }
        microphone = mic?.getAudioTracks()[0]?.label || "Off";
        let destination: MediaStreamAudioDestinationNode | undefined;
        if (config.systemAudio || mic) {
            context = new AudioContext();
            await context.resume();
            destination = context.createMediaStreamDestination();
            const limiter = context.createDynamicsCompressor();
            limiter.threshold.value = -3;
            limiter.knee.value = 0;
            limiter.ratio.value = 20;
            limiter.connect(destination);
            if (config.systemAudio) {
                const gain = context.createGain();
                gain.gain.value = config.systemVolume;
                context.createMediaStreamSource(video).connect(gain).connect(limiter);
            }
            if (mic) {
                const gain = context.createGain();
                gain.gain.value = config.microphoneVolume;
                context.createMediaStreamSource(mic).connect(gain).connect(limiter);
            }
        }
        const player = document.createElement("video");
        preview = player;
        player.muted = true;
        player.playsInline = true;
        player.srcObject = video;
        await player.play();
        if (!player.videoWidth || !player.videoHeight) throw new Error("Discord has not produced a video frame. Restore its window and start recording again.");
        const canvas = document.createElement("canvas");
        const canvasScale = Math.min(1, config.height / player.videoHeight, config.height * 16 / 9 / player.videoWidth);
        canvas.width = Math.max(2, Math.floor(player.videoWidth * canvasScale / 2) * 2);
        canvas.height = Math.max(2, Math.floor(player.videoHeight * canvasScale / 2) * 2);
        resolution = `${canvas.width} × ${canvas.height}`;
        const graphics = canvas.getContext("2d", { alpha: false });
        if (!graphics) throw new Error("Could not create the recording canvas.");
        let previousFrame = -1;
        let lastDraw = -Infinity;
        const draw = () => {
            if (!player.videoWidth || !player.videoHeight) return;
            const now = performance.now();
            const frame = typeof player.getVideoPlaybackQuality === "function" ? player.getVideoPlaybackQuality().totalVideoFrames : 0;
            if (config.efficient && frame > 0 && frame === previousFrame && now - lastDraw < 1000) return;
            previousFrame = frame;
            lastDraw = now;
            const ratio = Math.min(canvas.width / player.videoWidth, canvas.height / player.videoHeight);
            const width = player.videoWidth * ratio;
            const height = player.videoHeight * ratio;
            graphics.fillStyle = "black";
            graphics.fillRect(0, 0, canvas.width, canvas.height);
            graphics.drawImage(player, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
        };
        draw();
        const picture = canvas.captureStream(config.fps);
        streams.push(picture);
        redraw = setInterval(draw, 1000 / config.fps);
        const withAudio = config.systemAudio || Boolean(mic);
        const mixed = new MediaStream([...picture.getVideoTracks(), ...(destination?.stream.getAudioTracks() ?? [])]);
        streams.push(mixed);
        const mimeType = (withAudio ? ["video/webm;codecs=vp8,opus", "video/webm;codecs=vp9,opus"] : ["video/webm;codecs=vp8", "video/webm;codecs=vp9"]).find(type => MediaRecorder.isTypeSupported(type));
        if (!mimeType) throw new Error("This Discord build has no supported WebM video encoder.");
        const options = { mimeType, videoBitsPerSecond: config.bitrate, audioBitsPerSecond: 128_000, videoKeyFrameIntervalDuration: 2000 };
        recorder = new MediaRecorder(mixed, options);
        recorder.ondataavailable = event => {
            chain = chain.then(async () => {
                if (event.data.size && !error) append(new Uint8Array(await event.data.arrayBuffer()));
            }).catch(reason => fail(reason instanceof Error ? reason.message : "Could not read encoded video."));
            const resolve = flush;
            flush = undefined;
            if (resolve) void chain.then(resolve);
        };
        recorder.onerror = () => fail("The video encoder stopped unexpectedly. Restart the Reclip buffer.");
        for (const stream of mic ? [video, mic] : [video]) for (const track of stream.getTracks())
            track.onended = () => fail("A recording device disconnected or capture ended. Restart the Reclip buffer.");
        recorder.start(1000);
    } catch (reason) {
        stop();
        throw reason;
    }
}
