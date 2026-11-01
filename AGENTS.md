# Instruções para agentes de IA e desenvolvedores

## Contexto
Este repositório contém o **Camera Marketing Studio**, um sistema web independente para até 100 empresas. **Não** é o antigo aplicativo Flutter/Firebase `filtros-personalizados`. O banco é o novo Supabase `imfgumnpbxhbrjlkiphf` (sa-east-1).

## Onde começar
1. Leia `README.md` e `docs/ARCHITECTURE.md`.
2. Revise o frontend em `index.html`, `styles.css`, `app.js`.
3. Leia `supabase/migrations/` antes de alterar tabelas, regras RLS ou storage.
4. Confira `supabase/functions/manage-client/index.ts`, que contém as ações autenticadas de cadastro, exclusão e redefinição de senha.

## Regras fundamentais
- Nunca publique a chave `service_role`, chaves secretas, tokens, dados reais de clientes nem senhas no GitHub ou no navegador.
- No frontend só deve existir a chave pública do Supabase.
- Nunca remover ou afrouxar indiscriminadamente as políticas RLS; cada empresa acessa somente seus dados e PNGs.
- Não alterar o projeto antigo Flutter/Firebase.
- Criar **nova** migração SQL para qualquer alteração no banco; não reescrever retrospectivamente a migração inicial.
- Preservar experiência mobile-first, design suave/flat, português brasileiro e exportação de PNG 1080×1920.
- O financeiro registra vencimentos e pagamentos **manualmente**; não há emissão automática de boletos.
- Antes de entregar, testar login administrador/cliente, CRUD, isolamento entre empresas, upload/visualização de PNG, câmera, iPhone e Android.

## Situação atual
- Banco Supabase, tabelas, storage privado e função `manage-client` ativos.
- Frontend versionado neste repositório, mas **ainda não homologado em produção**.
- Conta administradora inicial precisa ser criada, ter o e-mail verificado e receber a função `admin` pelo proprietário.
- Hospedagem final precisa ser vinculada a este repositório para deploy automático.

## Como testar
```sh
python3 -m http.server 5173
```
Abra `http://localhost:5173`. Para testar a câmera em um celular, publique em HTTPS.

## Integrações e mudanças
- GitHub é a fonte do código. Vercel/GitHub Pages podem hospedar o frontend.
- Banco Supabase `https://supabase.com/dashboard/project/imfgumnpbxhbrjlkiphf`.
- Não confundir o projeto Supabase `cliquecarros` com o Camera Marketing Studio.
