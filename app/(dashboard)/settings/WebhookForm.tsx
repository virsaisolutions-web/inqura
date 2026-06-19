'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { WebhookType } from '@/lib/notifications/webhooks'

interface Integration {
  type: WebhookType
  webhook_url_masked: string | null
  enabled: boolean
  label: string | null
}

interface Props {
  type: WebhookType
  label: string                 // display name e.g. "Slack"
  logo: React.ReactNode
  docsUrl: string
  placeholder: string
  existing: Integration | null
}

export function WebhookForm({ type, label, logo, docsUrl, placeholder, existing }: Props) {
  const [url, setUrl] = useState('')
  const [channelLabel, setChannelLabel] = useState(existing?.label ?? '')
  const [enabled, setEnabled] = useState(existing?.enabled ?? true)
  const [status, setStatus] = useState<'idle' | 'saving' | 'testing' | 'saved' | 'error' | 'test-ok' | 'test-fail'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const isConfigured = !!existing?.webhook_url_masked

  async function handleSave() {
    if (!url && !isConfigured) { setErrorMsg('Enter a webhook URL first'); return }
    if (url && !url.startsWith('https://')) { setErrorMsg('URL must start with https://'); return }

    setStatus('saving')
    setErrorMsg('')

    const resp = await fetch('/api/settings/integrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        webhook_url: url || existing?.webhook_url_masked, // server-side will keep existing if masked
        enabled,
        label: channelLabel || null,
      }),
    })

    if (resp.ok) {
      setStatus('saved')
      setUrl('')
      setTimeout(() => setStatus('idle'), 3000)
    } else {
      const data = await resp.json() as { error?: string }
      setErrorMsg(data.error ?? 'Save failed')
      setStatus('error')
    }
  }

  async function handleTest() {
    if (!url && !isConfigured) { setErrorMsg('Enter a webhook URL to test'); return }
    setStatus('testing')
    setErrorMsg('')

    // Send test using the URL in the input, or ask server to use existing saved one
    const resp = await fetch('/api/notifications/test-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, webhook_url: url || '__use_saved__' }),
    })

    const data = await resp.json() as { ok?: boolean; error?: string }
    if (data.ok) {
      setStatus('test-ok')
      setTimeout(() => setStatus('idle'), 3000)
    } else {
      setErrorMsg(data.error ?? 'Test failed — check the webhook URL')
      setStatus('test-fail')
    }
  }

  async function handleDelete() {
    if (!confirm(`Remove ${label} integration?`)) return
    await fetch('/api/settings/integrations', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    })
    window.location.reload()
  }

  const isBusy = status === 'saving' || status === 'testing'

  return (
    <div
      className="rounded-[12px] p-5 space-y-4"
      style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {logo}
          <div>
            <p className="text-[13px] font-semibold" style={{ color: 'var(--text-1)' }}>{label}</p>
            <p className="text-[11px]" style={{ color: 'var(--text-4)' }}>
              {isConfigured
                ? `Configured · ${existing?.webhook_url_masked}`
                : 'Not configured'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isConfigured && (
            <div className="flex items-center gap-2">
              {/* Enable / disable toggle */}
              <button
                className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-[6px] transition-colors"
                style={{
                  background: enabled ? 'var(--success-bg)' : 'var(--surface-2)',
                  border: `1px solid ${enabled ? 'var(--success-border)' : 'var(--border)'}`,
                  color: enabled ? 'var(--success-text)' : 'var(--text-4)',
                }}
                onClick={() => setEnabled(v => !v)}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: enabled ? 'var(--success-text)' : 'var(--text-4)' }}
                />
                {enabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          )}
          <a
            href={docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] underline underline-offset-2"
            style={{ color: 'var(--accent)' }}
          >
            Setup guide
          </a>
        </div>
      </div>

      {/* URL input */}
      <div className="space-y-2">
        <label className="label-caps" htmlFor={`${type}-url`}>
          {isConfigured ? 'Update webhook URL' : 'Webhook URL'}
        </label>
        <input
          id={`${type}-url`}
          type="url"
          value={url}
          onChange={e => { setUrl(e.target.value); setErrorMsg('') }}
          placeholder={isConfigured ? 'Paste new URL to replace existing…' : placeholder}
          className="w-full h-9 px-3 rounded-[8px] text-[13px]"
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            color: 'var(--text-1)',
            fontFamily: 'inherit',
            outline: 'none',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
          onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
        />

        {/* Optional label */}
        <input
          type="text"
          value={channelLabel}
          onChange={e => setChannelLabel(e.target.value)}
          placeholder={type === 'slack' ? 'Channel name (e.g. #med-affairs-alerts)' : 'Display label (optional)'}
          className="w-full h-8 px-3 rounded-[8px] text-[12px]"
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            color: 'var(--text-2)',
            fontFamily: 'inherit',
            outline: 'none',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
          onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
        />
      </div>

      {/* Error / success feedback */}
      {errorMsg && (
        <p
          className="text-[12px] rounded-[8px] px-3 py-2"
          style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger-text)' }}
        >
          {errorMsg}
        </p>
      )}
      {(status === 'saved') && (
        <p className="text-[12px]" style={{ color: 'var(--success-text)' }}>✓ Saved successfully</p>
      )}
      {(status === 'test-ok') && (
        <p className="text-[12px]" style={{ color: 'var(--success-text)' }}>✓ Test message sent — check your {label}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={isBusy}
        >
          {status === 'saving' ? 'Saving…' : isConfigured ? 'Update' : 'Save'}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleTest}
          disabled={isBusy || (!url && !isConfigured)}
          title={!url && !isConfigured ? 'Save a URL first' : `Send a test ${label} message`}
        >
          {status === 'testing' ? 'Sending…' : 'Send test'}
        </Button>

        {isConfigured && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={isBusy}
            className="ml-auto text-[12px]"
            style={{ color: 'var(--danger-text)' }}
          >
            Remove
          </Button>
        )}
      </div>
    </div>
  )
}
