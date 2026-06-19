import type { APIGatewayProxyHandlerV2 } from 'aws-lambda'
import { syncCases } from '../lib/vault/sync'

// Invoked by:
//   a) EventBridge cron (every 1h) — event has no body
//   b) Manual trigger from Vercel UI — POST with { secret } in body
//   c) Function URL called directly (same as b)

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  // Validate secret when called manually (not from EventBridge)
  const isEventBridge = !event.requestContext   // cron events have no requestContext
  if (!isEventBridge) {
    const body = event.body ? JSON.parse(event.body) : {}
    if (body.secret !== process.env.CRON_SECRET) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) }
    }
  }

  const start = Date.now()
  try {
    // Tenant ID — Phase 1 single tenant, read from DB
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (!tenant) throw new Error('No tenant found')

    const result = await syncCases(tenant.id)
    const duration = Date.now() - start

    return {
      statusCode: 200,
      body: JSON.stringify({ ...result, duration }),
    }
  } catch (err) {
    console.error('Vault sync failed:', err)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: String(err), duration: Date.now() - start }),
    }
  }
}
