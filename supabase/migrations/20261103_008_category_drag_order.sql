-- Categorias aparecem na ordem definida pelo administrador, por empresa.
-- Nenhuma categoria ou filtro é removido.
-- Normalizar categorias antigas que ainda tinham todos os sort_order = 0.
with ranked as (
  select id, row_number() over (
    partition by company_id order by sort_order, created_at, id
  ) - 1 as position
  from public.categories
)
update public.categories c
set sort_order = ranked.position::integer
from ranked
where c.id = ranked.id and c.sort_order is distinct from ranked.position;

-- Toda nova categoria (inclusive criada ao enviar PNG) entra no final da lista.
create or replace function private.append_category_sort_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.companies where id = new.company_id for update;
  select coalesce(max(sort_order), -1) + 1
    into new.sort_order
    from public.categories
   where company_id = new.company_id;
  return new;
end;
$$;

create trigger categories_append_order
  before insert on public.categories
  for each row execute function private.append_category_sort_order();

-- Atualização atômica; exige admin, lista completa, IDs sem duplicidade
-- e que todas as categorias sejam da empresa selecionada.
create or replace function public.reorder_company_categories(
  p_company_id uuid,
  p_category_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  category_count integer;
  requested_count integer;
  distinct_count integer;
  owned_count integer;
begin
  if (select auth.uid()) is null or not private.is_admin() then
    raise exception 'Apenas o administrador pode ordenar categorias.'
      using errcode = '42501';
  end if;

  if p_company_id is null or p_category_ids is null then
    raise exception 'Empresa e categorias são obrigatórias.';
  end if;

  -- Serializa reordenação e inserção da mesma empresa.
  perform 1 from public.companies where id = p_company_id for update;
  if not found then
    raise exception 'Empresa não encontrada.';
  end if;

  select count(*) into category_count
    from public.categories where company_id = p_company_id;

  select count(*), count(distinct id)
    into requested_count, distinct_count
    from unnest(p_category_ids) as requested(id);

  select count(*) into owned_count
    from public.categories
   where company_id = p_company_id
     and id = any(p_category_ids);

  if requested_count <> category_count or
     distinct_count <> requested_count or
     owned_count <> category_count then
    raise exception 'Lista de categorias inválida ou desatualizada. Atualize a página e tente novamente.';
  end if;

  update public.categories as c
     set sort_order = ordered.position::integer - 1
    from unnest(p_category_ids) with ordinality as ordered(id, position)
   where c.id = ordered.id and c.company_id = p_company_id;
end;
$$;

revoke all on function public.reorder_company_categories(uuid,uuid[]) from public, anon;
grant execute on function public.reorder_company_categories(uuid,uuid[]) to authenticated;
revoke all on function private.append_category_sort_order() from public, anon, authenticated;
