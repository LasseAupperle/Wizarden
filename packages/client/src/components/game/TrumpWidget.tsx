import type { ClientGameState } from '@wizarden/shared';
import { CardView, type CardSize } from '../CardView.js';
import { SUIT_META } from '../../lib/specials.js';
import { suitName } from '../../lib/cardNames.js';
import { useT } from '../../lib/i18n.js';
import { cn } from '../../lib/cn.js';

/** The flipped trump card + the resulting trump colour (or "No trump"). The one
 *  and only trump indicator — always on the table during a round. */
export function TrumpWidget({
  game,
  size = 'sm',
  className,
}: {
  game: ClientGameState;
  size?: CardSize;
  className?: string;
}) {
  const t = useT();
  return (
    <div className={cn('flex flex-col items-center gap-1', className)}>
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
        {t('trump')}
      </span>
      {game.trumpCard ? (
        <CardView card={game.trumpCard} size={size} />
      ) : (
        <span className="flex h-[3.85rem] w-11 items-center justify-center rounded-card border border-dashed border-line text-center text-[9px] leading-tight text-muted">
          –
        </span>
      )}
      {game.trumpSuit ? (
        <span
          className="whitespace-nowrap text-[11px] font-bold"
          style={{ color: `var(--suit-${game.trumpSuit})` }}
        >
          {SUIT_META[game.trumpSuit].glyph} {suitName(t, game.trumpSuit)}
        </span>
      ) : (
        <span className="whitespace-nowrap text-[11px] font-semibold text-muted">
          {t('noTrump')}
        </span>
      )}
    </div>
  );
}
