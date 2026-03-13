document.addEventListener('DOMContentLoaded', () => {
  const gameId = window.location.pathname.split('/').pop()!;

  const indicatorX = document.getElementById('indicatorX') as HTMLElement;
  const indicatorO = document.getElementById('indicatorO') as HTMLElement;
  const playerXNameEl = document.getElementById('playerXName') as HTMLElement;
  const playerONameEl = document.getElementById('playerOName') as HTMLElement;
  const statusBar = document.getElementById('statusBar') as HTMLElement;
  const gameOverOverlay = document.getElementById('gameOverOverlay') as HTMLElement;
  const resultIcon = document.getElementById('resultIcon') as HTMLElement;
  const resultTitle = document.getElementById('resultTitle') as HTMLElement;
  const resultSubtitle = document.getElementById('resultSubtitle') as HTMLElement;
  const rematchBtn = document.getElementById('rematchBtn') as HTMLButtonElement;
  const newGameBtn = document.getElementById('newGameBtn') as HTMLButtonElement;
  const metaBoardEl = document.getElementById('metaBoard') as HTMLElement;

  let gameState: Record<string, any> | null = null;
  let currentTurn: string = 'X';
  let winner: string | null = null;
  let movePending = false;

  const board = new BoardRenderer(metaBoardEl, async (boardIndex: number, cellIndex: number) => {
    if (movePending || winner) return;
    await makeMove(boardIndex, cellIndex);
  });

  // Load initial state
  loadGame();

  async function loadGame(): Promise<void> {
    try {
      const res = await fetch(`/api/games/${gameId}`);
      const data = await res.json();
      if (data.error) {
        statusBar.textContent = 'Game not found';
        return;
      }
      gameState = data;
      currentTurn = data.currentTurn;
      winner = data.winner;

      playerXNameEl.textContent = data.playerXName || 'Player X';
      playerONameEl.textContent = data.playerOName || 'Player O';

      // For local games, we alternate mySymbol to show correct previews
      board.setMySymbol(currentTurn);
      board.update(data);
      updateIndicators();
      updateStatus();

      if (data.status === 'finished') {
        showGameOver(data.winner);
      }
    } catch {
      statusBar.textContent = 'Failed to load game';
    }
  }

  async function makeMove(boardIndex: number, cellIndex: number): Promise<void> {
    movePending = true;
    try {
      const res = await fetch(`/api/games/local/${gameId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardIndex, cellIndex }),
      });
      const data = await res.json();
      if (data.error) {
        movePending = false;
        return;
      }

      // Update state
      currentTurn = data.symbol === 'X' ? 'O' : 'X';
      winner = data.winner;
      gameState = {
        ...gameState,
        boardState: data.boardState,
        metaBoard: data.metaBoard,
        activeBoard: data.activeBoard,
        currentTurn,
        winner,
        status: winner ? 'finished' : 'active',
      };

      // Update board — set mySymbol to current turn for hover previews
      board.setMySymbol(currentTurn);
      board.update(gameState as any);
      board.animateMove(data.boardIndex, data.cellIndex, data.symbol);
      updateIndicators();
      updateStatus();

      if (winner) {
        showGameOver(winner);
      }
    } catch {
      // Silently fail
    } finally {
      movePending = false;
    }
  }

  function updateStatus(): void {
    if (winner) return;
    const turnName = currentTurn === 'X'
      ? (playerXNameEl.textContent || 'Player X')
      : (playerONameEl.textContent || 'Player O');
    statusBar.textContent = `${turnName}'s turn`;
    statusBar.className = 'status-bar your-turn';
  }

  function updateIndicators(): void {
    indicatorX.classList.toggle('active', currentTurn === 'X');
    indicatorO.classList.toggle('active', currentTurn === 'O');
    // No "you" indicator in local mode
    indicatorX.classList.remove('you');
    indicatorO.classList.remove('you');
  }

  function showGameOver(w: string): void {
    gameOverOverlay.hidden = false;
    const xName = playerXNameEl.textContent || 'Player X';
    const oName = playerONameEl.textContent || 'Player O';

    if (w === 'draw') {
      resultIcon.textContent = '\u{1F91D}';
      resultTitle.textContent = "It's a Draw!";
      resultTitle.style.color = '';
      resultSubtitle.textContent = 'Well played by both sides.';
    } else {
      const winnerName = w === 'X' ? xName : oName;
      resultIcon.textContent = '\u{1F389}';
      resultTitle.textContent = `${winnerName} Wins!`;
      resultTitle.style.color = w === 'X' ? 'var(--color-x)' : 'var(--color-o)';
      resultSubtitle.textContent = 'Great game!';
    }
  }

  rematchBtn.addEventListener('click', async () => {
    rematchBtn.disabled = true;
    rematchBtn.textContent = 'Creating...';
    try {
      const res = await fetch(`/api/games/local/${gameId}/rematch`, { method: 'POST' });
      const data = await res.json();
      if (data.error) {
        rematchBtn.disabled = false;
        rematchBtn.textContent = 'Play Again';
        return;
      }
      window.location.href = `/local/${data.newGameId}`;
    } catch {
      rematchBtn.disabled = false;
      rematchBtn.textContent = 'Play Again';
    }
  });

  newGameBtn.addEventListener('click', () => {
    window.location.href = '/';
  });
});
