# Inqura

Medical Affairs analytics dashboard for Veeva Vault MedInquiry. Surfaces real-time inquiry intelligence, SLA countdown monitoring, and compliance reporting — built exclusively for pharma teams already running on Veeva.

**Built by [VirsAI Solutions](https://virsaisolutions.com)**

---

## What it does

| Module | Description |
|---|---|
| **M1 — Inquiry Intelligence** | 12-month volume trend, topic breakdown (top 7), channel split, product mix (up to 8), live case queue |
| **M2 — SLA & Compliance Monitor** | Per-case countdown timers, breach risk queue, one-click Slack/Teams escalation, 30-day compliance trend, on-demand PDF export |

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16.2.9 — App Router, TypeScript strict |
| Styling | Tailwind CSS 4, "Quiet Enterprise" design system (Manrope + JetBrains Mono) |
| Database & Auth | Supabase (Postgres + Auth + Realtime + RLS) |
| Vault integration | Veeva Vault REST API v24.1 — VQL polling |
| PDF generation | @react-pdf/renderer 4.3.0 |
| Charts | Recharts |
| Deployment | Vercel (Next.js) + AWS Lambda via SST v3 (heavy jobs) |
| Cron | Vercel Cron (hourly sync, 2 am metrics refresh) |

---

## Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project (free tier works for Phase 1)
- A Veeva Vault sandbox with MedInquiry enabled and a read-only integration account
- [Vercel](https://vercel.com) account for deployment
- AWS account (optional — only needed for Lambda / SST deployment)

---

## Local development

```bash
# 1. Clone and install
git clone <repo-url>
cd inqura
npm install

# 2. Copy environment template and fill in values
cp .env.local.example .env.local
# Edit .env.local — see "Environment variables" below

# 3. Run database migrations
# Open Supabase Dashboard → SQL Editor → New query
# Run each file in order from supabase/migrations/_archive/ (001 → 013)

# 4. Start the dev server
npm run dev
# → http://localhost:3000

# 5. Create your first user
# Supabase Dashboard → Authentication → Users → Add user
# Then log in at http://localhost:3000/login

# 6. Verify Vault connectivity
curl http://localhost:3000/api/vault/test

# 7. Trigger a manual sync
curl -X POST http://localhost:3000/api/vault/sync \
  -H "x-cron-secret: <your-CRON_SECRET>"
```

---

## Environment variables

Create `.env.local` at the project root. **Never commit this file** — it is git-ignored.

```bash
# ── Supabase ──────────────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=           # https://[project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=      # eyJ... (safe to expose to browser)
SUPABASE_SERVICE_ROLE_KEY=          # eyJ... (server-only — never expose to client)

# ── Veeva Vault ───────────────────────────────────────────────────────
VAULT_URL=                          # https://[company]-sb.veevavault.com
VAULT_USERNAME=                     # read-only integration account email
VAULT_PASSWORD=                     # integration account password
VAULT_API_VERSION=v24.1             # update if your Vault runs a newer version

# ── App ───────────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=                # http://localhost:3000 (dev) | https://your-domain.com (prod)
CRON_SECRET=                        # random 32-char string — secures cron endpoints
TENANT_ID=                          # UUID from tenants table after running migrations

# ── Lambda Function URLs (set after `npx sst deploy` outputs them) ────
LAMBDA_VAULT_SYNC_URL=              # optional — only if using SST Lambda for sync

# ── Optional: webhook notifications ──────────────────────────────────
SLACK_WEBHOOK_URL=                  # https://hooks.slack.com/services/...
```

> `SUPABASE_SERVICE_ROLE_KEY` must only appear in Server Components, API routes, and Lambda functions. It is never imported in any client component and must not be prefixed with `NEXT_PUBLIC_`.

---

## Database setup

Run these four files in order using Supabase SQL Editor (Dashboard → SQL Editor → New query).
Files are in `supabase/run/`.

| Order | File | What it does |
|---|---|---|
| 1 | `01_schema.sql` | Full schema — all tables, indexes, constraints (replaces the 13 archived dev migrations) |
| 2 | `02_rls.sql` | Row Level Security policies — tenant isolation, auth guards |
| 3 | `03_seed.sql` | Bootstrap seed — creates your first tenant row and maps your admin user |
| 4 | `04_report_jobs.sql` | `report_jobs` table — tracks async PDF generation state |

After running `03_seed.sql`, copy the tenant UUID from the `tenants` table into `TENANT_ID` in `.env.local`.

> The `supabase/migrations/_archive/` directory contains the original incremental dev migrations for reference only. Do not run them on a fresh install.

---

## Deployment — Vercel

```bash
# 1. Push to a private GitHub repo
git init
git add -A
git commit -m "phase-1: initial production build"
git remote add origin git@github.com:<org>/inqura.git
git push -u origin main

# 2. Connect repo to Vercel
#    vercel.com → New Project → Import Git Repository → select inqura

# 3. Add all environment variables in Vercel project settings
#    Settings → Environment Variables
#    Add every key from .env.local (except LAMBDA_VAULT_SYNC_URL if not using SST)

# 4. Deploy to production
vercel --prod
```

`vercel.json` is picked up automatically and registers two cron jobs:

| Job | Schedule | Route | Purpose |
|---|---|---|---|
| Vault sync | Every hour `0 * * * *` | `POST /api/vault/sync` | Incremental case sync from Vault |
| Metrics refresh | Daily 2 am UTC `0 2 * * *` | `POST /api/metrics/refresh` | Recompute `metrics_daily` aggregates |

Both routes require the `x-cron-secret` header to match `CRON_SECRET`. Requests without it return `401`.

---

## Deployment — AWS Lambda via SST (optional)

Use this if Vault sync or PDF generation regularly exceeds Vercel's function timeout.

```bash
# Requires AWS credentials configured (aws configure)
npx sst deploy --stage prod
```

SST creates three Lambda functions:

| Function | Timeout | RAM | Purpose |
|---|---|---|---|
| `VaultSync` | 5 min | 512 MB | Full/incremental Vault sync for large case volumes |
| `PdfGeneration` | 2 min | 1 GB | React-PDF rendering (needs headroom on cold start) |
| `MetricsRefresh` | 2 min | 256 MB | Nightly `metrics_daily` recompute |

After deploy, copy the `VaultSync` Function URL output into `LAMBDA_VAULT_SYNC_URL` in Vercel env vars. The Next.js app delegates sync calls to Lambda instead of running inline.

---

## Post-deploy smoke test

Run these checks immediately after deploying:

```
□  Login works on production URL
□  GET  /api/health                   → { status: "ok", db: "connected" }
□  GET  /api/vault/test               → { connected: true, casesAccessible: true }
□  POST /api/vault/sync (with secret) → syncs cases; check Supabase cases table
□  Dashboard loads with real data (not empty state)
□  SLA page shows compliance % and a risk queue
□  Alert bell shows unread count after a sync
□  Cron routes return 401 without x-cron-secret header
□  PDF generation completes and download link appears
□  Slack webhook fires on escalation (if SLACK_WEBHOOK_URL configured)
□  Audit log records page views and exports
□  Dark/light theme toggle persists across reload
```

---

## Data privacy

Inqura stores **only case metadata** — never case content, HCP names, or contact details.

| Stored in Supabase (safe) | Stays in Vault (never copied) |
|---|---|
| Case ID (Vault reference key) | Case text / inquiry content |
| Topic category | HCP name, email, NPI |
| Product name | Patient information |
| Channel (email / CRM / phone / web) | Contact details |
| Status & timestamps | Full correspondence history |
| SLA deadline (computed locally) | |
| HCP specialty (role only, e.g. "Oncologist") | |
| Institution name (no address) | |

---

## Project structure

```
inqura/
├── app/
│   ├── (auth)/               # Login, password reset
│   ├── (dashboard)/          # Protected pages (session-guarded)
│   │   ├── page.tsx          # M1 — Inquiry Intelligence Dashboard
│   │   ├── sla/page.tsx      # M2 — SLA & Compliance Monitor
│   │   ├── cases/page.tsx    # Case queue (read-only, 200 cases)
│   │   ├── reports/page.tsx  # On-demand PDF generation
│   │   └── settings/         # Admin: Vault, webhooks, SLA config, users
│   └── api/                  # API routes
│       ├── vault/sync        # Vault sync (cron + manual trigger)
│       ├── vault/test        # Vault connectivity check
│       ├── metrics/          # KPIs, nightly refresh
│       ├── cases/[id]/escalate  # Escalation → alert + webhook
│       └── reports/          # PDF generation + job status polling
├── components/
│   ├── ui/                   # Primitives: button, badge, card, sheet, dialog…
│   ├── charts/               # VolumeBarChart (12-month), SLATrendChart (30-day)
│   ├── cases/                # CasesTable, CaseDrawer (with workflow stepper)
│   ├── sla/                  # SLACountdown (60s live ring)
│   ├── alerts/               # AlertBell (Supabase Realtime)
│   └── layout/               # DashboardShell, sidebar, topbar
├── lib/
│   ├── vault/                # API client, VQL queries, sync orchestrator
│   ├── supabase/             # Browser/server clients, TypeScript types
│   ├── metrics/              # SLA engine, trend aggregation, KPI computation
│   ├── notifications/        # Slack + Teams webhook helpers
│   └── auth/                 # Session helpers, requireAdmin, audit logging
├── lambda/                   # SST Lambda handlers (optional)
├── supabase/
│   └── migrations/_archive/  # SQL migration files (001–013)
├── public/landing/           # Static marketing landing page
├── tasks/                    # Build tracker (git-ignored)
├── sst.config.ts             # SST v3 Lambda config
└── vercel.json               # Vercel cron schedule
```

---

## SLA thresholds (as configured)

| Priority | SLA target | Risk alert trigger |
|---|---|---|
| Critical | 24 hours | Warning at 20h remaining, critical at 6h |
| Urgent (default) | 48 hours | Warning at 20h remaining, critical at 6h |
| Standard | 72 hours | Warning at 20h remaining, critical at 6h |
| Off-label (any priority) | Auto-upgraded to 48h | Same thresholds |

---

## Phase 2 (not built yet)

Phase 2 adds three AI modules on top of the Phase 1 analytics foundation.

- **M3 — Content Gap Analyzer**: NLP semantic matching of inquiry text vs. Vault response library
- **M4 — Medical Insights Extractor**: structured intelligence cards from inquiry patterns
- **M5 — Content Performance Tracker**: document usage frequency from MedComms data

Prerequisites before starting Phase 2:
- Phase 1 deployed with at least one paying client
- 3+ months of real case data accumulated
- Veeva Direct Data API access confirmed
- LLM API budget approved (~$10–30/client/month)
