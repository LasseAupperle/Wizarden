import type { GameMode } from '@wizarden/shared';
import { useT } from '../lib/i18n.js';
import { cn } from '../lib/cn.js';

interface Props {
  mode: GameMode;
  fullRounds: number; // rounds for the current player count (full)
  onChange: (mode: GameMode) => void;
  disabled?: boolean;
}

/** Host picks Full or Half. Half = ceil(full / 2) rounds for a quicker game. */
export function GameModePicker({ mode, fullRounds, onChange, disabled }: Props) {
  const t = useT();
  const rounds: Record<GameMode, number> = { full: fullRounds, half: Math.ceil(fullRounds / 2) };
  return (
    <div className="grid grid-cols-2 gap-2">
      {(['full', 'half'] as GameMode[]).map((m) => (
        <button
          key={m}
          aria-pressed={mode === m}
          disabled={disabled}
          onClick={() => onChange(m)}
          className={cn(
            'rounded-ui border p-3 text-center transition disabled:opacity-50',
            mode === m
              ? 'border-accent bg-accent/15'
              : 'border-line bg-elevated hover:border-accent/50',
          )}
        >
          <span className="block font-semibold text-ink">{t(m)}</span>
          <span className="block text-xs text-muted">
            {rounds[m]} {t('rounds')}
          </span>
        </button>
      ))}
    </div>
  );
}
