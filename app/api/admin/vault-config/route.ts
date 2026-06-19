import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, writeAuditLog } from '@/lib/auth/require-session'
import { createServiceClient } from '@/lib/supabase/server'
import { clearVaultSession } from '@/lib/vault/client'

/**
 * GET /api/admin/vault-config
 * Returns current Vault config with secrets masked.
 */
export async function GET(req: NextRequest) {
  const { error } = await requireAdmin(req)
  if (error) return error

  const supabase = await createServiceClient()
  const { data } = await supabase
    .from('tenants')
    .select('id, name, vault_url, vault_client_id, vault_username, vault_api_version, created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({ config: data ?? null })
}

/**
 * POST /api/admin/vault-config
 * Upserts Vault connection credentials into the tenants table.
 * vault_password and vault_client_secret are write-only — never returned to the browser.
 */
export async function POST(req: NextRequest) {
  const { user, error } = await requireAdmin(req)
  if (error) return error

  const body = await req.json() as {
    name?: string
    vault_url: string
    vault_username: string
    vault_password: string
    vault_client_id?: string
    vault_client_secret?: string
    vault_api_version?: string
  }

  const {
    name = 'Default',
    vault_url,
    vault_username,
    vault_password,
    vault_client_id = '',
    vault_client_secret = '',
    vault_api_version = 'v24.1',
  } = body

  if (!vault_url || !vault_username || !vault_password) {
    return NextResponse.json(
      { error: 'vault_url, vault_username, and vault_password are required' },
      { status: 400 }
    )
  }

  const supabase = await createServiceClient()
  const { data: existing } = await supabase
    .from('tenants')
    .select('id')
    .limit(1)
    .maybeSingle()

  const payload = {
    name,
    vault_url: vault_url.replace(/\/$/, ''),
    vault_client_id,
    vault_client_secret,
    vault_username,
    vault_password,
    vault_api_version,
  }

  const saveError = existing?.id
    ? (await supabase.from('tenants').update(payload).eq('id', existing.id)).error
    : (await supabase.from('tenants').insert(payload)).error

  if (saveError) {
    return NextResponse.json({ error: saveError.message }, { status: 500 })
  }

  // Invalidate cached Vault session so next sync re-authenticates with new creds
  clearVaultSession()

  await writeAuditLog({
    userEmail: user.email,
    action: 'updated_vault_config',
    resource: 'tenants',
  })

  return NextResponse.json({ ok: true })
}
