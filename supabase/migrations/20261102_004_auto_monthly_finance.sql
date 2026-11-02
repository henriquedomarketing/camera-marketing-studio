-- O Financeiro passa a refletir automaticamente a mensalidade configurada na empresa.
-- Preserve cobranças manuais e o histórico de parcelas pagas. RLS existente continua valendo.
alter table public.invoices
  add column if not exists origin text not null default 'manual';

alter table public.invoices
  add constraint invoices_origin_valid check (origin in ('manual','monthly'));

create unique index if not exists invoices_monthly_company_due_unique
  on public.invoices(company_id,due_date) where origin='monthly';

-- Próximo vencimento não anterior à data-base, respeitando meses curtos.
create or replace function private.monthly_due_on_or_after(p_from date,p_day integer)
returns date language plpgsql stable set search_path='' as $$
declare
  base_month date;
  last_day integer;
  due_date date;
begin
  base_month := pg_catalog.date_trunc('month',p_from::timestamp)::date;
  last_day := pg_catalog.extract(day from (base_month + interval '1 month - 1 day'))::integer;
  due_date := base_month + (pg_catalog.least(p_day,last_day)-1);
  if due_date < p_from then
    base_month := (base_month + interval '1 month')::date;
    last_day := pg_catalog.extract(day from (base_month + interval '1 month - 1 day'))::integer;
    due_date := base_month + (pg_catalog.least(p_day,last_day)-1);
  end if;
  return due_date;
end;$$;

-- Próximo ciclo mensal a partir do vencimento que acabou de ser pago.
create or replace function private.monthly_due_after(p_due date,p_day integer)
returns date language plpgsql immutable set search_path='' as $$
declare
  next_month date := (pg_catalog.date_trunc('month',p_due::timestamp) + interval '1 month')::date;
  last_day integer;
begin
  last_day := pg_catalog.extract(day from (next_month + interval '1 month - 1 day'))::integer;
  return next_month + (pg_catalog.least(p_day,last_day)-1);
end;$$;

-- Cadastro sem "próximo vencimento": preencher automaticamente usando due_day.
create or replace function private.set_company_first_due()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.active and new.monthly_fee > 0 and new.next_due_date is null then
    new.next_due_date := private.monthly_due_on_or_after(current_date,new.due_day);
  end if;
  return new;
end;$$;

create trigger company_automatic_next_due
  before insert or update of active,monthly_fee,due_day,next_due_date
  on public.companies for each row execute function private.set_company_first_due();

-- A cobrança automática é gerada no banco após cadastrar ou alterar uma empresa.
-- Um único lançamento "monthly" por empresa+vencimento. Valores pagos nunca são alterados.
create or replace function private.sync_company_monthly_invoice()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  matching_id uuid;
  matching_status text;
  pending_id uuid;
begin
  -- Somente cobrança mensal automática; a cobrança manual continua independente.
  if not new.active or new.monthly_fee <= 0 then
    update public.invoices
       set status='canceled', paid_at=null
     where company_id=new.id and origin='monthly' and status='pending';
    return new;
  end if;

  if new.next_due_date is null then
    raise exception 'Informe o próximo vencimento para a mensalidade.';
  end if;

  select i.id,i.status
    into matching_id,matching_status
    from public.invoices i
   where i.company_id=new.id and i.origin='monthly'
     and i.due_date=new.next_due_date
   for update;

  if matching_id is not null then
    -- Paga = histórico imutável; cancelada pode ser reativada com o cadastro.
    if matching_status='pending' then
      update public.invoices set amount=new.monthly_fee
       where id=matching_id;
    elsif matching_status='canceled' then
      update public.invoices
         set amount=new.monthly_fee,status='pending',paid_at=null
       where id=matching_id;
    end if;
    update public.invoices set status='canceled',paid_at=null
     where company_id=new.id and origin='monthly'
       and status='pending' and id<>matching_id;
    return new;
  end if;

  select i.id into pending_id
    from public.invoices i
   where i.company_id=new.id and i.origin='monthly' and i.status='pending'
   order by i.due_date desc
   limit 1 for update;

  if pending_id is not null then
    update public.invoices
       set due_date=new.next_due_date,amount=new.monthly_fee
     where id=pending_id;
    -- Limpar cobranças mensais pendentes eventualmente deixadas por fluxo antigo.
    update public.invoices set status='canceled',paid_at=null
     where company_id=new.id and origin='monthly'
       and status='pending' and id<>pending_id;
  else
    insert into public.invoices(company_id,origin,due_date,amount,status,notes)
    values(new.id,'monthly',new.next_due_date,new.monthly_fee,'pending',
           'Mensalidade automática');
  end if;
  return new;
end;$$;

create trigger company_sync_monthly_invoice
  after insert or update of active,monthly_fee,due_day,next_due_date
  on public.companies for each row execute function private.sync_company_monthly_invoice();

-- Pagamento de mensalidade faz o próximo mês aparecer automaticamente no Financeiro.
-- Faturas de origem "manual" e pagamentos antigos não são afetados.
create or replace function private.advance_company_due_after_payment()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.origin='monthly'
     and new.status='paid' and old.status is distinct from 'paid' then
    update public.companies c
       set next_due_date=private.monthly_due_after(new.due_date,c.due_day)
     where c.id=new.company_id
       and c.active and c.monthly_fee>0
       and (c.next_due_date is null or c.next_due_date<=new.due_date);
  end if;
  return new;
end;$$;

create trigger monthly_invoice_paid_next_cycle
  after update of status on public.invoices
  for each row execute function private.advance_company_due_after_payment();

revoke all on function private.monthly_due_on_or_after(date,integer) from public,anon,authenticated;
revoke all on function private.monthly_due_after(date,integer) from public,anon,authenticated;
revoke all on function private.set_company_first_due() from public,anon,authenticated;
revoke all on function private.sync_company_monthly_invoice() from public,anon,authenticated;
revoke all on function private.advance_company_due_after_payment() from public,anon,authenticated;

-- Backfill seguro: cria mensalidade pendente para empresas já cadastradas.
-- NÃO gera boletos pagos retroativos nem altera lançamentos manuais.
update public.companies
   set monthly_fee=monthly_fee
 where active and monthly_fee>0;
