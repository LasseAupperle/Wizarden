import type { Card, Suit } from '@wizarden/shared';
import { SPECIAL_META, SUIT_META } from '../lib/specials.js';
import { SpecialIcon, WizardIcon, JesterIcon } from './CardArt.js';
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
  const sm = size === 'sm';
  const dims = sm ? 'w-11 h-[3.85rem] text-lg' : 'w-[4.3rem] h-24 text-3xl';
  const base = cn(
    'relative overflow-hidden rounded-card border shadow-card flex items-center justify-center font-ui font-extrabold select-none shrink-0 transition',
    dims,
    onClick && !disabled && 'hover:-translate-y-1 active:scale-95 cursor-pointer',
    // Dim disabled cards but KEEP their colour so the suit is always readable.
    disabled && 'opacity-55 saturate-75 pointer-events-none',
    selected && '-translate-y-2 ring-2 ring-accent',
  );
  const emblemSize = sm ? 18 : 26;

  let content;
  if (card.kind === 'number') {
    const m = SUIT_META[card.suit];
    const ink = card.suit === 'yellow' ? 'text-black/85' : 'text-white';
    content = (
      <div className={cn(base, SUIT_BG[card.suit], 'border-black/25', ink)}>
        <div className="absolute inset-0 bg-gradient-to-br from-white/25 to-black/20" aria-hidden />
        <span
          className={cn('pointer-events-none absolute opacity-20', sm ? 'text-3xl' : 'text-5xl')}
          aria-hidden
        >
          {m.glyph}
        </span>
        <span className="absolute left-1 top-0.5 text-[10px] font-bold leading-none" aria-hidden>
          {m.letter}
          {m.glyph}
        </span>
        <span className="relative drop-shadow-sm">{card.value}</span>
        <span
          className="absolute bottom-0.5 right-1 rotate-180 text-[10px] font-bold leading-none"
          aria-hidden
        >
          {m.letter}
          {m.glyph}
        </span>
      </div>
    );
  } else if (card.kind === 'wizard') {
    content = (
      <div
        className={cn(
          base,
          'flex-col gap-0.5 border-gold/60 bg-gradient-to-br from-elevated to-[#1a1430] ring-1 ring-gold/25',
        )}
      >
        <WizardIcon size={emblemSize} />
        {!sm && (
          <span className="text-[8px] font-bold uppercase tracking-wider text-gold/80">Wizard</span>
        )}
      </div>
    );
  } else if (card.kind === 'jester') {
    content = (
      <div
        className={cn(base, 'flex-col gap-0.5 border-line bg-gradient-to-br from-elevated to-[#171527]')}
      >
        <JesterIcon size={emblemSize} />
        {!sm && <span className="text-[8px] font-bold uppercase tracking-wider text-muted">Jester</span>}
      </div>
    );
  } else {
    const m = SPECIAL_META[card.special];
    content = (
      <div
        className={cn(
          base,
          'flex-col gap-0.5 border-gold/60 bg-gradient-to-br from-elevated to-[#1c1736] ring-1 ring-gold/25',
        )}
      >
        <SpecialIcon special={card.special} size={sm ? 18 : 24} />
        {!sm && (
          <span className="px-0.5 text-center text-[7px] font-semibold uppercase leading-tight tracking-wide text-ink/85">
            {m.name}
          </span>
        )}
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
