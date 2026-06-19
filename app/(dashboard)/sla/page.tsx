import { createClient } from '@/lib/supabase/server'
import { computeSLACompliance, getSLARiskLevel, getHoursRemaining } from '@/lib/metrics/sla'
import { SLACountdown } from '@/components/sla/SLACountdown'
import { SLATrendChart } from '@/components/charts/SLATrendChart'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import type { Case } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function SLAPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const { period = 'month' } = await searchParams
  const supabase = await createClient()

  const now = new Date()
  const periodStart = getPeriodStart(period, now)
  const periodLabel = { week: 'This Week', month: 'This Month', quarter: 'This Quarter' }[period] ?? 'This Month'

  const { data: periodCases } = await supabase
    .from('cases')
    .select('*')
    .gte('submitted_at', periodStart.toISOString())
    .order('submitted_at', { ascending: false })

  const cases = (periodCases ?? []) as Case[]
  const fulfilled = cases.filter(c => c.fulfilled_at !== null)
  const overallCompliance = computeSLACompliance(fulfilled)
  const avgResponseH = fulfilled.length > 0
    ? Math.round(fulfilled.reduce((sum, c) => {
        return sum + (new Date(c.fulfilled_at!).getTime() - new Date(c.submitted_at).getTime()) / 3_600_000
      }, 0) / fulfilled.length * 10) / 10
    : null

  const { data: openCasesRaw } = await supabase
    .from('cases')
    .select('*')
    .in('status', ['open', 'in_review'])
    .not('sla_deadline', 'is', null)

  const openCases = (openCasesRaw ?? []) as Case[]
  const atRiskCases = openCases
    .filter(c => getSLARiskLevel(new Date(c.sla_deadline!), now) !== 'safe')
    .sort((a, b) => getHoursRemaining(new Date(a.sla_deadline!), now) - getHoursRemaining(new Date(b.sla_deadline!), now))

  const breachedCases = fulfilled.filter(c =>
    c.sla_deadline && new Date(c.fulfilled_at!) > new Date(c.sla_deadline)
  )

  const products = [...new Set(cases.map(c => c.product).filter(Boolean))] as string[]
  const productStats = products.map(product => {
    const pc = cases.filter(c => c.product === product)
    const pf = pc.filter(c => c.fulfilled_at !== null)
    const compliance = computeSLACompliance(pf)
    const breaches = pf.filter(c => c.sla_deadline && new Date(c.fulfilled_at!) > new Date(c.sla_deadline)).length
    const avgH = pf.length > 0
      ? Math.round(pf.reduce((sum, c) => sum + (new Date(c.fulfilled_at!).getTime() - new Date(c.submitted_at).getTime()) / 3_600_000, 0) / pf.length * 10) / 10
      : null
    return { product, total: pc.length, fulfilled: pf.length, compliance, breaches, avgH }
  }).sort((a, b) => b.total - a.total)

  const { data: dailyMetrics } = await supabase
    .from('metrics_daily')
    .select('metric_date, sla_met, sla_breached')
    .is('product', null)
    .gte('metric_date', new Date(now.getTime() - 30 * 86_400_000).toISOString().split('T')[0])
    .order('metric_date', { ascending: true })

  const trendData = (dailyMetrics ?? []).map(m => {
    const total = (m.sla_met ?? 0) + (m.sla_breached ?? 0)
    const compliance = total > 0 ? Math.round(m.sla_met / total * 1000) / 10 : 100
    const d = new Date(m.metric_date)
    return { date: m.metric_date, label: `${d.getMonth() + 1}/${d.getDate()}`, compliance }
  })

  const complianceColor = overallCompliance >= 95 ? 'var(--success-text)'
    : overallCompliance >= 85 ? 'var(--warning-text)'
    : 'var(--danger-text)'

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[14px] font-semibold" style={{ color: 'var(--text-1)' }}>SLA Monitor</h2>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-4)' }}>
            {periodLabel} · 48-hour response commitment
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Period selector */}
          <div
            className="flex rounded-[8px] overflow-hidden"
            style={{ border: '1px solid var(--border)' }}
          >
            {[['week', 'Week'], ['month', 'Month'], ['quarter', 'Quarter']].map(([val, label]) => (
              <Link
                key={val}
                href={`/dashboard/sla?period=${val}`}
                className="px-3 py-1.5 text-[12px] font-medium transition-colors"
                style={{
                  background: period === val ? 'var(--accent)' : 'transparent',
                  color: period === val ? '#fff' : 'var(--text-3)',
                }}
              >
                {label}
              </Link>
            ))}
          </div>
          <Link href="/api/reports/compliance-pdf" target="_blank">
            <Button variant="outline" size="sm">Export PDF</Button>
          </Link>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Overall SLA Compliance" value={`${overallCompliance}%`}
          sub={overallCompliance >= 95 ? '✓ Above target (95%)' : `${(95 - overallCompliance).toFixed(1)}% below target`}
          valueColor={complianceColor} />
        <KpiCard label="Average Response Time" value={avgResponseH !== null ? `${avgResponseH}h` : '—'}
          sub="Fulfilled cases" valueColor="var(--warning-text)" />
        <KpiCard label="Cases in Period" value={cases.length}
          sub={`${fulfilled.length} fulfilled · ${cases.length - fulfilled.length} open`} />
      </div>

      <div className="grid grid-cols-5 gap-4">
        {/* By-product table */}
        <Card className="col-span-3">
          <CardHeader className="pb-3">
            <CardTitle>SLA by product</CardTitle>
            <CardDescription>{periodLabel}</CardDescription>
          </CardHeader>
          <CardContent>
            {productStats.length === 0 ? (
              <p className="text-[12px] py-4" style={{ color: 'var(--text-4)' }}>No product data for this period</p>
            ) : (
              <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Product', 'Cases', 'SLA %', 'Avg Resp', 'Breaches'].map(h => (
                      <th key={h} className="text-left pb-2.5 pr-3 last:pr-0 label-caps">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {productStats.map(({ product, total, compliance, avgH, breaches }) => {
                    const slColor = compliance >= 95 ? 'var(--success-text)' : compliance >= 85 ? 'var(--warning-text)' : 'var(--danger-text)'
                    const barColor = compliance >= 95 ? 'var(--success-text)' : compliance >= 85 ? 'var(--warning-text)' : 'var(--danger-text)'
                    return (
                      <tr key={product} style={{ borderBottom: '1px solid var(--border-2)' }}>
                        <td className="py-2.5 pr-3 text-[12px] font-medium" style={{ color: 'var(--text-2)' }}>{product}</td>
                        <td className="py-2.5 pr-3 text-[12px] tabular-nums" style={{ color: 'var(--text-3)', fontFamily: 'JetBrains Mono, monospace' }}>{total}</td>
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-semibold tabular-nums" style={{ color: slColor, fontFamily: 'JetBrains Mono, monospace' }}>{compliance}%</span>
                            <div className="w-14 h-1 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                              <div className="h-full rounded-full" style={{ width: `${compliance}%`, background: barColor }} />
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 pr-3 text-[12px] tabular-nums" style={{ color: 'var(--text-3)', fontFamily: 'JetBrains Mono, monospace' }}>
                          {avgH !== null ? `${avgH}h` : '—'}
                        </td>
                        <td className="py-2.5 text-[12px] font-semibold tabular-nums" style={{ color: breaches > 0 ? 'var(--danger-text)' : 'var(--text-4)', fontFamily: 'JetBrains Mono, monospace' }}>
                          {breaches > 0 ? breaches : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* 30-day trend */}
        <Card className="col-span-2">
          <CardHeader className="pb-2">
            <CardTitle>30-day trend</CardTitle>
            <CardDescription>Daily SLA compliance · dashed = 95% target</CardDescription>
          </CardHeader>
          <CardContent>
            <SLATrendChart data={trendData} target={95} />
          </CardContent>
        </Card>
      </div>

      {/* Risk Queue */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Cases requiring immediate attention</CardTitle>
              <CardDescription>Sorted by urgency — most critical first</CardDescription>
            </div>
            {atRiskCases.length > 0 && (
              <Badge variant="destructive">{atRiskCases.length} at risk</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {atRiskCases.length === 0 ? (
            <div
              className="flex items-center justify-center h-20 gap-2 text-[13px] font-medium"
              style={{ color: 'var(--success-text)' }}
            >
              <span>✓</span>
              <span>All cases within SLA. Good work.</span>
            </div>
          ) : (
            <div className="space-y-2">
              {atRiskCases.map(c => <RiskRow key={c.id} caseRow={c} />)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Breach log */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>SLA breach log</CardTitle>
          <CardDescription>Cases that missed SLA in {periodLabel.toLowerCase()}</CardDescription>
        </CardHeader>
        <CardContent>
          {breachedCases.length === 0 ? (
            <div
              className="flex items-center justify-center h-16 gap-2 text-[13px] font-medium"
              style={{ color: 'var(--success-text)' }}
            >
              <span>✓</span>
              <span>No breaches this period.</span>
            </div>
          ) : (
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Case ID', 'Product', 'Topic', 'Submitted', 'Deadline', 'Fulfilled', 'Over SLA'].map(h => (
                    <th key={h} className="text-left pb-2.5 pr-3 label-caps">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {breachedCases.map(c => {
                  const hoursOver = c.sla_deadline && c.fulfilled_at
                    ? Math.round((new Date(c.fulfilled_at).getTime() - new Date(c.sla_deadline).getTime()) / 3_600_000 * 10) / 10
                    : null
                  return (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--border-2)' }}>
                      <td className="py-2 pr-3 text-[11px] tabular-nums" style={{ color: 'var(--accent)', fontFamily: 'JetBrains Mono, monospace' }}>{c.vault_case_id}</td>
                      <td className="py-2 pr-3 text-[12px]" style={{ color: 'var(--text-2)' }}>{c.product ?? '—'}</td>
                      <td className="py-2 pr-3 text-[12px] max-w-[140px] truncate" style={{ color: 'var(--text-3)' }}>{c.topic_category ?? '—'}</td>
                      <td className="py-2 pr-3 text-[11px] tabular-nums" style={{ color: 'var(--text-4)', fontFamily: 'JetBrains Mono, monospace' }}>{new Date(c.submitted_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</td>
                      <td className="py-2 pr-3 text-[11px] tabular-nums" style={{ color: 'var(--text-4)', fontFamily: 'JetBrains Mono, monospace' }}>{c.sla_deadline ? new Date(c.sla_deadline).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'}</td>
                      <td className="py-2 pr-3 text-[11px] tabular-nums" style={{ color: 'var(--text-4)', fontFamily: 'JetBrains Mono, monospace' }}>{c.fulfilled_at ? new Date(c.fulfilled_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'}</td>
                      <td className="py-2 text-[12px] font-semibold tabular-nums" style={{ color: 'var(--danger-text)', fontFamily: 'JetBrains Mono, monospace' }}>
                        {hoursOver !== null ? `+${hoursOver}h` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function KpiCard({ label, value, sub, valueColor }: {
  label: string; value: string | number; sub?: string; valueColor?: string
}) {
  return (
    <div
      className="rounded-[12px] p-5"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <p className="label-caps mb-3">{label}</p>
      <p className="metric-num" style={{ color: valueColor ?? 'var(--text-1)' }}>{value}</p>
      {sub && <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-4)' }}>{sub}</p>}
    </div>
  )
}

function RiskRow({ caseRow }: { caseRow: Case }) {
  const risk = getSLARiskLevel(new Date(caseRow.sla_deadline!))
  const rowStyle = {
    breached: { background: 'var(--danger-bg)',  border: '1px solid var(--danger-border)'  },
    critical: { background: 'var(--danger-bg)',  border: '1px solid var(--danger-border)'  },
    warning:  { background: 'var(--warning-bg)', border: '1px solid var(--warning-border)' },
    safe:     { background: 'var(--surface)',    border: '1px solid var(--border)'          },
  }[risk]

  return (
    <div className="flex items-center gap-4 p-3 rounded-[10px]" style={rowStyle}>
      <SLACountdown
        deadline={caseRow.sla_deadline!}
        showRing
        slaHoursTarget={caseRow.sla_hours_target}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span
            className="text-[11px] font-semibold tabular-nums"
            style={{ color: 'var(--text-1)', fontFamily: 'JetBrains Mono, monospace' }}
          >
            {caseRow.vault_case_id}
          </span>
          {caseRow.product && (
            <Badge variant="secondary">{caseRow.product}</Badge>
          )}
        </div>
        <p className="text-[12px] truncate" style={{ color: 'var(--text-3)' }}>{caseRow.topic_category ?? 'No topic'}</p>
      </div>
      <Badge variant={risk === 'breached' || risk === 'critical' ? 'destructive' : 'warning'}>
        {caseRow.status?.replace('_', ' ')}
      </Badge>
      <form action="/api/cases/escalate" method="POST">
        <input type="hidden" name="caseId" value={caseRow.id} />
        <button
          type="submit"
          className="flex-shrink-0 px-3 py-1.5 text-[12px] font-medium rounded-[6px] transition-colors"
          style={{
            background: 'var(--danger-bg)',
            border: '1px solid var(--danger-border)',
            color: 'var(--danger-text)',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger-text)'; e.currentTarget.style.color = '#fff' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--danger-bg)'; e.currentTarget.style.color = 'var(--danger-text)' }}
        >
          Escalate
        </button>
      </form>
    </div>
  )
}

function getPeriodStart(period: string, now: Date): Date {
  const d = new Date(now)
  switch (period) {
    case 'week':   d.setDate(d.getDate() - 7); return d
    case 'quarter': d.setMonth(d.getMonth() - 3); return d
    default:       d.setMonth(d.getMonth() - 1); return d
  }
}
