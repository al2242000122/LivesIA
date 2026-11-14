# YouTube LIVE chat implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement task by task. Root coordinates isolated file ownership and final reviews.

**Goal:** Connect the selected owner's YouTube LIVE comments to the existing14 Minecraft commands with honest state, bounded work and zero comment TTS.

**Architecture:** A single server reader uses an OAuth read-only token provider and emits typed, ephemeral comment events over a dedicated SSE event. The existing rules/engine/render pipeline preserves YouTube authors and source. Google authorization stays in a local CLI helper and private files; the browser never receives credentials.

**Tech stack:** Node20+, fetch/AbortController, Canvas/SSE; Google auth library10.9.1 Apache-2.0 if required for OAuth, retaining Node20 support. Existing ElevenLabs remains independent.

**Spec:** `docs/block-wars/YOUTUBE_LIVE_SETUP.md`, `MINECRAFT_COMMANDS.md`, and the acceptance/interfaces below.

## Global constraints

- Preserve Snake, TikFinity, simulation, endless mining and all20internal effects/14featured commands.
- HTTP binds127.0.0.1; provider endpoints fixed HTTPS with redirects rejected; no browser-selected URL, credentials path or OAuth scope.
- Only `https://www.googleapis.com/auth/youtube.readonly`; no publishing, moderation, payment, or stream-start endpoint.
- Expected channel is the owner's existing Mina Infinita LIVE channel; selection is explicit by video ID, never the first available result.
- Credentials/refresh tokens/Voice ID remain outside Git; never open/print `.env.local`. Tests use fixtures and never real credentials, TTS or remote chat.
- Source YouTube currently accepts only `textMessageEvent`. Likes/subscribers remain separate, unimplemented real-data circuits.
- Initial chat history never activates commands. Keep generation/cursor/dedupe across reconnection, discard stale comments and bound memory/work.
- State labels distinguish configuration, waiting for LIVE, synchronization, connected, reconnecting and ended/error. No false LIVE/monetization claims.

## Interfaces agreed for implementation

Reader module `lib/youtube-chat.js` exports `createYouTubeChat(options)`:

```js
const reader = createYouTubeChat({
  fetchImpl, getAccessToken, expectedChannelId,
  onEvent, onState, now, timers, random,
  quotaLimit:8000, minPollMs:15000, idleTimeoutMs:90000
});
// getAccessToken({signal}) -> Promise<string>; never serialized to UI.
// reader.select(videoId) -> Promise<boolean>: starts one cancellable selected session.
// reader.broadcasts() -> Promise<Array<{id,title,privacy,status}>>: own broadcasts only.
// reader.stop() -> void; reader.status() -> safe state/counts without secrets or identities.
```

Typed comment delivered to `onEvent` (the strings below are fictitious examples):

```json
{"type":"comment","source":"youtube","id":"yt:opaque-message-digest","receivedAt":1,"actor":{"displayName":"Minero demo","stableHash":"ephemeral-actor-digest"},"data":{"text":"RAIN"}}
```

Never send raw channel IDs, avatars, channel URLs or OAuth tokens to the game. Salted actor digests are process-local; messages/names are transient and not logged. Source is assigned by the server reader; `/api/command` continues forcing simulation.

SSE event names: `youtube_comment` for the typed comment, `youtube_state` for the reader status. Transport callbacks: `onEvent(event)` for comments, `onYouTubeState(state)` for state. Snake ignores both.

Server routes:

- `GET /api/youtube/status`: safe reader/auth status; no token, client secret or raw actor data.
- `GET /api/youtube/broadcasts`: explicit own-broadcast lookup; caller origin/host guards retained.
- `POST /api/youtube/select` with exactly `{videoId}`: fixed11ASCII-character video ID; no URL or scope parameter.
- `POST /api/youtube/stop` with `{}`: stops reader and pending timers; never starts/stops a YouTube broadcast.

OAuth module `lib/youtube-auth.js` exports `createYouTubeAuth({env,fetchImpl,now,...fixtures})`, whose public runtime interface is `getAccessToken({signal})` and safe `status()`. Missing explicit auth-file configuration remains disabled, including in server tests. Local helper `scripts/connect-youtube.cjs` owns initial PKCE/state/loopback authorization and private credential storage.

## Task 1 — OAuth and private local configuration

**Ownership:** auth worker: new auth module/helper/tests and package/lock if an official auth dependency is used. Root owns Cloud UI and permission requests.

- [x] Read official installed-app OAuth/PKCE/loopback/refresh documentation. Pin compatible library version, review license, lifecycle scripts and advisory audit.
- [x] Write fixture tests for missing config, valid refresh, coalesced refresh, expiry, denied/invalid scope, redirect rejection and error secrecy.
- [x] Verify those tests fail before implementation.
- [x] Implement read-only OAuth using fixed Google endpoints, request time/byte limits, no raw provider errors, no secrets in logs or browser routes.
- [x] Initial authorization binds127.0.0.1 with random state and PKCE; validate callback method/path/Host/state and bound code length; close after one exchange or timeout. Credential JSON is private and outside Git, atomically written.
- [x] Tests assert a forged callback cannot exchange a code or overwrite credentials. Tests never use the owner's file; recursive temp cleanup verifies its absolute target stays under its own temp root.
- [x] Run auth tests, syntax, dependency audit and report exact runtime interface to root. Do not create credentials, authorize a real account or commit shared work.

