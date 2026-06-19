import type { APIGatewayProxyHandlerV2 } from 'aws-lambda'
import { createClient } from '@supabase/supabase-js'
import { refreshMetricsDaily } from '../lib/metrics/metrics'

// Invoked by EventBridge nightly at 2am UTC
export const handler: APIGatewayProxyHandlerV2 = async () => {
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

  if (!tenant) {
    return { statusCode: 500, body: JSON.stringify({ error: 'No tenant' }) }
  }

  const today = new Date()
  await refreshMetricsDaily(tenant.id, today)

  return { statusCode: 200, body: JSON.stringify({ ok: true, date: today }) }
}
