'use client'

import { useEffect, useState } from 'react'
import { getSLARiskLevel, getHoursRemaining } from '@/lib/metrics/sla'

interface Props {
  deadline: string | Date
  className?: string
  showRing?: boolean
  slaHoursTarget?: number
}

const RISK_COLORS: Record<string, string> = {
  breached: 'var(--danger-text)',
  critical: 'var(--danger-text)',
  warning:  'var(--warning-text)',
  safe:     'var(--success-text)',
}

export function SLACountdown({ deadline, className, showRing = false, slaHoursTarget = 48 }: Props) {
  const deadlineDate = typeof deadline === 'string' ? new Date(deadline) : deadline
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const hoursLeft = getHoursRemaining(deadlineDate, now)
  const risk = getSLARiskLevel(deadlineDate, now)
  const color = RISK_COLORS[risk]

  function formatTime(hours: number): string {
    if (hours < 0) return 'BREACHED'
    const h = Math.floor(hours)
    const m = Math.floor((hours - h) * 60)
    if (h === 0) return `${m}m`
    return `${h}h ${m}m`
  }

  // Ring
  const pctLeft = Math.max(0, Math.min(1, hoursLeft / slaHoursTarget))
  const R = 20
  const C = 2 * Math.PI * R
  const strokeDashoffset = C * (1 - pctLeft)

  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      {showRing && (
        <svg width="48" height="48" viewBox="0 0 48 48" className="flex-shrink-0" aria-hidden>
          <circle cx="24" cy="24" r={R} fill="none" stroke="var(--border)" strokeWidth="3.5" />
          <circle
            cx="24" cy="24" r={R}
            fill="none"
            stroke={color}
            strokeWidth="3.5"
            strokeDasharray={C}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform="rotate(-90 24 24)"
            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          />
          <text x="24" y="28" textAnchor="middle" fontSize="9" fill={color} fontWeight="600">
            {hoursLeft < 0 ? '!' : `${Math.max(0, Math.floor(hoursLeft))}h`}
          </text>
        </svg>
      )}
      <span
        className="tabular-nums text-[13px] font-semibold"
        style={{ color, fontFamily: 'JetBrains Mono, monospace' }}
      >
        {formatTime(hoursLeft)}
      </span>
    </div>
  )
}

export function SLAStatusBadge({ deadline }: { deadline: string }) {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  const deadlineDate = new Date(deadline)
  const risk = getSLARiskLevel(deadlineDate, now)
  const hoursLeft = getHoursRemaining(deadlineDate, now)

  const label = {
    breached: 'BREACHED',
    critical: 'CRITICAL',
    warning:  'AT RISK',
    safe:     'ON TRACK',
  }[risk]

  const BADGE_STYLES: Record<string, React.CSSProperties> = {
    breached: { background: 'var(--danger-bg)',  border: '1px solid var(--danger-border)',  color: 'var(--danger-text)'  },
    critical: { background: 'var(--danger-bg)',  border: '1px solid var(--danger-border)',  color: 'var(--danger-text)'  },
    warning:  { background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', color: 'var(--warning-text)' },
    safe:     { background: 'var(--success-bg)', border: '1px solid var(--success-border)', color: 'var(--success-text)' },
  }

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] text-[10px] font-semibold tracking-[0.06em]"
      style={BADGE_STYLES[risk]}
    >
      {label}
      {risk !== 'breached' && hoursLeft >= 0 && (
        <span style={{ fontFamily: 'JetBrains Mono, monospace' }} className="ml-0.5">
          {Math.floor(hoursLeft)}h
        </span>
      )}
    </span>
  )
}
