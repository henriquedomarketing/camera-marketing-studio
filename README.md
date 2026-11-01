# Camera Marketing Studio

Plataforma web independente para até **100 empresas**, com painel administrativo, categorias, filtros PNG transparentes sobre câmera, controle de vencimentos e gestão de contas.

## Infraestrutura
- **Supabase:** projeto `imfgumnpbxhbrjlkiphf`, São Paulo (PostgreSQL + Auth + Storage).
- **Bucket privado:** `company-filters` (PNG, até 12 MB por arquivo).
- **Função segura:** `manage-client` (cadastro de empresa e login; redefinição de senha; exclusão).
- **Frontend:** HTML, CSS, JavaScript e `@supabase/supabase-js`.
- **Hospedagem pretendida:** Vercel.

## Como rodar
Use um servidor estático em HTTPS em produção. Para testar localmente:
```sh
python3 -m http.server 5173
```
Abra http://localhost:5173. A câmera do celular exige HTTPS.

## Primeiro administrador
1. Registre a conta no frontend e confirme o e-mail.
2. Identifique o usuário correto em Supabase Authentication.
3. Como proprietário, no **SQL Editor** do projeto (somente após confirmar identidade da conta), execute:
```sql
update public.profiles set role='admin', company_id=null
where id=(select id from auth.users where email='EMAIL_CONFIRMADO_DO_ADMINISTRADOR');
```
4. Entre novamente no painel.

## Segurança
Todas as tabelas de negócio têm RLS habilitada. Cada empresa acessa somente seu conteúdo. Senhas são geridas pelo Supabase Auth. **Nunca publique uma service_role ou API secreta**. O frontend usa somente a chave publishable.

## Estado
Banco, tabelas, regras e Edge Function foram provisionados. Ainda são necessários publicar e testar o frontend real e habilitar o administrador. A versão demonstrativa anterior é independente e não guarda clientes reais.

## Para desenvolver com IA ou programador
Consulte `docs/ARCHITECTURE.md`, `supabase/migrations/` e `supabase/functions/`. Não faça alterações no projeto Flutter/Firebase antigo. Cada mudança de banco deve gerar nova migração e ser testada, sem abrir permissões irrestritas.
