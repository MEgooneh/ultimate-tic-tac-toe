const express = require('express');
const db = require('./db');
const gm = require('./game-manager');
const { rateLimit } = require('./rate-limit');

const router = express.Router();

router.post('/api/games', rateLimit(10), (req, res) => {
  const { playerToken, playerName } = req.body;
  if (!playerToken || typeof playerToken !== 'string') {
    return res.status(400).json({ error: 'playerToken is required' });
  }
  const gameId = gm.createGame(playerToken, playerName);
  res.json({ gameId });
});

router.get('/api/games/:id', rateLimit(30), (req, res) => {
  const game = db.getGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });

  const state = gm.getGameState(req.params.id);
  res.json(state);
});

router.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

module.exports = router;
