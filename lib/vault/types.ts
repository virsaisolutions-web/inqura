// Veeva Vault API type definitions
// Field names follow Vault's naming convention: field_name__v for Vault-native fields.
// If a sandbox field name differs from the spec, document the mapping in a comment here.

export interface VaultSession {
  sessionId: string
  userId: string
  vaultId: number
  vaultName?: string
}

export interface VaultAuthResponse {
  responseStatus: 'SUCCESS' | 'FAILURE'
  sessionId?: string
  userId?: string
  vaultId?: number
  vaultName?: string
  errors?: Array<{ type: string; message: string }>
}

/**
 * MedInquiry case as returned by VQL.
 * Field names are Vault-native (__v suffix).
 * NOTE: If sandbox field names differ, add an alias comment below.
 */
export interface VaultCase {
  id: string                        // Vault document/object ID
  name: string                      // Case number / display name
  status__v: string                 // open | in_review | fulfilled | closed (raw Vault value)
  product__v: string | null
  topic__v: string | null           // topic_category
  channel__v: string | null         // email | crm_field | phone | web
  submitted_date__v: string | null  // ISO datetime string
  assigned_date__v: string | null
  response_date__v: string | null   // fulfilled_at equivalent
  priority__v: string | null        // standard | urgent | critical
  is_off_label__v: boolean | null
  hcp_specialty__v: string | null   // specialty category only — NO name stored
  institution__v: string | null     // institution name only
  country__v: string | null
  modified_date__v: string | null
}

export interface VaultQueryResponse<T> {
  responseStatus: 'SUCCESS' | 'FAILURE'
  responseDetails?: {
    total: number
    pagesize: number
    pageoffset: number
    size: number
    object?: Record<string, unknown>
  }
  data?: T[]
  errors?: Array<{ type: string; message: string }>
}

export interface VaultPaginatedResult<T> {
  records: T[]
  total: number
}

// Status mapping: Vault value → Inqura normalized value
export const VAULT_STATUS_MAP: Record<string, string> = {
  'open__v':       'open',
  'in_review__v':  'in_review',
  'fulfilled__v':  'fulfilled',
  'closed__v':     'closed',
}

export const VAULT_CHANNEL_MAP: Record<string, string> = {
  'email__v':     'email',
  'crm__v':       'crm',
  'phone__v':     'phone',
  'web__v':       'web',
  'field__v':     'crm',        // field rep = CRM-originated
}

export const VAULT_PRIORITY_MAP: Record<string, string> = {
  'standard__v':  'standard',
  'urgent__v':    'urgent',
  'critical__v':  'critical',
}
