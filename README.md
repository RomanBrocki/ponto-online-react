# Ponto Online v2

Aplicação web (frontend-only) para controle de ponto com React + TypeScript e Supabase (Auth + RLS), com acesso por perfil (`admin` e `empregada`), validação mensal e exportação de relatório em PDF.

## Stack

- React 19 + TypeScript
- Vite
- react-router-dom
- @supabase/supabase-js
- jsPDF + jspdf-autotable (exportação PDF)
- vite-plugin-pwa (PWA)

## Requisitos

- Node.js 20+
- NPM
- Projeto Supabase com Auth (email/senha) ativo

## Variáveis de ambiente

Crie `.env` na raiz:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Opcional (diagnóstico):

```env
VITE_SUPABASE_RECORDS_TABLE=ponto_online
```

## Scripts

```bash
npm install
npm run dev
npm run build
npm run preview
```

## Banco de dados (fonte de verdade)

### `public.ponto_online`

```sql
create table public.ponto_online (
  id uuid not null default gen_random_uuid (),
  data date not null,
  empregado text not null,
  entrada time without time zone null,
  saida_almoco time without time zone null,
  volta_almoco time without time zone null,
  saida_final time without time zone null,
  observacao text null,
  inserido_em timestamp with time zone null,
  user_id uuid null,
  constraint ponto_online_pkey primary key (id),
  constraint ponto_online_user_id_fkey foreign KEY (user_id) references auth.users (id)
) TABLESPACE pg_default;
```

### `public.profiles`

```sql
create table public.profiles (
  id uuid not null,
  role text not null,
  nome text null,
  criado_em timestamp with time zone not null default now(),
  constraint profiles_pkey primary key (id),
  constraint profiles_id_fkey foreign KEY (id) references auth.users (id) on delete CASCADE,
  constraint profiles_role_check check (
    (
      role = any (array['admin'::text, 'empregada'::text])
    )
  )
) TABLESPACE pg_default;
```

## Segurança e limites do projeto

- Não usar `service_role` no frontend.
- Não alterar schema, RLS ou policies via app.
- Não adicionar backend próprio.
- Usar apenas chave pública/anon do Supabase.

## Rotas e autenticação

- `/login`: público
- `/admin`: protegido para `admin`
- `/empregada`: protegido para `empregada`
- `*`: not found

Fluxo:
- não autenticado -> `/login`
- autenticado sem role válida -> `/login`
- role incompatível -> redireciona para rota correta da role

## Funcionalidades implementadas

### Empregada

- Saudação com nome (`profiles.nome`, fallback email)
- Marcação sequencial diária:
  - `entrada -> saida_almoco -> volta_almoco -> saida_final`
- Confirmação antes de registrar
- Feedback de sucesso/erro após ação
- Histórico por ano/mês com opções apenas de meses existentes
- Logout no final da página

### Admin

- Dois modos de uso:
  - `Editar/Consultar registros`
  - `Gerar relatório`
- Edição de horários e observação
- Exclusão de linha
- Listagens colapsáveis:
  - listagem de edição
  - prévia do relatório
- Ordenação de registros por data mais recente primeiro
- Inclusão visual de fins de semana sem registro (não persiste no banco)
- Validação de pendências antes da geração do relatório
- Diagnóstico de leitura do banco

### Relatório e PDF

- Validação mensal com regras de status por dia
- Resumo mensal:
  - faltas
  - feriados
  - dispensas justificadas
  - horas extras
  - horas negativas
  - balanço final
- Exportação em PDF (A4 retrato) com:
  - cabeçalho
  - grade mensal
  - resumo

## PWA

Configuração via `vite-plugin-pwa` em `vite.config.ts`:
- manifesto com nome, tema, display standalone e ícone
- service worker com atualização automática

Arquivo de ícone:
- `public/pwa-icon.svg`

## Estrutura de arquivos

```text
ponto-react/
|-- AGENTS.md
|-- README.md
|-- index.html
|-- package.json
|-- package-lock.json
|-- vite.config.ts
|-- eslint.config.js
|-- tsconfig.json
|-- tsconfig.app.json
|-- tsconfig.node.json
|-- .env
|-- .gitignore
|-- public/
|   |-- pwa-icon.svg
|   |-- vite.svg
|-- src/
|   |-- App.css
|   |-- App.tsx
|   |-- index.css
|   |-- main.tsx
|   |-- assets/
|   |   `-- react.svg
|   |-- auth/
|   |   `-- AuthContext.tsx
|   |-- components/
|   |   |-- DbProbePanel.tsx
|   |   `-- Modal.tsx
|   |-- lib/
|   |   |-- pdfReport.ts
|   |   |-- pontoOnline.ts
|   |   |-- recordsProbe.ts
|   |   |-- reportRules.ts
|   |   `-- supabase.ts
|   |-- pages/
|   |   |-- AdminPage.tsx
|   |   |-- EmpregadaPage.tsx
|   |   |-- LoadingPage.tsx
|   |   |-- LoginPage.tsx
|   |   `-- NotFoundPage.tsx
|   `-- styles/
|       `-- theme.css
|-- dist/ (gerado no build)
`-- node_modules/ (dependências)
```

## O que cada parte faz

- `src/main.tsx`: bootstrap React + import global de estilos
- `src/App.tsx`: provider de auth + roteamento e proteção de rotas
- `src/auth/AuthContext.tsx`: sessão, usuário, role, loading, `signIn`, `signOut`
- `src/lib/supabase.ts`: cliente Supabase
- `src/lib/pontoOnline.ts`: acesso CRUD de `ponto_online` + consultas de meses + profile
- `src/lib/reportRules.ts`: regras de cálculo/validação mensal
- `src/lib/pdfReport.ts`: montagem e download do PDF
- `src/lib/recordsProbe.ts`: diagnóstico rápido de acesso à tabela
- `src/pages/LoginPage.tsx`: formulário de login e redirecionamento por role
- `src/pages/EmpregadaPage.tsx`: marcação diária e histórico da empregada
- `src/pages/AdminPage.tsx`: edição/consulta, validação mensal e geração de PDF
- `src/components/Modal.tsx`: modal genérico de confirmação/mensagem
- `src/components/DbProbePanel.tsx`: bloco de diagnóstico no admin
- `src/styles/theme.css`: variáveis de tema
- `src/index.css`: layout global e responsividade

## Estado atual

- Login e controle por perfil: OK
- Fluxo da empregada: OK
- Fluxo de edição/consulta admin: OK
- Validação de relatório mensal: OK
- Geração de PDF: OK
- PWA básico: OK
