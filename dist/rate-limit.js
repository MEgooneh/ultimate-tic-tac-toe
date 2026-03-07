"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimit = rateLimit;
exports.wsRateCheck = wsRateCheck;
const config_1 = __importDefault(require("./config"));
const hits = new Map();
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
        if (now - entry.start > config_1.default.rateLimitWindowMs * 2) {
            hits.delete(key);
        }
    }
}, config_1.default.rateLimitWindowMs);
function getIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
        return forwarded.split(',')[0]?.trim() || req.socket.remoteAddress || '';
    }
    return req.socket.remoteAddress || '';
}
function rateLimit(limit, windowMs = config_1.default.rateLimitWindowMs) {
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
            res.status(429).json({ error: 'Too many requests. Try again later.' });
            return;
        }
        next();
    };
}
function wsRateCheck(ws) {
    const now = Date.now();
    if (!ws._rateWindow || now - ws._rateWindow > 1000) {
        ws._rateWindow = now;
        ws._rateCount = 1;
        return true;
    }
    ws._rateCount = (ws._rateCount || 0) + 1;
    return ws._rateCount <= config_1.default.wsRateLimitPerSec;
}
