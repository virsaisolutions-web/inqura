-- 004_metrics_daily.sql
-- Pre-aggregated daily metrics. Refreshed nightly by cron.

create table if not exists metrics_daily (
  id               bigserial primary key,
  tenant_id        uuid references tenants(id) on delete cascade,
  metric_date      date not null,
  product          text,                    -- null = all products aggregate
  total_cases      integer not null default 0,
  fulfilled_cases  integer not null default 0,
  sla_met          integer not null default 0,
  sla_breached     integer not null default 0,
  avg_response_h   numeric(6,2),
  topic_breakdown  jsonb,                   -- { "Dosing": 12, "Off-label": 7, ... }
  channel_breakdown jsonb,                  -- { "email": 30, "crm": 15, ... }
  unique(tenant_id, metric_date, product)
);

create index if not exists metrics_daily_tenant_date on metrics_daily(tenant_id, metric_date desc);

alter table metrics_daily enable row level security;
create policy "auth_read_metrics" on metrics_daily for select using (auth.role() = 'authenticated');
create policy "service_write_metrics" on metrics_daily for all using (auth.role() = 'service_role');

comment on table metrics_daily is 'Nightly pre-aggregated metrics per product per day. Drives all dashboard charts.';
comment on column metrics_daily.product is 'NULL row = cross-product aggregate for the day.';
