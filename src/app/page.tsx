'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { RefreshCw, Monitor, DollarSign, Hash, Layers, Clock, Cpu } from 'lucide-react';

type Filter = 'day' | 'week' | 'month' | 'alltime';

interface Summary {
  total_turns: number;
  total_input: number;
  total_output: number;
  total_cost: number;
  active_devices: number;
  total_sessions: number;
}

interface ModelRow {
  model: string;
  turns: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

interface DeviceRow {
  id: string;
  name: string;
  hostname: string;
  platform: string;
  last_seen: string;
  total_turns: number;
  total_cost: number;
}

interface TrendPoint {
  day: string;
  input_tokens: number;
  output_tokens: number;
}

interface UsageData {
  summary: Summary;
  byModel: ModelRow[];
  byDevice: DeviceRow[];
  trend: TrendPoint[];
}

const MODEL_COLORS: Record<string, string> = {
  opus:   '#a78bfa',
  sonnet: '#60a5fa',
  haiku:  '#4ade80',
};

function modelColor(model: string): string {
  const lower = model.toLowerCase();
  const key = Object.keys(MODEL_COLORS).find(k => lower.includes(k));
  return key ? MODEL_COLORS[key] : '#fb923c';
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtCost(n: number): string {
  return `$${n.toFixed(4)}`;
}

function isOnline(lastSeen: string): boolean {
  return Date.now() - new Date(lastSeen).getTime() < 10 * 60 * 1000;
}

const FILTERS: { label: string; value: Filter }[] = [
  { label: '24h',     value: 'day' },
  { label: '7d',      value: 'week' },
  { label: '30d',     value: 'month' },
  { label: 'All time', value: 'alltime' },
];

export default function Dashboard() {
  const [filter, setFilter]     = useState<Filter>('week');
  const [device, setDevice]     = useState<string | null>(null);
  const [data, setData]         = useState<UsageData | null>(null);
  const [devices, setDevices]   = useState<DeviceRow[]>([]);
  const [clock, setClock]       = useState('');
  const [loading, setLoading]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ filter });
      if (device) params.set('device', device);
      const [usage, devs] = await Promise.all([
        fetch(`/api/usage?${params}`).then(r => r.json()),
        fetch('/api/devices').then(r => r.json()),
      ]);
      setData(usage);
      setDevices(devs);
    } finally {
      setLoading(false);
    }
  }, [filter, device]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const sum = data?.summary;
  const maxCost = Math.max(...(data?.byModel.map(m => m.cost_usd) ?? [1]), 0.00001);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#e0e0f0' }}>Claude Tracker</h1>
          <p style={{ color: 'var(--dim)', marginTop: 2 }}>Token usage across all devices</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: 'var(--dim)', fontVariantNumeric: 'tabular-nums' }}>{clock}</span>
          <button
            onClick={load}
            style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 6, padding: '6px 12px', color: 'var(--text)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            style={{
              padding: '6px 14px', borderRadius: 6, border: 'none',
              background: filter === f.value ? 'var(--accent)' : 'var(--surface)',
              color: filter === f.value ? '#fff' : 'var(--dim)',
              fontWeight: filter === f.value ? 600 : 400,
              transition: 'all 0.15s',
            }}
          >
            {f.label}
          </button>
        ))}
        {device && (
          <button
            onClick={() => setDevice(null)}
            style={{
              marginLeft: 8, padding: '6px 14px', borderRadius: 6,
              border: '1px solid var(--red)', background: 'transparent',
              color: 'var(--red)',
            }}
          >
            Clear device filter
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { icon: DollarSign, label: 'Total Cost',     value: fmtCost(sum?.total_cost ?? 0),     color: '#facc15' },
          { icon: Hash,       label: 'Turns',          value: fmt(sum?.total_turns ?? 0),         color: '#a78bfa' },
          { icon: Layers,     label: 'Input Tokens',   value: fmt(sum?.total_input ?? 0),         color: '#60a5fa' },
          { icon: Layers,     label: 'Output Tokens',  value: fmt(sum?.total_output ?? 0),        color: '#4ade80' },
          { icon: Monitor,    label: 'Devices',        value: String(sum?.active_devices ?? 0),   color: '#fb923c' },
          { icon: Clock,      label: 'Sessions',       value: fmt(sum?.total_sessions ?? 0),      color: '#f472b6' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '16px 18px',
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <Icon size={18} color={color} />
            <div>
              <div style={{ color: 'var(--dim)', fontSize: 11, marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Area chart */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 10, padding: '18px 16px', marginBottom: 24,
      }}>
        <div style={{ color: 'var(--dim)', marginBottom: 12, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>
          30-day token trend
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data?.trend ?? []} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gi" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="go" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4ade80" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="day" tick={{ fill: '#7a7a9a', fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tickFormatter={fmt} tick={{ fill: '#7a7a9a', fontSize: 11 }} tickLine={false} axisLine={false} width={48} />
            <Tooltip
              contentStyle={{ background: '#1a1a2e', border: '1px solid #2e2e4e', borderRadius: 8 }}
              labelStyle={{ color: '#7a7a9a' }}
              formatter={(v: number, name: string) => [fmt(v), name === 'input_tokens' ? 'Input' : 'Output']}
            />
            <Legend formatter={(v) => v === 'input_tokens' ? 'Input' : 'Output'} wrapperStyle={{ fontSize: 12, color: '#7a7a9a' }} />
            <Area type="monotone" dataKey="input_tokens"  stroke="#60a5fa" fill="url(#gi)" strokeWidth={1.5} dot={false} />
            <Area type="monotone" dataKey="output_tokens" stroke="#4ade80" fill="url(#go)" strokeWidth={1.5} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>

        {/* Model breakdown */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 10, padding: '18px 16px',
        }}>
          <div style={{ color: 'var(--dim)', marginBottom: 14, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>
            Model breakdown
          </div>
          {(data?.byModel ?? []).map(m => (
            <div key={m.model} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: modelColor(m.model) }}>{m.model}</span>
                <span style={{ color: 'var(--dim)' }}>{fmtCost(m.cost_usd)}</span>
              </div>
              <div style={{ height: 4, background: 'var(--border)', borderRadius: 2 }}>
                <div style={{
                  height: '100%', borderRadius: 2,
                  width: `${(m.cost_usd / maxCost) * 100}%`,
                  background: modelColor(m.model),
                  transition: 'width 0.4s ease',
                }} />
              </div>
              <div style={{ color: 'var(--dim)', fontSize: 11, marginTop: 3 }}>
                {fmt(m.input_tokens)} in · {fmt(m.output_tokens)} out · {m.turns} turns
              </div>
            </div>
          ))}
          {!data?.byModel.length && (
            <div style={{ color: 'var(--dim)', fontSize: 12 }}>No data for this period.</div>
          )}
        </div>

        {/* Device breakdown */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 10, padding: '18px 16px',
        }}>
          <div style={{ color: 'var(--dim)', marginBottom: 14, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>
            By device
          </div>
          {(data?.byDevice ?? []).map(d => (
            <div
              key={d.id}
              onClick={() => setDevice(device === d.id ? null : d.id)}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 10px', marginBottom: 6, borderRadius: 6,
                border: `1px solid ${device === d.id ? 'var(--accent)' : 'var(--border)'}`,
                cursor: 'pointer', transition: 'border-color 0.15s',
              }}
            >
              <span style={{ color: 'var(--text)' }}>{d.name}</span>
              <div style={{ display: 'flex', gap: 12, color: 'var(--dim)', fontSize: 12 }}>
                <span>{fmt(d.input_tokens)} in</span>
                <span>{fmtCost(d.cost_usd)}</span>
              </div>
            </div>
          ))}
          {!data?.byDevice.length && (
            <div style={{ color: 'var(--dim)', fontSize: 12 }}>No data for this period.</div>
          )}
        </div>
      </div>

      {/* Device cards */}
      <div style={{
        color: 'var(--dim)', marginBottom: 12, fontSize: 11,
        textTransform: 'uppercase', letterSpacing: 1,
      }}>
        Registered devices
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {devices.map(d => (
          <div key={d.id} style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '14px 16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: isOnline(d.last_seen) ? 'var(--green)' : 'var(--muted)',
                flexShrink: 0,
              }} />
              <span style={{ fontWeight: 600 }}>{d.name}</span>
            </div>
            <div style={{ color: 'var(--dim)', fontSize: 11, lineHeight: 1.8 }}>
              <div><Cpu size={10} style={{ marginRight: 4, verticalAlign: 'middle' }} />{d.hostname} · {d.platform}</div>
              <div>Last seen: {new Date(d.last_seen).toLocaleString()}</div>
              <div style={{ marginTop: 6, display: 'flex', gap: 16 }}>
                <span>{fmt(d.total_turns)} turns</span>
                <span>{fmtCost(d.total_cost)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
