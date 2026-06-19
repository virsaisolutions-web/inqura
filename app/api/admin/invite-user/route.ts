import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, writeAuditLog } from '@/lib/auth/require-session'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * POST /api/admin/invite-user
 * Sends a magic-link invite to a new user.
 * Body: { email, role? }
 */
export async function POST(req: NextRequest) {
  const { user, error } = await requireAdmin(req)
  if (error) return error

  const { email, role = 'user' } = await req.json() as { email: string; role?: string }

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
  }

  if (!['user', 'admin'].includes(role)) {
    return NextResponse.json({ error: 'role must be "user" or "admin"' }, { status: 400 })
  }

  const supabase = await createServiceClient()

  const { data, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { role },
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/auth/reset-password`,
  })

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 400 })
  }

  await writeAuditLog({
    userEmail: user.email,
    action: 'invited_user',
    resource: 'users',
    resourceId: data.user?.id,
  })

  return NextResponse.json({ ok: true, userId: data.user?.id })
}
