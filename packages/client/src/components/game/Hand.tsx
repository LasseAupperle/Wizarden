import { useState } from 'react';
import type { Card } from '@wizarden/shared';
import { CARD_PX, CardView, type CardSize } from '../CardView.js';
import { useElementWidth } from './useMedia.js';

const GAP = 6;
/** Smallest visible slice of an overlapped card (corner index stays readable). */
const MIN_STEP = 30;

interface Props {
  cards: Card[]; // already sorted
  size: CardSize;
  /** Can this card be activated now? (false = dimmed, not clickable) */
  enabled: (card: Card) => boolean;
  /** Whether the hand is interactive at all (your turn / a hand-pick decision). */
  interactive: boolean;
  selectedId: string | null;
  onActivate: (card: Card) => void;
  maxRows?: number;
}

/** Split n cards into rows for a container width; overlap cards ("fan") only
 *  when they don't fit side by side. Never more than `maxRows` rows. */
export function layoutHand(
  n: number,
  width: number,
  cardW: number,
  maxRows: number,
): { rows: number; perRow: number; step: number } {
  if (n === 0 || width <= 0) return { rows: 1, perRow: n, step: cardW + GAP };
  const natural = cardW + GAP;
  for (let rows = 1; rows <= maxRows; rows++) {
    const perRow = Math.ceil(n / rows);
    if (perRow * natural - GAP <= width) return { rows, perRow, step: natural };
    const step = perRow > 1 ? (width - cardW) / (perRow - 1) : natural;
    if (step >= MIN_STEP || rows === maxRows) {
      return { rows, perRow, step: Math.max(14, Math.min(natural, step)) };
    }
  }
  return { rows: maxRows, perRow: Math.ceil(n / maxRows), step: MIN_STEP };
}

/** Your hand: always fits in 1–2 rows by fanning (overlapping) cards. */
export function Hand({
  cards,
  size,
  enabled,
  interactive,
  selectedId,
  onActivate,
  maxRows = 2,
}: Props) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  // 0 before the first measurement (and in jsdom): assume a phone-width row.
  const width = useElementWidth(el) || 360;
  const { w, h } = CARD_PX[size];
  const { rows, perRow, step } = layoutHand(cards.length, width, w, maxRows);
  const rowList = Array.from({ length: rows }, (_, r) =>
    cards.slice(r * perRow, (r + 1) * perRow),
  ).filter((r) => r.length > 0);

  return (
    <div ref={setEl} className="w-full" data-testid="hand">
      {rowList.map((row, r) => (
        <div
          key={r}
          className="flex justify-center"
          // the second row tucks under the first, leaving the corner index visible
          style={r > 0 ? { marginTop: -Math.round(h * 0.42) } : undefined}
        >
          {row.map((card, i) => {
            const can = interactive && enabled(card);
            const selected = selectedId === card.id;
            return (
              <div
                key={card.id}
                className="relative transition-[margin] duration-150"
                style={{
                  marginLeft: i === 0 ? 0 : step - w,
                  zIndex: selected ? 50 : r * 30 + i,
                }}
              >
                {/* Waiting (not your turn): cards stay bright but inert. Your
                      turn: unplayable cards dim, the rest are buttons. */}
                <CardView
                  card={card}
                  size={size}
                  selected={selected}
                  disabled={interactive && !can}
                  onClick={interactive ? () => onActivate(card) : undefined}
                />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
