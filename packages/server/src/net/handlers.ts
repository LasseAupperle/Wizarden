// Socket event handlers: translate client intents into room/engine actions with
// server-side validation, then broadcast redacted state. The client holds no
// authority — every move is validated here. Every handler is wrapped so a thrown
// error becomes a clean error event (never a crash), and inbound payloads are
// shape-validated + rate-limited at the boundary (§15/§16).

import type { Server, Socket } from 'socket.io';
import {
  ClientEvents,
  ErrorCodes,
  MAX_PLAYERS,
  ServerEvents,
  type ClientToServerEvents,
  type ErrorCode,
  type ServerToClientEvents,
} from '@wizarden/shared';
import type { RoomManager } from '../rooms/roomManager.js';
import type { Room } from '../rooms/room.js';
import type { SessionStore } from '../rooms/sessions.js';
import type { LeaderboardStore } from '../rooms/leaderboard.js';
import type { ResolvePayload } from '../engine/game.js';
import { broadcastRoom, projectFor } from './broadcast.js';
import { BadPayload, cleanName, parse } from './validate.js';
import { SocketLimiter } from './rateLimit.js';

const LEADERBOARD_TOP = 5;

type Io = Server<ClientToServerEvents, ServerToClientEvents>;
type Sock = Socket<ClientToServerEvents, ServerToClientEvents>;

export interface HandlerDeps {
  roomManager: RoomManager;
  sessions: SessionStore;
  leaderboard: LeaderboardStore;
  enableDebug: boolean;
}

interface SocketCtx {
  roomCode?: string;
  seat?: number;
}

function emitError(socket: Sock, code: ErrorCode, message: string): void {
  socket.emit(ServerEvents.error, { code, message });
}

