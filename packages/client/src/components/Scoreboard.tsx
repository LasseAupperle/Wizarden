import type { ClientGameState } from '@wizarden/shared';
import { Modal } from './ui/Modal.js';
import { cn } from '../lib/cn.js';

/** Always-available scoreboard popup (§6.2): per-round deltas + running totals. */
export function Scoreboard({
  game,
  open,
  onClose,
}: {
  game: ClientGameState;
  open: boolean;
  onClose: () => void;
}) {
  const seats = game.players.map((p) => p.seat);
  const nameBySeat = Object.fromEntries(game.players.map((p) => [p.seat, p.name]));

  return (
    <Modal open={open} onClose={onClose} title="Scoreboard">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-muted">
              <th className="px-2 py-1 text-left">#</th>
              {seats.map((s) => (
                <th key={s} className="px-2 py-1 text-right">
                  {nameBySeat[s]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {game.scoreboard.map((round, i) => (
              <tr key={i} className="border-t border-line">
                <td className="px-2 py-1 text-muted">{i + 1}</td>
                {seats.map((s) => {
                  const r = round.find((x) => x.seat === s);
                  return (
                    <td
                      key={s}
                      className={cn('px-2 py-1 text-right', (r?.delta ?? 0) >= 0 ? 'text-positive' : 'text-negative')}
                    >
                      {r ? (r.delta >= 0 ? `+${r.delta}` : r.delta) : '·'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-line font-bold text-ink">
              <td className="px-2 py-1">Σ</td>
              {seats.map((s) => (
                <td key={s} className="px-2 py-1 text-right">
                  {game.players.find((p) => p.seat === s)?.totalScore ?? 0}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </Modal>
  );
}
