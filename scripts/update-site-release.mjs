/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { readFileSync, writeFileSync } from "node:fs";
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const headers = { Accept: "application/vnd.github+json", "User-Agent": "EvenCord" };
if (process.env.GH_TOKEN) headers.Authorization = `Bearer ${process.env.GH_TOKEN}`;
const response = await fetch("https://api.github.com/repos/alrimii/evencord-installer/releases/latest", { headers, signal: AbortSignal.timeout(30_000) });
if (!response.ok) throw Error(`Installer release lookup failed: ${response.status}`);
const installer = await response.json();
const windows = installer.assets.find(asset => asset.name === "EvenCordInstaller-x64.exe" || asset.name === "EvenCordInstaller.exe");
if (!windows) throw Error("The installer release has no Windows download.");
const platforms = ["Windows x64"];
if (installer.assets.some(asset => asset.name === "EvenCordInstallerCli-linux")) platforms.push("Linux");
if (installer.assets.some(asset => asset.name === "EvenCordInstallerCli-universal")) platforms.push("macOS");
writeFileSync("branding/beta-status.json", JSON.stringify({ published: true, version: pkg.version, installerVersion: installer.tag_name.replace(/^installer-v/, ""), installer: windows.browser_download_url, release: installer.html_url, coreRelease: `https://github.com/alrimii/evencord/releases/tag/core-v${pkg.version}`, platforms }, null, 2) + "\n");
