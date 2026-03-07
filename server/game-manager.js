const { nanoid } = require('nanoid');
const db = require('./db');
const config = require('./config');
const logic = require('./game-logic');

const activeGames = new Map();

function createGame(playerToken, playerName) {
  const id = nanoid(8);
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
  }, config.gameExpiryMs);

  activeGames.set(id, { connections: { X: null, O: null }, expiryTimeout });

  return id;
}

function joinGame(gameId, playerToken, playerName) {
  const game = db.getGame(gameId);
  if (!game) return { error: 'Game not found' };
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
  if (activeGame && activeGame.expiryTimeout) {
    clearTimeout(activeGame.expiryTimeout);
    activeGame.expiryTimeout = null;
  }

  return { ok: true, game: db.getGame(gameId) };
}

function makeMove(gameId, playerToken, boardIndex, cellIndex) {
  const game = db.getGame(gameId);
  if (!game) return { error: 'Game not found' };

  const symbol = getPlayerSymbol(game, playerToken);
  if (!symbol) return { error: 'You are not in this game' };
  if (game.current_turn !== symbol) return { error: 'Not your turn' };

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
  if (!game) return { error: 'Game not found' };
  if (game.status !== 'finished') return { error: 'Game is not finished' };

  const symbol = getPlayerSymbol(game, playerToken);
  if (!symbol) return { error: 'You are not in this game' };

  if (game.rematch_game_id) {
    return { ok: true, newGameId: game.rematch_game_id, alreadyExists: true };
  }

  const id = nanoid(8);
  const now = Date.now();
  const newGame = {
    id,
    status: 'waiting',
    player_x: game.player_o,
    player_x_name: game.player_o_name || 'Player X',
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

  activeGames.set(id, { connections: { X: null, O: null }, expiryTimeout: null });

  return { ok: true, newGameId: id };
}

function acceptRematch(newGameId, playerToken, playerName) {
  return joinGame(newGameId, playerToken, playerName);
}

function getPlayerSymbol(game, playerToken) {
  if (game.player_x === playerToken) return 'X';
  if (game.player_o === playerToken) return 'O';
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
    activeGames.set(gameId, { connections: { X: null, O: null }, expiryTimeout: null });
  }
  return activeGames.get(gameId);
}

function setConnection(gameId, symbol, ws) {
  const ag = getActiveGame(gameId);
  ag.connections[symbol] = ws;
}

function removeConnection(gameId, symbol) {
  const ag = activeGames.get(gameId);
  if (ag) ag.connections[symbol] = null;
}

function broadcast(gameId, message) {
  const ag = activeGames.get(gameId);
  if (!ag) return;
  const data = JSON.stringify(message);
  if (ag.connections.X && ag.connections.X.readyState === 1) ag.connections.X.send(data);
  if (ag.connections.O && ag.connections.O.readyState === 1) ag.connections.O.send(data);
}

function sendTo(gameId, symbol, message) {
  const ag = activeGames.get(gameId);
  if (!ag) return;
  const ws = ag.connections[symbol];
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(message));
}

function cleanupExpired() {
  const cutoff = Date.now() - config.gameExpiryMs;
  const expired = db.getExpiredWaitingGames(cutoff);
  for (const { id } of expired) {
    expireGame(id);
  }
}

function cleanupOldGames() {
  const cutoff = Date.now() - config.retentionMs;
  db.deleteOldGames(cutoff);
}

function startCleanupInterval() {
  setInterval(cleanupExpired, config.cleanupIntervalMs);
  // Run retention cleanup every hour
  setInterval(cleanupOldGames, 3600000);
  // Also run once at startup
  cleanupOldGames();
}

function getGameState(gameId) {
  const game = db.getGame(gameId);
  if (!game) return null;
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

module.exports = {
  createGame,
  joinGame,
  makeMove,
  createRematch,
  acceptRematch,
  getPlayerSymbol,
  getActiveGame,
  setConnection,
  removeConnection,
  broadcast,
  sendTo,
  cleanupExpired,
  startCleanupInterval,
  getGameState,
};
