"use strict";
document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('startGameBtn');
    const joinBtn = document.getElementById('joinGameBtn');
    const codeInput = document.getElementById('gameCodeInput');
    const nameInput = document.getElementById('playerNameInput');
    const errorMsg = document.getElementById('errorMsg');
    const token = getPlayerToken();
    nameInput.value = getPlayerName();
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
            startBtn.textContent = 'Start Game';
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
