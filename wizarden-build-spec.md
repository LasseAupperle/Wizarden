# Wizarden — Claude Code Build Spec

**Spec version:** 1.2
**Repo:** https://github.com/LasseAupperle/Wizarden
**Canonical rules reference:** `wizard-30-year-edition-rules.md` (provided alongside this spec — the game engine must conform to it exactly).

This document is the build plan for **Wizarden**, a personal-use, mobile-first, real-time multiplayer implementation of *Wizard — 30-Year Edition*. It is written to be built **piece by piece in numbered phases**, each ending in a **runnable pass/fail acceptance gate** (an automated test or a documented run). Build phases in order; do not start a phase until the previous phase's gate passes.

---

## Changelog

**v1.2** — two behaviour changes requested after the v1.1 review:
- **Round advance is now automatic.** After scoring, the round-end summary shows for a fixed delay (`ROUND_SUMMARY_MS`, scheduled by the server) and the next round then starts on its own; the `game:nextRound` host action is removed. The scoreboard popup stays available throughout. The engine stays pure — only the server schedules the delay.
- **The game continues when a player leaves or is kicked**, as long as **3+ players remain**. A mid-round departure **voids the in-progress round and re-deals the same round number** to the remaining players; the original total round count is preserved; turn order and the start marker skip the departed seat. A departure that would leave **fewer than 3** players ends the game with final standings. See §7.6.

**v1.1 (review pass)** — corrected/clarified after a full review of v1.0:
- **Round count is fixed by player count (60 ÷ players = 20/15/12/10), not derived from deck size.** The full deck is reshuffled every round; the last round flips a trump card only when specials are in play.
- **The Juggler's card pass is each player's choice**, modelled as a *collective* pending decision (every seat with cards picks a card to pass). Added the `jugglerPass` decision and an `awaitingDecisionSeats` field; the pending-decision model supports multiple simultaneous owners.
- Added (now superseded by v1.2) round-advance handling; defined mid-game removal, mid-game join rejection, and reconnect-token-failure handling.
- Clarified the Werewolf-in-hand + Wizard-flipped edge case, the pause rule for collective/disconnected decisions, debug-mode env gating, room-code format, and room cleanup.

---

## 0. How to read and use this spec

- **The rulebook `.md` is the source of truth for game rules.** Where this spec restates a rule, it is a convenience; if anything here contradicts the rulebook, the rulebook wins, and you must surface the contradiction rather than guessing.
- **Over-specification is intentional.** Implement what each section asks for. If a requirement is genuinely ambiguous or you must make an assumption, stop and state the assumption explicitly in a comment and in your summary, rather than silently choosing.
- **Build order is mandatory.** Engine and core logic are built and tested *before* any UI. Tests are written *within* the same phase as the code they cover, not deferred.
- **Design for change, not for cleverness.** See §4 design principles. The special-card system in particular must be **additive**: adding or changing a card is a new small unit, never an edit that risks breaking the base game or other cards.

---

## 1. What we are building

A web app where 3–6 friends, mostly on phones, play a full game of Wizard (30-Year Edition) together in real time. One person creates a room and shares a short code/link; others join by name. The server is the sole authority on game state and fully enforces the rules. All 9 special cards are implemented, with the host choosing which subset is in play per game. The experience must survive flaky mobile connections: a dropped player keeps their seat and rejoins where they left off, and if someone leaves for good the rest can keep playing.

**Out of scope is defined explicitly in §10. Read it before building.**

---

## 2. Tech stack & deployment

| Layer | Choice |
|-------|--------|
| Monorepo | pnpm workspaces |
| Language | TypeScript (strict) everywhere |
| Shared contracts | `@wizarden/shared` package |
| Backend | Node + Express + **Socket.IO** (`@wizarden/server`) → deployed on **Render** |
| Game engine | Pure TypeScript module inside the server (`server/src/engine`), zero IO/transport imports |
| Frontend | React 19 + Vite + TypeScript + Tailwind + **Zustand** (`@wizarden/client`) → deployed on **Netlify** |
| Tests | **Vitest** on both server and client; `socket.io-client` for server integration tests |
| Real-time | Socket.IO (chosen for built-in rooms + reconnection primitives) |
| Persistence | **None.** Game state is in-memory on the server (see §10). |

**Environment variables**
- Client build: `VITE_SERVER_URL` — the Render backend URL. `VITE_ENABLE_DEBUG` — `"true"` enables debug-only UI (bots, 2-seat start).
- Server runtime: `CLIENT_ORIGIN` — the Netlify origin, used for CORS + Socket.IO `cors.origin`; `PORT` — provided by Render; `ENABLE_DEBUG` — `"true"` enables debug-only server actions (bots, 2-seat start).

The client must read the backend URL only from `VITE_SERVER_URL` (no hardcoded URLs). The server must allow exactly `CLIENT_ORIGIN` (plus `http://localhost:5173` for local dev) for CORS and Socket.IO. Debug actions/UI must be inert unless the corresponding debug env flag is set. Tunable timings (e.g. `ROUND_SUMMARY_MS`, the round-summary display duration before auto-advance) live as named constants in `shared/src/constants.ts`.

---

## 3. Repository structure

A pnpm monorepo. Create exactly this top-level layout (files listed are the *intended* set; add supporting files as needed, but keep names stable so later phases can reference them):

