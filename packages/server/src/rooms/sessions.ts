// Session token <-> seat identity. A token is issued on room create/join and
// persisted client-side; room:rejoin restores the exact seat from it.

import { randomUUID } from 'node:crypto';

export interface Session {
  token: string;
  roomCode: string;
  seat: number;
}

export class SessionStore {
  private byToken = new Map<string, Session>();

  create(roomCode: string, seat: number): Session {
    const session: Session = { token: randomUUID(), roomCode, seat };
    this.byToken.set(session.token, session);
    return session;
  }

  get(token: string): Session | undefined {
    return this.byToken.get(token);
  }

  remove(token: string): void {
    this.byToken.delete(token);
  }

  /** Drop every session for a room (room reaped / play-again reset). */
  removeRoom(roomCode: string): void {
    for (const [token, s] of this.byToken) {
      if (s.roomCode === roomCode) this.byToken.delete(token);
    }
  }
}
