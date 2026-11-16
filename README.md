# Infinite Mine LIVE / LivesIA

An interactive vertical mining game for YouTube LIVE, with an endless bouncing pickaxe, Minecraft-style blocks, real chat commands and a separate local operator console. The original Infinite Snake game remains available.

The public experience and operator panels use English. Existing Spanish command aliases remain compatible. Historical design and rehearsal documents are retained in their original language; the [previous Spanish guide](README.es.md) is preserved for reference.

## Run locally

Requires Node.js20.12+ when loading local configuration, or Node.js20+ for direct server execution.

```powershell
npm ci --ignore-scripts
npm start
```

- Mine: http://127.0.0.1:4173/block-wars?platform=youtube
- Mine controls: http://127.0.0.1:4173/block-wars/control?platform=youtube
- Original Snake: http://127.0.0.1:4173/
- Snake controls: http://127.0.0.1:4173/control

The server listens only on127.0.0.1 by default. Keep operator panels out of broadcasts and never expose the local port through a public tunnel. `npm start` loads an ignored `.env.local`, if present; never open, print, commit or share that file. Tests start `node server.js` directly without loading local credentials.

In OBS, capture the mine as a720×1280 browser source. Keep the source active and use Interact → ENABLE SOUND. Music, effects and narration have separate volume controls. This does not start a broadcast.

## Audience interaction

Free commands: **TNT, RAIN, THUNDER, STORM, CREEPER, METEOR, FIRE, TSUNAMI, SPIN, FAST, MEGA, NUKE, ARROW, BIG,67, MESSI, SIUUU**. RAIN spawns12 temporary pickaxes for10seconds. MESSI has no dedicated audio;67 and SIUUU use local clips rather than TTS. Endless mining never ends or resets on a round timer.

Viewer commands can overlap. Commands waiting for active capacity enter a FIFO; reception is distinct from effect activation. Active bodies, particles and drawing work remain bounded. Transport validation, deduplication and moderation remain enabled.

Legacy tool commands include `!pick`, `!wood`, `!stone`, `!gold`, `!diamond` and `!netherite`. Spanish aliases still share the same voting and cooldown state. Snake supports both `!apple` and `!manzana`.

## YouTube integration and limits

The official server-side reader uses OAuth with **youtube.readonly** only. Select an owned broadcast explicitly in the local panel. Initial chat history is discarded, so commands must be sent after connection.

- Each detected net like increase launches **3 ULTRANUKE charges**. YouTube does not reveal who liked the stream.
- Each detected new public subscriber launches **10 ULTRANUKE charges**, an attributed visual alert and optional narration.
- Like/subscriber counts can update with delays. Private subscriptions cannot be detected. A like removed and restored between two samples cannot be reconstructed.
- English ElevenLabs templates are limited initially to likes and subscribers. Ordinary YouTube chat commands have effects and sound without narration. Credentials stay on the server; real reward voice requests require a one-use server grant and retain time, size and character budgets.

Offline tests do not verify a real subscriber, a voice heard in OBS or an extended live broadcast. Monetization, paid gifts and TikTok account eligibility are separate and are not claimed as ready.

## Local assets

The owner authorized local Minecraft resource import. Importers download pinned sources and verify integrity; they never execute the client JAR. Resources remain ignored by Git and must not be distributed in commits.

```powershell
python scripts/import_minecraft.py
python scripts/import_minecraft_sounds.py
```

Additional ULTRANUKE/mod textures and meme clips use separate local folders; see [ULTRANUKE setup](docs/block-wars/ULTRANUKE_AND_MEME_COMMANDS.md). The active music loop uses the owner-supplied04–20second excerpt; the earlier music remains a separate local backup. Missing imported assets use clearly labelled fallback art. Local import does not establish commercial permission. This independent game is not an official Minecraft product and is not approved by or associated with Mojang or Microsoft.

## Verify

```powershell
npm run check
npm test
npm run test:endless-soak
```

The endless soak covers six virtual hours, not six real hours of OBS. Tests cover both games, physics, real HTTP/SSE processes, event provenance, queued commands, aliases and reward/TTS security using fixtures.

## Project references

- [English launch and branding changes](docs/block-wars/ENGLISH_LAUNCH_2026-11-15.md)
- [Current LIVE feedback and command FIFO](docs/block-wars/LIVE_FEEDBACK_2026-11-15.md)
- [YouTube chat setup](docs/block-wars/YOUTUBE_CHAT_SETUP.md)
- [YouTube rewards](docs/block-wars/YOUTUBE_LIKE_SUB_REWARDS.md)
- [Asset provenance](docs/block-wars/MINECRAFT_ASSETS.md)
- [Architecture and phased backlog](docs/block-wars/README.md)

All changes are proposed from feature branches through pull requests. Do not modify main directly, commit secrets, fabricate audience activity or claim monetization from simulated events.
