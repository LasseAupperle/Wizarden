import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@wizarden/shared';

const PORT = Number(process.env.PORT ?? 3001);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';

// CORS: exactly the configured client origin plus localhost dev. No wildcards.
const ALLOWED_ORIGINS = Array.from(new Set([CLIENT_ORIGIN, 'http://localhost:5173']));

export function createApp(): express.Express {
  const app = express();
  app.get('/health', (_req, res) => {
    res.json({ ok: true, name: 'wizarden-server', version: '0.1.0' });
  });
  return app;
}

export function createIo(
  httpServer: ReturnType<typeof createServer>,
): Server<ClientToServerEvents, ServerToClientEvents> {
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: ALLOWED_ORIGINS, methods: ['GET', 'POST'] },
  });
  io.on('connection', (socket) => {
    // Phase 4 wires room/game handlers here.
    socket.on('disconnect', () => {
      /* Phase 5 handles reconnect/departure. */
    });
  });
  return io;
}

// Boot only when run directly (not when imported by tests).
const isMain = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (isMain || process.env.WIZARDEN_FORCE_LISTEN === 'true') {
  const app = createApp();
  const httpServer = createServer(app);
  createIo(httpServer);
  httpServer.listen(PORT, () => {
    console.log(`[wizarden] server listening on :${PORT} (origins: ${ALLOWED_ORIGINS.join(', ')})`);
  });
}
