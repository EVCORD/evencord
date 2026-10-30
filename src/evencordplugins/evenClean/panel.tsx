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
import type { RenderModalProps } from "@vencord/discord-types";
import { ChannelStore, closeModal, GuildStore, Modal, openModal, PermissionStore, React, SearchableSelect, Select, SelectedChannelStore, SelectedGuildStore, showToast, TextInput, useEffect, UserStore, useState, useStateFromStores } from "@webpack/common";

import { canAccess, cleaner, settings } from ".";
import { addCleanupChannels, channelLabel, channelTitle, CleanupScope, filterCleanupChannels, getCleanupChannels } from "./channels";
import { CleanupFilters, CleanupTarget } from "./engine";

const defaults: CleanupFilters = { contains: "", after: "", before: "", media: "all", includePinned: false, limit: 100 };
let modalKey: string | undefined;

function CleanupPanel(props: RenderModalProps) {
    const state = React.useSyncExternalStore(cleaner.subscribe, cleaner.snapshot);
    const [currentChannel] = useState(() => SelectedChannelStore.getChannelId());
    const channels = useStateFromStores([ChannelStore, GuildStore, UserStore, PermissionStore], getCleanupChannels);
    const guilds = useStateFromStores([GuildStore], () => Object.values(GuildStore.getGuilds()).sort((a, b) => a.name.localeCompare(b.name)));
    const [selected, setSelected] = useState(() => new Set(state.targets.length ? state.targets.map(t => t.id) : currentChannel && canAccess(currentChannel) ? [currentChannel] : []));
    const [filters, setFilters] = useState<CleanupFilters>(() => ({ ...(state.filters ?? defaults) }));
    const [scope, setScope] = useState<CleanupScope>(() => state.targets.length ? state.targets.some(t => t.guildId) ? "server" : "dms" : currentChannel && canAccess(currentChannel) ? "current" : "dms");
    const [guildId, setGuildId] = useState(() => state.targets.find(t => t.guildId)?.guildId || ChannelStore.getChannel(currentChannel)?.guild_id || SelectedGuildStore.getGuildId() || guilds[0]?.id || "");
    const [search, setSearch] = useState("");
    const [shownCount, setShownCount] = useState(50);
    const [confirmation, setConfirmation] = useState("");
    const [acknowledged, setAcknowledged] = useState(false);
    const [reveal, setReveal] = useState(false);
    const [clock, setClock] = useState(Date.now());
    const reviewRef = React.useRef<HTMLElement>(null);
    const busy = cleaner.busy();
    const locked = busy || state.requestPending;
    useEffect(() => {
        if (!busy && !state.requestPending) return;
        setClock(Date.now());
        const timer = setInterval(() => setClock(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [busy, state.requestPending]);
    useEffect(() => {
        if (state.phase === "review") reviewRef.current?.scrollIntoView({ block: "nearest" });
        if (state.phase === "error" && state.error) showToast({ text: state.error, variant: "critical" });
    }, [state.phase, state.error]);
    const visible = filterCleanupChannels(channels, scope, guildId, currentChannel, search);
    const shown = visible.slice(0, shownCount);
    const selectedChannels = channels.filter(channel => selected.has(channel.id));
    const unavailableCount = selected.size - selectedChannels.length;
    const invalidate = () => { cleaner.clear(); setConfirmation(""); setAcknowledged(false); };
    const changeScope = (next: CleanupScope) => {
        invalidate(); setScope(next); setSearch(""); setShownCount(50);
        setSelected(new Set(next === "current" && currentChannel && canAccess(currentChannel) ? [currentChannel] : []));
    };
    const edit = (values: Partial<CleanupFilters>) => { invalidate(); setFilters(previous => ({ ...previous, ...values })); };
    const toggle = (id: string, value: boolean) => {
        invalidate();
        setSelected(previous => { const next = new Set(previous); if (value) next.add(id); else next.delete(id); return next; });
    };
    const notifyError = (error: unknown) => showToast({ text: error instanceof Error ? error.message : "Could not start cleanup.", variant: "critical" });
    const preview = () => {
        setConfirmation(""); setAcknowledged(false);
        if (unavailableCount) { notifyError(new Error("Some selected channels are no longer accessible. Clear the selection and choose again.")); return; }
        const targets: CleanupTarget[] = selectedChannels.map(channel => ({ id: channel.id, label: channelLabel(channel), guildId: channel.guild_id || undefined }));
        void cleaner.preview(targets, filters).catch(notifyError);
    };
    const count = state.messages.length;
    const ready = state.phase === "review" && count > 0 && !locked;
    const previewButton = <Button disabled={locked || !selected.size || unavailableCount > 0} onClick={preview}>Find my messages ({selected.size} conversation{selected.size === 1 ? "" : "s"})</Button>;
    return <Modal {...props} title="EvenClean" subtitle="Choose a conversation, preview your messages, then decide what to remove." size="xl">
        <div className="ec-clean" style={{ "--ec-clean-accent": Project.colors.primary } as React.CSSProperties}>
            <Notice.Info>Choose a conversation, click Find my messages, then review the results and confirm deletion. Searching does not delete anything.</Notice.Info>
            <Notice.Warning>Deletion is permanent. Account automation can violate Discord's rules. Rate-limit handling does not guarantee account safety. <Link href="https://support.discord.com/hc/en-us/articles/115002192352-Automated-User-Accounts-Self-Bots">Discord's policy</Link></Notice.Warning>
            {state.error && <Notice.Danger>{state.error}</Notice.Danger>}
            <div className="ec-clean-start">
                {previewButton}
                <span>{busy ? `${state.detail} ${count} message${count === 1 ? "" : "s"} found.` : `${selected.size} selected / maximum ${filters.limit} messages`}</span>
                {busy && state.mode === "preview" && count > 0 && <Button variant="secondary" onClick={() => cleaner.finishPreview()}>Review results now</Button>}
                {busy && <Button variant="dangerPrimary" onClick={() => cleaner.stop()}>Stop</Button>}
            </div>
            <div className="ec-clean-layout">
                <section className="ec-clean-options" aria-label="Cleanup scope and filters">
                    <Heading tag="h3">Choose where to clean</Heading>
                    <div className="ec-clean-scopes" role="group" aria-label="Conversation type">
                        {([{ value: "current", label: "This chat" }, { value: "dms", label: "Direct messages" }, { value: "server", label: "Server channels" }] as const).map(option => <Button key={option.value} size="small" variant="secondary" aria-pressed={scope === option.value} disabled={locked || (option.value === "current" && !channels.some(channel => channel.id === currentChannel))} onClick={() => changeScope(option.value)}>{option.label}</Button>)}
                    </div>
                    {scope === "server" && <label className="ec-clean-field">Server<SearchableSelect placeholder="Choose a server" options={guilds.map(guild => ({ label: guild.name, value: guild.id }))} value={guildId} onChange={(id: string) => { invalidate(); setGuildId(id); setSelected(new Set()); setSearch(""); setShownCount(50); }} isDisabled={locked} /></label>}
                    {scope === "current" ? <Paragraph>This chat is selected automatically. Choose another type above to clean other conversations.</Paragraph> : <TextInput placeholder={scope === "dms" ? "Find a person or group DM" : "Find a channel in this server"} aria-label="Find conversations" value={search} onChange={value => { setSearch(value); setShownCount(50); }} disabled={locked} />}
                    <div className="ec-clean-actions">
                        <Button size="small" variant="secondary" disabled={locked || !visible.length || selected.size >= 100} onClick={() => { invalidate(); setSelected(previous => addCleanupChannels(previous, visible)); }}>Select matching{visible.length > 100 ? " (up to 100)" : ""}</Button>
                        <Button size="small" variant="secondary" disabled={locked || !selected.size} onClick={() => { invalidate(); setSelected(new Set()); }}>Clear selection</Button>
                        <span aria-live="polite">{selected.size}/100 selected</span>
                    </div>
                    <div className="ec-clean-channel-list" role="group" aria-label="Choose conversations">
                        {shown.map(channel => <Button key={channel.id} variant="none" className="ec-clean-channel" aria-pressed={selected.has(channel.id)} disabled={locked || (!selected.has(channel.id) && selected.size >= 100)} onClick={() => toggle(channel.id, !selected.has(channel.id))}>
                            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" aria-hidden="true"><rect x="2" y="2" width="16" height="16" rx="4" />{selected.has(channel.id) && <path d="m6 10 3 3 5-6" strokeWidth="2" />}</svg>
                            <span><strong>{channelTitle(channel)}</strong><span>{channel.guild_id ? GuildStore.getGuild(channel.guild_id)?.name : channel.type === 3 ? "Group direct message" : "Direct message"}{channel.isThread() ? " / Thread" : ""}</span></span>
                        </Button>)}
                        {!shown.length && <Paragraph>{scope === "server" && !guildId ? "Choose a server to see its channels." : search ? "No conversations match this search. Try a different name or clear the search." : "No accessible conversations are loaded here. Open the DM or server in Discord, then reopen EvenClean."}</Paragraph>}
                    </div>
                    {visible.length > shown.length && <Button size="small" variant="secondary" onClick={() => setShownCount(count => count + 50)}>Show more ({visible.length - shown.length} remaining)</Button>}
                    {selected.size > 0 && <details className="ec-clean-selection"><summary>Selected conversations ({selected.size})</summary><ul>{selectedChannels.map(channel => <li key={channel.id}><span>{channelLabel(channel)}</span><Button size="xs" variant="secondary" disabled={locked} onClick={() => toggle(channel.id, false)} aria-label={`Remove ${channelLabel(channel)} from selection`}>Remove</Button></li>)}</ul></details>}
                    {unavailableCount > 0 && <Notice.Warning>{unavailableCount} selected channel(s) are no longer accessible. Clear the selection and choose again.</Notice.Warning>}
                    <details className="ec-clean-filters">
                        <summary>Optional filters</summary>
                        <div className="ec-clean-options">
                            <label className="ec-clean-field">Message text contains<TextInput value={filters.contains} onChange={contains => edit({ contains })} placeholder="Optional, matched literally" maxLength={200} disabled={locked} /></label>
                            <div className="ec-clean-dates">
                                <label className="ec-clean-field">After, local time<TextInput type="datetime-local" value={filters.after} onChange={after => edit({ after })} disabled={locked} /></label>
                                <label className="ec-clean-field">Before, local time<TextInput type="datetime-local" value={filters.before} onChange={before => edit({ before })} disabled={locked} /></label>
                            </div>
                            <label className="ec-clean-field">Message kind<Select options={[{ label: "All ordinary messages and replies", value: "all" }, { label: "With attachments", value: "attachments" }, { label: "With links", value: "links" }]} isSelected={value => value === filters.media} select={media => edit({ media })} serialize={String} isDisabled={locked} /></label>
                            <FormSwitch title="Include pinned messages" value={filters.includePinned} onChange={includePinned => edit({ includePinned })} disabled={locked} hideBorder />
                        </div>
                    </details>
                    <label className="ec-clean-field">Maximum messages in this batch<Select options={[100, 500, 1000, 5000].map(value => ({ label: String(value), value }))} isSelected={value => value === filters.limit} select={limit => edit({ limit })} serialize={String} isDisabled={locked} /></label>
                    {previewButton}
                    <Paragraph>Preview only searches your own messages. Nothing is deleted until you review and confirm. Changing the conversation type or server resets the selection.</Paragraph>
                </section>
                <section ref={reviewRef} className="ec-clean-review" aria-label="Preview and progress">
                    <Heading tag="h3">Review before deleting</Heading>
                    <div className="ec-clean-summary" aria-live="polite">
                        <strong>{{ idle: "Choose conversations to begin", previewing: "Finding your messages", review: "Preview ready", deleting: "Deleting confirmed messages", paused: "Paused", done: "Batch complete", stopped: "Stopped", error: "Could not finish" }[state.phase]}</strong>
                        <p>{state.detail}</p>
                        {busy && state.mode === "preview" && <p>Conversation {state.targetIndex} of {state.targets.length}. Page {state.page}. {state.scanned}/20 search pages used.</p>}
                        {state.requestPending && <p>Waiting for Discord's response: {Math.max(0, Math.floor((clock - state.requestStartedAt) / 1000))} seconds. No other request will start while this one is pending.</p>}
                        {state.waitUntil > clock && <p>Next request in at least {Math.ceil((state.waitUntil - clock) / 1000)} seconds. This is a cooldown, not a frozen search.</p>}
                        <span>{count} found · {state.deleted} deleted · {state.missing} already missing · {state.skipped} skipped</span>
                    </div>
                    {state.targets.length > 0 && <details>
                        <summary>Batch channels ({state.targets.length})</summary>
                        <ul className="ec-clean-channel-list">{state.targets.map(target => <li key={target.id}>{target.label}</li>)}</ul>
                    </details>}
                    {state.limited && <Notice.Info>This is a partial preview. More matching messages may exist. Review this batch, or narrow the date range and search again.</Notice.Info>}
                    {busy && <>
                        <progress aria-label="Cleanup progress" value={state.mode === "delete" ? state.deleted + state.missing + state.skipped : undefined} max={Math.max(1, count)} />
                        <div className="ec-clean-actions">
                            <Button variant="secondary" onClick={() => state.phase === "paused" ? cleaner.resume() : cleaner.pause()}>{state.phase === "paused" ? "Resume" : "Pause"}</Button>
                            {state.mode === "preview" && <Button variant="primary" disabled={!count} onClick={() => cleaner.finishPreview()}>Review {count} result{count === 1 ? "" : "s"} now</Button>}
                            <Button variant="dangerPrimary" onClick={() => cleaner.stop()}>Stop</Button>
                        </div>
                        <Paragraph>Closing this window does not stop the job. Stop prevents new requests; an in-flight request may complete.</Paragraph>
                    </>}
                    {!busy && state.requestPending && <Notice.Warning>The batch has stopped, but Discord still has an outstanding request. New searches and deletion are blocked until it finishes. Restart Discord manually if the connection stays stuck.</Notice.Warning>}
                    {state.phase === "review" && count === 0 && <Notice.Info>No eligible messages were found in this preview. Check the selected conversation, clear optional filters or adjust the dates, then click Find my messages again.</Notice.Info>}
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
                        <Button size="small" variant="secondary" disabled={locked || !count} onClick={invalidate}>Forget preview</Button>
                    </div>
                    <Paragraph>Exported previews contain private message text and IDs. Nothing is uploaded. Previews expire after 15 minutes and are not resumed automatically after Discord restarts.</Paragraph>
                    {ready && <div className="ec-clean-confirm">
                        <Heading tag="h3">Delete this reviewed batch</Heading>
                        <Paragraph>Nothing has been deleted yet. Check the box, type DELETE {count}, then click Delete below.</Paragraph>
                        <FormSwitch title="I understand deletion is permanent and account automation may carry restrictions." value={acknowledged} onChange={setAcknowledged} hideBorder />
                        <label className="ec-clean-field">Type DELETE {count} to confirm this exact batch<TextInput value={confirmation} onChange={setConfirmation} placeholder={`DELETE ${count}`} autoComplete="off" /></label>
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
