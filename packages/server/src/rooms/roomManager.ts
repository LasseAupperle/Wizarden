// Creates/finds rooms and generates unique short room codes (uppercase, no
// ambiguous chars), regenerating on collision. Reaps empty rooms.

import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@wizarden/shared';
import { Room, type RoomOptions } from './room.js';

export class RoomManager {
  private rooms = new Map<string, Room>();

  constructor(private readonly opts: RoomOptions = {}) {}

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
    this.rooms.get(code)?.dispose();
    this.rooms.delete(code);
  }

  /** Remove rooms with no connected human and no bots. */
  reapEmpty(): void {
    for (const [code, room] of this.rooms) {
      if (room.isEmpty()) {
        room.dispose();
        this.rooms.delete(code);
      }
    }
  }

  count(): number {
    return this.rooms.size;
  }
}
