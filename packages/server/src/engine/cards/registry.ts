// CardBehavior registry. The resolver/round code looks up behaviors here and
// iterates them — it never hardcodes card names. Register a new special by
// importing its behavior and adding one line.

import type { SpecialType } from '@wizarden/shared';
import type { CardBehavior } from './types.js';
import { dragon } from './dragon.js';
import { fairy } from './fairy.js';
import { bomb } from './bomb.js';
import { werewolf } from './werewolf.js';
import { juggler } from './juggler.js';
import { cloud } from './cloud.js';
import { witch } from './witch.js';
import { vampire } from './vampire.js';
import { shapeshifter } from './shapeshifter.js';

const REGISTRY: Readonly<Record<SpecialType, CardBehavior>> = {
  dragon,
  fairy,
  bomb,
  werewolf,
  juggler,
  cloud,
  witch,
  vampire,
  shapeshifter,
};

export function getBehavior(special: SpecialType): CardBehavior {
  const behavior = REGISTRY[special];
  if (!behavior) throw new Error(`no CardBehavior registered for: ${special}`);
  return behavior;
}

export function allBehaviors(): CardBehavior[] {
  return Object.values(REGISTRY);
}
