import { Minus, Plus } from 'lucide-react';
import { Button } from '../ui/Button.js';
import { useT } from '../../lib/i18n.js';

/** Up to this many options are shown as a grid of buttons; beyond, a stepper. */
const GRID_MAX = 11;

interface Props {
  cards: number; // cards this round (bids 0..cards)
  bidsSoFar: number;
  value: number;
  onChange: (n: number) => void;
  onBid: (n: number) => void;
  showKeyHint?: boolean;
}

/** Inline bid picker above your hand: a button grid for small rounds, a compact
 *  − n + stepper for big ones (so 21 options never push your cards off-screen). */
export function BidPicker({ cards, bidsSoFar, value, onChange, onBid, showKeyHint }: Props) {
  const t = useT();
  const clamp = (n: number) => Math.max(0, Math.min(cards, n));
  return (
    <div className="rounded-ui border border-accent/50 bg-elevated p-2 shadow-card">
      <div className="mb-1.5 flex items-center justify-between gap-2 px-1 text-xs">
        <span className="font-semibold text-ink">{t('yourBid')}</span>
        <span className="text-muted">{t('bidsTotal', { bids: bidsSoFar, cards })}</span>
      </div>
      {cards + 1 <= GRID_MAX ? (
        <div className="flex flex-wrap justify-center gap-1.5">
          {Array.from({ length: cards + 1 }, (_, n) => (
            <Button
              key={n}
              size="md"
              variant="secondary"
              className="w-11 px-0"
              onClick={() => onBid(n)}
            >
              {n}
            </Button>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2">
          <Button
            size="md"
            variant="secondary"
            className="w-11 px-0"
            aria-label="−1"
            disabled={value <= 0}
            onClick={() => onChange(clamp(value - 1))}
          >
            <Minus size={18} aria-hidden />
          </Button>
          <output
            className="w-12 text-center font-display text-2xl text-ink tabular-nums"
            aria-live="polite"
          >
            {value}
          </output>
          <Button
            size="md"
            variant="secondary"
            className="w-11 px-0"
            aria-label="+1"
            disabled={value >= cards}
            onClick={() => onChange(clamp(value + 1))}
          >
            <Plus size={18} aria-hidden />
          </Button>
          <Button size="md" onClick={() => onBid(value)}>
            {t('bidN', { n: value })}
          </Button>
        </div>
      )}
      {showKeyHint && (
        <p className="mt-1.5 text-center text-[11px] text-muted">{t('bidKeysHint')}</p>
      )}
    </div>
  );
}
