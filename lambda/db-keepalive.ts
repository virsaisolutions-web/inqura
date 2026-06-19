import type { APIGatewayProxyHandlerV2 } from 'aws-lambda'
import { createClient } from '@supabase/supabase-js'

// Pings Supabase once a day so the free-tier DB doesn't pause
// after 7 days of inactivity.
export const handler: APIGatewayProxyHandlerV2 = async () => {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await supabase.from('sync_log').select('id').limit(1)

  if (error) {
    console.error('DB keep-alive failed:', error.message)
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) }
  }

  console.log('DB keep-alive: ok', new Date().toISOString())
  return { statusCode: 200, body: JSON.stringify({ ok: true }) }
}
