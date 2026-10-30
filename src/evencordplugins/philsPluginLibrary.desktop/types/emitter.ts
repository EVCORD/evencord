/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

type Events = Record<string, (...args: never[]) => unknown>;

export default interface TypedEmitter<T extends Events> {
    on<K extends keyof T>(event: K, listener: T[K]): this;
    once<K extends keyof T>(event: K, listener: T[K]): this;
    off<K extends keyof T>(event: K, listener: T[K]): this;
    emit<K extends keyof T>(event: K, ...args: Parameters<T[K]>): boolean;
}
