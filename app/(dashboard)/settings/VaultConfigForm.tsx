'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface ExistingConfig {
  name: string
  vault_url: string
  vault_client_id: string
  vault_username: string | null
  vault_api_version: string | null
}

interface Props {
  existing: ExistingConfig | null
}

type Status = 'idle' | 'testing' | 'test-ok' | 'test-fail' | 'saving' | 'saved' | 'error'

export function VaultConfigForm({ existing }: Props) {
  const [name, setName] = useState(existing?.name ?? '')
  const [vaultUrl, setVaultUrl] = useState(existing?.vault_url ?? '')
  const [username, setUsername] = useState(existing?.vault_username ?? '')
  const [password, setPassword] = useState('')
  const [clientId, setClientId] = useState(existing?.vault_client_id ?? '')
  const [clientSecret, setClientSecret] = useState('')
  const [apiVersion, setApiVersion] = useState(existing?.vault_api_version ?? 'v24.1')
  const [status, setStatus] = useState<Status>('idle')
  const [msg, setMsg] = useState('')

  const isConfigured = !!existing?.vault_url

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

  async function handleTest() {
    if (!vaultUrl || !username || (!password && !isConfigured)) {
      setMsg('Enter Vault URL, username, and password first')
      setStatus('test-fail')
      return
    }
    setStatus('testing')
    setMsg('')
    const resp = await fetch('/api/admin/vault-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vault_url: vaultUrl, username, password, api_version: apiVersion }),
    })
    const data = await resp.json() as { ok?: boolean; error?: string }
    if (data.ok) {
      setStatus('test-ok')
      setMsg('Connection successful')
    } else {
      setStatus('test-fail')
      setMsg(data.error ?? 'Connection failed')
    }
  }

  async function handleSave() {
    if (!vaultUrl || !username) {
      setMsg('Vault URL and username are required')
      setStatus('error')
      return
    }
    if (!password && !isConfigured) {
      setMsg('Password is required for initial setup')
      setStatus('error')
      return
    }
    setStatus('saving')
    setMsg('')
    const resp = await fetch('/api/admin/vault-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name || 'Default',
        vault_url: vaultUrl,
        vault_username: username,
        vault_password: password,
        vault_client_id: clientId,
        vault_client_secret: clientSecret,
        vault_api_version: apiVersion,
      }),
    })
    const data = await resp.json() as { ok?: boolean; error?: string }
    if (data.ok) {
      setStatus('saved')
      setMsg('Vault configuration saved')
      setPassword('')
      setClientSecret('')
      setTimeout(() => setStatus('idle'), 3000)
    } else {
      setStatus('error')
      setMsg(data.error ?? 'Save failed')
    }
  }

  const isBusy = status === 'testing' || status === 'saving'

  return (
    <div className="space-y-4">
      {isConfigured && (
        <div
          className="rounded-[8px] px-3 py-2.5 text-[12px] flex items-center gap-2"
          style={{ background: 'var(--success-bg)', border: '1px solid var(--success-border)', color: 'var(--success-text)' }}
        >
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--success-text)' }} />
          Vault configured — {existing?.vault_url}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label-caps block mb-1.5">Organisation name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Arcturus Pharma"
            style={inputStyle}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
          />
        </div>
        <div>
          <label className="label-caps block mb-1.5">API version</label>
          <input
            type="text"
            value={apiVersion}
            onChange={e => setApiVersion(e.target.value)}
            placeholder="v24.1"
            style={inputStyle}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
          />
        </div>
      </div>

      <div>
        <label className="label-caps block mb-1.5">Vault URL</label>
        <input
          type="url"
          value={vaultUrl}
          onChange={e => setVaultUrl(e.target.value)}
          placeholder="https://company.veevavault.com"
          style={inputStyle}
          onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
          onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label-caps block mb-1.5">Username</label>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="inqura-integration@company.com"
            autoComplete="username"
            style={inputStyle}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
          />
        </div>
        <div>
          <label className="label-caps block mb-1.5">
            Password {isConfigured && <span style={{ color: 'var(--text-4)' }}>(leave blank to keep existing)</span>}
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder={isConfigured ? '••••••••' : 'Integration account password'}
            autoComplete="new-password"
            style={inputStyle}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
          />
        </div>
      </div>

      <div
        className="rounded-[8px] p-3 space-y-3"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)' }}
      >
        <p className="text-[11px]" style={{ color: 'var(--text-4)' }}>
          OAuth credentials (optional — for future OAuth flow)
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label-caps block mb-1.5">Client ID</label>
            <input
              type="text"
              value={clientId}
              onChange={e => setClientId(e.target.value)}
              placeholder="Optional"
              style={{ ...inputStyle, fontSize: '12px' }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
            />
          </div>
          <div>
            <label className="label-caps block mb-1.5">Client secret</label>
            <input
              type="password"
              value={clientSecret}
              onChange={e => setClientSecret(e.target.value)}
              placeholder={isConfigured ? '•••• (saved)' : 'Optional'}
              autoComplete="new-password"
              style={{ ...inputStyle, fontSize: '12px' }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
            />
          </div>
        </div>
      </div>

      {msg && (
        <p
          className="text-[12px] rounded-[8px] px-3 py-2"
          style={
            status === 'test-ok' || status === 'saved'
              ? { background: 'var(--success-bg)', border: '1px solid var(--success-border)', color: 'var(--success-text)' }
              : { background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger-text)' }
          }
        >
          {status === 'test-ok' ? '✓ ' : status === 'saved' ? '✓ ' : '✗ '}{msg}
        </p>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Button onClick={handleSave} size="sm" disabled={isBusy}>
          {status === 'saving' ? 'Saving…' : isConfigured ? 'Update' : 'Save'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleTest}
          disabled={isBusy || (!vaultUrl || !username || (!password && !isConfigured))}
          title="Tests connection before saving"
        >
          {status === 'testing' ? 'Testing…' : 'Test connection'}
        </Button>
      </div>
    </div>
  )
}
