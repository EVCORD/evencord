/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Text } from "@components/Text";

interface StatsProps {
    totalStockPlugins: number;
    enabledStockPlugins: number;
    title?: string;
}

export function StockPluginsCard({ totalStockPlugins, enabledStockPlugins, title = "Built-in plugins" }: StatsProps) {
    return (
        <div className="vc-plugin-stats vc-stockplugins-stats-card">
            <Text size="md" weight="semibold">{title}</Text>
            <div className="vc-plugin-stats-card-container">
                <div className="vc-plugin-stats-card-section">
                    <Text size="sm">Enabled</Text>
                    <Text size="xl" weight="bold">{enabledStockPlugins}</Text>
                </div>
                <div className="vc-plugin-stats-card-divider" />
                <div className="vc-plugin-stats-card-section">
                    <Text size="sm">Available</Text>
                    <Text size="xl" weight="bold">{totalStockPlugins}</Text>
                </div>
            </div>
        </div>
    );
}

export function UserPluginsCard({ totalUserPlugins, enabledUserPlugins }: { totalUserPlugins: number; enabledUserPlugins: number; }) {
    return totalUserPlugins > 0 ? <StockPluginsCard title="Custom plugins" totalStockPlugins={totalUserPlugins} enabledStockPlugins={enabledUserPlugins} /> : null;
}
