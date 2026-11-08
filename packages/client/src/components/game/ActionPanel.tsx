import { SUITS, type Card, type ClientGameState, type Suit } from '@wizarden/shared';
import { Hourglass } from 'lucide-react';
import { Button } from '../ui/Button.js';
import { CardView } from '../CardView.js';
import { SUIT_META } from '../../lib/specials.js';
import { cardName, suitName } from '../../lib/cardNames.js';
import { useT } from '../../lib/i18n.js';
import { intents } from '../../net/socket.js';
import { playPlaceCard } from '../../sound/placeCard.js';
import { nameOf } from './helpers.js';

function SuitRow({ onPick, extra }: { onPick: (s: Suit) => void; extra?: React.ReactNode }) {
  const t = useT();
  return (
    <div className="flex flex-wrap justify-center gap-1.5">
      {SUITS.map((s) => (
        <Button key={s} variant="secondary" onClick={() => onPick(s)}>
          <span style={{ color: `var(--suit-${s})` }} aria-hidden>
            {SUIT_META[s].glyph}
          </span>
          {suitName(t, s)}
        </Button>
      ))}
      {extra}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      className="animate-pop rounded-ui border border-accent/50 bg-elevated p-2.5 shadow-card"
      aria-label={title}
    >
      <h3 className="mb-1.5 text-center text-xs font-semibold uppercase tracking-wide text-accent">
        {title}
      </h3>
      {children}
    </section>
  );
}

interface Props {
  game: ClientGameState;
  /** A Shapeshifter / Juggler / Cloud you're about to play (needs a choice first). */
  announceCard: Card | null;
  onCancelAnnounce: () => void;
  witchTake: string | null;
  setWitchTake: (id: string | null) => void;
}

/**
 * Everything that asks you to choose, shown INLINE above your hand (never an
 * overlay), so your cards stay visible while you decide. Hand-pick decisions
 * (Juggler pass, Witch give) use the hand itself; this panel explains them.
 * Returns null when there is nothing to show.
 */
export function ActionPanel({
  game,
  announceCard,
  onCancelAnnounce,
  witchTake,
  setWitchTake,
}: Props) {
  const t = useT();
  const decision = game.pendingDecision;
  const you = game.players.find((p) => p.seat === game.yourSeat);
  const p = (text: string) => <p className="mb-2 text-center text-sm text-muted">{text}</p>;

  if (announceCard && announceCard.kind === 'special') {
    const play = (d: Parameters<typeof intents.play>[1]) => {
      playPlaceCard();
      intents.play(announceCard.id, d);
      onCancelAnnounce();
    };
    const cancel = (
      <Button variant="ghost" onClick={onCancelAnnounce}>
        {t('cancel')}
      </Button>
    );
    return (
      <Panel title={cardName(t, announceCard)}>
        {announceCard.special === 'shapeshifter' ? (
          <>
            {p(t('playAs'))}
            <div className="flex flex-wrap justify-center gap-1.5">
              <Button onClick={() => play({ type: 'shapeshifter', as: 'wizard' })}>
                {t('card_wizard')}
              </Button>
              <Button onClick={() => play({ type: 'shapeshifter', as: 'jester' })}>
                {t('card_jester')}
              </Button>
              {cancel}
            </div>
          </>
        ) : (
          <>
            {p(t('announceSuit'))}
            <SuitRow onPick={(suit) => play({ type: 'announceSuit', suit })} extra={cancel} />
          </>
        )}
      </Panel>
    );
  }

  if (decision) {
    if (decision.kind === 'chooseTrump') {
      return (
        <Panel title={t('yourDecision')}>
          {p(t('chooseTrump'))}
          <SuitRow onPick={(suit) => intents.resolve({ suit })} />
        </Panel>
      );
    }
    if (decision.kind === 'werewolfSwap') {
      return (
        <Panel title={t('yourDecision')}>
          {p(t('werewolfSwap'))}
          <SuitRow
            onPick={(suit) => intents.resolve({ suit })}
            extra={
              <Button variant="ghost" onClick={() => intents.resolve({ suit: null })}>
                {t('noTrump')}
              </Button>
            }
          />
        </Panel>
      );
    }
    if (decision.kind === 'cloudAdjust') {
      const bid = you?.bid ?? 0;
      return (
        <Panel title={t('yourDecision')}>
          {p(t('cloudAdjust'))}
          <div className="flex justify-center gap-2">
            <Button
              variant="secondary"
              disabled={bid === 0}
              onClick={() => intents.resolve({ delta: -1 })}
            >
              −1 → {Math.max(0, bid - 1)}
            </Button>
            <Button onClick={() => intents.resolve({ delta: 1 })}>+1 → {bid + 1}</Button>
          </div>
        </Panel>
      );
    }
    if (decision.kind === 'jugglerPass') {
      return <Panel title={t('yourDecision')}>{p(t('jugglerPass'))}</Panel>;
    }
    // witchSwap: first take a card from the trick, then give one from your hand.
    const takeCards = game.currentTrick.filter((pl) => decision.trickCardIds.includes(pl.card.id));
    const taken = takeCards.find((pl) => pl.card.id === witchTake)?.card;
    return (
      <Panel title={t('yourDecision')}>
        {!taken ? (
          <>
            {p(t('witchTake'))}
            <div className="flex flex-wrap justify-center gap-1.5">
              {takeCards.map((pl) => (
                <CardView
                  key={pl.card.id}
                  card={pl.card}
                  size="sm"
                  onClick={() => setWitchTake(pl.card.id)}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center gap-3">
            <CardView card={taken} size="sm" />
            <p className="text-sm text-muted">{t('witchGive')}</p>
            <Button variant="ghost" onClick={() => setWitchTake(null)}>
              {t('cancel')}
            </Button>
          </div>
        )}
      </Panel>
    );
  }

  // Someone else is deciding (or you already did your part of a collective one).
  const waiting = game.awaitingDecisionSeats.filter((s) => s !== game.yourSeat);
  if (waiting.length > 0) {
    const text =
      waiting.length === 1
        ? t('waitingFor', { name: nameOf(game, waiting[0]) })
        : t('waitingOthers');
    return (
      <p className="flex items-center justify-center gap-1.5 py-1 text-sm text-muted">
        <Hourglass size={14} aria-hidden /> {text}
      </p>
    );
  }
  return null;
}
