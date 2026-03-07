"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WINNING_LINES = void 0;
exports.createEmptyBoard = createEmptyBoard;
exports.createEmptyMetaBoard = createEmptyMetaBoard;
exports.checkWinner = checkWinner;
exports.isValidMove = isValidMove;
exports.applyMove = applyMove;
exports.checkMetaWinner = checkMetaWinner;
exports.getNextActiveBoard = getNextActiveBoard;
exports.WINNING_LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
];
function createEmptyBoard() {
    return Array.from({ length: 9 }, () => Array(9).fill(null));
}
function createEmptyMetaBoard() {
    return Array(9).fill(null);
}
function checkWinner(cells) {
    for (const [a, b, c] of exports.WINNING_LINES) {
        if (cells[a] && cells[a] === cells[b] && cells[a] === cells[c]) {
            return cells[a];
        }
    }
    if (cells.every(c => c !== null))
        return 'draw';
    return null;
}
function isValidMove(boardState, metaBoard, activeBoard, boardIndex, cellIndex, _currentTurn, status) {
    if (status !== 'active')
        return false;
    if (boardIndex < 0 || boardIndex > 8 || cellIndex < 0 || cellIndex > 8)
        return false;
    if (metaBoard[boardIndex] !== null)
        return false;
    if (boardState[boardIndex][cellIndex] !== null)
        return false;
    if (activeBoard !== -1 && activeBoard !== boardIndex)
        return false;
    return true;
}
function applyMove(boardState, metaBoard, boardIndex, cellIndex, symbol) {
    const newBoard = boardState.map(sb => [...sb]);
    const newMeta = [...metaBoard];
    newBoard[boardIndex][cellIndex] = symbol;
    const subResult = checkWinner(newBoard[boardIndex]);
    if (subResult) {
        newMeta[boardIndex] = subResult;
    }
    const nextActive = getNextActiveBoard(cellIndex, newMeta);
    const gameWinner = checkMetaWinner(newMeta);
    return {
        boardState: newBoard,
        metaBoard: newMeta,
        activeBoard: nextActive,
        winner: gameWinner,
    };
}
function checkMetaWinner(metaBoard) {
    for (const [a, b, c] of exports.WINNING_LINES) {
        const va = metaBoard[a], vb = metaBoard[b], vc = metaBoard[c];
        if (va && va !== 'draw' && va === vb && va === vc) {
            return va;
        }
    }
    if (metaBoard.every(c => c !== null))
        return 'draw';
    return null;
}
function getNextActiveBoard(cellIndex, metaBoard) {
    if (metaBoard[cellIndex] !== null)
        return -1;
    return cellIndex;
}
