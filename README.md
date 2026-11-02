# Camera Marketing Studio

Plataforma web independente do projeto antigo `filtros-personalizados`, projetada para até **100 empresas**. Interface brasileira responsiva, pensada para computadores (painel) e iPhone/Android (câmera e filtros).

## Links e recursos

- **Supabase novo**: https://supabase.com/dashboard/project/imfgumnpbxhbrjlkiphf
- **Banco**: PostgreSQL, região São Paulo (`sa-east-1`).
- **Storage privado**: bucket `company-filters`, PNGs com máximo de 12 MB.
- **Servidor para contas**: Supabase Edge Function `manage-client`.
- **Frontend**: `index.html`, `styles.css`, `app.js` (HTML/CSS/JavaScript ES modules).
- **Site de produção**: https://camera-marketing-studio.vercel.app (Vercel conectado à branch `main` do GitHub; deploy `READY` confirmado em 01/11/2026).
- **Migração SQL**: `supabase/migrations/20261101_001_initial_schema.sql` (documentação da estrutura que já foi aplicada ao projeto real).
- **Função do servidor**: `supabase/functions/manage-client/index.ts`.

## Funcionalidades implementadas no código

1. Cadastro e login com **Supabase Auth**.
2. Primeiro acesso do administrador como conta pendente, com liberação segura pelo proprietário do projeto.
3. Dashboard com indicadores reais, cadastro/edição/exclusão de empresas, mensalidades e vencimentos.
4. Cadastro de categorias e PNGs por empresa (arquivos privados).
5. Câmera do navegador com PNG transparente sobreposto e fotografia 1080×1920. Depois de fotografar, o cliente vê **uma tela de resultado com prévia** em vez de baixar automaticamente: Compartilhar, Instagram Stories, WhatsApp, Salvar no celular, Nova foto e Trocar filtro. A foto permanece **temporariamente no navegador**, sem envio automático ao banco.

**Compartilhamento mobile:** o aplicativo usa a Web Share API quando o navegador aceita compartilhar arquivos. Os botões Instagram Stories e WhatsApp abrem a seleção nativa do sistema; não publicam automaticamente nem conseguem forçar qual aplicativo ou recurso será aberto. Em iPhone, "Salvar no celular" usa o menu nativo para escolher "Salvar Imagem" ou "Salvar em Arquivos", quando disponível. Em outros casos, oferece download PNG.
6. Alteração da senha dos clientes via Edge Function autenticada.
7. Controle manual de cobranças. **Não** emite boletos nem consulta bancos.
8. Configuração do nome da plataforma e WhatsApp de suporte.

## Administração de filtros e categorias

No painel do administrador, a navegação possui **uma única área "Filtros PNG"** para:
- consultar, criar, renomear ou excluir categorias de cada empresa;
- cadastrar filtros novos escolhendo **uma categoria já existente** ou **"＋ Criar nova categoria…"** no mesmo formulário;
- preencher o nome da nova categoria apenas quando essa opção é selecionada;
- validar o PNG e registrar a nova categoria vinculada à empresa selecionada, seguida do envio do filtro.

Se ocorrer erro no envio após criar uma categoria, o aplicativo tenta desfazer a categoria nova quando ainda estiver vazia. Os dados de categorias e filtros antigos continuam nas mesmas tabelas protegidas por RLS.

## Aparência e fluxo mobile (novembro de 2026)

- **Apenas a tela inicial do cliente** usa a logo PNG original e as cores da empresa. A logo fica em moldura quadrada compacta, sem sobrepor os títulos; o PNG não é alterado. PNG com fundo branco não é necessariamente transparente, portanto prefira a logo com canal alfa para não exibir quadrado branco.
- Ao entrar numa categoria, **a câmera tem fundo branco e a identidade padrão do Camera Marketing Studio** (azul anil / marinho escuro, base `#101F52` e destaque `#172D6F`), sem reproduzir as cores da loja.
- Ordem na câmera: **prévia da câmera → botão de captura e controles → filtros circulares horizontais**.
- A tela de resultado também usa a identidade neutra da plataforma, com prévia final e ações de compartilhamento.
- O painel administrativo usa azul-marinho escuro; o menu mobile abre por botão ☰, enquanto o desktop mantém a lateral fixa.

## Identidade visual personalizada por empresa

O administrador cadastra, na mesma tela de **Novo cliente**, a logo original em **PNG de exatamente 500 × 500 pixels**, com até **2 MB**, e escolhe:
- **Cor principal**, utilizada no cabeçalho e no plano de fundo do cliente;
- **Cor dos botões**, utilizada nas categorias e no botão de fotografar.

A logo é armazenada no bucket privado `company-filters`, no caminho `{company_id}/branding/{uuid}.png`. A coluna `companies.logo_path` aponta para esse arquivo. As regras RLS existentes permitem somente ao administrador carregar novas logos e ao cliente autenticado ler as imagens da própria empresa ativa. A identidade da empresa é exibida automaticamente depois do login, **sem alterar a imagem original**. Também é possível mudar logo e cores em **Clientes → Editar**.

