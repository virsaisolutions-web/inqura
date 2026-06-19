-- 007_integrations.sql
-- Stores webhook integration config per tenant.
-- Webhook URLs are sensitive — only accessible server-side via service role key.

create table integrations (
  id           bigserial primary key,
  tenant_id    uuid references tenants(id),
  type         text not null,          -- 'slack' | 'teams' | 'custom'
  webhook_url  text not null,
  enabled      boolean default true,
  label        text,                   -- optional display name e.g. "#med-affairs-alerts"
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  unique(tenant_id, type)
);

-- Only service role can read/write (webhook URLs must never reach the browser)
alter table integrations enable row level security;

-- No client-side access — all reads go through API routes using service role key
-- (no RLS policy = authenticated users cannot access this table directly)

-- Trigger to keep updated_at current
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger integrations_updated_at
  before update on integrations
  for each row execute function set_updated_at();
