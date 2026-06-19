'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

interface ThemeCtx {
  theme: Theme
  toggle: () => void
}

const Ctx = createContext<ThemeCtx>({ theme: 'light', toggle: () => {} })

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')

  // On mount: read saved preference OR fall back to system preference
  useEffect(() => {
    const saved = localStorage.getItem('inqura-theme') as Theme | null
    const system: Theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    const resolved = saved ?? system
    setTheme(resolved)
    applyTheme(resolved)
  }, [])

  function toggle() {
    setTheme(prev => {
      const next: Theme = prev === 'light' ? 'dark' : 'light'
      localStorage.setItem('inqura-theme', next)
      applyTheme(next)
      return next
    })
  }

  return <Ctx.Provider value={{ theme, toggle }}>{children}</Ctx.Provider>
}

export function useTheme() {
  return useContext(Ctx)
}

function applyTheme(theme: Theme) {
  const el = document.documentElement
  if (theme === 'dark') {
    el.classList.add('dark')
    el.classList.remove('light')
  } else {
    el.classList.add('light')
    el.classList.remove('dark')
  }
}
