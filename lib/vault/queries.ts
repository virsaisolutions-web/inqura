import { vaultQuery } from './client'
import type { VaultCase } from './types'

const CASE_FIELDS = `
  id, name, status__v, product__v, topic__v,
  channel__v, submitted_date__v, assigned_date__v,
  response_date__v, priority__v, is_off_label__v,
  hcp_specialty__v, institution__v, country__v, modified_date__v
`.trim().replace(/\s+/g, ' ')

/**
 * Fetch all non-closed cases (used for full sync or when no last sync time).
 */
export async function getOpenCases(sessionId: string): Promise<VaultCase[]> {
  const vql = `
    SELECT ${CASE_FIELDS}
    FROM medicalinquiry__v
    WHERE status__v != 'closed__v'
    ORDER BY submitted_date__v DESC
  `.trim()

  return vaultQuery<VaultCase>(vql, sessionId)
}

/**
 * Incremental fetch — cases modified since `since`.
 */
export async function getCasesSince(sessionId: string, since: Date): Promise<VaultCase[]> {
  const isoDate = since.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '')

  const vql = `
    SELECT ${CASE_FIELDS}
    FROM medicalinquiry__v
    WHERE modified_date__v >= '${isoDate}'
    ORDER BY modified_date__v DESC
  `.trim()

  return vaultQuery<VaultCase>(vql, sessionId)
}

/**
 * Fetch fulfilled cases in a date range (for SLA compliance reporting).
 */
export async function getFulfilledCasesInRange(
  sessionId: string,
  startDate: Date,
  endDate: Date
): Promise<VaultCase[]> {
  const start = startDate.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '')
  const end = endDate.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '')

  const vql = `
    SELECT ${CASE_FIELDS}
    FROM medicalinquiry__v
    WHERE response_date__v != null
      AND submitted_date__v >= '${start}'
      AND submitted_date__v <= '${end}'
    ORDER BY submitted_date__v DESC
  `.trim()

  return vaultQuery<VaultCase>(vql, sessionId)
}

/**
 * Connectivity test — fetches a single record to verify access.
 */
export async function testConnection(sessionId: string): Promise<{ connected: boolean; caseCount?: number }> {
  try {
    const vql = 'SELECT id FROM medicalinquiry__v LIMIT 1'
    await vaultQuery<{ id: string }>(vql, sessionId)
    return { connected: true }
  } catch (err) {
    console.error('[vault] Connection test failed:', err)
    return { connected: false }
  }
}
