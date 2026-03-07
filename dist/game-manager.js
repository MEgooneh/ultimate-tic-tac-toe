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
exports.createGame = createGame;
exports.joinGame = joinGame;
exports.makeMove = makeMove;
exports.createRematch = createRematch;
exports.acceptRematch = acceptRematch;
exports.getPlayerSymbol = getPlayerSymbol;
exports.getActiveGame = getActiveGame;
exports.setConnection = setConnection;
exports.removeConnection = removeConnection;
exports.startDisconnectTimer = startDisconnectTimer;
exports.clearDisconnectTimer = clearDisconnectTimer;
exports.broadcast = broadcast;
exports.sendTo = sendTo;
exports.startCleanupInterval = startCleanupInterval;
exports.getGameState = getGameState;
const nanoid_1 = require("nanoid");
const db = __importStar(require("./db"));
const config_1 = __importDefault(require("./config"));
const logic = __importStar(require("./game-logic"));
const activeGames = new Map();
function createGame(playerToken, playerName) {
    const id = (0, nanoid_1.nanoid)(8);
    const now = Date.now();
    const game = {
        id,
        status: 'waiting',
        player_x: playerToken,
        player_x_name: (playerName || 'Player X').slice(0, 20),
        player_o: null,
        player_o_name: 'Player O',
        current_turn: 'X',
        board_state: JSON.stringify(logic.createEmptyBoard()),
        active_board: -1,
        winner: null,
        meta_board: JSON.stringify(logic.createEmptyMetaBoard()),
        created_at: now,
        updated_at: now,
        finished_at: null,
        rematch_game_id: null,
        parent_game_id: null,
    };
    db.createGame(game);
    const expiryTimeout = setTimeout(() => {
        expireGame(id);
    }, config_1.default.gameExpiryMs);
    activeGames.set(id, { connections: { X: null, O: null }, expiryTimeout, disconnectTimeout: null });
    return id;
}
function joinGame(gameId, playerToken, playerName) {
    const game = db.getGame(gameId);
    if (!game)
        return { error: 'Game not found' };
    if (game.status !== 'waiting') {
        if (game.player_x === playerToken || game.player_o === playerToken) {
            return { ok: true, reconnect: true, game };
        }
        return { error: 'Game is not available to join' };
    }
    if (game.player_x === playerToken) {
        return { ok: true, reconnect: true, game };
    }
    db.updateGame(gameId, {
        status: 'active',
        player_o: playerToken,
        player_o_name: (playerName || 'Player O').slice(0, 20),
        updated_at: Date.now(),
    });
    const activeGame = activeGames.get(gameId);
    if (activeGame?.expiryTimeout) {
        clearTimeout(activeGame.expiryTimeout);
        activeGame.expiryTimeout = null;
    }
    return { ok: true, game: db.getGame(gameId) };
}
function makeMove(gameId, playerToken, boardIndex, cellIndex) {
    const game = db.getGame(gameId);
    if (!game)
        return { error: 'Game not found' };
    const symbol = getPlayerSymbol(game, playerToken);
    if (!symbol)
        return { error: 'You are not in this game' };
    if (game.current_turn !== symbol)
        return { error: 'Not your turn' };
    const boardState = JSON.parse(game.board_state);
    const metaBoard = JSON.parse(game.meta_board);
    if (!logic.isValidMove(boardState, metaBoard, game.active_board, boardIndex, cellIndex, game.current_turn, game.status)) {
        return { error: 'Invalid move' };
    }
    const result = logic.applyMove(boardState, metaBoard, boardIndex, cellIndex, symbol);
    const nextTurn = symbol === 'X' ? 'O' : 'X';
    const now = Date.now();
    const updates = {
        board_state: JSON.stringify(result.boardState),
        meta_board: JSON.stringify(result.metaBoard),
        active_board: result.activeBoard,
        current_turn: nextTurn,
        updated_at: now,
    };
    if (result.winner) {
        updates.status = 'finished';
        updates.winner = result.winner;
        updates.finished_at = now;
    }
    db.updateGame(gameId, updates);
    return {
        ok: true,
        boardIndex,
        cellIndex,
        symbol,
        activeBoard: result.activeBoard,
        metaBoard: result.metaBoard,
        winner: result.winner,
        boardState: result.boardState,
    };
}
function createRematch(gameId, playerToken) {
    const game = db.getGame(gameId);
    if (!game)
        return { error: 'Game not found' };
    if (game.status !== 'finished')
        return { error: 'Game is not finished' };
    const symbol = getPlayerSymbol(game, playerToken);
    if (!symbol)
        return { error: 'You are not in this game' };
    if (game.rematch_game_id) {
        return { ok: true, newGameId: game.rematch_game_id, alreadyExists: true };
    }
    const id = (0, nanoid_1.nanoid)(8);
    const now = Date.now();
    // Requester becomes X in the new game; accepter will join as O
    const requesterName = symbol === 'X' ? game.player_x_name : game.player_o_name;
    const newGame = {
        id,
        status: 'waiting',
        player_x: playerToken,
        player_x_name: (requesterName || 'Player X').slice(0, 20),
        player_o: null,
        player_o_name: 'Player O',
        current_turn: 'X',
        board_state: JSON.stringify(logic.createEmptyBoard()),
        active_board: -1,
        winner: null,
        meta_board: JSON.stringify(logic.createEmptyMetaBoard()),
        created_at: now,
        updated_at: now,
        finished_at: null,
        rematch_game_id: null,
        parent_game_id: gameId,
    };
    db.createGame(newGame);
    db.updateGame(gameId, { rematch_game_id: id, updated_at: now });
    activeGames.set(id, { connections: { X: null, O: null }, expiryTimeout: null, disconnectTimeout: null });
    return { ok: true, newGameId: id };
}
function acceptRematch(newGameId, playerToken, playerName) {
    return joinGame(newGameId, playerToken, playerName);
}
function getPlayerSymbol(game, playerToken) {
    if (game.player_x === playerToken)
        return 'X';
    if (game.player_o === playerToken)
        return 'O';
    return null;
}
function expireGame(gameId) {
    const game = db.getGame(gameId);
    if (game && game.status === 'waiting') {
        db.updateGame(gameId, { status: 'expired', updated_at: Date.now() });
        const activeGame = activeGames.get(gameId);
        if (activeGame) {
            broadcast(gameId, { type: 'game_expired' });
            activeGames.delete(gameId);
        }
    }
}
function getActiveGame(gameId) {
    if (!activeGames.has(gameId)) {
        activeGames.set(gameId, { connections: { X: null, O: null }, expiryTimeout: null, disconnectTimeout: null });
    }
    return activeGames.get(gameId);
}
function setConnection(gameId, symbol, ws) {
    const ag = getActiveGame(gameId);
    ag.connections[symbol] = ws;
}
function removeConnection(gameId, symbol) {
    const ag = activeGames.get(gameId);
    if (ag)
        ag.connections[symbol] = null;
}
function startDisconnectTimer(gameId, disconnectedSymbol) {
    const ag = activeGames.get(gameId);
    if (!ag)
        return;
    clearDisconnectTimer(gameId);
    ag.disconnectTimeout = setTimeout(() => {
        forfeitGame(gameId, disconnectedSymbol);
    }, config_1.default.disconnectForfeitMs);
}
function clearDisconnectTimer(gameId) {
    const ag = activeGames.get(gameId);
    if (ag?.disconnectTimeout) {
        clearTimeout(ag.disconnectTimeout);
        ag.disconnectTimeout = null;
    }
}
function forfeitGame(gameId, disconnectedSymbol) {
    const game = db.getGame(gameId);
    if (!game || game.status !== 'active')
        return;
    const winner = disconnectedSymbol === 'X' ? 'O' : 'X';
    const now = Date.now();
    db.updateGame(gameId, {
        status: 'finished',
        winner,
        finished_at: now,
        updated_at: now,
    });
    broadcast(gameId, {
        type: 'game_over',
        data: { winner, forfeit: true },
    });
}
function broadcast(gameId, message) {
    const ag = activeGames.get(gameId);
    if (!ag)
        return;
    const data = JSON.stringify(message);
    if (ag.connections.X?.readyState === 1)
        ag.connections.X.send(data);
    if (ag.connections.O?.readyState === 1)
        ag.connections.O.send(data);
}
function sendTo(gameId, symbol, message) {
    const ag = activeGames.get(gameId);
    if (!ag)
        return;
    const ws = ag.connections[symbol];
    if (ws?.readyState === 1)
        ws.send(JSON.stringify(message));
}
function cleanupExpired() {
    const cutoff = Date.now() - config_1.default.gameExpiryMs;
    const expired = db.getExpiredWaitingGames(cutoff);
    for (const { id } of expired) {
        expireGame(id);
    }
}
function cleanupOldGames() {
    const cutoff = Date.now() - config_1.default.retentionMs;
    db.deleteOldGames(cutoff);
}
function startCleanupInterval() {
    setInterval(cleanupExpired, config_1.default.cleanupIntervalMs);
    setInterval(cleanupOldGames, 3600000);
    cleanupOldGames();
}
function getGameState(gameId) {
    const game = db.getGame(gameId);
    if (!game)
        return null;
    return {
        id: game.id,
        status: game.status,
        currentTurn: game.current_turn,
        boardState: JSON.parse(game.board_state),
        activeBoard: game.active_board,
        winner: game.winner,
        metaBoard: JSON.parse(game.meta_board),
        rematchGameId: game.rematch_game_id,
        parentGameId: game.parent_game_id,
        playerXName: game.player_x_name || 'Player X',
        playerOName: game.player_o_name || 'Player O',
    };
}
