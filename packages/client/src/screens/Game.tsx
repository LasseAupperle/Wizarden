import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { SUITS, type Card, type ClientGameState, type PendingDecision, type Suit } from '@wizarden/shared';
import { TopBar } from '../components/TopBar.js';
import { Button } from '../components/ui/Button.js';
import { Badge } from '../components/ui/Badge.js';
import { Sheet } from '../components/ui/Modal.js';
import { Scoreboard } from '../components/Scoreboard.js';
import { CardView, cardLabel } from '../components/CardView.js';
import { SUIT_META } from '../lib/specials.js';
import { intents } from '../net/socket.js';
import { playPlaceCard } from '../sound/placeCard.js';
import { cn } from '../lib/cn.js';

function ledSuitOf(trick: ClientGameState['currentTrick']): { suit: Suit | null; freed: boolean } {
  for (const p of trick) {
    if (p.card.kind === 'wizard') return { suit: null, freed: true };
    if (p.card.kind === 'number') return { suit: p.card.suit, freed: false };
  }
  return { suit: null, freed: false };
}

function isPlayable(card: Card, hand: Card[], trick: ClientGameState['currentTrick']): boolean {
  if (card.kind !== 'number') return true;
  const { suit, freed } = ledSuitOf(trick);
  if (freed || suit === null || card.suit === suit) return true;
  return !hand.some((c) => c.kind === 'number' && c.suit === suit);
}

const KIND_ORDER: Record<Card['kind'], number> = { jester: 0, number: 1, special: 2, wizard: 3 };
const SUIT_ORDER: Record<Suit, number> = { red: 0, blue: 1, green: 2, yellow: 3 };

/** Stable, readable hand order: by kind, then suit, then value. */
function sortHand(hand: Card[]): Card[] {
  return [...hand].sort((a, b) => {
    if (a.kind !== b.kind) return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    if (a.kind === 'number' && b.kind === 'number') {
      return SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit] || a.value - b.value;
    }
    return a.id.localeCompare(b.id);
  });
}

function SuitRow({ onPick, extra }: { onPick: (s: Suit) => void; extra?: ReactNode }) {
  return (
    <div className="flex flex-wrap gap-2">
      {SUITS.map((s) => (
        <Button key={s} variant="secondary" onClick={() => onPick(s)}>
          {SUIT_META[s].glyph} {SUIT_META[s].label}
        </Button>
      ))}
      {extra}
    </div>
  );
}

