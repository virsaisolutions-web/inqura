'use client'

import { Bell } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { Alert } from '@/lib/supabase/types'

export function AlertBell() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [open, setOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Initial fetch
  useEffect(() => {
    const supabase = createClient()

    async function fetchAlerts() {
      const { data } = await supabase
        .from('alerts')
        .select('*')
        .eq('is_read', false)
        .order('triggered_at', { ascending: false })
        .limit(20)
      if (data) setAlerts(data as Alert[])
    }

    fetchAlerts()

    // Realtime subscription
    const channel = supabase
      .channel('alerts-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'alerts',
      }, (payload) => {
        setAlerts(prev => [payload.new as Alert, ...prev].slice(0, 20))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function markAllRead() {
    const supabase = createClient()
    const ids = alerts.map(a => a.id)
    if (!ids.length) return
    await supabase.from('alerts').update({ is_read: true }).in('id', ids)
    setAlerts([])
  }

  const unread = alerts.filter(a => !a.is_read).length

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setOpen(v => !v)}
        className="relative p-1.5 rounded-[6px] transition-colors"
        style={{ color: 'var(--text-4)' }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.color = 'var(--text-2)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-4)' }}
        aria-label="View alerts"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 w-4 h-4 text-white text-[9px] font-bold rounded-full flex items-center justify-center"
            style={{ background: 'var(--danger-text)' }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-9 w-80 rounded-[10px] z-50 overflow-hidden"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          }}
        >
          <div
            className="flex items-center justify-between px-4 py-2.5"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <span className="text-[13px] font-semibold" style={{ color: 'var(--text-1)' }}>Alerts</span>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="text-[11px] transition-colors"
                style={{ color: 'var(--accent)' }}
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="px-4 py-6 text-center text-[12px]" style={{ color: 'var(--text-4)' }}>
                No unread alerts
              </div>
            ) : (
              alerts.map(alert => (
                <AlertItem key={alert.id} alert={alert} onRead={() => {
                  setAlerts(prev => prev.filter(a => a.id !== alert.id))
                  const supabase = createClient()
                  supabase.from('alerts').update({ is_read: true }).eq('id', alert.id)
                }} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// report_ready alert message is JSON: { text, download_url, period }
interface ReportPayload { text: string; download_url: string | null; period: string }

function parseReportPayload(raw: string): ReportPayload | null {
  try { return JSON.parse(raw) } catch { return null }
}

function AlertItem({ alert, onRead }: { alert: Alert; onRead: () => void }) {
  const iconColor = { critical: 'var(--danger-text)', warning: 'var(--warning-text)', info: 'var(--accent)' }[alert.severity] ?? 'var(--accent)'
  const timeAgo = formatRelative(new Date(alert.triggered_at))
  const isReport = alert.alert_type === 'report_ready'
  const report = isReport ? parseReportPayload(alert.message) : null

  return (
    <div
      className="flex items-start gap-3 px-4 py-3 group cursor-default"
      style={{ borderBottom: '1px solid var(--border-2)' }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
    >
      <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: iconColor }} />
      <div className="flex-1 min-w-0">
        <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
          {report ? report.text : alert.message}
        </p>

        {/* Download button for completed report_ready alerts */}
        {report?.download_url && (
          <a
            href={report.download_url}
            download={`inqura-sla-${report.period}.pdf`}
            onClick={onRead}
            className="inline-flex items-center gap-1 mt-2 px-2.5 py-1 rounded-[6px] text-[11px] font-medium transition-colors"
            style={{
              background: 'var(--accent-tint)',
              color: 'var(--accent)',
              border: '1px solid var(--accent-border)',
            }}
          >
            ↓ Download PDF
          </a>
        )}

        <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-4)' }}>{timeAgo}</p>
      </div>
      <button
        onClick={onRead}
        className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
        style={{ color: 'var(--text-4)' }}
      >
        dismiss
      </button>
    </div>
  )
}

function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}h ago`
  return `${Math.floor(diffH / 24)}d ago`
}
