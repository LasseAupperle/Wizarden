# Changelog

All packages (`wizarden`, `@wizarden/shared`, `@wizarden/server`, `@wizarden/client`)
share one version, bumped on every delivered build.

## 0.3.0 — 2026-11-08

Interface overhaul from the phone/PC interface review.

- **Finished tricks stay on the table.** When the last card lands, the server
  holds the trick for 2s (`TRICK_HOLD_MS`) with the winning card highlighted and
  "Bob wins the trick" (or "No one wins" for the Bomb); the next lead waits, and
  the round summary follows the last trick. Engine records `lastTrick`; the room
  schedules the hold (engine stays pure).
- **Decisions no longer hide your hand.** Choose trump, Werewolf, Cloud, Juggler,
  Witch, Shapeshifter and Juggler/Cloud colour choices are an inline panel above
  your hand (no blurring overlay, no dead close button). Juggler pass and Witch
  give use the hand itself.
- **Phone table:** fits one screen (no scrolling while playing); the hand fans
  into at most 2 rows, with a corner index (value + suit) that stays readable;
  on touch the first tap lifts a card and the second plays it; big rounds use a
  − n + bid stepper; "Bids: 7 of 20"; trick cards shrink for 5–6 players.
- **PC table (≥1024px):** players sit around an oval in play order with the card
  each played in front of them, trump in the middle, larger cards, your hand in
  one row, an always-visible scoreboard panel, and keyboard play (← → Enter;
  type a number + Enter to bid). Special cards show their rule on hover.
- **Round summary** shows bid, won, points and new total, ranked. The scoreboard
  shows won/bid per round.
- **Fully translated game** (en/nl/de): round labels, stats, prompts, suit and
  card names, round summary and error messages.
- **Look:** labelled stats (bid · won · pts), one trump indicator (on the table),
  first-to-bid marker, unplayable cards dim without losing their numbers,
  light-theme special cards fixed, brighter Witch emblem, line icons instead of
  emoji, no focus outline around the app, "Join" no longer wraps, tap the room
  code in the lobby to copy it.

## 0.2.0 — 2026-11-08

- **PWA:** PNG icons (192/512, maskable 512, 180 apple-touch, 32 favicon) and a
  1200×630 Open Graph image, generated from `icon.svg` via `gen:icons`; manifest
  and `index.html` updated (`summary_large_image` link previews).
- **Ops:** the server keeps itself awake only while a game is in use (self-ping of
  its public URL every 10 min while any player is connected, or for 30 min after
  everyone drops from an unfinished game); otherwise Render may sleep it as usual.
- **Reconnection (mobile):**
  - An empty lobby (everyone disconnected, e.g. host switched to WhatsApp to share
    the link) is kept for 10 min instead of being deleted instantly; a lobby
    everyone *left* still closes at once.
  - Fixed: any lobby emptying used to sweep *every* empty room, which could delete
    a running game whose players were all briefly offline. Reaping is now per room.
  - Dead connections are detected in ≤ ~18s (was ≤ 45s); returning to the app
    with a stale connection, or switching Wi-Fi ↔ mobile data, reconnects at once.
  - Taps made while offline are no longer queued and replayed before the seat is
    restored (which caused "Something went wrong" toasts); a "you're offline" toast
    shows instead.
  - A failed rejoin now says why: server restarted (game lost), room closed, or
    removed from the game.
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
