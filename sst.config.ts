/// <reference path="./.sst/platform/config.d.ts" />

// SST v3 (Ion) config — deploys Lambda functions + EventBridge cron
// Next.js UI stays on Vercel. Lambda handles heavy/long-running operations.
//
// Deploy:  npx sst deploy --stage prod
// Remove:  npx sst remove --stage prod
// Dev:     npx sst dev  (local Lambda emulation)

export default $config({
  app(input) {
    return {
      name: 'inqura',
      removal: input?.stage === 'prod' ? 'retain' : 'remove',
      home: 'aws',
    }
  },

  async run() {
    // ── Shared env vars (set these in AWS SSM or .env.local) ──────────
    const env = {
      NEXT_PUBLIC_SUPABASE_URL:  process.env.NEXT_PUBLIC_SUPABASE_URL!,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      VAULT_URL:                 process.env.VAULT_URL!,
      VAULT_USERNAME:            process.env.VAULT_USERNAME!,
      VAULT_PASSWORD:            process.env.VAULT_PASSWORD!,
      VAULT_API_VERSION:         process.env.VAULT_API_VERSION ?? 'v24.1',
      CRON_SECRET:               process.env.CRON_SECRET!,
      SLACK_WEBHOOK_URL:         process.env.SLACK_WEBHOOK_URL ?? '',
    }

    // ── 1. Vault sync Lambda ──────────────────────────────────────────
    // Replaces: POST /api/vault/sync
    // Timeout 5 min — well within Lambda's 15 min max
    const vaultSync = new sst.aws.Function('VaultSync', {
      handler: 'lambda/vault-sync.handler',
      timeout: '5 minutes',
      memory:  '512 MB',
      environment: env,
      url: true,   // creates a public Function URL (no API Gateway cost)
    })

    // ── 2. PDF generation Lambda ──────────────────────────────────────
    // Replaces: GET /api/reports/compliance-pdf
    // Timeout 2 min (PDF render can be slow on first cold start)
    const pdfGen = new sst.aws.Function('PdfGeneration', {
      handler: 'lambda/pdf-generation.handler',
      timeout: '2 minutes',
      memory:  '1024 MB',    // React-PDF needs headroom
      environment: env,
      url: true,
    })

    // ── 3. Metrics refresh Lambda ─────────────────────────────────────
    // Replaces: POST /api/metrics/refresh (nightly cron target)
    const metricsRefresh = new sst.aws.Function('MetricsRefresh', {
      handler: 'lambda/metrics-refresh.handler',
      timeout: '2 minutes',
      memory:  '256 MB',
      environment: env,
    })

    // ── 4. DB keep-alive Lambda ───────────────────────────────────────
    // Pings Supabase daily so it doesn't pause after 7 days inactivity
    const dbPing = new sst.aws.Function('DbKeepAlive', {
      handler: 'lambda/db-keepalive.handler',
      timeout: '30 seconds',
      memory:  '128 MB',
      environment: {
        NEXT_PUBLIC_SUPABASE_URL:  env.NEXT_PUBLIC_SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
      },
    })

    // ── EventBridge cron rules ────────────────────────────────────────

    // Vault sync every 1 hour
    new sst.aws.Cron('VaultSyncCron', {
      schedule: 'rate(1 hour)',
      job: {
        handler: 'lambda/vault-sync.handler',
        timeout: '5 minutes',
        memory:  '512 MB',
        environment: env,
      },
    })

    // Metrics refresh nightly at 2am UTC
    new sst.aws.Cron('MetricsRefreshCron', {
      schedule: 'cron(0 2 * * ? *)',
      job: {
        handler: 'lambda/metrics-refresh.handler',
        timeout: '2 minutes',
        memory:  '256 MB',
        environment: env,
      },
    })

    // DB keep-alive — once per day at noon UTC
    new sst.aws.Cron('DbKeepAliveCron', {
      schedule: 'cron(0 12 * * ? *)',
      job: {
        handler: 'lambda/db-keepalive.handler',
        timeout: '30 seconds',
        memory:  '128 MB',
        environment: {
          NEXT_PUBLIC_SUPABASE_URL:  env.NEXT_PUBLIC_SUPABASE_URL,
          SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
        },
      },
    })

    // ── 5. PDF worker Lambda ──────────────────────────────────────────
    // Polls report_jobs every 1 min for pending work
    // Generates PDF → Supabase Storage → creates report_ready alert
    new sst.aws.Cron('PdfWorkerCron', {
      schedule: 'rate(1 minute)',
      job: {
        handler: 'lambda/pdf-worker.handler',
        timeout: '3 minutes',
        memory:  '1024 MB',
        environment: env,
      },
    })

    // ── Outputs — paste these into Vercel env vars ─────────────────────
    return {
      VaultSyncUrl:     vaultSync.url,
      PdfGenerationUrl: pdfGen.url,
    }
  },
})
