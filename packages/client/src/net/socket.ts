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
import { translate } from '../lib/i18n.js';
import { SERVER_URL, DEBUG_ENABLED } from '../lib/env.js';

export { DEBUG_ENABLED };

let socket: Socket | null = null;
let wakingTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * The server pings every 10s (see server PING_INTERVAL_MS). If we come back to
 * the foreground and haven't heard a ping for longer than this, the connection
 * is a "zombie" (the phone slept or switched networks and the socket died
 * without noticing) — reconnect immediately instead of waiting for the
 * heartbeat timeout, during which taps would silently go nowhere.
 */
export const STALE_CONNECTION_MS = 15_000;
let lastServerPingAt = Date.now();

/** Drop the current connection and open a fresh one (re-emits room:rejoin). */
function forceReconnect(s: Socket): void {
  s.disconnect();
  s.connect();
}

function store() {
  return useGameStore.getState();
}

export function getSocket(): Socket {
  if (socket) return socket;

  socket = io(SERVER_URL, {
    // Default order: polling first, then upgrade to WebSocket. Keeping polling
    // as a fallback lets the connection succeed behind VPNs/proxies that block
    // raw WebSocket upgrades (where ws-only would silently never connect).
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionDelay: 600,
    reconnectionDelayMax: 4000,
    timeout: 12000,
  });

  // Cold start (§17): if the first connection is slow, show "waking server".
  store().setConnection('connecting');
  wakingTimer = setTimeout(() => {
    if (store().connection === 'connecting') store().setConnection('waking');
  }, 3500);

  socket.io.on('ping', () => {
    lastServerPingAt = Date.now();
  });

  socket.on('connect', () => {
    lastServerPingAt = Date.now();
    if (wakingTimer) clearTimeout(wakingTimer);
    store().setConnection('connected');
    const session = storage.getSession();
    if (session) socket!.emit(ClientEvents.roomRejoin, { token: session.token });
  });

  socket.on('disconnect', () => store().setConnection('reconnecting'));
  socket.io.on('reconnect_attempt', () => store().setConnection('reconnecting'));

  // A backgrounded/locked phone can have its socket silently die. When the tab
  // returns to the foreground: reconnect if we know we're offline, and also if
  // the connection *looks* alive but no server ping arrived recently (zombie).
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible' || !socket) return;
      if (!socket.connected) socket.connect();
      else if (Date.now() - lastServerPingAt > STALE_CONNECTION_MS) forceReconnect(socket);
    });
  }
  // The network came back or changed (Wi-Fi <-> mobile data): the old TCP
  // connection is almost certainly dead, so start a fresh one right away.
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      if (!socket) return;
      if (socket.connected) forceReconnect(socket);
      else socket.connect();
    });
  }

  const onRoom = (p: RoomCreatedPayload) => {
    storage.setSession({ token: p.token, roomCode: p.code });
    store().setGame(p.state);
  };
  socket.on(ServerEvents.roomCreated, onRoom);
  socket.on(ServerEvents.roomJoined, onRoom);
  socket.on(ServerEvents.stateUpdate, (s: ClientGameState) => store().setGame(s));
  socket.on(ServerEvents.decisionPrompt, (d: PendingDecision) => store().setPendingDecision(d));

  socket.on(ServerEvents.error, (e: ErrorPayload) => {
    const message = friendlyError(e.code, e.message, store().settings.language);
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

// Intents that make sense before you have a seat: Socket.IO may buffer these
// while connecting (e.g. tapping "Create room" while the server wakes up).
const BUFFERABLE = new Set<string>([ClientEvents.roomCreate, ClientEvents.roomJoin]);

const emit = (event: string, payload: unknown): void => {
  const s = getSocket();
  // In-room actions (bids, plays, …) are NOT queued while offline: Socket.IO
  // would replay them on reconnect *before* room:rejoin, where they'd fail.
  // Tell the player instead; they can tap again once reconnected.
  if (!s.connected && !BUFFERABLE.has(event)) {
    store().pushToast(translate(store().settings.language, 'offlineNotSent'));
    return;
  }
  s.emit(event, payload);
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
    const s = getSocket();
    if (s.connected) s.emit(ClientEvents.roomLeave, {}); // offline: just forget locally
    storage.clearSession();
    useGameStore.getState().resetToLanding();
  },
};
