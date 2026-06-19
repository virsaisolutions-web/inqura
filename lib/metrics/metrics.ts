import { createServiceClient } from '@/lib/supabase/server'
import { computeSLACompliance, getSLARiskLevel } from './sla'
import type { Case } from '@/lib/supabase/types'

export interface KPIs {
  openCases: number
  slaAtRisk: number
  slaCompliance: number
  avgResponseHours: number | null
  totalYTD: number
  fulfilledYTD: number
  lastSyncAt: string | null
}

/**
 * Computes the main dashboard KPIs from the cases table.
 * Called by /api/metrics/kpis.
 */
export async function getKPIs(tenantId?: string | null): Promise<KPIs> {
  const supabase = await createServiceClient()
  const now = new Date()
  const yearStart = new Date(now.getFullYear(), 0, 1).toISOString()

  // Open cases
  let openQuery = supabase
    .from('cases')
    .select('id, sla_deadline', { count: 'exact' })
    .in('status', ['open', 'in_review'])

  if (tenantId) openQuery = openQuery.eq('tenant_id', tenantId)
  const { data: openCases, count: openCount } = await openQuery

  // SLA at-risk count
  const slaAtRisk = (openCases ?? []).filter(c => {
    if (!c.sla_deadline) return false
    const risk = getSLARiskLevel(new Date(c.sla_deadline), now)
    return risk === 'critical' || risk === 'warning' || risk === 'breached'
  }).length

  // YTD cases
  let ytdQuery = supabase
    .from('cases')
    .select('fulfilled_at, sla_deadline', { count: 'exact' })
    .gte('submitted_at', yearStart)

  if (tenantId) ytdQuery = ytdQuery.eq('tenant_id', tenantId)
  const { data: ytdCases, count: totalYTD } = await ytdQuery

  const fulfilledYTD = (ytdCases ?? []).filter(c => c.fulfilled_at !== null).length

  // SLA compliance from YTD fulfilled cases
  const slaCompliance = computeSLACompliance(
    (ytdCases ?? []).filter(c => c.fulfilled_at !== null) as Pick<Case, 'fulfilled_at' | 'sla_deadline'>[]
  )

  // Avg response time (hours) for fulfilled YTD cases
  // We query the cases table and compute in JS to avoid needing DB functions
  let avgQuery = supabase
    .from('cases')
    .select('submitted_at, fulfilled_at')
    .not('fulfilled_at', 'is', null)
    .gte('submitted_at', yearStart)

  if (tenantId) avgQuery = avgQuery.eq('tenant_id', tenantId)
  const { data: fulfilledCases } = await avgQuery

  let avgResponseHours: number | null = null
  if (fulfilledCases && fulfilledCases.length > 0) {
    const totalHours = fulfilledCases.reduce((sum, c) => {
      const submitted = new Date(c.submitted_at).getTime()
      const fulfilled = new Date(c.fulfilled_at!).getTime()
      return sum + (fulfilled - submitted) / (1000 * 60 * 60)
    }, 0)
    avgResponseHours = Math.round(totalHours / fulfilledCases.length * 10) / 10
  }

  // Last sync time
  const { data: lastSync } = await supabase
    .from('sync_log')
    .select('completed_at')
    .eq('status', 'success')
    .order('completed_at', { ascending: false })
    .limit(1)
    .single()

  return {
    openCases: openCount ?? 0,
    slaAtRisk,
    slaCompliance,
    avgResponseHours,
    totalYTD: totalYTD ?? 0,
    fulfilledYTD,
    lastSyncAt: lastSync?.completed_at ?? null,
  }
}

/**
 * Refreshes the metrics_daily row for a given date.
 * Called after each sync and by the nightly cron.
 */
export async function refreshMetricsDaily(
  tenantId: string | null,
  date: Date
): Promise<void> {
  const supabase = await createServiceClient()
  const dateStr = date.toISOString().split('T')[0]
  const dayStart = `${dateStr}T00:00:00Z`
  const dayEnd = `${dateStr}T23:59:59Z`

  let query = supabase
    .from('cases')
    .select('product, fulfilled_at, sla_deadline, submitted_at, topic_category, channel')
    .gte('submitted_at', dayStart)
    .lte('submitted_at', dayEnd)

  if (tenantId) query = query.eq('tenant_id', tenantId)
  const { data: dayCases } = await query
  if (!dayCases) return

  const fulfilled = dayCases.filter(c => c.fulfilled_at !== null)
  const slaMet = fulfilled.filter(c => c.fulfilled_at! <= c.sla_deadline!).length
  const slaBreached = fulfilled.length - slaMet

  // Compute avg response hours
  let avgH: number | null = null
  if (fulfilled.length > 0) {
    const total = fulfilled.reduce((sum, c) => {
      return sum + (new Date(c.fulfilled_at!).getTime() - new Date(c.submitted_at).getTime()) / (1000 * 60 * 60)
    }, 0)
    avgH = Math.round(total / fulfilled.length * 100) / 100
  }

  // Topic and channel breakdowns
  const topicBreakdown: Record<string, number> = {}
  const channelBreakdown: Record<string, number> = {}
  for (const c of dayCases) {
    if (c.topic_category) topicBreakdown[c.topic_category] = (topicBreakdown[c.topic_category] ?? 0) + 1
    if (c.channel) channelBreakdown[c.channel] = (channelBreakdown[c.channel] ?? 0) + 1
  }

  // Upsert aggregate row (product = null = all-products)
  await supabase.from('metrics_daily').upsert({
    tenant_id: tenantId,
    metric_date: dateStr,
    product: null,
    total_cases: dayCases.length,
    fulfilled_cases: fulfilled.length,
    sla_met: slaMet,
    sla_breached: slaBreached,
    avg_response_h: avgH,
    topic_breakdown: topicBreakdown,
    channel_breakdown: channelBreakdown,
  }, { onConflict: 'tenant_id,metric_date,product' })

  // Per-product rows
  const products = [...new Set(dayCases.map(c => c.product).filter(Boolean))] as string[]
  for (const product of products) {
    const productCases = dayCases.filter(c => c.product === product)
    const productFulfilled = productCases.filter(c => c.fulfilled_at !== null)
    const productSlaMet = productFulfilled.filter(c => c.fulfilled_at! <= c.sla_deadline!).length

    let productAvgH: number | null = null
    if (productFulfilled.length > 0) {
      const total = productFulfilled.reduce((sum, c) => {
        return sum + (new Date(c.fulfilled_at!).getTime() - new Date(c.submitted_at).getTime()) / (1000 * 60 * 60)
      }, 0)
      productAvgH = Math.round(total / productFulfilled.length * 100) / 100
    }

    await supabase.from('metrics_daily').upsert({
      tenant_id: tenantId,
      metric_date: dateStr,
      product,
      total_cases: productCases.length,
      fulfilled_cases: productFulfilled.length,
      sla_met: productSlaMet,
      sla_breached: productFulfilled.length - productSlaMet,
      avg_response_h: productAvgH,
      topic_breakdown: null,
      channel_breakdown: null,
    }, { onConflict: 'tenant_id,metric_date,product' })
  }
}
