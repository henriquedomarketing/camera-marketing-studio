-- Corrige a política de leitura de PNGs privados por cliente.
-- Antes, a coluna "name" sem qualificação era resolvida como companies.name
-- dentro da subconsulta, tornando o filtro invisível para os clientes.
-- Agora usa explicitamente storage.objects.name e o diretório da empresa.
-- Não altera arquivos existentes e não concede leitura pública.

alter policy "private png admin or company read"
on storage.objects
using (
  bucket_id = 'company-filters'
  and (
    private.is_admin()
    or exists (
      select 1
      from public.profiles as p
      join public.companies as c on c.id = p.company_id
      where p.id = (select auth.uid())
        and p.role = 'client'
        and c.active is true
        and (storage.foldername(storage.objects.name))[1] = p.company_id::text
    )
  )
);
