-- 002_sync_log.sql

create table if not exists sync_log (
  id                 bigserial primary key,
  tenant_id          uuid references tenants(id) on delete cascade,
  sync_type          text not null check (sync_type in ('full', 'incremental')),
  started_at         timestamptz default now(),
  completed_at       timestamptz,
  records_processed  integer,
  status             text not null default 'running' check (status in ('running', 'success', 'error')),
  error_msg          text
);

create index if not exists sync_log_tenant_started on sync_log(tenant_id, started_at desc);

comment on table sync_log is 'Audit trail for every Vault sync operation.';
