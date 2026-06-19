import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // unsafe-eval needed for Next.js dev
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob:",
            `connect-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''} wss://*.supabase.co`,
            "font-src 'self'",
            "frame-ancestors 'none'",
          ].join('; '),
        },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    },
  ],
}

export default nextConfig
