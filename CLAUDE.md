# Wizarden — repo hub

Real-time multiplayer **Wizard (30-Year Edition)** for 3–6 players on phones.
Full build spec: [`wizarden-build-spec.md`](./wizarden-build-spec.md). Rules source
of truth: [`wizard-30-year-edition-rules.md`](./wizard-30-year-edition-rules.md).
This file stays lean — stack, commands, conventions only.

## Stack
- pnpm workspaces · TypeScript strict everywhere.
- `@wizarden/shared` — contracts only (types, enums, constants). No logic.
- `@wizarden/server` — Node + Express + Socket.IO. Pure engine in `src/engine/**`.
- `@wizarden/client` — React 19 + Vite + Tailwind + Zustand.
- Tests: Vitest (server + client); `socket.io-client` for server integration tests.

## Commands (run from repo root)
- `pnpm install` — install all workspaces.
- `pnpm build` — build shared → server → client (topological).
- `pnpm test` — run all Vitest suites.
- `pnpm dev` — run shared (watch) + server + client together.
- `pnpm dev:server` / `pnpm dev:client` — run one side.

## Conventions
- **Engine purity:** `server/src/engine/**` imports only `@wizarden/shared` — no
  Socket.IO/Express/timers/IO. Enforced in review.
- **Cards are additive (OCP):** each special card is one `CardBehavior` file +
  a registry entry. Never branch on card identity in the resolver/round code.
- **Single source of truth:** all cross-boundary shapes live in `@wizarden/shared`.
- **Server-authoritative:** client renders server state + sends intents; it never
  computes winners/legality/scores.
- **Module/extension convention:** server + engine use NodeNext — relative imports
  carry `.js` extensions. Shared imported by package name `@wizarden/shared`.
- **Debug gating:** bots / 2-seat start are gated behind `ENABLE_DEBUG` (server)
  and `VITE_ENABLE_DEBUG` (client); inert in production.
- **Versioning:** bump version on every delivered build; name any zip after it.

## Env
- Server: `PORT` (Render-provided), `CLIENT_ORIGIN` (Netlify origin), `ENABLE_DEBUG`.
- Client: `VITE_SERVER_URL` (Render URL), `VITE_ENABLE_DEBUG`.
- See `packages/*/.env.example`.

## Deploy
- Server → Render (`render.yaml` blueprint, auto-deploy on push to `main`).
- Client → Netlify (`netlify.toml`, auto-deploy on push to `main`).
