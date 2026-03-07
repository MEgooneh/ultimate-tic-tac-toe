import type { Request, Response, NextFunction } from 'express';
import type { WebSocket } from 'ws';
import config from './config';

interface RateEntry {
  count: number;
  start: number;
}

interface RateLimitedWebSocket extends WebSocket {
  _rateWindow?: number;
  _rateCount?: number;
}

const hits = new Map<string, RateEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of hits) {
    if (now - entry.start > config.rateLimitWindowMs * 2) {
      hits.delete(key);
    }
  }
}, config.rateLimitWindowMs);

function getIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim() || req.socket.remoteAddress || '';
  }
  return req.socket.remoteAddress || '';
}

export function rateLimit(limit: number, windowMs: number = config.rateLimitWindowMs) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = getIp(req);
    const now = Date.now();
    const key = `${ip}:${req.route?.path || req.path}`;

    let entry = hits.get(key);
    if (!entry || now - entry.start > windowMs) {
      entry = { count: 0, start: now };
      hits.set(key, entry);
    }

    entry.count++;

    if (entry.count > limit) {
      res.status(429).json({ error: 'Too many requests. Try again later.' });
      return;
    }

    next();
  };
}

export function wsRateCheck(ws: RateLimitedWebSocket): boolean {
  const now = Date.now();
  if (!ws._rateWindow || now - ws._rateWindow > 1000) {
    ws._rateWindow = now;
    ws._rateCount = 1;
    return true;
  }
  ws._rateCount = (ws._rateCount || 0) + 1;
  return ws._rateCount <= config.wsRateLimitPerSec;
}
