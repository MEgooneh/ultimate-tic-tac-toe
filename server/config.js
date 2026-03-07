const path = require('path');

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  dbPath: process.env.DB_PATH || path.join(__dirname, '..', 'data', 'uttt.db'),
  gameExpiryMs: 10 * 60 * 1000, // 10 minutes
  cleanupIntervalMs: 60 * 1000, // cleanup every minute
  retentionMs: parseInt(process.env.RETENTION_HOURS, 10) * 3600000 || 72 * 3600000, // 72 hours default
  maxGamesPerIp: parseInt(process.env.MAX_GAMES_PER_IP, 10) || 10, // per window
  rateLimitWindowMs: 60 * 1000, // 1 minute
  wsRateLimitPerSec: 10, // max WS messages per second per connection
  domain: process.env.DOMAIN || 'localhost',
};
