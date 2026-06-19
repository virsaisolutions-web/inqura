'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body className="bg-slate-50 flex items-center justify-center min-h-screen">
        <div className="text-center p-8">
          <h1 className="text-lg font-semibold text-slate-900 mb-2">Inqura encountered an error</h1>
          <p className="text-sm text-slate-500 mb-4">{error.message}</p>
          <button
            onClick={reset}
            className="px-4 py-2 text-sm bg-teal-600 text-white rounded-md hover:bg-teal-700"
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  )
}