```
Wizarden/
├─ package.json                  # root: workspaces, scripts (dev, build, test, lint)
├─ pnpm-workspace.yaml
├─ tsconfig.base.json
├─ CLAUDE.md                     # lean: stack, commands, conventions, standing prefs (hub)
├─ README.md
├─ packages/
│  ├─ shared/                    # @wizarden/shared — contracts only, no runtime logic
│  │  ├─ package.json
│  │  ├─ tsconfig.json
│  │  └─ src/
│  │     ├─ index.ts
│  │     ├─ cards.ts             # Card model, suits, special types, card identity
│  │     ├─ state.ts             # GameState, RoundState, Player, Trick, phases, scores
│  │     ├─ decisions.ts         # PendingDecision union
│  │     ├─ events.ts            # Socket event names + payload contracts (C→S, S→C)
│  │     └─ constants.ts         # rounds-per-player-count table, deck composition, ROUND_SUMMARY_MS, etc.
│  ├─ server/                    # @wizarden/server
│  │  ├─ package.json
│  │  ├─ tsconfig.json
│  │  └─ src/
│  │     ├─ index.ts             # express + socket.io bootstrap, CORS, health route
│  │     ├─ engine/              # PURE — imports only @wizarden/shared
│  │     │  ├─ deck.ts           # build/shuffle/deal (reshuffle full deck each round)
│  │     │  ├─ game.ts           # Game aggregate: lifecycle state machine
│  │     │  ├─ round.ts          # round lifecycle (deal→trump→prebid→bid→tricks→score)
│  │     │  ├─ trick.ts          # trick resolution pipeline (the ordered resolver)
│  │     │  ├─ scoring.ts        # scoring rules
│  │     │  ├─ rng.ts            # seedable RNG (deterministic tests)
│  │     │  └─ cards/            # one behavior unit per special card (OCP plug-ins)
│  │     │     ├─ registry.ts    # CardBehavior registry + lookup
│  │     │     ├─ types.ts       # CardBehavior interface + engine-internal helper types
│  │     │     ├─ dragon.ts  fairy.ts  bomb.ts  werewolf.ts
│  │     │     ├─ juggler.ts cloud.ts  witch.ts vampire.ts shapeshifter.ts
│  │     ├─ rooms/
│  │     │  ├─ roomManager.ts    # create/join/find rooms, code generation, cleanup
│  │     │  ├─ room.ts           # a single room: players, sessions, wraps a Game, schedules auto-advance
│  │     │  └─ sessions.ts       # session token ↔ seat identity
│  │     ├─ net/
│  │     │  ├─ handlers.ts       # socket event handlers → engine actions
│  │     │  ├─ broadcast.ts      # per-player redacted state projection
│  │     │  └─ reconnect.ts      # disconnect/reconnect/host-migration/departure logic
│  │     └─ bots/
│  │        └─ randomBot.ts      # debug-only legal-move bot
│  └─ client/                    # @wizarden/client
│     ├─ package.json
│     ├─ tsconfig.json
│     ├─ index.html
│     ├─ vite.config.ts
│     └─ src/
│        ├─ main.tsx  App.tsx
│        ├─ net/socket.ts        # socket client wrapper, (re)connect, token persistence
│        ├─ store/gameStore.ts   # Zustand store (mirrors server state for this player)
│        ├─ screens/             # Landing, Lobby, Game, GameOver
│        ├─ components/          # Hand, Table, TrickArea, OpponentSeat, BidInput,
│        │                       # TrumpIndicator, Scoreboard (popup), DecisionPrompt,
│        │                       # SpecialCardPicker, ConnectionBanner, Card
│        ├─ sound/placeCard.ts   # place-card sound effect loader/player
│        └─ styles/
```

**Hard structural rules**
- `packages/shared` contains **types, enums, constants, and pure trivial helpers only** — no game logic, no Socket.IO, no React.
- `server/src/engine/**` imports **only** from `@wizarden/shared`. It must never import Socket.IO, Express, the rooms layer, timers, or anything stateful/IO. This is what makes the engine unit-testable in isolation and is enforced by review.
- `client/**` imports `@wizarden/shared` for types and **never** imports the engine. The client holds **no authority**; it renders server-provided state and sends intents.

---

## 4. Architecture & design principles

**Server-authoritative.** The server holds the only true `GameState`. Clients send *intents* (place bid, play card, resolve a decision). The server validates every intent against the engine, mutates state via the engine, then broadcasts updated, per-player-redacted state. Clients never compute outcomes.

**Pure engine, injected randomness, no timers.** The engine is deterministic given its inputs. Randomness (shuffle) comes through an injected seedable RNG (`rng.ts`) so tests reproduce exact deals. The engine exposes pure transition functions / an aggregate that takes the current state + an action and returns the next state (plus any events/pending decision). No wall-clock, no IO, no globals — including the automatic round advance, which the engine exposes as a pure transition while the *server* schedules its timing.

**Open/Closed for cards.** The base game (number cards, Wizard, Jester) is complete on its own. Every special card is a **`CardBehavior` plug-in** registered in `cards/registry.ts`. The trick resolver and round lifecycle call into behaviors through the `CardBehavior` interface at well-defined hook points; they do **not** contain per-card `if (card === 'dragon')` branches. Adding a card = add one file + register it. Changing one card's rule must not touch another card's file or the base engine.

**Single responsibility / composition.** `deck` builds/shuffles/deals; `round` owns the round state machine; `trick` owns trick resolution; `scoring` owns scoring; `cards/*` own per-card effects. The rooms/net/bots layers are separate from the engine and depend on it, never the reverse. Compose these; do not build a god-object.

**Program to the shared contracts.** All cross-boundary shapes (engine↔server, server↔client) are the types in `@wizarden/shared`. There is exactly one definition of a `Card`, a `GameState`, and each socket payload. If a shape needs to change, change it in `shared` and let TypeScript surface every call site.

**Pending-decision model (critical).** Several actions pause the flow to await *specific* player input. Model these uniformly as pending decisions on the state. Most are **single-owner** (one seat must act: choose trump, werewolf swap, cloud adjust, witch swap). One is **collective** (the Juggler pass: every seat with cards must each pick a card). The server therefore tracks a *set* of outstanding decisions (a map of seat → decision); a single-owner decision is a set of size one, the Juggler pass is a set sized to the number of participating seats. The engine advances until the round step completes or one/more decisions are raised, then waits. Each client is told only its **own** outstanding decision (others are hidden) plus the public list of which seats still owe a decision. This keeps mandatory/automatic timing (e.g. the Werewolf swap) impossible to skip or break, and reconnect restores it.

---

## 5. Module-linkage map (data flow)

```
            ┌─────────────────────────── @wizarden/shared ───────────────────────────┐
            │  Card model · GameState/RoundState · PendingDecision · Socket events     │
            └───────▲───────────────────────▲───────────────────────────▲────────────┘
                    │ (types only)           │ (types only)              │ (types only)
        ┌───────────┴──────────┐   ┌─────────┴──────────────┐   ┌────────┴───────────┐
        │   server/src/engine  │   │  server/src/{rooms,net}│   │  client/src         │
        │   (PURE)             │   │                        │   │                     │
        │  deck→round→trick    │   │  RoomManager           │   │  socket.ts          │
        │  scoring             │   │   └─ Room ─ wraps ─ Game (engine)              ──┼── Socket.IO ──┐
        │  cards/* (behaviors) │◄──┤  net/handlers (intent→engine action)            │               │
        │  rng                 │   │  net/broadcast (redact per player)──────────────┼──► gameStore ──┤
        └──────────────────────┘   │  net/reconnect (seat/session/host/departures)   │   (Zustand)    │
                                    │  bots/randomBot (debug) ───────────────────────┼──► screens ────┘
                                    └────────────────────────────────────────────────┘   components
```

