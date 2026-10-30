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

import { PluginInfo } from "@evencordplugins/betterMicrophone.desktop/constants";
import { logger } from "@evencordplugins/betterMicrophone.desktop/logger";
import { microphoneStore } from "@evencordplugins/betterMicrophone.desktop/stores";
import { Emitter, MediaEngineStore, Patcher, types } from "@evencordplugins/philsPluginLibrary.desktop";
import { patchConnectionAudioTransportOptions } from "@evencordplugins/philsPluginLibrary.desktop/patches/audio";

export class MicrophonePatcher extends Patcher {
    private mediaEngineStore: types.MediaEngineStore;
    private mediaEngine: types.MediaEngine;
    public connection?: types.Connection;
    public oldSetTransportOptions: (...args: any[]) => void;
    public forceUpdateTransportationOptions: () => void;

    constructor() {
        super();
        this.mediaEngineStore = MediaEngineStore;
        this.mediaEngine = this.mediaEngineStore.getMediaEngine();
        this.oldSetTransportOptions = () => void 0;
        this.forceUpdateTransportationOptions = () => void 0;
    }

    public patch(): this {
        this.unpatch();

        const { get } = microphoneStore;

        const connectionEventFunction =
            (connection: types.Connection) => {
                if (connection.context !== "default") return;

                this.connection = connection;

                const { oldSetTransportOptions, forceUpdateTransportationOptions, restore } = patchConnectionAudioTransportOptions(connection, get, logger);

                this.unpatchFunctions.push(restore);

                this.oldSetTransportOptions = oldSetTransportOptions;
                this.forceUpdateTransportationOptions = forceUpdateTransportationOptions;
            };

        Emitter.addListener(
            this.mediaEngine.emitter,
            "on",
            "connection",
            connectionEventFunction,
            PluginInfo.PLUGIN_NAME
        );

        if (typeof this.mediaEngine.eachConnection === "function") this.mediaEngine.eachConnection(connectionEventFunction);

        return this;
    }

    public unpatch(): this {
        return this._unpatch();
    }
}
