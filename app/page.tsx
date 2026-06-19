import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Root route: authenticated users → dashboard, everyone else → landing page
export default async function RootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  } else {
    redirect('/landing/index.html')
  }
}
