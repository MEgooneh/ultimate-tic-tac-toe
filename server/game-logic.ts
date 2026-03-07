import type { BoardState, MetaBoard, CellValue, MetaValue, PlayerSymbol, MoveResult, GameStatus } from './types';

export const WINNING_LINES: readonly [number, number, number][] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export function createEmptyBoard(): BoardState {
  return Array.from({ length: 9 }, () => Array<CellValue>(9).fill(null));
}

export function createEmptyMetaBoard(): MetaBoard {
  return Array<MetaValue>(9).fill(null);
}

export function checkWinner(cells: CellValue[]): PlayerSymbol | 'draw' | null {
  for (const [a, b, c] of WINNING_LINES) {
    if (cells[a] && cells[a] === cells[b] && cells[a] === cells[c]) {
      return cells[a] as PlayerSymbol;
    }
  }
  if (cells.every(c => c !== null)) return 'draw';
  return null;
}

export function isValidMove(
  boardState: BoardState,
  metaBoard: MetaBoard,
  activeBoard: number,
  boardIndex: number,
  cellIndex: number,
  _currentTurn: PlayerSymbol,
  status: GameStatus,
): boolean {
  if (status !== 'active') return false;
  if (boardIndex < 0 || boardIndex > 8 || cellIndex < 0 || cellIndex > 8) return false;
  if (metaBoard[boardIndex] !== null) return false;
  if (boardState[boardIndex][cellIndex] !== null) return false;
  if (activeBoard !== -1 && activeBoard !== boardIndex) return false;
  return true;
}

export function applyMove(
  boardState: BoardState,
  metaBoard: MetaBoard,
  boardIndex: number,
  cellIndex: number,
  symbol: PlayerSymbol,
): MoveResult {
  const newBoard: BoardState = boardState.map(sb => [...sb]);
  const newMeta: MetaBoard = [...metaBoard];

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

export function checkMetaWinner(metaBoard: MetaBoard): PlayerSymbol | 'draw' | null {
  for (const [a, b, c] of WINNING_LINES) {
    const va = metaBoard[a], vb = metaBoard[b], vc = metaBoard[c];
    if (va && va !== 'draw' && va === vb && va === vc) {
      return va;
    }
  }
  if (metaBoard.every(c => c !== null)) return 'draw';
  return null;
}

export function getNextActiveBoard(cellIndex: number, metaBoard: MetaBoard): number {
  if (metaBoard[cellIndex] !== null) return -1;
  return cellIndex;
}
