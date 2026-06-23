import type { SpecialType } from '@wizarden/shared';
import { ALL_SPECIALS, SPECIAL_META } from '../lib/specials.js';
import { cn } from '../lib/cn.js';

interface Props {
  selected: readonly SpecialType[];
  onToggle: (type: SpecialType) => void;
  disabled?: boolean;
}

/** Host picks which specials are in play. Dragon & Fairy are kept paired by the
 *  parent's toggle handler, so an invalid (unpaired) selection is impossible. */
export function SpecialCardPicker({ selected, onToggle, disabled }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {ALL_SPECIALS.map((type) => {
        const m = SPECIAL_META[type];
        const on = selected.includes(type);
        const paired = type === 'dragon' || type === 'fairy';
        return (
          <button
            key={type}
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onToggle(type)}
            className={cn(
              'flex items-center gap-2 rounded-ui border p-2.5 text-left transition disabled:opacity-50',
              on ? 'border-accent bg-accent/15' : 'border-line bg-elevated hover:border-accent/50',
            )}
          >
            <span className="text-xl" aria-hidden>
              {m.emblem}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-ink">{m.name}</span>
              {paired && <span className="block text-[10px] text-gold">paired</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
