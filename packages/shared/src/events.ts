// Socket event names + payload contracts. One definition shared by server and
// client. Adding a field is allowed; removing/repurposing requires updating all
// call sites (TypeScript will surface them).

import type { Card, PlayDecision, SpecialType, Suit } from './cards.js';
import type { PendingDecision } from './decisions.js';
import type { ClientGameState, PlayerPublic, RoundResult } from './state.js';
import type { GameMode } from './constants.js';

export interface LeaderboardEntry {
  name: string;
  points: number; // 1 per full-game win, 0.5 per half-game win
  wins: number;
  lastWonAt: number; // epoch ms
}

// ---- event-name constants (avoid stringly-typed emit/on across the codebase) ----

export const ClientEvents = {
  roomCreate: 'room:create',
  roomJoin: 'room:join',
  roomRejoin: 'room:rejoin',
  roomLeave: 'room:leave',
  lobbyConfigureSpecials: 'lobby:configureSpecials',
  lobbyConfigureMode: 'lobby:configureMode',
  lobbyAddBot: 'lobby:addBot',
  lobbyRemoveBot: 'lobby:removeBot',
  leaderboardGet: 'leaderboard:get',
  gameStart: 'game:start',
  gameBid: 'game:bid',
  gamePlay: 'game:play',
  gameResolve: 'game:resolve',
  hostRemovePlayer: 'host:removePlayer',
  gamePlayAgain: 'game:playAgain',
} as const;

export const ServerEvents = {
  roomCreated: 'room:created',
  roomJoined: 'room:joined',
  stateUpdate: 'state:update',
  decisionPrompt: 'decision:prompt',
  roundResult: 'round:result',
  gameOver: 'game:over',
  peerConnected: 'peer:connected',
  peerDisconnected: 'peer:disconnected',
  peerLeft: 'peer:left',
  gamePaused: 'game:paused',
  gameResumed: 'game:resumed',
  leaderboardData: 'leaderboard:data',
  error: 'error',
} as const;

// Distinct error codes so the client can branch (esp. session-gone -> Landing).
export const ErrorCodes = {
  roomNotFound: 'ROOM_NOT_FOUND',
  roomFull: 'ROOM_FULL',
  nameTaken: 'NAME_TAKEN',
  gameInProgress: 'GAME_IN_PROGRESS', // join rejected: past lobby
  sessionGone: 'SESSION_GONE', // rejoin token invalid/expired/removed -> clear + Landing
  notHost: 'NOT_HOST',
  notYourTurn: 'NOT_YOUR_TURN',
  illegalMove: 'ILLEGAL_MOVE',
  invalidDecision: 'INVALID_DECISION',
  invalidConfig: 'INVALID_CONFIG', // e.g. Dragon/Fairy not paired, bad player count
  debugDisabled: 'DEBUG_DISABLED',
  badRequest: 'BAD_REQUEST',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

// ---- Client -> Server payloads ----

export interface RoomCreatePayload {
  name: string;
}
export interface RoomJoinPayload {
  name: string;
  code: string;
}
export interface RoomRejoinPayload {
  token: string;
}
export type RoomLeavePayload = Record<string, never>;

export interface LobbyConfigureSpecialsPayload {
  specials: SpecialType[];
}
export interface LobbyConfigureModePayload {
  mode: GameMode;
}
export type LeaderboardGetPayload = Record<string, never>;
export interface LobbyAddBotPayload {
  seat?: number;
}
export interface LobbyRemoveBotPayload {
  seat?: number;
}

export type GameStartPayload = Record<string, never>;
export interface GameBidPayload {
  bid: number;
}
export interface GamePlayPayload {
  cardId: string;
  decision: PlayDecision;
}

// game:resolve — payload shape matches the outstanding decision kind:
export type GameResolvePayload =
  | { suit: Suit } // chooseTrump / werewolfSwap (suit | 'none' via separate field below)
  | { suit: Suit | null } // werewolfSwap allows declaring "no trump" (null)
  | { delta: 1 | -1 } // cloudAdjust
  | { takeId: string; giveId: string } // witchSwap
  | { cardId: string }; // jugglerPass

export interface HostRemovePlayerPayload {
  seat: number;
}
export type GamePlayAgainPayload = Record<string, never>;

// ---- Server -> Client payloads ----

export interface RoomCreatedPayload {
  code: string;
  token: string;
  state: ClientGameState;
}
export type RoomJoinedPayload = RoomCreatedPayload;

export type StateUpdatePayload = ClientGameState;
export type DecisionPromptPayload = PendingDecision;
export type RoundResultPayload = RoundResult[];
export interface GameOverPayload {
  standings: PlayerPublic[];
}
export interface PeerPayload {
  seat: number;
  name: string;
}
export interface LeaderboardDataPayload {
  entries: LeaderboardEntry[]; // top N
}
export interface PausePayload {
  seat?: number;
  name?: string;
}
export interface ErrorPayload {
  code: ErrorCode;
  message: string;
}

// Strongly-typed maps for Socket.IO generics (used by server + client wrappers).
export interface ClientToServerEvents {
  [ClientEvents.roomCreate]: (p: RoomCreatePayload) => void;
  [ClientEvents.roomJoin]: (p: RoomJoinPayload) => void;
  [ClientEvents.roomRejoin]: (p: RoomRejoinPayload) => void;
  [ClientEvents.roomLeave]: (p: RoomLeavePayload) => void;
  [ClientEvents.lobbyConfigureSpecials]: (p: LobbyConfigureSpecialsPayload) => void;
  [ClientEvents.lobbyConfigureMode]: (p: LobbyConfigureModePayload) => void;
  [ClientEvents.lobbyAddBot]: (p: LobbyAddBotPayload) => void;
  [ClientEvents.lobbyRemoveBot]: (p: LobbyRemoveBotPayload) => void;
  [ClientEvents.leaderboardGet]: (p: LeaderboardGetPayload) => void;
  [ClientEvents.gameStart]: (p: GameStartPayload) => void;
  [ClientEvents.gameBid]: (p: GameBidPayload) => void;
  [ClientEvents.gamePlay]: (p: GamePlayPayload) => void;
  [ClientEvents.gameResolve]: (p: GameResolvePayload) => void;
  [ClientEvents.hostRemovePlayer]: (p: HostRemovePlayerPayload) => void;
  [ClientEvents.gamePlayAgain]: (p: GamePlayAgainPayload) => void;
}

export interface ServerToClientEvents {
  [ServerEvents.roomCreated]: (p: RoomCreatedPayload) => void;
  [ServerEvents.roomJoined]: (p: RoomJoinedPayload) => void;
  [ServerEvents.stateUpdate]: (p: StateUpdatePayload) => void;
  [ServerEvents.decisionPrompt]: (p: DecisionPromptPayload) => void;
  [ServerEvents.roundResult]: (p: RoundResultPayload) => void;
  [ServerEvents.gameOver]: (p: GameOverPayload) => void;
  [ServerEvents.peerConnected]: (p: PeerPayload) => void;
  [ServerEvents.peerDisconnected]: (p: PeerPayload) => void;
  [ServerEvents.peerLeft]: (p: PeerPayload) => void;
  [ServerEvents.gamePaused]: (p: PausePayload) => void;
  [ServerEvents.gameResumed]: (p: PausePayload) => void;
  [ServerEvents.leaderboardData]: (p: LeaderboardDataPayload) => void;
  [ServerEvents.error]: (p: ErrorPayload) => void;
}

// Re-export the few cross-cutting types callers expect from this module.
export type { Card };
