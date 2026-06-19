'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

type Mode = 'login' | 'forgot'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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
    transition: 'border-color 150ms',
    fontFamily: 'inherit',
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      // Normalize Supabase error messages — don't expose "email not found" vs "wrong password"
      setError('Invalid email or password.')
      setLoading(false)
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const supabase = createClient()
    // Always show the same message regardless of whether email exists — no user enumeration
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    setInfo("If that email is registered, you'll receive a reset link shortly.")
    setLoading(false)
  }

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setInfo(null)
    setPassword('')
  }

  return (
    <>
      {/* Theme toggle — top-right of viewport */}
      <div className="fixed top-4 right-4">
        <ThemeToggle />
      </div>

    <div
      className="rounded-[12px] p-8"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
      }}
    >
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2.5 mb-2">
          <div
            className="w-7 h-7 rounded-[7px] flex items-center justify-center"
            style={{ background: 'var(--accent)' }}
          >
            <span className="text-white text-[11px] font-bold tracking-tight">IQ</span>
          </div>
          <span className="text-[18px] font-semibold" style={{ color: 'var(--text-1)' }}>
            Inqura
          </span>
        </div>
        <p className="text-[12px]" style={{ color: 'var(--text-4)' }}>
          {mode === 'login' ? 'Medical Affairs Intelligence' : 'Reset your password'}
        </p>
      </div>

      {/* ── Login form ── */}
      {mode === 'login' && (
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-[11px] font-semibold uppercase tracking-[0.06em] mb-1.5"
              style={{ color: 'var(--text-4)' }}
            >
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com"
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="password"
                className="block text-[11px] font-semibold uppercase tracking-[0.06em]"
                style={{ color: 'var(--text-4)' }}
              >
                Password
              </label>
              <button
                type="button"
                onClick={() => switchMode('forgot')}
                className="text-[11px] underline underline-offset-2"
                style={{ color: 'var(--accent)' }}
              >
                Forgot password?
              </button>
            </div>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
            />
          </div>

          {error && (
            <div
              className="rounded-[8px] px-3 py-2.5 text-[12px]"
              style={{
                background: 'var(--danger-bg)',
                border: '1px solid var(--danger-border)',
                color: 'var(--danger-text)',
              }}
            >
              {error}
            </div>
          )}

          <Button type="submit" className="w-full mt-2" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      )}

      {/* ── Forgot password form ── */}
      {mode === 'forgot' && (
        <form onSubmit={handleForgotPassword} className="space-y-4">
          <div>
            <label
              htmlFor="reset-email"
              className="block text-[11px] font-semibold uppercase tracking-[0.06em] mb-1.5"
              style={{ color: 'var(--text-4)' }}
            >
              Email address
            </label>
            <input
              id="reset-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com"
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
            />
          </div>

          {error && (
            <div
              className="rounded-[8px] px-3 py-2.5 text-[12px]"
              style={{
                background: 'var(--danger-bg)',
                border: '1px solid var(--danger-border)',
                color: 'var(--danger-text)',
              }}
            >
              {error}
            </div>
          )}

          {info && (
            <div
              className="rounded-[8px] px-3 py-2.5 text-[12px]"
              style={{
                background: 'var(--success-bg)',
                border: '1px solid var(--success-border)',
                color: 'var(--success-text)',
              }}
            >
              {info}
            </div>
          )}

          {!info && (
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Sending…' : 'Send reset link'}
            </Button>
          )}

          <button
            type="button"
            onClick={() => switchMode('login')}
            className="w-full text-[12px] text-center underline underline-offset-2"
            style={{ color: 'var(--text-4)' }}
          >
            Back to sign in
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-[11px]" style={{ color: 'var(--text-4)' }}>
        Access is managed by your VirsAI administrator.
      </p>
    </div>
    </>
  )
}
