import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-session'

/**
 * POST /api/admin/vault-test
 * Tests Vault connectivity with the supplied credentials WITHOUT saving them.
 * Body: { vault_url, username, password, api_version? }
 */
export async function POST(req: NextRequest) {
  const { user, error } = await requireAdmin(req)
  if (error) return error

  const body = await req.json() as {
    vault_url: string
    username: string
    password: string
    api_version?: string
  }

  const { vault_url, username, password, api_version = 'v24.1' } = body

  if (!vault_url || !username || !password) {
    return NextResponse.json({ ok: false, error: 'vault_url, username, and password are required' }, { status: 400 })
  }

  // Normalise URL
  const base = vault_url.replace(/\/$/, '')

  try {
    const resp = await fetch(`${base}/api/${api_version}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ username, password }),
    })

    const data = await resp.json() as { responseStatus?: string; sessionId?: string; errors?: { message: string }[] }

    if (data.responseStatus === 'SUCCESS' && data.sessionId) {
      return NextResponse.json({ ok: true, message: 'Connection successful' })
    }

    const msg = data.errors?.[0]?.message ?? `Vault responded with status: ${data.responseStatus ?? resp.status}`
    return NextResponse.json({ ok: false, error: msg }, { status: 502 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network error — check Vault URL'
    return NextResponse.json({ ok: false, error: msg }, { status: 502 })
  }

  void user // used for auth gate only
}
