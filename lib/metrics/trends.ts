import type { Case } from '@/lib/supabase/types'

export interface DailyVolume {
  date: string  // YYYY-MM-DD
  count: number
}

export interface LabeledCount {
  label: string
  count: number
  pct: number
}

/**
 * Returns daily case volume for the last N days.
 * Suitable for sparklines and bar charts.
 */
export function getDailyVolume(cases: Pick<Case, 'submitted_at'>[], days: number = 30): DailyVolume[] {
  const now = new Date()
  const result: DailyVolume[] = []

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    const count = cases.filter(c => c.submitted_at.startsWith(dateStr)).length
    result.push({ date: dateStr, count })
  }

  return result
}

/**
 * Returns monthly volume for the last N months.
 * Suitable for the main bar chart (6-month view).
 */
export function getMonthlyVolume(
  cases: Pick<Case, 'submitted_at'>[],
  months: number = 6
): { month: string; label: string; count: number }[] {
  const now = new Date()
  const result = []

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleString('default', { month: 'short', year: '2-digit' })
    const count = cases.filter(c => c.submitted_at.startsWith(month)).length
    result.push({ month, label, count })
  }

  return result
}

/**
 * Aggregates cases by product, sorted descending.
 */
export function getVolumeByProduct(cases: Pick<Case, 'product'>[]): LabeledCount[] {
  const counts: Record<string, number> = {}
  for (const c of cases) {
    const key = c.product ?? '(unknown)'
    counts[key] = (counts[key] ?? 0) + 1
  }
  const total = cases.length
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .map(([label, count]) => ({ label, count, pct: total ? Math.round(count / total * 1000) / 10 : 0 }))
}

/**
 * Aggregates cases by channel, sorted descending.
 */
export function getVolumeByChannel(cases: Pick<Case, 'channel'>[]): LabeledCount[] {
  const counts: Record<string, number> = {}
  for (const c of cases) {
    const key = c.channel ?? '(unknown)'
    counts[key] = (counts[key] ?? 0) + 1
  }
  const total = cases.length
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .map(([label, count]) => ({ label, count, pct: total ? Math.round(count / total * 1000) / 10 : 0 }))
}

/**
 * Aggregates cases by topic, sorted by volume descending.
 */
export function getTopicBreakdown(cases: Pick<Case, 'topic_category'>[]): LabeledCount[] {
  const counts: Record<string, number> = {}
  for (const c of cases) {
    const key = c.topic_category ?? '(uncategorized)'
    counts[key] = (counts[key] ?? 0) + 1
  }
  const total = cases.length
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .map(([label, count]) => ({ label, count, pct: total ? Math.round(count / total * 1000) / 10 : 0 }))
}
