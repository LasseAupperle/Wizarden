// Card model — the single source of truth for card identity across engine,
// server, and client. No runtime logic lives here beyond trivial type guards.

export type Suit = 'red' | 'blue' | 'green' | 'yellow';

export const SUITS: readonly Suit[] = ['red', 'blue', 'green', 'yellow'] as const;

export type SpecialType =
  | 'dragon'
  | 'fairy'
  | 'bomb'
  | 'werewolf'
  | 'juggler'
  | 'cloud'
  | 'witch'
  | 'vampire'
  | 'shapeshifter';

export const SPECIAL_TYPES: readonly SpecialType[] = [
  'dragon',
  'fairy',
  'bomb',
  'werewolf',
  'juggler',
  'cloud',
  'witch',
  'vampire',
  'shapeshifter',
] as const;

export type NumberCard = { kind: 'number'; id: string; suit: Suit; value: number }; // value 1..13
export type WizardCard = { kind: 'wizard'; id: string }; // 4 copies
export type JesterCard = { kind: 'jester'; id: string }; // 4 copies
export type SpecialCard = { kind: 'special'; id: string; special: SpecialType }; // 1 copy each

export type Card = NumberCard | WizardCard | JesterCard | SpecialCard;

export type CardKind = Card['kind'];

// Decisions attached to a play at the moment of playing.
export type PlayDecision =
  | { type: 'none' }
  | { type: 'shapeshifter'; as: 'wizard' | 'jester' }
  | { type: 'announceSuit'; suit: Suit }; // juggler & cloud announce a suit

// ---- trivial type guards (pure, no game logic) ----

export const isNumberCard = (c: Card): c is NumberCard => c.kind === 'number';
export const isWizardCard = (c: Card): c is WizardCard => c.kind === 'wizard';
export const isJesterCard = (c: Card): c is JesterCard => c.kind === 'jester';
export const isSpecialCard = (c: Card): c is SpecialCard => c.kind === 'special';

export const isSpecial = (c: Card, special: SpecialType): boolean =>
  c.kind === 'special' && c.special === special;
