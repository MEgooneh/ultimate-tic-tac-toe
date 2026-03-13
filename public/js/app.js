"use strict";
document.addEventListener('DOMContentLoaded', () => {
    // Mode selection
    const localModeBtn = document.getElementById('localModeBtn');
    const onlineModeBtn = document.getElementById('onlineModeBtn');
    const localPanel = document.getElementById('localPanel');
    const onlinePanel = document.getElementById('onlinePanel');
    const localBackBtn = document.getElementById('localBackBtn');
    const onlineBackBtn = document.getElementById('onlineBackBtn');
    const modeCards = document.querySelector('.mode-cards');
    // Online elements
    const startBtn = document.getElementById('startGameBtn');
    const joinBtn = document.getElementById('joinGameBtn');
    const codeInput = document.getElementById('gameCodeInput');
    const nameInput = document.getElementById('playerNameInput');
    const errorMsg = document.getElementById('errorMsg');
    const token = getPlayerToken();
    // Local elements
    const playerXNameInput = document.getElementById('playerXName');
    const playerONameInput = document.getElementById('playerOName');
    const startLocalBtn = document.getElementById('startLocalBtn');
    nameInput.value = getPlayerName();
    function showPanel(panel) {
        modeCards.hidden = true;
        panel.hidden = false;
        panel.classList.add('panel-enter');
        requestAnimationFrame(() => panel.classList.remove('panel-enter'));
    }
    function hidePanel() {
        localPanel.hidden = true;
        onlinePanel.hidden = true;
        modeCards.hidden = false;
    }
    localModeBtn.addEventListener('click', () => showPanel(localPanel));
    onlineModeBtn.addEventListener('click', () => showPanel(onlinePanel));
    localBackBtn.addEventListener('click', hidePanel);
    onlineBackBtn.addEventListener('click', hidePanel);
    // Local game creation
    startLocalBtn.addEventListener('click', async () => {
        const xName = playerXNameInput.value.trim() || 'Player X';
        const oName = playerONameInput.value.trim() || 'Player O';
        startLocalBtn.disabled = true;
        startLocalBtn.textContent = 'Creating...';
        try {
            const res = await fetch('/api/games/local', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playerXName: xName, playerOName: oName }),
            });
            const data = await res.json();
            if (data.error) {
                showError(errorMsg, data.error);
                return;
            }
            window.location.href = `/local/${data.gameId}`;
        }
        catch {
            showError(errorMsg, 'Failed to create game. Please try again.');
        }
        finally {
            startLocalBtn.disabled = false;
            startLocalBtn.textContent = 'Start Local Game';
        }
    });
    // Online game creation
    startBtn.addEventListener('click', async () => {
        const name = nameInput.value.trim() || 'Player';
        setPlayerName(name);
        startBtn.disabled = true;
        startBtn.textContent = 'Creating...';
        try {
            const res = await fetch('/api/games', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playerToken: token, playerName: name }),
            });
            const data = await res.json();
            if (data.error) {
                showError(errorMsg, data.error);
                return;
            }
            window.location.href = `/game/${data.gameId}`;
        }
        catch {
            showError(errorMsg, 'Failed to create game. Please try again.');
        }
        finally {
            startBtn.disabled = false;
            startBtn.textContent = 'Create Game';
        }
    });
    joinBtn.addEventListener('click', () => joinGame());
    codeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter')
            joinGame();
    });
    async function joinGame() {
        const code = codeInput.value.trim();
        if (!code) {
            showError(errorMsg, 'Please enter a game code.');
            return;
        }
        const name = nameInput.value.trim() || 'Player';
        setPlayerName(name);
        joinBtn.disabled = true;
        try {
            const res = await fetch(`/api/games/${code}`);
            const data = await res.json();
            if (data.error) {
                showError(errorMsg, data.error);
                return;
            }
            window.location.href = `/game/${code}`;
        }
        catch {
            showError(errorMsg, 'Game not found. Check the code and try again.');
        }
        finally {
            joinBtn.disabled = false;
        }
    }
});
