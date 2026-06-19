-- 008_vault_credentials.sql
-- Adds vault username/password columns to tenants.
-- vault_client_id / vault_client_secret remain for future OAuth flow.
-- vault_username / vault_password are the current username+password auth method.

alter table tenants
  add column if not exists vault_username text,
  add column if not exists vault_password text,
  add column if not exists vault_api_version text default 'v24.1';
