/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import mark from "../../branding/mark.json";
import { Icon, IconProps } from "./Icons";

export function EvenCordIcon(props: IconProps) {
    return (
        <Icon {...props} viewBox="0 0 24 24">
            {mark.paths.map(d => <path key={d} fill={props.fill || "currentColor"} d={d} />)}
        </Icon>
    );
}
