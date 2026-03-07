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
exports.setupWebSocket = setupWebSocket;
const db = __importStar(require("./db"));
const gm = __importStar(require("./game-manager"));
const rate_limit_1 = require("./rate-limit");
const config_1 = __importDefault(require("./config"));
function setupWebSocket(wss) {
    wss.on('connection', (ws, req) => {
        const params = new URL(req.url || '', 'http://localhost').searchParams;
        const gameId = params.get('gameId');
        const playerToken = params.get('playerToken');
        const playerName = params.get('playerName') || '';
        if (!gameId || !playerToken) {
            ws.send(JSON.stringify({ type: 'error', data: { message: 'Missing gameId or playerToken' } }));
            ws.close();
            return;
        }
        const game = db.getGame(gameId);
        if (!game) {
            ws.send(JSON.stringify({ type: 'error', data: { message: 'Game not found' } }));
            ws.close();
            return;
        }
        const symbol = gm.getPlayerSymbol(game, playerToken);
        if (!symbol && game.status === 'waiting') {
            const joinResult = gm.joinGame(gameId, playerToken, playerName);
            if (joinResult.error) {
                ws.send(JSON.stringify({ type: 'error', data: { message: joinResult.error } }));
                ws.close();
                return;
            }
            handleNewConnection(ws, gameId, 'O', playerToken, playerName, true);
            return;
        }
        if (!symbol) {
            ws.send(JSON.stringify({ type: 'error', data: { message: 'You are not part of this game' } }));
            ws.close();
            return;
        }
        handleNewConnection(ws, gameId, symbol, playerToken, playerName);
    });
}
function handleNewConnection(ws, gameId, symbol, playerToken, playerName = '', justJoined = false) {
    gm.setConnection(gameId, symbol, ws);
    const game = db.getGame(gameId);
    const state = gm.getGameState(gameId);
    ws.send(JSON.stringify({
        type: 'game_state',
        data: {
            ...state,
            yourSymbol: symbol,
            hasOpponent: !!(game?.player_x && game?.player_o),
        },
    }));
    if (game?.status === 'active' && !justJoined) {
        gm.clearDisconnectTimer(gameId);
        const opponent = symbol === 'X' ? 'O' : 'X';
        gm.sendTo(gameId, opponent, { type: 'opponent_reconnected' });
    }
    if (justJoined && symbol === 'O') {
        const updatedState = gm.getGameState(gameId);
        gm.broadcast(gameId, {
            type: 'game_started',
            data: updatedState,
        });
    }
    ws.on('message', (raw) => {
        if (!(0, rate_limit_1.wsRateCheck)(ws)) {
            ws.send(JSON.stringify({ type: 'error', data: { message: 'Too many messages. Slow down.' } }));
            return;
        }
        let msg;
        try {
            msg = JSON.parse(raw.toString());
        }
        catch {
            ws.send(JSON.stringify({ type: 'error', data: { message: 'Invalid JSON' } }));
            return;
        }
        handleMessage(ws, gameId, symbol, playerToken, playerName, msg);
    });
    ws.on('close', () => {
        gm.removeConnection(gameId, symbol);
        const currentGame = db.getGame(gameId);
        const opponent = symbol === 'X' ? 'O' : 'X';
        if (currentGame && currentGame.status === 'active') {
            gm.startDisconnectTimer(gameId, symbol);
            gm.sendTo(gameId, opponent, { type: 'opponent_disconnected', data: { forfeitIn: config_1.default.disconnectForfeitMs } });
        }
        else {
            gm.sendTo(gameId, opponent, { type: 'opponent_disconnected' });
        }
    });
}
function handleMessage(ws, gameId, symbol, playerToken, playerName, msg) {
    switch (msg.type) {
        case 'move': {
            const result = gm.makeMove(gameId, playerToken, msg.boardIndex, msg.cellIndex);
            if (result.error) {
                ws.send(JSON.stringify({ type: 'invalid_move', data: { reason: result.error } }));
                return;
            }
            gm.broadcast(gameId, {
                type: 'move_made',
                data: {
                    boardIndex: result.boardIndex,
                    cellIndex: result.cellIndex,
                    symbol: result.symbol,
                    activeBoard: result.activeBoard,
                    metaBoard: result.metaBoard,
                    boardState: result.boardState,
                },
            });
            if (result.winner) {
                gm.broadcast(gameId, {
                    type: 'game_over',
                    data: { winner: result.winner },
                });
            }
            break;
        }
        case 'rematch_request': {
            const result = gm.createRematch(gameId, playerToken);
            if (result.error) {
                ws.send(JSON.stringify({ type: 'error', data: { message: result.error } }));
                return;
            }
            const opponent = symbol === 'X' ? 'O' : 'X';
            gm.sendTo(gameId, opponent, {
                type: 'rematch_offered',
                data: { newGameId: result.newGameId },
            });
            ws.send(JSON.stringify({
                type: 'rematch_offered',
                data: { newGameId: result.newGameId, byYou: true },
            }));
            break;
        }
        case 'rematch_accept': {
            if (!msg.newGameId) {
                ws.send(JSON.stringify({ type: 'error', data: { message: 'Missing newGameId' } }));
                return;
            }
            const result = gm.acceptRematch(msg.newGameId, playerToken, playerName);
            if (result.error) {
                ws.send(JSON.stringify({ type: 'error', data: { message: result.error } }));
                return;
            }
            gm.broadcast(gameId, {
                type: 'rematch_accepted',
                data: { newGameId: msg.newGameId },
            });
            break;
        }
        case 'rematch_decline': {
            const opponent = symbol === 'X' ? 'O' : 'X';
            gm.sendTo(gameId, opponent, { type: 'rematch_declined' });
            break;
        }
        default:
            ws.send(JSON.stringify({ type: 'error', data: { message: 'Unknown message type' } }));
    }
}
