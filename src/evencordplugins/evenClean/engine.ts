/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface CleanupTarget { id: string; label: string; guildId?: string; }
export interface CleanupFilters { contains: string; after: string; before: string; media: "all" | "attachments" | "links"; includePinned: boolean; limit: number; }
export interface CleanupMessage { id: string; channelId: string; authorId: string; content: string; timestamp: string; attachments: number; pinned: boolean; }
export interface CleanupState {
    phase: "idle" | "previewing" | "review" | "deleting" | "paused" | "done" | "stopped" | "error";
    mode: "preview" | "delete";
    messages: CleanupMessage[];
    targets: CleanupTarget[];
    accountId: string;
    deleted: number;
    missing: number;
    skipped: number;
    scanned: number;
    limited: boolean;
    waitUntil: number;
    detail: string;
    error: string;
    filters?: CleanupFilters;
}
interface Dependencies {
    request(method: "get" | "del", url: string, query?: Record<string, string>): Promise<unknown>;
    currentUser(): string | undefined;
    canAccess(channelId: string): boolean;
    sleep?(ms: number): Promise<void>;
    now?(): number;
}

const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === "object" ? value as Record<string, unknown> : {};
const validId = (value: unknown): value is string => typeof value === "string" && /^\d{17,20}$/.test(value);
const number = (value: unknown) => typeof value === "number" || typeof value === "string" ? Number(value) : NaN;
const initial = (): CleanupState => ({ phase: "idle", mode: "preview", messages: [], targets: [], accountId: "", deleted: 0, missing: 0, skipped: 0, scanned: 0, limited: false, waitUntil: 0, detail: "Choose channels and preview your messages first.", error: "" });
const stopped = new Error("Stopped by user.");

function header(response: Record<string, unknown>, name: string): string {
    const { headers } = response;
    if (typeof Headers !== "undefined" && headers instanceof Headers) return headers.get(name) ?? "";
    for (const [key, value] of Object.entries(record(headers))) if (key.toLowerCase() === name) return String(value);
    return "";
}

