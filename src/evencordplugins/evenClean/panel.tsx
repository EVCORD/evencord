/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { isPluginEnabled } from "@api/PluginManager";
import { Button } from "@components/Button";
import { FormSwitch } from "@components/FormSwitch";
import { Heading } from "@components/Heading";
import { Link } from "@components/Link";
import { Notice } from "@components/Notice";
import { Paragraph } from "@components/Paragraph";
import { Project } from "@shared/project";
import { saveFile } from "@utils/web";
import type { Channel, RenderModalProps } from "@vencord/discord-types";
import { ChannelStore, closeModal, GuildStore, Modal, openModal, React, Select, SelectedChannelStore, showToast, TextInput, useEffect, UserStore,useState, useStateFromStores } from "@webpack/common";

import { canAccess, cleaner, settings } from ".";
import { CleanupFilters, CleanupTarget } from "./engine";

const defaults: CleanupFilters = { contains: "", after: "", before: "", media: "all", includePinned: false, limit: 500 };
let modalKey: string | undefined;

function channelLabel(channel: Channel) {
    if (channel.guild_id) return `${GuildStore.getGuild(channel.guild_id)?.name ?? "Server"} / #${channel.name || channel.id}`;
    if (channel.type === 3) return `Group / ${channel.name || channel.recipients.map(id => UserStore.getUser(id)?.username ?? "User").join(", ")}`;
    const user = UserStore.getUser(channel.recipients[0]);
    return `DM / ${user?.globalName || user?.username || "User"}`;
}

