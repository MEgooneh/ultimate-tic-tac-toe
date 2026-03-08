"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const db = __importStar(require("./db"));
const rate_limit_1 = require("./rate-limit");
const router = (0, express_1.Router)();
/* ── Session management ──────────────────────────────────────── */
const sessions = new Map(); // token -> expiresAt
const SESSION_TTL_MS = 4 * 3600000; // 4 hours
function createSession() {
    const token = crypto_1.default.randomBytes(32).toString('hex');
    sessions.set(token, Date.now() + SESSION_TTL_MS);
    return token;
}
function isValidSession(token) {
    if (!token)
        return false;
    const exp = sessions.get(token);
    if (!exp)
        return false;
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
        if (now > exp)
            sessions.delete(t);
    }
}, 600000);
/* ── Auth middleware ──────────────────────────────────────────── */
function requireAuth(req, res, next) {
    const auth = req.headers.authorization;
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : undefined;
    if (!isValidSession(token)) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    next();
}
/* ── Login route — rate-limited: 5 attempts per minute ─────── */
router.post('/api/admin/login', (0, rate_limit_1.rateLimit)(5, 60000), (req, res) => {
    const { username, password } = req.body;
    const adminUser = process.env.ADMIN_USERNAME;
    const adminPass = process.env.ADMIN_PASSWORD;
    if (!adminUser || !adminPass) {
        res.status(503).json({ error: 'Admin access is not configured' });
        return;
    }
    if (typeof username !== 'string' || typeof password !== 'string' ||
        username.length === 0 || password.length === 0) {
        res.status(400).json({ error: 'Username and password required' });
        return;
    }
    // Constant-time comparison to prevent timing attacks
    const userMatch = crypto_1.default.timingSafeEqual(Buffer.from(username.padEnd(256, '\0')), Buffer.from(adminUser.padEnd(256, '\0')));
    const passMatch = crypto_1.default.timingSafeEqual(Buffer.from(password.padEnd(256, '\0')), Buffer.from(adminPass.padEnd(256, '\0')));
    if (!userMatch || !passMatch) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
    }
    const token = createSession();
    res.json({ token });
});
/* ── Protected admin API routes ──────────────────────────────── */
router.get('/api/admin/stats', requireAuth, (_req, res) => {
    const overview = db.getStatsOverview();
    const created = db.getGamesTimeSeries(30);
    const finished = db.getFinishedTimeSeries(30);
    const hourly = db.getHourlyDistribution();
    res.json({ overview, created, finished, hourly });
});
router.get('/api/admin/games', requireAuth, (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 20));
    const result = db.getGamesList(page, pageSize);
    res.json(result);
});
exports.default = router;
