import { createServer, type Server as HttpServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import express, { type Express } from 'express';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@wizarden/shared';
import { RoomManager } from './rooms/roomManager.js';
import { SessionStore } from './rooms/sessions.js';
import { InMemoryLeaderboard, type LeaderboardStore } from './rooms/leaderboard.js';
import { RedisLeaderboard } from './rooms/redisLeaderboard.js';
import { registerSocketHandlers } from './net/handlers.js';
import { loadConfig } from './config.js';

export interface WizardenServerOptions {
  clientOrigin?: string;
  enableDebug?: boolean;
  roundSummaryMs?: number;
  botDelayMs?: number;
  leaderboard?: LeaderboardStore;
  redisUrl?: string;
}

export interface WizardenServer {
  app: Express;
  httpServer: HttpServer;
  io: Server<ClientToServerEvents, ServerToClientEvents>;
  roomManager: RoomManager;
  sessions: SessionStore;
  leaderboard: LeaderboardStore;
  listen: (port: number) => Promise<number>;
  close: () => Promise<void>;
}

export function createWizardenServer(options: WizardenServerOptions = {}): WizardenServer {
  const clientOrigin = options.clientOrigin ?? process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';
  const enableDebug = options.enableDebug ?? process.env.ENABLE_DEBUG === 'true';
  const allowedOrigins = Array.from(new Set([clientOrigin, 'http://localhost:5173']));

  const redisUrl = options.redisUrl ?? process.env.REDIS_URL?.trim();
  const leaderboard: LeaderboardStore =
    options.leaderboard ?? (redisUrl ? new RedisLeaderboard(redisUrl) : new InMemoryLeaderboard());
  if (redisUrl && !options.leaderboard) {
    console.log('[wizarden] leaderboard: persistent (Redis)');
  }

  const app = express();
  app.get('/health', (_req, res) => {
    res.json({ ok: true, name: 'wizarden-server', version: '0.1.0' });
  });
  app.get('/leaderboard', (_req, res) => {
    res.json({ entries: leaderboard.top(5) });
  });

  const httpServer = createServer(app);
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: allowedOrigins, methods: ['GET', 'POST'] },
  });

  const sessions = new SessionStore();
  const roomManager = new RoomManager({
    enableDebug,
    roundSummaryMs: options.roundSummaryMs,
    botDelayMs: options.botDelayMs,
    leaderboard,
  });

  io.on('connection', (socket) => {
    registerSocketHandlers(io, socket, { roomManager, sessions, leaderboard, enableDebug });
  });

  return {
    app,
    httpServer,
    io,
    roomManager,
    sessions,
    leaderboard,
    listen: (port: number) =>
      new Promise<number>((resolve) => {
        httpServer.listen(port, () => {
          const addr = httpServer.address();
          resolve(typeof addr === 'object' && addr ? addr.port : port);
        });
      }),
    close: () =>
      new Promise<void>((resolve) => {
        io.close();
        httpServer.close(() => resolve());
      }),
  };
}

// Boot only when run directly (not when imported by tests).
const isMain = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (isMain) {
  const config = loadConfig();
  const server = createWizardenServer({
    clientOrigin: config.clientOrigin,
    enableDebug: config.enableDebug,
    redisUrl: config.redisUrl,
  });
  void server.listen(config.port).then((boundPort) => {
    console.log(`[wizarden] server listening on :${boundPort} (debug=${config.enableDebug})`);
  });
}