## Task 2 — Official chat reader and bounded stream parser

**Ownership:** reader worker: `lib/youtube-chat.js`, optional focused parser module, `tests/youtube-chat.test.cjs` and parser fixtures/tests only.

- [x] Write failing tests using actual official response field shapes for owner broadcasts, video/channel verification and absent activeLiveChatId.
- [x] Implement fixed-endpoint GETs with partial fields, cancellation, bounded responses, explicit video selection and quota accounting; no network during tests.
- [x] Discover chat only from the verified selected video. Before it is active, show waiting state and poll discovery slowly; existence of a broadcast chat ID alone is insufficient.
- [x] Implement incremental HTTP JSON-array framing for `https://youtube.googleapis.com/youtube/v3/liveChat/messages/stream`; do not assume SSE/NDJSON. Test UTF8/chunk/escape boundaries, oversized frames, excessive depth and provider error objects.
- [x] Discard first history batch; retain cursor/dedupe across reconnects. On selection change, abort old work and reject all callbacks from the old generation. Drop stale/future-invalid messages, non-comment types, malformed names/IDs, and overflow rather than queuing delayed commands.
- [x] Fallback to official `liveChatMessages.list` if framing/stream transport is unsupported. Respect both15s local minimum and `pollingIntervalMillis`; stop on terminal quota/auth/chat-disabled/end states. Use bounded exponential backoff with jitter for transient errors.
- [x] Assert history/duplicates emit0events, selected fresh `RAIN` emits exactly one opaque typed event, wrong channel emits0events, and concurrent selections never mix authors/chats.
- [x] Run reader/parser tests, syntax and report counters/limits/status schema. Do not call a real authenticated API or commit shared work.

## Task 3 — Preserve source through transport, rules, engine and UI

**Ownership:** source/UI worker: integrations/events.js, integrations/transport.js, games/block-wars/{rules,engine,experience,app,audio,control,index.html,control.html} and their focused existing tests. Root owns lib/contracts.js and server routes.

- [x] Add failing regressions for a typed YouTube comment across transport→rules→engine→activation/impact UI, while Snake ignores it.
- [x] Add a strict YouTube normalizer; accept only the server SSE comment channel. Preserve opaque actor/message digests. Simulator HTTP controls cannot claim that source.
- [x] Replace source ternaries and hard-coded two-source totals/drains with explicit source maps/iteration; preserve previous-source fairness and all existing behavior.
- [x] Preserve source/name/action ID through delayed entities, weather and impacts. Do not convert YouTube to automatic or TikFinity.
- [x] All YouTube comment actions have `narrate:false` and retain FX, even with real TTS configured. New TTS reward kinds remain simulator-only.
- [x] Add `onYouTubeState` handling and clear viewer labels for waiting/disconnected states. Expose selection/status in the operator panel, keeping it outside OBS capture. Never claim real likes/subscribers or invent viewers.
- [x] Run source/rules/engine/experience/UI/audio/Snake regressions. Use fixture sources, no actual keys or network. Coordinate callback/state shape with root; do not commit shared work.

## Task 4 — Root server integration and final verification

**Ownership:** root: server.js, lib/contracts.js, new server integration tests, docs/Cloud setup and final commit/PR.

- [ ] Capture baseline229tests/52syntax and ledger evidence before changes.
- [ ] Add typed routes under existing same-origin/host/body guards and broadcast only server-generated comments/states. Keep status free of identities/secrets and close slow SSE clients if bounded buffers overflow.
- [ ] Wire one reader to the auth provider; include initial safe state on new SSE connections, never replay old comments. Close reader/auth timers on server shutdown.
- [ ] New telemetry source `youtube` is allowed; command controls remain forced simulator. Test unauthorized origins, malformed video ID/body, missing auth and no token exposure.
- [ ] Run full tests, syntax, npm audit and offline long-duration reader/reconnection tests. Stage only owned files; run independent security, logic and quality reviews.
- [ ] Prepare the Cloud OAuth form and ask for confirmation at the actual credential/grant step. Never automate passwords or bypass an unverified-app/security warning. No paid resources or public OAuth publication.
- [ ] Only after permission, configure private client/token files and validate owner/channel metadata. Before an authorized LIVE exists, report waiting rather than verified chat.
- [ ] Commit on `codex/youtube-live-chat`, open a draft PR against `codex/elevenlabs-youtube-onboarding`, attach it and inspect CI for the exact head. Keep main unchanged.

## Acceptance boundaries

Offline acceptance requires the14commands end-to-end with correct YouTube author/source, bounded state under bursts and reconnects, no history activation, no comment TTS, no secrets and unchanged prior-source regressions. Real integration is accepted separately only after an authorized unlisted LIVE delivers an actual fresh viewer command into OBS. Starting any stream and the120minute real OBS rehearsal remain separate operator-approved steps; neither is implied by creating OAuth credentials.
