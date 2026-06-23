import type { ReactNode } from 'react';
import { cn } from '../../lib/cn.js';

type Tone = 'neutral' | 'accent' | 'positive' | 'negative' | 'gold';

const TONES: Record<Tone, string> = {
  neutral: 'bg-elevated text-muted border border-line',
  accent: 'bg-accent/20 text-accent border border-accent/40',
  positive: 'bg-positive/15 text-positive border border-positive/40',
  negative: 'bg-negative/15 text-negative border border-negative/40',
  gold: 'bg-gold/15 text-gold border border-gold/40',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
        TONES[tone],
      )}
    >
      {children}
    </span>
  );
}
