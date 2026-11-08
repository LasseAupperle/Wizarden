// Session token <-> seat identity. A token is issued on room create/join and
// persisted client-side; room:rejoin restores the exact seat from it.
//
// When a session ends on purpose we remember WHY (briefly), so a later rejoin
// can tell the player what happened instead of a generic "session ended". A
// token we have never seen means the server lost its memory (slept/restarted).

import { randomUUID } from 'node:crypto';

export interface Session {
  token: string;
  roomCode: string;
  seat: number;
}

export type SessionEndReason = 'removed' | 'roomClosed';

/** Bound on remembered end reasons (oldest forgotten first). */
const MAX_ENDED = 2000;

export class SessionStore {
  private byToken = new Map<string, Session>();
  private ended = new Map<string, SessionEndReason>();

  create(roomCode: string, seat: number): Session {
    const session: Session = { token: randomUUID(), roomCode, seat };
    this.byToken.set(session.token, session);
    return session;
  }

  get(token: string): Session | undefined {
    return this.byToken.get(token);
  }

  /** Why a token stopped working; undefined = never seen (server restarted). */
  endReason(token: string): SessionEndReason | undefined {
    return this.ended.get(token);
  }

  /** The player left or was removed by the host. */
  remove(token: string): void {
    if (this.byToken.delete(token)) this.markEnded(token, 'removed');
  }

  /** Drop every session for a room (room closed / reaped). */
  removeRoom(roomCode: string): void {
    for (const [token, s] of this.byToken) {
      if (s.roomCode === roomCode) {
        this.byToken.delete(token);
        this.markEnded(token, 'roomClosed');
      }
    }
  }

  private markEnded(token: string, reason: SessionEndReason): void {
    this.ended.set(token, reason);
    if (this.ended.size > MAX_ENDED) {
      const oldest = this.ended.keys().next().value;
      if (oldest !== undefined) this.ended.delete(oldest);
    }
  }
}
