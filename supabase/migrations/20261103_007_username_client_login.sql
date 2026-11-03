-- Client login by username only. Administrator still signs in with email.
-- An internal Auth email is generated on the server; clients never need an email.
alter table public.companies
  add column if not exists login_username text;

alter table public.companies
  add constraint companies_login_username_format
  check (
    login_username is null
    or login_username ~ '^[a-z][a-z0-9_-]{2,31}$'
  );

create unique index if not exists companies_login_username_unique
  on public.companies (lower(login_username))
  where login_username is not null;

comment on column public.companies.login_username is
  'Public-facing login username for this company. Internal Supabase Auth email is hidden from clients.';
