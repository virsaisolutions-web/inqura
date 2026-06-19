-- ============================================================
-- Inqura — Complete Schema (run this first)
-- ============================================================
-- Fresh install: paste into Supabase SQL editor and run.
-- This replaces migrations 001–013.
-- Run 02_rls.sql next, then 03_seed.sql.
-- ============================================================

-- ── Shared trigger function ───────────────────────────────────────────────────

create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ── tenants ───────────────────────────────────────────────────────────────────
-- One row per company using Inqura.
-- Phase 1 = single row. Phase 3 = one row per client.

create table if not exists tenants (
  id                  uuid        primary key default gen_random_uuid(),
  name                text        not null,
  slug                text        unique,                        -- url-safe short name (e.g. "arcturus")
  plan                text        not null default 'trial',      -- trial | starter | pro | enterprise
  status              text        not null default 'active',     -- active | suspended | churned

  -- Vault connection credentials (stored here; lib/vault/client.ts reads these first, env fallback)
  vault_url           text        not null default '',
  vault_client_id     text        not null default '',
  vault_client_secret text        not null default '',
  vault_username      text,
  vault_password      text,
  vault_api_version   text        default 'v24.1',

  -- Flexible config (SLA targets, notification prefs, etc.)
  settings            jsonb       not null default '{}',

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint tenants_plan_check   check (plan   in ('trial', 'starter', 'pro', 'enterprise')),
  constraint tenants_status_check check (status in ('active', 'suspended', 'churned'))
);

create trigger tenants_updated_at
  before update on tenants
  for each row execute function update_updated_at();

comment on table tenants is 'One row per customer organisation. Single row in Phase 1.';
comment on column tenants.slug is 'URL-safe short identifier. Used in Phase 3 routing.';


-- ── tenant_users ──────────────────────────────────────────────────────────────
-- Maps auth.users → tenants with a role.
-- One user can belong to multiple tenants (Phase 3 consultant use case).
-- Phase 1: all auth.users belong to the single tenant (seeded via 03_seed.sql).

create table if not exists tenant_users (
  id          bigserial   primary key,
  tenant_id   uuid        not null references tenants(id) on delete cascade,
  user_id     uuid        not null,             -- auth.users.id (no FK — cross-schema)
  role        text        not null default 'user',
  invited_by  uuid,                             -- user_id of admin who invited (null = seeded)
  invited_at  timestamptz not null default now(),
  joined_at   timestamptz,                      -- set on first sign-in after invite
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (tenant_id, user_id),
  constraint tenant_users_role_check check (role in ('admin', 'user', 'viewer'))
);

create index if not exists tenant_users_user_id
  on tenant_users(user_id) where is_active = true;

create index if not exists tenant_users_tenant_id
  on tenant_users(tenant_id) where is_active = true;

create trigger tenant_users_updated_at
  before update on tenant_users
  for each row execute function update_updated_at();

comment on table tenant_users is 'Maps auth users to tenants with role. Core multi-tenancy join table.';
comment on column tenant_users.role      is 'admin: full settings access | user: dashboard read/write | viewer: read-only';
comment on column tenant_users.is_active is 'False = access revoked. Row kept for audit trail.';


-- ── RLS helper functions ──────────────────────────────────────────────────────
-- security definer = runs as DB owner, bypasses RLS on tenant_users itself.
-- These are used in every policy below.

create or replace function current_tenant_id()
returns uuid language sql stable security definer set search_path = public as $$
  select tenant_id
  from tenant_users
  where user_id = auth.uid()
    and is_active = true
  order by created_at asc   -- oldest membership = primary tenant
  limit 1
$$;

create or replace function current_user_role()
returns text language sql stable security definer set search_path = public as $$
  select role
  from tenant_users
  where user_id = auth.uid()
    and is_active = true
  order by created_at asc
  limit 1
$$;

create or replace function is_tenant_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from tenant_users
    where user_id = auth.uid()
      and is_active = true
      and role = 'admin'
  )
$$;

comment on function current_tenant_id is 'Returns primary tenant_id for the current session. Used in all RLS policies.';
comment on function current_user_role  is 'Returns role (admin|user|viewer) for the current session.';
comment on function is_tenant_admin    is 'Returns true if the current user has the admin role.';


-- ── sync_log ──────────────────────────────────────────────────────────────────

create table if not exists sync_log (
  id                 bigserial   primary key,
  tenant_id          uuid        references tenants(id),
  sync_type          text        not null,
  started_at         timestamptz not null default now(),
  completed_at       timestamptz,
  records_processed  integer,
  status             text        not null default 'running',
  error_msg          text,

  constraint sync_log_status_check check (status    in ('running', 'success', 'error', 'skipped')),
  constraint sync_log_type_check   check (sync_type in ('full', 'incremental'))
);

create index if not exists sync_log_tenant_started
  on sync_log(tenant_id, started_at desc);

comment on table sync_log is 'Audit trail of every Vault→Supabase sync run.';


-- ── cases ─────────────────────────────────────────────────────────────────────
-- Inquiry metadata only. NO case text, NO HCP names.
-- All identifiable HCP data stays in Vault.

