/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
const base = "https://github.com/alrimii/evencord-installer/releases/latest/download/";
const tabs = [...document.querySelectorAll("[data-platform]")];
function update(platform) {
    const arch = document.querySelector(`[data-arch="${platform}"]`).value;
    const suffix = arch === "arm64" ? "-arm64" : "";
    let gui, cli;
    if (platform === "windows") { gui = `EvenCord${suffix}.exe`; cli = `EvenCord-cli${suffix}.exe`; }
    else if (platform === "macos") { gui = `EvenCord${arch === "arm64" ? "-arm64" : ""}.dmg`; cli = `EvenCord-cli-${arch}`; }
    else { const session = document.querySelector("#linux-session").value; gui = `EvenCord${session === "combined" ? "" : "-" + session}${suffix}`; cli = `EvenCord-cli-linux${suffix}`; }
    document.querySelector(`[data-gui="${platform}"]`).href = base + gui;
    document.querySelector(`[data-cli="${platform}"]`).href = base + cli;
}
function select(platform) {
    tabs.forEach(tab => tab.setAttribute("aria-pressed", String(tab.dataset.platform === platform)));
    document.querySelectorAll("[data-panel]").forEach(panel => { panel.hidden = panel.dataset.panel !== platform; });
    update(platform);
}
tabs.forEach(tab => tab.addEventListener("click", () => select(tab.dataset.platform)));
document.querySelectorAll("[data-arch]").forEach(input => input.addEventListener("change", () => update(input.dataset.arch)));
document.querySelector("#linux-session").addEventListener("change", () => update("linux"));
const platform = navigator.userAgentData?.platform || navigator.platform;
select(/mac/i.test(platform) ? "macos" : /linux/i.test(platform) ? "linux" : "windows");
