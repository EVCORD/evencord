/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const esbuild = require("esbuild");

const dm = { id: "dm", type: 1, recipients: ["alice"] };
const group = { id: "group", type: 3, recipients: ["alice"], name: "Friends" };
const chat = { id: "chat", type: 0, guild_id: "server", name: "general" };
const thread = { id: "thread", type: 11, guild_id: "server", name: "Discussion" };
const hidden = { id: "hidden", type: 0, guild_id: "server", name: "private" };
const guilds = { server: { id: "server", name: "Example server" } };
const stores = {
    ChannelStore: {
        getMutablePrivateChannels: () => ({ dm, group }),
        getMutableGuildChannelsForGuild: () => ({ chat, hidden }),
        getAllThreadsForGuild: () => [thread],
        getChannelIds: () => ["dm", "chat"],
        getChannel: id => ({ dm, chat })[id]
    },
    GuildStore: { getGuilds: () => guilds, getGuild: id => guilds[id] },
    UserStore: { getUser: id => id === "alice" ? { username: "alice", globalName: "Alice" } : undefined }
};
const scope = { module: { exports: {} }, require: id => {
    if (id === "@webpack/common") return stores;
    if (id === ".") return { canAccess: id => id !== "hidden" };
    throw Error("Unexpected import " + id);
} };
const source = fs.readFileSync(require("node:path").join(__dirname, "../src/evencordplugins/evenClean/channels.ts"), "utf8");
vm.runInNewContext(esbuild.transformSync(source, { loader: "ts", format: "cjs", target: "node22" }).code, scope);
const { getCleanupChannels, filterCleanupChannels, addCleanupChannels, channelTitle } = scope.module.exports;

test("collects explicit DMs, guild channels and threads without duplicates or inaccessible channels", () => {
    const ids = Array.from(getCleanupChannels(), channel => channel.id).sort();
    assert.deepEqual(ids, ["chat", "dm", "group", "thread"]);
    assert.equal(channelTitle(dm), "Alice");
    assert.equal(channelTitle(group), "Friends");
});

test("current chat, DM and server filters select distinct scopes and search real names", () => {
    const channels = getCleanupChannels();
    const ids = (mode, guild = "", current, search = "") => Array.from(filterCleanupChannels(channels, mode, guild, current, search), channel => channel.id).sort();
    assert.deepEqual(ids("current", "", "dm"), ["dm"]);
    assert.deepEqual(ids("dms"), ["dm", "group"]);
    assert.deepEqual(ids("server", "server"), ["chat", "thread"]);
    assert.deepEqual(ids("dms", "", undefined, " alice "), ["dm"]);
    assert.deepEqual(ids("server", "other"), []);
});

test("select matching skips duplicate selections and caps the exact batch at 100 channels", () => {
    const selected = new Set(Array.from({ length: 99 }, (_, index) => String(index)));
    const result = addCleanupChannels(selected, [{ id: "0" }, { id: "99" }, { id: "100" }]);
    assert.equal(result.size, 100);
    assert.equal(result.has("99"), true);
    assert.equal(result.has("100"), false);
    assert.equal(selected.size, 99);
});
