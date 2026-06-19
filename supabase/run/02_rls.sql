-- ============================================================
-- Inqura — Row Level Security (run after 01_schema.sql)
-- ============================================================
-- Pattern:
--   SELECT  → tenant_id = current_tenant_id()
--   INSERT  → tenant_id = current_tenant_id()
--   UPDATE  → tenant_id = current_tenant_id()
--   service_role → unrestricted (used by API routes + cron jobs)
--
-- NOTE: service_role bypasses RLS entirely in Supabase.
-- All server-side code using SUPABASE_SERVICE_ROLE_KEY is unaffected.
-- ============================================================


-- ── tenants ───────────────────────────────────────────────────────────────────

alter table tenants enable row level security;

create policy "tenants_member_select" on tenants
  for select using (id = current_tenant_id());

create policy "tenants_admin_update" on tenants
  for update using (id = current_tenant_id() and is_tenant_admin())
  with check   (id = current_tenant_id() and is_tenant_admin());

create policy "tenants_service_all" on tenants
  for all using (auth.role() = 'service_role');


-- ── tenant_users ──────────────────────────────────────────────────────────────

alter table tenant_users enable row level security;

-- Users can see all members of their own tenant
create policy "tenant_users_select" on tenant_users
  for select using (
    tenant_id = (
      select tenant_id from tenant_users tu
      where tu.user_id = auth.uid() and tu.is_active = true
      limit 1
    )
  );

-- Only service role writes (admin UI calls /api/admin/* which uses service role)
create policy "tenant_users_service_all" on tenant_users
  for all using (auth.role() = 'service_role');


-- ── cases ─────────────────────────────────────────────────────────────────────

alter table cases enable row level security;

create policy "cases_tenant_select" on cases
  for select using (tenant_id = current_tenant_id());

create policy "cases_tenant_insert" on cases
  for insert with check (tenant_id = current_tenant_id());

create policy "cases_tenant_update" on cases
  for update using  (tenant_id = current_tenant_id())
  with check        (tenant_id = current_tenant_id());

create policy "cases_service_all" on cases
  for all using (auth.role() = 'service_role');


-- ── alerts ────────────────────────────────────────────────────────────────────

alter table alerts enable row level security;

create policy "alerts_tenant_select" on alerts
  for select using (tenant_id = current_tenant_id());

create policy "alerts_tenant_update" on alerts
  for update using (tenant_id = current_tenant_id())
  with check       (tenant_id = current_tenant_id());

create policy "alerts_service_all" on alerts
  for all using (auth.role() = 'service_role');


-- ── metrics_daily ─────────────────────────────────────────────────────────────

alter table metrics_daily enable row level security;

create policy "metrics_tenant_select" on metrics_daily
  for select using (tenant_id = current_tenant_id());

create policy "metrics_service_all" on metrics_daily
  for all using (auth.role() = 'service_role');


-- ── audit_log ─────────────────────────────────────────────────────────────────
-- Admins can read their tenant's log. Only service role can insert.

alter table audit_log enable row level security;

create policy "audit_tenant_select" on audit_log
  for select using (
    tenant_id = current_tenant_id()
    and is_tenant_admin()
  );

create policy "audit_service_all" on audit_log
  for all using (auth.role() = 'service_role');


-- ── sync_log ──────────────────────────────────────────────────────────────────

alter table sync_log enable row level security;

create policy "sync_log_tenant_select" on sync_log
  for select using (tenant_id = current_tenant_id());

create policy "sync_log_service_all" on sync_log
  for all using (auth.role() = 'service_role');


-- ── integrations ──────────────────────────────────────────────────────────────
-- Admin-only read. Service role writes (raw URL never returned to browser).

alter table integrations enable row level security;

create policy "integrations_tenant_admin_select" on integrations
  for select using (
    tenant_id = current_tenant_id()
    and is_tenant_admin()
  );

create policy "integrations_service_all" on integrations
  for all using (auth.role() = 'service_role');
