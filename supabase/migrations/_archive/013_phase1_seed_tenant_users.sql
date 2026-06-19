-- 013_phase1_seed_tenant_users.sql
--
-- Phase 1 bootstrapping: links existing auth.users to the existing tenant row.
-- Run this ONCE after migrations 009–012.
--
-- In Phase 3 (multi-tenant), this is replaced by the invite/onboarding flow
-- which inserts into tenant_users automatically.
--
-- HOW TO USE:
--   1. Run migrations 009–012 first.
--   2. Find your tenant id:   select id from tenants limit 1;
--   3. Find each user id:     select id, email from auth.users;
--   4. Replace placeholders below and run this script.
--
-- Alternatively, the admin invite API (POST /api/admin/invite-user) automatically
-- inserts into tenant_users when onboarding new users going forward.

-- ── Option A: Auto-seed all existing auth users into the single tenant ────────
-- Safe for Phase 1 where the single tenant owns all existing users.
-- admin role is set via user_metadata.role — here we sync that to tenant_users.role.

insert into tenant_users (tenant_id, user_id, role, joined_at, invited_by)
select
  t.id                                                   as tenant_id,
  u.id                                                   as user_id,
  coalesce((u.raw_user_meta_data->>'role')::text, 'user') as role,
  u.created_at                                           as joined_at,
  null                                                   as invited_by  -- seeded, no inviter
from
  auth.users u
  cross join (select id from tenants order by created_at asc limit 1) t
on conflict (tenant_id, user_id) do update
  set role = excluded.role,
      updated_at = now();

comment on table tenant_users is
  'Maps auth users to tenants. Seeded for Phase 1 via 013_phase1_seed_tenant_users.sql.
   Phase 3: populated by invite flow (POST /api/admin/invite-user).';
