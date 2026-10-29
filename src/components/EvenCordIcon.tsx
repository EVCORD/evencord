/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Icon, IconProps } from "./Icons";

export function EvenCordIcon(props: IconProps) {
    return (
        <Icon {...props} viewBox="0 0 24 24">
            <path fill={props.fill || "currentColor"} d="M4 4H20L17 8H8V10H17L14 14H8V16H20L17 20H4Z" />
        </Icon>
    );
}
