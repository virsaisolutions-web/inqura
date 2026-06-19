'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface UserRow {
  id: string
  email: string
  role: string
  lastSignIn: string | null
  isSelf: boolean
}

interface Props {
  users: UserRow[]
}

export function UserManagement({ users: initialUsers }: Props) {
  const [users, setUsers] = useState<UserRow[]>(initialUsers)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'user' | 'admin'>('user')
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [inviteMsg, setInviteMsg] = useState('')
  const [actionUser, setActionUser] = useState<string | null>(null)

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail) return
    setInviteStatus('sending')
    setInviteMsg('')

    const resp = await fetch('/api/admin/invite-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    })
    const data = await resp.json() as { ok?: boolean; error?: string }
    if (data.ok) {
      setInviteStatus('sent')
      setInviteMsg(`Invite sent to ${inviteEmail}`)
      setInviteEmail('')
    } else {
      setInviteStatus('error')
      setInviteMsg(data.error ?? 'Invite failed')
    }
  }

  async function handleRoleChange(userId: string, newRole: 'user' | 'admin') {
    setActionUser(userId)
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role: newRole }),
    })
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
    setActionUser(null)
  }

  async function handleRevoke(userId: string) {
    if (!confirm('Remove this user\'s access? They will be immediately signed out.')) return
    setActionUser(userId)
    await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    setUsers(prev => prev.filter(u => u.id !== userId))
    setActionUser(null)
  }

  const inputStyle: React.CSSProperties = {
    height: '36px',
    padding: '0 12px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    background: 'var(--surface-2)',
    color: 'var(--text-1)',
    fontSize: '13px',
    outline: 'none',
    fontFamily: 'inherit',
    flex: 1,
  }

  return (
    <div className="space-y-5">
      {/* User list */}
      <div>
        {users.length === 0 ? (
          <p className="text-[12px]" style={{ color: 'var(--text-4)' }}>No users yet.</p>
        ) : (
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['User', 'Role', 'Last sign-in', ''].map(h => (
                  <th key={h} className="text-left pb-2.5 pr-4 label-caps">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--border-2)' }}>
                  <td className="py-2.5 pr-4">
                    <p className="text-[13px]" style={{ color: 'var(--text-2)' }}>{u.email}</p>
                    {u.isSelf && <p className="text-[11px]" style={{ color: 'var(--text-4)' }}>You</p>}
                  </td>
                  <td className="py-2.5 pr-4">
                    {u.isSelf ? (
                      <Badge variant={u.role === 'admin' ? 'default' : 'outline'}>{u.role}</Badge>
                    ) : (
                      <select
                        value={u.role}
                        disabled={actionUser === u.id}
                        onChange={e => handleRoleChange(u.id, e.target.value as 'user' | 'admin')}
                        className="text-[12px] rounded-[6px] px-2 py-1"
                        style={{
                          border: '1px solid var(--border)',
                          background: 'var(--surface-2)',
                          color: 'var(--text-2)',
                          cursor: 'pointer',
                        }}
                      >
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                      </select>
                    )}
                  </td>
                  <td className="py-2.5 pr-4 text-[12px]" style={{ color: 'var(--text-4)' }}>
                    {u.lastSignIn ? new Date(u.lastSignIn).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="py-2.5 text-right">
                    {!u.isSelf && (
                      <button
                        onClick={() => handleRevoke(u.id)}
                        disabled={actionUser === u.id}
                        className="text-[11px] underline underline-offset-2"
                        style={{ color: 'var(--danger-text)' }}
                      >
                        {actionUser === u.id ? 'Removing…' : 'Revoke'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Invite form */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
        <p className="label-caps mb-3">Invite new user</p>
        <form onSubmit={handleInvite}>
          <div className="flex gap-2 items-center">
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="colleague@company.com"
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
            />
            <select
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value as 'user' | 'admin')}
              className="h-9 px-2 rounded-[8px] text-[12px]"
              style={{
                border: '1px solid var(--border)',
                background: 'var(--surface-2)',
                color: 'var(--text-2)',
                flexShrink: 0,
              }}
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            <Button type="submit" size="sm" disabled={inviteStatus === 'sending'} style={{ flexShrink: 0 }}>
              {inviteStatus === 'sending' ? 'Sending…' : 'Send invite'}
            </Button>
          </div>
        </form>

        {inviteMsg && (
          <p
            className="mt-2 text-[12px] rounded-[8px] px-3 py-2"
            style={
              inviteStatus === 'sent'
                ? { background: 'var(--success-bg)', border: '1px solid var(--success-border)', color: 'var(--success-text)' }
                : { background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger-text)' }
            }
          >
            {inviteMsg}
          </p>
        )}
        <p className="mt-2 text-[11px]" style={{ color: 'var(--text-4)' }}>
          They'll receive a magic link to set their password. Only invited emails can sign in.
        </p>
      </div>
    </div>
  )
}
