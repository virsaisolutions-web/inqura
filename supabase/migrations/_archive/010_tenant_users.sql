-- 010_tenant_users.sql
--
-- The core multi-tenancy join table: maps auth.users → tenants with a role.
--
-- Design decisions:
--   1. No direct FK to auth.users — Supabase auth schema is separate;
--      referential integrity enforced in application code + DB trigger.
--   2. One user CAN belong to multiple tenants (future: agency/consultant use case).
--      current_tenant_id() returns the first active tenant — good enough for Phase 1.
--   3. Role lives here (not in user_metadata) so it's queryable in SQL/RLS.
--      user_metadata.role kept in sync for fast client-side checks.
--   4. soft-delete via is_active — preserves audit trail on access revoke.

create table if not exists tenant_users (
  id          bigserial primary key,
  tenant_id   uuid not null references tenants(id) on delete cascade,
  user_id     uuid not null,                    -- auth.users.id (no FK — cross-schema)
  role        text not null default 'user',     -- admin | user | viewer
  invited_by  uuid,                             -- user_id of inviting admin (nullable = seeded)
  invited_at  timestamptz not null default now(),
  joined_at   timestamptz,                      -- set when user first signs in after invite
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique(tenant_id, user_id),
  constraint tenant_users_role_check check (role in ('admin', 'user', 'viewer'))
);

-- Indexes
create index if not exists tenant_users_user_id   on tenant_users(user_id)   where is_active = true;
create index if not exists tenant_users_tenant_id on tenant_users(tenant_id) where is_active = true;

-- updated_at trigger
create trigger tenant_users_updated_at
  before update on tenant_users
  for each row execute function update_updated_at();

-- RLS
alter table tenant_users enable row level security;

-- Users can see members of their own tenant
create policy "tenant_users_select" on tenant_users
  for select using (
    tenant_id = (
      select tenant_id from tenant_users tu
      where tu.user_id = auth.uid() and tu.is_active = true
      limit 1
    )
  );

-- Only service role writes (admin UI uses service role key via API routes)
create policy "tenant_users_service_all" on tenant_users
  for all using (auth.role() = 'service_role');

comment on table tenant_users is 'Maps auth users to tenants with role. Core multi-tenancy join table.';
comment on column tenant_users.role      is 'admin: full settings access | user: dashboard read/write | viewer: read-only.';
comment on column tenant_users.is_active is 'False = access revoked. Row kept for audit trail.';


-- ── Helper functions (security definer = runs as DB owner, bypasses RLS) ─────

-- Returns the active tenant_id for the currently authenticated user.
-- Used in every RLS policy below. Returns NULL if user has no tenant mapping.
create or replace function current_tenant_id()
returns uuid
language sql stable
security definer
set search_path = public
as $$
  select tenant_id
  from tenant_users
  where user_id = auth.uid()
    and is_active = true
  order by created_at asc   -- oldest membership = primary tenant
  limit 1
$$;

comment on function current_tenant_id is
  'Returns the primary tenant_id for the current auth session. Used in all RLS policies.';


-- Returns the role of the current user within their tenant.
create or replace function current_user_role()
returns text
language sql stable
security definer
set search_path = public
as $$
  select role
  from tenant_users
  where user_id = auth.uid()
    and is_active = true
  order by created_at asc
  limit 1
$$;

comment on function current_user_role is
  'Returns the role (admin|user|viewer) of the current auth session within their tenant.';


-- Checks whether current user is an admin in their tenant.
create or replace function is_tenant_admin()
returns boolean
language sql stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from tenant_users
    where user_id = auth.uid()
      and is_active = true
      and role = 'admin'
  )
$$;

comment on function is_tenant_admin is
  'Returns true if the current user has the admin role in any of their active tenants.';
