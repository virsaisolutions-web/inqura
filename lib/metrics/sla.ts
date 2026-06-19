import type { Case } from '@/lib/supabase/types'

export const SLA_HOURS_BY_PRIORITY = {
  critical: 24,
  urgent:   48,
  standard: 72,
} as const

type Priority = keyof typeof SLA_HOURS_BY_PRIORITY

/**
 * Computes the SLA deadline for a case.
 * Off-label inquiries always get urgent (48h) treatment.
 */
export function computeSLADeadline(
  submittedAt: Date,
  priority: string,
  isOffLabel: boolean
): Date {
  const hours = isOffLabel
    ? SLA_HOURS_BY_PRIORITY.urgent
    : (SLA_HOURS_BY_PRIORITY[priority as Priority] ?? SLA_HOURS_BY_PRIORITY.standard)

  return new Date(submittedAt.getTime() + hours * 60 * 60 * 1000)
}

/**
 * Returns the SLA risk level based on time remaining until deadline.
 */
export function getSLARiskLevel(
  deadline: Date,
  now: Date = new Date()
): 'critical' | 'warning' | 'safe' | 'breached' {
  const hoursLeft = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60)
  if (hoursLeft < 0)  return 'breached'
  if (hoursLeft < 6)  return 'critical'   // <6h → red
  if (hoursLeft < 20) return 'warning'    // <20h → amber
  return 'safe'
}

/**
 * Returns hours remaining until deadline. Negative = already breached.
 */
export function getHoursRemaining(deadline: Date, now: Date = new Date()): number {
  return (deadline.getTime() - now.getTime()) / (1000 * 60 * 60)
}

/**
 * Computes SLA compliance % for a set of fulfilled cases.
 * Returns 100 if no fulfilled cases yet (no denominator).
 */
export function computeSLACompliance(cases: Pick<Case, 'fulfilled_at' | 'sla_deadline'>[]): number {
  const fulfilled = cases.filter(c => c.fulfilled_at !== null && c.sla_deadline !== null)
  if (fulfilled.length === 0) return 100

  const met = fulfilled.filter(c => {
    const fulfilledAt = new Date(c.fulfilled_at!)
    const deadline = new Date(c.sla_deadline!)
    return fulfilledAt <= deadline
  }).length

  return Math.round((met / fulfilled.length) * 1000) / 10 // 1 decimal place
}

/**
 * Returns color class based on SLA compliance percentage.
 */
export function getComplianceColorClass(pct: number): string {
  if (pct >= 95) return 'text-teal-600'
  if (pct >= 85) return 'text-amber-600'
  return 'text-red-600'
}

/**
 * Returns badge variant based on SLA risk level.
 */
export function getRiskBadgeVariant(
  risk: ReturnType<typeof getSLARiskLevel>
): 'destructive' | 'warning' | 'default' | 'success' {
  switch (risk) {
    case 'breached':  return 'destructive'
    case 'critical':  return 'destructive'
    case 'warning':   return 'warning'
    case 'safe':      return 'success'
  }
}
