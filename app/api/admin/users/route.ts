import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, writeAuditLog } from '@/lib/auth/require-session'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * DELETE /api/admin/users
 * Deletes (revokes access for) a user by ID.
 * Body: { userId }
 */
export async function DELETE(req: NextRequest) {
  const { user, error } = await requireAdmin(req)
  if (error) return error

  const { userId } = await req.json() as { userId: string }

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }

  // Prevent self-deletion
  if (userId === user.id) {
    return NextResponse.json({ error: 'You cannot remove your own account' }, { status: 400 })
  }

  const supabase = await createServiceClient()
  const { error: deleteError } = await supabase.auth.admin.deleteUser(userId)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 })
  }

  await writeAuditLog({
    userEmail: user.email,
    action: 'deleted_user',
    resource: 'users',
    resourceId: userId,
  })

  return NextResponse.json({ ok: true })
}

/**
 * PATCH /api/admin/users
 * Updates a user's role via user_metadata.
 * Body: { userId, role }
 */
export async function PATCH(req: NextRequest) {
  const { user, error } = await requireAdmin(req)
  if (error) return error

  const { userId, role } = await req.json() as { userId: string; role: string }

  if (!userId || !role) {
    return NextResponse.json({ error: 'userId and role are required' }, { status: 400 })
  }

  if (!['user', 'admin'].includes(role)) {
    return NextResponse.json({ error: 'role must be "user" or "admin"' }, { status: 400 })
  }

  const supabase = await createServiceClient()
  const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
    user_metadata: { role },
  })

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 })
  }

  await writeAuditLog({
    userEmail: user.email,
    action: 'updated_user_role',
    resource: 'users',
    resourceId: userId,
  })

  return NextResponse.json({ ok: true })
}
