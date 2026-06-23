// Socket event handlers: translate client intents into room/engine actions with
// server-side validation, then broadcast redacted state. The client holds no
// authority — every move is validated here.

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

function safeName(name: unknown): string {
  const n = typeof name === 'string' ? name.trim().slice(0, 24) : '';
  return n.length > 0 ? n : 'Player';
}

export function registerSocketHandlers(io: Io, socket: Sock, deps: HandlerDeps): void {
  const { roomManager, sessions } = deps;

  const bindRoom = (room: Room) => {
    room.onChange = () => broadcastRoom(io, room);
  };

  const withRoom = (fn: (room: Room, seat: number) => void): void => {
    const ctx = socket.data as SocketCtx;
    if (!ctx?.roomCode || ctx.seat === undefined) return emitError(socket, ErrorCodes.badRequest, 'not in a room');
    const room = roomManager.get(ctx.roomCode);
    if (!room) return emitError(socket, ErrorCodes.sessionGone, 'room no longer exists');
    fn(room, ctx.seat);
  };

  // ---- lobby / membership ----

  socket.on(ClientEvents.roomCreate, ({ name }) => {
    const room = roomManager.createRoom();
    bindRoom(room);
    const player = room.addPlayer(safeName(name), { socketId: socket.id });
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

  socket.on(ClientEvents.roomJoin, ({ name, code }) => {
    const room = roomManager.get(code ?? '');
    if (!room) return emitError(socket, ErrorCodes.roomNotFound, 'room not found');
    if (room.started) return emitError(socket, ErrorCodes.gameInProgress, 'game already started');
    if (room.players.length >= MAX_PLAYERS) return emitError(socket, ErrorCodes.roomFull, 'room is full');
    bindRoom(room);
    const player = room.addPlayer(safeName(name), { socketId: socket.id });
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

  socket.on(ClientEvents.roomRejoin, ({ token }) => {
    const session = sessions.get(token ?? '');
    if (!session) return emitError(socket, ErrorCodes.sessionGone, 'session expired');
    const room = roomManager.get(session.roomCode);
    const player = room?.playerBySeat(session.seat);
    if (!room || !player) return emitError(socket, ErrorCodes.sessionGone, 'room gone');
    bindRoom(room);
    room.markReconnected(player.seat, socket.id);
    socket.data = { roomCode: room.code, seat: player.seat } satisfies SocketCtx;
    socket.join(room.code);
    socket.emit(ServerEvents.roomJoined, { code: room.code, token, state: projectFor(room, player.seat) });
    io.to(room.code).emit(ServerEvents.gameResumed, { seat: player.seat, name: player.name });
    broadcastRoom(io, room);
  });

  socket.on(ClientEvents.lobbyConfigureSpecials, ({ specials }) => {
    withRoom((room, seat) => {
      const r = room.configureSpecials(seat, specials ?? []);
      if (!r.ok) return emitError(socket, r.error.code, r.error.message);
      broadcastRoom(io, room);
    });
  });

  socket.on(ClientEvents.lobbyConfigureMode, ({ mode }) => {
    withRoom((room, seat) => {
      const r = room.configureMode(seat, mode);
      if (!r.ok) return emitError(socket, r.error.code, r.error.message);
      broadcastRoom(io, room);
    });
  });

  socket.on(ClientEvents.leaderboardGet, () => {
    socket.emit(ServerEvents.leaderboardData, { entries: deps.leaderboard.top(LEADERBOARD_TOP) });
  });

  socket.on(ClientEvents.lobbyAddBot, () => {
    withRoom((room) => {
      const r = room.addBot();
      if (!r.ok) return emitError(socket, r.error.code, r.error.message);
      broadcastRoom(io, room);
    });
  });

  socket.on(ClientEvents.lobbyRemoveBot, ({ seat }) => {
    withRoom((room) => {
      if (seat === undefined) return emitError(socket, ErrorCodes.badRequest, 'seat required');
      const r = room.removeBot(seat);
      if (!r.ok) return emitError(socket, r.error.code, r.error.message);
      broadcastRoom(io, room);
    });
  });

  // ---- game ----

  socket.on(ClientEvents.gameStart, () => {
    withRoom((room, seat) => {
      const r = room.start(seat);
      if (!r.ok) return emitError(socket, r.error.code, r.error.message);
      broadcastRoom(io, room);
    });
  });

  socket.on(ClientEvents.gameBid, ({ bid }) => {
    withRoom((room, seat) => {
      const r = room.bid(seat, bid);
      if (!r.ok) return emitError(socket, r.error.code, r.error.message);
      broadcastRoom(io, room);
    });
  });

  socket.on(ClientEvents.gamePlay, ({ cardId, decision }) => {
    withRoom((room, seat) => {
      const r = room.play(seat, cardId, decision ?? { type: 'none' });
      if (!r.ok) return emitError(socket, r.error.code, r.error.message);
      broadcastRoom(io, room);
    });
  });

  socket.on(ClientEvents.gameResolve, (payload) => {
    withRoom((room, seat) => {
      const r = room.resolve(seat, payload as ResolvePayload);
      if (!r.ok) return emitError(socket, r.error.code, r.error.message);
      broadcastRoom(io, room);
    });
  });

  socket.on(ClientEvents.gamePlayAgain, () => {
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

  socket.on(ClientEvents.roomLeave, () => {
    withRoom((room, seat) => {
      departSeat(room, seat);
      socket.data = {} satisfies SocketCtx;
      socket.leave(room.code);
    });
  });

  socket.on(ClientEvents.hostRemovePlayer, ({ seat }) => {
    withRoom((room, hostSeat) => {
      if (seat === undefined) return emitError(socket, ErrorCodes.badRequest, 'seat required');
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
    room.markDisconnected(player.seat);
    io.to(room.code).emit(ServerEvents.peerDisconnected, { seat: player.seat, name: player.name });
    if (!room.started) roomManager.reapEmpty();
    broadcastRoom(io, room);
  });
}
