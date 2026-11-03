-- Source of truth: migration applied to Supabase project imfgumnpbxhbrjlkiphf (2026-11-01).
-- If the tables already exist, DO NOT blindly re-apply this initialization to production.
create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  contact_email text, phone text, active boolean not null default true,
  monthly_fee numeric(12,2) not null default 0 check(monthly_fee >= 0),
  due_day int not null default 10 check(due_day between 1 and 31),
  next_due_date date, notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'client' check(role in ('admin','client')),
  company_id uuid references public.companies(id) on delete set null,
  display_name text, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_account_has_company_or_pending check(role='admin' or role='client')
);
create unique index profiles_one_client_login_per_company on public.profiles(company_id)
  where company_id is not null and role='client';
create index profiles_company_idx on public.profiles(company_id);
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null check(char_length(btrim(name)) between 1 and 100),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique(company_id,name)
);
create index categories_company_idx on public.categories(company_id,sort_order);
create table public.filters (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  name text not null check(char_length(btrim(name)) between 1 and 120),
  storage_path text not null unique,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index filters_company_idx on public.filters(company_id,category_id,sort_order);
create index filters_category_fk_idx on public.filters(category_id);
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  due_date date not null,
  amount numeric(12,2) not null check(amount >= 0),
  status text not null default 'pending' check(status in ('pending','paid','canceled')),
  paid_at timestamptz, notes text,
  created_at timestamptz not null default now()
);
create index invoices_due_idx on public.invoices(due_date,status);
create index invoices_company_idx on public.invoices(company_id);
create table public.app_settings (
  key text primary key,value jsonb not null,updated_at timestamptz not null default now()
);
insert into public.app_settings(key,value) values
  ('branding','{"appName":"Filtros Studio","supportWhatsapp":"","maxClients":100}'::jsonb);

create function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin')
$$;
revoke all on function private.is_admin() from public,anon;
grant execute on function private.is_admin() to authenticated;
create function private.has_active_company(company uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p join public.companies c on c.id=p.company_id
  where p.id=(select auth.uid()) and c.id=company and c.active and p.role='client')
$$;
revoke all on function private.has_active_company(uuid) from public,anon;
grant execute on function private.has_active_company(uuid) to authenticated;
create function private.create_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,role,display_name)
 values(new.id,'client',coalesce(new.raw_user_meta_data->>'display_name',''));
 return new;
end;$$;
create trigger on_auth_user_created_camera_studio after insert on auth.users
for each row execute function private.create_profile();
create function private.limit_companies() returns trigger language plpgsql set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(7300124);
 if(select count(*) from public.companies)>=100 then raise exception 'Limite de 100 clientes atingido'; end if;
 return new;
end;$$;
create trigger limit_camera_studio_companies before insert on public.companies
for each row execute function private.limit_companies();
create function private.validate_filter_category() returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from public.categories c where c.id=new.category_id and c.company_id=new.company_id)
 then raise exception 'Categoria pertence a outra empresa';end if;
 return new;
end;$$;
create trigger validate_camera_studio_filter before insert or update on public.filters
for each row execute function private.validate_filter_category();
create function private.touch_updated_at() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=now();return new;end;$$;
create trigger companies_updated_camera_studio before update on public.companies
for each row execute function private.touch_updated_at();
create trigger profiles_updated_camera_studio before update on public.profiles
for each row execute function private.touch_updated_at();
create trigger settings_updated_camera_studio before update on public.app_settings
for each row execute function private.touch_updated_at();

alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.filters enable row level security;
alter table public.invoices enable row level security;
alter table public.app_settings enable row level security;
create policy "companies read own or admin" on public.companies for select to authenticated
 using(private.is_admin() or private.has_active_company(id));
create policy "companies admin insert" on public.companies for insert to authenticated with check(private.is_admin());
create policy "companies admin update" on public.companies for update to authenticated
 using(private.is_admin()) with check(private.is_admin());
create policy "companies admin delete" on public.companies for delete to authenticated using(private.is_admin());
create policy "profiles self or admin read" on public.profiles for select to authenticated
 using(id=(select auth.uid()) or private.is_admin());
-- No client INSERT/UPDATE/DELETE policy on profiles: only service-side admin operations.
create policy "categories own or admin read" on public.categories for select to authenticated
 using(private.is_admin() or private.has_active_company(company_id));
create policy "categories admin insert" on public.categories for insert to authenticated with check(private.is_admin());
create policy "categories admin update" on public.categories for update to authenticated
 using(private.is_admin()) with check(private.is_admin());
create policy "categories admin delete" on public.categories for delete to authenticated using(private.is_admin());
create policy "filters own or admin read" on public.filters for select to authenticated
 using(private.is_admin() or (active and private.has_active_company(company_id)));
create policy "filters admin insert" on public.filters for insert to authenticated with check(private.is_admin());
create policy "filters admin update" on public.filters for update to authenticated
 using(private.is_admin()) with check(private.is_admin());
create policy "filters admin delete" on public.filters for delete to authenticated using(private.is_admin());
create policy "invoices own or admin read" on public.invoices for select to authenticated
 using(private.is_admin() or private.has_active_company(company_id));
create policy "invoices admin insert" on public.invoices for insert to authenticated with check(private.is_admin());
create policy "invoices admin update" on public.invoices for update to authenticated
 using(private.is_admin()) with check(private.is_admin());
create policy "invoices admin delete" on public.invoices for delete to authenticated using(private.is_admin());
create policy "settings admin read" on public.app_settings for select to authenticated using(private.is_admin());
create policy "settings admin insert" on public.app_settings for insert to authenticated with check(private.is_admin());
create policy "settings admin update" on public.app_settings for update to authenticated
 using(private.is_admin()) with check(private.is_admin());
grant usage on schema public to authenticated;
grant select,insert,update,delete on public.companies,public.categories,public.filters,public.invoices to authenticated;
grant select on public.profiles to authenticated;
grant select,insert,update on public.app_settings to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('company-filters','company-filters',false,12582912,array['image/png']::text[]);
create policy "private png admin or company read" on storage.objects for select to authenticated
 using(bucket_id='company-filters' and (private.is_admin() or exists(
 select 1 from public.profiles p join public.companies c on c.id=p.company_id
 where p.id=(select auth.uid()) and p.role='client' and c.active
 and split_part(name,'/',1)=p.company_id::text)));
create policy "private png admin upload" on storage.objects for insert to authenticated
 with check(bucket_id='company-filters' and private.is_admin());
create policy "private png admin update" on storage.objects for update to authenticated
 using(bucket_id='company-filters' and private.is_admin())
 with check(bucket_id='company-filters' and private.is_admin());
create policy "private png admin delete" on storage.objects for delete to authenticated
 using(bucket_id='company-filters' and private.is_admin());
