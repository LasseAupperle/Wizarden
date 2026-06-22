# Wizarden

A personal-use, mobile-first, real-time multiplayer implementation of
**Wizard — 30-Year Edition** (the trick-prediction card game). 3–6 friends create
or join a room by code/link and play a full, fully rules-enforced game — all 9
special cards, correct scoring, automatic round advance, reconnect-friendly.

> Original implementation. No AMIGO artwork or copyrighted assets are used.

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
pnpm test       # all Vitest suites
pnpm dev        # shared (watch) + server + client
```

- Client dev: http://localhost:5173
- Server dev: http://localhost:3001 (health at `/health`)

Copy the example env files before running dev:

```bash
cp packages/server/.env.example packages/server/.env
cp packages/client/.env.example packages/client/.env.local
```

## Deployment

- **Server → Render** via [`render.yaml`](./render.yaml) (auto-deploy on push to `main`).
  Set `CLIENT_ORIGIN` to the Netlify origin.
- **Client → Netlify** via [`netlify.toml`](./netlify.toml) (auto-deploy on push to `main`).
  Set `VITE_SERVER_URL` to the Render service URL.

> Note: the server keeps game state **in memory only** (no database). Render's free
> tier sleeps when idle and loses in-progress games on cold start; stale sessions
> then route clients cleanly back to the Landing screen.

## Build plan

The build follows numbered phases, each with a runnable acceptance gate — see
[`wizarden-build-spec.md`](./wizarden-build-spec.md). Game rules:
[`wizard-30-year-edition-rules.md`](./wizard-30-year-edition-rules.md).
