import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import type { GameState } from '@gloomhaven-command/shared';

export class GameStore {
  private db: Database.Database;

  constructor(dbPath: string = './data/ghs.sqlite') {
    const dir = dirname(dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS games (
        game_code TEXT PRIMARY KEY,
        state TEXT NOT NULL,
        revision INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  }

  load(gameCode: string): GameState | null {
    const row = this.db
      .prepare('SELECT state FROM games WHERE game_code = ?')
      .get(gameCode) as { state: string } | undefined;

    if (!row) return null;

    try {
      return JSON.parse(row.state) as GameState;
    } catch {
      return null;
    }
  }

  save(gameCode: string, state: GameState): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO games (game_code, state, revision, updated_at)
         VALUES (?, ?, ?, datetime('now'))`
      )
      .run(gameCode, JSON.stringify(state), state.revision);
  }

  listGames(): Array<{ gameCode: string; revision: number; updatedAt: string }> {
    const rows = this.db
      .prepare('SELECT game_code, revision, updated_at FROM games')
      .all() as Array<{ game_code: string; revision: number; updated_at: string }>;

    return rows.map((r) => ({
      gameCode: r.game_code,
      revision: r.revision,
      updatedAt: r.updated_at,
    }));
  }

  deleteGame(gameCode: string): boolean {
    const result = this.db
      .prepare('DELETE FROM games WHERE game_code = ?')
      .run(gameCode);
    return result.changes > 0;
  }

  close(): void {
    this.db.close();
  }
}