export function Game({ game }: { game: ClientGameState }) {
  const [scoreOpen, setScoreOpen] = useState(false);
  const [announceCard, setAnnounceCard] = useState<Card | null>(null);
  const [witchTake, setWitchTake] = useState<string | null>(null);

  const you = game.players.find((p) => p.seat === game.yourSeat);
  const opponents = game.players.filter((p) => p.seat !== game.yourSeat);
  const yourTurnToPlay = game.phase === 'trick' && game.currentTurnSeat === game.yourSeat;
  const yourTurnToBid = game.phase === 'bidding' && game.currentTurnSeat === game.yourSeat;
  const decision = game.pendingDecision;

  // place-card sound on every card that lands in the trick (yours and others')
  const trickLen = game.currentTrick.length;
  const prevTrickLen = useRef(trickLen);
  useEffect(() => {
    if (trickLen > prevTrickLen.current) playPlaceCard();
    prevTrickLen.current = trickLen;
  }, [trickLen]);

  // screen-reader announcements (§19)
  const announce = useMemo(() => {
    if (game.paused) return `Paused, waiting for ${game.pausedForName ?? 'a player'}`;
    if (decision) return `Your decision: ${decision.kind}`;
    if (yourTurnToBid) return 'Your turn to bid';
    if (yourTurnToPlay) return 'Your turn to play';
    if (game.phase === 'roundEnd') return `Round ${game.roundNumber} scored`;
    return '';
  }, [game.paused, game.pausedForName, decision, yourTurnToBid, yourTurnToPlay, game.phase, game.roundNumber]);

  const play = (card: Card) => {
    if (card.kind === 'special' && card.special === 'shapeshifter') return setAnnounceCard(card);
    if (card.kind === 'special' && (card.special === 'juggler' || card.special === 'cloud'))
      return setAnnounceCard(card);
    playPlaceCard();
    intents.play(card.id, { type: 'none' });
  };

  const trumpChip = game.trumpSuit ? (
    <Badge tone="accent">
      {SUIT_META[game.trumpSuit].glyph} {SUIT_META[game.trumpSuit].label}
    </Badge>
  ) : (
    <Badge>no trump</Badge>
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar
        center={
          <span className="flex items-center justify-center gap-2 text-sm">
            R{game.roundNumber}/{game.totalRounds} {trumpChip}
          </span>
        }
        right={
          <Button size="md" variant="secondary" onClick={() => setScoreOpen(true)}>
            📊
          </Button>
        }
      />

      <div className="sr-only" role="status" aria-live="polite">
        {announce}
      </div>

      {/* opponents */}
      <div className="flex flex-wrap justify-center gap-2 p-3">
        {opponents.map((p) => (
          <div
            key={p.seat}
            className={cn(
              'rounded-ui border px-3 py-1.5 text-center text-xs',
              game.currentTurnSeat === p.seat
                ? 'border-accent bg-accent/15 animate-turn'
                : 'border-line bg-elevated',
            )}
          >
            <div className="flex items-center gap-1 font-semibold text-ink">
              <span className={`h-1.5 w-1.5 rounded-full ${p.connected ? 'bg-positive' : 'bg-muted'}`} />
              {p.name}
              {!p.inPlay && <span className="text-muted">(left)</span>}
              {game.awaitingDecisionSeats.includes(p.seat) && <span aria-label="deciding">⏳</span>}
            </div>
            <div className="text-muted">
              {p.bid ?? '–'} / {p.tricksWon} · {p.totalScore}
            </div>
          </div>
        ))}
      </div>

      {/* trick area — a faint violet "table" glow so the centre reads as a surface */}
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4 bg-[radial-gradient(60%_45%_at_50%_42%,rgba(124,92,255,0.10),transparent_70%)]">
        {game.phase === 'roundEnd' && game.lastRoundResult ? (
          <div className="rounded-ui border border-line bg-elevated p-4 text-center">
            <div className="mb-1 font-display text-ink">Round {game.roundNumber}</div>
            {game.lastRoundResult.map((r) => (
              <div key={r.seat} className="text-sm">
                <span className="text-muted">{game.players.find((p) => p.seat === r.seat)?.name}: </span>
                <span className={r.delta >= 0 ? 'text-positive' : 'text-negative'}>
                  {r.delta >= 0 ? `+${r.delta}` : r.delta}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex min-h-[6rem] flex-wrap items-center justify-center gap-2">
            {game.currentTrick.map((p) => (
              <div key={p.card.id} className="animate-card-in flex flex-col items-center">
                <CardView card={p.card} />
                <span className="mt-1 text-[10px] text-muted">
                  {game.players.find((pl) => pl.seat === p.seat)?.name}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* your status + hand */}
      <div className="border-t border-line p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="mb-2 flex items-center justify-center gap-2 text-sm text-muted">
          <span className="font-semibold text-ink">{you?.name}</span>
          <Badge tone="accent">bid {you?.bid ?? '–'}</Badge>
          <Badge>won {you?.tricksWon ?? 0}</Badge>
          <Badge tone="gold">{you?.totalScore ?? 0}</Badge>
          {yourTurnToPlay && <Badge tone="positive">your turn</Badge>}
        </div>
        <div className="flex flex-wrap justify-center gap-1.5">
          {sortHand(game.yourHand).map((card) => (
            <CardView
              key={card.id}
              card={card}
              onClick={() => play(card)}
              disabled={!yourTurnToPlay || !isPlayable(card, game.yourHand, game.currentTrick)}
            />
          ))}
        </div>
      </div>

      {/* bid sheet */}
      <Sheet open={yourTurnToBid} onClose={() => {}} title="Your bid">
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: game.roundNumber + 1 }, (_, n) => (
            <Button key={n} variant="secondary" onClick={() => intents.bid(n)}>
              {n}
            </Button>
          ))}
        </div>
      </Sheet>

      {/* decision sheet */}
      <Sheet open={!!decision} onClose={() => {}} title="Your decision">
        {decision && (
          <DecisionPrompt
            decision={decision}
            game={game}
            witchTake={witchTake}
            setWitchTake={setWitchTake}
          />
        )}
      </Sheet>

      {/* announce / declare sheet */}
      <Sheet open={!!announceCard} onClose={() => setAnnounceCard(null)} title={announceCard ? cardLabel(announceCard) : ''}>
        {announceCard && announceCard.kind === 'special' && announceCard.special === 'shapeshifter' && (
          <div className="flex gap-2">
            {(['wizard', 'jester'] as const).map((as) => (
              <Button
                key={as}
                fullWidth
                onClick={() => {
                  playPlaceCard();
                  intents.play(announceCard.id, { type: 'shapeshifter', as });
                  setAnnounceCard(null);
                }}
              >
                {as}
              </Button>
            ))}
          </div>
        )}
        {announceCard && announceCard.kind === 'special' && announceCard.special !== 'shapeshifter' && (
          <SuitRow
            onPick={(suit) => {
              playPlaceCard();
              intents.play(announceCard.id, { type: 'announceSuit', suit });
              setAnnounceCard(null);
            }}
          />
        )}
      </Sheet>

      <Scoreboard game={game} open={scoreOpen} onClose={() => setScoreOpen(false)} />
    </div>
  );
}

function DecisionPrompt({
  decision,
  game,
  witchTake,
  setWitchTake,
}: {
  decision: PendingDecision;
  game: ClientGameState;
  witchTake: string | null;
  setWitchTake: (id: string | null) => void;
}) {
  const you = game.players.find((p) => p.seat === game.yourSeat);

  if (decision.kind === 'chooseTrump') {
    return (
      <>
        <p className="mb-2 text-muted">Choose the trump colour.</p>
        <SuitRow onPick={(suit) => intents.resolve({ suit })} />
      </>
    );
  }
  if (decision.kind === 'werewolfSwap') {
    return (
      <>
        <p className="mb-2 text-muted">Swap the Werewolf and set trump.</p>
        <SuitRow
          onPick={(suit) => intents.resolve({ suit })}
          extra={
            <Button variant="ghost" onClick={() => intents.resolve({ suit: null })}>
              No trump
            </Button>
          }
        />
      </>
    );
  }
  if (decision.kind === 'cloudAdjust') {
    const bid0 = (you?.bid ?? 0) === 0;
    return (
      <>
        <p className="mb-2 text-muted">Adjust your bid by ±1.</p>
        <div className="flex gap-2">
          <Button onClick={() => intents.resolve({ delta: 1 })}>+1</Button>
          <Button variant="secondary" disabled={bid0} onClick={() => intents.resolve({ delta: -1 })}>
            −1
          </Button>
        </div>
      </>
    );
  }
  if (decision.kind === 'jugglerPass') {
    return (
      <>
        <p className="mb-2 text-muted">Pass one card clockwise.</p>
        <div className="flex flex-wrap gap-1.5">
          {game.yourHand.map((c) => (
            <CardView key={c.id} card={c} size="sm" onClick={() => intents.resolve({ cardId: c.id })} />
          ))}
        </div>
      </>
    );
  }
  // witchSwap
  const takeCards = game.currentTrick.filter((p) => decision.trickCardIds.includes(p.card.id));
  return (
    <>
      <p className="mb-2 text-muted">{witchTake ? 'Give one of your cards.' : 'Take a card from the trick.'}</p>
      {!witchTake ? (
        <div className="flex flex-wrap gap-1.5">
          {takeCards.map((p) => (
            <CardView key={p.card.id} card={p.card} size="sm" onClick={() => setWitchTake(p.card.id)} />
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {game.yourHand.map((c) => (
            <CardView
              key={c.id}
              card={c}
              size="sm"
              onClick={() => {
                intents.resolve({ takeId: witchTake, giveId: c.id });
                setWitchTake(null);
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}
