import { NextRequest, NextResponse } from 'next/server'
import { refreshMetricsDaily } from '@/lib/metrics/metrics'

/** Nightly cron: refresh metrics_daily for yesterday and today */
export async function POST(request: NextRequest) {
  const cronSecret = request.headers.get('x-cron-secret')
  if (cronSecret !== process.env.CRON_SECRET || !process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)

  await Promise.all([
    refreshMetricsDaily(null, now),
    refreshMetricsDaily(null, yesterday),
  ])

  return NextResponse.json({ refreshed: true, timestamp: now.toISOString() })
}
