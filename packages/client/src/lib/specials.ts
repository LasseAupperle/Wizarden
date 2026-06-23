// Special-card metadata + selection helpers (client-side reference + picker).
// Rule text is original (not reproduced from AMIGO), summarising the engine.

import type { SpecialType, Suit } from '@wizarden/shared';

export interface SpecialMeta {
  type: SpecialType;
  name: string;
  emblem: string; // simple glyph fallback (lucide icons wired in Phase 8)
  rule: string;
}

export const SPECIAL_META: Record<SpecialType, SpecialMeta> = {
  dragon: { type: 'dragon', name: 'Dragon', emblem: '🔥', rule: 'Highest card — beats every Wizard. (Loses only to the Fairy when both are in the same trick.) Leads like a Wizard.' },
  fairy: { type: 'fairy', name: 'Fairy', emblem: '🧚', rule: 'Lowest card and normally loses — but it beats the Dragon when both are in the trick. Leads like a Jester.' },
  bomb: { type: 'bomb', name: 'Bomb', emblem: '💣', rule: 'No one wins the trick; it counts for nobody. Whoever would have won leads next. Leads like a Jester.' },
  werewolf: { type: 'werewolf', name: 'Werewolf', emblem: '🌙', rule: 'If held, before bidding you swap it for the flipped trump card and choose the trump colour (or no trump).' },
  juggler: { type: 'juggler', name: 'Juggler', emblem: '🤹', rule: 'Worth 7½ in a colour you announce. When the trick ends, everyone passes one card clockwise (except on the last trick).' },
  cloud: { type: 'cloud', name: 'Cloud', emblem: '☁️', rule: 'Worth 9¾ in a colour you announce. The trick winner must change their bid by +1 or −1 (no change if a Bomb is present).' },
  witch: { type: 'witch', name: 'Witch', emblem: '🎩', rule: 'Below the Jester and Fairy. After the winner is settled, swap one of your cards for any non-Witch card in the trick.' },
  vampire: { type: 'vampire', name: 'Vampire', emblem: '🦇', rule: 'Copies the round’s flipped trump card and its effects. If that card was the Werewolf, a fresh trump is flipped.' },
  shapeshifter: { type: 'shapeshifter', name: 'Shapeshifter', emblem: '✨', rule: 'Declare it a Wizard or a Jester when you play it, then it behaves as that card.' },
};

export const ALL_SPECIALS: SpecialType[] = [
  'shapeshifter', 'dragon', 'fairy', 'bomb', 'werewolf', 'juggler', 'cloud', 'witch', 'vampire',
];

/**
 * Toggle a special in the selection. Dragon and Fairy are kept paired (adding or
 * removing one adds/removes the other) so the selection is never invalid.
 */
export function toggleSpecial(selected: readonly SpecialType[], type: SpecialType): SpecialType[] {
  const set = new Set(selected);
  const turningOn = !set.has(type);
  const apply = (t: SpecialType) => (turningOn ? set.add(t) : set.delete(t));
  apply(type);
  if (type === 'dragon' || type === 'fairy') {
    apply('dragon');
    apply('fairy');
  }
  return ALL_SPECIALS.filter((t) => set.has(t));
}

export const SUIT_META: Record<Suit, { label: string; letter: string; glyph: string }> = {
  red: { label: 'Red', letter: 'R', glyph: '◆' },
  blue: { label: 'Blue', letter: 'B', glyph: '●' },
  green: { label: 'Green', letter: 'G', glyph: '▲' },
  yellow: { label: 'Yellow', letter: 'Y', glyph: '★' },
};
