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
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db = __importStar(require("./db"));
const gm = __importStar(require("./game-manager"));
const rate_limit_1 = require("./rate-limit");
const router = (0, express_1.Router)();
router.post('/api/games', (0, rate_limit_1.rateLimit)(10), (req, res) => {
    const { playerToken, playerName } = req.body;
    if (!playerToken || typeof playerToken !== 'string') {
        res.status(400).json({ error: 'playerToken is required' });
        return;
    }
    const gameId = gm.createGame(playerToken, playerName);
    res.json({ gameId });
});
router.get('/api/games/:id', (0, rate_limit_1.rateLimit)(30), (req, res) => {
    const gameId = req.params.id;
    const game = db.getGame(gameId);
    if (!game) {
        res.status(404).json({ error: 'Game not found' });
        return;
    }
    const state = gm.getGameState(gameId);
    const playerToken = req.query.playerToken;
    const isPlayer = playerToken ? (game.player_x === playerToken || game.player_o === playerToken) : false;
    res.json({ ...state, isPlayer });
});
router.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});
exports.default = router;