create table if not exists cases (
  id               bigserial   primary key,
  tenant_id        uuid        references tenants(id),
  vault_case_id    text        not null unique,   -- MedInquiry case ID from Vault
  product          text,
  topic_category   text,                          -- from Vault topic__v field
  channel          text,                          -- email | crm | phone | web | fax | other
  status           text,                          -- open | in_review | fulfilled | closed | on_hold
  priority         text,                          -- standard | urgent | critical
  hcp_specialty    text,                          -- oncologist | cardiologist etc (NO name)
  hcp_institution  text,                          -- hospital name only
  country          text,
  submitted_at     timestamptz not null,
  assigned_at      timestamptz,
  fulfilled_at     timestamptz,
  sla_deadline     timestamptz,                   -- computed: submitted_at + sla_hours_target
  sla_hours_target integer     not null default 48,
  is_off_label     boolean     not null default false,
  vault_synced_at  timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint cases_status_check       check (status   in ('open', 'in_review', 'fulfilled', 'closed', 'on_hold')),
  constraint cases_priority_check     check (priority in ('standard', 'urgent', 'critical')),
  constraint cases_channel_check      check (channel  in ('email', 'crm', 'phone', 'web', 'fax', 'other')),
  constraint cases_sla_hours_check    check (sla_hours_target > 0 and sla_hours_target <= 720),
  constraint cases_dates_check        check (fulfilled_at is null or fulfilled_at >= submitted_at),
  constraint cases_sla_deadline_check check (sla_deadline is null or sla_deadline >= submitted_at)
);

create index if not exists cases_tenant_status
  on cases(tenant_id, status);

create index if not exists cases_tenant_submitted
  on cases(tenant_id, submitted_at desc);

create index if not exists cases_sla_deadline
  on cases(sla_deadline) where status != 'fulfilled';

create index if not exists cases_tenant_open_sla
  on cases(tenant_id, sla_deadline asc)
  where status not in ('fulfilled', 'closed');

create index if not exists cases_tenant_fulfilled
  on cases(tenant_id, fulfilled_at desc)
  where fulfilled_at is not null;

create index if not exists cases_tenant_product
  on cases(tenant_id, product, submitted_at desc);

create index if not exists cases_tenant_topic
  on cases(tenant_id, topic_category, submitted_at desc);

create index if not exists cases_vault_synced_at
  on cases(tenant_id, vault_synced_at desc);

create trigger cases_updated_at
  before update on cases
  for each row execute function update_updated_at();

comment on table cases is 'Inquiry metadata from Vault. No case text or HCP PII stored here.';


-- ── metrics_daily ─────────────────────────────────────────────────────────────
-- Pre-aggregated, refreshed nightly by cron job.

create table if not exists metrics_daily (
  id               bigserial   primary key,
  tenant_id        uuid        references tenants(id),
  metric_date      date        not null,
  product          text,                          -- null = all-products roll-up
  total_cases      integer     not null default 0,
  fulfilled_cases  integer     not null default 0,
  sla_met          integer     not null default 0,
  sla_breached     integer     not null default 0,
  avg_response_h   numeric(6,2),
  topic_breakdown  jsonb,                         -- { "Dosing": 12, "Off-label": 7, ... }
  channel_breakdown jsonb,

  unique (tenant_id, metric_date, product),

  constraint metrics_daily_counts_check check (
    total_cases >= 0
    and fulfilled_cases >= 0
    and sla_met >= 0
    and sla_breached >= 0
    and fulfilled_cases <= total_cases
    and sla_met + sla_breached <= fulfilled_cases
  )
);

create index if not exists metrics_daily_tenant_date
  on metrics_daily(tenant_id, metric_date desc);

create index if not exists metrics_daily_tenant_product_date
  on metrics_daily(tenant_id, product, metric_date desc);

comment on table metrics_daily is 'Pre-aggregated daily metrics. Refreshed nightly. Never deleted — used for trend history.';


-- ── alerts ────────────────────────────────────────────────────────────────────

create table if not exists alerts (
  id           bigserial   primary key,
  tenant_id    uuid        references tenants(id),
  case_id      bigint      references cases(id),
  alert_type   text        not null,   -- sla_risk | sla_breach | topic_spike | escalated
  severity     text        not null,   -- critical | warning | info
  message      text        not null,
  is_read      boolean     not null default false,
  triggered_at timestamptz not null default now(),
  resolved_at  timestamptz
);

-- Deduplication: one active alert per case+type per day
create unique index if not exists alerts_dedup
  on alerts(tenant_id, case_id, alert_type, (triggered_at::date))
  where resolved_at is null;

comment on table alerts is 'SLA risk alerts and system notifications. Deduplicated per case per day.';


-- ── audit_log ─────────────────────────────────────────────────────────────────
-- 21 CFR Part 11 awareness: immutable log of user actions.
-- Never update or delete rows. service_role inserts only.

create table if not exists audit_log (
  id          bigserial   primary key,
  tenant_id   uuid        references tenants(id),
  user_email  text,
  action      text        not null,   -- viewed_dashboard | viewed_case | exported_report | sync_triggered | escalated
  resource    text,                   -- cases | report | dashboard
  resource_id text,
  ip_address  text,
  created_at  timestamptz not null default now()
);

create index if not exists audit_log_tenant_time
  on audit_log(tenant_id, created_at desc);

create index if not exists audit_log_user_email
  on audit_log(tenant_id, user_email, created_at desc);

create index if not exists audit_log_action
  on audit_log(tenant_id, action, created_at desc);

comment on table audit_log is '21 CFR Part 11 audit trail. Rows are never updated or deleted.';


-- ── integrations ──────────────────────────────────────────────────────────────
-- Webhook URLs for Slack / Teams notifications.
-- webhook_url is stored server-side only; browser never receives the raw URL.

create table if not exists integrations (
  id          bigserial   primary key,
  tenant_id   uuid        references tenants(id),
  type        text        not null,   -- slack | teams | custom
  webhook_url text        not null,
  enabled     boolean     not null default true,
  label       text,                   -- optional display name
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint integrations_type_check check (type in ('slack', 'teams', 'custom'))
);

create trigger integrations_updated_at
  before update on integrations
  for each row execute function update_updated_at();

comment on table integrations is 'Outbound webhook integrations (Slack, Teams). webhook_url never returned to browser.';
