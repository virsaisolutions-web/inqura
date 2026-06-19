'use client'

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SLACountdown } from '@/components/sla/SLACountdown'
import { cn } from '@/lib/utils'
import type { Case } from '@/lib/supabase/types'

interface Props {
  caseRow: Case | null
  open: boolean
  onClose: () => void
  onEscalate?: (id: number) => Promise<void>
}

const WORKFLOW_STEPS = ['Intake', 'Triage', 'Medical Review', 'Fulfilled']

function getWorkflowStep(status: string | null): number {
  switch (status) {
    case 'open':       return 0
    case 'in_review':  return 2
    case 'fulfilled':  return 3
    default:           return 0
  }
}

export function CaseDrawer({ caseRow, open, onClose, onEscalate }: Props) {
  if (!caseRow) return null

  const workflowStep = getWorkflowStep(caseRow.status)
  const isEscalatable = caseRow.status !== 'fulfilled' && caseRow.status !== 'closed'

  async function handleEscalate() {
    if (onEscalate) await onEscalate(caseRow!.id)
  }

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent side="right" className="w-[420px] overflow-y-auto flex flex-col gap-5">
        <SheetHeader>
          <SheetTitle className="font-mono text-sm">{caseRow.vault_case_id}</SheetTitle>
          <SheetDescription>
            {caseRow.topic_category ?? 'Unknown topic'} · {caseRow.product ?? 'Unknown product'}
          </SheetDescription>
        </SheetHeader>

        {/* SLA Countdown */}
        {caseRow.sla_deadline && caseRow.status !== 'fulfilled' && (
          <div
            className="rounded-[10px] p-4 flex items-center gap-4"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
          >
            <SLACountdown
              deadline={caseRow.sla_deadline}
              showRing
              slaHoursTarget={caseRow.sla_hours_target}
            />
            <div>
              <p className="label-caps mb-1">SLA deadline</p>
              <p className="text-[12px] font-medium" style={{ color: 'var(--text-2)' }}>
                {new Date(caseRow.sla_deadline).toLocaleString()}
              </p>
            </div>
          </div>
        )}

        {/* Workflow Progress */}
        <div>
          <p className="label-caps mb-3">Workflow</p>
          <div className="flex items-center gap-0">
            {WORKFLOW_STEPS.map((step, i) => (
              <div key={step} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                    style={{
                      background: i <= workflowStep ? 'var(--accent)' : 'var(--surface-2)',
                      color: i <= workflowStep ? '#fff' : 'var(--text-4)',
                      border: i <= workflowStep ? 'none' : '1px solid var(--border)',
                    }}
                  >
                    {i + 1}
                  </div>
                  <span
                    className="text-[10px]"
                    style={{
                      color: i <= workflowStep ? 'var(--accent)' : 'var(--text-4)',
                      fontWeight: i <= workflowStep ? 600 : 400,
                    }}
                  >
                    {step}
                  </span>
                </div>
                {i < WORKFLOW_STEPS.length - 1 && (
                  <div
                    className="flex-1 h-px mb-4 mx-1"
                    style={{ background: i < workflowStep ? 'var(--accent)' : 'var(--border)' }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Details */}
        <div className="space-y-2">
          <p className="label-caps mb-3">Case details</p>
          <dl>
            {[
              { label: 'Status', value: <Badge variant={caseRow.status === 'fulfilled' ? 'success' : 'secondary'}>{caseRow.status ?? '—'}</Badge> },
              { label: 'Priority', value: <Badge variant={caseRow.priority === 'critical' ? 'destructive' : caseRow.priority === 'urgent' ? 'warning' : 'outline'}>{caseRow.priority ?? 'standard'}</Badge> },
              { label: 'Channel', value: caseRow.channel ?? '—' },
              { label: 'Country', value: caseRow.country ?? '—' },
              { label: 'HCP Specialty', value: caseRow.hcp_specialty ?? '—' },
              { label: 'Institution', value: caseRow.hcp_institution ?? '—' },
              { label: 'Off-label', value: caseRow.is_off_label ? 'Yes' : 'No' },
              { label: 'Submitted', value: caseRow.submitted_at ? new Date(caseRow.submitted_at).toLocaleDateString() : '—' },
              { label: 'Assigned', value: caseRow.assigned_at ? new Date(caseRow.assigned_at).toLocaleDateString() : '—' },
              { label: 'Fulfilled', value: caseRow.fulfilled_at ? new Date(caseRow.fulfilled_at).toLocaleDateString() : '—' },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="flex items-center justify-between py-2"
                style={{ borderBottom: '1px solid var(--border-2)' }}
              >
                <dt className="text-[12px]" style={{ color: 'var(--text-4)' }}>{label}</dt>
                <dd className="text-[12px] font-medium" style={{ color: 'var(--text-1)' }}>{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Actions */}
        {isEscalatable && (
          <div className="pt-3" style={{ borderTop: '1px solid var(--border)' }}>
            <Button
              variant="destructive"
              size="sm"
              className="w-full"
              onClick={handleEscalate}
            >
              Escalate case
            </Button>
            <p className="text-[10px] text-center mt-2" style={{ color: 'var(--text-4)' }}>
              Sends Slack alert and marks case as critical priority
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
