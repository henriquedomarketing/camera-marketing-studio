# Arquitetura — Filtros Studio

## Visão geral

```
Safari/Chrome (HTML/CSS/JS)
      ├── Supabase Auth (admin: e-mail/senha; clientes: usuário/senha na interface)
      ├── Postgres + Data API (RLS obrigatória)
      ├── Storage privado company-filters/COMPANY_UUID/FILTER_UUID.png
      └── Edge Function manage-client (admin API, senhas, exclusão)
```

## Entidades

- `companies`: empresas, status ativo, mensalidade e vencimento; `login_username` exclusivo para o login sem e-mail do cliente.
- `profiles`: login Auth ↔ empresa; `role` restrito a `admin` ou `client`. Uma empresa possui no MVP um login cliente.
- `categories`: nome e ordem, sempre pertencentes a uma empresa.
- `filters`: PNGs privados vinculados a categorias, armazenados em `storage_path`.
- `invoices`: valor, vencimento e status manual (`pending`, `paid`, `canceled`).
- `app_settings`: configurações administrativas com valor JSON.

## Segurança

- `private.is_admin()` e `private.has_active_company(uuid)` consultam tabelas no banco em funções estáveis e `SECURITY DEFINER`, com search_path restrito e grants apenas para `authenticated`.
- Todas as tabelas públicas do aplicativo têm RLS ativada. Usuários comuns podem ler seu perfil, empresa ativa, categorias, filtros e cobranças próprias.
- O cliente não possui políticas de escrita. Apenas administradores têm políticas de modificação; contas/Auth são gerenciados no servidor.
- O `Storage` é privado com MIME `image/png` e limite 12 MB; uploads ficam limitados aos administradores.
- O backend `manage-client` valida a sessão real via `auth.getUser(token)` e verifica `profiles.role='admin'` antes de usar qualquer ação privilegiada.

## Operações

- Criar cliente: validar usuário único (3–32 caracteres), inserir empresa, criar usuário Supabase Auth com endereço interno técnico `usuario@usuarios.filtros.studio` e senha definida pelo administrador, confirmar internamente e vincular perfil. O cliente não precisa criar e-mail. Reversão de ambos em falhas conhecidas.
- Alterar usuário: Edge Function autenticada `update_username` atualiza o endereço interno e a coluna `login_username`, preservando permissões e senhas. Administrador segue usando seu e-mail original.
- Excluir cliente: remover PNGs, login e empresa. Operação destrutiva; monitorar falhas parciais e manter backup.
- Redefinir senha: via Admin API da Edge Function; nenhuma senha fica no banco do frontend.
- Enviar PNG: cliente JS valida o tipo/transparência, grava Storage e então o registro no Postgres; reverte upload se registro falhar.
- Exibir PNG: SDK faz `storage.download()` autenticado; a imagem vira Blob URL local, evitando URLs públicas e canvas contaminado por CORS.
- Capturar foto: stream getUserMedia, recorte central 9:16, PNG overlay em Canvas e exportação 1080×1920.
- Não há gravação de vídeo no MVP.

## Problemas que merecem atenção antes de produção

- O gatilho de 100 empresas serializa inserções com advisory lock, mas a política comercial de planos/preços não está automatizada.
- Excluir uma categoria em cascata pode deixar objetos órfãos no Storage: implementar rotina de limpeza antes de liberar exclusões em massa.
- Adicionar auditoria para alterações financeiras e clientes antes de operação comercial.
- Configurar recover password e políticas para administradores.
- Nunca mudar `private.is_admin()` para liberar acesso sem revisão de segurança.
