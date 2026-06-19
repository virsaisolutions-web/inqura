'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts'

interface Props {
  data: { label: string; count: number }[]
  height?: number
}

export function VolumeBarChart({ data, height = 200 }: Props) {
  if (!data.length) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ height, color: 'var(--text-4)', fontSize: '12px' }}
      >
        No data available yet
      </div>
    )
  }

  const lastIdx = data.length - 1

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} barSize={28} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
        <CartesianGrid
          vertical={false}
          stroke="var(--border)"
          strokeDasharray="0"
          strokeOpacity={0.8}
        />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: 'var(--text-4)', fontFamily: 'inherit' }}
          axisLine={false}
          tickLine={false}
          dy={6}
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'var(--text-4)', fontFamily: 'JetBrains Mono, monospace' }}
          axisLine={false}
          tickLine={false}
          width={32}
          allowDecimals={false}
        />
        <Tooltip
          cursor={{ fill: 'var(--surface-2)', radius: 4 } as Record<string, unknown>}
          contentStyle={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '8px 12px',
            fontSize: '12px',
            color: 'var(--text-2)',
            boxShadow: 'none',
          }}
          labelStyle={{ fontWeight: 600, marginBottom: 2, color: 'var(--text-1)' }}
          itemStyle={{ color: 'var(--text-3)', fontFamily: 'JetBrains Mono, monospace' }}
          separator=": "
          formatter={(value) => [value as number, 'Inquiries']}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell
              key={i}
              fill={i === lastIdx ? 'var(--bar-accent)' : 'var(--bar-neutral)'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
