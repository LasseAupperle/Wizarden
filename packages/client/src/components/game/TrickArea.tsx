import type { ClientGameState } from '@wizarden/shared';
import { CardView } from '../CardView.js';
import { useT } from '../../lib/i18n.js';
import { cn } from '../../lib/cn.js';
import { nameOf } from './helpers.js';
import { TrickCaption } from './TrickCaption.js';

/** Phone trick area: the cards played this trick in order, or — while the server
 *  holds a finished trick — those cards with the winner highlighted. */
export function TrickArea({ game }: { game: ClientGameState }) {
  const t = useT();
  const held = game.lastTrick;
  const plays = held ? held.plays : game.currentTrick;
  // keep up to 6 cards on 2 rows on a phone: shrink cards beyond 4
  const size = plays.length > 4 ? 'sm' : 'md';
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex min-h-[6rem] flex-wrap items-end justify-center gap-2">
        {plays.map((p) => {
          const won = held?.winnerSeat === p.seat;
          return (
            <div key={p.card.id} className="animate-card-in flex flex-col items-center">
              <CardView card={p.card} size={size} winner={won} />
              <span
                className={cn(
                  'mt-1 max-w-[5rem] truncate text-[11px]',
                  won ? 'font-bold text-gold' : 'text-muted',
                )}
              >
                {p.seat === game.yourSeat ? t('you') : nameOf(game, p.seat)}
              </span>
            </div>
          );
        })}
      </div>
      <TrickCaption game={game} />
    </div>
  );
}
