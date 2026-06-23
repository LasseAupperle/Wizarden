// Original card emblems: one consistent stroke-weight icon per special (lucide,
// ISC-licensed) plus a custom bat for the Vampire. No AMIGO artwork. Each emblem
// carries a thematic tint; special cards also get a gold/violet ring in CardView.

import type { SpecialType } from '@wizarden/shared';
import {
  Bomb,
  Cloud,
  Drama,
  Flame,
  Moon,
  Orbit,
  Repeat,
  Sparkles,
  Wand2,
  WandSparkles,
  type LucideIcon,
} from 'lucide-react';
import type { SVGProps } from 'react';

/** Custom bat for the Vampire (lucide has no bat). */
function Bat(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 7v9" />
      <path d="M12 8c-1-2-2.5-3-4.2-3 .3 1.2-.2 2-1 2.5C5 8.2 3.6 8 2 8.6 3.8 10 5 12 5.2 14.4 7 13 9.5 13 12 16Z" />
      <path d="M12 8c1-2 2.5-3 4.2-3-.3 1.2.2 2 1 2.5C19 8.2 20.4 8 22 8.6 20.2 10 19 12 18.8 14.4 17 13 14.5 13 12 16Z" />
    </svg>
  );
}

const ICONS: Record<SpecialType, LucideIcon | typeof Bat> = {
  shapeshifter: Repeat,
  dragon: Flame,
  fairy: Sparkles,
  bomb: Bomb,
  werewolf: Moon,
  juggler: Orbit,
  cloud: Cloud,
  witch: Wand2,
  vampire: Bat,
};

/** Emblem tint per special (the ring stays gold; the glyph carries character). */
export const SPECIAL_TINT: Record<SpecialType, string> = {
  shapeshifter: 'text-[#34d3c0]',
  dragon: 'text-suit-red',
  fairy: 'text-[#ff86c8]',
  bomb: 'text-muted',
  werewolf: 'text-[#9aa6ff]',
  juggler: 'text-gold',
  cloud: 'text-suit-blue',
  witch: 'text-accent',
  vampire: 'text-suit-red',
};

export function SpecialIcon({ special, size = 22 }: { special: SpecialType; size?: number }) {
  const Icon = ICONS[special];
  return <Icon width={size} height={size} className={SPECIAL_TINT[special]} aria-hidden />;
}

export function WizardIcon({ size = 24 }: { size?: number }) {
  return <WandSparkles width={size} height={size} className="text-gold" aria-hidden />;
}

export function JesterIcon({ size = 24 }: { size?: number }) {
  return <Drama width={size} height={size} className="text-muted" aria-hidden />;
}
