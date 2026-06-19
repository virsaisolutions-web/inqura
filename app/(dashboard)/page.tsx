import { createClient } from '@/lib/supabase/server'
import { Suspense } from 'react'
import { getKPIs } from '@/lib/metrics/metrics'
import { getMonthlyVolume, getTopicBreakdown, getVolumeByChannel, getVolumeByProduct } from '@/lib/metrics/trends'
import { VolumeBarChart } from '@/components/charts/VolumeBarChart'
import { CasesTable } from '@/components/cases/CasesTable'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Case } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const CHANNEL_COLORS: Record<string, string> = {
  email: 'var(--cat-1)',
  crm:   'var(--cat-2)',
  phone: 'var(--cat-3)',
  web:   'var(--cat-4)',
}
const PRODUCT_DOT_COLORS = [
  'var(--cat-1)', 'var(--cat-2)', 'var(--cat-3)', 'var(--cat-4)', 'var(--cat-5)',
  'var(--cat-1)', 'var(--cat-2)', 'var(--cat-3)',
]

export default async function DashboardPage() {
  const supabase = await createClient()

  const [kpis, { data: allCases }, { data: recentCases }] = await Promise.all([
    getKPIs(),
    supabase.from('cases').select('*').order('submitted_at', { ascending: false }).limit(2000),
    supabase.from('cases').select('*').order('submitted_at', { ascending: false }).limit(20),
  ])

  const cases = (allCases ?? []) as Case[]
  const recent = (recentCases ?? []) as Case[]

  const monthlyVolume = getMonthlyVolume(cases, 12)
  const topicBreakdown = getTopicBreakdown(cases).slice(0, 7)
  const channelBreakdown = getVolumeByChannel(cases)
  const productBreakdown = getVolumeByProduct(cases)

  const lastSyncText = kpis.lastSyncAt
    ? `Synced ${formatRelative(new Date(kpis.lastSyncAt))}`
    : 'Never synced'

  return (
    <div className="space-y-5">
      {/* ── KPI strip ── */}
      <div className="grid grid-cols-6 gap-3">
        <KpiCard label="Open Cases"     value={kpis.openCases}             sub={lastSyncText} />
        <KpiCard label="SLA at Risk"    value={kpis.slaAtRisk}             sub={kpis.slaAtRisk > 0 ? 'Needs attention' : 'All on track'}
          danger={kpis.slaAtRisk > 0} />
        <KpiCard label="SLA Compliance" value={`${kpis.slaCompliance}%`}   sub="Year to date"
          ring={kpis.slaCompliance}
          accent={kpis.slaCompliance >= 95}
          warn={kpis.slaCompliance >= 85 && kpis.slaCompliance < 95}
          danger={kpis.slaCompliance < 85} />
        <KpiCard label="Avg Response"   value={kpis.avgResponseHours !== null ? `${kpis.avgResponseHours}h` : '—'}
          sub="Year to date" warn />
        <KpiCard label="Total YTD"      value={kpis.totalYTD}              sub="Inquiries received" />
        <KpiCard label="Fulfilled YTD"  value={kpis.fulfilledYTD}          sub={kpis.totalYTD > 0 ? `${Math.round(kpis.fulfilledYTD / kpis.totalYTD * 100)}% of total` : ''}
          accent />
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-5 gap-4">
        {/* Left 60% */}
        <div className="col-span-3 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Monthly inquiry volume</CardTitle>
              <CardDescription>Last 12 months</CardDescription>
            </CardHeader>
            <CardContent>
              <VolumeBarChart
                data={monthlyVolume.map(m => ({ label: m.label, count: m.count }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Topic breakdown</CardTitle>
              <CardDescription>Top {topicBreakdown.length} inquiry topics</CardDescription>
            </CardHeader>
            <CardContent>
              {topicBreakdown.length === 0 ? (
                <EmptyState>No topic data yet</EmptyState>
              ) : (
                <div className="space-y-2.5">
                  {topicBreakdown.map(({ label, count, pct }) => (
                    <div key={label} className="flex items-center gap-3">
                      <span
                        className="text-[12px] truncate w-[130px] flex-shrink-0"
                        style={{ color: 'var(--text-3)' }}
                      >
                        {label}
                      </span>
                      <div
                        className="flex-1 h-[4px] rounded-full overflow-hidden"
                        style={{ background: 'var(--surface-2)' }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, background: 'var(--accent)' }}
                        />
                      </div>
                      <span
                        className="text-[12px] w-8 text-right tabular-nums flex-shrink-0"
                        style={{ color: 'var(--text-4)', fontFamily: 'JetBrains Mono, monospace' }}
                      >
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right 40% */}
        <div className="col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Channel breakdown</CardTitle>
              <CardDescription>Inquiry origin</CardDescription>
            </CardHeader>
            <CardContent>
              {channelBreakdown.length === 0 ? (
                <EmptyState>No data yet</EmptyState>
              ) : (
                <div className="space-y-3">
                  {channelBreakdown.map(({ label, count, pct }) => (
                    <div key={label} className="flex items-center gap-2.5">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: CHANNEL_COLORS[label] ?? 'var(--cat-5)' }}
                      />
                      <span className="flex-1 text-[12px] capitalize" style={{ color: 'var(--text-2)' }}>
                        {label}
                      </span>
                      <span className="text-[11px]" style={{ color: 'var(--text-4)' }}>{pct}%</span>
                      <span
                        className="text-[12px] w-8 text-right tabular-nums"
                        style={{ color: 'var(--text-1)', fontFamily: 'JetBrains Mono, monospace', fontWeight: 500 }}
                      >
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Product split</CardTitle>
              <CardDescription>By inquiry volume</CardDescription>
            </CardHeader>
            <CardContent>
              {productBreakdown.length === 0 ? (
                <EmptyState>No data yet</EmptyState>
              ) : (
                <div className="space-y-3">
                  {productBreakdown.slice(0, 8).map(({ label, count, pct }, i) => (
                    <div key={label} className="flex items-center gap-2.5">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: PRODUCT_DOT_COLORS[i % PRODUCT_DOT_COLORS.length] }}
                      />
                      <span className="flex-1 text-[12px] truncate" style={{ color: 'var(--text-2)' }}>
                        {label}
                      </span>
                      <span className="text-[11px] flex-shrink-0" style={{ color: 'var(--text-4)' }}>{pct}%</span>
                      <span
                        className="text-[12px] w-8 text-right tabular-nums flex-shrink-0"
                        style={{ color: 'var(--text-1)', fontFamily: 'JetBrains Mono, monospace', fontWeight: 500 }}
                      >
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Recent cases ── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent cases</CardTitle>
              <CardDescription>Last 20 inquiries · click a row to view details</CardDescription>
            </div>
            <Badge variant="secondary">{recent.length} shown</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="h-32 animate-pulse rounded-lg" style={{ background: 'var(--surface-2)' }} />}>
            <CasesTable cases={recent} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}

/* ── KPI Card ── */
function KpiCard({
  label, value, sub, ring, accent, warn, danger,
}: {
  label: string
  value: string | number
  sub?: string
  ring?: number
  accent?: boolean
  warn?: boolean
  danger?: boolean
}) {
  const valueColor = danger ? 'var(--danger-text)'
    : warn ? 'var(--warning-text)'
    : accent ? 'var(--accent)'
    : 'var(--text-1)'

  const ringColor = danger ? 'var(--danger-text)'
    : warn ? 'var(--warning-text)'
    : 'var(--accent)'

  return (
    <div
      className="rounded-[12px] p-4"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <p className="label-caps mb-3">{label}</p>
      <div className="flex items-center gap-2">
        <p className="metric-num" style={{ color: valueColor }}>{value}</p>
        {ring !== undefined && (
          <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
            <circle cx="14" cy="14" r="10" fill="none" stroke="var(--border)" strokeWidth="2.5" />
            <circle
              cx="14" cy="14" r="10"
              fill="none"
              stroke={ringColor}
              strokeWidth="2.5"
              strokeDasharray={`${2 * Math.PI * 10}`}
              strokeDashoffset={`${2 * Math.PI * 10 * (1 - ring / 100)}`}
              strokeLinecap="round"
              transform="rotate(-90 14 14)"
            />
          </svg>
        )}
      </div>
      {sub && <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-4)' }}>{sub}</p>}
    </div>
  )
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center h-24 text-[12px]" style={{ color: 'var(--text-4)' }}>
      {children}
    </div>
  )
}

function formatRelative(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 60_000)
  if (diff < 1) return 'just now'
  if (diff < 60) return `${diff}m ago`
  const h = Math.floor(diff / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
