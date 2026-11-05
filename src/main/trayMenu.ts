/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DISTRIBUTION_DISABLED, Project } from "@shared/project";
import { gitHash } from "@shared/vencordUserAgent";
import { app, BaseWindow, BrowserWindow, dialog, Menu, MenuItemConstructorOptions, shell } from "electron";
import iconBase64 from "file://../../branding/assets/icon-256.png?base64";
import aboutHtml from "file://about.html?minify";

import updater from "./updater";
import { SETTINGS_DIR, THEMES_DIR } from "./utils/constants";

const isTrayMenu = (template: MenuItemConstructorOptions[]) =>
    template.at(-1)?.role === "quit";

let aboutWindow: BrowserWindow | null = null;

function openAboutWindow() {
    if (aboutWindow) {
        aboutWindow.focus();
        return;
    }

    aboutWindow = new BrowserWindow({
        center: true,
        autoHideMenuBar: true,
        height: 525,
        width: 900
    });

    aboutWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: "deny" };
    });

    aboutWindow.webContents.on("will-navigate", (e, url) => {
        e.preventDefault();
        shell.openExternal(url);
    });

    const aboutParams = aboutHtml
        .replaceAll("{{PROJECT_NAME}}", Project.displayName)
        .replaceAll("{{COLOR_DARK}}", Project.colors.dark)
        .replaceAll("{{COLOR_TEXT}}", Project.colors.text)
        .replaceAll("{{DESCRIPTION}}", Project.description)
        .replaceAll("{{SOURCE}}", Project.links.source)
        .replaceAll("{{DOCUMENTATION}}", Project.links.documentation)
        .replaceAll("{{SUPPORT}}", Project.links.support)
        .replaceAll("{{ICON}}", "data:image/png;base64," + iconBase64)
        .replaceAll("{{VERSION}}", VERSION)
        .replaceAll("{{GIT_HASH}}", gitHash); // change to gitHashShort if/when its added
    const base64Html = Buffer.from(aboutParams).toString("base64");
    aboutWindow.loadURL(`data:text/html;base64,${base64Html}`);
    aboutWindow.on("closed", () => {
        aboutWindow = null;
    });
}

const notify = (window: BaseWindow | undefined, title: string, message: string) =>
    window && !window.isDestroyed()
        ? dialog.showMessageBox(window, { title, message })
        : dialog.showMessageBox({ title, message });

let isUpdating = false;

function createVencordMenuItems(): MenuItemConstructorOptions[] {
    return [
        { type: "separator" },
        {
            id: Project.id,
            label: Project.displayName,
            submenu: [
                {
                    label: "About " + Project.displayName,
                    click: () => openAboutWindow()
                },
                {
                    label: Project.capabilities.updates ? "Update " + Project.displayName : "Updates unavailable",
                    enabled: Project.capabilities.distribution && Project.capabilities.updates,
                    visible: !IS_UPDATER_DISABLED,
                    async click(_item, window) {
                        if (!Project.capabilities.distribution || !Project.capabilities.updates) return notify(window, "Updates unavailable", DISTRIBUTION_DISABLED);
                        if (isUpdating) return;
                        isUpdating = true;
                        try {
                            const updateAvailable = await updater.fetchUpdate();
                            if (!updateAvailable) {
                                return notify(window, "No Update Available", "You are already using the latest version of EvenCord.");
                            }

                            const result = await updater.applyUpdate();
                            if (!result) {
                                return notify(window, "Update Failed", "Failed to apply the update for EvenCord.");
                            }

                            await notify(window, "Update Successful", "Now relaunching EvenCord to apply the update.");
                            app.relaunch();
                            app.exit();
                        } catch (e) {
                            notify(window, "Update Error", `An error occurred while updating EvenCord.\n\n${String(e)}`);
                        } finally {
                            isUpdating = false;
                        }
                    }
                },
                { type: "separator" },
                {
                    label: "Open Settings Folder",
                    click: () => shell.openPath(SETTINGS_DIR)
                },
                {
                    label: "Open Themes Folder",
                    click: () => shell.openPath(THEMES_DIR)
                }
            ]
        }
    ];
}

export function patchTrayMenu(): void {
    const originalBuildFromTemplate = Menu.buildFromTemplate;

    Menu.buildFromTemplate = function (template: MenuItemConstructorOptions[]) {
        if (isTrayMenu(template) && !template.some(item => item.id === Project.id)) {
            const separatorIndex = template.findIndex(item => item.type === "separator");
            const insertIndex = separatorIndex !== -1 ? separatorIndex : template.length - 1;
            template.splice(insertIndex, 0, ...createVencordMenuItems());
        }

        return originalBuildFromTemplate.call(this, template);
    };
}
