import { Router, Request, Response } from 'express';
import * as db from './db';
import * as gm from './game-manager';
import { rateLimit } from './rate-limit';

const router = Router();

router.post('/api/games', rateLimit(10), (req: Request, res: Response): void => {
  const { playerToken, playerName } = req.body;
  if (!playerToken || typeof playerToken !== 'string') {
    res.status(400).json({ error: 'playerToken is required' });
    return;
  }
  const gameId = gm.createGame(playerToken, playerName);
  res.json({ gameId });
});

router.get('/api/games/:id', rateLimit(30), (req: Request<{ id: string }>, res: Response): void => {
  const gameId = req.params.id;
  const game = db.getGame(gameId);
  if (!game) {
    res.status(404).json({ error: 'Game not found' });
    return;
  }
  const state = gm.getGameState(gameId);
  res.json(state);
});

router.get('/api/health', (_req: Request, res: Response): void => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

export default router;
