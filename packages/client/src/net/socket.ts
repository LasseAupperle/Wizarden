// Socket wrapper: owns the Socket.IO connection, drives connection status into
// the store, persists the session for auto-rejoin, and routes server events.
// The client holds no authority — it renders server state and sends intents.

import { io, type Socket } from 'socket.io-client';
import {
  ClientEvents,
  ServerEvents,
  type ClientGameState,
  type ErrorPayload,
  type GameMode,
  type PendingDecision,
  type PlayDecision,
  type RoomCreatedPayload,
  type SpecialType,
} from '@wizarden/shared';
import { useGameStore } from '../store/gameStore.js';
import { storage } from '../lib/storage.js';
import { friendlyError, isSessionFatal } from '../lib/errors.js';
import { SERVER_URL, DEBUG_ENABLED } from '../lib/env.js';

export { DEBUG_ENABLED };

let socket: Socket | null = null;
let wakingTimer: ReturnType<typeof setTimeout> | null = null;

function store() {
  return useGameStore.getState();
}

export function getSocket(): Socket {
  if (socket) return socket;

  socket = io(SERVER_URL, {
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 600,
    reconnectionDelayMax: 4000,
    timeout: 8000,
  });

  // Cold start (§17): if the first connection is slow, show "waking server".
  store().setConnection('connecting');
  wakingTimer = setTimeout(() => {
    if (store().connection === 'connecting') store().setConnection('waking');
  }, 3500);

  socket.on('connect', () => {
    if (wakingTimer) clearTimeout(wakingTimer);
    store().setConnection('connected');
    const session = storage.getSession();
    if (session) socket!.emit(ClientEvents.roomRejoin, { token: session.token });
  });

  socket.on('disconnect', () => store().setConnection('reconnecting'));
  socket.io.on('reconnect_attempt', () => store().setConnection('reconnecting'));

  const onRoom = (p: RoomCreatedPayload) => {
    storage.setSession({ token: p.token, roomCode: p.code });
    store().setGame(p.state);
  };
  socket.on(ServerEvents.roomCreated, onRoom);
  socket.on(ServerEvents.roomJoined, onRoom);
  socket.on(ServerEvents.stateUpdate, (s: ClientGameState) => store().setGame(s));
  socket.on(ServerEvents.decisionPrompt, (d: PendingDecision) => store().setPendingDecision(d));

  socket.on(ServerEvents.error, (e: ErrorPayload) => {
    const message = friendlyError(e.code, e.message);
    if (isSessionFatal(e.code)) {
      storage.clearSession();
      store().resetToLanding(message);
    } else {
      store().pushToast(message);
    }
  });

  return socket;
}

// ---- intents (client -> server) ----
const emit = (event: string, payload: unknown): void => {
  getSocket().emit(event, payload);
};

export const intents = {
  createRoom: (name: string): void => emit(ClientEvents.roomCreate, { name }),
  joinRoom: (name: string, code: string): void => emit(ClientEvents.roomJoin, { name, code }),
  configureSpecials: (specials: SpecialType[]): void =>
    emit(ClientEvents.lobbyConfigureSpecials, { specials }),
  configureMode: (mode: GameMode): void => emit(ClientEvents.lobbyConfigureMode, { mode }),
  addBot: (): void => emit(ClientEvents.lobbyAddBot, {}),
  removeBot: (seat: number): void => emit(ClientEvents.lobbyRemoveBot, { seat }),
  start: (): void => emit(ClientEvents.gameStart, {}),
  bid: (bid: number): void => emit(ClientEvents.gameBid, { bid }),
  play: (cardId: string, decision: PlayDecision): void =>
    emit(ClientEvents.gamePlay, { cardId, decision }),
  resolve: (payload: Record<string, unknown>): void => emit(ClientEvents.gameResolve, payload),
  removePlayer: (seat: number): void => emit(ClientEvents.hostRemovePlayer, { seat }),
  playAgain: (): void => emit(ClientEvents.gamePlayAgain, {}),
  leave: (): void => {
    emit(ClientEvents.roomLeave, {});
    storage.clearSession();
    useGameStore.getState().resetToLanding();
  },
};
