/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BaseText } from "@components/BaseText";

interface StatsProps {
    totalStockPlugins: number;
    enabledStockPlugins: number;
    title?: string;
}

export function StockPluginsCard({ totalStockPlugins, enabledStockPlugins, title = "Built-in plugins" }: StatsProps) {
    return (
        <div className="vc-plugin-stats vc-stockplugins-stats-card">
            <BaseText size="md" weight="semibold">{title}</BaseText>
            <div className="vc-plugin-stats-card-container">
                <div className="vc-plugin-stats-card-section">
                    <BaseText size="sm">Enabled</BaseText>
                    <BaseText size="xl" weight="bold">{enabledStockPlugins}</BaseText>
                </div>
                <div className="vc-plugin-stats-card-divider" />
                <div className="vc-plugin-stats-card-section">
                    <BaseText size="sm">Available</BaseText>
                    <BaseText size="xl" weight="bold">{totalStockPlugins}</BaseText>
                </div>
            </div>
        </div>
    );
}

export function UserPluginsCard({ totalUserPlugins, enabledUserPlugins }: { totalUserPlugins: number; enabledUserPlugins: number; }) {
    return totalUserPlugins > 0 ? <StockPluginsCard title="Custom plugins" totalStockPlugins={totalUserPlugins} enabledStockPlugins={enabledUserPlugins} /> : null;
}
