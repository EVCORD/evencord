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

import { existsSync, readdirSync, writeFileSync } from "fs";
import { includePlugin, pluginSource } from "./pluginSources.mjs";
import { getEntryPoint, isPluginFile, parseDevs, parseEquicordDevs, parseFile, PluginData } from "./utils";

(async () => {
    parseDevs();
    parseEquicordDevs();

    const args = process.argv.slice(2);

    const evencordFlag = args.includes("--evencord");
    const equicordFlag = args.includes("--equicord");
    const vencordFlag = args.includes("--vencord");

    let dirs: string[];

    if (evencordFlag) {
        dirs = ["src/evencordplugins/_core", "src/evencordplugins"];
    } else if (equicordFlag) {
        dirs = ["src/equicordplugins/_core", "src/equicordplugins"];
    } else if (vencordFlag) {
        dirs = ["src/plugins", "src/plugins/_core"];
    } else {
        dirs = ["src/plugins", "src/plugins/_core", "src/equicordplugins/_core", "src/equicordplugins", "src/evencordplugins/_core", "src/evencordplugins", "src/esharqplugins"];
    }

    const outputPath = args.find(a => !a.startsWith("--")) ?? null;

    const plugins = [] as PluginData[];

    await Promise.all(
        dirs.filter(existsSync).flatMap(dir =>
            readdirSync(dir, { withFileTypes: true })
                .filter(isPluginFile)
                .filter(entry => entry.isDirectory() || /\.tsx?$/.test(entry.name))
                .filter(entry => includePlugin(`${dir}/${entry.name}`))
                .map(async dirent => {
                    const [data] = await parseFile(await getEntryPoint(dir, dirent));
                    data.source = pluginSource(`${dir}/${dirent.name}`);
                    plugins.push(data);
                })
        )
    );

    plugins.sort((a, b) => a.name.localeCompare(b.name));
    if (new Set(plugins.map(p => p.name)).size !== plugins.length) throw new Error("Duplicate plugin metadata registration");
    const data = JSON.stringify(plugins);

    if (outputPath) {
        writeFileSync(outputPath, data);
    } else {
        console.log(data);
    }
})();
