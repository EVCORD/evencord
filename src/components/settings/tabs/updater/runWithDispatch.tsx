/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ErrorCard } from "@components/ErrorCard";
import { formatUpdateError } from "@shared/updateErrors";
import { UpdateLogger } from "@utils/updater";
import { ConfirmModal, openModal } from "@webpack/common";

export function runWithDispatch(dispatch: React.Dispatch<React.SetStateAction<boolean>>, action: () => unknown) {
    return async () => {
        dispatch(true);

        try {
            await action();
        } catch (e) {
            UpdateLogger.error(e);

            const err = formatUpdateError(e);

            openModal(props => (
                <ConfirmModal
                    {...props}
                    title="Update unavailable"
                    confirmText="OK"
                    variant="primary"
                >
                    <ErrorCard>
                        <p>{err}</p>
                    </ErrorCard>
                </ConfirmModal>
            ));
        } finally {
            dispatch(false);
        }
    };
}
