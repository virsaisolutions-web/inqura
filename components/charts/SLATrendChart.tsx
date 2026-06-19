'use client'

import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, CartesianGrid, Dot,
} from 'recharts'

interface Props {
  data: { date: string; label: string; compliance: number }[]
  target?: number
  height?: number
}

export function SLATrendChart({ data, target = 95, height = 200 }: Props) {
  if (!data.length) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ height, color: 'var(--text-4)', fontSize: '12px' }}
      >
        No compliance data available
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
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
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: 'var(--text-4)', fontFamily: 'JetBrains Mono, monospace' }}
          axisLine={false}
          tickLine={false}
          width={36}
          tickFormatter={v => `${v}%`}
        />
        <ReferenceLine
          y={target}
          stroke="var(--accent)"
          strokeDasharray="4 3"
          strokeWidth={1}
          strokeOpacity={0.6}
          label={{ value: `${target}%`, position: 'right', fontSize: 10, fill: 'var(--accent)' }}
        />
        <Tooltip
          contentStyle={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '8px 12px',
            fontSize: '12px',
            boxShadow: 'none',
          }}
          labelStyle={{ fontWeight: 600, marginBottom: 2, color: 'var(--text-1)' }}
          itemStyle={{ color: 'var(--text-3)', fontFamily: 'JetBrains Mono, monospace' }}
          formatter={(v) => [`${v as number}%`, 'SLA Compliance']}
        />
        <Line
          type="monotone"
          dataKey="compliance"
          stroke="var(--accent)"
          strokeWidth={2}
          dot={(props) => {
            const { cx, cy, payload } = props
            const below = (payload as { compliance: number }).compliance < target
            const color = below ? 'var(--danger-text)' : 'var(--success-text)'
            return <Dot key={(payload as { date: string }).date} cx={cx} cy={cy} r={3} fill={color} stroke={color} />
          }}
          activeDot={{ r: 5, fill: 'var(--accent)', stroke: 'var(--surface)', strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
