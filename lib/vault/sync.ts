import { createServiceClient } from '@/lib/supabase/server'
import { getVaultSession } from './client'
import { getOpenCases, getCasesSince } from './queries'
import { computeSLADeadline } from '@/lib/metrics/sla'
import { refreshMetricsDaily } from '@/lib/metrics/metrics'
import {
  VAULT_STATUS_MAP,
  VAULT_CHANNEL_MAP,
  VAULT_PRIORITY_MAP,
  type VaultCase,
} from './types'

const TENANT_ID = process.env.TENANT_ID // optional override; Phase 1 = single tenant

export interface SyncResult {
  synced: number
  alerts: number
  duration: number
  error?: string
}

/**
 * Main sync orchestrator — called by cron and manual trigger.
 * Handles full and incremental sync, SLA deadline computation, alert generation.
 */
export async function syncCases(tenantId?: string): Promise<SyncResult> {
  const startTime = Date.now()
  const supabase = await createServiceClient()
  const effectiveTenantId = tenantId ?? TENANT_ID ?? null

  // 1. Create sync_log entry
  const { data: syncLogRow } = await supabase
    .from('sync_log')
    .insert({ tenant_id: effectiveTenantId, sync_type: 'incremental', status: 'running' })
    .select('id')
    .single()

  const syncLogId = syncLogRow?.id

  try {
    // 2. Find last successful sync
    const { data: lastSync } = await supabase
      .from('sync_log')
      .select('completed_at')
      .eq('status', 'success')
      .order('completed_at', { ascending: false })
      .limit(1)
      .single()

    const lastSyncAt = lastSync?.completed_at ? new Date(lastSync.completed_at) : null
    const isFullSync = !lastSyncAt

    // 3. Fetch from Vault
    const sessionId = await getVaultSession()
    const vaultCases = isFullSync
      ? await getOpenCases(sessionId)
      : await getCasesSince(sessionId, lastSyncAt!)

    if (isFullSync && syncLogId) {
      await supabase.from('sync_log').update({ sync_type: 'full' }).eq('id', syncLogId)
    }

    // 4. Map and upsert
    const now = new Date()
    let syncedCount = 0

    for (const vc of vaultCases) {
      const normalizedPriority = VAULT_PRIORITY_MAP[vc.priority__v ?? ''] ?? 'standard'
      const submittedAt = vc.submitted_date__v ? new Date(vc.submitted_date__v) : now
      const isOffLabel = vc.is_off_label__v ?? false

      const slaDeadline = computeSLADeadline(submittedAt, normalizedPriority, isOffLabel)

      const row = {
        tenant_id: effectiveTenantId,
        vault_case_id: vc.id,
        product: vc.product__v ?? null,
        topic_category: vc.topic__v ?? null,
        channel: VAULT_CHANNEL_MAP[vc.channel__v ?? ''] ?? vc.channel__v ?? null,
        status: VAULT_STATUS_MAP[vc.status__v ?? ''] ?? vc.status__v ?? null,
        priority: normalizedPriority,
        hcp_specialty: vc.hcp_specialty__v ?? null,
        hcp_institution: vc.institution__v ?? null,
        country: vc.country__v ?? null,
        submitted_at: submittedAt.toISOString(),
        assigned_at: vc.assigned_date__v ?? null,
        fulfilled_at: vc.response_date__v ?? null,
        sla_deadline: slaDeadline.toISOString(),
        sla_hours_target: isOffLabel ? 48 : normalizedPriority === 'critical' ? 24 : normalizedPriority === 'urgent' ? 48 : 72,
        is_off_label: isOffLabel,
        vault_synced_at: now.toISOString(),
      }

      const { error } = await supabase
        .from('cases')
        .upsert(row, { onConflict: 'vault_case_id' })

      if (!error) syncedCount++
    }

    // 5. Generate alerts for at-risk open cases
    const alertCount = await generateSLAAlerts(effectiveTenantId)

    // 6. Refresh today's metrics
    await refreshMetricsDaily(effectiveTenantId, new Date())

    // 7. Mark sync as success
    if (syncLogId) {
      await supabase.from('sync_log').update({
        status: 'success',
        completed_at: new Date().toISOString(),
        records_processed: syncedCount,
      }).eq('id', syncLogId)
    }

    return { synced: syncedCount, alerts: alertCount, duration: Date.now() - startTime }

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error('[sync] Failed:', errorMsg)

    if (syncLogId) {
      await supabase.from('sync_log').update({
        status: 'error',
        completed_at: new Date().toISOString(),
        error_msg: errorMsg,
      }).eq('id', syncLogId)
    }

    return { synced: 0, alerts: 0, duration: Date.now() - startTime, error: errorMsg }
  }
}

/**
 * Scan open cases and insert alerts for any at SLA risk.
 * Deduplicates: one alert per case per type per day.
 */
async function generateSLAAlerts(tenantId: string | null): Promise<number> {
  const { getSLARiskLevel } = await import('@/lib/metrics/sla')
  const supabase = await createServiceClient()
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]

  // Fetch open cases with deadlines
  const { data: openCases } = await supabase
    .from('cases')
    .select('id, sla_deadline, priority, topic_category, product')
    .in('status', ['open', 'in_review'])
    .not('sla_deadline', 'is', null)

  if (!openCases?.length) return 0

  let alertCount = 0

  for (const c of openCases) {
    const deadline = new Date(c.sla_deadline!)
    const riskLevel = getSLARiskLevel(deadline, now)

    if (riskLevel === 'safe') continue

    const alertType = riskLevel === 'breached' ? 'sla_breach' : 'sla_risk'
    const severity = riskLevel === 'breached' || riskLevel === 'critical' ? 'critical' : 'warning'

    // Dedup: check if we already have this alert today
    const { count } = await supabase
      .from('alerts')
      .select('id', { count: 'exact', head: true })
      .eq('case_id', c.id)
      .eq('alert_type', alertType)
      .gte('triggered_at', `${todayStr}T00:00:00Z`)

    if ((count ?? 0) > 0) continue

    const hoursLeft = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60)
    const message = riskLevel === 'breached'
      ? `SLA breached — case ${c.id} (${c.product ?? 'unknown product'}) is overdue`
      : `SLA at risk — case ${c.id} expires in ${Math.max(0, Math.round(hoursLeft))}h (${c.product ?? 'unknown product'})`

    await supabase.from('alerts').insert({
      tenant_id: tenantId,
      case_id: c.id,
      alert_type: alertType,
      severity,
      message,
    })

    alertCount++
  }

  return alertCount
}
