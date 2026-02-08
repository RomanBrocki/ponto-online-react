# Ponto React (Ponto Online v2)

Aplicação web **frontend-only** para controle de ponto eletrônico, construída com React + TypeScript e Supabase (Auth + RLS), com deploy em GitHub Pages e suporte a PWA.

## 1. Objetivo

Este projeto resolve o controle de jornada com dois perfis:

- `admin` (empregador)
- `empregada` (funcionário)

Sem servidor próprio: toda autenticação e persistência usam Supabase com políticas RLS.

## 2. Regras de negócio (implementadas)

### `empregada`

- Registra **apenas o próprio ponto**.
- Sequência obrigatória do dia:
  1. `entrada`
  2. `saida_almoco`
  3. `volta_almoco`
  4. `saida_final`
- Vê histórico mensal dos dias anteriores.

### `admin`

- Vê e edita registros de empregadas no mês.
- Filtros no modo de edição na ordem:
  1. Empregada
  2. Ano
  3. Mês
  4. Dia (opcional)
- Se selecionar `Dia`, mostra apenas aquele dia; se não, mostra o mês inteiro.
- Pode definir observações de validação (`Feriado`, `Dispensa Justificada`, `Falta`).
- Gera relatório mensal com prévia e PDF.

## 3. Segurança e arquitetura

- App frontend-only.
- Sem `service_role` e sem chaves secretas no cliente.
- Somente `VITE_SUPABASE_ANON_KEY`.
- Role lida de `public.profiles.role` após login.
- Rotas protegidas por role no frontend.
- A proteção de dados é garantida pelo Supabase RLS.

## 4. Stack

- React 19
- TypeScript
- Vite
- react-router-dom
- @supabase/supabase-js
- jsPDF + jspdf-autotable
- vite-plugin-pwa

## 5. Pré-requisitos

- Node.js 20+
- npm
- Projeto Supabase já configurado (Auth email/senha + tabelas + RLS)

## 6. Variáveis de ambiente

Crie um arquivo `.env` na raiz:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_CHAVE_PUBLICA
```

Opcional:

```env
VITE_BASE_PATH=/nome-do-repositorio/
```

Observação:
- Em desenvolvimento local, `VITE_BASE_PATH` pode ser omitido.
- No GitHub Pages, o workflow já define esse valor automaticamente.

## 7. Rodando localmente

```bash
npm install
npm run dev
```

Acesse: `http://localhost:5173`

Build de produção local:

```bash
npm run build
npm run preview
```

## 8. Fluxo funcional por tela

### Login (`/login`)

Fluxo principal de login com visual limpo:

1. Campos `email` + `senha`
2. Botão principal `Entrar`
3. Abaixo do botão, links discretos para:
   - `Alterar senha` (email + senha atual + nova + confirmação)
   - `Esqueci minha senha` (envio de link de recuperação)

A tela alterna o contexto sem sair da rota (`/login`), ajustando título e campos conforme a ação selecionada.

### Painel Empregada (`/empregada`)

- Bloco de marcação do dia com cartões de status.
- Botão principal executa a próxima etapa válida da sequência.
- Histórico do mês é exibido sob demanda com toggle `Exibir histórico` / `Ocultar histórico`.

### Painel Admin (`/admin`)

Tela inicial limpa com blocos essenciais:

1. `Olá` (contexto do usuário)
2. `Ações`
3. `Diagnóstico DB`
4. `Sair`

No bloco `Ações`, os conteúdos são abertos sob demanda (toggle):

1. `Editar/Consultar registros`
   - filtros: Empregada > Ano > Mês > Dia
   - lista inicia colapsada
   - edição por linha + salvar + apagar
2. `Relatórios`
   - filtros: Empregada > Ano > Mês
   - validação de pendências antes de gerar PDF
   - prévia colapsável

Clicar novamente na ação ativa recolhe o conteúdo.

## 9. Estrutura de arquivos (árvore completa)

