/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import project from "../../branding/project.json";

export const Project = project;
export const storageNamespace = Project.storage.namespace + ":" + (IS_REPORTER ? "reporter" : IS_DEV ? "dev" : Project.release.channel);
export const storageName = (name: string) => storageNamespace + ":" + name;
export const DISTRIBUTION_DISABLED = Project.displayName + " distribution is disabled until installer and updater safety work is complete.";

export const cloudStorageKeys = {
    direction: storageName("cloudSyncDirection"),
    dirty: storageName("settingsDirty")
};
