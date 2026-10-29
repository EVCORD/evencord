/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface ReplayPacket {
    time: number;
    video: boolean;
    key: boolean;
    data: Uint8Array;
    timingOffset: number;
    id: number;
}

export function createReplayMuxer(packets: ReplayPacket[], tracks: Uint8Array, videoTrack: number, base: number, durationMs: number, scaleMs: number, format: "webm" | "mkv") {
    function concat(parts: Uint8Array[]) {
        const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
        let offset = 0;
        for (const part of parts) { out.set(part, offset); offset += part.length; }
        return out;
    }
    function uint(n: number, width = 0) {
        const bytes: number[] = [];
        do { bytes.unshift(n % 256); n = Math.floor(n / 256); } while (n);
        while (bytes.length < width) bytes.unshift(0);
        return new Uint8Array(bytes);
    }
    function size(n: number) {
        let width = 1;
        while (n >= 2 ** (7 * width) - 1) width++;
        const value = uint(n, width);
        value[0] |= 1 << (8 - width);
        return value;
    }
    function element(id: number, data: Uint8Array) { return concat([uint(id), size(data.length), data]); }
    function length(id: number, count: number) { return uint(id).length + size(count).length + count; }
    const text = (value: string) => new TextEncoder().encode(value);
    const ebml = element(0x1a45dfa3, concat([
        element(0x4286, uint(1)), element(0x42f7, uint(1)), element(0x42f2, uint(4)), element(0x42f3, uint(8)),
        element(0x4282, text(format === "mkv" ? "matroska" : "webm")), element(0x4287, uint(4)), element(0x4285, uint(2))
    ]));
    const duration = new Uint8Array(8);
    new DataView(duration.buffer).setFloat64(0, durationMs / scaleMs);
    const info = element(0x1549a966, concat([
        element(0x2ad7b1, uint(Math.round(scaleMs * 1_000_000))), element(0x4489, duration),
        element(0x4d80, text("Reclip")), element(0x5741, text("Reclip"))
    ]));
    const tick = (p: ReplayPacket) => Math.max(0, Math.round((p.time - base) / scaleMs));
    const offsets: number[] = [];
    let total = 0;
    for (const packet of packets) {
        offsets.push(total);
        const count = element(0xe7, uint(tick(packet))).length + length(packet.id, packet.data.length);
        total += length(0x1f43b675, count);
    }
    const seek = (cues: number) => element(0x114d9b74, concat([
        [0x1549a966, 0], [0x1654ae6b, 0], [0x1c53bb6b, cues]
    ].map(([id, pos], i) => element(0x4dbb, concat([
        element(0x53ab, uint(id)), element(0x53ac, uint(i === 0 ? seekSize : i === 1 ? seekSize + info.length : pos, 8))
    ])))));
    let seekSize = 0;
    seekSize = seek(0).length;
    const seekHead = seek(seekSize + info.length + tracks.length);
    const cuePoints = (firstCluster: number) => element(0x1c53bb6b, concat(packets.flatMap((packet, i) => packet.video && packet.key ? [
        element(0xbb, concat([
            element(0xb3, uint(tick(packet))), element(0xb7, concat([
                element(0xf7, uint(videoTrack)), element(0xf1, uint(firstCluster + offsets[i], 8))
            ]))
        ]))
    ] : [])));
    const cueSize = cuePoints(0).length;
    const prefix = seekHead.length + info.length + tracks.length;
    const cues = cuePoints(prefix + cueSize);
    const header = concat([ebml, uint(0x18538067), size(prefix + cues.length + total), seekHead, info, tracks, cues]);
    return {
        pieces: Math.ceil(packets.length / 128) + 1,
        piece(index: number) {
            if (index === 0) return header;
            return concat(packets.slice((index - 1) * 128, index * 128).map(packet => {
                const block = packet.data.slice();
                block[packet.timingOffset] = block[packet.timingOffset + 1] = 0;
                return element(0x1f43b675, concat([element(0xe7, uint(tick(packet))), element(packet.id, block)]));
            }));
        }
    };
}
