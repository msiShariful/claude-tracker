import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'tracker.db');

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  opus: { input: 15, output: 75 },
  sonnet: { input: 3, output: 15 },
  haiku: { input: 0.8, output: 4 },
};

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const lower = model.toLowerCase();
  const key = Object.keys(MODEL_PRICING).find(k => lower.includes(k)) ?? 'sonnet';
  const { input, output } = MODEL_PRICING[key];
  return (inputTokens / 1_000_000) * input + (outputTokens / 1_000_000) * output;
}

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');

  _db.exec(`
    CREATE TABLE IF NOT EXISTS devices (
      id       TEXT PRIMARY KEY,
      name     TEXT NOT NULL,
      hostname TEXT,
      platform TEXT,
      first_seen TEXT NOT NULL,
      last_seen  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS usage_turns (
      id                    TEXT PRIMARY KEY,
      device_id             TEXT NOT NULL REFERENCES devices(id),
      session_id            TEXT,
      model                 TEXT NOT NULL,
      input_tokens          INTEGER NOT NULL DEFAULT 0,
      output_tokens         INTEGER NOT NULL DEFAULT 0,
      cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
      cache_read_tokens     INTEGER NOT NULL DEFAULT 0,
      cost_usd              REAL    NOT NULL DEFAULT 0,
      recorded_at           TEXT    NOT NULL,
      synced_at             TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_turns_device   ON usage_turns(device_id);
    CREATE INDEX IF NOT EXISTS idx_turns_recorded ON usage_turns(recorded_at);
    CREATE INDEX IF NOT EXISTS idx_turns_model    ON usage_turns(model);
  `);

  return _db;
}
