-- Identidade visual por empresa: logotipo PNG 500x500 e duas cores hexadecimais.
-- Logo privado em company-filters/{company_id}/branding/{uuid}.png.
-- Mesmas regras Storage RLS existentes continuam valendo (admin grava, cliente da empresa lê).
alter table public.companies
  add column if not exists logo_path text,
  add column if not exists primary_color text not null default '#071C70',
  add column if not exists accent_color text not null default '#DB2032';
alter table public.companies
  add constraint companies_primary_color_hex check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  add constraint companies_accent_color_hex check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  add constraint companies_logo_path_own_folder check (
    logo_path is null or (
      split_part(logo_path, '/', 1) = id::text
      and logo_path ~ ('^' || id::text || '/branding/[0-9a-f-]{36}\.png$')
    )
  );
comment on column public.companies.logo_path is 'Caminho PNG 500x500 na pasta exclusiva da empresa no bucket company-filters.';
