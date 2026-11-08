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
pnpm build        # shared -> server -> client
pnpm test         # all Vitest suites (engine, server sockets, client, fuzz)
pnpm typecheck    # tsc --noEmit across packages
pnpm lint         # ESLint
pnpm format       # Prettier --write
pnpm dev          # shared (watch) + server + client

# browser E2E (downloads Chromium once, runs the prod-like stack; also in CI):
pnpm e2e:install && pnpm test:e2e
# (sandbox with a pre-installed Chromium: PW_CHROMIUM_PATH=/path/to/chrome pnpm test:e2e)
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
| Server | `REDIS_URL` | _Optional_ Upstash Redis (`rediss://…`) for a persistent leaderboard |
| Server | `LOG_LEVEL` | _Optional_ pino level (default `info`) |
| Server | `KEEP_AWAKE_URL` | _Optional_ public URL to self-ping while games are active (defaults to Render's `RENDER_EXTERNAL_URL`) |
| Client | `VITE_SERVER_URL` | Backend URL the client connects to = the Render URL |
| Client | `VITE_ENABLE_DEBUG` | `"true"` enables debug UI (off in prod) |
| Client | `VITE_SENTRY_DSN` | _Optional_ Sentry DSN for client error tracking |

`packages/*/src/config.ts` / `lib/env.ts` validate these at startup and warn/fail
fast on a missing or malformed required value.

## Logs & monitoring

- **Server logs:** structured JSON (pino) to stdout → view live in **Render →
  `wizarden-server` → Logs** (or `render logs` via the Render CLI). Locally they
  print to the terminal running `pnpm dev`.
- **Client errors:** browser console; optionally **Sentry** — set
  `VITE_SENTRY_DSN` (Netlify env) and errors stream to your Sentry project. The
  Sentry SDK is lazy-loaded, so it adds nothing to the bundle when unset.

## Deployment (auto-deploy on push to `main`)

- **Server → Render** via [`render.yaml`](./render.yaml). Set `CLIENT_ORIGIN` to the Netlify origin.
- **Client → Netlify** via [`netlify.toml`](./netlify.toml). Set `VITE_SERVER_URL` to the Render URL.
- **Both must build on Node 22+** (pnpm 11.8 uses `node:sqlite`). `NODE_VERSION=22` is set in both configs.
- CI ([`.github/workflows/ci.yml`](./.github/workflows/ci.yml)) runs typecheck + lint + format check + build + tests (incl. a fuzz batch), then the Playwright E2E smoke test, on every push/PR.
- `GET /health` reports the server's `package.json` version, so you can confirm which build Render is running.

> **Render free-tier cold start:** the service sleeps when idle; the first
> connection of the day can take up to ~50s. The client shows a "Waking up the
> server…" state and retries. In-memory game state is lost on a cold start, so a
> stale session routes cleanly back to the Landing screen.
>
>
> **Awake only while playing:** the server is free to sleep until someone opens the
> site. While any room has a connected player — or an unfinished game had one within
> the last 30 min (locked phones, mobile-data drops) — it requests its own public URL
> (`RENDER_EXTERNAL_URL`, set by Render) every 10 min so it can't sleep mid-game.
> Once nobody is playing it stops, and Render spins it down ~15 min later.
> `KEEP_AWAKE_URL` overrides the URL; locally (unset) it's off.

## PWA icons & link preview

`packages/client/public/` holds the original `icon.svg` plus generated PNGs
(192/512, maskable 512, 180 apple-touch, 32 favicon) and a 1200×630 `og-image.png`
for shared-link previews. After changing the icon, regenerate them with
`pnpm --filter @wizarden/client gen:icons` (uses Playwright's Chromium; no native
image deps). The OG tags point at `https://wizarden.netlify.app` — update
`index.html` if the Netlify site lives elsewhere.

## Leaderboard persistence

Game state is in-memory by design. The **leaderboard** is the one cross-game
value that outlives a restart: the server abstracts it behind a
`LeaderboardStore`, and `RedisLeaderboard` (write-through over an in-memory
mirror) persists wins to **Upstash Redis** when `REDIS_URL` is set — otherwise it
falls back to in-memory (resets on restart). Full-game win = 1 pt, half-game =
0.5; bot/debug games are excluded; the popup shows the top 5.

## End-to-end verification (manual)

1. `pnpm build` then run prod-mode locally: start the server (`node packages/server/dist/index.js` with `ENABLE_DEBUG=true`) and `pnpm --filter @wizarden/client preview` with `VITE_SERVER_URL` pointed at it.
2. Open two browser contexts; create a room in one, join by the copied link in the other; add a bot; pick Full/Half + some specials; start.
3. Play a full game: bids, legal-move gating, every decision prompt (including the collective Juggler pass), auto-advancing round summaries, game over, Play Again.
4. Refresh mid-game → rejoin same seat. Remove a player mid-game → the rest continue. Confirm the leaderboard updates after a real (non-bot) game.

## Versioning

All packages share one version (currently **0.2.0**), bumped on every delivered
build; see [`CHANGELOG.md`](./CHANGELOG.md).

## Build plan

Numbered phases with runnable gates — see [`wizarden-build-spec.md`](./wizarden-build-spec.md).
Rules: [`wizard-30-year-edition-rules.md`](./wizard-30-year-edition-rules.md).
