// Map server ErrorCodes to friendly, player-facing messages (spec §15). Players
// never see raw codes or stack traces.

import { ErrorCodes, type ErrorCode } from '@wizarden/shared';

const MESSAGES: Record<ErrorCode, string> = {
  [ErrorCodes.roomNotFound]: "That room doesn't exist.",
  [ErrorCodes.roomFull]: 'That room is full.',
  [ErrorCodes.nameTaken]: 'That name is already taken.',
  [ErrorCodes.gameInProgress]: 'The game has already started.',
  [ErrorCodes.sessionGone]: 'Your session ended. Returning to the start.',
  [ErrorCodes.notHost]: 'Only the host can do that.',
  [ErrorCodes.notYourTurn]: "It's not your turn yet.",
  [ErrorCodes.illegalMove]: "You can't play that right now.",
  [ErrorCodes.invalidDecision]: 'That choice is not valid.',
  [ErrorCodes.invalidConfig]: 'Check the game settings and try again.',
  [ErrorCodes.debugDisabled]: 'That option is only available in debug mode.',
  [ErrorCodes.badRequest]: 'Something went wrong with that request.',
  [ErrorCodes.nameInvalid]: 'Please enter a name.',
  [ErrorCodes.malformedPayload]: 'Something went wrong with that request.',
  [ErrorCodes.rateLimited]: 'Slow down a moment, then try again.',
  [ErrorCodes.serverError]: 'Something went wrong on our side. Try again.',
  [ErrorCodes.sessionReplaced]: 'This game was opened in another tab.',
  [ErrorCodes.serverRestarted]:
    'The server restarted, so that game was lost. Create a new room to play again.',
  [ErrorCodes.roomClosed]: 'That room was closed because everyone had left.',
  [ErrorCodes.removedFromGame]: "You're no longer in that game (you left or the host removed you).",
};

export function friendlyError(code: string, fallback = 'Something went wrong.'): string {
  return MESSAGES[code as ErrorCode] ?? fallback;
}

/** Session-fatal errors clear the token and route the client back to Landing. */
const SESSION_FATAL = new Set<string>([
  ErrorCodes.sessionGone,
  ErrorCodes.sessionReplaced,
  ErrorCodes.serverRestarted,
  ErrorCodes.roomClosed,
  ErrorCodes.removedFromGame,
]);

export function isSessionFatal(code: string): boolean {
  return SESSION_FATAL.has(code);
}
