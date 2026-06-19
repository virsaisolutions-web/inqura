'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileText, Clock, CheckCircle, AlertCircle, Download } from 'lucide-react'

type JobStatus = 'idle' | 'pending' | 'generating' | 'complete' | 'error'

interface JobState {
  jobId: string
  status: JobStatus
  downloadUrl?: string
  error?: string
}

const PERIODS = (() => {
  const now = new Date()
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    return d.toISOString().slice(0, 7)
  })
})()

function periodLabel(period: string) {
  return new Date(period + '-02').toLocaleString('default', { month: 'long', year: 'numeric' })
}

export default function ReportsPage() {
  const [jobs, setJobs] = useState<Record<string, JobState>>({})

  async function requestReport(period: string) {
    // Already in flight
    const existing = jobs[period]
    if (existing?.status === 'pending' || existing?.status === 'generating') return

    setJobs(prev => ({ ...prev, [period]: { jobId: '', status: 'pending' } }))

    const resp = await fetch('/api/reports/request-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ period }),
    })
    const data = await resp.json()

    if (!resp.ok) {
      setJobs(prev => ({ ...prev, [period]: { jobId: '', status: 'error', error: data.error } }))
      return
    }

    setJobs(prev => ({ ...prev, [period]: { jobId: data.jobId, status: data.status } }))

    // Poll every 8 seconds until complete or error
    poll(period, data.jobId)
  }

  async function poll(period: string, jobId: string) {
    const INTERVAL = 8_000
    const MAX_POLLS = 30 // give up after 4 minutes

    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise(r => setTimeout(r, INTERVAL))

      const resp = await fetch(`/api/reports/job-status/${jobId}`)
      if (!resp.ok) break
      const job = await resp.json()

      setJobs(prev => ({
        ...prev,
        [period]: {
          jobId,
          status: job.status,
          downloadUrl: job.download_url ?? undefined,
          error: job.error_msg ?? undefined,
        },
      }))

      if (job.status === 'complete' || job.status === 'error') break
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Compliance Reports</CardTitle>
          <CardDescription>
            Monthly SLA compliance PDF reports. Generation takes 1–2 minutes — you&apos;ll receive a notification when your report is ready.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {PERIODS.map(period => {
            const job = jobs[period]
            return (
              <ReportRow
                key={period}
                period={period}
                label={periodLabel(period)}
                job={job}
                onRequest={() => requestReport(period)}
              />
            )
          })}
        </CardContent>
      </Card>

      {/* Info callout */}
      <div
        className="flex items-start gap-3 px-4 py-3 rounded-[10px] text-[12px]"
        style={{
          background: 'var(--accent-tint)',
          border: '1px solid var(--accent-border)',
          color: 'var(--accent)',
        }}
      >
        <Clock className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
        <span>
          Reports are generated in the background. Once ready, a download link will appear here and
          in your <strong>notification bell</strong> — no need to stay on this page.
        </span>
      </div>
    </div>
  )
}

interface RowProps {
  period: string
  label: string
  job: JobState | undefined
  onRequest: () => void
}

function ReportRow({ label, job, onRequest }: RowProps) {
  const status = job?.status ?? 'idle'

  return (
    <div
      className="flex items-center justify-between p-4 rounded-[10px]"
      style={{ border: '1px solid var(--border)', background: 'var(--surface-2)' }}
    >
      <div className="flex items-center gap-3">
        <FileText className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-4)' }} />
        <div>
          <p className="text-[13px] font-medium" style={{ color: 'var(--text-1)' }}>{label}</p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-4)' }}>SLA Compliance Report</p>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <StatusIndicator status={status} />

        {status === 'idle' && (
          <Button variant="outline" size="sm" onClick={onRequest}>
            Generate PDF
          </Button>
        )}

        {(status === 'pending' || status === 'generating') && (
          <Button variant="outline" size="sm" disabled>
            <span className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full border-2 border-current border-t-transparent animate-spin"
                style={{ borderTopColor: 'transparent' }}
              />
              Preparing…
            </span>
          </Button>
        )}

        {status === 'complete' && job?.downloadUrl && (
          <a href={job.downloadUrl} download>
            <Button size="sm" className="flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5" />
              Download
            </Button>
          </a>
        )}

        {status === 'error' && (
          <Button variant="outline" size="sm" onClick={onRequest}>
            Retry
          </Button>
        )}
      </div>
    </div>
  )
}

function StatusIndicator({ status }: { status: JobStatus }) {
  if (status === 'idle') return null

  if (status === 'pending' || status === 'generating') {
    return (
      <span className="text-[11px]" style={{ color: 'var(--text-4)' }}>
        {status === 'pending' ? 'Queued' : 'Generating…'}
      </span>
    )
  }

  if (status === 'complete') {
    return (
      <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--success-text)' }}>
        <CheckCircle className="w-3.5 h-3.5" />
        Ready
      </span>
    )
  }

  if (status === 'error') {
    return (
      <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--danger-text)' }}>
        <AlertCircle className="w-3.5 h-3.5" />
        Failed
      </span>
    )
  }

  return null
}
