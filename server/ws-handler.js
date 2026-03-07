const db = require('./db');
const gm = require('./game-manager');
const { wsRateCheck } = require('./rate-limit');

function setupWebSocket(wss) {
  wss.on('connection', (ws, req) => {
    const params = new URL(req.url, 'http://localhost').searchParams;
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
      hasOpponent: !!(game.player_x && game.player_o),
    },
  }));

  if (game.status === 'active' && !justJoined) {
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
    if (!wsRateCheck(ws)) {
      ws.send(JSON.stringify({ type: 'error', data: { message: 'Too many messages. Slow down.' } }));
      return;
    }
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      ws.send(JSON.stringify({ type: 'error', data: { message: 'Invalid JSON' } }));
      return;
    }
    handleMessage(ws, gameId, symbol, playerToken, playerName, msg);
  });

  ws.on('close', () => {
    gm.removeConnection(gameId, symbol);
    const game = db.getGame(gameId);
    const opponent = symbol === 'X' ? 'O' : 'X';
    if (game && game.status === 'active') {
      gm.startDisconnectTimer(gameId, symbol);
      gm.sendTo(gameId, opponent, { type: 'opponent_disconnected', data: { forfeitIn: 5 * 60 * 1000 } });
    } else {
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

module.exports = { setupWebSocket };
