import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createServiceClient()
    const { count, error } = await supabase
      .from('sync_log')
      .select('*', { count: 'exact', head: true })

    if (error) {
      return NextResponse.json(
        { status: 'error', db: 'error', detail: error.message, timestamp: new Date().toISOString() },
        { status: 500 }
      )
    }

    return NextResponse.json({
      status: 'ok',
      db: 'connected',
      sync_log_rows: count ?? 0,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json(
      { status: 'error', db: 'unreachable', detail: String(err), timestamp: new Date().toISOString() },
      { status: 503 }
    )
  }
}