Flow of one player action: **client component** → `socket.ts emit(intent)` → **server `net/handlers`** validates seat/turn → calls **engine action** on the room's `Game` → engine returns next state (+ optional decisions/round result) → **`net/broadcast`** projects redacted state per seat → emits to clients → **`gameStore`** updates → **components** re-render. The round auto-advance is scheduled by the room after `round:result`.

---

## 6. Shared contracts (`@wizarden/shared`)

Define these precisely. Signatures below are the contract; you may add fields if a later phase needs them, but do not remove or repurpose these without updating all call sites.

### 6.1 Cards (`cards.ts`)

```ts
export type Suit = 'red' | 'blue' | 'green' | 'yellow';

export type SpecialType =
  | 'dragon' | 'fairy' | 'bomb' | 'werewolf' | 'juggler'
  | 'cloud' | 'witch' | 'vampire' | 'shapeshifter';

export type Card =
  | { kind: 'number'; id: string; suit: Suit; value: number }   // value 1..13
  | { kind: 'wizard'; id: string }                              // 4 copies
  | { kind: 'jester'; id: string }                              // 4 copies
  | { kind: 'special'; id: string; special: SpecialType };      // 1 copy each

// Decisions attached to a play at the moment of playing:
export type PlayDecision =
  | { type: 'none' }
  | { type: 'shapeshifter'; as: 'wizard' | 'jester' }
  | { type: 'announceSuit'; suit: Suit };       // juggler & cloud announce a suit
```

- `id` is a stable unique identifier per physical card (used for transport, animation keys, and the Witch/Juggler swap/pass mechanics). Wizards/Jesters have distinct ids per copy.
- Base deck = 52 number cards (4 suits × 1–13) + 4 wizard + 4 jester = **60**. The 9 specials are single copies.

### 6.2 State (`state.ts`)

```ts
export type Phase =
  | 'lobby' | 'dealing' | 'trumpDecision' | 'preBid' | 'bidding'
  | 'trick' | 'trickResolving' | 'scoring' | 'roundEnd' | 'gameOver';

export interface PlayerPublic {
  seat: number;            // 0-based; fluid in lobby, FIXED at game start
  name: string;
  connected: boolean;      // socket connection status
  inPlay: boolean;         // false once a player has left/been removed mid-game; kept for scoreboard history
  isHost: boolean;
  isBot: boolean;
  bid: number | null;      // null until they have bid this round
  tricksWon: number;       // this round
  handCount: number;       // number of cards (public); contents are private
  totalScore: number;
}

export interface TrickPlay { seat: number; card: Card; decision: PlayDecision; }

export interface RoundResult {            // per round, per player
  seat: number; bid: number; tricksWon: number; delta: number; total: number;
}

// What a given client receives (their own hand is included; others' hands are counts):
export interface ClientGameState {
  roomCode: string;
  phase: Phase;
  players: PlayerPublic[];
  yourSeat: number;
  yourHand: Card[];                 // empty in lobby
  roundNumber: number;              // 1-based
  totalRounds: number;              // fixed at game start; unchanged if players later leave
  startMarkerSeat: number;
  currentTurnSeat: number | null;   // the single seat to act (bidder / card to play);
                                    // null during collective decisions and non-turn phases
  awaitingDecisionSeats: number[];  // seats that still owe a pending decision (single or collective)
  trumpCard: Card | null;           // the flipped card (null if none / last base round)
  trumpSuit: Suit | null;           // resolved trump colour (null = no trump)
  currentTrick: TrickPlay[];
  selectedSpecials: SpecialType[];  // which specials are in play this game
  pendingDecision: PendingDecision | null;  // THIS player's own outstanding decision, else null
  paused: boolean;                  // true while waiting on a disconnected player
  pausedForName: string | null;
  scoreboard: RoundResult[][];      // [round][player]; for the popup
  lastRoundResult: RoundResult[] | null;  // for the round-end summary
  gameOver: { standings: PlayerPublic[] } | null;
}
```

