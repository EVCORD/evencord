/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { Flex } from "@components/Flex";
import { ContributorAuthorSummary } from "@evencordplugins/philsPluginLibrary.desktop/components/ContributorAuthorSummary";
import type { Author, Contributor } from "@evencordplugins/philsPluginLibrary.desktop/types";
import type { RenderModalProps } from "@vencord/discord-types";
import { Modal, React } from "@webpack/common";

export interface SettingsModalProps extends RenderModalProps {
    title?: string;
    size?: string;
    children?: React.ReactNode;
    onDone?: () => void;
    footerContent?: React.ReactNode;
    closeButtonName?: string;
    author?: Author;
    contributors?: Contributor[];
}

export const SettingsModal = (props: SettingsModalProps) => (
    <Modal
        transitionState={props.transitionState}
        onClose={props.onClose}
        size="lg"
        title={props.title ?? "Microphone Settings"}
        actions={[{ text: props.closeButtonName ?? "Done", variant: "primary", onClick: props.onDone ?? props.onClose }]}
        actionBarInput={<Flex style={{ alignItems: "center", gap: "1em", flexWrap: "wrap" }}>
            <ContributorAuthorSummary author={props.author} contributors={props.contributors} />
            {props.footerContent}
        </Flex>}
    >
        <div style={{ display: "flex", flexDirection: "column", gap: "1em" }}>{props.children}</div>
    </Modal>
);
