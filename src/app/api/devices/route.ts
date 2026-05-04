import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();

  const devices = db.prepare(`
    SELECT
      d.id,
      d.name,
      d.hostname,
      d.platform,
      d.first_seen,
      d.last_seen,
      COUNT(u.id)               AS total_turns,
      COALESCE(SUM(u.input_tokens),  0) AS total_input,
      COALESCE(SUM(u.output_tokens), 0) AS total_output,
      COALESCE(SUM(u.cost_usd),      0) AS total_cost
    FROM devices d
    LEFT JOIN usage_turns u ON u.device_id = d.id
    GROUP BY d.id
    ORDER BY d.last_seen DESC
  `).all();

  return NextResponse.json(devices);
}
