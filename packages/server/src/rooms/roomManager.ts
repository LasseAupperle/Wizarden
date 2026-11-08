// Creates/finds rooms and generates unique short room codes (uppercase, no
// ambiguous chars), regenerating on collision. Closes abandoned lobbies.

import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@wizarden/shared';
import { Room, type RoomOptions } from './room.js';

/**
 * How long a lobby whose players have ALL disconnected is kept before closing.
 * On phones the host typically leaves the browser to share the invite link
 * (WhatsApp etc.) and the backgrounded tab's socket drops — the room must still
 * be there when they and their friends come back.
 */
export const LOBBY_EMPTY_GRACE_MS = 10 * 60 * 1000;

export interface RoomManagerOptions {
  lobbyGraceMs?: number;
  /** Called after a room is removed (e.g. to invalidate its sessions). */
  onRemove?: (code: string) => void;
}

export class RoomManager {
  private rooms = new Map<string, Room>();
  private reapTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly opts: RoomOptions = {},
    private readonly mgr: RoomManagerOptions = {},
  ) {}

  private generateCode(): string {
    for (let attempt = 0; attempt < 1000; attempt++) {
      let code = '';
      for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
        code += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
      }
      if (!this.rooms.has(code)) return code;
    }
    throw new Error('could not generate a unique room code');
  }

  createRoom(): Room {
    const room = new Room(this.generateCode(), this.opts);
    this.rooms.set(room.code, room);
    return room;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  remove(code: string): void {
    this.clearReapTimer(code);
    const room = this.rooms.get(code);
    if (!room) return;
    room.dispose();
    this.rooms.delete(code);
    this.mgr.onRemove?.(code);
  }

  /**
   * Call after a player of THIS room disconnects or leaves. Only this room is
   * considered — never other rooms (a game where everyone is briefly offline
   * must not be swept up by an unrelated lobby's disconnect).
   * - No seats left at all (everyone left on purpose): close now.
   * - A lobby whose humans are all disconnected: close after the grace period,
   *   unless someone is back by then.
   * Started games are never reaped here (seats are kept for rejoin).
   */
  reapIfAbandoned(room: Room): void {
    const code = room.code;
    if (this.rooms.get(code) !== room) return;
    if (room.players.length === 0) return this.remove(code);
    if (room.started || !room.isEmpty()) return;
    this.clearReapTimer(code);
    const timer = setTimeout(() => {
      this.reapTimers.delete(code);
      if (this.rooms.get(code) === room && !room.started && room.isEmpty()) this.remove(code);
    }, this.mgr.lobbyGraceMs ?? LOBBY_EMPTY_GRACE_MS);
    timer.unref?.();
    this.reapTimers.set(code, timer);
  }

  private clearReapTimer(code: string): void {
    const t = this.reapTimers.get(code);
    if (t) clearTimeout(t);
    this.reapTimers.delete(code);
  }

  /** True while any room needs the server awake (see Room.needsServer). */
  anyNeedsServer(now: number, graceMs: number): boolean {
    for (const room of this.rooms.values()) if (room.needsServer(now, graceMs)) return true;
    return false;
  }

  count(): number {
    return this.rooms.size;
  }

  /** Stop all pending timers (server shutdown / tests). */
  dispose(): void {
    for (const t of this.reapTimers.values()) clearTimeout(t);
    this.reapTimers.clear();
    for (const room of this.rooms.values()) room.dispose();
  }
}
