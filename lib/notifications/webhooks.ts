/**
 * lib/notifications/webhooks.ts
 *
 * Unified webhook notification library supporting Slack and Microsoft Teams.
 * All sends are server-side only. Webhook URLs are never exposed to the browser.
 *
 * Slack format:   https://api.slack.com/messaging/webhooks
 * Teams format:   MessageCard (legacy connector, universally supported)
 *                 https://learn.microsoft.com/en-us/outlook/actionable-messages/message-card-reference
 */

import { createServiceClient } from '@/lib/supabase/server'

export type WebhookType = 'slack' | 'teams' | 'custom'

export interface WebhookConfig {
  id: number
  type: WebhookType
  webhook_url: string
  enabled: boolean
  label: string | null
}

/** Fetch all enabled webhook integrations for the tenant from DB */
export async function getActiveWebhooks(): Promise<WebhookConfig[]> {
  const supabase = await createServiceClient()
  const { data } = await supabase
    .from('integrations')
    .select('id, type, webhook_url, enabled, label')
    .eq('enabled', true)

  return (data ?? []) as WebhookConfig[]
}

/** Fetch a single integration by type */
export async function getWebhook(type: WebhookType): Promise<WebhookConfig | null> {
  const supabase = await createServiceClient()
  const { data } = await supabase
    .from('integrations')
    .select('id, type, webhook_url, enabled, label')
    .eq('type', type)
    .single()

  return data as WebhookConfig | null
}

/** Upsert an integration config */
export async function saveWebhook(type: WebhookType, webhookUrl: string, enabled: boolean, label?: string): Promise<void> {
  const supabase = await createServiceClient()
  await supabase
    .from('integrations')
    .upsert(
      { type, webhook_url: webhookUrl, enabled, label: label ?? null },
      { onConflict: 'tenant_id,type', ignoreDuplicates: false }
    )
}

/** Delete an integration */
export async function deleteWebhook(type: WebhookType): Promise<void> {
  const supabase = await createServiceClient()
  await supabase.from('integrations').delete().eq('type', type)
}

// ── Payload builders ─────────────────────────────────────────────────────────

interface AlertPayload {
  caseId: string
  product: string | null
  topic: string | null
  hoursLeft: number
}

interface EscalationPayload {
  caseId: string
  product: string | null
  escalatedBy: string
}

function buildSlackSLAPayload({ caseId, product, topic, hoursLeft }: AlertPayload): object {
  const urgency = hoursLeft < 0 ? '🔴 *SLA BREACHED*' : hoursLeft < 6 ? '🔴 *SLA CRITICAL*' : '🟡 *SLA AT RISK*'
  const timeText = hoursLeft < 0 ? `${Math.abs(Math.round(hoursLeft))}h overdue` : `${Math.round(hoursLeft)}h remaining`

  return {
    text: `${urgency}: Case ${caseId} — ${timeText}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${urgency}\n*Case:* \`${caseId}\`\n*Product:* ${product ?? '—'}\n*Topic:* ${topic ?? '—'}\n*Time:* ${timeText}`,
        },
      },
    ],
  }
}

function buildTeamsSLAPayload({ caseId, product, topic, hoursLeft }: AlertPayload): object {
  const isBreached = hoursLeft < 0
  const isCritical = hoursLeft >= 0 && hoursLeft < 6
  const themeColor = isBreached || isCritical ? 'FF0000' : 'FFA500'
  const title = isBreached ? '🔴 SLA BREACHED' : isCritical ? '🔴 SLA CRITICAL' : '🟡 SLA AT RISK'
  const timeText = isBreached ? `${Math.abs(Math.round(hoursLeft))}h overdue` : `${Math.round(hoursLeft)}h remaining`

  return {
    '@type': 'MessageCard',
    '@context': 'http://schema.org/extensions',
    themeColor,
    summary: `${title}: Case ${caseId}`,
    sections: [
      {
        activityTitle: title,
        activitySubtitle: `Inqura SLA Alert · ${new Date().toLocaleString()}`,
        facts: [
          { name: 'Case ID', value: caseId },
          { name: 'Product', value: product ?? '—' },
          { name: 'Topic', value: topic ?? '—' },
          { name: 'SLA Status', value: timeText },
        ],
      },
    ],
  }
}

