'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, ShieldCheck, FileText, BarChart3,
  Settings, LogOut, RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { AlertBell } from '@/components/alerts/AlertBell'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { useEffect, useState } from 'react'

const NAV = [
  { href: '/dashboard',         label: 'Overview',    icon: LayoutDashboard },
  { href: '/dashboard/sla',     label: 'SLA Monitor', icon: ShieldCheck },
  { href: '/dashboard/cases',   label: 'Cases',       icon: FileText },
  { href: '/dashboard/reports', label: 'Reports',     icon: BarChart3 },
]

interface Props {
  children: React.ReactNode
  userEmail: string
}

export function DashboardShell({ children, userEmail }: Props) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: 'var(--bg)' }}
    >
      {/* ── Sidebar ── */}
      <aside
        className="w-[200px] flex-shrink-0 flex flex-col"
        style={{
          background: 'var(--surface)',
          borderRight: '1px solid var(--border)',
        }}
      >
        {/* Wordmark */}
        <div
          className="h-[52px] flex items-center gap-2.5 px-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div
            className="w-[22px] h-[22px] rounded-[6px] flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--accent)' }}
          >
            <span className="text-white text-[9px] font-bold tracking-tight">IQ</span>
          </div>
          <span className="text-[13px] font-semibold" style={{ color: 'var(--text-1)' }}>
            Inqura
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'relative flex items-center gap-2.5 px-3 py-2 rounded-[8px] text-[13px] transition-colors group',
                  active ? 'font-medium' : 'font-normal'
                )}
                style={{
                  background: active ? 'var(--surface-2)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--text-3)',
                }}
              >
                {/* 3px left accent marker */}
                {active && (
                  <span
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full"
                    style={{ background: 'var(--accent)' }}
                  />
                )}
                <Icon className="w-4 h-4 flex-shrink-0" aria-hidden />
                {label}
              </Link>
            )
          })}

          <div className="pt-2 mt-1" style={{ borderTop: '1px solid var(--border)' }}>
            <Link
              href="/dashboard/settings"
              className={cn(
                'relative flex items-center gap-2.5 px-3 py-2 rounded-[8px] text-[13px] transition-colors',
                pathname === '/dashboard/settings' ? 'font-medium' : 'font-normal'
              )}
              style={{
                background: pathname === '/dashboard/settings' ? 'var(--surface-2)' : 'transparent',
                color: pathname === '/dashboard/settings' ? 'var(--accent)' : 'var(--text-3)',
              }}
            >
              {pathname === '/dashboard/settings' && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full"
                  style={{ background: 'var(--accent)' }}
                />
              )}
              <Settings className="w-4 h-4 flex-shrink-0" aria-hidden />
              Settings
            </Link>
          </div>
        </nav>

        {/* User footer */}
        <div
          className="px-3 py-3 flex-shrink-0"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-2 mb-2.5">
            <div
              className="w-[24px] h-[24px] rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-semibold uppercase"
              style={{ background: 'var(--accent-tint)', color: 'var(--accent-text)' }}
            >
              {userEmail.charAt(0)}
            </div>
            <span className="text-[11px] truncate flex-1" style={{ color: 'var(--text-4)' }}>
              {userEmail}
            </span>
          </div>
          <SyncStatus />
          <button
            onClick={handleSignOut}
            className="mt-1 flex items-center gap-2 w-full px-2 py-1.5 rounded-[6px] text-[12px] transition-colors"
            style={{ color: 'var(--text-4)' }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--surface-2)'
              e.currentTarget.style.color = 'var(--text-2)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--text-4)'
            }}
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header
          className="h-[52px] flex items-center justify-between px-6 flex-shrink-0"
          style={{
            background: 'var(--surface)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <h1 className="text-[14px] font-semibold" style={{ color: 'var(--text-1)' }}>
            {NAV.find(n => pathname === n.href || (n.href !== '/dashboard' && pathname.startsWith(n.href)))?.label
              ?? (pathname === '/dashboard/settings' ? 'Settings' : 'Dashboard')}
          </h1>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <AlertBell />
            <ManualSyncButton />
          </div>
        </header>

        {/* Page */}
        <main
          className="flex-1 overflow-y-auto p-6"
          style={{ background: 'var(--bg)' }}
        >
          {children}
        </main>
      </div>
    </div>
  )
}

/* ── Sync Status ── */
interface SyncInfo {
  status: string
  completed_at: string | null
  error_msg: string | null
}

function SyncStatus() {
  const [sync, setSync] = useState<SyncInfo | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('sync_log')
      .select('status, completed_at, error_msg')
      .order('started_at', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => { if (data) setSync(data as SyncInfo) })
  }, [])

  if (!sync) return (
    <p className="text-[10px] px-2 py-1" style={{ color: 'var(--text-4)' }}>Loading…</p>
  )

  const lastAt = sync.completed_at ? new Date(sync.completed_at) : null
  const minsAgo = lastAt ? Math.round((Date.now() - lastAt.getTime()) / 60_000) : null
  const lastLabel = minsAgo === null ? 'Never'
    : minsAgo < 60 ? `${minsAgo}m ago`
    : `${Math.round(minsAgo / 60)}h ago`

  const nextMins = minsAgo !== null ? Math.max(0, 4 * 60 - minsAgo) : null
  const nextLabel = nextMins === null ? '—'
    : nextMins < 60 ? `in ${nextMins}m`
    : `in ${Math.round(nextMins / 60)}h`

  const isFailed = sync.status === 'error'

  return (
    <div className="px-2 py-1 space-y-0.5">
      <div className="flex items-center gap-1.5">
        <div
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: isFailed ? 'var(--danger-text)' : 'var(--success-text)' }}
        />
        <p className="text-[10px]" style={{ color: 'var(--text-4)' }}>Synced {lastLabel}</p>
      </div>
      {!isFailed && nextLabel && (
        <p className="text-[10px] pl-3" style={{ color: 'var(--text-4)' }}>Next {nextLabel}</p>
      )}
      {isFailed && sync.error_msg && (
        <p className="text-[10px] pl-3 truncate" style={{ color: 'var(--danger-text)' }} title={sync.error_msg}>
          {sync.error_msg.slice(0, 38)}…
        </p>
      )}
    </div>
  )
}

/* ── Manual Sync Button ── */
function ManualSyncButton() {
  const [syncing, setSyncing] = useState(false)

  async function triggerSync() {
    setSyncing(true)
    try { await fetch('/api/vault/sync', { method: 'POST' }) }
    finally { setSyncing(false) }
  }

  return (
    <button
      onClick={triggerSync}
      disabled={syncing}
      title="Trigger manual sync"
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[6px] text-[12px] transition-colors disabled:opacity-40"
      style={{
        border: '1px solid var(--border)',
        background: 'transparent',
        color: 'var(--text-3)',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
    >
      <RefreshCw className={cn('w-3.5 h-3.5', syncing && 'animate-spin')} aria-hidden />
      {syncing ? 'Syncing…' : 'Sync'}
    </button>
  )
}
