"use strict";
class BoardRenderer {
    constructor(container, onCellClick) {
        this.boardState = null;
        this.metaBoard = null;
        this.activeBoard = -1;
        this.mySymbol = null;
        this.currentTurn = null;
        this.winner = null;
        this.subBoards = [];
        this.cells = [];
        this.container = container;
        this.onCellClick = onCellClick;
        this._build();
    }
    _build() {
        this.container.innerHTML = '';
        this.subBoards = [];
        this.cells = [];
        for (let bi = 0; bi < 9; bi++) {
            const subBoard = document.createElement('div');
            subBoard.className = 'sub-board';
            subBoard.dataset.board = String(bi);
            const subBoardInner = document.createElement('div');
            subBoardInner.className = 'sub-board-inner';
            const wonOverlay = document.createElement('div');
            wonOverlay.className = 'won-overlay';
            subBoard.appendChild(wonOverlay);
            const cellsForBoard = [];
            for (let ci = 0; ci < 9; ci++) {
                const cell = document.createElement('button');
                cell.className = 'cell';
                cell.dataset.board = String(bi);
                cell.dataset.cell = String(ci);
                cell.addEventListener('click', () => {
                    if (this.onCellClick)
                        this.onCellClick(bi, ci);
                });
                subBoardInner.appendChild(cell);
                cellsForBoard.push(cell);
            }
            subBoard.appendChild(subBoardInner);
            this.container.appendChild(subBoard);
            this.subBoards.push(subBoard);
            this.cells.push(cellsForBoard);
        }
    }
    update(state) {
        this.boardState = state.boardState;
        this.metaBoard = state.metaBoard;
        this.activeBoard = state.activeBoard;
        this.currentTurn = state.currentTurn;
        this.winner = state.winner;
        this._render();
    }
    setMySymbol(symbol) {
        this.mySymbol = symbol;
    }
    _render() {
        if (!this.boardState || !this.metaBoard)
            return;
        const isMyTurn = this.currentTurn === this.mySymbol && !this.winner;
        for (let bi = 0; bi < 9; bi++) {
            const subBoard = this.subBoards[bi];
            const metaResult = this.metaBoard[bi];
            const isActive = !this.winner && (this.activeBoard === -1 || this.activeBoard === bi) && metaResult === null;
            subBoard.classList.toggle('active', isActive);
            subBoard.classList.toggle('my-turn', isActive && isMyTurn);
            subBoard.classList.toggle('won-x', metaResult === 'X');
            subBoard.classList.toggle('won-o', metaResult === 'O');
            subBoard.classList.toggle('won-draw', metaResult === 'draw');
            subBoard.classList.toggle('resolved', metaResult !== null);
            const wonOverlay = subBoard.querySelector('.won-overlay');
            if (metaResult === 'X') {
                wonOverlay.textContent = 'X';
                wonOverlay.className = 'won-overlay show x';
            }
            else if (metaResult === 'O') {
                wonOverlay.textContent = 'O';
                wonOverlay.className = 'won-overlay show o';
            }
            else if (metaResult === 'draw') {
                wonOverlay.textContent = '=';
                wonOverlay.className = 'won-overlay show draw';
            }
            else {
                wonOverlay.textContent = '';
                wonOverlay.className = 'won-overlay';
            }
            for (let ci = 0; ci < 9; ci++) {
                const cell = this.cells[bi][ci];
                const value = this.boardState[bi][ci];
                cell.className = 'cell';
                if (value === 'X')
                    cell.classList.add('x');
                else if (value === 'O')
                    cell.classList.add('o');
                const canClick = isMyTurn && isActive && value === null;
                cell.disabled = !canClick;
                if (canClick) {
                    cell.classList.add('clickable');
                    cell.classList.add(this.mySymbol === 'X' ? 'preview-x' : 'preview-o');
                }
            }
        }
    }
    animateMove(boardIndex, cellIndex, _symbol) {
        const cell = this.cells[boardIndex][cellIndex];
        cell.classList.add('just-placed');
        setTimeout(() => cell.classList.remove('just-placed'), 400);
    }
}
