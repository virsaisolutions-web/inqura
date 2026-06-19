import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/require-session'
import { sendSlackAlert } from '@/lib/notifications/slack'

export async function POST(request: NextRequest) {
  const { user, error } = await requireSession(request)
  if (error) return error

  await sendSlackAlert({
    text: `🧪 Test notification from Inqura — sent by ${user!.email}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Inqura Slack Integration Test*\nSent by: ${user!.email}\nTimestamp: ${new Date().toISOString()}`,
        },
      },
    ],
  })

  return NextResponse.json({ ok: true })
}
