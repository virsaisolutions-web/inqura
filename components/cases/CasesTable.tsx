'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { SLAStatusBadge } from '@/components/sla/SLACountdown'
import { CaseDrawer } from './CaseDrawer'
import type { Case } from '@/lib/supabase/types'

interface Props {
  cases: Case[]
}

function statusVariant(status: string | null): 'success' | 'warning' | 'secondary' | 'outline' {
  switch (status) {
    case 'fulfilled': return 'success'
    case 'in_review': return 'warning'
    case 'open':      return 'secondary'
    default:          return 'outline'
  }
}

const HEADERS = ['Case ID', 'Topic', 'Product', 'Channel', 'Submitted', 'SLA', 'Status']

export function CasesTable({ cases }: Props) {
  const [selected, setSelected] = useState<Case | null>(null)

  async function handleEscalate(id: number) {
    await fetch(`/api/cases/${id}/escalate`, { method: 'POST' })
    setSelected(null)
  }

  if (!cases.length) {
    return (
      <div
        className="flex items-center justify-center h-32 text-[12px]"
        style={{ color: 'var(--text-4)' }}
      >
        No cases found. Trigger a sync to load data from Vault.
      </div>
    )
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {HEADERS.map(h => (
                <th
                  key={h}
                  className="text-left pb-2.5 pr-4 last:pr-0 whitespace-nowrap label-caps"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cases.map(c => (
              <tr
                key={c.id}
                onClick={() => setSelected(c)}
                className="cursor-pointer transition-colors"
                style={{ borderBottom: '1px solid var(--border-2)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                <td className="py-2.5 pr-4">
                  <span
                    className="text-[11px] tabular-nums"
                    style={{ color: 'var(--accent)', fontFamily: 'JetBrains Mono, monospace' }}
                  >
                    {c.vault_case_id}
                  </span>
                </td>
                <td className="py-2.5 pr-4 max-w-[140px]">
                  <span
                    className="text-[12px] truncate block"
                    style={{ color: 'var(--text-2)' }}
                  >
                    {c.topic_category ?? '—'}
                  </span>
                </td>
                <td className="py-2.5 pr-4">
                  <span className="text-[12px]" style={{ color: 'var(--text-2)' }}>
                    {c.product ?? '—'}
                  </span>
                </td>
                <td className="py-2.5 pr-4">
                  <span
                    className="text-[12px] capitalize"
                    style={{ color: 'var(--text-3)' }}
                  >
                    {c.channel ?? '—'}
                  </span>
                </td>
                <td className="py-2.5 pr-4 whitespace-nowrap">
                  <span
                    className="text-[11px] tabular-nums"
                    style={{ color: 'var(--text-4)', fontFamily: 'JetBrains Mono, monospace' }}
                  >
                    {c.submitted_at ? new Date(c.submitted_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'}
                  </span>
                </td>
                <td className="py-2.5 pr-4">
                  {c.sla_deadline && c.status !== 'fulfilled' ? (
                    <SLAStatusBadge deadline={c.sla_deadline} />
                  ) : (
                    <span className="text-[11px]" style={{ color: 'var(--border)' }}>—</span>
                  )}
                </td>
                <td className="py-2.5">
                  <Badge variant={statusVariant(c.status)}>
                    {c.status?.replace('_', ' ') ?? '—'}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CaseDrawer
        caseRow={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        onEscalate={handleEscalate}
      />
    </>
  )
}
