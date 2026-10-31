/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const previous = JSON.parse(readFileSync("package.json", "utf8"));
git("fetch", "--no-tags", "https://github.com/Equicord/Equicord.git", "main");
const upstream = git("rev-parse", "FETCH_HEAD");
const unchanged = spawnSync("git", ["merge-base", "--is-ancestor", upstream, "HEAD"]).status === 0;
if (unchanged) { console.log("Equicord is already integrated."); process.exit(0); }
const merge = spawnSync("git", ["merge", "--no-commit", "--no-ff", upstream], { stdio: "inherit" });
if (merge.status) {
    const conflicts = git("diff", "--name-only", "--diff-filter=U").split("\n");
    if (conflicts.some(file => file !== "package.json")) throw Error("Upstream has source conflicts. Resolve them before publishing.");
    const next = JSON.parse(git("show", ":3:package.json"));
    for (const key of ["name", "private", "version", "description", "homepage", "bugs", "repository", "license", "author", "contributors"]) next[key] = previous[key];
    next.scripts.build = previous.scripts.build;
    next.scripts.generateEvenCordPluginJson = previous.scripts.generateEvenCordPluginJson;
    writeFileSync("package.json", JSON.stringify(next, null, 4) + "\n");
    git("add", "package.json");
}
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const version = previous.version.split(".").map(Number);
version[2]++;
pkg.version = version.join(".");
writeFileSync("package.json", JSON.stringify(pkg, null, 4) + "\n");
writeFileSync(`docs/releases/${pkg.version}.md`, `# EvenCord ${pkg.version}\n\nIntegrates Equicord ${upstream}. EvenCord branding, settings and plugins are preserved.\n`);
git("add", "package.json", `docs/releases/${pkg.version}.md`);
git("commit", "-m", `Integrate Equicord ${upstream.slice(0, 9)} in ${pkg.version}`);
