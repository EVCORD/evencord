# حذف الرسائل | EvenClean

An EvenCord message-deletion plugin for previewing and removing your own messages. Disabled by default. It never starts a job when Discord launches.

## Use

1. Enable EvenClean in the plugin manager. Open it from its settings, Toolbox or the top-header trash button near the Inbox actions.
2. Choose This chat, Direct messages or Server channels. Select a server by name, search conversations, then click the conversations to include. Review the selected list before previewing. Changing the target type or server clears the selection. Optional filters cover text, dates, attachments and links. Messages pinned at preview time are excluded by default. The approved batch is a snapshot; later edits or pin changes do not change its IDs.
3. Click Find my messages. The default batch is 100 messages, with an optional maximum of 5,000, a 20-page search budget and a 90-second search deadline excluding manual pauses. Preview only searches. Watch the page/response timer and cooldown countdown. Review results now ends searching without waiting for a pending response and opens the partial batch for confirmation. Search failures retain matches already found. Check the results, optionally reveal message text, or explicitly export the local preview JSON to inspect every ID.
4. Check the permanent-deletion confirmation box, then click the Delete button showing the reviewed message count. No typed phrase or count is required. Only the fixed list of your own message IDs in that preview can be removed.
5. Pause, resume or stop from the panel. Requests have a 30-second deadline. After a search timeout, Stop or Review, an unresolved read no longer locks the panel. The native client cannot recall that read; its late response cannot modify the abandoned preview, but any returned cooldown remains respected. An unresolved deletion continues to block new work until it settles, because an already-issued deletion may still complete. Closing the panel leaves an active job running; reopen it from the toolbar. Disabling the plugin or logging out stops new work and forgets the in-memory preview.

Choose a 1.5, 3 or 5-second minimum deletion pace in the plugin settings. Search pages have an additional three-second local pause. These are local pacing choices, not assumptions about Discord's server limits. Discord-requested cooldowns take precedence.

## Rate limits and failures

Requests use the existing authenticated Discord REST client with ordinary retries disabled. No account token is extracted, entered, saved or exported. There is one active operation at a time; an abandoned read may still be pending in the native queue, but deletion requests never overlap. The native client's own queue remains in use.

When exposed by the REST client, `Retry-After`, fractional `retry_after`, rate-limit remaining/reset headers and HTTP dates determine a minimum wait with a safety margin. A 429 blocks all EvenClean work until that wait expires. Starting another preview does not clear the cooldown. Backoff grows on throttling and recovers gradually without dropping below the user's selected minimum.

401/403 stop the job without repeated forbidden requests. Missing messages are not repeatedly deleted; archived threads are skipped without reopening them. Transient errors, indexing responses and 429 retries are bounded. Stale/non-advancing search results stop instead of looping indefinitely. A job can stop after partial deletion; messages already deleted cannot be recovered. Re-preview after checking the error.

Discord's [rate-limit documentation](https://docs.discord.com/developers/topics/rate-limits) describes the response fields. Respecting those limits does **not** make user-account automation permitted or ban-proof. Discord's [automated-user-account policy](https://support.discord.com/hc/en-us/articles/115002192352-Automated-User-Accounts-Self-Bots) applies independently of pacing.

## Boundaries and privacy

- Only the currently signed-in account's ordinary messages and replies are eligible, even if that account can moderate other users. Ownership is checked against search results locally as well as through the author query.
- Only currently loaded, accessible channels are supported. There is no hidden-channel access, token import, thread unlocking, account rotation, proxy rotation or access-control bypass.
- Previews are fixed batches, expire after 15 minutes and exclude messages posted after preview started. Review another batch to continue. Search indexing may delay or omit results; this is not a complete-history guarantee.
- The first version does not import Discord data packages, schedule unattended jobs, export complete channel history, edit messages or remove reactions.
- Previews and status stay in memory; no message content is persisted automatically or uploaded. Explicit JSON exports contain private text and IDs, with message text limited to 4,000 characters per preview item. Hide-text mode does not hide channel names elsewhere in the window.
- Deleting a Discord message cannot erase screenshots, prior exports or other people's message logs.
- A running job cannot survive Discord restarting. Authentication changes stop work and discard the previous account's preview. User settings, other plugins and Discord profiles are untouched.

## References and attribution

The functional references are [Nanda070/rmcord](https://github.com/Nanda070/rmcord/tree/2e824c4a3a3f7ce5ab6b781fbf33373eccefcdf0), whose reviewed source carries GPL-3.0-or-later notices, and the published feature descriptions of [Discrub](https://github.com/pratherbytecraft/discrub). EvenClean's reviewed-batch engine and native-modal interface are independently implemented for EvenCord.

Discrub's current [license](https://github.com/pratherbytecraft/discrub/blob/f8bb8ed5f9732eb19ea67779cb13e0c385b4e26d/LICENSE) reserves reuse and modification rights. No Discrub source, assets or branding are copied or included. No affiliation or endorsement is implied. EvenClean's source uses the project's GPL-3.0-or-later license and preserves upstream framework notices.

Development validation uses synthetic messages and mocked requests for confirmation, ownership, 429 cooldowns, account changes and cancellation. No real messages were searched or deleted during development; live Discord search/cleanup behavior still needs manual validation.
