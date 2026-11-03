-- Rebrand the SaaS without recreating the project or changing tenant data.
-- This updates only the platform display name; all other branding settings are preserved.
update public.app_settings
set value=jsonb_set(coalesce(value,'{}'::jsonb),'{appName}',to_jsonb('Filtros Studio'::text),true)
where key='branding';
