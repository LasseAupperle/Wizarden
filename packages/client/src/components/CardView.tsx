import type { Card, Suit } from '@wizarden/shared';
import { SPECIAL_META, SUIT_META } from '../lib/specials.js';
import { SpecialIcon, WizardIcon, JesterIcon } from './CardArt.js';
import { cardName } from '../lib/cardNames.js';
import { useT } from '../lib/i18n.js';
import { cn } from '../lib/cn.js';

const SUIT_BG: Record<Suit, string> = {
  red: 'bg-suit-red',
  blue: 'bg-suit-blue',
  green: 'bg-suit-green',
  yellow: 'bg-suit-yellow',
};

export type CardSize = 'sm' | 'md' | 'lg';

/** Card dimensions in px — the fanned hand uses these to compute overlap. */
export const CARD_PX: Record<CardSize, { w: number; h: number }> = {
  sm: { w: 44, h: 62 },
  md: { w: 69, h: 96 },
  lg: { w: 84, h: 118 },
};

const DIMS: Record<CardSize, string> = {
  sm: 'w-11 h-[3.85rem] text-lg',
  md: 'w-[4.3rem] h-24 text-3xl',
  lg: 'w-[5.25rem] h-[7.375rem] text-4xl',
};

interface Props {
  card: Card;
  onClick?: () => void;
  /** Not playable right now: the face dims but the value stays readable. */
  disabled?: boolean;
  /** Lifted (tap-to-select / keyboard focus). */
  selected?: boolean;
  /** The winning card of a finished trick. */
  winner?: boolean;
  size?: CardSize;
  className?: string;
}

/** A single playing card. Suits carry a glyph + letter so colour isn't the only
 *  cue (§14 / §19). The top-left corner index (value + glyph, or a small emblem)
 *  stays readable when cards overlap in a fanned hand. */
export function CardView({
  card,
  onClick,
  disabled,
  selected,
  winner,
  size = 'md',
  className,
}: Props) {
  const t = useT();
  const sm = size === 'sm';
  const label = cardName(t, card);
  const base = cn(
    'relative overflow-hidden rounded-card border shadow-card flex items-center justify-center font-ui font-extrabold select-none shrink-0 transition',
    DIMS[size],
    disabled && 'saturate-[.55]',
  );
  const emblemSize = sm ? 18 : size === 'lg' ? 32 : 26;
  const cornerIcon = sm ? 9 : 12;
  // Dims the face but sits BELOW the value/corner layers, so numbers stay crisp.
  const dim = disabled ? (
    <span className="absolute inset-0 bg-[var(--card-dim)]" aria-hidden />
  ) : null;

  let content;
  if (card.kind === 'number') {
    const m = SUIT_META[card.suit];
    const ink = card.suit === 'yellow' ? 'text-black/85' : 'text-white';
    content = (
      <div className={cn(base, SUIT_BG[card.suit], 'border-black/25', ink)}>
        <div className="absolute inset-0 bg-gradient-to-br from-white/25 to-black/20" aria-hidden />
        <span
          className={cn(
            'pointer-events-none absolute opacity-20',
            sm ? 'text-3xl' : size === 'lg' ? 'text-6xl' : 'text-5xl',
          )}
          aria-hidden
        >
          {m.glyph}
        </span>
        {dim}
        <span
          className={cn(
            'absolute left-1 top-0.5 flex flex-col items-center font-bold leading-none',
            sm ? 'text-[10px]' : 'text-[13px]',
          )}
          aria-hidden
        >
          <span>{card.value}</span>
          <span className={sm ? 'text-[7px]' : 'text-[9px]'}>
            {m.glyph}
            {m.letter}
          </span>
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
  } else {
    const isWizard = card.kind === 'wizard';
    const isJester = card.kind === 'jester';
    const icon = isWizard ? (
      <WizardIcon size={emblemSize} />
    ) : isJester ? (
      <JesterIcon size={emblemSize} />
    ) : (
      <SpecialIcon special={card.special} size={emblemSize} />
    );
    const corner = isWizard ? (
      <WizardIcon size={cornerIcon} />
    ) : isJester ? (
      <JesterIcon size={cornerIcon} />
    ) : (
      <SpecialIcon special={card.special} size={cornerIcon} />
    );
    content = (
      <div
        className={cn(
          base,
          'flex-col gap-0.5 bg-gradient-to-br from-[var(--card-face-from)] to-[var(--card-face-to)]',
          isJester ? 'border-line' : 'border-gold/60 ring-1 ring-gold/25',
        )}
      >
        {dim}
        <span className="absolute left-1 top-1" aria-hidden>
          {corner}
        </span>
        <span className="relative">{icon}</span>
        {!sm && (
          <span
            className={cn(
              'relative px-0.5 text-center font-bold uppercase leading-tight tracking-wide',
              size === 'lg' ? 'text-[9px]' : 'text-[7.5px]',
              isWizard ? 'text-gold' : 'text-ink/85',
            )}
          >
            {label}
          </span>
        )}
      </div>
    );
  }

  const tip = card.kind === 'special' ? `${label}: ${SPECIAL_META[card.special].rule}` : undefined;
  const wrap = cn(
    'relative block rounded-card transition-transform duration-150',
    selected && '-translate-y-3',
    selected && !winner && 'ring-2 ring-accent ring-offset-2 ring-offset-bg',
    winner && 'animate-win',
    className,
  );

  if (!onClick) {
    return (
      <div className={wrap} aria-label={label} title={tip} role="img">
        {content}
      </div>
    );
  }
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected || undefined}
      title={tip}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        wrap,
        !disabled && 'cursor-pointer hover:-translate-y-1.5 active:scale-95',
        disabled && 'cursor-default',
      )}
    >
      {content}
    </button>
  );
}
