document.addEventListener('DOMContentLoaded', () => {
  const gameId = window.location.pathname.split('/').pop()!;
  const token = getPlayerToken();
  const playerName = getPlayerName() || 'Player';

  const gameCodeEl = document.getElementById('gameCode') as HTMLElement;
  const copiedMsg = document.getElementById('copiedMsg') as HTMLElement;
  const indicatorX = document.getElementById('indicatorX') as HTMLElement;
  const indicatorO = document.getElementById('indicatorO') as HTMLElement;
  const playerXNameEl = document.getElementById('playerXName') as HTMLElement;
  const playerONameEl = document.getElementById('playerOName') as HTMLElement;
  const statusBar = document.getElementById('statusBar') as HTMLElement;
  const waitingOverlay = document.getElementById('waitingOverlay') as HTMLElement;
  const waitingCode = document.getElementById('waitingCode') as HTMLElement;
  const shareLink = document.getElementById('shareLink') as HTMLInputElement;
  const copyLinkBtn = document.getElementById('copyLinkBtn') as HTMLButtonElement;
  const countdownTimer = document.getElementById('countdownTimer') as HTMLElement;
  const gameOverOverlay = document.getElementById('gameOverOverlay') as HTMLElement;
  const resultIcon = document.getElementById('resultIcon') as HTMLElement;
  const resultTitle = document.getElementById('resultTitle') as HTMLElement;
  const resultSubtitle = document.getElementById('resultSubtitle') as HTMLElement;
  const rematchBtn = document.getElementById('rematchBtn') as HTMLButtonElement;
  const newGameBtn = document.getElementById('newGameBtn') as HTMLButtonElement;
  const rematchToast = document.getElementById('rematchToast') as HTMLElement;
  const acceptRematchBtn = document.getElementById('acceptRematchBtn') as HTMLButtonElement;
  const declineRematchBtn = document.getElementById('declineRematchBtn') as HTMLButtonElement;
  const metaBoardEl = document.getElementById('metaBoard') as HTMLElement;

  let mySymbol: string | null = null;
  let gameState: Record<string, any> | null = null;
  let countdownInterval: ReturnType<typeof setInterval> | null = null;
  let pendingRematchId: string | null = null;
  let disconnectCountdownInterval: ReturnType<typeof setInterval> | null = null;

  gameCodeEl.textContent = gameId;
  gameCodeEl.addEventListener('click', () => copyToClipboard(gameId, copiedMsg));

  const board = new BoardRenderer(metaBoardEl, (boardIndex: number, cellIndex: number) => {
    ws.send({ type: 'move', boardIndex, cellIndex });
  });

  const ws = new WsClient(gameId, token, playerName);

  ws.on('game_state', (data: any) => {
    gameState = data;
    mySymbol = data.yourSymbol;
    board.setMySymbol(mySymbol!);
    board.update(data);
    updateIndicators(data);
    updateStatus(data);

    if (data.status === 'waiting') {
      showWaiting();
    } else if (data.status === 'finished') {
      showGameOver(data.winner);
    } else {
      waitingOverlay.hidden = true;
    }
  });

  ws.on('game_started', (data: any) => {
    gameState = data;
    waitingOverlay.hidden = true;
    clearCountdown();
    board.update(data);
    updateIndicators(data);
    updateStatus(data);
  });

  ws.on('move_made', (data: any) => {
    gameState = {
      ...gameState,
      boardState: data.boardState,
      metaBoard: data.metaBoard,
      activeBoard: data.activeBoard,
      currentTurn: data.symbol === 'X' ? 'O' : 'X',
    };
    board.update(gameState as any);
    board.animateMove(data.boardIndex, data.cellIndex, data.symbol);
    updateIndicators(gameState!);
    updateStatus(gameState!);
  });

  ws.on('invalid_move', (data: any) => {
    statusBar.textContent = data.reason;
    statusBar.className = 'status-bar';
    setTimeout(() => updateStatus(gameState), 2000);
  });

  ws.on('game_over', (data: any) => {
    clearDisconnectCountdown();
    if (gameState) {
      gameState.winner = data.winner;
      gameState.status = 'finished';
    }
    showGameOver(data.winner, data.forfeit);
  });

  ws.on('opponent_disconnected', (data: any) => {
    clearDisconnectCountdown();
    if (data && data.forfeitIn) {
      const expiresAt = Date.now() + data.forfeitIn;
      disconnectCountdownInterval = setInterval(() => {
        const remaining = Math.max(0, expiresAt - Date.now());
        const mins = Math.floor(remaining / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);
        statusBar.textContent = `Opponent disconnected — forfeit in ${mins}:${secs.toString().padStart(2, '0')}`;
        statusBar.className = 'status-bar';
        if (remaining <= 0) clearDisconnectCountdown();
      }, 1000);
    } else {
      statusBar.textContent = 'Opponent disconnected...';
      statusBar.className = 'status-bar';
    }
  });

  ws.on('opponent_reconnected', () => {
    clearDisconnectCountdown();
    if (gameState) updateStatus(gameState);
  });

  ws.on('game_expired', () => {
    waitingOverlay.hidden = true;
    clearCountdown();
    statusBar.textContent = 'Game expired — no one joined';
    statusBar.className = 'status-bar';
  });

  ws.on('rematch_offered', (data: any) => {
    pendingRematchId = data.newGameId;
    if (data.byYou) {
      rematchBtn.disabled = true;
      rematchBtn.textContent = 'Waiting...';
    } else {
      rematchToast.classList.add('show');
    }
  });

  ws.on('rematch_accepted', (data: any) => {
    window.location.href = `/game/${data.newGameId}`;
  });

  ws.on('rematch_declined', () => {
    rematchBtn.disabled = false;
    rematchBtn.textContent = 'Play Again';
    statusBar.textContent = 'Opponent declined the rematch';
    statusBar.className = 'status-bar';
  });

  ws.on('error', (data: any) => {
    console.error('WS error:', data.message);
  });

  ws.on('disconnected', () => {
    statusBar.textContent = 'Reconnecting...';
    statusBar.className = 'status-bar pulse';
  });

  ws.on('connected', () => {
    if (gameState) updateStatus(gameState);
  });

  ws.connect();

  function showWaiting(): void {
    waitingOverlay.hidden = false;
    waitingCode.textContent = gameId;
    const link = `${getBaseUrl()}/game/${gameId}`;
    shareLink.value = link;
    startCountdown();
  }

  copyLinkBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(shareLink.value).then(() => {
      copyLinkBtn.textContent = 'Copied!';
      setTimeout(() => { copyLinkBtn.textContent = 'Copy Link'; }, 2000);
    });
  });

  function startCountdown(): void {
    clearCountdown();
    const expiresAt = Date.now() + 10 * 60 * 1000;
    countdownInterval = setInterval(() => {
      const remaining = Math.max(0, expiresAt - Date.now());
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      countdownTimer.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
      if (remaining <= 0) clearCountdown();
    }, 1000);
  }

  function clearCountdown(): void {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
  }

  function updateStatus(state: any): void {
    if (!state) return;
    if (state.status === 'waiting') {
      statusBar.textContent = 'Waiting for opponent...';
      statusBar.className = 'status-bar pulse';
    } else if (state.status === 'finished') {
      // handled by overlay
    } else if (state.currentTurn === mySymbol) {
      statusBar.textContent = 'Your turn';
      statusBar.className = 'status-bar your-turn';
    } else {
      statusBar.textContent = "Opponent's turn";
      statusBar.className = 'status-bar';
    }
  }

  function updateIndicators(state: any): void {
    indicatorX.classList.toggle('active', state.currentTurn === 'X');
    indicatorO.classList.toggle('active', state.currentTurn === 'O');
    indicatorX.classList.toggle('you', mySymbol === 'X');
    indicatorO.classList.toggle('you', mySymbol === 'O');
    if (state.playerXName) playerXNameEl.textContent = state.playerXName;
    if (state.playerOName) playerONameEl.textContent = state.playerOName;
  }

  function showGameOver(winner: string, forfeit?: boolean): void {
    gameOverOverlay.hidden = false;
    if (winner === 'draw') {
      resultIcon.textContent = '🤝';
      resultTitle.textContent = "It's a Draw!";
      resultSubtitle.textContent = 'Well played by both sides.';
    } else if (winner === mySymbol) {
      resultIcon.textContent = '🎉';
      resultTitle.textContent = 'You Won!';
      resultTitle.style.color = mySymbol === 'X' ? 'var(--color-x)' : 'var(--color-o)';
      resultSubtitle.textContent = forfeit ? 'Opponent forfeited by disconnecting.' : 'Brilliant strategy!';
    } else {
      resultIcon.textContent = '😔';
      resultTitle.textContent = 'You Lost';
      resultTitle.style.color = '';
      resultSubtitle.textContent = forfeit ? 'You were disconnected too long.' : 'Better luck next time!';
    }
  }

  function clearDisconnectCountdown(): void {
    if (disconnectCountdownInterval) {
      clearInterval(disconnectCountdownInterval);
      disconnectCountdownInterval = null;
    }
  }

  rematchBtn.addEventListener('click', () => {
    ws.send({ type: 'rematch_request' });
  });

  newGameBtn.addEventListener('click', () => {
    window.location.href = '/';
  });

  acceptRematchBtn.addEventListener('click', () => {
    if (pendingRematchId) {
      ws.send({ type: 'rematch_accept', newGameId: pendingRematchId });
    }
  });

  declineRematchBtn.addEventListener('click', () => {
    ws.send({ type: 'rematch_decline' });
    rematchToast.classList.remove('show');
    pendingRematchId = null;
  });

  function copyToClipboard(text: string, feedbackEl: HTMLElement): void {
    navigator.clipboard.writeText(text).then(() => {
      feedbackEl.classList.add('show');
      setTimeout(() => feedbackEl.classList.remove('show'), 1500);
    });
  }
});
