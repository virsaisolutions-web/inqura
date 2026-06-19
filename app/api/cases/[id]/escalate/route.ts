import { NextRequest, NextResponse } from 'next/server'
import { requireSession, writeAuditLog } from '@/lib/auth/require-session'
import { createServiceClient } from '@/lib/supabase/server'
import { sendEscalationAlert } from '@/lib/notifications/webhooks'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireSession(request)
  if (error) return error

  const { id } = await params
  const caseId = parseInt(id, 10)
  if (isNaN(caseId)) {
    return NextResponse.json({ error: 'Invalid case ID' }, { status: 400 })
  }

  const supabase = await createServiceClient()

  // Fetch the case
  const { data: caseRow, error: fetchError } = await supabase
    .from('cases')
    .select('*')
    .eq('id', caseId)
    .single()

  if (fetchError || !caseRow) {
    return NextResponse.json({ error: 'Case not found' }, { status: 404 })
  }

  // Escalate: set priority to critical
  await supabase
    .from('cases')
    .update({ priority: 'critical' })
    .eq('id', caseId)

  // Create alert record
  await supabase.from('alerts').insert({
    tenant_id: caseRow.tenant_id,
    case_id: caseId,
    alert_type: 'escalated',
    severity: 'critical',
    message: `Case ${caseRow.vault_case_id} escalated by ${user!.email}`,
  })

  // Send alert to all configured webhooks (Slack + Teams)
  await sendEscalationAlert({
    caseId: caseRow.vault_case_id,
    product: caseRow.product,
    escalatedBy: user!.email ?? 'unknown',
  })

  // Audit log
  await writeAuditLog({
    userEmail: user!.email,
    action: 'escalated_case',
    resource: 'cases',
    resourceId: caseRow.vault_case_id,
    ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
  })

  return NextResponse.json({ success: true, caseId, escalatedBy: user!.email })
}
