import { createClient } from '@/lib/supabase/server'
import { CasesTable } from '@/components/cases/CasesTable'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import type { Case } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; product?: string }>
}) {
  const { status, product } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('cases')
    .select('*')
    .order('submitted_at', { ascending: false })
    .limit(200)

  if (status) query = query.eq('status', status)
  if (product) query = query.eq('product', product)

  const { data, count } = await query

  const cases = (data ?? []) as Case[]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Case Queue</CardTitle>
        <CardDescription>
          {cases.length} cases
          {status ? ` · Status: ${status}` : ''}
          {product ? ` · Product: ${product}` : ''}
          {' '}· Read-only view — case management happens in Vault
        </CardDescription>
      </CardHeader>
      <CardContent>
        <CasesTable cases={cases} />
      </CardContent>
    </Card>
  )
}
