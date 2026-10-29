/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Icon, IconProps } from "./Icons";

export function EvenCordIcon(props: IconProps) {
    return (
        <Icon {...props} viewBox="0 0 24 24">
            <path fill={props.fill || "currentColor"} d="M5 4H21L18 8H9V10H17L14 14H9V16H21L18 20H5Z" />
        </Icon>
    );
}
