import type { ClientGameState } from '@wizarden/shared';
import { useT } from '../../lib/i18n.js';
import { cn } from '../../lib/cn.js';

/** Per-round points with bids (round × player) + totals. Used by the scoreboard
 *  popup (phone) and the always-visible side panel (PC). */
export function ScoreTable({ game, compact }: { game: ClientGameState; compact?: boolean }) {
  const t = useT();
  const players = game.players;
  const dense = compact || players.length > 4;
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full border-collapse tabular-nums', dense ? 'text-xs' : 'text-sm')}>
        <thead>
          <tr className="text-muted">
            <th className="px-1.5 py-1 text-left">#</th>
            {players.map((p) => (
              <th
                key={p.seat}
                className={cn(
                  'max-w-[5rem] truncate px-1.5 py-1 text-right font-semibold',
                  p.seat === game.yourSeat && 'text-ink',
                )}
                title={p.name}
              >
                {p.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {game.scoreboard.map((round, i) => (
            <tr key={i} className="border-t border-line">
              <td className="px-1.5 py-1 text-muted">{i + 1}</td>
              {players.map((p) => {
                const r = round.find((x) => x.seat === p.seat);
                return (
                  <td key={p.seat} className="whitespace-nowrap px-1.5 py-1 text-right">
                    {r ? (
                      <>
                        <span
                          className={cn(
                            'font-semibold',
                            r.delta >= 0 ? 'text-positive' : 'text-negative',
                          )}
                        >
                          {r.delta >= 0 ? `+${r.delta}` : r.delta}
                        </span>
                        <span className="ml-1 text-[10px] text-muted" title={t('colBid')}>
                          {r.tricksWon}/{r.bid}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted">·</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-line font-bold text-ink">
            <td className="px-1.5 py-1">Σ</td>
            {players.map((p) => (
              <td key={p.seat} className="px-1.5 py-1 text-right">
                {p.totalScore}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
      <p className="mt-2 text-[10px] text-muted">
        {t('colWon')}/{t('colBid')}
      </p>
    </div>
  );
}
