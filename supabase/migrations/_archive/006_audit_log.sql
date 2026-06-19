-- 006_audit_log.sql
-- 21 CFR Part 11 awareness: immutable record of every user action on PHI-adjacent data.

create table if not exists audit_log (
  id          bigserial primary key,
  tenant_id   uuid references tenants(id) on delete cascade,
  user_email  text,
  action      text not null,   -- 'viewed_case' | 'exported_report' | 'sync_triggered' | 'viewed_dashboard' | 'escalated_case'
  resource    text,            -- 'cases' | 'report' | 'dashboard' | 'sync'
  resource_id text,            -- e.g. vault_case_id or report period
  ip_address  text,
  created_at  timestamptz not null default now()
);

create index if not exists audit_log_tenant_created on audit_log(tenant_id, created_at desc);
create index if not exists audit_log_user_email     on audit_log(user_email);

-- Audit log is append-only: authenticated users can insert, nobody can update/delete
alter table audit_log enable row level security;
create policy "auth_insert_audit" on audit_log for insert with check (auth.role() = 'authenticated');
create policy "auth_read_audit"   on audit_log for select using (auth.role() = 'authenticated');
create policy "service_all_audit" on audit_log for all using (auth.role() = 'service_role');
-- NO update/delete policy → immutable append-only log

comment on table audit_log is '21 CFR Part 11 audit trail. Append-only. Records every view, export, and mutation by authenticated users.';
