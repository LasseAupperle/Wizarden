import { useEffect, useState } from 'react';
import { ClientEvents, ServerEvents, type LeaderboardEntry } from '@wizarden/shared';
import { Modal } from './ui/Modal.js';
import { Badge } from './ui/Badge.js';
import { useT } from '../lib/i18n.js';
import { getSocket } from '../net/socket.js';

const MEDALS = ['🥇', '🥈', '🥉'];

export function LeaderboardPopup({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);

  useEffect(() => {
    if (!open) return;
    setEntries(null);
    const socket = getSocket();
    const onData = (p: { entries: LeaderboardEntry[] }) => setEntries(p.entries);
    socket.on(ServerEvents.leaderboardData, onData);
    socket.emit(ClientEvents.leaderboardGet, {});
    return () => {
      socket.off(ServerEvents.leaderboardData, onData);
    };
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title={`🏆 ${t('leaderboard')}`}>
      {entries === null ? (
        <p className="py-6 text-center text-muted">…</p>
      ) : entries.length === 0 ? (
        <p className="py-6 text-center text-muted">{t('noWinnersYet')}</p>
      ) : (
        <ol className="space-y-2">
          {entries.map((e, i) => (
            <li
              key={e.name + i}
              className="flex items-center justify-between gap-3 rounded-ui border border-line bg-elevated px-3 py-2"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="w-6 text-center" aria-hidden>
                  {MEDALS[i] ?? `${i + 1}.`}
                </span>
                <span className="truncate font-semibold text-ink">{e.name}</span>
              </span>
              <Badge tone="gold">
                {e.points} {t('points')}
              </Badge>
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}
