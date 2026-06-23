import { useState, type ReactNode } from 'react';
import { AppMenu } from './AppMenu.js';
import { IconButton } from './ui/IconButton.js';
import { LeaderboardPopup } from './LeaderboardPopup.js';
import { useT } from '../lib/i18n.js';

interface Props {
  center?: ReactNode;
  right?: ReactNode;
}

/** Sticky top bar present on every screen: menu, a centre slot, leaderboard. */
export function TopBar({ center, right }: Props) {
  const t = useT();
  const [board, setBoard] = useState(false);
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-line bg-bg/80 px-3 py-2 backdrop-blur">
      <AppMenu />
      <div className="min-w-0 flex-1 truncate text-center font-display text-ink">{center}</div>
      <div className="flex items-center gap-2">
        {right}
        <IconButton label={t('leaderboard')} onClick={() => setBoard(true)}>
          🏆
        </IconButton>
      </div>
      <LeaderboardPopup open={board} onClose={() => setBoard(false)} />
    </header>
  );
}
