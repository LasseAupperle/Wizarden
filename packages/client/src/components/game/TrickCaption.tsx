import type { ClientGameState } from '@wizarden/shared';
import { Crown } from 'lucide-react';
import { useT } from '../../lib/i18n.js';
import { nameOf } from './helpers.js';

/** "Bob wins the trick" under a held (finished) trick. */
export function TrickCaption({ game }: { game: ClientGameState }) {
  const t = useT();
  const lt = game.lastTrick;
  if (!lt) return null;
  const text =
    lt.winnerSeat == null
      ? t('noOneWins')
      : lt.winnerSeat === game.yourSeat
        ? t('youWinTrick')
        : t('winsTrick', { name: nameOf(game, lt.winnerSeat) });
  return (
    <p
      className="animate-pop flex items-center justify-center gap-1.5 rounded-full border border-gold/50 bg-gold/15 px-3 py-1 text-sm font-semibold text-gold"
      role="status"
    >
      {lt.winnerSeat != null && <Crown size={15} aria-hidden />}
      {text}
    </p>
  );
}
