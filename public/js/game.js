"use strict";
document.addEventListener('DOMContentLoaded', () => {
    const gameId = window.location.pathname.split('/').pop();
    const token = getPlayerToken();
    const gameCodeEl = document.getElementById('gameCode');
    const copiedMsg = document.getElementById('copiedMsg');
    const indicatorX = document.getElementById('indicatorX');
    const indicatorO = document.getElementById('indicatorO');
    const playerXNameEl = document.getElementById('playerXName');
    const playerONameEl = document.getElementById('playerOName');
    const statusBar = document.getElementById('statusBar');
    const waitingOverlay = document.getElementById('waitingOverlay');
    const waitingCode = document.getElementById('waitingCode');
    const shareLink = document.getElementById('shareLink');
    const copyLinkBtn = document.getElementById('copyLinkBtn');
    const countdownTimer = document.getElementById('countdownTimer');
    const gameOverOverlay = document.getElementById('gameOverOverlay');
    const resultIcon = document.getElementById('resultIcon');
    const resultTitle = document.getElementById('resultTitle');
    const resultSubtitle = document.getElementById('resultSubtitle');
    const rematchBtn = document.getElementById('rematchBtn');
    const newGameBtn = document.getElementById('newGameBtn');
    const rematchToast = document.getElementById('rematchToast');
    const acceptRematchBtn = document.getElementById('acceptRematchBtn');
    const declineRematchBtn = document.getElementById('declineRematchBtn');
    const metaBoardEl = document.getElementById('metaBoard');
    const nameOverlay = document.getElementById('nameOverlay');
    const nameEntryInput = document.getElementById('nameEntryInput');
    const nameEntryBtn = document.getElementById('nameEntryBtn');
    let mySymbol = null;
    let gameState = null;
    let countdownInterval = null;
    let pendingRematchId = null;
    let disconnectCountdownInterval = null;
    let ws;
    gameCodeEl.textContent = gameId;
    gameCodeEl.addEventListener('click', () => copyToClipboard(gameId, copiedMsg));
    const board = new BoardRenderer(metaBoardEl, (boardIndex, cellIndex) => {
        ws.send({ type: 'move', boardIndex, cellIndex });
    });
    // Check if this player is joining a game they're not yet part of.
    // If so, show the name entry popup before connecting.
    checkAndConnect();
    async function checkAndConnect() {
        try {
            const res = await fetch(`/api/games/${gameId}?playerToken=${encodeURIComponent(token)}`);
            const data = await res.json();
            // If game is waiting and we're not the creator, we're joining — ask for name
            if (data.status === 'waiting' && !data.isPlayer) {
                showNamePopup();
                return;
            }
        }
        catch {
            // On error, just connect with whatever name we have
        }
        startGame(getPlayerName() || 'Player');
    }
    function showNamePopup() {
        nameEntryInput.value = getPlayerName();
        nameOverlay.hidden = false;
        nameEntryInput.focus();
        nameEntryBtn.addEventListener('click', submitName);
        nameEntryInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter')
                submitName();
        });
    }
    function submitName() {
        const name = nameEntryInput.value.trim() || 'Player';
        setPlayerName(name);
        nameOverlay.hidden = true;
        startGame(name);
    }
    function startGame(playerName) {
        ws = new WsClient(gameId, token, playerName);
        setupWsHandlers();
        ws.connect();
    }
    function setupWsHandlers() {
        ws.on('game_state', (data) => {
            gameState = data;
            mySymbol = data.yourSymbol;
            board.setMySymbol(mySymbol);
            board.update(data);
            updateIndicators(data);
            updateStatus(data);
            if (data.status === 'waiting') {
                showWaiting();
            }
            else if (data.status === 'finished') {
                showGameOver(data.winner);
            }
            else {
                waitingOverlay.hidden = true;
            }
        });
        ws.on('game_started', (data) => {
            gameState = data;
            waitingOverlay.hidden = true;
            clearCountdown();
            board.update(data);
            updateIndicators(data);
            updateStatus(data);
        });
        ws.on('move_made', (data) => {
            gameState = {
                ...gameState,
                boardState: data.boardState,
                metaBoard: data.metaBoard,
                activeBoard: data.activeBoard,
                currentTurn: data.symbol === 'X' ? 'O' : 'X',
            };
            board.update(gameState);
            board.animateMove(data.boardIndex, data.cellIndex, data.symbol);
            updateIndicators(gameState);
            updateStatus(gameState);
        });
        ws.on('invalid_move', (data) => {
            statusBar.textContent = data.reason;
            statusBar.className = 'status-bar';
            setTimeout(() => updateStatus(gameState), 2000);
        });
        ws.on('game_over', (data) => {
            clearDisconnectCountdown();
            if (gameState) {
                gameState.winner = data.winner;
                gameState.status = 'finished';
            }
            showGameOver(data.winner, data.forfeit);
        });
        ws.on('opponent_disconnected', (data) => {
            clearDisconnectCountdown();
            if (data && data.forfeitIn) {
                const expiresAt = Date.now() + data.forfeitIn;
                disconnectCountdownInterval = setInterval(() => {
                    const remaining = Math.max(0, expiresAt - Date.now());
                    const mins = Math.floor(remaining / 60000);
                    const secs = Math.floor((remaining % 60000) / 1000);
                    statusBar.textContent = `Opponent disconnected — forfeit in ${mins}:${secs.toString().padStart(2, '0')}`;
                    statusBar.className = 'status-bar';
                    if (remaining <= 0)
                        clearDisconnectCountdown();
                }, 1000);
            }
            else {
                statusBar.textContent = 'Opponent disconnected...';
                statusBar.className = 'status-bar';
            }
        });
        ws.on('opponent_reconnected', () => {
            clearDisconnectCountdown();
            if (gameState)
                updateStatus(gameState);
        });
        ws.on('game_expired', () => {
            clearCountdown();
            window.location.href = '/';
        });
        ws.on('rematch_offered', (data) => {
            pendingRematchId = data.newGameId;
            if (data.byYou) {
                rematchBtn.disabled = true;
                rematchBtn.textContent = 'Waiting...';
            }
            else {
                rematchToast.classList.add('show');
            }
        });
        ws.on('rematch_accepted', (data) => {
            window.location.href = `/game/${data.newGameId}`;
        });
        ws.on('rematch_declined', () => {
            rematchBtn.disabled = false;
            rematchBtn.textContent = 'Play Again';
            statusBar.textContent = 'Opponent declined the rematch';
            statusBar.className = 'status-bar';
        });
        ws.on('error', (data) => {
            console.error('WS error:', data.message);
        });
        ws.on('disconnected', () => {
            statusBar.textContent = 'Reconnecting...';
            statusBar.className = 'status-bar pulse';
        });
        ws.on('connected', () => {
            if (gameState)
                updateStatus(gameState);
        });
    } // end setupWsHandlers
    function showWaiting() {
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
    function startCountdown() {
        clearCountdown();
        // Sync with server: game expires 10 minutes after creation
        const createdAt = gameState?.createdAt || Date.now();
        const expiresAt = createdAt + 10 * 60 * 1000;
        countdownInterval = setInterval(() => {
            const remaining = Math.max(0, expiresAt - Date.now());
            const mins = Math.floor(remaining / 60000);
            const secs = Math.floor((remaining % 60000) / 1000);
            countdownTimer.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
            if (remaining <= 0) {
                clearCountdown();
                window.location.href = '/';
            }
        }, 1000);
    }
    function clearCountdown() {
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
    }
    function updateStatus(state) {
        if (!state)
            return;
        if (state.status === 'waiting') {
            statusBar.textContent = 'Waiting for opponent...';
            statusBar.className = 'status-bar pulse';
        }
        else if (state.status === 'finished') {
            // handled by overlay
        }
        else if (state.currentTurn === mySymbol) {
            statusBar.textContent = 'Your turn';
            statusBar.className = 'status-bar your-turn';
        }
        else {
            statusBar.textContent = "Opponent's turn";
            statusBar.className = 'status-bar';
        }
    }
    function updateIndicators(state) {
        indicatorX.classList.toggle('active', state.currentTurn === 'X');
        indicatorO.classList.toggle('active', state.currentTurn === 'O');
        indicatorX.classList.toggle('you', mySymbol === 'X');
        indicatorO.classList.toggle('you', mySymbol === 'O');
        if (state.playerXName)
            playerXNameEl.textContent = state.playerXName;
        if (state.playerOName)
            playerONameEl.textContent = state.playerOName;
    }
    function showGameOver(winner, forfeit) {
        gameOverOverlay.hidden = false;
        if (winner === 'draw') {
            resultIcon.textContent = '🤝';
            resultTitle.textContent = "It's a Draw!";
            resultSubtitle.textContent = 'Well played by both sides.';
        }
        else if (winner === mySymbol) {
            resultIcon.textContent = '🎉';
            resultTitle.textContent = 'You Won!';
            resultTitle.style.color = mySymbol === 'X' ? 'var(--color-x)' : 'var(--color-o)';
            resultSubtitle.textContent = forfeit ? 'Opponent forfeited by disconnecting.' : 'Brilliant strategy!';
        }
        else {
            resultIcon.textContent = '😔';
            resultTitle.textContent = 'You Lost';
            resultTitle.style.color = '';
            resultSubtitle.textContent = forfeit ? 'You were disconnected too long.' : 'Better luck next time!';
        }
    }
    function clearDisconnectCountdown() {
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
    function copyToClipboard(text, feedbackEl) {
        navigator.clipboard.writeText(text).then(() => {
            feedbackEl.classList.add('show');
            setTimeout(() => feedbackEl.classList.remove('show'), 1500);
        });
    }
});
