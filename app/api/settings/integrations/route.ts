import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { WebhookType } from '@/lib/notifications/webhooks'

/** GET — fetch all integrations for the settings page */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = await createServiceClient()
  const { data, error } = await serviceClient
    .from('integrations')
    .select('id, type, webhook_url, enabled, label')
    .order('type')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Mask the webhook URL — only show last 12 chars so customer can see it's set without exposing the full secret
  const masked = (data ?? []).map(row => ({
    ...row,
    webhook_url_masked: row.webhook_url
      ? `••••••••${row.webhook_url.slice(-12)}`
      : null,
    webhook_url: undefined, // never return raw URL to browser
  }))

  return NextResponse.json({ integrations: masked })
}

/** POST — create or update an integration */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    type: WebhookType
    webhook_url: string
    enabled: boolean
    label?: string
  }

  const { type, webhook_url, enabled, label } = body

  if (!type || !['slack', 'teams', 'custom'].includes(type)) {
    return NextResponse.json({ error: 'Invalid type. Must be slack, teams, or custom.' }, { status: 400 })
  }

  if (!webhook_url || !webhook_url.startsWith('https://')) {
    return NextResponse.json({ error: 'webhook_url must be a valid https URL' }, { status: 400 })
  }

  const serviceClient = await createServiceClient()
  const { error } = await serviceClient
    .from('integrations')
    .upsert(
      { type, webhook_url, enabled: enabled ?? true, label: label ?? null },
      { onConflict: 'tenant_id,type' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Audit log
  await serviceClient.from('audit_log').insert({
    user_email: user.email,
    action: 'saved_integration',
    resource: 'integrations',
    resource_id: type,
  })

  return NextResponse.json({ ok: true })
}

/** DELETE — remove an integration */
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { type } = await req.json() as { type: WebhookType }

  if (!type) return NextResponse.json({ error: 'type required' }, { status: 400 })

  const serviceClient = await createServiceClient()
  await serviceClient.from('integrations').delete().eq('type', type)

  await serviceClient.from('audit_log').insert({
    user_email: user.email,
    action: 'deleted_integration',
    resource: 'integrations',
    resource_id: type,
  })

  return NextResponse.json({ ok: true })
}
