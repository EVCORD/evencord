# EvenClean

An EvenCord message-cleanup plugin for previewing and removing your own messages. Disabled by default. It never starts a job when Discord launches.

## Use

1. Enable EvenClean in the plugin manager. Open it from its settings, Toolbox or the top-header trash button near the Inbox actions.
2. Choose This chat, Direct messages or Server channels. Select a server by name, search conversations, then click the conversations to include. Review the selected list before previewing. Changing the target type or server clears the selection. Optional filters cover text, dates, attachments and links. Messages pinned at preview time are excluded by default. The approved batch is a snapshot; later edits or pin changes do not change its IDs.
3. Click Find my messages. The default batch is 100 messages, with an optional maximum of 5,000 and a 20-page search budget across all selected conversations. Preview only searches. Watch the page/response timer and cooldown countdown. Review results now ends searching after the current page and opens the partial batch for confirmation. Check the results, optionally reveal message text, or explicitly export the local preview JSON to inspect every ID.
4. Acknowledge the permanent-deletion/account-automation warning and type the exact `DELETE <count>` phrase. Only the fixed list of your own message IDs in that preview can be removed.
5. Pause, resume or stop from the panel. Requests have a 30-second deadline. After a timeout or Stop, an unresolved native REST request blocks new work until it settles; it cannot silently overlap another job. A late response cannot modify the abandoned preview, and an already-issued deletion may still complete. Closing the panel leaves an active job running; reopen it from the toolbar. An already-issued request cannot be recalled. Disabling the plugin or logging out stops new work and forgets the in-memory preview.

Choose a 1.5, 3 or 5-second minimum deletion pace in the plugin settings. Search pages have an additional ten-second local pause to avoid repeatedly querying a changing index. These are conservative local pacing choices, not assumptions about Discord's server limits.

## Rate limits and failures

Requests use the existing authenticated Discord REST client with ordinary retries disabled. No account token is extracted, entered, saved or exported. There is one operation and one request at a time. The native client's own queue remains in use.

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
