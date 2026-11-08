// Localised card + suit names (labels, aria-labels, card faces, prompts).
import type { Card, SpecialType, Suit } from '@wizarden/shared';
import type { MessageKey, Translate } from './i18n.js';

export const suitKey = (s: Suit): MessageKey => `suit_${s}` as MessageKey;
export const specialKey = (s: SpecialType): MessageKey => `sp_${s}` as MessageKey;

export function suitName(t: Translate, s: Suit): string {
  return t(suitKey(s));
}

export function specialName(t: Translate, s: SpecialType): string {
  return t(specialKey(s));
}

export function cardName(t: Translate, card: Card): string {
  if (card.kind === 'number') return `${suitName(t, card.suit)} ${card.value}`;
  if (card.kind === 'wizard') return t('card_wizard');
  if (card.kind === 'jester') return t('card_jester');
  return specialName(t, card.special);
}
