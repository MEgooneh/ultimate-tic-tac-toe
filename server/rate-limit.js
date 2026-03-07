const config = require('./config');

const hits = new Map();

// Clean up old entries every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of hits) {
    if (now - entry.start > config.rateLimitWindowMs * 2) {
      hits.delete(key);
    }
  }
}, config.rateLimitWindowMs);

function getIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
}

function rateLimit(limit, windowMs = config.rateLimitWindowMs) {
  return (req, res, next) => {
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
      return res.status(429).json({ error: 'Too many requests. Try again later.' });
    }

    next();
  };
}

// WebSocket message rate limiter — returns true if allowed, false if over limit
function wsRateCheck(ws) {
  const now = Date.now();
  if (!ws._rateWindow || now - ws._rateWindow > 1000) {
    ws._rateWindow = now;
    ws._rateCount = 1;
    return true;
  }
  ws._rateCount++;
  return ws._rateCount <= config.wsRateLimitPerSec;
}

module.exports = { rateLimit, wsRateCheck, getIp };