export function registerSocketHandlers(io: Io, socket: Sock, deps: HandlerDeps): void {
  const { roomManager, sessions } = deps;
  const limiter = new SocketLimiter();

  const bindRoom = (room: Room) => {
    room.onChange = () => broadcastRoom(io, room);
  };

  // Loosely-typed event registration; payloads are validated by `parse.*` inside.
  const rawOn = socket.on.bind(socket) as unknown as (
    event: string,
    listener: (payload: unknown) => void,
  ) => void;

  /** Wrap a handler: malformed payload -> MALFORMED_PAYLOAD, anything else ->
   *  SERVER_ERROR (logged, no internals leaked). A failed action is a no-op. */
  const on = (event: string, handler: (payload: unknown) => void): void => {
    rawOn(event, (payload: unknown) => {
      try {
        handler(payload);
      } catch (e) {
        if (e instanceof BadPayload) {
          emitError(socket, ErrorCodes.malformedPayload, 'malformed request');
        } else {
          console.error('[wizarden] handler error:', e);
          emitError(socket, ErrorCodes.serverError, 'something went wrong');
        }
      }
    });
  };

  const withRoom = (fn: (room: Room, seat: number) => void): void => {
    const ctx = socket.data as SocketCtx;
    if (!ctx?.roomCode || ctx.seat === undefined) return emitError(socket, ErrorCodes.badRequest, 'not in a room');
    const room = roomManager.get(ctx.roomCode);
    if (!room) return emitError(socket, ErrorCodes.sessionGone, 'room no longer exists');
    fn(room, ctx.seat);
  };

  // ---- lobby / membership ----

  on(ClientEvents.roomCreate, (raw) => {
    if (!limiter.create.take()) return emitError(socket, ErrorCodes.rateLimited, 'slow down');
    const { name } = parse.roomCreate(raw);
    const clean = cleanName(name);
    if (!clean) return emitError(socket, ErrorCodes.nameInvalid, 'please enter a name');
    const room = roomManager.createRoom();
    bindRoom(room);
    const player = room.addPlayer(clean, { socketId: socket.id });
    const session = sessions.create(room.code, player.seat);
    player.token = session.token;
    socket.data = { roomCode: room.code, seat: player.seat } satisfies SocketCtx;
    socket.join(room.code);
    socket.emit(ServerEvents.roomCreated, {
      code: room.code,
      token: session.token,
      state: projectFor(room, player.seat),
    });
  });

  on(ClientEvents.roomJoin, (raw) => {
    const { name, code } = parse.roomJoin(raw);
    const clean = cleanName(name);
    if (!clean) return emitError(socket, ErrorCodes.nameInvalid, 'please enter a name');
    const room = roomManager.get(code);
    if (!room) return emitError(socket, ErrorCodes.roomNotFound, 'room not found');
    if (room.started) return emitError(socket, ErrorCodes.gameInProgress, 'game already started');
    if (room.players.length >= MAX_PLAYERS) return emitError(socket, ErrorCodes.roomFull, 'room is full');
    bindRoom(room);
    const player = room.addPlayer(clean, { socketId: socket.id });
    const session = sessions.create(room.code, player.seat);
    player.token = session.token;
    socket.data = { roomCode: room.code, seat: player.seat } satisfies SocketCtx;
    socket.join(room.code);
    socket.emit(ServerEvents.roomJoined, {
      code: room.code,
      token: session.token,
      state: projectFor(room, player.seat),
    });
    io.to(room.code).emit(ServerEvents.peerConnected, { seat: player.seat, name: player.name });
    broadcastRoom(io, room);
  });

  on(ClientEvents.roomRejoin, (raw) => {
    const { token } = parse.roomRejoin(raw);
    const session = sessions.get(token);
    if (!session) return emitError(socket, ErrorCodes.sessionGone, 'session expired');
    const room = roomManager.get(session.roomCode);
    const player = room?.playerBySeat(session.seat);
    if (!room || !player) return emitError(socket, ErrorCodes.sessionGone, 'room gone');

    // Multi-tab last-connection-wins (§17): evict any older live socket on this seat.
    const old = player.socketId;
    if (old && old !== socket.id) {
      const oldSock = io.sockets.sockets.get(old);
      if (oldSock) {
        oldSock.data = {} satisfies SocketCtx; // its disconnect must not touch the seat
        emitError(oldSock, ErrorCodes.sessionReplaced, 'this session was opened in another tab');
        oldSock.disconnect(true);
      }
    }

    bindRoom(room);
    room.markReconnected(player.seat, socket.id);
    socket.data = { roomCode: room.code, seat: player.seat } satisfies SocketCtx;
    socket.join(room.code);
    socket.emit(ServerEvents.roomJoined, { code: room.code, token, state: projectFor(room, player.seat) });
    io.to(room.code).emit(ServerEvents.gameResumed, { seat: player.seat, name: player.name });
    broadcastRoom(io, room);
  });

  on(ClientEvents.lobbyConfigureSpecials, (raw) => {
    const { specials } = parse.specials(raw);
    withRoom((room, seat) => {
      const r = room.configureSpecials(seat, specials);
      if (!r.ok) return emitError(socket, r.error.code, r.error.message);
      broadcastRoom(io, room);
    });
  });

  on(ClientEvents.lobbyConfigureMode, (raw) => {
    const { mode } = parse.mode(raw);
    withRoom((room, seat) => {
      const r = room.configureMode(seat, mode);
      if (!r.ok) return emitError(socket, r.error.code, r.error.message);
      broadcastRoom(io, room);
    });
  });

  on(ClientEvents.leaderboardGet, () => {
    socket.emit(ServerEvents.leaderboardData, { entries: deps.leaderboard.top(LEADERBOARD_TOP) });
  });

  on(ClientEvents.lobbyAddBot, () => {
    withRoom((room) => {
      const r = room.addBot();
      if (!r.ok) return emitError(socket, r.error.code, r.error.message);
      broadcastRoom(io, room);
    });
  });

  on(ClientEvents.lobbyRemoveBot, (raw) => {
    const { seat } = parse.seat(raw);
    withRoom((room) => {
      const r = room.removeBot(seat);
      if (!r.ok) return emitError(socket, r.error.code, r.error.message);
      broadcastRoom(io, room);
    });
  });

  // ---- game ----

  on(ClientEvents.gameStart, () => {
    withRoom((room, seat) => {
      const r = room.start(seat);
      if (!r.ok) return emitError(socket, r.error.code, r.error.message);
      broadcastRoom(io, room);
    });
  });

  on(ClientEvents.gameBid, (raw) => {
    if (!limiter.action.take()) return emitError(socket, ErrorCodes.rateLimited, 'slow down');
    const { bid } = parse.bid(raw);
    withRoom((room, seat) => {
      const r = room.bid(seat, bid);
      if (!r.ok) return emitError(socket, r.error.code, r.error.message);
      broadcastRoom(io, room);
    });
  });

  on(ClientEvents.gamePlay, (raw) => {
    if (!limiter.action.take()) return emitError(socket, ErrorCodes.rateLimited, 'slow down');
    const { cardId, decision } = parse.play(raw);
    withRoom((room, seat) => {
      const r = room.play(seat, cardId, (decision ?? { type: 'none' }) as never);
      if (!r.ok) return emitError(socket, r.error.code, r.error.message);
      broadcastRoom(io, room);
    });
  });

  on(ClientEvents.gameResolve, (raw) => {
    if (!limiter.action.take()) return emitError(socket, ErrorCodes.rateLimited, 'slow down');
    const payload = parse.resolve(raw);
    withRoom((room, seat) => {
      const r = room.resolve(seat, payload as ResolvePayload);
      if (!r.ok) return emitError(socket, r.error.code, r.error.message);
      broadcastRoom(io, room);
    });
  });

  on(ClientEvents.gamePlayAgain, () => {
    withRoom((room, seat) => {
      const r = room.playAgain(seat);
      if (!r.ok) return emitError(socket, r.error.code, r.error.message);
      broadcastRoom(io, room);
    });
  });

  // ---- departures (§7.6) ----

  const departSeat = (room: Room, seat: number): void => {
    const rp = room.playerBySeat(seat);
    const token = rp?.token ?? null;
    const name = rp?.name ?? '';
    const r = room.leave(seat);
    if (!r.ok) return emitError(socket, r.error.code, r.error.message);
    if (token) sessions.remove(token); // invalidate: a rejoin must now fail
    io.to(room.code).emit(ServerEvents.peerLeft, { seat, name });
    if (!room.started) roomManager.reapEmpty();
    broadcastRoom(io, room);
  };

  on(ClientEvents.roomLeave, () => {
    withRoom((room, seat) => {
      departSeat(room, seat);
      socket.data = {} satisfies SocketCtx;
      socket.leave(room.code);
    });
  });

  on(ClientEvents.hostRemovePlayer, (raw) => {
    const { seat } = parse.seat(raw);
    withRoom((room, hostSeat) => {
      if (room.playerBySeat(hostSeat)?.isHost !== true) return emitError(socket, ErrorCodes.notHost, 'host only');
      departSeat(room, seat);
    });
  });

  // ---- disconnect (seat retained; pause if the game was waiting on this seat) ----

  socket.on('disconnect', () => {
    const ctx = socket.data as SocketCtx;
    if (!ctx?.roomCode || ctx.seat === undefined) return;
    const room = roomManager.get(ctx.roomCode);
    const player = room?.playerBySeat(ctx.seat);
    if (!room || !player) return;
    // If the seat was taken over by a newer socket (multi-tab), this stale
    // disconnect must not flip the seat to disconnected.
    if (player.socketId && player.socketId !== socket.id) return;
    room.markDisconnected(player.seat);
    io.to(room.code).emit(ServerEvents.peerDisconnected, { seat: player.seat, name: player.name });
    if (!room.started) roomManager.reapEmpty();
    broadcastRoom(io, room);
  });
}