```text
ponto-react/
|-- .github/
|   `-- workflows/
|       `-- deploy-pages.yml            # pipeline de build/deploy no GitHub Pages
|-- public/
|   |-- pwa-icon.svg                    # ícone PWA
|   `-- vite.svg
|-- src/
|   |-- assets/
|   |   `-- react.svg
|   |-- auth/
|   |   `-- AuthContext.tsx             # sessão, role e ações de auth
|   |-- components/
|   |   |-- DbProbePanel.tsx            # painel de diagnóstico de tabela/permissão
|   |   `-- Modal.tsx                   # modal de confirmação/mensagem
|   |-- lib/
|   |   |-- pdfReport.ts                # geração PDF mensal
|   |   |-- pontoOnline.ts              # queries e mutações de ponto/profiles
|   |   |-- recordsProbe.ts             # utilitário de diagnóstico
|   |   |-- reportRules.ts              # validação mensal e cálculos de saldo
|   |   `-- supabase.ts                 # client Supabase + client isolado
|   |-- pages/
|   |   |-- AdminPage.tsx               # painel do empregador
|   |   |-- EmpregadaPage.tsx           # painel do funcionário
|   |   |-- LoadingPage.tsx
|   |   |-- LoginPage.tsx
|   |   `-- NotFoundPage.tsx
|   |-- styles/
|   |   `-- theme.css                   # variáveis de tema (.theme-gunmetal)
|   |-- App.css
|   |-- App.tsx                         # rotas + guards por role
|   |-- index.css
|   `-- main.tsx
|-- AGENTS.md
|-- eslint.config.js
|-- index.html
|-- package.json
|-- package-lock.json
|-- README.md
|-- tsconfig.app.json
|-- tsconfig.json
|-- tsconfig.node.json
`-- vite.config.ts                      # base path + configuração PWA
```

## 10. Scripts

```bash
npm run dev      # desenvolvimento
npm run build    # tsc + build vite
npm run preview  # serve o dist local
npm run lint     # lint
```

## 11. Banco de dados esperado

### `public.ponto_online`

Campos usados no app:

- `id` (uuid)
- `data` (date)
- `empregado` (text)
- `entrada`, `saida_almoco`, `volta_almoco`, `saida_final` (time)
- `observacao` (text)
- `inserido_em` (timestamp)
- `user_id` (uuid -> auth.users.id)

### `public.profiles`

Campos usados:

- `id` (uuid -> auth.users.id)
- `role` (`admin` | `empregada`)
- `nome` (opcional, para saudação)

Importante:
- Não alterar schema/policies por este frontend.
- O app assume que as policies já estão corretas no Supabase.

## 12. PWA: status atual

Status: **pronto para produção**.

Já configurado:

- `vite-plugin-pwa` com `registerType: autoUpdate`
- `manifest.webmanifest`
- geração de `sw.js` no build
- ícone em `public/pwa-icon.svg`
- `start_url` baseado em `VITE_BASE_PATH`
- `scope` baseado em `VITE_BASE_PATH`
- ícones mobile em PNG + ícone maskable

### 12.1 Ícones mobile/PWA

Arquivos utilizados:

- `public/icons/icon-192.png` (Android/instalação)
- `public/icons/icon-512.png` (Android/instalação)
- `public/icons/icon-maskable-512.png` (Android maskable)
- `public/icons/apple-touch-icon-180.png` (iOS)
- `public/pwa-icon.svg` (fallback vetorial)

Integração já aplicada:

- `vite.config.ts` (`manifest.icons` + `includeAssets`)
- `index.html` (`favicon`, `apple-touch-icon`, `theme-color` e metas iOS)

## 13. Deploy no GitHub Pages

### Configuração única no GitHub

1. Repositório -> `Settings` -> `Pages`
2. Em `Source`, escolher `GitHub Actions`
3. Criar secrets em `Settings` -> `Secrets and variables` -> `Actions`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

### Como publicar a partir de agora

1. Commit/push para `main`
2. O workflow `.github/workflows/deploy-pages.yml` executa:
   - `npm ci`
   - `npm run build`
   - cópia de `dist/index.html` para `dist/404.html` (fallback SPA)
   - deploy para GitHub Pages

Também é possível rodar manualmente por `Actions` -> `Deploy GitHub Pages` -> `Run workflow`.

## 14. Supabase Auth: URLs obrigatórias

No painel Supabase (`Authentication` -> `URL Configuration`):

- `Site URL`: URL pública do app no GitHub Pages
- `Redirect URLs`: incluir pelo menos
  - `https://<usuario>.github.io/<repositorio>/login`
  - `https://<usuario>.github.io/<repositorio>/`

Sem isso, recuperação/fluxos de senha podem falhar.

## 15. Troubleshooting rápido

- Login entra mas volta para `/login`:
  - usuário sem `role` válido em `public.profiles`.

- Recuperação de senha não chega:
  - conferir URL/key do Supabase no ambiente.
  - validar `Site URL` e `Redirect URLs`.

- Página quebra em refresh de rota no GitHub Pages:
  - confirmar se o deploy gerou `404.html` no `dist`.

- Dados não aparecem para um perfil:
  - validar policies RLS para `profiles` e `ponto_online`.

## 16. Estado atual

- Login, alteração e recuperação de senha
- Controle de ponto sequencial da empregada
- Histórico mensal sob demanda (toggle)
- Admin com ações expansíveis/recolhíveis
- Edição/admin com filtro opcional por dia
- Relatório mensal com validação e PDF
- PWA com service worker
- Deploy automático no GitHub Pages