Por segurança, o cadastro da empresa ocorre antes do envio da logo: se o envio falhar, a conta poderá existir com personalização pendente. Nesse caso, abra **Editar** e envie novamente, sem duplicar o cadastro. A função `manage-client` também limpa o logo quando exclui a empresa. Empresas antigas sem logo continuam com a identidade padrão até o administrador configurar.

## Configuração e primeiro administrador (sem publicar segredos)

A instalação já tem banco/schema criados e uma Edge Function ativa, mas **não existe conta administrativa criada automaticamente**.

1. No [Supabase → Authentication → URL Configuration](https://supabase.com/dashboard/project/imfgumnpbxhbrjlkiphf/auth/url-configuration), defina **Site URL** como `https://camera-marketing-studio.vercel.app` e salve. Isso evita redirecionar a confirmação de e-mail para `localhost`.
2. Abra https://camera-marketing-studio.vercel.app, clique em **Criar conta inicial** e registre seu e-mail com senha forte.
3. Confirme o e-mail enviado pelo Supabase (conforme configuração de autenticação).
4. O dono do projeto, com acesso ao Supabase, deve promover **somente aquela conta verificada**. Esse passo pode ser executado no SQL Editor:

```sql
update public.profiles
set role = 'admin', company_id = null
where id = (select id from auth.users where email = 'EMAIL_CONFIRMADO_DO_ADMINISTRADOR');
```

5. Faça logout/login novamente. O dashboard administrativo aparecerá.
6. No painel, crie empresas com e-mail e senha individual. Empresas inativas não poderão carregar os filtros.

**Não compartilhe senhas, tokens ou chaves `service_role` por chat ou em repositórios.** O projeto contém apenas uma chave *publicável* de frontend, que pode ser vista em navegadores e depende de políticas RLS para a segurança real. Qualquer configuração `SUPABASE_SERVICE_ROLE_KEY` deve permanecer apenas nas variáveis protegidas do Supabase Edge Function.

## Executar localmente

Não precisa compilar. Em um computador com Python:

```bash
python3 -m http.server 5173
```

Abra http://localhost:5173. Para câmera em celulares, publique em um host HTTPS (GitHub Pages, Vercel etc.). Abrir via IP na rede local sem HTTPS pode bloquear a câmera.

## Publicar na Vercel

Crie um projeto apontando para a raiz do repositório; **Framework: Other**, sem comando de build, usando os arquivos estáticos. O arquivo `vercel.json` já inclui cabeçalhos básicos. Após conectar GitHub, cada commit poderá produzir uma nova versão publicada.

## Segurança

- Tabelas com **Row Level Security** e leitura isolada por empresa.
- `profiles.role='admin'` não pode ser alterado pelo navegador de clientes.
- Criação/remoção de logins feita pela Edge Function que valida JWT e cargo administrativo.
- PNGs ficam em bucket privado; são obtidos pela sessão autenticada, não por link público permanente.
- Senhas gerenciadas por Supabase Auth, nunca salvas em planilhas ou no PostgreSQL da aplicação.
- Registros de clientes e cobranças no banco novo, separados do aplicativo antigo.
- A plataforma limita a 100 empresas através de gatilho no banco.

## Pendências para produção

- **GitHub vinculado:** https://github.com/henriquedomarketing/camera-marketing-studio.
- **Site HTTPS publicado:** https://camera-marketing-studio.vercel.app.
- Configurar **Site URL** de autenticação no Supabase e cadastrar/autorizar a primeira conta administrativa.
- Validar a experiência no Safari iPhone e Chrome Android.
- Testar o cadastro/exclusão de uma empresa e o envio/download/captura de um PNG real, com as regras RLS habilitadas.
- Validar backup, políticas de privacidade, alertas de cobrança, recuperação de senhas e rotinas de limpeza de PNGs órfãos.
- Monitorar os limites do plano Supabase/Vercel, que podem mudar.

## Estrutura

```text
camera-marketing-studio/
├── index.html
├── styles.css
├── app.js
├── vercel.json
├── package.json
├── .env.example
├── .gitignore
├── README.md
├── docs/
│   └── ARCHITECTURE.md
└── supabase/
    ├── migrations/20261101_001_initial_schema.sql
    └── functions/manage-client/index.ts
```

## Notas para futuras IAs e desenvolvedores

Comece por **README.md** e **docs/ARCHITECTURE.md**, examine a migração SQL e revise as políticas RLS antes de qualquer mudança no banco. Nunca usar chaves secretas no navegador. Não misturar este projeto com o antigo repositório de filtros Flutter/Firebase. Qualquer alteração de schema deve virar uma nova migração; não editar retrospectivamente a migração inicial. Antes de aplicar uma mudança, testar num ambiente separado.
