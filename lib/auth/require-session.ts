import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export interface SessionUser {
  id: string
  email: string
}

/**
 * Validates that the incoming request has an authenticated Supabase session.
 * Returns the user or throws a 401 NextResponse suitable for returning from an API route.
 *
 * Usage in API route:
 *   const { user, error } = await requireSession(request)
 *   if (error) return error
 */
export async function requireSession(
  _request?: NextRequest
): Promise<{ user: SessionUser; error: null } | { user: null; error: NextResponse }> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      user: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  return {
    user: { id: user.id, email: user.email ?? '' },
    error: null,
  }
}

/**
 * Checks if the current session user has the admin role (user_metadata.role === 'admin').
 * Returns the user or a 403 NextResponse.
 *
 * Usage in API route:
 *   const { user, error } = await requireAdmin(request)
 *   if (error) return error
 */
export async function requireAdmin(
  _request?: NextRequest
): Promise<{ user: SessionUser; error: null } | { user: null; error: NextResponse }> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      user: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const role = user.user_metadata?.role
  if (role !== 'admin') {
    return {
      user: null,
      error: NextResponse.json({ error: 'Forbidden — admin access required' }, { status: 403 }),
    }
  }

  return {
    user: { id: user.id, email: user.email ?? '' },
    error: null,
  }
}

/**
 * Server-side check: is the current user an admin?
 * Use in Server Components / page.tsx. Returns boolean.
 */
export async function isAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.user_metadata?.role === 'admin'
}

/**
 * Writes an entry to the audit_log table. Fire-and-forget — never throws.
 */
export async function writeAuditLog(params: {
  tenantId?: string
  userEmail: string
  action: string
  resource?: string
  resourceId?: string
  ipAddress?: string
}) {
  try {
    const supabase = await createServiceClient()
    await supabase.from('audit_log').insert({
      tenant_id: params.tenantId ?? null,
      user_email: params.userEmail,
      action: params.action,
      resource: params.resource ?? null,
      resource_id: params.resourceId ?? null,
      ip_address: params.ipAddress ?? null,
    })
  } catch {
    // Non-blocking — audit log failure must not break the main flow
    console.error('[audit] Failed to write audit log:', params.action)
  }
}
