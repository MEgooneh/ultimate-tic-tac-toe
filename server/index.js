const http = require('http');
const path = require('path');
const express = require('express');
const { WebSocketServer } = require('ws');
const config = require('./config');
const db = require('./db');
const routes = require('./routes');
const { setupWebSocket } = require('./ws-handler');
const gm = require('./game-manager');

db.init();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(routes);

app.get('/game/:id', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'game.html'));
});

const server = http.createServer(app);

const wss = new WebSocketServer({ server, path: '/ws' });
setupWebSocket(wss);

gm.startCleanupInterval();

server.listen(config.port, () => {
  console.log(`Ultimate Tic-Tac-Toe server running on port ${config.port}`);
});

process.on('SIGTERM', () => {
  console.log('Shutting down...');
  server.close();
  db.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Shutting down...');
  server.close();
  db.close();
  process.exit(0);
});
