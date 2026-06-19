'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[app-error]', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-lg">!</div>
      <div className="text-center">
        <h2 className="text-sm font-semibold text-slate-900 mb-1">Something went wrong</h2>
        <p className="text-xs text-slate-500 max-w-sm">
          {error.message || 'An unexpected error occurred. The team has been notified.'}
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={reset}>Try again</Button>
    </div>
  )
}
