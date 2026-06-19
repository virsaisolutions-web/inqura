-- ============================================================
-- Inqura — Phase 1 Seed (run after 02_rls.sql)
-- ============================================================
-- Run this once to bootstrap a single-tenant setup.
--
-- STEPS:
--   1. Run 01_schema.sql
--   2. Run 02_rls.sql
--   3. Create your first user in Supabase Dashboard → Authentication → Users
--      (set user_metadata: { "role": "admin" } in the user record)
--   4. Run this script
--
-- What this does:
--   a. Creates the single tenant row for your company
--   b. Links all existing auth.users to that tenant
--      (role is read from user_metadata.role, defaulting to "user")
-- ============================================================

-- ── Step A: Create tenant ─────────────────────────────────────────────────────
-- Edit name and slug for your company. Leave vault_* fields empty —
-- you'll fill them in via Settings → Vault Configuration in the app.

insert into tenants (name, slug, plan, status)
values (
  'Arcturus Pharma',    -- ← change to your company name
  'arcturus',           -- ← change to url-safe slug (lowercase, no spaces)
  'trial',
  'active'
)
on conflict do nothing;


-- ── Step B: Seed all existing auth.users into the tenant ─────────────────────
-- Reads role from user_metadata.role (set in Supabase Auth dashboard).
-- Defaults to 'user' if not set.
-- Safe to re-run — ON CONFLICT updates role.

insert into tenant_users (tenant_id, user_id, role, joined_at, invited_by)
select
  t.id                                                         as tenant_id,
  u.id                                                         as user_id,
  coalesce((u.raw_user_meta_data->>'role')::text, 'user')     as role,
  u.created_at                                                 as joined_at,
  null                                                         as invited_by
from
  auth.users u
  cross join (select id from tenants order by created_at asc limit 1) t
on conflict (tenant_id, user_id) do update
  set role       = excluded.role,
      updated_at = now();


-- ── Verify ────────────────────────────────────────────────────────────────────
-- Run these selects after the seed to confirm everything looks right:
--
--   select id, name, slug, plan, status from tenants;
--   select tu.user_id, tu.role, u.email
--     from tenant_users tu
--     join auth.users u on u.id = tu.user_id;
