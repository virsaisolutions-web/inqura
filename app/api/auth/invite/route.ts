import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/require-session'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const { error } = await requireSession(request)
  if (error) return error

  const body = await request.json()
  const email = body?.email?.trim()
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  }

  const supabase = await createServiceClient()

  // Invite via magic link — user receives email to set password
  const { data, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/dashboard`,
  })

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, userId: data.user?.id })
}
