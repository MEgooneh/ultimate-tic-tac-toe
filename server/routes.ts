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

router.post('/api/games/local', rateLimit(10), (req: Request, res: Response): void => {
  const { playerXName, playerOName } = req.body;
  const gameId = gm.createLocalGame(playerXName, playerOName);
  res.json({ gameId });
});

router.post('/api/games/local/:id/move', rateLimit(60), (req: Request<{ id: string }>, res: Response): void => {
  const { boardIndex, cellIndex } = req.body;
  if (typeof boardIndex !== 'number' || typeof cellIndex !== 'number') {
    res.status(400).json({ error: 'boardIndex and cellIndex are required' });
    return;
  }
  const result = gm.makeLocalMove(req.params.id, boardIndex, cellIndex);
  if (result.error) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json(result);
});

router.post('/api/games/local/:id/rematch', rateLimit(10), (req: Request<{ id: string }>, res: Response): void => {
  const result = gm.createLocalRematch(req.params.id);
  if (result.error) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json(result);
});

router.get('/api/games/:id', rateLimit(30), (req: Request<{ id: string }>, res: Response): void => {
  const gameId = req.params.id;
  const game = db.getGame(gameId);
  if (!game) {
    res.status(404).json({ error: 'Game not found' });
    return;
  }
  const state = gm.getGameState(gameId);
  const playerToken = req.query.playerToken as string | undefined;
  const isPlayer = playerToken ? (game.player_x === playerToken || game.player_o === playerToken) : false;
  res.json({ ...state, isPlayer });
});

router.get('/api/health', (_req: Request, res: Response): void => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

export default router;
