-- 003_cases.sql
-- Inquiry metadata ONLY — no case text, no HCP PII, no PHI.
-- All identifiable data stays in Vault.

create table if not exists cases (
  id               bigserial primary key,
  tenant_id        uuid references tenants(id) on delete cascade,
  vault_case_id    text not null unique,     -- MedInquiry case ID from Vault
  product          text,
  topic_category   text,                     -- from Vault topic__v field
  channel          text,                     -- email | crm | phone | web
  status           text,                     -- open | in_review | fulfilled | closed
  priority         text,                     -- standard | urgent | critical
  hcp_specialty    text,                     -- oncologist | cardiologist etc (NO name stored)
  hcp_institution  text,                     -- hospital name only
  country          text,
  submitted_at     timestamptz not null,
  assigned_at      timestamptz,
  fulfilled_at     timestamptz,
  sla_deadline     timestamptz,              -- computed: submitted_at + sla_hours
  sla_hours_target integer not null default 48,
  is_off_label     boolean not null default false,
  vault_synced_at  timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists cases_tenant_status     on cases(tenant_id, status);
create index if not exists cases_tenant_submitted  on cases(tenant_id, submitted_at desc);
create index if not exists cases_sla_deadline      on cases(sla_deadline) where status != 'fulfilled';
create index if not exists cases_vault_case_id     on cases(vault_case_id);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger cases_updated_at
  before update on cases
  for each row execute function update_updated_at();

-- RLS
alter table cases enable row level security;
create policy "auth_read_cases" on cases for select using (auth.role() = 'authenticated');
create policy "service_write_cases" on cases for all using (auth.role() = 'service_role');

comment on table cases is 'MedInquiry case metadata only. No PHI. Synced from Veeva Vault.';
comment on column cases.hcp_specialty is 'HCP specialty category only — no name, no contact info stored.';
comment on column cases.hcp_institution is 'Institution name only — no individual identifiers stored.';
