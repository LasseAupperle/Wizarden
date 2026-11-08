# Changelog

All packages (`wizarden`, `@wizarden/shared`, `@wizarden/server`, `@wizarden/client`)
share one version, bumped on every delivered build.

## 0.2.0 — 2026-11-08

- **PWA:** PNG icons (192/512, maskable 512, 180 apple-touch, 32 favicon) and a
  1200×630 Open Graph image, generated from `icon.svg` via `gen:icons`; manifest
  and `index.html` updated (`summary_large_image` link previews).
- **Ops:** keep-warm GitHub Actions workflow pings `/health` every 14 min during
  play hours to avoid Render free-tier cold starts.
- **CI:** Playwright E2E smoke test now runs in CI (and actually passes — its
  lobby selectors were fixed); optional `PW_CHROMIUM_PATH` for pre-installed browsers.
- **Server:** `/health` reports the real package version instead of a hardcoded string.
- **Docs:** `ASSETS.md` corrected (self-hosted fonts, icon set, unverified sound
  licence); README + spec §24 updated.

## 0.1.0 — 2026-06-25

- v1 feature-complete: Phases 0–9 of the build spec (engine, all 9 special cards,
  server rooms/reconnect/host migration/departures, debug bots, mobile client,
  full/half modes, Redis-backed leaderboard, i18n en/nl/de, light/dark themes,
  hardening, CI, Render/Netlify deploy).
