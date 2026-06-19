-- 011_rls_tenant_isolation.sql
--
-- Replaces all permissive "any authenticated user" RLS policies with
-- proper tenant-scoped isolation using current_tenant_id().
--
-- Pattern for every table:
--   SELECT  → tenant_id = current_tenant_id()
--   INSERT  → tenant_id = current_tenant_id()  (prevents cross-tenant writes)
--   UPDATE  → tenant_id = current_tenant_id()
--   DELETE  → service_role only (hard deletes require elevated privilege)
--   ALL     → service_role (sync jobs, cron, admin API routes)
--
-- service_role bypasses RLS entirely in Supabase — so all server-side
-- API routes and Edge Functions that use SUPABASE_SERVICE_ROLE_KEY are
-- unaffected by these policies.

-- ── cases ─────────────────────────────────────────────────────────────────────

drop policy if exists "auth_read_cases"    on cases;
drop policy if exists "service_write_cases" on cases;

create policy "cases_tenant_select" on cases
  for select using (tenant_id = current_tenant_id());

create policy "cases_tenant_insert" on cases
  for insert with check (tenant_id = current_tenant_id());

create policy "cases_tenant_update" on cases
  for update using (tenant_id = current_tenant_id())
  with check  (tenant_id = current_tenant_id());

create policy "cases_service_all" on cases
  for all using (auth.role() = 'service_role');


-- ── alerts ────────────────────────────────────────────────────────────────────

drop policy if exists "auth_read_alerts"   on alerts;
drop policy if exists "auth_write_alerts"  on alerts;
drop policy if exists "service_all_alerts" on alerts;

create policy "alerts_tenant_select" on alerts
  for select using (tenant_id = current_tenant_id());

create policy "alerts_tenant_update" on alerts
  for update using (tenant_id = current_tenant_id())
  with check  (tenant_id = current_tenant_id());

create policy "alerts_service_all" on alerts
  for all using (auth.role() = 'service_role');


-- ── metrics_daily ─────────────────────────────────────────────────────────────

drop policy if exists "auth_read_metrics" on metrics_daily;

create policy "metrics_tenant_select" on metrics_daily
  for select using (tenant_id = current_tenant_id());

create policy "metrics_service_all" on metrics_daily
  for all using (auth.role() = 'service_role');


-- ── audit_log ─────────────────────────────────────────────────────────────────
-- Audit log: admins can read their tenant's log; no user writes (service only)

alter table audit_log enable row level security;

drop policy if exists "auth_read_audit" on audit_log;

create policy "audit_tenant_select" on audit_log
  for select using (
    tenant_id = current_tenant_id()
    and is_tenant_admin()  -- only admins can view the audit log
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
-- Webhook configs: admin-only read; service-only write

alter table integrations enable row level security;

drop policy if exists "auth_read_integrations" on integrations;

create policy "integrations_tenant_admin_select" on integrations
  for select using (
    tenant_id = current_tenant_id()
    and is_tenant_admin()
  );

create policy "integrations_service_all" on integrations
  for all using (auth.role() = 'service_role');


-- ── tenants ───────────────────────────────────────────────────────────────────
-- Users can read their own tenant row; admins can update; service has full access

alter table tenants enable row level security;

create policy "tenants_member_select" on tenants
  for select using (
    id = current_tenant_id()
  );

create policy "tenants_admin_update" on tenants
  for update using (
    id = current_tenant_id()
    and is_tenant_admin()
  );

create policy "tenants_service_all" on tenants
  for all using (auth.role() = 'service_role');
