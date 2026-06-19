// PDF Worker Lambda
// Triggered by EventBridge every 1 minute.
// Picks up pending report_jobs, generates PDF, uploads to Supabase Storage,
// creates a report_ready alert, and updates the job record.

import { createClient } from '@supabase/supabase-js'

export async function handler() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Pick up one pending job at a time (safe for 1-min polling)
  const { data: job } = await supabase
    .from('report_jobs')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (!job) return { ok: true, message: 'No pending jobs' }

  // Mark as generating (prevents duplicate processing)
  await supabase
    .from('report_jobs')
    .update({ status: 'generating' })
    .eq('id', job.id)

  try {
    const [year, month] = job.period.split('-').map(Number)
    const periodStart = new Date(year, month - 1, 1)
    const periodEnd   = new Date(year, month, 0, 23, 59, 59)
    const periodLabel = periodStart.toLocaleString('default', { month: 'long', year: 'numeric' })

    // Fetch cases for the period
    const { data: cases } = await supabase
      .from('cases')
      .select('*')
      .eq('tenant_id', job.tenant_id)
      .gte('submitted_at', periodStart.toISOString())
      .lte('submitted_at', periodEnd.toISOString())

    // Generate PDF — reuse the same generator used by the Vercel route
    const { generateCompliancePDF } = await import(
      '../app/api/reports/compliance-pdf/pdf-document'
    )
    const buffer = await generateCompliancePDF({
      cases: cases ?? [],
      periodLabel,
      generatedAt: new Date().toLocaleString(),
    })

    // Upload to Supabase Storage (private "reports" bucket)
    const storagePath = `${job.tenant_id}/${job.period}-${job.id}.pdf`
    const { error: uploadError } = await supabase.storage
      .from('reports')
      .upload(storagePath, Buffer.from(buffer), {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`)

    // Create signed download URL valid for 24 hours
    const { data: signed } = await supabase.storage
      .from('reports')
      .createSignedUrl(storagePath, 60 * 60 * 24)

    const downloadUrl = signed?.signedUrl ?? ''

    // Update job to complete
    await supabase
      .from('report_jobs')
      .update({
        status: 'complete',
        download_url: downloadUrl,
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id)

    // Create report_ready alert — AlertBell Realtime picks this up instantly
    await supabase.from('alerts').insert({
      tenant_id: job.tenant_id,
      alert_type: 'report_ready',
      severity: 'info',
      message: JSON.stringify({
        text: `Your ${periodLabel} compliance report is ready.`,
        download_url: downloadUrl,
        period: job.period,
      }),
    })

    // Audit log
    await supabase.from('audit_log').insert({
      tenant_id: job.tenant_id,
      user_email: job.requested_by,
      action: 'exported_report',
      resource: 'report',
      resource_id: job.period,
    })

    return { ok: true, jobId: job.id, period: job.period }

  } catch (err) {
    console.error('PDF generation failed:', err)

    await supabase
      .from('report_jobs')
      .update({ status: 'error', error_msg: String(err) })
      .eq('id', job.id)

    // Error alert so user knows it failed
    await supabase.from('alerts').insert({
      tenant_id: job.tenant_id,
      alert_type: 'report_ready',
      severity: 'critical',
      message: JSON.stringify({
        text: `Report generation failed for ${job.period}. Please try again or contact support.`,
        download_url: null,
        period: job.period,
      }),
    })

    return { ok: false, error: String(err) }
  }
}
