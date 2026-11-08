import type { ClientGameState } from '@wizarden/shared';
import { useT } from '../../lib/i18n.js';
import { cn } from '../../lib/cn.js';
import { nameOf } from './helpers.js';

/** Round-end summary: bid → won → points → new total, ranked by total. */
export function RoundSummary({ game, countdown }: { game: ClientGameState; countdown: number }) {
  const t = useT();
  const rows = [...(game.lastRoundResult ?? [])].sort((a, b) => b.total - a.total);
  const last = game.roundNumber >= game.totalRounds;
  return (
    <div className="animate-pop w-[min(22rem,calc(100vw-2rem))] rounded-ui border border-line bg-elevated p-4 shadow-card">
      <h3 className="mb-2 text-center font-display text-lg text-ink">
        {t('roundN', { n: game.roundNumber })}
      </h3>
      <table className="w-full text-sm tabular-nums [&_td]:px-1 [&_th]:px-1">
        <thead>
          <tr className="text-[11px] uppercase tracking-wide text-muted">
            <th className="w-5 py-1 text-left font-semibold">#</th>
            <th className="py-1 text-left font-semibold" />
            <th className="py-1 text-right font-semibold">{t('colBid')}</th>
            <th className="py-1 text-right font-semibold">{t('colWon')}</th>
            <th className="py-1 text-right font-semibold">{t('colPoints')}</th>
            <th className="py-1 text-right font-semibold">{t('colTotal')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.seat} className="border-t border-line">
              <td className="py-1 text-muted">{i + 1}</td>
              <td
                className={cn(
                  'max-w-[6rem] truncate py-1',
                  r.seat === game.yourSeat ? 'font-semibold text-ink' : 'text-muted',
                )}
              >
                {nameOf(game, r.seat)}
              </td>
              <td className="py-1 text-right text-ink">{r.bid}</td>
              <td className="py-1 text-right text-ink">{r.tricksWon}</td>
              <td
                className={cn(
                  'py-1 text-right font-bold',
                  r.delta >= 0 ? 'text-positive' : 'text-negative',
                )}
              >
                {r.delta >= 0 ? `+${r.delta}` : r.delta}
              </td>
              <td className="py-1 text-right font-semibold text-ink">{r.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-center text-xs text-muted">
        {last ? t('finalScores') : t('nextRoundIn', { n: countdown })}
      </p>
    </div>
  );
}
