import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/lib/theme'

export const metadata: Metadata = {
  title: 'Inqura — Medical Affairs Intelligence',
  description: 'Veeva-native Medical Affairs analytics by VirsAI Solutions',
}

// Inline script runs before React hydrates → no flash of wrong theme
const themeScript = `
(function() {
  try {
    var saved = localStorage.getItem('inqura-theme');
    var system = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    var theme = saved || system;
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.add('light');
    }
  } catch(e) {}
})();
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <head>
        {/* Anti-flash: apply theme class before paint */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
