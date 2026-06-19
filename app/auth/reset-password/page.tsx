'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Supabase handles the token exchange from the URL hash automatically
    // We just need to wait for the session to be established
    const supabase = createClient()
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
  }, [])

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: '36px',
    padding: '0 12px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    background: 'var(--surface-2)',
    color: 'var(--text-1)',
    fontSize: '13px',
    outline: 'none',
    fontFamily: 'inherit',
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setError(null)
    setLoading(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) { setError(updateError.message); setLoading(false); return }
    router.push('/dashboard')
  }

  return (
    <div
      className="rounded-[12px] p-8 w-full max-w-sm mx-auto mt-20"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div className="mb-6 text-center">
        <div
          className="w-7 h-7 rounded-[7px] flex items-center justify-center mx-auto mb-3"
          style={{ background: 'var(--accent)' }}
        >
          <span className="text-white text-[11px] font-bold">IQ</span>
        </div>
        <h1 className="text-[16px] font-semibold" style={{ color: 'var(--text-1)' }}>
          Set new password
        </h1>
        <p className="text-[12px] mt-1" style={{ color: 'var(--text-4)' }}>
          {ready ? 'Choose a new password for your account.' : 'Validating reset link…'}
        </p>
      </div>

      {ready && (
        <form onSubmit={handleReset} className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.06em] mb-1.5" style={{ color: 'var(--text-4)' }}>
              New password
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.06em] mb-1.5" style={{ color: 'var(--text-4)' }}>
              Confirm password
            </label>
            <input
              type="password"
              required
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Repeat password"
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
            />
          </div>

          {error && (
            <div className="rounded-[8px] px-3 py-2.5 text-[12px]"
              style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger-text)' }}>
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Updating…' : 'Update password'}
          </Button>
        </form>
      )}
    </div>
  )
}
