'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface SettingsActionsProps {
  action: 'sync' | 'test-slack' | 'invite'
}

export function SettingsActions({ action }: SettingsActionsProps) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)

  async function handleSync() {
    setLoading(true)
    setResult(null)
    try {
      const r = await fetch('/api/vault/sync', { method: 'POST' })
      const d = await r.json()
      if (r.ok) {
        setResult({ ok: true, msg: `Sync complete — ${d.synced ?? 0} cases, ${d.alerts ?? 0} alerts (${d.duration ?? '?'}ms)` })
      } else {
        setResult({ ok: false, msg: d.error ?? 'Sync failed' })
      }
    } catch {
      setResult({ ok: false, msg: 'Network error' })
    } finally {
      setLoading(false)
    }
  }

  async function handleTestSlack() {
    setLoading(true)
    setResult(null)
    try {
      const r = await fetch('/api/notifications/test-slack', { method: 'POST' })
      if (r.ok) {
        setResult({ ok: true, msg: 'Test message sent to Slack' })
      } else {
        setResult({ ok: false, msg: 'Slack webhook not configured or unreachable' })
      }
    } catch {
      setResult({ ok: false, msg: 'Network error' })
    } finally {
      setLoading(false)
    }
  }

  async function handleInvite() {
    const email = window.prompt('Enter email address to invite:')
    if (!email?.trim()) return
    setLoading(true)
    setResult(null)
    try {
      const r = await fetch('/api/auth/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const d = await r.json()
      if (r.ok) {
        setResult({ ok: true, msg: `Magic link sent to ${email}` })
      } else {
        setResult({ ok: false, msg: d.error ?? 'Failed to send invite' })
      }
    } catch {
      setResult({ ok: false, msg: 'Network error' })
    } finally {
      setLoading(false)
    }
  }

  const handlers = { sync: handleSync, 'test-slack': handleTestSlack, invite: handleInvite }
  const labels = { sync: 'Trigger Sync Now', 'test-slack': 'Test Slack Webhook', invite: 'Invite User' }
  const variants: Record<string, 'default' | 'outline'> = { sync: 'default', 'test-slack': 'outline', invite: 'outline' }

  return (
    <div className="space-y-2">
      <Button
        variant={variants[action]}
        size="sm"
        onClick={handlers[action]}
        disabled={loading}
      >
        {loading ? 'Working…' : labels[action]}
      </Button>
      {result && (
        <p className={`text-xs ${result.ok ? 'text-teal-600' : 'text-red-600'}`}>
          {result.msg}
        </p>
      )}
    </div>
  )
}
