/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { Card } from "@components/Card";
import { ErrorCard } from "@components/ErrorCard";
import { Flex } from "@components/Flex";
import { Link } from "@components/Link";
import { Paragraph } from "@components/Paragraph";
import { Span } from "@components/Span";
import type { UpdateStatus } from "@shared/UpdateStatus";
import { Margins } from "@utils/margins";
import { changes, checkForUpdates, getUpdateStatus, restartAfterUpdate, update } from "@utils/updater";
import { React, useState } from "@webpack/common";

import { runWithDispatch } from "./runWithDispatch";

export interface CommonProps {
    repo: string;
    repoPending: boolean;
}

export function HashLink({ repo, hash, disabled = false }: { repo: string, hash: string, disabled?: boolean; }) {
    return (
        <Link href={`${repo}/commit/${hash}`} disabled={disabled}>
            {hash.slice(0, 7)}
        </Link>
    );
}

export function Changes({ updates, repo, repoPending }: CommonProps & { updates: typeof changes; }) {
    return (
        <Card className={Margins.top16} style={{ padding: 0 }} defaultPadding={false}>
            {updates.map(({ hash, author, message }, i) => (
                <div
                    key={hash}
                    style={{
                        padding: "12px 16px",
                        borderBottom: i < updates.length - 1 ? "1px solid var(--border-subtle)" : undefined
                    }}
                >
                    <Flex style={{ alignItems: "center", gap: 8 }}>
                        <code style={{ color: "var(--text-link)" }}>
                            <HashLink {...{ repo, hash }} disabled={repoPending} />
                        </code>
                        <Span size="sm" color="text-default">
                            {message}
                        </Span>
                        <Span size="sm" color="text-subtle">
                            by {author}
                        </Span>
                    </Flex>
                </div>
            ))}
        </Card>
    );
}

export function Newer(props: CommonProps) {
    return (
        <>
            <Paragraph>
                Your local copy has more recent commits than the remote repository. This usually happens when you've made local changes. Please stash or reset them before updating.
            </Paragraph>
            <Changes {...props} updates={changes} />
        </>
    );
}

export function Updatable(props: CommonProps) {
    const [updates, setUpdates] = useState(changes);
    const [status, setStatus] = useState<UpdateStatus>();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    React.useEffect(() => {
        let active = true;
        let timer: ReturnType<typeof setTimeout>;
        const refresh = async () => {
            try {
                const next = await getUpdateStatus();
                if (active) setStatus(next);
            } catch { if (active) setError("Could not read updater status. Restart Discord or use the verified installer."); }
            finally { if (active) timer = setTimeout(refresh, 750); }
        };
        void refresh();
        return () => { active = false; clearTimeout(timer); };
    }, []);

    const phase = status?.phase;
    const pending = busy || ["checking", "downloading", "verifying", "staging"].includes(phase || "");
    const message = phase === "ready" ? "The update is ready. Restart Discord to load it."
        : phase === "current" ? "No newer release is available."
            : phase === "checking" ? "Checking EvenCord releases..."
                : phase === "downloading" ? `Downloading ${((status?.received || 0) / 1048576).toFixed(1)} of ${((status?.total || 0) / 1048576).toFixed(1)} MiB...`
                    : phase === "verifying" ? "Verifying the release size and GitHub SHA-256 digest..."
                        : phase === "staging" ? "Saving the verified update..."
                            : phase === "available" ? `EvenCord ${status?.availableVersion} is available.`
                                : "Check for an EvenCord release.";
    return <>
        {status?.installedVersion && <Paragraph>Running {status.installedVersion} · Source: EvenCord GitHub releases</Paragraph>}
        <Flex className={Margins.bottom8} gap="8px" flexWrap="wrap">
            <Button disabled={pending || phase === "ready"} onClick={runWithDispatch(setBusy, async () => {
                setError("");
                await checkForUpdates();
                setUpdates(changes);
                setStatus(await getUpdateStatus());
            })}>Check for Updates</Button>
            {phase === "available" && <Button disabled={pending} onClick={runWithDispatch(setBusy, async () => {
                setError("");
                if (await checkForUpdates()) await update();
                setStatus(await getUpdateStatus());
            })}>Download update</Button>}
            {phase === "ready" && <Button disabled={pending} onClick={runWithDispatch(setBusy, async () => {
                await restartAfterUpdate();
            })}>Update ready — Restart Discord</Button>}
        </Flex>
        <Paragraph aria-live="polite">{message}</Paragraph>
        {phase === "downloading" && <progress aria-label="Update download" max={status?.total || 1} value={status?.received || 0} style={{ width: "100%" }} />}
        {(status?.error || error) && <ErrorCard className={Margins.top8} style={{ padding: "1em" }}><p>{status?.error || error}</p></ErrorCard>}
        {updates?.length > 0 && <Changes updates={updates} {...props} />}
    </>;
}