The **server** holds a richer internal `GameState` (full hands for all seats, the undealt pile, the round's trump-determining card retained for the Vampire, RNG state, the map of outstanding decisions, etc.). `ClientGameState` is the redacted projection produced by `net/broadcast`. Hands of other players are never sent.

### 6.3 Pending decisions (`decisions.ts`)

```ts
export type PendingDecision =
  | { kind: 'chooseTrump'; seat: number }                 // a Wizard/Dragon/etc. was flipped
  | { kind: 'werewolfSwap'; seat: number }                // holder must swap + choose trump pre-bid
  | { kind: 'cloudAdjust'; seat: number }                 // trick winner adjusts bid ±1
  | { kind: 'witchSwap'; seat: number; trickCardIds: string[] } // choose card to take + give
  | { kind: 'jugglerPass'; seat: number };                // each player picks one hand card to pass
```

- `chooseTrump`, `werewolfSwap`, `cloudAdjust`, `witchSwap` are **single-owner** (exactly one is outstanding at a time, for the named seat).
- `jugglerPass` is **collective**: one is raised per participating seat simultaneously; the pass executes only once **all** participants have submitted.
- Resolution intents from the client (see events) carry the matching payload (chosen suit; chosen ±1; take-id + give-id; card-id to pass).

### 6.4 Socket events (`events.ts`)

Name the events as constants and define payloads. **Client → Server:**

| Event | Payload | Notes |
|-------|---------|-------|
| `room:create` | `{ name }` | returns room code; creator becomes host + seat 0 |
| `room:join` | `{ name, code }` | **lobby only** — rejected if the game is already in progress |
| `room:rejoin` | `{ token }` | reconnect into an existing seat; valid at any phase |
| `room:leave` | `{}` | voluntary leave; mid-game handled per §7.6 |
| `lobby:configureSpecials` | `{ specials: SpecialType[] }` | host only; Dragon/Fairy must both be present or both absent |
| `lobby:addBot` / `lobby:removeBot` | `{ seat? }` | **debug only** (`ENABLE_DEBUG`) |
| `game:start` | `{}` | host only; requires 3–6 seats (2 allowed only in debug) |
| `game:bid` | `{ bid }` | current bidder only; `0..n` |
| `game:play` | `{ cardId, decision: PlayDecision }` | current player only; must be legal |
| `game:resolve` | `{ suit }` \| `{ delta: 1 \| -1 }` \| `{ takeId, giveId }` \| `{ cardId }` | only a seat with that outstanding decision; shape matches the decision kind (`cardId` = the Juggler pass) |
| `host:removePlayer` | `{ seat }` | host only; lobby frees the seat, mid-game continues if 3+ remain else ends the game (§7.6) |
| `game:playAgain` | `{}` | host only; returns the room to lobby, scores reset |

*(Round advance is automatic — there is no client event for it; see §7.1 step 6.)*

**Server → Client:**

| Event | Payload |
|-------|---------|
| `room:created` / `room:joined` | `{ code, token, state: ClientGameState }` |
| `state:update` | `ClientGameState` (redacted for the recipient — authoritative) |
| `decision:prompt` | `PendingDecision` (only to the owning seat) |
| `round:result` | `RoundResult[]` |
| `game:over` | `{ standings: PlayerPublic[] }` |
| `peer:connected` / `peer:disconnected` / `peer:left` | `{ seat, name }` (advisory; `state:update` is authoritative) |
| `game:paused` / `game:resumed` | `{ seat?, name? }` |
| `error` | `{ code, message }` |

The token returned on create/join is the **session token**; the client persists it (localStorage) and uses `room:rejoin` to restore its seat after a reconnect or refresh. If `room:rejoin` fails (unknown/expired token or room — e.g. the server restarted and lost in-memory state, or the seat was removed), the server returns `error` with a distinct code and the client must **clear the stored token and return to the Landing screen** rather than getting stuck.

### 6.5 `CardBehavior` interface (`server/src/engine/cards/types.ts`)

This is the plug-in contract. Define it so each special card is one self-contained unit. Suggested shape (you may refine signatures, but keep the hook *points* and their ordering semantics). The helper types `EngineCtx`, `RankInfo`, and `StageResult` are **engine-internal** (defined in this file, not in `@wizarden/shared`); `ResolveStage` is the ordered post-winner stage enum **`'bomb' | 'juggler' | 'cloud' | 'witch'`** matching §7.2 steps 2–5.

```ts
export type TrumpFlipOutcome =
  | { type: 'chooseTrump' }     // owner picks the trump suit (raise chooseTrump decision)
  | { type: 'noTrump' };        // no trump this round

export type LeadConstraint =
  | { type: 'asWizard' }        // led like a Wizard: others may play anything
  | { type: 'asJester' }        // led like a Jester: free until a number/Wizard appears
  | { type: 'followAnnounced'; suit: Suit }; // juggler/cloud lead: announced suit must be followed

export type ResolveStage = 'bomb' | 'juggler' | 'cloud' | 'witch';

export interface CardBehavior {
  readonly special: SpecialType;

  // Called when this special card is the flipped trump-determining card.
  onTrumpFlip(ctx: EngineCtx): TrumpFlipOutcome;

  // Called when this special card is the FIRST card led in a trick.
  leadConstraint(play: TrickPlay): LeadConstraint;

  // Pre-bid mandatory step (Werewolf only). Most return undefined.
  preBid?(ctx: EngineCtx): PendingDecision | void;

  // Contribution to winner determination (Dragon/Fairy/Wizard-likeness etc.).
  // The resolver composes these; behaviors must not directly mutate state here.
  rankContribution?(play: TrickPlay, ctx: EngineCtx): RankInfo;

  // Ordered post-resolution hooks. Stage is one of ResolveStage, applied in §7.2 order.
  onStage?(stage: ResolveStage, ctx: EngineCtx): StageResult; // may raise pending decision(s)

  // Play-time identity resolution (Vampire copies the round's trump card).
  onPlayResolveIdentity?(ctx: EngineCtx): void;
}
```

`registry.ts` maps `SpecialType → CardBehavior`. The resolver and round code iterate the **registry**, never hardcode card names. `EngineCtx` gives behaviors read access to the current trick/round/game and a controlled way to enqueue effects/decisions — design it so behaviors cannot reach outside the engine.

---

## 7. Canonical rules the engine must implement

**Authoritative source: `wizard-30-year-edition-rules.md`.** This section restates the parts most likely to be mis-implemented. Cross-check each against the rulebook; if you find a discrepancy, flag it.

### 7.1 Round lifecycle (must be enforced in this order)

1. **Deal.** **At the start of every round, reshuffle the full deck** (the 60 base cards plus the selected specials) and deal *n* cards to each active player in round *n*; the remaining cards form a face-down pile. **The number of rounds is fixed at game start from the *initial* player count, derived from the 60-card base deck, and does NOT change when specials are added or when players later leave:** 3 players → 20 rounds, 4 → 15, 5 → 12, 6 → 10 (i.e. 60 ÷ initial players). Because every supported player count divides 60 evenly, the full final round deals exactly 60 cards: in the **base game** that empties the deck (no card left → no trump in the last round); in the **extended game** the selected specials remain in the pile, so a trump card is still flipped. **Do not compute the round count from the combined deck size** — that would wrongly add rounds when specials are included. (When the table is short-handed after a departure, the same per-round card counts are dealt to fewer players, so there is always enough deck — see §7.6.)
2. **Trump determination.** Flip the top undealt card. Its suit is trump. Special cases by flipped card — see §7.3. **Retain the flipped trump-determining card for the whole round** (the Vampire copies it).
3. **Pre-bid mandatory step (Werewolf in hand).** If a player *holds* the **Werewolf**, before bidding they **must** swap it for the flipped trump card (taking that card into hand) and choose the new trump suit, or declare "no trump." Bidding cannot open until resolved. Enforce via `PendingDecision { kind: 'werewolfSwap' }`.
   - **Edge case (verify against rulebook):** if the flipped card was a Wizard/Dragon/etc. that would normally trigger a `chooseTrump` by the start-marker holder *and* a player holds the Werewolf, the Werewolf swap supersedes — resolve trump via the Werewolf holder's choice and do **not** separately prompt the start-marker holder. Implement it this way but flag it as an interpretation to confirm.
4. **Bidding.** Starting with the active player clockwise of the start marker, each names a bid (`0..n`). Bids need **not** sum to n. Record bids; they are public.
5. **Trick play.** The first bidder leads the first trick. Follow the led suit if able; otherwise play anything (trump or off-suit). Wizard/Jester/specials may always be played (this includes the Vampire — it is never forced to follow, even though it may copy a trump card). The led suit never changes within a trick. After each trick, the winner leads the next.
6. **Scoring & automatic advance.** Apply scoring (§7.4), enter the `roundEnd` phase, and emit `round:result`. The server then **auto-advances after `ROUND_SUMMARY_MS`** (a tunable constant): the *engine* exposes a pure `advanceRound` transition, the *server* schedules the delay and invokes it. Advancing rotates the start marker one **active** seat clockwise and begins the next round — or, after the final round, transitions to `gameOver`. **No player action is required to advance**; the scoreboard popup stays available during the summary. (If a player is disconnected when the timer fires, advance anyway; the new round pauses normally if it then needs that seat.)

### 7.2 Trick resolution — the fixed ordered pipeline (`trick.ts`)

After all seats have played to the trick, resolve in **exactly this order**. Implement as one centralized, well-tested function that drives the `CardBehavior` hooks. **This ordering is derived from the rulebook + AMIGO's official FAQ (including their five-card example); treat it as the spec but keep it isolated so it can be corrected against the rulebook if a test reveals a mismatch.** When more than one stage raises a pending decision, decisions are resolved in this same step order.

1. **Determine the winner by rank.** First Wizard played wins. The **Dragon** beats Wizards. **Exception:** if both Dragon and Fairy are in the trick, the **Fairy** wins. With no Wizard/Dragon: highest trump, else highest card of the led suit. Bottom ranking: **Witch < Fairy < Jester** (all below any number card). Shapeshifter ranks as the Wizard or Jester it was declared. Juggler ranks at 7½, Cloud at 9¾, each in its announced suit.
2. **Bomb.** If any Bomb is in the trick, **no one wins** it — set it aside; it counts toward **no** player's bid. The player who *would* have won (from step 1) leads the next trick.
3. **Juggler.** If a Juggler is in the trick **and it is not the last trick of the round**, every player with cards must pass one **of their own choosing** clockwise. Raise a **collective** `PendingDecision { kind: 'jugglerPass' }` for each participating seat; once all have submitted their card-id, execute the simultaneous pass, then everyone picks up. (Last trick of the round → no pass. A Bomb in the trick does **not** cancel the pass.)
4. **Cloud.** If a Cloud is in the trick, the trick's **winner** adjusts **their own bid** by +1 or −1 (their choice) — *unless* a Bomb is also present, in which case **no change**. If the winner's bid is 0, they may only +1. Raise `PendingDecision { kind: 'cloudAdjust' }`.
5. **Witch.** If a Witch is in the trick, after the winner is settled, the Witch's player puts one of their hand cards into the trick and takes any non-Witch card from the trick into hand (may be a special). The card placed in has no effect. Raise `PendingDecision { kind: 'witchSwap' }`. (Consequence: a card can be replayed later in the round — handle ids accordingly.)

The pipeline must be **resumable**: it pauses while any decision is outstanding, the owning player(s) resolve via `game:resolve`, then resolution continues from where it paused. The next trick does not start until the entire pipeline (including a Witch swap) has completed.

### 7.3 Trump-on-flip mapping (§7.1 step 2)

When the flipped trump-determining card is:
- **Wizard, Dragon, Shapeshifter, Juggler, Cloud, Werewolf, Vampire** → the start-marker holder **chooses** the trump suit → `PendingDecision { kind: 'chooseTrump' }`.
- **Jester, Fairy, Bomb, Witch** → **no trump** this round.
- A **number card** → its suit is trump.

(The Werewolf-in-*hand* case is the pre-bid swap of §7.1.3, distinct from the Werewolf being the *flipped* card here — see the edge case in §7.1.3.)

### 7.4 Scoring (`scoring.ts`)

- **Correct bid:** `20 + 10 × bid` points. (Bid 0, won 0 → 20. Bid 3, won 3 → 50.)
- **Wrong bid:** `−10 × |tricksWon − bid|`.
- Tricks set aside by a Bomb count toward **no** bid.
- Scores are integers; display as plain numbers (no chip simulation).

### 7.5 Special-card detail (cross-check against rulebook §"The special cards")

Implement each as a `CardBehavior`. Summary of the non-obvious bits:
- **Dragon** — highest; led like a Wizard; flipped → chooseTrump.
- **Fairy** — lowest, except beats Dragon when both present; led like a Jester; flipped → noTrump.
- **Bomb** — voids the trick (no winner, counts for nobody); would-be winner leads next; led like a Jester; flipped → noTrump.
- **Werewolf** — **in hand:** mandatory pre-bid swap + choose trump (see §7.1.3 edge case); **flipped:** chooseTrump.
- **Juggler** — 7½ announced suit; after the trick, **each player chooses a card to pass clockwise** (collective `jugglerPass` decision; not on the last trick); led → announced suit must be followed; flipped → chooseTrump.
- **Cloud** — 9¾ announced suit; winner adjusts own bid ±1 (none if Bomb present; +1 only if at 0); if Cloud + Juggler in same trick, **Juggler passes first, then Cloud adjusts**; led → announced suit followed; flipped → chooseTrump.
- **Witch** — below Fairy and Jester; resolves after the winner is settled; swap one hand card for any non-Witch trick card; led like a Jester; flipped → noTrump.
- **Vampire** — at play, copies the round's flipped trump-determining card and all its effects; if that card was the Werewolf, playing the Vampire flips a fresh trump card that applies from that trick to round end; if a Wizard-equivalent is revealed, the player chooses trump; never forced to follow suit even when copying a trump; led → follow rules of the copied card; flipped → chooseTrump.
- **Shapeshifter** — declared as Wizard or Jester on play, then behaves as that; flipped → chooseTrump.

### 7.6 Player departures mid-game (leave or host-removal)

A player can leave (`room:leave`) or be removed by the host (`host:removePlayer`) at any time. Handle both identically:

- **In the lobby:** the seat is simply freed; remaining players re-seat as normal.
- **Mid-game, leaving 3+ active players → the game continues short-handed:**
  - If a **round is in progress** (any phase from `dealing` through `scoring` for the current round), that round is **voided** — discard its bids, tricks, won counts, trump card, and any pending decisions — and the **same round number is re-dealt** to the remaining active players (full reshuffle), then play resumes. **No scores are recorded for the voided round.**
  - The **original total round count is preserved** (a 4-player game stays a 15-round game even after dropping to 3). The same per-round card counts are dealt to fewer players, so there are always enough cards (the per-round deal only shrinks).
  - **Seat indices stay stable**; turn order, bidding order, and start-marker rotation **skip departed (`inPlay:false`) seats**. If the start marker or current lead sat on the departed seat, it moves to the next active seat clockwise.
  - Already-scored earlier rounds are untouched. The departed player stays in the **scoreboard history** marked `inPlay:false`, but is excluded from further play and cannot win.
  - Emit `peer:left`; the authoritative change is reflected in `state:update`.
- **Mid-game, leaving fewer than 3 active players → the game ends:** emit `game:over` with the standings so far (Wizard isn't playable below 3).

A departed player's session token is invalidated; if they reconnect they get the session-gone error and return to Landing (mid-game joins are rejected). They can rejoin only after a Play Again returns the room to the lobby.

*(Design note: voiding + re-dealing the current round is chosen over trying to finish a round with a player gone mid-trick, which would leave partial hands and uneven tricks. It is the clean, bug-resistant option.)*

---

## 8. Phased build plan

Each phase lists its **goal**, **deliverables**, and a **runnable acceptance gate**. Do not proceed past a failing gate. Write tests in the same phase as the code.

### Phase 0 — Scaffold & contracts
**Goal:** working monorepo, all shared contracts compiling, tooling green.
**Deliverables:** root workspace config + scripts (`dev`, `build`, `test`, `lint`); `@wizarden/shared` with §6.1–6.4 types and §1/§7.1 constants (incl. the fixed rounds-per-player-count table and `ROUND_SUMMARY_MS`) fully written; stub `@wizarden/server` (health route) and `@wizarden/client` (renders "Wizarden") that both import a type from `shared`; strict TS; Vitest configured in server and client.
**Gate (runnable):** `pnpm build` and `pnpm test` exit 0 from a clean install; a trivial Vitest test in `shared`/`server`/`client` passes; a test asserts `shared` types are importable from both server and client stub.

### Phase 1 — Deck (engine)
**Goal:** correct deck construction, deterministic shuffle/deal, reshuffle-per-round.
**Deliverables:** `engine/rng.ts` (seedable), `engine/deck.ts` (build 60-card base deck; add the selected specials; **enforce Dragon⇔Fairy paired**; **reshuffle the full deck at the start of each round** via injected RNG; deal n per active player + form pile + flip trump card).
**Gate:** Vitest — base deck is exactly 60 with correct composition; selecting `['dragon','fairy','bomb']` yields 63 and including only one of Dragon/Fairy throws; a fixed seed reproduces identical hands + flipped card across runs; dealing round *n* gives every player n cards and the pile holds the rest; **for each player count the full final round deals exactly 60 cards** (base → pile empty / no trump; with specials → pile holds the specials / trump flipped); dealing the same round number to fewer players still succeeds with a larger leftover pile.

### Phase 2 — Base-game engine (no specials)
**Goal:** a full game playable end-to-end in the engine with **only** number/Wizard/Jester cards.
**Deliverables:** `engine/round.ts`, `engine/trick.ts` (base path), `engine/scoring.ts`, `engine/game.ts` aggregate (lobby→rounds→gameOver, **round count from the fixed table set at game start**, start-marker rotation that **skips inactive seats**, a pure **`advanceRound` transition** — the engine has no timer; the server schedules the auto-advance). Legal-move validation (follow suit; Wizard/Jester anytime). Trick winner (first Wizard / highest trump / highest led suit; only-Jesters → first Jester wins). Bidding order from clockwise of start marker.
**Gate:** Vitest — scripted round with hand-authored cards produces the exact expected trick winners and exact scores (correct = 20+10×bid, wrong = −10×off); illegal play (not following suit when able) is rejected; a complete seeded multi-round game runs to `gameOver` via the `advanceRound` transition with the **correct number of rounds per player count** and correct final standings; Wizard-led and Jester-led lead rules verified; **final-round-no-trump (base game)** verified; start-marker rotation skips a seat marked inactive.

### Phase 3 — Special cards + interaction pipeline
**Goal:** all 9 specials implemented as `CardBehavior` plug-ins; the ordered resolver (§7.2); mandatory/auto timing (Werewolf pre-bid, Vampire identity, Cloud adjust, Juggler collective pass, Witch swap); the full pending-decision flow (single-owner + collective).
**Deliverables:** `cards/types.ts`, `cards/registry.ts`, the nine `cards/*.ts`; resolver upgraded to drive behaviors in the fixed order and to be **resumable** across `cloudAdjust`/`witchSwap`/`jugglerPass`; `round.ts` pre-bid Werewolf step (incl. the §7.1.3 edge case); trump-on-flip mapping (§7.3); retention of the round's trump-determining card; extended-game last-round-has-trump.
**Gate (must include these exact interaction tests):**
- Dragon beats a Wizard; Fairy beats Dragon when both present; Fairy otherwise lowest.
- **AMIGO five-card example:** a trick containing Fairy + Dragon + Juggler + Bomb + Witch resolves correctly — Fairy is would-be winner, Bomb voids the trick, would-be winner leads next, every player passes a chosen card left (Juggler collective decision), then the Witch swap occurs.
- **Juggler collective pass:** a `jugglerPass` decision is raised for every seat with cards; the pass executes only after all submit; no pass on the last trick of a round.
- Cloud + Bomb → no bid change; Cloud + Juggler → pass happens before the ±1; Cloud winner at bid 0 can only +1.
- Werewolf in hand → bidding is blocked until the mandatory swap + trump choice resolves; Werewolf as flipped card → chooseTrump; Wizard flipped + Werewolf in hand → Werewolf choice supersedes (§7.1.3).
- Vampire copies a flipped number card's trump; Vampire copies a flipped special's effects; Vampire when the flipped card was the Werewolf flips a fresh trump for the rest of the round.
- Each special as the flipped trump card maps to chooseTrump/noTrump per §7.3.
- A full seeded game with **all** specials enabled runs to `gameOver` without error, with a trump card in the final round.
- Resolver order is pinned by tests so any change is caught.

### Phase 4 — Server: rooms, sessions, protocol (no reconnect/bots yet)
**Goal:** play a full game over Socket.IO with multiple independent rooms and per-player redaction, including the auto-advance.
**Deliverables:** `index.ts` (Express + Socket.IO + CORS from `CLIENT_ORIGIN` + health route); `rooms/roomManager.ts` (create/find; **generate unique short room codes — 4–6 uppercase alphanumerics, excluding ambiguous chars like O/0/I/1, regenerate on collision**; reap empty rooms), `rooms/room.ts` (wraps a `Game`; **schedules the `ROUND_SUMMARY_MS` auto-advance** by invoking the engine's `advanceRound`), `rooms/sessions.ts` (token↔seat); `net/handlers.ts` (all §6.4 C→S events → engine actions, with seat/turn/legality validation server-side; `room:join` rejected once a game is in progress); `net/broadcast.ts` (redact `GameState`→`ClientGameState` per seat — never leak other hands).
**Gate:** Vitest integration with in-process `socket.io-client` — create a room, three clients join, configure specials, start, and play a full scripted game to `game:over` purely via events, with rounds **auto-advancing** after the delay, asserting each client's redacted `state:update` (own hand present, others' hidden); out-of-turn, illegal, and mid-game-join intents are rejected with `error`; two rooms run simultaneously without cross-talk.

### Phase 5 — Disconnect / reconnect / host migration / departures
**Goal:** robust to mobile drops and to players leaving for good.
**Deliverables:** `net/reconnect.ts` — on disconnect, keep the seat (`connected:false`), broadcast `peer:disconnected`; **set `paused` + emit `game:paused` if the game is waiting on that seat** (its turn, or it owes any outstanding decision incl. a collective `jugglerPass`); off-turn disconnects do not pause. On `room:rejoin` with a valid token, restore the seat, push full `state:update` (and re-emit any owned `decision:prompt`), `game:resumed`. On invalid/expired/removed token → distinct `error` so the client clears it and returns to Landing. Host auto-migration when the host disconnects (next connected active seat by order). **Departures per §7.6:** `room:leave` and `host:removePlayer` both → if 3+ active remain, void any in-progress round and re-deal the same round number to the remaining active players and continue (start marker/lead/turn skip departed seats; total rounds preserved; `inPlay:false`; token invalidated; emit `peer:left`); if fewer than 3 active remain, end the game with `game:over`. No fixed kick timeout — host decides.
**Gate:** Vitest integration — a client disconnects mid-trick **on its turn** → `paused` true → reconnects via token → state restored, owned pending decision re-prompted, game continues; disconnect **off-turn** → no pause, game proceeds, reconnect catches up; a client owing a `jugglerPass` disconnects → pause until it returns and submits; host disconnect → host migrates; **mid-game leave/removal with 4→3 active voids the current round, re-deals the same round number to the 3 remaining, and the game continues to its original total rounds**; a leave/removal that drops to 2 active ends the game with standings; the start marker moves off a departed seat; a departed player's token is rejected on rejoin.

### Phase 6 — Bots (debug only)
**Goal:** testability without humans.
**Deliverables:** `bots/randomBot.ts` — fills a seat when `ENABLE_DEBUG` is set; makes legal bids (random 0..n) and legal plays, and resolves all `PendingDecision` kinds with random valid choices (Shapeshifter mode, announced suit, ±1 adjust, witch take/give, **juggler card to pass**, trump choice). Wire `lobby:addBot`/`removeBot` behind the debug guard.
**Gate:** a test/script runs a full game with **all-bot** seats to `game:over` over the real server with all specials enabled (rounds auto-advance; the Juggler collective pass completes with bots); and a one-human + bots game completes. No bot makes an illegal move across the run.

### Phase 7 — Client: connection & lobby
**Goal:** create/join, lobby, special-card config, reconnect UX.
**Deliverables:** `net/socket.ts` (connect using `VITE_SERVER_URL`, persist token in localStorage, auto-`room:rejoin` on load/reconnect, **on rejoin-failure clear the token and route to Landing**, expose connection status); `store/gameStore.ts` (Zustand, mirrors `ClientGameState`); `screens/Landing` (name + create/join by code or link), `screens/Lobby` (live player list, host controls, `components/SpecialCardPicker` enforcing Dragon⇔Fairy paired, Start enabled at 3–6 seats — 2 only when `VITE_ENABLE_DEBUG`), `components/ConnectionBanner` (reconnecting/paused/returned-to-landing states). Shareable link that pre-fills the room code.
**Gate:** manual + component test — open two browser contexts, create in one and join in the other by link, see the lobby update live, configure specials (picker blocks unpaired Dragon/Fairy and Start below 3), start the game; refreshing a lobby tab rejoins the same seat; a stale token routes cleanly back to Landing.

### Phase 8 — Client: gameplay UI (portrait mobile)
**Goal:** play a full game on a phone-sized screen, all interactions covered.
**Deliverables:** `screens/Game` portrait layout — `components/Hand` (fanned, bottom; illegal cards visibly disabled; sensible suit/value sort), `components/TrickArea` (centre, cards slide in), `components/OpponentSeat` (top/edges: name, bid, tricks-won, connection dot, "left" state, turn highlight, "still to decide" marker from `awaitingDecisionSeats`), `components/TrumpIndicator` (always visible), `components/BidInput` (tap 0..n), `components/DecisionPrompt` (renders every `PendingDecision` kind: choose trump suit, werewolf swap+trump, cloud ±1, witch take/give, **juggler pick-a-card-to-pass**; plus play-time Shapeshifter declare and Juggler/Cloud announce-suit), `components/Scoreboard` (always-available popup/overlay button; per-round + totals; shows left players), **round-end summary that auto-advances after `ROUND_SUMMARY_MS`** (no manual control), `screens/GameOver` (standings + host **Play Again** → lobby, scores reset), `sound/placeCard.ts` (plays on each card placement; no other audio).
**Gate:** manual end-to-end on a mobile viewport — a full game (ideally human + bots) played entirely through the UI with all specials enabled: bids, legal-move gating, every decision prompt (including the collective Juggler pass), scoreboard popup, **auto-advancing** round summaries, game over, Play Again; a mid-game refresh restores the player into the live game; removing a player mid-game keeps the remaining 3+ playing.

### Phase 9 — End-to-end verification & deploy readiness
**Goal:** prove the whole thing and prepare Netlify/Render.
**Deliverables:** a documented full-playthrough script; confirm `VITE_SERVER_URL` / `VITE_ENABLE_DEBUG` / `CLIENT_ORIGIN` / `PORT` / `ENABLE_DEBUG` wiring; client production build for Netlify and server build for Render; cross-origin Socket.IO verified against env-configured URLs; health route reachable; README run/deploy notes; note the Render free-tier cold-start implication (in-memory state is lost if the service sleeps; stale tokens then route clients back to Landing) and that an in-progress game survives only while the service stays warm.
**Gate:** the documented end-to-end run passes locally with prod builds; client builds clean for Netlify and server for Render; a cross-origin connection succeeds using the env URLs (can be validated with a local prod-mode run pointing the client at the server origin).

---

## 9. Reconnect & robustness (consolidated requirements)

- **Identity:** server-issued session token, persisted client-side; `room:rejoin` restores the exact seat. Never identify a returning player by name alone.
- **Rejoin failure:** if the token/room is unknown (server restarted and lost in-memory state, or the seat was removed), return a distinct `error` code; the client clears the token and returns to Landing. Do not leave the client hanging on a dead session.
- **Seat retention on disconnect:** a disconnect never frees the seat automatically. The host alone acts on a disconnected player (`host:removePlayer`); no timeout.
- **Departures (leave / host-removal) — see §7.6:** in the **lobby**, the seat is freed. **Mid-game with 3+ active remaining**, the game continues short-handed: the in-progress round is voided and the same round number re-dealt to the remaining players; total rounds preserved; turn order and start marker skip departed seats; the departed player is marked `inPlay:false`, kept in scoreboard history, and cannot win. **Mid-game dropping below 3 active**, the game ends with standings.
- **Pause semantics:** pause **only** when the game is waiting on a disconnected seat — its turn, or it owes any outstanding decision (single-owner or a collective `jugglerPass`). Off-turn disconnects do not pause play.
- **State catch-up:** on rejoin, push the full current `ClientGameState` (and re-emit the owned `decision:prompt` if any). The client renders authoritative state; it does not replay missed deltas.
- **Host migration:** if the host disconnects, the host role moves to the next connected active seat by order; surface who the host is in the lobby/game.
- **Mid-game joins:** new players cannot join a game in progress (`room:join` rejected once past lobby); only `room:rejoin` for an existing seat works mid-game.
- **Socket.IO reconnection** handles transport-level drops; the app-level `room:rejoin` handles seat restoration on top of it. Both must work together (e.g. a phone backgrounded for a minute, then resumed).

---

## 10. Out of scope / do NOT do (v1)

- **No database / no persistence.** In-memory only; a server restart/sleep loses in-progress games. Do not add Postgres/SQLite/Redis.
- **No optional rule variants** (Plus/Minus One, Hidden Tip, Secret Prediction, Clairvoyance, Single Colour, Wizard Maximus). Standard rules only.
- **No accounts / auth / passwords.** Name + room code only.
- **No 2-human play mode in production.** Normal games are 3–6; the game ends if active players drop below 3. Two seats are allowed only behind the debug flag (for testing alongside bots).
- **No polished bot AI.** Bots are random-but-legal, debug-only.
- **No spectators, no in-game chat, no emotes.**
- **No audio other than the place-card sound.**
- **No turn timers** (the only timed behaviour is the fixed `ROUND_SUMMARY_MS` round-summary delay before auto-advance).
- **No use of AMIGO's actual card artwork or any copyrighted assets.** Build original visuals (see §11).
- **No client-side authority.** The client must not compute trick winners, legality, or scores; it only renders server state and sends intents.
- **No keep-alive/ping hack required** for v1 (may be noted as a future option, not built).

---

## 11. Conventions

- **TypeScript strict** across all packages; no `any` in cross-boundary contracts.
- **Single source of truth:** all shared shapes live in `@wizarden/shared`; do not duplicate types in client or server.
- **Engine purity:** `server/src/engine/**` imports only `@wizarden/shared` (no IO/transport/timers). Enforced in review.
- **Cards are additive:** new/changed special cards are isolated `CardBehavior` files + a registry entry; never branch on card identity in the resolver or round code.
- **Tests:** Vitest; engine logic covered by deterministic unit tests; server covered by `socket.io-client` integration tests; tests written within the phase they cover.
- **Visuals:** number cards flat/minimal (clean coloured cards — suits red/blue/green/yellow — with large readable 1–13); the special cards may be visually distinctive/decorative. All original.
- **Mobile-first portrait** layout is the primary target.
- **Debug gating:** anything debug-only (bots, 2-seat start) is gated behind `ENABLE_DEBUG` (server) / `VITE_ENABLE_DEBUG` (client) and is fully inert in production builds.
- **Versioning & delivery:** bump the project version on every change and name any delivered build artifact/zip after its internal version number (e.g. `wizarden-1.0.0.zip`), per standing convention.
- **Hub-and-spoke `CLAUDE.md`:** keep the repo-root `CLAUDE.md` lean (stack, build/run commands, conventions, standing preferences). This spec is the feature reference; do not duplicate it into `CLAUDE.md`.
- **Surface assumptions:** if you must assume anything not nailed down here, state it in code comments and in your build summary rather than deciding silently.

---

## 12. Definition of done (v1)

3–6 players on phones can create/join a room by code or link, the host can choose which special cards are in play (with Dragon and Fairy paired), and the group can play a complete, fully rules-enforced game of Wizard (30-Year Edition) — the correct fixed number of rounds for the initial player count, all 9 special cards and their interactions working per §7 — with correct scoring, an always-available scoreboard, **round summaries that advance automatically**, and a Play Again that resets to the lobby. Players who drop keep their seats and rejoin into the live game; **if a player leaves or is removed mid-game the game continues short-handed (re-dealing the current round) as long as 3+ players remain, otherwise it ends with standings**; the host role migrates if the host drops; stale sessions route cleanly back to Landing. The engine is pure and unit-tested; the server is integration-tested over real sockets; the special-card resolution order is centralized and pinned by tests. The client deploys to Netlify and the server to Render via env-configured URLs.
