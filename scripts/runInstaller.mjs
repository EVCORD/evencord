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
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { project, requireDistribution } from "./project.mjs";

requireDistribution();
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const suffix = process.arch === "arm64" ? "arm64" : process.arch === "x64" ? "x64" : undefined;
if (!suffix) throw Error("Download the installer for a supported architecture.");
const filename = process.platform === "win32" ? `EvenCord-cli${suffix === "arm64" ? "-arm64" : ""}.exe`
    : process.platform === "darwin" ? `EvenCord-cli-${suffix}`
        : process.platform === "linux" ? `EvenCord-cli-linux${suffix === "arm64" ? "-arm64" : ""}` : undefined;
if (!filename) throw Error("This operating system is unsupported.");
const response = await fetch(`https://api.github.com/repos/${project.repositories.installer.slug}/releases/latest`, { signal: AbortSignal.timeout(30_000) });
if (!response.ok) throw Error(`Installer release lookup failed: ${response.status}`);
const release = await response.json();
const asset = release.assets.find(asset => asset.name === filename);
if (!asset || !/^sha256:[a-f0-9]{64}$/.test(asset.digest) || asset.size <= 0 || asset.size > 134217728) throw Error("The installer asset or digest is unavailable.");
const expected = `https://github.com/${project.repositories.installer.slug}/releases/download/${release.tag_name}/${filename}`;
if (asset.browser_download_url !== expected) throw Error("The installer belongs to another repository.");
const download = await fetch(expected, { signal: AbortSignal.timeout(120_000) });
if (!download.ok || !download.body) throw Error("The installer download failed.");
const chunks = [];
let received = 0;
for await (const chunk of download.body) {
    received += chunk.byteLength;
    if (received > asset.size) throw Error("The installer exceeds its published size.");
    chunks.push(chunk);
}
const data = Buffer.concat(chunks);
if (data.length !== asset.size || "sha256:" + createHash("sha256").update(data).digest("hex") !== asset.digest) throw Error("The installer digest does not match.");
const directory = join(root, "dist", "Installer");
mkdirSync(directory, { recursive: true });
const executable = join(directory, filename);
writeFileSync(executable, data);
chmodSync(executable, 0o755);
const argStart = process.argv.indexOf("--");
execFileSync(executable, argStart < 0 ? [] : process.argv.slice(argStart + 1), {
    stdio: "inherit",
    env: { ...process.env, EVENCORD_USER_DATA_DIR: join(root, ".cache", "dev-profile"), EVENCORD_DIRECTORY: join(root, "dist", "desktop"), EVENCORD_DEV_INSTALL: "1" }
});
