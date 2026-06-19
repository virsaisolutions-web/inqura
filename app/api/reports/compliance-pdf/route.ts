import { NextRequest, NextResponse } from 'next/server'
import { requireSession, writeAuditLog } from '@/lib/auth/require-session'
import { createServiceClient } from '@/lib/supabase/server'
import type { Case } from '@/lib/supabase/types'
import { generateCompliancePDF } from './pdf-document'

export async function GET(request: NextRequest) {
  const { user, error } = await requireSession(request)
  if (error) return error

  const period = request.nextUrl.searchParams.get('period') ?? new Date().toISOString().slice(0, 7)
  const [year, month] = period.split('-').map(Number)
  const periodStart = new Date(year, month - 1, 1)
  const periodEnd = new Date(year, month, 0, 23, 59, 59)
  const periodLabel = periodStart.toLocaleString('default', { month: 'long', year: 'numeric' })

  const supabase = await createServiceClient()
  const { data } = await supabase
    .from('cases')
    .select('*')
    .gte('submitted_at', periodStart.toISOString())
    .lte('submitted_at', periodEnd.toISOString())

  const cases = (data ?? []) as Case[]

  const buffer = await generateCompliancePDF({
    cases,
    periodLabel,
    generatedAt: new Date().toLocaleString(),
  })

  // Fire-and-forget audit log (non-blocking)
  writeAuditLog({
    userEmail: user!.email,
    action: 'exported_report',
    resource: 'report',
    resourceId: period,
  })

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="inqura-sla-${period}.pdf"`,
    },
  })
}
