/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IpcEvents } from "@shared/IpcEvents";
import { ipcMain } from "electron";

import { serializeErrors } from "./common";
import secureUpdater, { getUpdateStatus, prepareUpdateRestart } from "./secure";

export type UpdateData = Record<"hash" | "message" | "author", string>;

export interface Updater {
    getRepo(): Promise<string>;
    listUpdates(): Promise<UpdateData[]>;
    fetchUpdate(): Promise<boolean>;
    applyUpdate(): Promise<boolean>;
}

const updater: Updater = secureUpdater;

ipcMain.handle(IpcEvents.UPDATER_PREPARE_RESTART, serializeErrors(prepareUpdateRestart));

ipcMain.handle(IpcEvents.UPDATER_GET_STATUS, serializeErrors(getUpdateStatus));

ipcMain.handle(IpcEvents.UPDATER_GET_REPO, serializeErrors(updater.getRepo));
ipcMain.handle(IpcEvents.UPDATER_LIST_UPDATES, serializeErrors(updater.listUpdates));
ipcMain.handle(IpcEvents.UPDATER_FETCH_UPDATE, serializeErrors(updater.fetchUpdate));
ipcMain.handle(IpcEvents.UPDATER_APPLY_UPDATE, serializeErrors(updater.applyUpdate));

export default updater;
