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

import { Settings } from "@api/Settings";
import { MicrophoneProfile, MicrophoneStore } from "@evencordplugins/betterMicrophone.desktop/stores";
import { ProfilableStore, types } from "@evencordplugins/philsPluginLibrary.desktop";
import { Logger } from "@utils/Logger";
import { lodash } from "@webpack/common";

export function getDefaultAudioTransportationOptions(connection: types.Connection) {
    return {
        audioEncoder: { ...connection.getCodecOptions("opus").audioEncoder }
    };
}

export function getReplaceableAudioTransportationOptions(
    connection: types.Connection,
    get: ProfilableStore<MicrophoneStore, MicrophoneProfile>["get"]
) {
    const { currentProfile } = get();
    const { channels, channelsEnabled, freq, freqEnabled, pacsize, pacsizeEnabled, rate, rateEnabled, voiceBitrate, voiceBitrateEnabled } = currentProfile;
    return {
        ...(voiceBitrateEnabled && voiceBitrate ? { encodingVoiceBitRate: voiceBitrate * 1000 } : {}),
        audioEncoder: {
            ...connection.getCodecOptions("opus").audioEncoder,
            ...(rateEnabled && rate ? { rate } : {}),
            ...(pacsizeEnabled && pacsize ? { pacsize } : {}),
            ...(freqEnabled && freq ? { freq } : {}),
            ...(channelsEnabled && channels && (channels === 1 || Settings.plugins.BetterMicrophone.nativePatching) ? { channels } : {})
        }
    };
}

export function patchConnectionAudioTransportOptions(
    connection: types.Connection,
    get: ProfilableStore<MicrophoneStore, MicrophoneProfile>["get"],
    logger?: Logger
) {
    const oldSetTransportOptions = connection.conn.setTransportOptions;

    const setTransportOptions = function (this: types.Conn, options: Parameters<types.Conn["setTransportOptions"]>[0]) {
        const replaceable = getReplaceableAudioTransportationOptions(connection, get);
        if (replaceable.encodingVoiceBitRate !== undefined) options.encodingVoiceBitRate = replaceable.encodingVoiceBitRate;
        if (!options.audioEncoder) options.audioEncoder = {};
        Object.assign(options.audioEncoder, replaceable.audioEncoder);
        return Reflect.apply(oldSetTransportOptions, this, [options]);
    };
    connection.conn.setTransportOptions = setTransportOptions;
    const restore = () => {
        if (connection.conn.setTransportOptions === setTransportOptions) connection.conn.setTransportOptions = oldSetTransportOptions;
    };

    const forceUpdateTransportationOptions = () => {
        const transportOptions = lodash.merge(
            { ...getDefaultAudioTransportationOptions(connection) },
            getReplaceableAudioTransportationOptions(connection, get)
        );
        logger?.info("Overridden Transport Options", transportOptions);
        oldSetTransportOptions.call(connection.conn, transportOptions);
    };

    return { oldSetTransportOptions, forceUpdateTransportationOptions, restore };
}
