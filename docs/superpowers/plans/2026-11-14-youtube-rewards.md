# YouTube individual rewards implementation plan

> For agentic workers: use subagent-driven-development task by task.

**Goal:** Each detected +1 net like causes TNT; each detected new public subscriber causes named NUKE and typed ElevenLabs narration.
**Architecture:** Reuse official read-only auth, owned LIVE selection, request bounds/quota and cancellation of youtube-chat. A pure tracker establishes baselines, deduplicates and issues short-lived voice grants. Dedicated SSE reward channel passes a strict schema to an independently bounded frontend reward queue; comments keep their current rules.
**Tech:** Node20+, node:test, Canvas2D, existing ElevenLabs SDK. No new dependency.
**Spec:** Owner approved +1 net detected like (anonymous) and new public subscriber (named), 2026-11-14. API limits: total likes only, public subscribers only, eventual updates; no retrospective rewards at first connection.

## Constraints
- Do not stop current unlisted LIVE. Work in codex/youtube-like-sub-rewards; PR based on PR18, no main changes.
- No credential logging/inspection or broader OAuth scope. Fixed official HTTPS endpoints, common quota and bounded responses. Keep source simulator distinct.
- Reward wire: {type:'like'|'subscriber',source:'youtube',id:'ytr:'+32hex,receivedAt:integer,actor:{displayName:<=44 printable codepoints,stableHash:32hex},data:{delta:1} for like, {} for subscriber}. Like actor displayName empty; subscriber nonempty. IDs opaque.
- Frontend accepted reward: like→tnt, subscriber→nuke; speechKind like_milestone or youtube_subscriber. Audio id remains wire id so server can authorize speech only for a detected reward. Plain comments never narrate.
- Voice name: shared existing audio normalization (letters/marks/numbers/space/_/-, trim24); empty fallback permitted only when derived sanitizer returns empty. No arbitrary text to TTS.

## Task1: frontend rewards (worker)
Files integrations/events.js, transport.js, games/block-wars experience.js, audio.js, app.js,index.html,style.css; matching frontend tests only. Add failing tests for dedicated channel/schema spoof guards, one TNT for one like, named triple NUKE for subscriber, queue cap/expiry/pause, actual attribution/voice id. Implement isolated queue capped64, .25s spacing,30s expiry, subscriber priority. Retain old simulation/TikFinity/Snake behavior. Restore status-aware LIKE→TNT/SUB→NUKE callout; no claims all private subscriptions or individual liker names visible. Exact reward speech ids retained; exceptions/errors cannot crash play. Stage own changes, report tests; no commit until parent reviews.

## Task2: official reader/tracker/server/speech (parent)
Create lib/youtube-rewards.js pure tracker and tests first. Like baseline ignores existing, high-water prevents repeated unlike/re-like rewards; bounded per-sample200 and cumulative limits explicit. Subscriber baseline ignores existing, timestamp cutoff suppresses old newly-public subscriptions; unique channel per session, cap5000 identities. Grants max256/120s, fixed typed name/kind. Reader polling likes15s, subscribers60s through shared bounded json/quota, only after owner and live verified; tests opt-in rewardsEnabled. Stop/change/error invalidates loops/grants. SSE youtube_reward, safe reward status in existing status. Speech server rejects forged YouTube grant even if payload valid; simulator types preserved. No real TTS before concrete small test if required by prior approval policy.

## Task3: integrate, review, release
Run syntax/full310+ tests (concurrency2), six-hour virtual soak, reward burst/cancel tests. Independent security/logic/quality reviews; fix findings. Document delays, missing private subs, net likes/high-water limits and rollback. Create draft PR, deploy code to original rehearsal branch, restart own server only, select same live only if unlisted/live, refresh OBS and enable audio. Read-only official probe first baseline; mark real new event unverified until observed. Leave LIVE running.
