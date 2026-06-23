import type { ReactNode } from 'react';
import { cn } from '../../lib/cn.js';

type Tone = 'info' | 'warn' | 'danger';

const TONES: Record<Tone, string> = {
  info: 'bg-accent/20 text-ink border-accent/40',
  warn: 'bg-gold/15 text-ink border-gold/40',
  danger: 'bg-negative/15 text-ink border-negative/40',
};

export function Banner({
  tone = 'info',
  children,
  action,
}: {
  tone?: Tone;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-center justify-between gap-3 border-b px-4 py-2 text-sm font-medium',
        TONES[tone],
      )}
    >
      <span className="min-w-0 truncate">{children}</span>
      {action}
    </div>
  );
}
