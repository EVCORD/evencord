/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import EsharqIcon from "@esharqplugins/_shared/icon";
import { EvenCordIcon } from "@components/EvenCordIcon";
import { Project } from "@shared/project";
import type { Plugin } from "@utils/types";

import { PluginMeta } from "~plugins";

export function pluginSource(plugin: Plugin) {
    const { folderName, userPlugin } = PluginMeta[plugin.name];
    if (folderName.startsWith("src/esharqplugins/")) return {
        id: "esharq", label: "Esharq Plugin", icon: EsharqIcon,
        website: "https://github.com/LOSTSTR/Esharq/tree/main/" + folderName
    };
    if (folderName.startsWith("src/evencordplugins/")) return {
        id: "evencord", label: "EvenCord Plugin", icon: "",
        website: Project.links.source + "/tree/main/" + folderName
    };
    if (userPlugin) return { id: "user", label: "User Plugin", icon: "https://equicord.org/assets/icons/misc/userplugin.png", website: "" };
    if (folderName.startsWith("src/equicordplugins/")) return {
        id: "equicord", label: "Equicord Plugin", icon: "https://equicord.org/assets/favicon.png",
        website: "https://equicord.org/plugins/" + encodeURIComponent(plugin.name)
    };
    return {
        id: "vencord", label: plugin.isModified ? "Modified Vencord Plugin" : "Vencord Plugin",
        icon: plugin.isModified ? "https://equicord.org/assets/icons/equicord/modified.png" : "https://equicord.org/assets/icons/vencord/icon-light.png",
        website: "https://vencord.dev/plugins/" + encodeURIComponent(plugin.name)
    };
}

export function PluginSourceIcon({ plugin, className }: { plugin: Plugin; className?: string; }) {
    const source = pluginSource(plugin);
    return source.id === "evencord"
        ? <span className={className} title={source.label} role="img" aria-label={source.label} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--text-normal)" }}><EvenCordIcon width="100%" height="100%" /></span>
        : <img className={className} src={source.icon} alt={source.label} />;
}
