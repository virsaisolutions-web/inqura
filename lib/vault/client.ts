import type { VaultAuthResponse, VaultQueryResponse } from './types'
import { createServiceClient } from '@/lib/supabase/server'

// In-memory session cache (serverless-safe: each invocation may be fresh,
// but caching avoids re-auth within the same warm function instance).
let cachedSession: { sessionId: string; expiresAt: number } | null = null

interface VaultConfig {
  vaultUrl: string
  username: string
  password: string
  apiVersion: string
}

/**
 * Loads Vault connection config from the tenants table, falling back to env vars.
 * DB config takes precedence — allows admin UI to update credentials without redeploy.
 */
async function getVaultConfig(): Promise<VaultConfig> {
  try {
    const supabase = await createServiceClient()
    const { data } = await supabase
      .from('tenants')
      .select('vault_url, vault_username, vault_password, vault_api_version')
      .limit(1)
      .maybeSingle()

    if (data?.vault_url && data?.vault_username && data?.vault_password) {
      return {
        vaultUrl: data.vault_url,
        username: data.vault_username,
        password: data.vault_password,
        apiVersion: data.vault_api_version ?? 'v24.1',
      }
    }
  } catch {
    // Fall through to env vars
  }

  // Env var fallback (for local dev / initial setup before admin configures via UI)
  const vaultUrl = process.env.VAULT_URL
  const username = process.env.VAULT_USERNAME
  const password = process.env.VAULT_PASSWORD

  if (!vaultUrl) throw new Error('Vault URL not configured. Set VAULT_URL or configure via Settings → Vault.')
  if (!username) throw new Error('Vault username not configured. Set VAULT_USERNAME or configure via Settings → Vault.')
  if (!password) throw new Error('Vault password not configured. Set VAULT_PASSWORD or configure via Settings → Vault.')

  return {
    vaultUrl,
    username,
    password,
    apiVersion: process.env.VAULT_API_VERSION ?? 'v24.1',
  }
}

/**
 * Authenticates with Vault and returns a session token.
 * Caches the session for up to 47 hours (Vault sessions last 48h).
 */
export async function getVaultSession(): Promise<string> {
  const now = Date.now()

  if (cachedSession && cachedSession.expiresAt > now) {
    return cachedSession.sessionId
  }

  const config = await getVaultConfig()

  const resp = await fetch(`${config.vaultUrl}/api/${config.apiVersion}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      username: config.username,
      password: config.password,
    }),
  })

  if (!resp.ok) {
    throw new Error(`Vault auth HTTP error: ${resp.status} ${resp.statusText}`)
  }

  const data: VaultAuthResponse = await resp.json()

  if (data.responseStatus !== 'SUCCESS' || !data.sessionId) {
    const msg = data.errors?.[0]?.message ?? 'Unknown Vault auth error'
    throw new Error(`Vault auth failed: ${msg}`)
  }

  cachedSession = {
    sessionId: data.sessionId,
    expiresAt: now + 47 * 60 * 60 * 1000,
  }

  return data.sessionId
}

/**
 * Invalidates the cached session (call on auth errors or after credential update).
 */
export function clearVaultSession() {
  cachedSession = null
}

/**
 * Typed GET wrapper for Vault REST API.
 */
export async function vaultGet<T>(path: string, sessionId: string): Promise<T> {
  const config = await getVaultConfig()

  const resp = await fetch(`${config.vaultUrl}${path}`, {
    headers: {
      Authorization: sessionId,
      Accept: 'application/json',
    },
  })

  if (resp.status === 401) {
    clearVaultSession()
    throw new Error('Vault session expired — will re-authenticate on next request')
  }

  if (!resp.ok) {
    throw new Error(`Vault API error: ${resp.status} ${resp.statusText} at ${path}`)
  }

  return resp.json() as Promise<T>
}

/**
 * Executes a VQL query and handles automatic pagination.
 * Returns ALL matching records across all pages.
 */
export async function vaultQuery<T>(
  vql: string,
  sessionId: string,
  options: { pageSize?: number } = {}
): Promise<T[]> {
  const config = await getVaultConfig()
  const pageSize = options.pageSize ?? 1000
  const results: T[] = []
  let pageOffset = 0
  let hasMore = true

  while (hasMore) {
    const params = new URLSearchParams({
      q: vql,
      pagesize: String(pageSize),
      pageoffset: String(pageOffset),
    })

    const resp = await fetch(`${config.vaultUrl}/api/${config.apiVersion}/query?${params}`, {
      headers: {
        Authorization: sessionId,
        Accept: 'application/json',
      },
    })

    if (resp.status === 401) {
      clearVaultSession()
      throw new Error('Vault session expired during paginated query')
    }

    if (!resp.ok) {
      throw new Error(`Vault VQL error: ${resp.status} ${resp.statusText}`)
    }

    const data: VaultQueryResponse<T> = await resp.json()

    if (data.responseStatus !== 'SUCCESS') {
      const msg = data.errors?.[0]?.message ?? 'VQL query failed'
      throw new Error(`Vault VQL failed: ${msg}`)
    }

    const page = data.data ?? []
    results.push(...page)

    const total = data.responseDetails?.total ?? 0
    pageOffset += pageSize
    hasMore = page.length === pageSize && results.length < total
  }

  return results
}
