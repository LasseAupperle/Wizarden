// Per-player redacted projection (GameState -> ClientGameState) and the room
// broadcast. Each player sees ONLY their own hand and their own pending
// decision; everyone else's hand is a count.

import type { Server } from 'socket.io';
import {
  ServerEvents,
  type ClientGameState,
  type ClientToServerEvents,
  type PlayerPublic,
  type ServerToClientEvents,
} from '@wizarden/shared';
import { awaitingDecisionSeats, playerAt } from '../engine/internalState.js';
import { toPlayerPublic } from '../engine/game.js';
import type { Room, RoomPlayer } from '../rooms/room.js';

type Io = Server<ClientToServerEvents, ServerToClientEvents>;

function lobbyPublic(p: RoomPlayer): PlayerPublic {
  return {
    seat: p.seat,
    name: p.name,
    connected: p.connected,
    inPlay: true,
    isHost: p.isHost,
    isBot: p.isBot,
    bid: null,
    tricksWon: 0,
    handCount: 0,
    totalScore: 0,
  };
}

/** Build the redacted client state for one seat. Handles lobby and in-game. */
export function projectFor(room: Room, seat: number): ClientGameState {
  const g = room.game;
  if (!room.started || !g) {
    return {
      roomCode: room.code,
      phase: 'lobby',
      players: room.players.map(lobbyPublic),
      yourSeat: seat,
      yourHand: [],
      roundNumber: 0,
      totalRounds: 0,
      startMarkerSeat: room.hostSeat() ?? 0,
      currentTurnSeat: null,
      awaitingDecisionSeats: [],
      trumpCard: null,
      trumpSuit: null,
      currentTrick: [],
      selectedSpecials: room.selectedSpecials,
      pendingDecision: null,
      paused: false,
      pausedForName: null,
      scoreboard: [],
      lastRoundResult: null,
      gameOver: null,
    };
  }

  // Overlay room-managed connection/host status onto the engine player view.
  const players: PlayerPublic[] = g.players.map((ep) => {
    const pub = toPlayerPublic(ep);
    const rp = room.playerBySeat(ep.seat);
    if (rp) {
      pub.connected = rp.connected;
      pub.isHost = rp.isHost;
    }
    return pub;
  });

  return {
    roomCode: g.roomCode,
    phase: g.phase,
    players,
    yourSeat: seat,
    yourHand: playerAt(g, seat)?.hand ?? [],
    roundNumber: g.round?.roundNumber ?? 0,
    totalRounds: g.totalRounds,
    startMarkerSeat: g.startMarkerSeat,
    currentTurnSeat: g.currentTurnSeat,
    awaitingDecisionSeats: awaitingDecisionSeats(g),
    trumpCard: g.round?.trumpCard ?? null,
    trumpSuit: g.round?.trumpSuit ?? null,
    currentTrick: g.round?.currentTrick ?? [],
    selectedSpecials: g.selectedSpecials,
    pendingDecision: g.decisions[seat] ?? null,
    paused: g.paused ?? false,
    pausedForName: g.pausedForName ?? null,
    scoreboard: g.scoreboard,
    lastRoundResult: g.lastRoundResult,
    gameOver: g.standings ? { standings: g.standings } : null,
  };
}

/** Send each connected player their redacted state + any owned decision prompt,
 *  and fire round:result / game:over once per transition. */
export function broadcastRoom(io: Io, room: Room): void {
  for (const p of room.players) {
    if (!p.socketId || !p.connected) continue;
    io.to(p.socketId).emit(ServerEvents.stateUpdate, projectFor(room, p.seat));
    const g = room.game;
    if (g) {
      const decision = g.decisions[p.seat];
      if (decision) io.to(p.socketId).emit(ServerEvents.decisionPrompt, decision);
    }
  }

  const g = room.game;
  if (!g) return;

  if (g.phase === 'roundEnd' && g.lastRoundResult && room.flags.lastResultRound !== g.round?.roundNumber) {
    room.flags.lastResultRound = g.round?.roundNumber ?? -1;
    io.to(room.code).emit(ServerEvents.roundResult, g.lastRoundResult);
  }
  if (g.phase === 'gameOver' && g.standings && !room.flags.gameOverEmitted) {
    room.flags.gameOverEmitted = true;
    io.to(room.code).emit(ServerEvents.gameOver, { standings: g.standings });
  }
}
