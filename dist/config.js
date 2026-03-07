"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const config = {
    port: parseInt(process.env.PORT || '', 10) || 3000,
    dbPath: process.env.DB_PATH || path_1.default.join(__dirname, '..', 'data', 'uttt.db'),
    gameExpiryMs: 10 * 60 * 1000,
    cleanupIntervalMs: 60 * 1000,
    retentionMs: parseInt(process.env.RETENTION_HOURS || '', 10) * 3600000 || 72 * 3600000,
    maxGamesPerIp: parseInt(process.env.MAX_GAMES_PER_IP || '', 10) || 10,
    rateLimitWindowMs: 60 * 1000,
    wsRateLimitPerSec: 10,
    disconnectForfeitMs: 5 * 60 * 1000,
    domain: process.env.DOMAIN || 'localhost',
};
exports.default = config;
