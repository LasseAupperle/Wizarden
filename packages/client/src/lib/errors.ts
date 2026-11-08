// Map server ErrorCodes to friendly, player-facing messages (spec §15), in the
// player's language. Players never see raw codes or stack traces.

import { ErrorCodes, type ErrorCode, type Locale } from '@wizarden/shared';
import { translate, type MessageKey } from './i18n.js';

const MESSAGE_KEYS: Record<ErrorCode, MessageKey> = {
  [ErrorCodes.roomNotFound]: 'e_roomNotFound',
  [ErrorCodes.roomFull]: 'e_roomFull',
  [ErrorCodes.nameTaken]: 'e_nameTaken',
  [ErrorCodes.gameInProgress]: 'e_gameInProgress',
  [ErrorCodes.sessionGone]: 'e_sessionGone',
  [ErrorCodes.notHost]: 'e_notHost',
  [ErrorCodes.notYourTurn]: 'e_notYourTurn',
  [ErrorCodes.illegalMove]: 'e_illegalMove',
  [ErrorCodes.invalidDecision]: 'e_invalidDecision',
  [ErrorCodes.invalidConfig]: 'e_invalidConfig',
  [ErrorCodes.debugDisabled]: 'e_debugDisabled',
  [ErrorCodes.badRequest]: 'e_badRequest',
  [ErrorCodes.nameInvalid]: 'e_nameInvalid',
  [ErrorCodes.malformedPayload]: 'e_badRequest',
  [ErrorCodes.rateLimited]: 'e_rateLimited',
  [ErrorCodes.serverError]: 'e_serverError',
  [ErrorCodes.sessionReplaced]: 'e_sessionReplaced',
  [ErrorCodes.serverRestarted]: 'e_serverRestarted',
  [ErrorCodes.roomClosed]: 'e_roomClosed',
  [ErrorCodes.removedFromGame]: 'e_removedFromGame',
};

export function friendlyError(
  code: string,
  fallback = 'Something went wrong.',
  locale: Locale = 'en',
): string {
  const key = MESSAGE_KEYS[code as ErrorCode];
  return key ? translate(locale, key) : fallback;
}

const SESSION_FATAL = new Set<string>([
  ErrorCodes.sessionGone,
  ErrorCodes.sessionReplaced,
  ErrorCodes.serverRestarted,
  ErrorCodes.roomClosed,
  ErrorCodes.removedFromGame,
]);

/** Session-fatal errors clear the token and route the client back to Landing. */
export function isSessionFatal(code: string): boolean {
  return SESSION_FATAL.has(code);
}
