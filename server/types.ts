export type PlayerSymbol = 'X' | 'O';
export type CellValue = PlayerSymbol | null;
export type MetaValue = PlayerSymbol | 'draw' | null;
export type GameStatus = 'waiting' | 'active' | 'finished' | 'expired';
export type GameMode = 'online' | 'local';

export type SubBoard = CellValue[];
export type BoardState = SubBoard[];
export type MetaBoard = MetaValue[];

export interface GameRow {
  id: string;
  status: GameStatus;
  player_x: string;
  player_x_name: string;
  player_o: string | null;
  player_o_name: string;
  current_turn: PlayerSymbol;
  board_state: string;
  active_board: number;
  winner: PlayerSymbol | 'draw' | null;
  meta_board: string;
  created_at: number;
  updated_at: number;
  finished_at: number | null;
  rematch_game_id: string | null;
  parent_game_id: string | null;
  game_mode: GameMode;
}

export interface GameState {
  id: string;
  status: GameStatus;
  currentTurn: PlayerSymbol;
  boardState: BoardState;
  activeBoard: number;
  winner: PlayerSymbol | 'draw' | null;
  metaBoard: MetaBoard;
  rematchGameId: string | null;
  parentGameId: string | null;
  playerXName: string;
  playerOName: string;
  createdAt: number;
}

export interface MoveResult {
  boardState: BoardState;
  metaBoard: MetaBoard;
  activeBoard: number;
  winner: PlayerSymbol | 'draw' | null;
}

export interface ActiveGame {
  connections: { X: import('ws').WebSocket | null; O: import('ws').WebSocket | null };
  expiryTimeout: ReturnType<typeof setTimeout> | null;
  disconnectTimeout: ReturnType<typeof setTimeout> | null;
}

export interface GameUpdateFields {
  status?: GameStatus;
  player_o?: string;
  player_o_name?: string;
  current_turn?: PlayerSymbol;
  board_state?: string;
  active_board?: number;
  winner?: PlayerSymbol | 'draw' | null;
  meta_board?: string;
  updated_at?: number;
  finished_at?: number | null;
  rematch_game_id?: string | null;
  parent_game_id?: string | null;
  game_mode?: GameMode;
}
