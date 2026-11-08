import type { ClientGameState, PlayerPublic } from '@wizarden/shared';
import { Flag, Hourglass } from 'lucide-react';
import { useT } from '../../lib/i18n.js';
import { cn } from '../../lib/cn.js';

/** One player's public status: name, bid · won, total points, plus turn,
 *  deciding, first-to-bid, disconnected and left markers. */
export function PlayerChip({
  game,
  player: p,
  large,
}: {
  game: ClientGameState;
  player: PlayerPublic;
  large?: boolean;
}) {
  const t = useT();
  const turn = game.currentTurnSeat === p.seat && !game.lastTrick;
  const deciding = game.awaitingDecisionSeats.includes(p.seat);
  const starts = game.startMarkerSeat === p.seat && game.phase === 'bidding';
  const held = game.lastTrick?.winnerSeat === p.seat;
  return (
    <div
      className={cn(
        'min-w-0 rounded-ui border text-center',
        large ? 'px-3 py-2 text-sm' : 'px-2 py-1 text-[11px]',
        held
          ? 'border-gold bg-gold/15'
          : turn
            ? 'animate-turn border-accent bg-accent/15'
            : 'border-line bg-elevated',
        !p.inPlay && 'opacity-50',
      )}
    >
      <div className="flex items-center justify-center gap-1 font-semibold text-ink">
        <span
          className={cn(
            'h-1.5 w-1.5 shrink-0 rounded-full',
            p.connected ? 'bg-positive' : 'bg-muted',
          )}
          aria-label={p.connected ? undefined : 'offline'}
        />
        <span className="truncate">{p.name}</span>
        {starts && <Flag size={11} className="shrink-0 text-gold" aria-label={t('starts')} />}
        {deciding && (
          <Hourglass size={11} className="shrink-0 text-accent" aria-label={t('deciding')} />
        )}
      </div>
      {p.inPlay ? (
        <>
          <div className="whitespace-nowrap text-muted">
            {t('bidShort')} <b className="text-ink">{p.bid ?? '–'}</b> · {t('wonShort')}{' '}
            <b className="text-ink">{p.tricksWon}</b>
          </div>
          <div className="whitespace-nowrap font-semibold text-gold">
            {p.totalScore} {t('points')}
          </div>
        </>
      ) : (
        <div className="text-muted">({t('left')})</div>
      )}
    </div>
  );
}

/** Your own status line above the hand. */
export function YourStatus({ game, hint }: { game: ClientGameState; hint?: string | null }) {
  const t = useT();
  const you = game.players.find((p) => p.seat === game.yourSeat);
  const yourTurn =
    !game.lastTrick &&
    game.currentTurnSeat === game.yourSeat &&
    (game.phase === 'trick' || game.phase === 'bidding');
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm">
      <span className="font-semibold text-ink">{you?.name}</span>
      <span className="text-muted">
        {t('bidShort')} <b className="text-ink">{you?.bid ?? '–'}</b> · {t('wonShort')}{' '}
        <b className="text-ink">{you?.tricksWon ?? 0}</b> ·{' '}
        <b className="text-gold">
          {you?.totalScore ?? 0} {t('points')}
        </b>
      </span>
      {yourTurn && (
        <span className="rounded-full bg-grad-accent px-2.5 py-0.5 text-xs font-bold text-white shadow-card">
          {t('yourTurn')}
        </span>
      )}
      {hint && <span className="text-xs text-accent">{hint}</span>}
    </div>
  );
}
