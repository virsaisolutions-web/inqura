import { NextRequest, NextResponse } from 'next/server'
import { requireSession, writeAuditLog } from '@/lib/auth/require-session'
import { getKPIs } from '@/lib/metrics/metrics'

export async function GET(request: NextRequest) {
  const { user, error } = await requireSession(request)
  if (error) return error

  const kpis = await getKPIs()

  // Audit log — non-blocking
  writeAuditLog({
    userEmail: user!.email,
    action: 'viewed_dashboard',
    resource: 'metrics',
    ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
  })

  return NextResponse.json(kpis)
}
