import { DatabaseSync } from 'node:sqlite';
import config from './config';
import type { GameRow, GameUpdateFields } from './types';

let db: DatabaseSync;

export function init(): DatabaseSync {
  db = new DatabaseSync(config.dbPath);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'waiting',
      player_x TEXT NOT NULL,
      player_x_name TEXT DEFAULT 'Player X',
      player_o TEXT,
      player_o_name TEXT DEFAULT 'Player O',
      current_turn TEXT NOT NULL DEFAULT 'X',
      board_state TEXT NOT NULL,
      active_board INTEGER DEFAULT -1,
      winner TEXT,
      meta_board TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      finished_at INTEGER,
      rematch_game_id TEXT,
      parent_game_id TEXT
    )
  `);

  db.exec('CREATE INDEX IF NOT EXISTS idx_games_status ON games(status)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_games_created_at ON games(created_at)');

  return db;
}

function getDb(): DatabaseSync {
  if (!db) throw new Error('Database not initialized. Call init() first.');
  return db;
}

export function createGame(game: GameRow): void {
  const stmt = getDb().prepare(`
    INSERT INTO games (id, status, player_x, player_x_name, player_o, player_o_name, current_turn, board_state, active_board, winner, meta_board, created_at, updated_at, finished_at, rematch_game_id, parent_game_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(game.id, game.status, game.player_x, game.player_x_name, game.player_o, game.player_o_name, game.current_turn, game.board_state, game.active_board, game.winner, game.meta_board, game.created_at, game.updated_at, game.finished_at, game.rematch_game_id, game.parent_game_id);
}

export function getGame(id: string): GameRow | undefined {
  const stmt = getDb().prepare('SELECT * FROM games WHERE id = ?');
  return stmt.get(id) as GameRow | undefined;
}

export function updateGame(id: string, fields: GameUpdateFields): void {
  const keys = Object.keys(fields) as (keyof GameUpdateFields)[];
  const sets = keys.map(k => `${k} = ?`).join(', ');
  const values = keys.map(k => fields[k] as string | number | null);
  const stmt = getDb().prepare(`UPDATE games SET ${sets} WHERE id = ?`);
  stmt.run(...values, id);
}

export function getExpiredWaitingGames(cutoffTs: number): { id: string }[] {
  const stmt = getDb().prepare('SELECT id FROM games WHERE status = ? AND created_at < ?');
  return stmt.all('waiting', cutoffTs) as { id: string }[];
}

export function deleteOldGames(cutoffTs: number): void {
  const stmt = getDb().prepare('DELETE FROM games WHERE status IN (?, ?, ?) AND updated_at < ?');
  stmt.run('finished', 'expired', 'waiting', cutoffTs);
}

export function getDbSizeInfo(): { count: number } {
  const stmt = getDb().prepare('SELECT COUNT(*) as count FROM games');
  return stmt.get() as { count: number };
}

export function close(): void {
  if (db) db.close();
}
