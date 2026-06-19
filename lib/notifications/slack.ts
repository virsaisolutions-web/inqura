interface SlackMessage {
  text: string
  blocks?: object[]
}

/**
 * Posts a message to the configured Slack webhook.
 * No-ops (with console log) if SLACK_WEBHOOK_URL is not set.
 */
export async function sendSlackAlert(message: SlackMessage): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL

  if (!webhookUrl) {
    console.log('[slack] Webhook not configured. Message would be:', message.text)
    return
  }

  try {
    const resp = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    })

    if (!resp.ok) {
      console.error('[slack] Webhook error:', resp.status, resp.statusText)
    }
  } catch (err) {
    console.error('[slack] Failed to send alert:', err)
  }
}

export function buildSLAAlertMessage(caseId: string, product: string | null, topic: string | null, hoursLeft: number): SlackMessage {
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

export function buildEscalationMessage(caseId: string, product: string | null, escalatedBy: string): SlackMessage {
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
