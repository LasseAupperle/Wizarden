import type { Card, Suit } from '@wizarden/shared';
import { SPECIAL_META, SUIT_META } from '../lib/specials.js';
import { cn } from '../lib/cn.js';

const SUIT_BG: Record<Suit, string> = {
  red: 'bg-suit-red',
  blue: 'bg-suit-blue',
  green: 'bg-suit-green',
  yellow: 'bg-suit-yellow',
};

export function cardLabel(card: Card): string {
  if (card.kind === 'number') return `${SUIT_META[card.suit].label} ${card.value}`;
  if (card.kind === 'wizard') return 'Wizard';
  if (card.kind === 'jester') return 'Jester';
  return SPECIAL_META[card.special].name;
}

interface Props {
  card: Card;
  onClick?: () => void;
  disabled?: boolean;
  selected?: boolean;
  size?: 'sm' | 'md';
}

/** A single playing card. Suits carry a glyph + letter so colour isn't the only
 *  cue (§14 / §19 colour-blind support). Special cards are visibly richer. */
export function CardView({ card, onClick, disabled, selected, size = 'md' }: Props) {
  const dims = size === 'sm' ? 'w-10 h-14 text-base' : 'w-16 h-[5.6rem] text-2xl';
  const base = cn(
    'relative rounded-card border shadow-card flex items-center justify-center font-ui font-extrabold select-none shrink-0 transition',
    dims,
    onClick && !disabled && 'hover:-translate-y-1 active:scale-95 cursor-pointer',
    disabled && 'opacity-40 grayscale pointer-events-none',
    selected && '-translate-y-2 ring-2 ring-accent',
  );

  let content;
  if (card.kind === 'number') {
    const m = SUIT_META[card.suit];
    content = (
      <div className={cn(base, SUIT_BG[card.suit], 'border-black/20 text-white')}>
        <span className="absolute left-1 top-0.5 text-[10px] leading-none" aria-hidden>
          {m.letter}
          {m.glyph}
        </span>
        <span>{card.value}</span>
        <span className="absolute bottom-0.5 right-1 rotate-180 text-[10px] leading-none" aria-hidden>
          {m.letter}
          {m.glyph}
        </span>
      </div>
    );
  } else if (card.kind === 'wizard') {
    content = (
      <div className={cn(base, 'bg-elevated border-accent text-accent ring-1 ring-accent/40')}>✨W</div>
    );
  } else if (card.kind === 'jester') {
    content = <div className={cn(base, 'bg-elevated border-line text-muted')}>🃏</div>;
  } else {
    const m = SPECIAL_META[card.special];
    content = (
      <div className={cn(base, 'bg-elevated border-gold text-ink ring-1 ring-gold/40 flex-col gap-0.5')}>
        <span className="text-xl" aria-hidden>
          {m.emblem}
        </span>
        <span className="text-[8px] font-semibold uppercase tracking-wide">{m.name}</span>
      </div>
    );
  }

  if (!onClick) return <div aria-label={cardLabel(card)}>{content}</div>;
  return (
    <button type="button" aria-label={cardLabel(card)} disabled={disabled} onClick={onClick}>
      {content}
    </button>
  );
}
