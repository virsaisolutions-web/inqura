-- 012_indexes_and_constraints.sql
--
-- Performance indexes for multi-tenant query patterns + data integrity constraints.
-- All indexes are concurrent-safe (IF NOT EXISTS).

-- ── cases: additional composite indexes ───────────────────────────────────────

-- Dashboard: open cases by tenant, sorted by SLA urgency
create index if not exists cases_tenant_open_sla
  on cases(tenant_id, sla_deadline asc)
  where status not in ('fulfilled', 'closed');

-- SLA breach detection: fulfilled cases within a date range
create index if not exists cases_tenant_fulfilled
  on cases(tenant_id, fulfilled_at desc)
  where fulfilled_at is not null;

-- Product analytics queries
create index if not exists cases_tenant_product
  on cases(tenant_id, product, submitted_at desc);

-- Topic trend queries
create index if not exists cases_tenant_topic
  on cases(tenant_id, topic_category, submitted_at desc);

-- Incremental sync: find cases modified since last sync
create index if not exists cases_vault_synced_at
  on cases(tenant_id, vault_synced_at desc);

-- ── cases: data integrity constraints ─────────────────────────────────────────

alter table cases
  add constraint if not exists cases_status_check
    check (status in ('open', 'in_review', 'fulfilled', 'closed', 'on_hold')),

  add constraint if not exists cases_priority_check
    check (priority in ('standard', 'urgent', 'critical')),

  add constraint if not exists cases_channel_check
    check (channel in ('email', 'crm', 'phone', 'web', 'fax', 'other')),

  add constraint if not exists cases_sla_hours_check
    check (sla_hours_target > 0 and sla_hours_target <= 720),

  -- fulfilled_at must be after submitted_at
  add constraint if not exists cases_dates_check
    check (fulfilled_at is null or fulfilled_at >= submitted_at),

  -- sla_deadline must be after submitted_at
  add constraint if not exists cases_sla_deadline_check
    check (sla_deadline is null or sla_deadline >= submitted_at);


-- ── metrics_daily ─────────────────────────────────────────────────────────────

-- Date range queries for trend charts
create index if not exists metrics_daily_tenant_date
  on metrics_daily(tenant_id, metric_date desc);

-- Product breakdown queries
create index if not exists metrics_daily_tenant_product_date
  on metrics_daily(tenant_id, product, metric_date desc);

-- Constraints
alter table metrics_daily
  add constraint if not exists metrics_daily_counts_check
    check (
      total_cases >= 0
      and fulfilled_cases >= 0
      and sla_met >= 0
      and sla_breached >= 0
      and fulfilled_cases <= total_cases
      and sla_met + sla_breached <= fulfilled_cases
    );


-- ── alerts ────────────────────────────────────────────────────────────────────

-- Deduplication: prevent duplicate alerts for same case+type on same day
create unique index if not exists alerts_dedup
  on alerts(tenant_id, case_id, alert_type, (triggered_at::date))
  where resolved_at is null;


-- ── audit_log ─────────────────────────────────────────────────────────────────

-- Time-range queries for compliance reporting
create index if not exists audit_log_tenant_time
  on audit_log(tenant_id, created_at desc);

-- Filter by user (for access reviews)
create index if not exists audit_log_user_email
  on audit_log(tenant_id, user_email, created_at desc);

-- Filter by action type (for specific event audits)
create index if not exists audit_log_action
  on audit_log(tenant_id, action, created_at desc);


-- ── sync_log ──────────────────────────────────────────────────────────────────

create index if not exists sync_log_tenant_started
  on sync_log(tenant_id, started_at desc);

alter table sync_log
  add constraint if not exists sync_log_status_check
    check (status in ('running', 'success', 'error', 'skipped')),

  add constraint if not exists sync_log_type_check
    check (sync_type in ('full', 'incremental'));


-- ── integrations ──────────────────────────────────────────────────────────────

alter table integrations
  add constraint if not exists integrations_type_check
    check (type in ('slack', 'teams', 'custom', 'vault_credentials'));
