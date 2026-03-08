import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import * as db from './db';
import { rateLimit } from './rate-limit';

const router = Router();

/* ── Session management ──────────────────────────────────────── */

const sessions = new Map<string, number>(); // token -> expiresAt
const SESSION_TTL_MS = 4 * 3600000; // 4 hours

function createSession(): string {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, Date.now() + SESSION_TTL_MS);
  return token;
}

function isValidSession(token: string | undefined): boolean {
  if (!token) return false;
  const exp = sessions.get(token);
  if (!exp) return false;
  if (Date.now() > exp) {
    sessions.delete(token);
    return false;
  }
  return true;
}

// Clean up expired sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [t, exp] of sessions) {
    if (now > exp) sessions.delete(t);
  }
}, 600000);

/* ── Auth middleware ──────────────────────────────────────────── */

function requireAuth(req: Request, res: Response, next: () => void): void {
  const auth = req.headers.authorization;
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : undefined;
  if (!isValidSession(token)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

/* ── Login route — rate-limited: 5 attempts per minute ─────── */

router.post('/api/admin/login', rateLimit(5, 60000), (req: Request, res: Response): void => {
  const { username, password } = req.body;

  const adminUser = process.env.ADMIN_USERNAME;
  const adminPass = process.env.ADMIN_PASSWORD;

  if (!adminUser || !adminPass) {
    res.status(503).json({ error: 'Admin access is not configured' });
    return;
  }

  if (
    typeof username !== 'string' || typeof password !== 'string' ||
    username.length === 0 || password.length === 0
  ) {
    res.status(400).json({ error: 'Username and password required' });
    return;
  }

  // Constant-time comparison to prevent timing attacks
  const userMatch = crypto.timingSafeEqual(
    Buffer.from(username.padEnd(256, '\0')),
    Buffer.from(adminUser.padEnd(256, '\0'))
  );
  const passMatch = crypto.timingSafeEqual(
    Buffer.from(password.padEnd(256, '\0')),
    Buffer.from(adminPass.padEnd(256, '\0'))
  );

  if (!userMatch || !passMatch) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const token = createSession();
  res.json({ token });
});

/* ── Protected admin API routes ──────────────────────────────── */

router.get('/api/admin/stats', requireAuth, (_req: Request, res: Response): void => {
  const overview = db.getStatsOverview();
  const created = db.getGamesTimeSeries(30);
  const finished = db.getFinishedTimeSeries(30);
  const hourly = db.getHourlyDistribution();
  res.json({ overview, created, finished, hourly });
});

router.get('/api/admin/games', requireAuth, (req: Request, res: Response): void => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
  const result = db.getGamesList(page, pageSize);
  res.json(result);
});

export default router;
