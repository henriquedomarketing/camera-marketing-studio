-- Access pause is independent of financial/active status.
-- Existing companies remain accessible; no invoices or payment history are modified.
alter table public.companies
  add column if not exists access_paused boolean not null default false;

-- Return just the own company row (including pause status) after authentication.
-- Categories, filters and files remain protected while access is paused.
create or replace function private.is_own_company(company uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.profiles p
    where p.id=(select auth.uid()) and p.role='client' and p.company_id=company
  )
$$;
revoke all on function private.is_own_company(uuid) from public,anon;
grant execute on function private.is_own_company(uuid) to authenticated;

create or replace function private.has_active_company(company uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.profiles p
    join public.companies c on c.id=p.company_id
    where p.id=(select auth.uid()) and p.role='client'
      and c.id=company and c.active and not c.access_paused
  )
$$;
revoke all on function private.has_active_company(uuid) from public,anon;
grant execute on function private.has_active_company(uuid) to authenticated;

alter policy "companies read own or admin" on public.companies
  to authenticated using(private.is_admin() or private.is_own_company(id));

-- The branding setting currently stores app name + public WhatsApp support,
-- so it may safely be read by any authenticated user, even if paused.
-- Other settings remain admin-only.
create policy "settings support info read" on public.app_settings
  for select to authenticated using (key='branding');

-- Deny storage access for paused clients (admin can continue testing all PNGs).
alter policy "private png admin or company read" on storage.objects
  to authenticated
  using(
    bucket_id='company-filters' and (
      private.is_admin()
      or exists(
        select 1 from public.profiles p
        join public.companies c on c.id=p.company_id
        where p.id=(select auth.uid()) and p.role='client'
          and c.active and not c.access_paused
          and split_part(name,'/',1)=p.company_id::text
      )
    )
  );
