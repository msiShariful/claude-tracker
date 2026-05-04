import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

function dateThreshold(filter: string): string {
  switch (filter) {
    case 'day':   return "datetime('now', '-1 day')";
    case 'week':  return "datetime('now', '-7 days')";
    case 'month': return "datetime('now', '-30 days')";
    default:      return "'1970-01-01'";
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const filter = searchParams.get('filter') ?? 'alltime';
  const device = searchParams.get('device') ?? null;

  const db     = getDb();
  const thresh = dateThreshold(filter);
  const params: (string | number)[] = [];

  let deviceClause = '';
  if (device) {
    deviceClause = 'AND device_id = ?';
    params.push(device);
  }

  const summary = db.prepare(`
    SELECT
      COUNT(*)                          AS total_turns,
      COALESCE(SUM(input_tokens),  0)  AS total_input,
      COALESCE(SUM(output_tokens), 0)  AS total_output,
      COALESCE(SUM(cost_usd),      0)  AS total_cost,
      COUNT(DISTINCT device_id)        AS active_devices,
      COUNT(DISTINCT session_id)       AS total_sessions
    FROM usage_turns
    WHERE recorded_at >= ${thresh} ${deviceClause}
  `).get(...params);

  const byModel = db.prepare(`
    SELECT
      model,
      COUNT(*)                          AS turns,
      COALESCE(SUM(input_tokens),  0)  AS input_tokens,
      COALESCE(SUM(output_tokens), 0)  AS output_tokens,
      COALESCE(SUM(cost_usd),      0)  AS cost_usd
    FROM usage_turns
    WHERE recorded_at >= ${thresh} ${deviceClause}
    GROUP BY model
    ORDER BY cost_usd DESC
  `).all(...params);

  const byDevice = db.prepare(`
    SELECT
      d.id, d.name,
      COUNT(u.id)                       AS turns,
      COALESCE(SUM(u.input_tokens),  0) AS input_tokens,
      COALESCE(SUM(u.output_tokens), 0) AS output_tokens,
      COALESCE(SUM(u.cost_usd),      0) AS cost_usd
    FROM usage_turns u
    JOIN devices d ON d.id = u.device_id
    WHERE u.recorded_at >= ${thresh} ${deviceClause}
    GROUP BY u.device_id
    ORDER BY cost_usd DESC
  `).all(...params);

  const trend = db.prepare(`
    SELECT
      date(recorded_at)                 AS day,
      COALESCE(SUM(input_tokens),  0)  AS input_tokens,
      COALESCE(SUM(output_tokens), 0)  AS output_tokens,
      COALESCE(SUM(cost_usd),      0)  AS cost_usd
    FROM usage_turns
    WHERE recorded_at >= datetime('now', '-30 days') ${deviceClause}
    GROUP BY day
    ORDER BY day ASC
  `).all(...params);

  return NextResponse.json({ summary, byModel, byDevice, trend });
}
