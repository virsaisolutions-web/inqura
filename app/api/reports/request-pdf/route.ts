import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/require-session'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const { user, error } = await requireSession(request)
  if (error) return error

  const { period } = await request.json() as { period: string }
  if (!period || !/^\d{4}-\d{2}$/.test(period)) {
    return NextResponse.json({ error: 'Invalid period. Use YYYY-MM format.' }, { status: 400 })
  }

  const supabase = await createServiceClient()

  // Get tenant
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 500 })

  // Check if a job for this period is already pending/generating
  const { data: existing } = await supabase
    .from('report_jobs')
    .select('id, status')
    .eq('tenant_id', tenant.id)
    .eq('period', period)
    .in('status', ['pending', 'generating'])
    .limit(1)
    .single()

  if (existing) {
    return NextResponse.json({
      jobId: existing.id,
      status: existing.status,
      message: 'Your report is already being prepared. We\'ll notify you when it\'s ready.',
      alreadyQueued: true,
    })
  }

  // Create new job record — Lambda picks this up within 1 minute via EventBridge
  const { data: job, error: insertError } = await supabase
    .from('report_jobs')
    .insert({
      tenant_id: tenant.id,
      requested_by: user!.email!,
      period,
      status: 'pending',
    })
    .select('id')
    .single()

  if (insertError || !job) {
    return NextResponse.json({ error: 'Failed to queue report' }, { status: 500 })
  }

  return NextResponse.json({
    jobId: job.id,
    status: 'pending',
    message: 'Your compliance report is being prepared. You\'ll receive a notification as soon as it\'s ready — typically within 1–2 minutes.',
  })
}
