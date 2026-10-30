/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { definePluginSettings } from "@api/Settings";
import { Paragraph } from "@components/Paragraph";
import { EvenCordAuthors } from "@evencordplugins/_authors";
import { PluginInfo } from "@evencordplugins/betterMicrophone.desktop/constants";
import { openMicrophoneSettingsModal } from "@evencordplugins/betterMicrophone.desktop/modals";
import { MicrophonePatcher } from "@evencordplugins/betterMicrophone.desktop/patchers";
import { initMicrophoneStore } from "@evencordplugins/betterMicrophone.desktop/stores";
import { addSettingsPanelButton, Emitter, MicrophoneSettingsIcon, removeSettingsPanelButton } from "@evencordplugins/philsPluginLibrary.desktop";
import definePlugin, { OptionType, PluginNative } from "@utils/types";
import { React, showToast } from "@webpack/common";

export const Native = VencordNative.pluginHelpers.BetterMicrophone as PluginNative<typeof import("./native")>;

const settings = definePluginSettings({
    nativePatching: {
        type: OptionType.BOOLEAN,
        description: "Enable experimental Windows x64 native stereo patches using the fixed, hash-verified third-party addon. Requires a restart. Other voice mods may conflict.",
        default: false,
        restartNeeded: true
    }
});

export default definePlugin({
    name: "BetterMicrophone",
    description: "This plugin allows you to further customize your microphone.",
    authors: [EvenCordAuthors.viciouscal],
    dependencies: ["PhilsPluginLibrary"],
    requiresRestart: true,
    settings,
    settingsAboutComponent: () => <Paragraph>Open Microphone Settings from the Toolbox or voice panel to edit profiles. Native stereo support is optional and downloads a pinned third-party addon only after you enable it. Compatibility depends on Discord's voice module.</Paragraph>,

    start(): void {
        try {
            initMicrophoneStore();
            this.microphonePatcher = new MicrophonePatcher().patch();
            addSettingsPanelButton({
            name: PluginInfo.PLUGIN_NAME,
            icon: MicrophoneSettingsIcon,
            tooltipText: "Microphone Settings",
            onClick: openMicrophoneSettingsModal
            });
            if (!settings.store.nativePatching) return;
            const nativeModules = globalThis.DiscordNative?.nativeModules;
            if (!nativeModules?.requireModule) throw new Error("DiscordNative.nativeModules is unavailable");
            nativeModules.requireModule("discord_voice");
            Native.applyPatches().then(result => {
                console.log(`[BetterMicrophone] ${result.module_base} | patches: ok:${result.ok} failed:${result.failed} skipped:${result.skipped}`);
                if (result.failed > 0 || result.ok === 0) showToast({ text: "Some native microphone patches are unsupported by this Discord voice module.", variant: "critical" });
            }).catch(e => {
                console.error("[BetterMicrophone]", e);
                showToast({ text: "Native microphone patching failed. Existing microphone controls remain available. See the console for details.", variant: "critical" });
            });
        } catch (e) {
            console.error("[BetterMicrophone]", e);
            showToast({ text: "BetterMicrophone could not start on this Discord version.", variant: "critical" });
            this.microphonePatcher?.unpatch();
            Emitter.removeAllListeners(PluginInfo.PLUGIN_NAME);
            removeSettingsPanelButton(PluginInfo.PLUGIN_NAME);
        }
    },

    stop(): void {
        this.microphonePatcher?.unpatch();
        Emitter.removeAllListeners(PluginInfo.PLUGIN_NAME);
        removeSettingsPanelButton(PluginInfo.PLUGIN_NAME);
        Native.revertPatches().catch(error => console.error("[BetterMicrophone] Restart Discord to finish restoring native patches", error));
    },

    toolboxActions: {
        "Open Microphone Settings": openMicrophoneSettingsModal
    },
});