export function createCleaner(deps: Dependencies) {
    const sleep = deps.sleep ?? (ms => new Promise<void>(resolve => setTimeout(resolve, ms)));
    const now = deps.now ?? Date.now;
    const listeners = new Set<() => void>();
    let state = initial();
    let running = false;
    let cancelled = false;
    let paused = false;
    let nextRequestAt = 0;
    let deleteDelay = 1500;
    let minimumDeleteDelay = 1500;
    let successfulDeletes = 0;
    let planAt = 0;
    let forgetOnStop = false;
    let approvedFilters: CleanupFilters | undefined;
    const set = (update: Partial<CleanupState>) => { state = { ...state, ...update }; listeners.forEach(fn => fn()); };
    const active = () => {
        if (cancelled) throw stopped;
        if (!state.accountId || deps.currentUser() !== state.accountId) { forgetOnStop = true; throw new Error("Your Discord account changed. Start a new preview."); }
    };
    async function gate() {
        active();
        while (paused) { await sleep(200); active(); }
    }
    async function wait(until: number, reason: string) {
        if (now() < until) set({ waitUntil: until, detail: reason });
        while (now() < until) {
            await gate();
            await sleep(Math.min(500, Math.max(1, until - now())));
        }
        await gate();
        set({ waitUntil: 0 });
    }
    function cooldown(response: Record<string, unknown>, limited: boolean) {
        const body = record(response.body);
        const waits = [number(body.retry_after), number(header(response, "retry-after"))];
        if (header(response, "x-ratelimit-remaining") === "0") {
            waits.push(number(header(response, "x-ratelimit-reset-after")));
            const reset = number(header(response, "x-ratelimit-reset"));
            if (Number.isFinite(reset) && reset > 0) waits.push(reset - now() / 1000);
        }
        const retryHeader = header(response, "retry-after");
        if (retryHeader && !Number.isFinite(Number(retryHeader))) waits.push((Date.parse(retryHeader) - now()) / 1000);
        const seconds = Math.max(0, ...waits.filter(n => Number.isFinite(n) && n > 0));
        if (limited || seconds > 0) {
            const delay = Math.max(limited ? 2000 : 0, seconds * 1000) + 250;
            nextRequestAt = Math.max(nextRequestAt, now() + delay);
            if (limited) { deleteDelay = Math.max(deleteDelay, Math.min(60000, delay)); successfulDeletes = 0; }
        }
    }
    async function request(method: "get" | "del", url: string, query: Record<string, string> | undefined, spacing: number) {
        for (let attempt = 0; attempt < 4; attempt++) {
            await gate();
            await wait(nextRequestAt, "Waiting for Discord's request cooldown.");
            let response: Record<string, unknown>;
            try { response = record(await deps.request(method, url, query)); }
            catch (error) {
                const raw = record(error);
                response = { ...raw, ...record(raw.response) };
                if (!response.status && !response.statusCode) response.status = 0;
            }
            active();
            const status = number(response.status ?? response.statusCode ?? 200);
            cooldown(response, status === 429);
            nextRequestAt = Math.max(nextRequestAt, now() + spacing);
            if (status >= 200 && status < 300 && status !== 202) return response;
            if (status === 401) throw new Error("Discord rejected this session. Cleanup stopped; sign in normally before trying again.");
            if (status === 403) throw new Error("Access was denied. Cleanup stopped without retrying the forbidden request.");
            if (status === 404 && method === "del") return { ...response, missing: true };
            if (status === 400 && record(response.body).code === 50083) return { ...response, archived: true };
            const retry = status === 429 || status === 202 || status === 0 || status >= 500;
            if (!retry) throw new Error(`Discord returned HTTP ${Number.isFinite(status) ? status : "unknown"}. Cleanup stopped.`);
            if (status === 429 || status === 202) {
                if (status === 202) nextRequestAt = Math.max(nextRequestAt, now() + 10000);
                set({ detail: status === 429 ? "Discord requested a cooldown. All EvenClean requests are waiting." : "Discord is building its search index. Waiting before retrying." });
            } else nextRequestAt = Math.max(nextRequestAt, now() + Math.min(30000, 2000 * 2 ** attempt));
            if (attempt === 3) throw new Error("Discord is still rate limited, indexing or unavailable after four attempts. No further requests will be sent. Wait, then create a fresh preview.");
        }
        throw new Error("Request could not complete.");
    }
    async function work(task: () => Promise<void>) {
        if (running) throw new Error("A cleanup operation is already running.");
        running = true; cancelled = paused = false;
        try { await task(); }
        catch (error) {
            set({ phase: error === stopped ? "stopped" : "error", waitUntil: 0, error: error === stopped ? "" : error instanceof Error ? error.message : "Cleanup failed.", detail: error === stopped ? "Stopped. A request already in flight may have completed." : "No further requests will be sent." });
        } finally { running = false; paused = false; if (forgetOnStop) { approvedFilters = undefined; forgetOnStop = false; set(initial()); } else set({}); }
    }

    return {
        snapshot: () => state,
        subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
        busy: () => running,
        pause() { if (running && !paused) { paused = true; set({ phase: "paused", detail: "Paused. A request already in flight may finish." }); } },
        resume() { if (running && paused) { paused = false; set({ phase: state.mode === "preview" ? "previewing" : "deleting", detail: "Resuming with the existing request cooldown." }); } },
        stop() { if (running) { cancelled = true; paused = false; set({ detail: "Stopping after any request already in flight." }); } },
        dispose() { approvedFilters = undefined; if (running) { forgetOnStop = true; cancelled = true; paused = false; } else set(initial()); },
        clear() { if (running) return; approvedFilters = undefined; set(initial()); },
        preview(targets: CleanupTarget[], filters: CleanupFilters) {
            return work(async () => {
                const accountId = deps.currentUser();
                if (!accountId || !validId(accountId)) throw new Error("Sign in normally before creating a preview.");
                if (targets.length < 1 || targets.length > 100 || new Set(targets.map(t => t.id)).size !== targets.length || targets.some(t => !validId(t.id) || !deps.canAccess(t.id))) throw new Error("Select between 1 and 100 accessible channels.");
                if (!Number.isInteger(filters.limit) || filters.limit < 1 || filters.limit > 5000) throw new Error("Preview batches must contain between 1 and 5000 messages.");
                const after = filters.after ? Date.parse(filters.after) : 0;
                const before = filters.before ? Date.parse(filters.before) : now();
                if (!Number.isFinite(after) || !Number.isFinite(before) || before <= after) throw new Error("Choose a valid date range with the end after the start.");
                const snowflake = (time: number) => ((BigInt(Math.max(1420070400000, Math.floor(time))) - 1420070400000n) << 22n).toString();
                approvedFilters = { ...filters }; planAt = now();
                set({ ...initial(), phase: "previewing", mode: "preview", accountId, filters: { ...filters }, targets: targets.map(t => ({ ...t })), detail: "Searching only messages authored by your signed-in account." });
                const found: CleanupMessage[] = [], seen = new Set<string>();
                for (const target of targets) {
                    let cursor = snowflake(before), emptyPages = 0;
                    for (let page = 0; page < 200; page++) {
                        await gate();
                        if (!deps.canAccess(target.id)) throw new Error("Channel permissions changed. Start a new preview after checking access.");
                        const query: Record<string, string> = { author_id: accountId, sort_by: "timestamp", sort_order: "desc", offset: "0", max_id: cursor };
                        if (after) query.min_id = snowflake(after);
                        if (target.guildId) query.channel_id = target.id;
                        const url = target.guildId ? `/guilds/${target.guildId}/messages/search` : `/channels/${target.id}/messages/search`;
                        set({ detail: `Searching ${target.label}.`, scanned: state.scanned + 1 });
                        const response = await request("get", url, query, 10000);
                        const body = record(response.body);
                        if (!Array.isArray(body.messages)) throw new Error("Discord returned an unsupported search response. Nothing was deleted.");
                        const hits = body.messages.flatMap(group => Array.isArray(group) ? group.map(record).filter(m => m.hit === true) : []);
                        if (!hits.length) {
                            if (number(body.total_results) > 0 && emptyPages++ < 2) continue;
                            if (number(body.total_results) > 0) throw new Error("Search results are still updating. Wait and create a new preview.");
                            break;
                        }
                        emptyPages = 0;
                        let nextCursor = BigInt(cursor);
                        for (const raw of hits) {
                            if (!validId(raw.id)) continue;
                            if (BigInt(raw.id) < nextCursor) nextCursor = BigInt(raw.id);
                            if (seen.has(raw.id)) continue;
                            seen.add(raw.id);
                            const author = record(raw.author);
                            if (author.id !== accountId || raw.channel_id !== target.id || (raw.type !== 0 && raw.type !== 19) || (!filters.includePinned && raw.pinned === true)) continue;
                            const content = typeof raw.content === "string" ? raw.content : "";
                            const attachments = Array.isArray(raw.attachments) ? raw.attachments.length : 0;
                            if (filters.contains && !content.toLocaleLowerCase().includes(filters.contains.toLocaleLowerCase())) continue;
                            if (filters.media === "attachments" && !attachments) continue;
                            if (filters.media === "links" && !/https?:\/\//i.test(content)) continue;
                            const time = Number((BigInt(raw.id) >> 22n) + 1420070400000n);
                            if (time < after || time >= before) continue;
                            found.push({ id: raw.id, channelId: target.id, authorId: accountId, content: content.slice(0, 4000), timestamp: new Date(time).toISOString(), attachments, pinned: raw.pinned === true });
                            if (found.length >= filters.limit) break;
                        }
                        set({ messages: [...found] });
                        if (found.length >= filters.limit) { set({ limited: true }); break; }
                        if (nextCursor === BigInt(cursor) && hits.every(m => m.id === cursor && seen.has(cursor))) break;
                        if (nextCursor >= BigInt(cursor)) throw new Error("Search stopped advancing. Cleanup stopped instead of repeating requests.");
                        cursor = nextCursor.toString();
                        if (page === 199) throw new Error("This preview reached its search-page limit. Narrow the date range and try again.");
                    }
                    if (found.length >= filters.limit) break;
                }
                await gate();
                set({ phase: "review", detail: found.length ? "Review this fixed batch. Only the listed message IDs can be deleted." : "No matching own messages were found. Nothing was deleted.", waitUntil: 0 });
            });
        },
        remove(confirmation: string, acknowledged: boolean, delay: number) {
            if (state.phase !== "review" || !state.messages.length || !approvedFilters) return Promise.resolve();
            if (confirmation !== `DELETE ${state.messages.length}` || !acknowledged) return Promise.resolve();
            return work(async () => {
                active();
                if (now() - planAt > 15 * 60 * 1000) throw new Error("This preview is older than 15 minutes. Create a fresh preview before deleting.");
                minimumDeleteDelay = Math.min(30000, Number.isFinite(delay) ? Math.max(1000, delay) : 1500);
                deleteDelay = Math.max(deleteDelay, minimumDeleteDelay);
                const plan = state.messages.map(m => ({ ...m }));
                const archivedChannels = new Set<string>();
                set({ phase: "deleting", mode: "delete", detail: "Deleting only the confirmed batch of your own messages." });
                for (const message of plan) {
                    await gate();
                    if (message.authorId !== state.accountId || !deps.canAccess(message.channelId)) throw new Error("Message ownership or channel access no longer matches the approved preview.");
                    if (archivedChannels.has(message.channelId)) { set({ skipped: state.skipped + 1 }); continue; }
                    const response = await request("del", `/channels/${message.channelId}/messages/${message.id}`, undefined, deleteDelay);
                    if (response.archived) { archivedChannels.add(message.channelId); set({ skipped: state.skipped + 1, detail: "Skipped an archived thread without modifying it or retrying its other messages." }); }
                    else if (response.missing) set({ missing: state.missing + 1, detail: "A message was already missing; it was not retried." });
                    else { set({ deleted: state.deleted + 1, detail: "Deleted a confirmed own message." }); successfulDeletes++; }
                    if (successfulDeletes >= 10) { deleteDelay = Math.max(minimumDeleteDelay, Math.ceil(deleteDelay * 0.85)); successfulDeletes = 0; }
                }
                set({ phase: "done", waitUntil: 0, detail: "Confirmed batch finished. No new messages were searched for or deleted." });
            });
        }
    };
}
