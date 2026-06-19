-- 001_tenants.sql
-- Future-proofing for multi-tenancy; Phase 1 = single row

create table if not exists tenants (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  vault_url           text not null,       -- e.g. https://[company].veevavault.com
  vault_client_id     text not null,
  vault_client_secret text not null,       -- encrypted via Supabase Vault secrets in production
  created_at          timestamptz default now()
);

comment on table tenants is 'Phase 1: single row for the initial client. Phase 3: one row per customer.';
