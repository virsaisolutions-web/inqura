import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/require-session'

// Rate limiting: track last manual trigger per user (in-memory, serverless-safe)
const lastTrigger: Record<string, number> = {}
const RATE_LIMIT_MS = 10 * 60 * 1000 // 10 minutes

// If LAMBDA_VAULT_SYNC_URL is set, proxy to Lambda (recommended).
// Otherwise falls back to running sync in-process (Vercel, 10s timeout risk).
const LAMBDA_URL = process.env.LAMBDA_VAULT_SYNC_URL

export async function POST(request: NextRequest) {
  const cronSecret = request.headers.get('x-cron-secret')
  const isCronCall = cronSecret === process.env.CRON_SECRET && !!process.env.CRON_SECRET

  if (!isCronCall) {
    const { user, error } = await requireSession(request)
    if (error) return error

    const now = Date.now()
    const lastCall = lastTrigger[user!.email!] ?? 0
    if (now - lastCall < RATE_LIMIT_MS) {
      const waitMs = RATE_LIMIT_MS - (now - lastCall)
      return NextResponse.json(
        { error: `Rate limited. Try again in ${Math.ceil(waitMs / 60000)} minutes.` },
        { status: 429 }
      )
    }
    lastTrigger[user!.email!] = now
  }

  // ── Proxy to Lambda if configured ──────────────────────────────────
  if (LAMBDA_URL) {
    const resp = await fetch(LAMBDA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: process.env.CRON_SECRET }),
    })
    const data = await resp.json()
    return NextResponse.json(data, { status: resp.status })
  }

  // ── Fallback: run in-process (dev / no Lambda configured) ──────────
  const { syncCases } = await import('@/lib/vault/sync')
  const result = await syncCases()
  if (result.error) {
    return NextResponse.json({ error: result.error, ...result }, { status: 500 })
  }
  return NextResponse.json(result)
}
