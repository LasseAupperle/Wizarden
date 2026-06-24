// Lightweight payload guards at the server boundary (§16). All inbound client
// data is untrusted: validate shape/types, cap sizes, ignore unknown fields.
// A bad shape throws BadPayload -> the handler wrapper maps it to MALFORMED_PAYLOAD.

import { MAX_PLAYERS, SPECIAL_TYPES, type GameMode, type SpecialType } from '@wizarden/shared';

export class BadPayload extends Error {}

function asObj(v: unknown): Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v))
    throw new BadPayload('expected object');
  return v as Record<string, unknown>;
}
function asStr(v: unknown, max: number): string {
  if (typeof v !== 'string' || v.length > max) throw new BadPayload('expected string');
  return v;
}
function asInt(v: unknown, min: number, max: number): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) {
    throw new BadPayload('expected integer in range');
  }
  return v;
}

/** Drop ASCII control characters (< 0x20 and 0x7f) without a control-char regex. */
function stripControl(s: string): string {
  let out = '';
  for (const ch of s) {
    const code = ch.charCodeAt(0);
    if (code >= 32 && code !== 127) out += ch;
  }
  return out;
}

/** Clean a display name: strip control chars, collapse whitespace, trim, cap 20.
 *  Returns null when nothing usable remains (caller -> NAME_INVALID). */
export function cleanName(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const cleaned = stripControl(v).replace(/\s+/g, ' ').trim().slice(0, 20);
  return cleaned.length > 0 ? cleaned : null;
}

export const parse = {
  roomCreate: (p: unknown): { name: unknown } => ({ name: asObj(p).name }),
  roomJoin: (p: unknown): { name: unknown; code: string } => {
    const o = asObj(p);
    return { name: o.name, code: asStr(o.code, 12) };
  },
  roomRejoin: (p: unknown): { token: string } => ({ token: asStr(asObj(p).token, 200) }),
  specials: (p: unknown): { specials: SpecialType[] } => {
    const o = asObj(p);
    if (!Array.isArray(o.specials) || o.specials.length > SPECIAL_TYPES.length) {
      throw new BadPayload('specials');
    }
    const out: SpecialType[] = [];
    for (const s of o.specials) {
      const str = asStr(s, 20);
      if (!SPECIAL_TYPES.includes(str as SpecialType)) throw new BadPayload('unknown special');
      out.push(str as SpecialType);
    }
    return { specials: out };
  },
  mode: (p: unknown): { mode: GameMode } => {
    const m = asStr(asObj(p).mode, 8);
    if (m !== 'full' && m !== 'half') throw new BadPayload('mode');
    return { mode: m };
  },
  seat: (p: unknown): { seat: number } => ({ seat: asInt(asObj(p).seat, 0, MAX_PLAYERS - 1) }),
  bid: (p: unknown): { bid: number } => ({ bid: asInt(asObj(p).bid, 0, 60) }),
  play: (p: unknown): { cardId: string; decision: unknown } => {
    const o = asObj(p);
    if (o.decision !== undefined && (typeof o.decision !== 'object' || o.decision === null)) {
      throw new BadPayload('decision');
    }
    return { cardId: asStr(o.cardId, 48), decision: o.decision };
  },
  resolve: (p: unknown): Record<string, unknown> => asObj(p), // engine checks shape vs decision kind
};
