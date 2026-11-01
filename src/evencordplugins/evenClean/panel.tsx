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
import { ChannelStore, Checkbox, closeModal, ContextMenuApi, GuildStore, Menu, Modal, openModal, PermissionStore, React, SelectedChannelStore, SelectedGuildStore, showToast, TextInput, useEffect, UserStore, useState, useStateFromStores } from "@webpack/common";

import { canAccess, cleaner, CleanupIcon, settings } from ".";
import { addCleanupChannels, channelLabel, channelTitle, CleanupScope, filterCleanupChannels, getCleanupChannels } from "./channels";
import { CleanupFilters, CleanupTarget } from "./engine";

const defaults: CleanupFilters = { contains: "", after: "", before: "", media: "all", includePinned: false, limit: 0 };
let modalKey: string | undefined;

interface ChoiceProps<T extends string> {
    id: string;
    label: string;
    value: T;
    options: readonly { label: string; value: T; }[];
    disabled: boolean;
    searchable?: boolean;
    onChange(value: T): void;
}

function ChoiceMenu<T extends string>({ id, label, value, options, searchable, onChange }: ChoiceProps<T>) {
    const [query, setQuery] = useState("");
    const filtered = options.filter(option => option.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
    return <Menu.Menu navId={id} aria-label={label} onClose={ContextMenuApi.closeContextMenu}>
        {searchable && <Menu.MenuControlItem id={`${id}-search`} control={(props, ref) => <Menu.MenuSearchControl {...props} ref={ref} query={query} onChange={setQuery} placeholder="بحث" autoFocus />} />}
        {filtered.map(option => <Menu.MenuRadioItem key={option.value} id={`${id}-${option.value}`} group={id} label={option.label} checked={value === option.value} action={() => { ContextMenuApi.closeContextMenu(); onChange(option.value); }} />)}
        {!filtered.length && <Menu.MenuItem id={`${id}-empty`} label="لا توجد نتائج" disabled />}
    </Menu.Menu>;
}

function ChoiceControl<T extends string>(props: ChoiceProps<T>) {
    return <div className="vc-evenclean-field">
        <span id={`${props.id}-label`}>{props.label}</span>
        <Button variant="secondary" className="vc-evenclean-choice" disabled={props.disabled} aria-labelledby={`${props.id}-label`} aria-haspopup="menu" onClick={event => ContextMenuApi.openContextMenu(event, () => <ChoiceMenu {...props} />)}>
            <span dir="auto">{props.options.find(option => option.value === props.value)?.label ?? "اختر"}</span><span aria-hidden="true">▾</span>
        </Button>
    </div>;
}

function CleanupPanel(props: RenderModalProps) {
    const state = React.useSyncExternalStore(cleaner.subscribe, cleaner.snapshot);
    const [currentChannel] = useState(() => SelectedChannelStore.getChannelId());
    const channels = useStateFromStores([ChannelStore, GuildStore, UserStore, PermissionStore], getCleanupChannels);
    const guilds = useStateFromStores([GuildStore], () => Object.values(GuildStore.getGuilds()).sort((a, b) => a.name.localeCompare(b.name)));
    const [selected, setSelected] = useState(() => new Set(state.targets.length ? state.targets.map(t => t.id) : currentChannel && canAccess(currentChannel) ? [currentChannel] : []));
    const [filters, setFilters] = useState<CleanupFilters>(() => {
        const previous = state.filters ?? defaults;
        return { ...previous, after: previous.after.slice(0, 10), before: previous.before.slice(0, 10) };
    });
    const [scope, setScope] = useState<CleanupScope>(() => state.targets.length ? state.targets.some(t => t.guildId) ? "server" : "dms" : currentChannel && canAccess(currentChannel) ? "current" : "dms");
    const [guildId, setGuildId] = useState(() => state.targets.find(t => t.guildId)?.guildId || ChannelStore.getChannel(currentChannel)?.guild_id || SelectedGuildStore.getGuildId() || guilds[0]?.id || "");
    const [search, setSearch] = useState("");
    const [shownCount, setShownCount] = useState(50);
    const [previewCount, setPreviewCount] = useState(100);
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
    const invalidate = () => { cleaner.clear(); setAcknowledged(false); setPreviewCount(100); };
    const changeScope = (next: CleanupScope) => {
        invalidate(); setScope(next); setSearch(""); setShownCount(50);
        setSelected(new Set(next === "current" && currentChannel && canAccess(currentChannel) ? [currentChannel] : []));
    };
    const edit = (values: Partial<CleanupFilters>) => { invalidate(); setFilters(previous => ({ ...previous, ...values })); };
    const toggle = (id: string, value: boolean) => {
        invalidate();
        setSelected(previous => { const next = new Set(previous); if (value) next.add(id); else next.delete(id); return next; });
    };
    const notifyError = (error: unknown) => showToast({ text: error instanceof Error ? error.message : "تعذر بدء العملية.", variant: "critical" });
    const preview = () => {
        setAcknowledged(false); setPreviewCount(100);
        if (unavailableCount) { notifyError(new Error("تعذر الوصول إلى بعض المحادثات. أعد تحديد المحادثات.")); return; }
        const targets: CleanupTarget[] = selectedChannels.map(channel => ({ id: channel.id, label: channelLabel(channel), guildId: channel.guild_id || undefined }));
        void cleaner.preview(targets, filters).catch(notifyError);
    };
    const count = state.messages.length;
    const ready = state.phase === "review" && count > 0 && !locked;
    const step = state.mode === "delete" ? 2 : state.phase === "idle" ? 0 : 1;
    const completed = state.deleted + state.missing + state.skipped;
    return <Modal {...props} title="EvenClean" subtitle="راجع رسائلك قبل الحذف." size="xl">
        <div className="vc-evenclean" dir="rtl" lang="ar" style={{ "--vc-evenclean-accent": Project.colors.primary } as React.CSSProperties}>
            <ol className="vc-evenclean-steps" aria-label="مراحل حذف الرسائل">
                {["اختيار المحادثات", "مراجعة الرسائل", "الحذف"].map((label, index) => <li key={label} aria-current={step === index ? "step" : undefined} data-complete={step > index}>
                    <span aria-hidden="true">{step > index ? "✓" : index + 1}</span>{label}
                </li>)}
            </ol>
            {state.error && <Notice.Danger>{state.error}</Notice.Danger>}
            <div className="vc-evenclean-layout">
                <section className="vc-evenclean-options vc-evenclean-sidebar" aria-label="المحادثات والفلاتر">
                    <div className="vc-evenclean-section-heading">
                        <Heading tag="h3">المحادثات</Heading>
                        <span>{selected.size} محددة</span>
                    </div>
                    <div className="vc-evenclean-scopes" role="group" aria-label="نوع المحادثات">
                        {([{ value: "current", label: "الحالية" }, { value: "dms", label: "الخاص" }, { value: "server", label: "السيرفر" }] as const).map(option => <Button key={option.value} size="small" variant="none" aria-pressed={scope === option.value} disabled={locked || (option.value === "current" && !channels.some(channel => channel.id === currentChannel))} onClick={() => changeScope(option.value)}>{option.label}</Button>)}
                    </div>
                    {scope === "server" && <ChoiceControl id="vc-evenclean-guild" label="السيرفر" options={guilds.map(guild => ({ label: guild.name, value: guild.id }))} value={guildId} onChange={id => { invalidate(); setGuildId(id); setSelected(new Set()); setSearch(""); setShownCount(50); }} disabled={locked} searchable />}
                    {scope !== "current" && <TextInput placeholder={scope === "dms" ? "ابحث عن شخص أو مجموعة" : "ابحث عن قناة"} aria-label="البحث في المحادثات" value={search} onChange={value => { setSearch(value); setShownCount(50); }} disabled={locked} />}
                    <div className="vc-evenclean-actions vc-evenclean-selection-actions">
                        <Button size="xs" variant="none" disabled={locked || !visible.length || selected.size >= 100} onClick={() => { invalidate(); setSelected(previous => addCleanupChannels(previous, visible)); }}>تحديد الكل{visible.length > 100 ? " (حتى 100)" : ""}</Button>
                        <Button size="xs" variant="none" disabled={locked || !selected.size} onClick={() => { invalidate(); setSelected(new Set()); }}>إلغاء التحديد</Button>
                    </div>
                    <div className="vc-evenclean-channel-list" role="group" aria-label="اختيار المحادثات">
                        {shown.map(channel => <Button key={channel.id} variant="none" className="vc-evenclean-channel" aria-pressed={selected.has(channel.id)} disabled={locked || (!selected.has(channel.id) && selected.size >= 100)} onClick={() => toggle(channel.id, !selected.has(channel.id))}>
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" aria-hidden="true"><rect x="2" y="2" width="16" height="16" rx="5" />{selected.has(channel.id) && <path d="m6 10 3 3 5-6" strokeWidth="2" />}</svg>
                            <span><strong dir="auto">{channelTitle(channel)}</strong><span dir="auto">{channel.guild_id ? GuildStore.getGuild(channel.guild_id)?.name : channel.type === 3 ? "مجموعة خاصة" : "محادثة خاصة"}{channel.isThread() ? " / ثريد" : ""}</span></span>
                        </Button>)}
                        {!shown.length && <p className="vc-evenclean-muted">{scope === "server" && !guildId ? "اختر سيرفراً لعرض قنواته." : search ? "لا توجد محادثات مطابقة." : "افتح المحادثة في Discord ثم أعد فتح هذه النافذة."}</p>}
                    </div>
                    {visible.length > shown.length && <Button size="small" variant="secondary" onClick={() => setShownCount(count => count + 50)}>عرض المزيد ({visible.length - shown.length})</Button>}
                    {selected.size > 0 && scope !== "current" && <details className="vc-evenclean-details">
                        <summary>المحادثات المحددة ({selected.size})</summary>
                        <ul className="vc-evenclean-selection">{selectedChannels.map(channel => <li key={channel.id}><bdi>{channelLabel(channel)}</bdi><Button size="xs" variant="none" disabled={locked} onClick={() => toggle(channel.id, false)} aria-label={`إلغاء تحديد ${channelLabel(channel)}`}>إزالة</Button></li>)}</ul>
                    </details>}
                    {unavailableCount > 0 && <Notice.Warning>تعذر الوصول إلى {unavailableCount} من المحادثات المحددة. أعد تحديد المحادثات.</Notice.Warning>}
                    <details className="vc-evenclean-details vc-evenclean-filters">
                        <summary>فلاتر البحث</summary>
                        <div className="vc-evenclean-options">
                            <label className="vc-evenclean-field">نص الرسالة<TextInput value={filters.contains} onChange={contains => edit({ contains })} placeholder="كلمة أو عبارة" maxLength={200} disabled={locked} /></label>
                            <div className="vc-evenclean-dates">
                                <label className="vc-evenclean-field" htmlFor="vc-evenclean-after">من تاريخ<TextInput id="vc-evenclean-after" type="date" value={filters.after.slice(0, 10)} onChange={after => edit({ after })} disabled={locked} /></label>
                                <label className="vc-evenclean-field" htmlFor="vc-evenclean-before">إلى تاريخ<TextInput id="vc-evenclean-before" type="date" value={filters.before.slice(0, 10)} onChange={before => edit({ before })} disabled={locked} /></label>
                            </div>
                            <ChoiceControl id="vc-evenclean-kind" label="نوع الرسائل" options={[{ label: "جميع الرسائل", value: "all" }, { label: "تحتوي مرفقات", value: "attachments" }, { label: "تحتوي روابط", value: "links" }]} value={filters.media} onChange={(media: CleanupFilters["media"]) => edit({ media })} disabled={locked} />
                            <FormSwitch title="تضمين الرسائل المثبتة" value={filters.includePinned} onChange={includePinned => edit({ includePinned })} disabled={locked} hideBorder />
                        </div>
                    </details>
                    <div className="vc-evenclean-search-footer">
                        <ChoiceControl id="vc-evenclean-amount" label="عدد الرسائل" options={[{ label: "كل الرسائل", value: "all" }, { label: "عدد محدد", value: "custom" }]} value={filters.limit === 0 ? "all" : "custom"} onChange={value => edit({ limit: value === "all" ? 0 : 100 })} disabled={locked} />
                        {filters.limit !== 0 && <label className="vc-evenclean-field">العدد<TextInput type="number" min={1} step={1} value={filters.limit > 0 ? String(filters.limit) : ""} onChange={value => edit({ limit: /^\d+$/.test(value) ? Number(value) : -1 })} disabled={locked} /></label>}
                        <Button disabled={locked || !selected.size || unavailableCount > 0 || !Number.isSafeInteger(filters.limit) || filters.limit < 0} onClick={preview}>البحث عن رسائلي</Button>
                    </div>
                </section>
                <section ref={reviewRef} className="vc-evenclean-review" aria-label="مراجعة الرسائل">
                    <div className="vc-evenclean-section-heading">
                        <Heading tag="h3">الرسائل</Heading>
                        <span>{count} نتيجة</span>
                    </div>
                    {state.phase !== "idle" && <div className="vc-evenclean-status" data-phase={state.phase} role="status">
                        <div className="vc-evenclean-status-line">
                            <strong>{{ idle: "", previewing: "جارٍ البحث عن رسائلك…", review: "الرسائل جاهزة للمراجعة", deleting: "جارٍ حذف الرسائل…", paused: "متوقف مؤقتاً", done: "اكتمل حذف الدفعة", stopped: "تم الإيقاف", error: "تعذر إكمال العملية" }[state.phase]}</strong>
                            {state.mode === "delete" && <span>{completed} / {count}</span>}
                        </div>
                        {busy && <progress aria-label="تقدم العملية" value={state.mode === "delete" ? completed : undefined} max={Math.max(1, count)} />}
                        {busy && state.mode === "preview" && <p>المحادثة {state.targetIndex} من {state.targets.length}، الصفحة {state.page}</p>}
                        {state.waitUntil > clock ? <p>استئناف الطلبات خلال {Math.ceil((state.waitUntil - clock) / 1000)} ثانية.</p> : state.requestPending && <p>بانتظار استجابة Discord منذ {Math.max(0, Math.floor((clock - state.requestStartedAt) / 1000))} ثانية.</p>}
                        {state.mode === "delete" && <p>{state.deleted} محذوفة{state.missing > 0 ? `، ${state.missing} محذوفة مسبقاً` : ""}{state.skipped > 0 ? `، ${state.skipped} متجاوزة` : ""}</p>}
                        {busy && <div className="vc-evenclean-actions">
                            <Button size="small" variant="secondary" onClick={() => state.phase === "paused" ? cleaner.resume() : cleaner.pause()}>{state.phase === "paused" ? "استئناف" : "إيقاف مؤقت"}</Button>
                            {state.mode === "preview" && count > 0 && <Button size="small" variant="primary" onClick={() => cleaner.finishPreview()}>مراجعة النتائج</Button>}
                            <Button size="small" variant="dangerSecondary" onClick={() => cleaner.stop()}>إيقاف</Button>
                        </div>}
                        {busy && state.mode === "delete" && <p>لإيقاف الحذف، استخدم زر إيقاف قبل إغلاق النافذة.</p>}
                    </div>}
                    {state.limited && <Notice.Info>هذه نتائج جزئية. يمكنك مراجعتها أو تضييق الفلاتر والبحث مجدداً.</Notice.Info>}
                    {!busy && state.requestPending && <Notice.Warning>بانتظار تأكيد طلب حذف سابق من Discord قبل بدء عملية جديدة.</Notice.Warning>}
                    {count > 0 ? <>
                        <div className="vc-evenclean-preview-toolbar">
                            <FormSwitch title="إظهار نص الرسائل" value={reveal} onChange={setReveal} hideBorder />
                            <Button size="xs" variant="none" disabled={locked} onClick={invalidate}>مسح النتائج</Button>
                        </div>
                        <div className="vc-evenclean-messages">
                            {state.messages.slice(0, previewCount).map(message => <article key={message.id}>
                                <div className="vc-evenclean-message-meta"><time dateTime={message.timestamp}>{new Date(message.timestamp).toLocaleString("ar")}</time><Link href={`https://discord.com/channels/${state.targets.find(t => t.id === message.channelId)?.guildId ?? "@me"}/${message.channelId}/${message.id}`}>فتح الرسالة</Link></div>
                                <p dir="auto" data-hidden={!reveal}>{reveal ? message.content || "رسالة دون نص" : "نص الرسالة مخفي"}</p>
                                {(message.attachments > 0 || message.pinned) && <span className="vc-evenclean-muted">{message.attachments > 0 ? `${message.attachments} مرفقات` : ""}{message.pinned ? " · مثبتة" : ""}</span>}
                            </article>)}
                        </div>
                        <div className="vc-evenclean-preview-footer">
                            <span>{Math.min(count, previewCount)} من {count} رسالة</span>
                            {count > previewCount && <Button size="xs" variant="secondary" onClick={() => setPreviewCount(value => value + 100)}>عرض المزيد</Button>}
                            <Button size="xs" variant="none" disabled={busy || state.accountId !== UserStore.getCurrentUser()?.id} onClick={() => saveFile(new File([JSON.stringify({ product: "EvenCord EvenClean", exportedAt: new Date().toISOString(), accountId: state.accountId, targets: state.targets, messages: state.messages }, null, 2)], "evenclean-preview.json", { type: "application/json" }))}>تصدير النتائج</Button>
                        </div>
                    </> : <div className="vc-evenclean-empty">
                        <CleanupIcon width="40" height="40" />
                        <Heading tag="h3">{state.phase === "review" ? "لا توجد رسائل مطابقة" : busy ? "جارٍ تجهيز النتائج" : "رسائلك تظهر هنا"}</Heading>
                        <p>{state.phase === "review" ? "جرّب محادثة أخرى أو عدّل فلاتر البحث." : busy ? "ستظهر الرسائل التي يعثر عليها البحث تباعاً." : "حدد المحادثات ثم اضغط البحث عن رسائلي."}</p>
                    </div>}
                    {ready && <div className="vc-evenclean-confirm">
                        <Checkbox value={acknowledged} onChange={(_, checked) => setAcknowledged(checked)} size={20}>
                            <Paragraph>أوافق على حذف {count} رسالة نهائياً.</Paragraph>
                        </Checkbox>
                        <Button variant="dangerPrimary" disabled={!acknowledged} onClick={() => { void cleaner.remove(`DELETE ${count}`, acknowledged, settings.store.deleteDelay).catch(notifyError); }}>حذف {count} رسالة</Button>
                    </div>}
                </section>
            </div>
            <footer className="vc-evenclean-footer"><span>الحذف نهائي ويشمل رسائلك فقط.</span><Link href="https://support.discord.com/hc/en-us/articles/115002192352-Automated-User-Accounts-Self-Bots">سياسة Discord</Link></footer>
        </div>
    </Modal>;
}

export function openCleanup() {
    if (!isPluginEnabled("EvenClean")) { showToast({ text: "فعّل إضافة حذف الرسائل من إعدادات EvenCord أولاً.", variant: "critical" }); return; }
    if (modalKey) return;
    modalKey = openModal(props => <CleanupPanel {...props} />, { onCloseCallback: () => { modalKey = undefined; } });
}

export function closeCleanup() {
    if (modalKey) closeModal(modalKey);
    modalKey = undefined;
}
