/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { Button as EvenCordButton, type ButtonProps, type ButtonVariant } from "@components/Button";
import { Heading } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { Text as EvenCordText, type TextProps, type TextTag } from "@components/Text";
import type { ToastVariant } from "@vencord/discord-types";
import { showToast as displayToast } from "@webpack/common";
export * from "@webpack/common";

export const Button = Object.assign(function Button({ color, ...props }: ButtonProps & { color?: ButtonVariant; }) {
    return <EvenCordButton variant={color} {...props} />;
}, {
    Colors: { BRAND: "primary", PRIMARY: "secondary", RED: "dangerPrimary" } as const,
    Sizes: { MIN: "min", SMALL: "small", MEDIUM: "medium" } as const
});

const variants = {
    "heading-lg/semibold": { size: "lg", weight: "semibold" },
    "text-sm/normal": { size: "sm", weight: "normal" },
    "text-sm/semibold": { size: "sm", weight: "semibold" },
    "text-xs/normal": { size: "xs", weight: "normal" }
} as const;

export function Text({ variant = "text-sm/normal", ...props }: TextProps<TextTag> & { variant?: keyof typeof variants; }) {
    return <EvenCordText {...variants[variant]} {...props} />;
}

export const Forms = { FormText: Paragraph, FormTitle: Heading };

export function showToast(text: string, type: ToastVariant = "default") {
    displayToast({ text, variant: type });
}

export const Toasts = {
    Type: { MESSAGE: "default", SUCCESS: "success", FAILURE: "critical" } as const,
    genId: () => crypto.randomUUID(),
    create: (message: string, type: ToastVariant = "default") => ({ message, type }),
    show: ({ message, type }: { message: string; type?: ToastVariant; id?: string; }) => showToast(message, type)
};
