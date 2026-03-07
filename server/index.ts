import http from 'http';
import path from 'path';
import express from 'express';
import { WebSocketServer } from 'ws';
import config from './config';
import * as db from './db';
import routes from './routes';
import { setupWebSocket } from './ws-handler';
import * as gm from './game-manager';

db.init();

const app = express();

app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? true : false);

app.use(express.json({ limit: '1kb' }));

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(express.static(path.join(__dirname, '..', 'public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
}));
app.use(routes);

app.get('/game/:id', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'game.html'));
});

const server = http.createServer(app);

const wss = new WebSocketServer({
  server,
  path: '/ws',
  maxPayload: 1024,
});
setupWebSocket(wss);

gm.startCleanupInterval();

server.listen(config.port, () => {
  console.log(`Ultimate Tic-Tac-Toe server running on port ${config.port}`);
});

function shutdown(): void {
  console.log('Shutting down...');
  server.close();
  db.close();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  shutdown();
});
