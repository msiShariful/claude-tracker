import { NextRequest, NextResponse } from 'next/server';
import { getDb, estimateCost } from '@/lib/db';

interface Turn {
  id: string;
  session_id?: string;
  model?: string;
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_tokens?: number;
  cache_read_tokens?: number;
  recorded_at?: string;
}

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key');
  if (!apiKey || apiKey !== process.env.TRACKER_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { device_id, device_name, hostname, platform, turns } = body as {
    device_id: string;
    device_name?: string;
    hostname?: string;
    platform?: string;
    turns: Turn[];
  };

  if (!device_id || !Array.isArray(turns) || turns.length === 0) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const db = getDb();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO devices (id, name, hostname, platform, first_seen, last_seen)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name      = excluded.name,
      hostname  = excluded.hostname,
      last_seen = excluded.last_seen
  `).run(device_id, device_name ?? device_id, hostname ?? '', platform ?? '', now, now);

  const insert = db.prepare(`
    INSERT OR IGNORE INTO usage_turns
      (id, device_id, session_id, model, input_tokens, output_tokens,
       cache_creation_tokens, cache_read_tokens, cost_usd, recorded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let inserted = 0;
  const insertMany = db.transaction((rows: Turn[]) => {
    for (const t of rows) {
      const cost = estimateCost(t.model ?? '', t.input_tokens ?? 0, t.output_tokens ?? 0);
      const r = insert.run(
        t.id,
        device_id,
        t.session_id ?? null,
        t.model ?? 'unknown',
        t.input_tokens ?? 0,
        t.output_tokens ?? 0,
        t.cache_creation_tokens ?? 0,
        t.cache_read_tokens ?? 0,
        cost,
        t.recorded_at ?? now,
      );
      inserted += r.changes;
    }
  });

  insertMany(turns);

  return NextResponse.json({ ok: true, inserted });
}
