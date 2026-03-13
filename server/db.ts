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
      parent_game_id TEXT,
      game_mode TEXT DEFAULT 'online'
    )
  `);

  db.exec('CREATE INDEX IF NOT EXISTS idx_games_status ON games(status)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_games_created_at ON games(created_at)');

  // Migration: add game_mode column if missing (for existing databases)
  try {
    db.exec('ALTER TABLE games ADD COLUMN game_mode TEXT DEFAULT \'online\'');
  } catch { /* column already exists */ }

  return db;
}

function getDb(): DatabaseSync {
  if (!db) throw new Error('Database not initialized. Call init() first.');
  return db;
}

export function createGame(game: GameRow): void {
  const stmt = getDb().prepare(`
    INSERT INTO games (id, status, player_x, player_x_name, player_o, player_o_name, current_turn, board_state, active_board, winner, meta_board, created_at, updated_at, finished_at, rematch_game_id, parent_game_id, game_mode)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(game.id, game.status, game.player_x, game.player_x_name, game.player_o, game.player_o_name, game.current_turn, game.board_state, game.active_board, game.winner, game.meta_board, game.created_at, game.updated_at, game.finished_at, game.rematch_game_id, game.parent_game_id, game.game_mode || 'online');
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

/* ── Admin stats queries ─────────────────────────────────────── */

export interface StatsOverview {
  totalGames: number;
  activeGames: number;
  finishedGames: number;
  waitingGames: number;
  expiredGames: number;
  xWins: number;
  oWins: number;
  draws: number;
  avgGameDurationMs: number | null;
  onlineGames: number;
  localGames: number;
}

export function getStatsOverview(): StatsOverview {
  const d = getDb();
  const totals = d.prepare(`
    SELECT
      COUNT(*) as totalGames,
      SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) as activeGames,
      SUM(CASE WHEN status='finished' THEN 1 ELSE 0 END) as finishedGames,
      SUM(CASE WHEN status='waiting' THEN 1 ELSE 0 END) as waitingGames,
      SUM(CASE WHEN status='expired' THEN 1 ELSE 0 END) as expiredGames,
      SUM(CASE WHEN winner='X' THEN 1 ELSE 0 END) as xWins,
      SUM(CASE WHEN winner='O' THEN 1 ELSE 0 END) as oWins,
      SUM(CASE WHEN winner='draw' THEN 1 ELSE 0 END) as draws,
      SUM(CASE WHEN COALESCE(game_mode,'online')='online' THEN 1 ELSE 0 END) as onlineGames,
      SUM(CASE WHEN game_mode='local' THEN 1 ELSE 0 END) as localGames
    FROM games
  `).get() as any;

  const avg = d.prepare(`
    SELECT AVG(finished_at - created_at) as avgDur
    FROM games WHERE status='finished' AND finished_at IS NOT NULL
  `).get() as any;

  return {
    totalGames: totals.totalGames ?? 0,
    activeGames: totals.activeGames ?? 0,
    finishedGames: totals.finishedGames ?? 0,
    waitingGames: totals.waitingGames ?? 0,
    expiredGames: totals.expiredGames ?? 0,
    xWins: totals.xWins ?? 0,
    oWins: totals.oWins ?? 0,
    draws: totals.draws ?? 0,
    avgGameDurationMs: avg.avgDur ?? null,
    onlineGames: totals.onlineGames ?? 0,
    localGames: totals.localGames ?? 0,
  };
}

export interface TimeSeriesPoint { date: string; count: number }

export function getGamesTimeSeries(days: number = 30): TimeSeriesPoint[] {
  const d = getDb();
  const cutoff = Date.now() - days * 86400000;
  return d.prepare(`
    SELECT
      date(created_at / 1000, 'unixepoch') as date,
      COUNT(*) as count
    FROM games
    WHERE created_at > ?
    GROUP BY date
    ORDER BY date ASC
  `).all(cutoff) as unknown as TimeSeriesPoint[];
}

export function getFinishedTimeSeries(days: number = 30): TimeSeriesPoint[] {
  const d = getDb();
  const cutoff = Date.now() - days * 86400000;
  return d.prepare(`
    SELECT
      date(finished_at / 1000, 'unixepoch') as date,
      COUNT(*) as count
    FROM games
    WHERE finished_at IS NOT NULL AND finished_at > ?
    GROUP BY date
    ORDER BY date ASC
  `).all(cutoff) as unknown as TimeSeriesPoint[];
}

export interface GameListRow {
  id: string;
  status: string;
  player_x_name: string;
  player_o_name: string;
  winner: string | null;
  created_at: number;
  finished_at: number | null;
  game_mode: string;
}

export function getGamesList(page: number, pageSize: number = 20): { games: GameListRow[]; total: number } {
  const d = getDb();
  const total = (d.prepare('SELECT COUNT(*) as c FROM games').get() as any).c as number;
  const offset = (page - 1) * pageSize;
  const games = d.prepare(`
    SELECT id, status, player_x_name, player_o_name, winner, created_at, finished_at, COALESCE(game_mode, 'online') as game_mode
    FROM games ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).all(pageSize, offset) as unknown as GameListRow[];
  return { games, total };
}

export function getHourlyDistribution(): { hour: number; count: number }[] {
  const d = getDb();
  return d.prepare(`
    SELECT
      CAST(strftime('%H', created_at / 1000, 'unixepoch') AS INTEGER) as hour,
      COUNT(*) as count
    FROM games
    GROUP BY hour ORDER BY hour
  `).all() as { hour: number; count: number }[];
}

export function close(): void {
  if (db) db.close();
}
