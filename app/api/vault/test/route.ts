import { NextRequest, NextResponse } from 'next/server'
import { getVaultSession } from '@/lib/vault/client'
import { testConnection } from '@/lib/vault/queries'
import { requireSession } from '@/lib/auth/require-session'

export async function GET(request: NextRequest) {
  const { error } = await requireSession(request)
  if (error) return error

  try {
    const sessionId = await getVaultSession()
    const result = await testConnection(sessionId)

    return NextResponse.json({
      connected: result.connected,
      vaultUrl: process.env.VAULT_URL ?? '(not configured)',
      apiVersion: process.env.VAULT_API_VERSION ?? 'v24.1',
      casesAccessible: result.connected,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json({
      connected: false,
      vaultUrl: process.env.VAULT_URL ?? '(not configured)',
      error: err instanceof Error ? err.message : String(err),
      timestamp: new Date().toISOString(),
    }, { status: 503 })
  }
}
