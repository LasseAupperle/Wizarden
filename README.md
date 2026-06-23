# Wizarden

A personal-use, mobile-first, real-time multiplayer implementation of
**Wizard — 30-Year Edition** (the trick-prediction card game). 3–6 friends create
or join a room by code/link and play a full, fully rules-enforced game — all 9
special cards, correct scoring, automatic round advance, reconnect-friendly,
with full/half game modes and a persistent win leaderboard.

> Original implementation. No AMIGO artwork or copyrighted assets are used (see [ASSETS.md](./ASSETS.md)).

## Monorepo layout

```
packages/
  shared/   @wizarden/shared  — types, enums, constants (contracts only)
  server/   @wizarden/server  — Express + Socket.IO; pure game engine in src/engine
  client/   @wizarden/client  — React 19 + Vite + Tailwind + Zustand
```

## Quick start

```bash
pnpm install
pnpm build      # shared -> server -> client
pnpm test       # all Vitest suites (engine, server sockets, client, fuzz)
pnpm lint       # typecheck all packages
pnpm dev        # shared (watch) + server + client
```

- Client dev: http://localhost:5173 · Server dev: http://localhost:3001 (`/health`, `/leaderboard`)

Copy the example env files before running dev:

```bash
cp packages/server/.env.example packages/server/.env
cp packages/client/.env.example packages/client/.env.local
```

## Environment variables

| Side | Var | Purpose |
|------|-----|---------|
| Server | `PORT` | Listen port (Render provides it) |
| Server | `CLIENT_ORIGIN` | Allowed CORS/Socket.IO origin = the Netlify URL |
| Server | `ENABLE_DEBUG` | `"true"` enables bots + 2-seat start (off in prod) |
| Client | `VITE_SERVER_URL` | Backend URL the client connects to = the Render URL |
| Client | `VITE_ENABLE_DEBUG` | `"true"` enables debug UI (off in prod) |

`packages/*/src/config.ts` / `lib/env.ts` validate these at startup and warn/fail
fast on a missing or malformed required value.

## Deployment (auto-deploy on push to `main`)

- **Server → Render** via [`render.yaml`](./render.yaml). Set `CLIENT_ORIGIN` to the Netlify origin.
- **Client → Netlify** via [`netlify.toml`](./netlify.toml). Set `VITE_SERVER_URL` to the Render URL.
- **Both must build on Node 22+** (pnpm 11.8 uses `node:sqlite`). `NODE_VERSION=22` is set in both configs.
- CI ([`.github/workflows/ci.yml`](./.github/workflows/ci.yml)) runs lint + build + tests (incl. a fuzz batch) on every push/PR.

> **Render free-tier cold start:** the service sleeps when idle; the first
> connection of the day can take up to ~50s. The client shows a "Waking up the
> server…" state and retries. In-memory game state is lost on a cold start, so a
> stale session routes cleanly back to the Landing screen.

## Leaderboard persistence (decision needed — see §23.4)

Game state is in-memory by design. The **leaderboard** is the one cross-game
value that should outlive a restart. The server abstracts it behind a
`LeaderboardStore` with an in-memory default. To make wins persist on Render's
free tier, plug in a free hosted store (recommended: Upstash Redis / Neon /
Supabase) behind that interface — additive, no other code changes. Until then,
the leaderboard resets when the server sleeps/redeploys.

## End-to-end verification (manual)

1. `pnpm build` then run prod-mode locally: start the server (`node packages/server/dist/index.js` with `ENABLE_DEBUG=true`) and `pnpm --filter @wizarden/client preview` with `VITE_SERVER_URL` pointed at it.
2. Open two browser contexts; create a room in one, join by the copied link in the other; add a bot; pick Full/Half + some specials; start.
3. Play a full game: bids, legal-move gating, every decision prompt (including the collective Juggler pass), auto-advancing round summaries, game over, Play Again.
4. Refresh mid-game → rejoin same seat. Remove a player mid-game → the rest continue. Confirm the leaderboard updates after a real (non-bot) game.

## Build plan

Numbered phases with runnable gates — see [`wizarden-build-spec.md`](./wizarden-build-spec.md).
Rules: [`wizard-30-year-edition-rules.md`](./wizard-30-year-edition-rules.md).