function CleanupPanel(props: RenderModalProps) {
    const state = React.useSyncExternalStore(cleaner.subscribe, cleaner.snapshot);
    const currentChannel = SelectedChannelStore.getChannelId();
    const channels = useStateFromStores([ChannelStore, GuildStore, UserStore], () => ChannelStore.getChannelIds().filter(canAccess).map(id => ChannelStore.getChannel(id)).sort((a, b) => channelLabel(a).localeCompare(channelLabel(b))));
    const [selected, setSelected] = useState(() => new Set(state.targets.length ? state.targets.map(t => t.id) : currentChannel && canAccess(currentChannel) ? [currentChannel] : []));
    const [filters, setFilters] = useState<CleanupFilters>(() => ({ ...(state.filters ?? defaults) }));
    const [scope, setScope] = useState("all");
    const [search, setSearch] = useState("");
    const [confirmation, setConfirmation] = useState("");
    const [acknowledged, setAcknowledged] = useState(false);
    const [reveal, setReveal] = useState(false);
    const [clock, setClock] = useState(Date.now());
    const busy = cleaner.busy();
    useEffect(() => {
        if (!busy || !state.waitUntil) return;
        setClock(Date.now());
        const timer = setInterval(() => setClock(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [busy, state.waitUntil]);
    const guildIds = [...new Set(channels.map(c => c.guild_id).filter(Boolean))];
    const scopes = [{ label: "All loaded channels", value: "all" }, { label: "Direct messages and groups", value: "dms" }, ...guildIds.map(id => ({ label: GuildStore.getGuild(id)?.name ?? id, value: id }))];
    const visible = channels.filter(c => (scope === "all" || (scope === "dms" ? !c.guild_id : c.guild_id === scope)) && channelLabel(c).toLocaleLowerCase().includes(search.toLocaleLowerCase()));
    const shown = visible.slice(0, 150);
    const invalidate = () => { cleaner.clear(); setConfirmation(""); setAcknowledged(false); };
    const edit = (values: Partial<CleanupFilters>) => { invalidate(); setFilters(previous => ({ ...previous, ...values })); };
    const toggle = (id: string, value: boolean) => {
        invalidate();
        setSelected(previous => { const next = new Set(previous); if (value) next.add(id); else next.delete(id); return next; });
    };
    const notifyError = (error: unknown) => showToast({ text: error instanceof Error ? error.message : "Could not start cleanup.", variant: "critical" });
    const preview = () => {
        setConfirmation(""); setAcknowledged(false);
        const targets: CleanupTarget[] = [...selected].map(id => { const channel = ChannelStore.getChannel(id); return { id, label: channel ? channelLabel(channel) : id, guildId: channel?.guild_id || undefined }; });
        void cleaner.preview(targets, filters).catch(notifyError);
    };
    const count = state.messages.length;
    const ready = state.phase === "review" && count > 0 && !busy;
    return <Modal {...props} title="EvenClean" subtitle="Review a batch of your own messages before removing it." size="xl">
        <div className="ec-clean" style={{ "--ec-clean-accent": Project.colors.primary } as React.CSSProperties}>
            <Notice.Warning>Deletion is permanent. Account automation can violate Discord's rules. Rate-limit handling does not guarantee account safety. <Link href="https://support.discord.com/hc/en-us/articles/115002192352-Automated-User-Accounts-Self-Bots">Discord's policy</Link></Notice.Warning>
            <div className="ec-clean-layout">
                <section className="ec-clean-options" aria-label="Cleanup scope and filters">
                    <Heading tag="h3">1. Choose channels</Heading>
                    <Select options={scopes} isSelected={value => value === scope} select={setScope} serialize={String} isDisabled={busy} />
                    <TextInput placeholder="Find a server, channel or DM" aria-label="Find channels" value={search} onChange={setSearch} disabled={busy} />
                    <div className="ec-clean-actions">
                        <Button size="small" variant="secondary" disabled={busy || !shown.length} onClick={() => { invalidate(); setSelected(previous => new Set([...previous, ...shown.slice(0, Math.max(0, 100 - previous.size)).map(c => c.id)])); }}>Select shown</Button>
                        <Button size="small" variant="secondary" disabled={busy || !selected.size} onClick={() => { invalidate(); setSelected(new Set()); }}>Clear selection</Button>
                        <span>{selected.size}/100 selected</span>
                    </div>
                    <div className="ec-clean-channel-list">
                        {shown.map(channel => <FormSwitch key={channel.id} title={channelLabel(channel)} value={selected.has(channel.id)} disabled={busy || (!selected.has(channel.id) && selected.size >= 100)} onChange={checked => toggle(channel.id, checked)} hideBorder />)}
                        {!shown.length && <Paragraph>No accessible channels match. Open the channel in Discord to load it.</Paragraph>}
                    </div>
                    {visible.length > shown.length && <Paragraph>Showing 150 channels. Narrow the server or search filter to find more.</Paragraph>}
                    <Heading tag="h3">2. Narrow the batch</Heading>
                    <label>Message text contains<TextInput value={filters.contains} onChange={contains => edit({ contains })} placeholder="Optional, matched literally" maxLength={200} disabled={busy} /></label>
                    <div className="ec-clean-dates">
                        <label>After, local time<TextInput type="datetime-local" value={filters.after} onChange={after => edit({ after })} disabled={busy} /></label>
                        <label>Before, local time<TextInput type="datetime-local" value={filters.before} onChange={before => edit({ before })} disabled={busy} /></label>
                    </div>
                    <label>Message kind<Select options={[{ label: "All ordinary messages and replies", value: "all" }, { label: "With attachments", value: "attachments" }, { label: "With links", value: "links" }]} isSelected={value => value === filters.media} select={media => edit({ media })} serialize={String} isDisabled={busy} /></label>
                    <label>Maximum messages in this batch<Select options={[100, 500, 1000, 5000].map(value => ({ label: String(value), value }))} isSelected={value => value === filters.limit} select={limit => edit({ limit })} serialize={String} isDisabled={busy} /></label>
                    <FormSwitch title="Include pinned messages" value={filters.includePinned} onChange={includePinned => edit({ includePinned })} disabled={busy} hideBorder />
                    <Button disabled={busy || !selected.size} onClick={preview}>Preview my messages</Button>
                    <Paragraph>Only loaded, accessible channels are listed. Preview never deletes. New messages sent after the preview starts are excluded.</Paragraph>
                </section>
                <section className="ec-clean-review" aria-label="Preview and progress">
                    <Heading tag="h3">3. Review and confirm</Heading>
                    <div className="ec-clean-summary" aria-live="polite">
                        <strong>{state.phase === "idle" ? "Ready for preview" : state.phase}</strong>
                        <p>{state.detail}</p>
                        {state.waitUntil > clock && <p>Next request in at least {Math.ceil((state.waitUntil - clock) / 1000)} seconds.</p>}
                        <span>{count} found · {state.deleted} deleted · {state.missing} already missing · {state.skipped} skipped</span>
                    </div>
                    {state.error && <Notice.Danger>{state.error}</Notice.Danger>}
                    {state.targets.length > 0 && <details>
                        <summary>Batch channels ({state.targets.length})</summary>
                        <ul className="ec-clean-channel-list">{state.targets.map(target => <li key={target.id}>{target.label}</li>)}</ul>
                    </details>}
                    {state.limited && <Notice.Info>Batch limit reached. More matching messages may exist. Finish this batch, then preview again if needed.</Notice.Info>}
                    {busy && <>
                        <progress aria-label="Cleanup progress" value={state.mode === "delete" ? state.deleted + state.missing + state.skipped : undefined} max={Math.max(1, count)} />
                        <div className="ec-clean-actions">
                            <Button variant="secondary" onClick={() => state.phase === "paused" ? cleaner.resume() : cleaner.pause()}>{state.phase === "paused" ? "Resume" : "Pause"}</Button>
                            <Button variant="dangerPrimary" onClick={() => cleaner.stop()}>Stop</Button>
                        </div>
                        <Paragraph>Closing this window does not stop the job. Stop prevents new requests; an in-flight request may complete.</Paragraph>
                    </>}
                    <FormSwitch title="Reveal message text in this window" description="Keep this off while sharing your screen." value={reveal} onChange={setReveal} hideBorder />
                    <div className="ec-clean-messages">
                        {state.messages.slice(0, 100).map(message => <article key={message.id}>
                            <div>{new Date(message.timestamp).toLocaleString()} · {message.attachments} attachment{message.attachments === 1 ? "" : "s"}{message.pinned ? " · pinned" : ""}</div>
                            <p>{reveal ? message.content || "No text content" : "Message text hidden"}</p>
                            <Link href={`https://discord.com/channels/${state.targets.find(t => t.id === message.channelId)?.guildId ?? "@me"}/${message.channelId}/${message.id}`}>Open original message</Link>
                        </article>)}
                        {count > 100 && <Paragraph>Showing 100 of {count} matching messages. Export the preview to review every ID locally.</Paragraph>}
                    </div>
                    <div className="ec-clean-actions">
                        <Button size="small" variant="secondary" disabled={!count || busy || state.accountId !== UserStore.getCurrentUser()?.id} onClick={() => saveFile(new File([JSON.stringify({ product: "EvenCord EvenClean", exportedAt: new Date().toISOString(), accountId: state.accountId, targets: state.targets, messages: state.messages }, null, 2)], "evenclean-preview.json", { type: "application/json" }))}>Export preview JSON</Button>
                        <Button size="small" variant="secondary" disabled={busy || !count} onClick={invalidate}>Forget preview</Button>
                    </div>
                    <Paragraph>Exported previews contain private message text and IDs. Nothing is uploaded. Previews expire after 15 minutes and are not resumed automatically after Discord restarts.</Paragraph>
                    {ready && <div className="ec-clean-confirm">
                        <FormSwitch title="I understand deletion is permanent and account automation may carry restrictions." value={acknowledged} onChange={setAcknowledged} hideBorder />
                        <label>Type DELETE {count} to confirm this exact batch<TextInput value={confirmation} onChange={setConfirmation} placeholder={`DELETE ${count}`} autoComplete="off" /></label>
                        <Button variant="dangerPrimary" disabled={!acknowledged || confirmation !== `DELETE ${count}`} onClick={() => { void cleaner.remove(confirmation, acknowledged, settings.store.deleteDelay).catch(notifyError); }}>Delete {count} own messages</Button>
                    </div>}
                </section>
            </div>
        </div>
    </Modal>;
}

export function openCleanup() {
    if (!isPluginEnabled("EvenClean")) { showToast({ text: "Enable EvenClean in plugin settings first.", variant: "critical" }); return; }
    if (modalKey) return;
    modalKey = openModal(props => <CleanupPanel {...props} />, { onCloseCallback: () => { modalKey = undefined; } });
}

export function closeCleanup() {
    if (modalKey) closeModal(modalKey);
    modalKey = undefined;
}
