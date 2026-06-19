import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/require-session'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { error } = await requireSession(request)
  if (error) return error

  const { jobId } = await params
  const supabase = await createServiceClient()

  const { data: job } = await supabase
    .from('report_jobs')
    .select('id, status, download_url, error_msg, created_at, completed_at')
    .eq('id', jobId)
    .single()

  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  return NextResponse.json(job)
}
