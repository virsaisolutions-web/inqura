import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { testWebhook, getWebhook } from '@/lib/notifications/webhooks'
import type { WebhookType } from '@/lib/notifications/webhooks'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { type?: WebhookType; webhook_url?: string }
  const { type = 'slack', webhook_url: rawUrl } = body

  let webhookUrl = rawUrl

  // '__use_saved__' sentinel: client wants to test the already-stored webhook
  if (rawUrl === '__use_saved__') {
    const saved = await getWebhook(type)
    if (!saved?.webhook_url) {
      return NextResponse.json({ error: 'No saved webhook found for this type' }, { status: 400 })
    }
    webhookUrl = saved.webhook_url
  }

  if (!webhookUrl) {
    return NextResponse.json({ error: 'webhook_url is required' }, { status: 400 })
  }

  const result = await testWebhook(type, webhookUrl)

  return NextResponse.json(result, { status: result.ok ? 200 : 502 })
}