function buildSlackEscalationPayload({ caseId, product, escalatedBy }: EscalationPayload): object {
  return {
    text: `🚨 Case ${caseId} escalated by ${escalatedBy}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🚨 *Case Escalated*\n*Case:* \`${caseId}\`\n*Product:* ${product ?? '—'}\n*Escalated by:* ${escalatedBy}`,
        },
      },
    ],
  }
}

function buildTeamsEscalationPayload({ caseId, product, escalatedBy }: EscalationPayload): object {
  return {
    '@type': 'MessageCard',
    '@context': 'http://schema.org/extensions',
    themeColor: 'FF0000',
    summary: `Case ${caseId} escalated`,
    sections: [
      {
        activityTitle: '🚨 Case Escalated',
        activitySubtitle: `Inqura · ${new Date().toLocaleString()}`,
        facts: [
          { name: 'Case ID', value: caseId },
          { name: 'Product', value: product ?? '—' },
          { name: 'Escalated by', value: escalatedBy },
        ],
      },
    ],
  }
}

function buildTestPayload(type: WebhookType): object {
  if (type === 'teams') {
    return {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: '4C6EF5',
      summary: 'Inqura test notification',
      sections: [
        {
          activityTitle: '✅ Inqura Connected',
          activitySubtitle: `Test notification from Inqura · ${new Date().toLocaleString()}`,
          facts: [
            { name: 'Status', value: 'Webhook configured successfully' },
            { name: 'From', value: 'Inqura Medical Affairs Intelligence' },
          ],
        },
      ],
    }
  }

  // Slack (and custom)
  return {
    text: '✅ Inqura webhook connected successfully',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `✅ *Inqura Connected*\nThis webhook is configured and working.\n_Sent from Inqura Medical Affairs Intelligence_`,
        },
      },
    ],
  }
}

// ── Core send function ───────────────────────────────────────────────────────

async function sendToWebhook(url: string, payload: object): Promise<{ ok: boolean; error?: string }> {
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!resp.ok) {
      return { ok: false, error: `HTTP ${resp.status}: ${resp.statusText}` }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Send SLA alert to all active webhooks */
export async function sendSLAAlert(payload: AlertPayload): Promise<void> {
  const webhooks = await getActiveWebhooks()

  for (const wh of webhooks) {
    const body = wh.type === 'teams'
      ? buildTeamsSLAPayload(payload)
      : buildSlackSLAPayload(payload)

    const result = await sendToWebhook(wh.webhook_url, body)
    if (!result.ok) {
      console.error(`[webhook:${wh.type}] SLA alert failed:`, result.error)
    }
  }

  // Fallback to env var for backwards compat during transition
  if (webhooks.length === 0 && process.env.SLACK_WEBHOOK_URL) {
    await sendToWebhook(process.env.SLACK_WEBHOOK_URL, buildSlackSLAPayload(payload))
  }
}

/** Send escalation alert to all active webhooks */
export async function sendEscalationAlert(payload: EscalationPayload): Promise<void> {
  const webhooks = await getActiveWebhooks()

  for (const wh of webhooks) {
    const body = wh.type === 'teams'
      ? buildTeamsEscalationPayload(payload)
      : buildSlackEscalationPayload(payload)

    const result = await sendToWebhook(wh.webhook_url, body)
    if (!result.ok) {
      console.error(`[webhook:${wh.type}] Escalation alert failed:`, result.error)
    }
  }

  if (webhooks.length === 0 && process.env.SLACK_WEBHOOK_URL) {
    await sendToWebhook(process.env.SLACK_WEBHOOK_URL, buildSlackEscalationPayload(payload))
  }
}

/** Test a specific webhook URL + type without saving it */
export async function testWebhook(type: WebhookType, url: string): Promise<{ ok: boolean; error?: string }> {
  const payload = buildTestPayload(type)
  return sendToWebhook(url, payload)
}
