-- Fix ambiguous 'name' in the Storage RLS policy.
-- The former policy accidentally compared companies.name instead of storage.objects.name,
-- blocking clients from reading their own company logo and filter PNGs.
-- Admin access remains unchanged; clients can only read objects from their own
-- company folder while their company is active and access is not paused.
alter policy "private png admin or company read" on storage.objects
  to authenticated
  using (
    bucket_id = 'company-filters'
    and (
      private.is_admin()
      or exists (
        select 1
        from public.profiles p
        join public.companies c on c.id = p.company_id
        where p.id = (select auth.uid())
          and p.role = 'client'
          and c.active
          and not c.access_paused
          and storage.objects.name like (p.company_id::text || '/%')
      )
    )
  );
