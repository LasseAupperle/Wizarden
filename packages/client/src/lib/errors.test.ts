import { describe, expect, it } from 'vitest';
import { ErrorCodes } from '@wizarden/shared';
import { friendlyError, isSessionFatal } from './errors.js';

describe('error mapping (§15)', () => {
  it('maps every ErrorCode to a non-empty friendly message', () => {
    for (const code of Object.values(ErrorCodes)) {
      const msg = friendlyError(code);
      expect(msg.length).toBeGreaterThan(0);
      expect(msg).not.toBe(code); // never show the raw code
    }
  });

  it('treats session-gone as fatal (routes to Landing)', () => {
    expect(isSessionFatal(ErrorCodes.sessionGone)).toBe(true);
    expect(isSessionFatal(ErrorCodes.notYourTurn)).toBe(false);
  });

  it('falls back gracefully for unknown codes', () => {
    expect(friendlyError('SOMETHING_NEW')).toMatch(/wrong/i);
  });
});
