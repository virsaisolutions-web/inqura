'use client'

import { Sun, Moon } from 'lucide-react'
import { useTheme } from '@/lib/theme'

interface Props {
  className?: string
}

export function ThemeToggle({ className }: Props) {
  const { theme, toggle } = useTheme()

  return (
    <button
      onClick={toggle}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 30,
        height: 30,
        borderRadius: 6,
        border: '1px solid var(--border)',
        background: 'transparent',
        color: 'var(--text-3)',
        cursor: 'pointer',
        transition: 'background 0.15s, color 0.15s',
        flexShrink: 0,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'var(--surface-2)'
        e.currentTarget.style.color = 'var(--text-1)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = 'var(--text-3)'
      }}
    >
      {theme === 'dark'
        ? <Sun  className="w-3.5 h-3.5" aria-hidden />
        : <Moon className="w-3.5 h-3.5" aria-hidden />
      }
    </button>
  )
}
