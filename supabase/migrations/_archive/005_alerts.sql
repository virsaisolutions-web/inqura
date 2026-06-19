-- 005_alerts.sql

create table if not exists alerts (
  id           bigserial primary key,
  tenant_id    uuid references tenants(id) on delete cascade,
  case_id      bigint references cases(id) on delete cascade,
  alert_type   text not null check (alert_type in ('sla_risk', 'sla_breach', 'topic_spike', 'escalated')),
  severity     text not null check (severity in ('critical', 'warning', 'info')),
  message      text not null,
  is_read      boolean not null default false,
  triggered_at timestamptz not null default now(),
  resolved_at  timestamptz
);

create index if not exists alerts_tenant_unread    on alerts(tenant_id, is_read) where is_read = false;
create index if not exists alerts_tenant_triggered on alerts(tenant_id, triggered_at desc);
create index if not exists alerts_case_id          on alerts(case_id);

alter table alerts enable row level security;
create policy "auth_read_alerts"  on alerts for select using (auth.role() = 'authenticated');
create policy "auth_write_alerts" on alerts for update using (auth.role() = 'authenticated');
create policy "service_all_alerts" on alerts for all using (auth.role() = 'service_role');

comment on table alerts is 'SLA risk/breach alerts and topic spikes. Drives the alert bell and dashboard cards.';
