-- 009_tenants_enhanced.sql
--
-- Enhances the tenants table for multi-tenant production use.
-- Adds: slug (URL-safe ID), plan, status, settings (per-tenant config overrides),
-- updated_at, and a trigger to keep it current.
--
-- Safe to run against an existing single-row tenants table.

-- Columns
alter table tenants
  add column if not exists slug         text unique,           -- URL-safe identifier e.g. "arcturus-pharma"
  add column if not exists plan         text not null default 'starter',  -- starter | pro | enterprise
  add column if not exists status       text not null default 'active',   -- active | suspended | trial | churned
  add column if not exists settings     jsonb not null default '{}',      -- per-tenant config overrides
  add column if not exists updated_at   timestamptz not null default now();

-- Constraints
alter table tenants
  add constraint tenants_plan_check   check (plan   in ('starter', 'pro', 'enterprise')),
  add constraint tenants_status_check check (status in ('active', 'suspended', 'trial', 'churned'));

-- Auto-slug existing rows that have no slug yet (derive from name)
update tenants
  set slug = lower(regexp_replace(trim(name), '[^a-z0-9]+', '-', 'gi'))
  where slug is null;

-- Index for slug lookups (used in multi-tenant routing)
create unique index if not exists tenants_slug_idx on tenants(slug);

-- updated_at trigger
create trigger tenants_updated_at
  before update on tenants
  for each row execute function update_updated_at();

-- Comments
comment on column tenants.slug      is 'URL-safe, human-readable tenant identifier. Unique. Derived from name.';
comment on column tenants.plan      is 'Billing plan: starter | pro | enterprise.';
comment on column tenants.status    is 'Account status: active | suspended | trial | churned.';
comment on column tenants.settings  is 'Per-tenant runtime config overrides (SLA targets, feature flags, etc.).';
