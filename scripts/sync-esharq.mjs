/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
const git = (...args) => execFileSync("git", args, { maxBuffer: 16 * 1024 * 1024 });
const config = JSON.parse(readFileSync("branding/esharq.json", "utf8"));
if (config.repository !== "LOSTSTR/Esharq" || config.branch !== "main") throw Error("Unexpected Esharq source.");
git("fetch", "--no-tags", "--depth=1", "https://github.com/LOSTSTR/Esharq.git", "+refs/heads/main:refs/remotes/esharq/main");
const commit = git("rev-parse", "refs/remotes/esharq/main").toString().trim();
const lockPath = "branding/esharq-lock.json";
const previous = existsSync(lockPath) ? JSON.parse(readFileSync(lockPath, "utf8")) : null;
if (previous?.commit === commit && JSON.stringify(previous.plugins) === JSON.stringify(config.plugins) && !process.argv.includes("--force")) {
    console.log("Esharq plugins are already integrated.");
    process.exit(0);
}
const paths = config.plugins.map(name => {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_.]*$/.test(name) || name.startsWith("_")) throw Error("Invalid Esharq plugin folder.");
    return "src/esharqplugins/" + name;
});
const files = git("ls-tree", "-r", "-z", commit, "--", ...paths, "src/utils/constants.ts", "src/utils/esharqModals.ts", "browser/icon.png", "LICENSE").toString().split("\0").filter(Boolean);
const staged = [];
for (const entry of files) {
    const [meta, path] = entry.split("\t");
    if (!meta.startsWith("100644 ") && !meta.startsWith("100755 ")) throw Error("Esharq contains an unsupported file type.");
    const bytes = git("show", commit + ":" + path);
    if (path.startsWith("src/esharqplugins/")) {
        let content = bytes;
        if (/\.(ts|tsx)$/.test(path)) content = Buffer.from(bytes.toString("utf8").replaceAll("@utils/esharqI18n", "@esharqplugins/_compat/i18n").replaceAll("@utils/esharqModals", "@esharqplugins/_shared/modals").replaceAll("@utils/constants", "@esharqplugins/_shared/constants").replaceAll('"@webpack/common"', '"@esharqplugins/_compat/common"'));
        staged.push([path, content]);
    } else {
        const destination = { "src/utils/constants.ts": "src/esharqplugins/_shared/constants.ts", "src/utils/esharqModals.ts": "src/esharqplugins/_shared/modals.ts", "browser/icon.png": "src/esharqplugins/_shared/icon.png", "LICENSE": "src/esharqplugins/LICENSE" }[path];
        staged.push([destination, bytes]);
        if (path === "browser/icon.png") staged.push(["src/esharqplugins/_shared/icon.ts", Buffer.from("/*\n * Vencord, a Discord client mod\n * Copyright (c) 2026 Vendicated and contributors\n * SPDX-License-Identifier: GPL-3.0-or-later\n */\nexport default " + JSON.stringify("data:image/png;base64," + bytes.toString("base64")) + ";\n")]);
    }
}
for (const path of paths) {
    if (!staged.some(([file]) => file === path + "/index.ts" || file === path + "/index.tsx")) throw Error("Esharq plugin entry is missing: " + path);
}
for (const name of new Set([...(previous?.plugins ?? []), ...config.plugins])) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_.]*$/.test(name) || name.startsWith("_")) throw Error("Invalid Esharq plugin folder.");
    const root = resolve("src/esharqplugins");
    const target = resolve(root, name);
    if (dirname(target) !== root) throw Error("Esharq plugin path is outside its source folder.");
    rmSync(target, { recursive: true, force: true });
}
for (const [path, content] of staged) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
}
writeFileSync(lockPath, JSON.stringify({ repository: config.repository, commit, plugins: config.plugins }, null, 4) + "\n");
console.log(`Integrated ${config.plugins.length} Esharq plugins from ${commit}.`);
