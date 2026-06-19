-- ============================================================
-- Inqura — Report Jobs (run after 02_rls.sql)
-- ============================================================
-- Tracks async PDF generation requests.
-- Lambda polls this table every minute for pending jobs.
-- ============================================================

create table if not exists report_jobs (
  id            uuid        primary key default gen_random_uuid(),
  tenant_id     uuid        references tenants(id),
  requested_by  text        not null,   -- user email
  period        text        not null,   -- e.g. "2025-06"
  status        text        not null default 'pending',
  download_url  text,                   -- signed Supabase Storage URL when complete
  error_msg     text,
  created_at    timestamptz not null default now(),
  completed_at  timestamptz,

  constraint report_jobs_status_check
    check (status in ('pending', 'generating', 'complete', 'error'))
);

create index if not exists report_jobs_tenant_status
  on report_jobs(tenant_id, status, created_at desc);

-- RLS: users can see their own tenant's jobs; service role writes
alter table report_jobs enable row level security;

create policy "report_jobs_tenant_select" on report_jobs
  for select using (tenant_id = current_tenant_id());

create policy "report_jobs_service_all" on report_jobs
  for all using (auth.role() = 'service_role');

-- Supabase Storage bucket for generated PDFs
-- Run this in Supabase Dashboard → Storage → New bucket, name: "reports", private: true
-- OR run via SQL:
insert into storage.buckets (id, name, public)
values ('reports', 'reports', false)
on conflict (id) do nothing;

-- Storage RLS: only authenticated users in the tenant can read their reports
create policy "reports_bucket_select" on storage.objects
  for select using (
    bucket_id = 'reports'
    and auth.role() = 'authenticated'
  );

create policy "reports_bucket_service_all" on storage.objects
  for all using (
    bucket_id = 'reports'
    and auth.role() = 'service_role'
  );
