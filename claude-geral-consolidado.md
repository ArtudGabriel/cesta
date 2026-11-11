# Padrões de Desenvolvimento — Documento Geral Consolidado

> Consolidação de todos os documentos referenciados no CLAUDE.md global (diretrizes, stack, padrões, preferências e templates), em versão **higienizada**: sem referências pessoais e sem credenciais. Pode ser usado como base de conhecimento em qualquer projeto ou compartilhado com terceiros.
>
> Documentos de origem: CLAUDE.md global · bravy-stack.md · naming-conventions.md · backend-patterns.md · frontend-patterns.md · database-patterns.md · vibecoding-rules.md · output-format.md · communication.md · project-claude-template.md · bravy-full.md. Os arquivos de perfil (about-me, working-style, ventures) tiveram apenas o conteúdo técnico reaproveitado — o restante era pessoal e foi omitido.

---

## Índice

1. [Diretrizes globais](#1-diretrizes-globais)
2. [Preferências de comunicação e output](#2-preferências-de-comunicação-e-output)
3. [Stack padrão](#3-stack-padrão)
4. [Nomenclatura](#4-nomenclatura)
5. [Padrões de backend — NestJS](#5-padrões-de-backend--nestjs)
6. [Padrões de frontend — Next.js 15 (App Router)](#6-padrões-de-frontend--nextjs-15-app-router)
7. [Padrões de banco — Prisma + PostgreSQL](#7-padrões-de-banco--prisma--postgresql)
8. [Regras de uso de LLM (vibecoding)](#8-regras-de-uso-de-llm-vibecoding)
9. [Template de CLAUDE.md para projetos](#9-template-de-claudemd-para-projetos)
10. [Referência completa Bravy](#10-referência-completa-bravy)

---

## 1. Diretrizes globais

### Princípios inegociáveis

1. **Backend separado do frontend.** Sempre. Dois projetos distintos (`*-api` e `*-web`).
2. **Desacoplado, manutenível, modular.** É o default — não precisa repetir em cada prompt.
3. **Padronização > velocidade.** Seguir o padrão importa mais que entregar rápido e bagunçado.
4. **Se não está documentado, não existe.**
5. **LLM é ferramenta, não substituto de pensamento crítico.** Revisar tudo antes de aceitar.

**Regra de silêncio:** se o projeto não diz, o global manda.

### Ao iniciar um projeto novo (fluxo esperado do assistente)

1. **Procurar um `CLAUDE.md` na raiz do projeto.** Se existir, ler antes de agir.
2. **Se não existir**, perguntar se deve criar um a partir do template (seção 9).
3. **Identificar o tipo de projeto** (nova API? nova feature? refactor?) e aplicar o padrão apropriado.
4. **Confirmar o escopo da sessão atual** antes de começar a gerar código.

---

## 2. Preferências de comunicação e output

### Perfil de trabalho

- Perfil "vibecoder": constrói com LLM como copiloto, absorvendo padrões e iterando. Pode-se pressupor domínio do básico da stack.
- Aprendizado melhor com conteúdo **denso, direto e acionável** — sem conteúdo introdutório nem enrolação.
- **Uma tarefa por vez.** Nada de PR gigante que mistura escopo.
- **Revisar tudo antes de aceitar.** LLM é copiloto, não piloto.

### Densidade e estrutura

- Direto e acionável. Sem preâmbulo longo.
- Decisão de arquitetura sempre com o trade-off explicado — o "porquê" importa.
- Código real, copiável, em blocos. Nada de pseudocódigo quando dá pra ser real.
- Tabela quando ajuda a comparar; lista quando ajuda a executar.
- Não sobre-formatar: cabeçalho e bullet só quando agregam.
- Comentários no código só onde agregam — não comentar o óbvio.

### Idioma

- Texto/explicação: **PT-BR**.
- Código, naming, commits: **inglês**.

### Tom

- Direto, técnico, de colega pra colega. Pode ser assertivo.
- Honestidade sobre trade-offs e riscos — não dourar a pílula.
- Sem bajulação. Foco no problema.
- Se o caminho for ruim, apontar o problema e propor alternativa. Argumento técnico > diplomacia vazia.
- Sinalizar quando algo é over-engineering (pensar em ROI, tempo e foco).
- Uma pergunta de cada vez quando precisar esclarecer; endereçar o pedido antes de pedir esclarecimento, sempre que possível.

### O que evitar

- Conteúdo introdutório quando o nível já foi ultrapassado.
- Respostas longas com pouca densidade.
- Refazer do zero algo que já tinha padrão definido.
- Respostas que terminam empurrando outra pergunta sem necessidade.

---

## 3. Stack padrão

> Stack canônica. Todo projeto novo nasce aqui, salvo divergência explícita no CLAUDE.md do projeto.

| Camada | Tecnologia | Papel |
|---|---|---|
| Linguagem | TypeScript | Tipagem estática end-to-end (front e back) |
| Backend | NestJS | Framework opinado: DI, decorators, módulos |
| Frontend | Next.js 15 (App Router) | SSR/SSG, Server Components, file-based routing |
| Banco | PostgreSQL 16 | Relacional, robusto, JSON, full-text |
| ORM | Prisma | Schema declarativo, migrations, type-safe |
| Estilo | Tailwind CSS | Utility-first |
| UI | shadcn/ui | Componentes copiados no projeto (Radix) |
| Auth | JWT | Access 15min + refresh 7d (rotation), bcrypt |
| Validação back | class-validator + class-transformer | Decorators nos DTOs |
| Validação front | Zod + React Hook Form | Schema → resolver → FormField |
| Server state | React Query (TanStack) | Cache, refetch, mutations |
| Client state | Zustand | Só estado de UI (sidebar, tema) |
| HTTP client | Axios | Interceptors de auth, baseURL central |
| Filas/Jobs | BullMQ + Redis | Processamento assíncrono |
| Embeddings | pgvector | Busca semântica quando há RAG |
| Testes | Jest (+ supertest e2e) | Unit no service, e2e na API |
| Containers | Docker + docker-compose | Dev = prod |
| CI/CD | GitHub Actions | Lint → Test → Build → Deploy |
| Proxy | Nginx | SSL, gzip, rate limiting |

### Regra de ouro de estrutura

Todo projeto = **dois repositórios/pastas separados** (comunicam só via API REST; frontend nunca acessa o banco):

```
~/projetos/nome-do-projeto/
├── CLAUDE.md                 ← contexto do projeto (estende o global)
├── .claude/                  ← skills/agents/memory do projeto
├── nome-do-projeto-api/      ← backend (NestJS)
└── nome-do-projeto-web/      ← frontend (Next.js)
```

### Justificativas (curtas)

- **NestJS**: estrutura opinativa modular; fácil pra LLM seguir padrão.
- **Next.js App Router**: Server Components, rotas por arquivo, bom SEO.
- **Prisma**: migrations versionadas, type-safety ponta a ponta.
- **PostgreSQL**: maturidade, JSON nativo, pgvector quando precisa de embeddings.
- **BullMQ + Redis**: jobs assíncronos confiáveis (email, relatório, processamento pesado fora do request).

---

## 4. Nomenclatura

### Regra base

- **Pastas e arquivos:** `kebab-case`, minúsculo, sem acento. (Case-insensitive no macOS evita bugs de import.)
- **Código:** sempre em inglês.

### Cheat sheet (consulta diária)

| Elemento | Convenção | Exemplo |
|---|---|---|
| Arquivo TS | `kebab-case.sufixo.ts` | `payment-gateway.service.ts` |
| **Componente React (arquivo)** | **`kebab-case.tsx`** | `pricing-card.tsx` |
| **Componente React (export)** | **`PascalCase` named export** | `export function PricingCard` |
| Props | `{Nome}Props` | `PricingCardProps` |
| Hook (arquivo / export) | `use-*.ts` / `camelCase` | `use-debounce.ts` → `useDebounce` |
| Contexto | `*.context.tsx` | `auth.context.tsx` |
| Teste unit / e2e | `*.spec.ts` / `*.e2e-spec.ts` | `billing.service.spec.ts` |
| Classe / Interface | `PascalCase` + sufixo papel; **sem prefixo `I`** | `BillingService`, `PaymentProvider` |
| Enum (nome / valor) | `PascalCase` / `UPPER_SNAKE_CASE` | `OrderStatus` / `PENDING_PAYMENT` |
| Variável / função | `camelCase`; verbo no início de função | `orderTotal`, `calculateTotal()` |
| Constante | `UPPER_SNAKE_CASE` | `MAX_RETRY_ATTEMPTS` |
| Booleano | `is/has/can/should` | `isActive`, `hasPermission` |
| Handler interno / prop | `handle*` / `on*` | `handleSubmit` / `onSubmit` |
| Model Prisma | `PascalCase` singular | `model Order` |
| Tabela (`@@map`) / coluna (`@map`) | `snake_case` plural / `snake_case` | `@@map("orders")` / `@map("created_at")` |
| Endpoint | `/api/v1/` + `kebab` plural | `/api/v1/order-items` |
| Query param | `camelCase` | `?pageSize=20&sortBy=createdAt` |
| Branch / commit | `tipo/descricao-kebab` / Conventional Commits | `feat/order-cancellation`, `feat(billing): add PIX` |
| Env var | `UPPER_SNAKE_CASE` (`NEXT_PUBLIC_` p/ client) | `DATABASE_URL`, `NEXT_PUBLIC_API_URL` |

#### Sufixos NestJS

`*.module.ts` · `*.controller.ts` · `*.service.ts` · `*.repository.ts` · `*.dto.ts` · `*.guard.ts` · `*.pipe.ts` · `*.interceptor.ts` · `*.filter.ts` · `*.decorator.ts`

### Componentes React — regra oficial

Arquivo em `kebab-case.tsx`, **export nomeado** PascalCase (`export function UserAvatar`); **nunca `export default` em componentes**.

> ⚠️ Vale para **projetos novos**. Em projetos existentes, a migração é deliberada (renomear quebra imports). **Páginas de rota Next** (`page.tsx`, `layout.tsx`, `error.tsx`…) mantêm `export default` — exigência do framework.

### Errado vs Certo

| Errado | Certo | Por quê |
|---|---|---|
| `MeuProjeto/` | `meu-projeto/` | Sem maiúscula/acento em pasta |
| `LoginForm.tsx` | `login-form.tsx` → `export function LoginForm` | Arquivo kebab + export nomeado PascalCase |
| `getUsuario()` | `getUser()` | Código em inglês |
| `userservice.ts` | `user.service.ts` | Sufixo de papel separado por ponto |
| `export default function Card` | `export function Card` | Named export em componente |
| `Tabela_Usuarios` | `@@map("users")` | snake_case plural em inglês |

---

## 5. Padrões de backend — NestJS

### Estrutura modular (1 feature = 1 módulo)

```
src/
├── main.ts            # bootstrap: ValidationPipe, filters, interceptors, CORS, helmet, Swagger
├── app.module.ts
├── common/            # decorators, dtos (PaginationDto), enums, filters, guards, interceptors, pipes
├── config/            # registerAs() tipado
├── database/          # PrismaModule (@Global) + PrismaService
└── modules/<feature>/
    ├── <f>.module.ts · <f>.controller.ts · <f>.service.ts · <f>.repository.ts
    └── dtos/ (create- / update- / -response)
```

### Responsabilidades por camada

| Camada | FAZ | NÃO faz |
|---|---|---|
| Controller | Recebe request, valida DTO, delega ao service, retorna | Regra de negócio, banco, try/catch manual |
| Service | Regra de negócio, validações, orquestração | Acessar req/res, chamar Prisma direto |
| Repository | Queries Prisma, CRUD | Regra de negócio, lançar HttpException |
| DTO | Valida entrada/saída + doc Swagger | Lógica, banco |
| Guard | Autentica/autoriza (retorna true ou lança) | Modificar body, regra de negócio |
| Pipe | Valida/transforma entrada antes do controller | Banco, regra de negócio |
| Interceptor | Transforma response, logging, cache | Barrar request (é o Guard) |
| Filter | Captura exceção, padroniza erro | Regra de negócio |

### Regras

1. `ValidationPipe` global: `whitelist: true` + `forbidNonWhitelisted: true` + `transform: true`.
2. Guards globais (secure by default): `JwtAuthGuard` + `RolesGuard`; rota pública usa `@Public()`.
3. Erros via exceptions do Nest (`NotFoundException`…) + filtro global. Nada de try/catch espalhado.
4. Controller fino — **zero regra de negócio**. Service não importa `PrismaService` direto (vai pelo Repository).
5. Dinheiro em decimal (`@IsNumber({ maxDecimalPlaces: 2 })`), nunca float.
6. Operação pesada (email, relatório, processamento) sai do request → fila **BullMQ + Redis**; endpoint retorna 202.

### Fronteiras de módulo (enforce, não só documente)

- `common/` e `database/` **não importam** de `modules/` (camada-base não depende de feature).
- Um módulo de feature não alcança o repository de outro — comunique via service exportado ou evento.
- Torne a regra **executável**: `npm run check:boundaries` (import-lint) + gate no pre-commit. Allowlist explícita p/ exceções conscientes.

### Multitenant

- `tenantId` resolvido por guard/interceptor a partir do **token** — nunca confiar em filtro vindo do client.
- **Toda** query filtra por `tenantId`; índices compostos por tenant.

---

## 6. Padrões de frontend — Next.js 15 (App Router)

### Estrutura

```
src/
├── app/                      # rotas: layout.tsx, (auth)/, (dashboard)/
├── components/{ui,layout,shared}/    # ui = shadcn (não editar)
├── features/<f>/{components,hooks,services,schemas,types}/
├── hooks/  lib/(api.ts, utils.ts cn(), query-client.ts)
├── providers/  stores/(Zustand)  types/
└── middleware.ts             # auth redirect no edge
```

Colocação: 1 feature → `features/<f>/components/` · 2+ features → `components/shared/` · UI genérico → `components/ui/` · layout → `components/layout/`.

### Server vs Client Component

```
Precisa de useState/useEffect/onClick/onChange/hook de browser?
   SIM → 'use client'
   NÃO → Server Component (default)
```

| | Server (default) | Client (`'use client'`) |
|---|---|---|
| Executa | Servidor | Navegador |
| JS no browser | Zero | Sim |
| Usar para | Páginas, layouts, data fetching | Formulários, modais, interação |

### Naming de componente

Arquivo `kebab-case.tsx`, **export nomeado** PascalCase (`export function ProductForm`). Nunca `export default` em componente — páginas de rota são a exceção do framework. Em projetos existentes a migração é deliberada.

### Patterns

- Cadeia: `component → hook → service HTTP (lib/axios) → backend`. Nunca `fetch` solto no componente.
- **Server state → React Query**. UI state → **Zustand** (nunca server state no Zustand).
- Formulários: **React Hook Form + Zod** (`zodResolver`). Dinheiro: `z.number().multipleOf(0.01)`.
- HTTP: Axios com interceptor que injeta Bearer token e trata 401.

### UX mínima (inegociável)

- **Todo elemento clicável** tem `cursor-pointer` + estado visual (hover/active/disabled).
- **Loading e erro tratados em toda ação assíncrona** (isLoading, isError, empty state); botão de submit desabilita enquanto a request está em voo.
- Componentes de ~150 linhas — quebrar god components.

---

## 7. Padrões de banco — Prisma + PostgreSQL

### Modelagem

- Model `PascalCase` singular; tabela `@@map("snake_case_plural")`; coluna `@map("snake_case")`.
- Todo model tem `id` (uuid/cuid), `createdAt`, `updatedAt`, `deletedAt?`.
- Relações explícitas com `@relation`; índices nomeados em FK e colunas de filtro.

```prisma
model Order {
  id        String    @id @default(cuid())
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")
  deletedAt DateTime? @map("deleted_at")
  // campos específicos...
  @@map("orders")
}
```

### Migrations

- `npx prisma migrate dev --name <descricao>` (dev) · `migrate deploy` (prod) · **nunca editar migration aplicada**.
- `prisma generate` após mudar schema. `prisma studio` p/ inspecionar.
- **`"postinstall": "prisma generate"`** no `package.json` — sem isso, `npm install` em dev/CI não regenera o client e gera erros tsc fantasma quando o schema ganha models novos.
- **Seed idempotente:** no `upsert`, `update: {}` vazio — re-runs não pisam em config dinâmica editada em runtime; defaults só na criação.

### Patterns de query

- **Paginação:** `Promise.all([findMany({ skip, take, where:{deletedAt:null}, orderBy }), count({where})])`.
- **Transação atômica:** `prisma.$transaction(async (tx) => { ... })` p/ operações multi-tabela.
- **Filtros dinâmicos:** montar `Prisma.<Model>WhereInput`; busca com `contains` + `mode: 'insensitive'`.
- **Soft delete:** repositórios filtram `deletedAt: null` por padrão; `softDelete` seta `deletedAt`.

### Especializações comuns

- **Multitenant:** `tenantId` (camelCase no Prisma, `@map` snake no banco) em todo model do tenant, **indexado**; índice composto quando há busca frequente por tenant + outro campo. Filtrar sempre por `tenantId` vindo do token.
- **pgvector:** coluna de embedding p/ busca semântica; índice vetorial quando houver RAG.

### Performance

- Índices em FKs e colunas de filtro frequente; `select`/`include` explícitos (evita N+1 e trazer a tabela inteira); connection pooling (PgBouncer/Prisma Accelerate) em produção.

### Migrations destrutivas (expand-contract)

> Alteração de schema NUNCA é atômica com o deploy. Toda mudança destrutiva (drop, rename, troca de tipo, split, troca de PK) vira uma **sequência de pelo menos 2 deploys**, com intervalo de estabilidade entre eles. Sem CI/CD automatizado, "deploy" = rebuild no painel de deploy + verificação pós-rebuild.

**Por que.** Entre o momento em que a migration roda e o momento em que o código novo está 100% no ar existe uma janela em que código antigo e schema novo (ou vice-versa) coexistem. Se o schema muda de forma destrutiva nesse intervalo, o código antigo quebra. Expand-contract elimina a janela: primeiro **expande** (adiciona o novo sem remover o velho), estabiliza, depois **contrai** (remove o velho).

#### Caso 1 — Remover coluna

- **Deploy 1 (expand-ignore):** código para de ler/escrever a coluna; coluna continua no banco. Deploy + verificar em produção que não há mais leitura/escrita (deixar estabilizar — idealmente um ciclo de uso real, não só minutos).
- **Deploy 2 (contract):** **backup imediatamente antes**, migration `DROP COLUMN`, deploy.

#### Caso 2 — Renomear coluna

- **Deploy 1 (expand + dual-write):** migration adiciona coluna **nova**; código escreve nas **duas**; código lê primeiro da nova, com fallback para a antiga.
- **Deploy 2 (backfill):** job/script copia dados `antiga → nova` onde a nova está `NULL`; verificar completude (count bate).
- **Deploy 3 (cutover):** código lê **só** da nova (mantém o dual-write por segurança).
- **Deploy 4 (contract):** código para de escrever na antiga; migration `DROP COLUMN` antiga; deploy.

#### Caso 3 — Trocar tipo de coluna

Mesmo padrão do Caso 2, com: migration de tipo na coluna **nova**; backfill com **cast explícito + validação** (atenção a overflow, truncamento, valores fora do novo domínio).

#### Caso 4 — Split de tabela

expand (cria tabela nova vazia + FK) → dual-write (escreve em ambas) → backfill (copia histórico) → cutover (lê da nova) → contract (para de escrever na antiga; depois drop).

#### Caso 5 — Trocar PK (autoincrement → UUID)

adiciona coluna UUID + índice único e popula → código passa a usar UUID nas APIs (mantendo o ID antigo) → APIs deprecam o ID antigo → após o período de deprecation: drop do ID antigo e promove UUID a PK.

#### No Prisma

- **Expand é seguro:** `migrate dev`/`migrate deploy` para adicionar coluna nova, tabela, índice.
- **Dual-write/backfill** ficam no **código** (service/repository) e em **script de migração de dados** — não na migration de schema. Backfill grande: rodar em lotes, fora de transação única.
- **Contract** (`DROP`) é uma migration **separada**, só depois da estabilização. Nunca juntar add+drop na mesma migration de um rename — isso é o que vira destrutivo-atômico.
- Lembrar que `migrate dev` pode sugerir reset em divergência: em produção é sempre `migrate deploy`, nunca reset.

#### Regras universais (qualquer migration destrutiva)

1. **Backup completo antes de cada `DROP`/`ALTER` destrutivo.** Sem exceção.
2. **Down-migration escrita e testada** sempre que reversível; restore do backup já testado em ambiente isolado pelo menos uma vez.
3. **Verificação pós-deploy:** conferir **counts** (linhas antes/depois), **integridade referencial** (FKs sem órfãos) e **amostra de dados** (spot-check de registros reais).
4. **Plano de rollback documentado** antes de rodar (o que reverter, em que ordem, qual backup restaurar).
5. **Avisar consumidores** se a mudança afeta contrato de API externa.

---

## 8. Regras de uso de LLM (vibecoding)

### 5 regras de ouro

1. Sempre passe a documentação/contexto relevante.
2. Seja específico. Escopo claro, **uma tarefa por vez**.
3. **Revise TUDO** antes de aceitar. Nada entra sem leitura.
4. Corrija desvios imediatamente — não deixe o erro virar padrão.
5. LLM é copiloto, não piloto.

### Documentação atualizada sob demanda (ex.: Context7 MCP)

Um MCP de documentação injeta doc **atualizada e versionada** de libs no contexto na hora de gerar código — combate API alucinada/deprecada do cutoff do modelo.

**Acionar (custa tokens/contexto — usar cirurgicamente):**

- Ao gerar/ajustar código que toca API específica de lib que muda rápido: **Next.js 15 (App Router), Prisma, BullMQ, shadcn/ui**.
- Quando a versão importa (ex.: "route handler no App Router 15") ou há suspeita de API defasada.
- Antes de "inventar" assinatura de método de lib externa → consultar em vez de chutar.

**NÃO acionar (desperdício):**

- Scaffold de módulo padrão, refactor, lógica de domínio/negócio, bug sutil → os standards já carregam o padrão.
- NestJS core (estável) na maioria dos casos.

Regra: doc atualizada traz **doc**, não garante **padrão**. Continua valendo a regra de ouro #3 — revisar tudo.

### Regras invioláveis

1. Padronização > velocidade. 2. Cada camada no seu quadrado (controller recebe, service pensa, repository persiste). 3. Zero `any`. 4. Zero `console.log` (Logger do Nest). 5. Zero lógica no controller. 6. Zero Prisma direto no service. 7. Zero query sem paginação (skip/take, máx 100). 8. Senha só com bcrypt (12 rounds). 9. Zero `process.env` direto (ConfigService). 10. Soft delete por padrão (`deletedAt`). 11. Envelope `{ data, meta }` em toda response. 12. Validação obrigatória (class-validator no back, Zod no front). 13. **Named exports** — nunca `export default` em componentes. 14. Server Components por padrão; `'use client'` só quando necessário.

### Ordem de construção de uma feature

```
Banco:    1 model Prisma → 2 migration
Backend:  3 repository → 4 service → 5 DTOs → 6 controller → 7 module → 8 testar endpoints
Frontend: 9 types → 10 service HTTP → 11 hooks → 12 schema Zod → 13 componentes → 14 páginas
```

Uma tarefa por vez; revisar cada etapa.

### Anti-patterns a recusar

| Anti-pattern | Correção |
|---|---|
| Regra de negócio no controller | Mover pro service |
| `any` no TypeScript | Tipar ou `unknown` + narrowing |
| `console.log` | Logger do NestJS |
| Query sem paginação | skip/take com limite |
| Senha em plaintext | bcrypt hash + compare |
| Prisma direto no service | Via repository |
| Retornar entidade do banco | Mapear pra ResponseDto |
| God component (500+ linhas) | Componentes de ~150 linhas |
| `fetch` no componente | Service HTTP + React Query hook |
| Server state no Zustand | React Query para server state |
| `process.env` direto | ConfigService |
| Sem loading/error state | Tratar isLoading / isError / empty |
| Inventar lib desconhecida | Usar o que está na stack |
| Reescrever o que funciona | Migrar por espelho (Strangler Fig) |

### Anti-patterns proibidos (complemento)

| Anti-pattern | Por quê | Substituto |
|---|---|---|
| `catch (e) {}` que engole o erro | Bug silencioso — falha sem rastro, esconde a causa raiz | Log + re-throw, ou tratamento específico. No Nest, deixe a exception subir pro filtro global |
| `eval`, `new Function()`, `dangerouslySetInnerHTML` | RCE no back, XSS no front | Alternativa segura: parser/AST no back; sanitizar (ex.: DOMPurify) ou renderizar como texto no front |
| Migration destrutiva (`DROP`/rename de coluna) atômica com o deploy | Quebra produção no instante do deploy — sem janela de rollback | Expand-contract (seção 7): adiciona → migra dados → remove num deploy posterior |
| Cron/`setInterval` rodando dentro do processo da API | Single point of failure, não escala horizontal (cada réplica dispara o job), trava o event loop | Worker dedicado em **BullMQ + Redis** (repeatable jobs); API só enfileira |
| Importar de `dist/` em vez de `src/` | Artefato de build vazando pro código-fonte; quebra ao limpar o build | Imports sempre apontam pra `src/` (use paths/alias do tsconfig) |
| Lockfile (`package-lock.json`/`pnpm-lock.yaml`) não commitado | Build não-reproduzível — cada `install` resolve versões diferentes | Lockfile **sempre** commitado; CI com install frozen |
| Mock retornando objeto literal grande inline no teste | Esconde mudança de contrato — o mock não acompanha a mudança do schema | Factory tipada usando o schema/DTO real (mock quebra junto quando o contrato muda) |
| `setTimeout`/`Math.random()` dentro do teste | Flaky e não-determinístico — passa/falha sem mudança de código | `vi.useFakeTimers()` (ou equivalente) e RNG com seed fixa; aguarde o evento real, não um delay |

### Enforce automático (não confie só na memória)

- **Guardrails determinísticos** (hooks blocking/advisory) barram anti-pattern **antes** do edit.
- **Boundary checker** (`npm run check:boundaries`) enforça as fronteiras de módulo da seção 5.
- **Pre-commit (husky):** `tsc --noEmit` + `check:boundaries`, rodando só quando há `*.ts` de backend staged (commit de frontend/docs passa instantâneo). Bypass de emergência: `git commit --no-verify`.
- **Mexer em código vivo:** Strangler Fig, move-don't-rewrite.

### Checklists

- **Início de projeto:** CLAUDE.md do projeto (a partir do template) → stack (default + divergências) → repos `*-api`/`*-web` separados → Docker/compose dev → schema Prisma inicial + 1ª migration.
- **Pré-commit:** `tsc --noEmit` + boundary check verdes (husky).
- **Pré-deploy:** testes verdes → segredos fora do código/logs → rollback e backup testados → monitoramento/alerta ativos.

---

## 9. Template de CLAUDE.md para projetos

> **Como usar este template:**
> 1. Copie pra raiz do novo projeto como `CLAUDE.md`
> 2. Preencha as seções marcadas com `[PREENCHER]`
> 3. Remova seções que não se aplicam
> 4. Mantenha referências ao CLAUDE.md global — não duplique padrões que já estão lá
>
> **Localização no projeto:**
> ```
> ~/projetos/nome-do-projeto/
> ├── CLAUDE.md                    ← Este arquivo
> ├── .claude/                     ← Config específica (skills, agents, memory)
> ├── nome-do-projeto-api/         ← Backend
> └── nome-do-projeto-web/         ← Frontend
> ```

---

**⚠️ Instrução inicial pro Claude Code:**
Leia primeiro o CLAUDE.md global em `~/.claude/CLAUDE.md` (padrões globais).
Este arquivo *estende* aquele com contexto específico do projeto.

---

### Projeto

- **Nome:** [PREENCHER]
- **Propósito:** [PREENCHER — o que o produto faz e pra quem]
- **Status atual:** [PREENCHER — MVP, em produção, refactor...]

### Stack (divergências do default)

> Default = NestJS + Next.js 15 + Prisma + PostgreSQL + Tailwind + shadcn/ui + Docker.
> Liste só o que difere.

- [PREENCHER ou "segue 100% o default"]

### Arquitetura específica

- [PREENCHER — decisões de arquitetura, integrações, serviços externos]

### Regras de negócio chave

- [PREENCHER]

### Integrações

- [PREENCHER — ex.: gateway de pagamento, provedor de LLM, API de mensageria...]

### Escopo da sessão atual

- [PREENCHER — o que construir agora]

### Particularidades / pegadinhas

- [PREENCHER — o que já deu errado antes, o que evitar]

---

*Estende `~/.claude/CLAUDE.md`. Não duplicar padrões globais aqui.*

---

## 10. Referência completa Bravy

> **Como usar:** anexe este documento ao iniciar qualquer conversa com uma LLM (Claude, Cursor, etc.) antes de começar um projeto. Este bloco é auto-contido.

### Modo de Operação

Ao receber este arquivo, a LLM deve seguir este fluxo OBRIGATÓRIO:

#### 1. Ativar modo planejamento

NÃO comece a gerar código imediatamente. Primeiro, entenda o que o usuário quer construir.

#### 2. Fazer as perguntas de descoberta

Diga ao usuário que você leu os padrões e que antes de construir, precisa entender o projeto. Faça estas perguntas UMA POR VEZ (espere a resposta antes da próxima):

1. **"Qual problema você quer resolver?"** — Entenda a dor real. Ex: "Meus clientes esquecem de pagar"
2. **"Pra quem é esse sistema?"** — Quem vai usar. Ex: "Pra mim e minha equipe de 3 pessoas"
3. **"Qual o resultado mínimo que já resolve o problema?"** — O MVP mais enxuto possível
4. **"O que NÃO precisa ter agora?"** — Ajude o usuário a cortar escopo. Sugira o que pode ficar pra depois.
5. **"Como você vai saber se funcionou?"** — Métrica de sucesso

#### 3. Criar o plano do projeto

Com base nas respostas, gere um plano COMPLETO seguindo os padrões abaixo. O plano deve conter:

**A. Resumo do projeto** (2-3 frases)

**B. Módulos do backend** — Lista de cada módulo NestJS com:
- Nome do módulo
- Endpoints (verbo + rota)
- O que cada endpoint faz (1 frase)

**C. Tabelas do banco** — Schema Prisma completo com:
- Cada model com todos os campos, tipos e relações
- Enums necessários

**D. Telas do frontend** — Lista de cada página com:
- Rota (ex: /clients, /clients/new)
- O que aparece na tela
- Se tem formulário, tabela, dashboard, etc.

**E. Ordem de construção** — Camada por camada:
1. Infraestrutura (Docker, NestJS base, Prisma)
2. Autenticação (register, login, JWT, guards)
3. Módulos de negócio (um por vez, na ordem de dependência)
4. Frontend base (Next.js, layout, login)
5. Features frontend (uma por vez)
6. Polish (loading, erros, responsivo)

#### 4. Validar com o usuário

Depois de apresentar o plano, pergunte:
- "Esse plano faz sentido?"
- "Quer adicionar ou remover alguma coisa?"
- "Posso começar a construir pela Camada 1?"

#### 5. Construir camada por camada

Quando o usuário aprovar, construa UMA camada por vez. Depois de cada camada, pare e pergunte se quer testar antes de avançar.

### Regras Invioláveis

1. **Padronização > velocidade** — código fora do padrão será rejeitado
2. **Cada camada no seu quadrado** — Controller recebe, Service pensa, Repository persiste
3. **Zero `any`** — sempre tipar explicitamente
4. **Zero `console.log`** — usar Logger do NestJS
5. **Zero lógica no Controller** — apenas delegação
6. **Zero Prisma direto no Service** — sempre via Repository
7. **Zero query sem paginação** — sempre skip/take com limite máximo 100
8. **Zero senha em plaintext** — sempre bcrypt (12 rounds)
9. **Zero `process.env` direto** — sempre ConfigService
10. **Soft delete por padrão** — campo `deletedAt`, nunca DELETE físico
11. **Envelope obrigatório** — toda response: `{ data, meta }`
12. **Validação obrigatória** — DTOs com class-validator (backend), Zod (frontend)
13. **Named exports** — nunca `export default` em componentes
14. **Server Components por padrão** — `'use client'` somente quando necessário

### Arquitetura

#### Fluxo de uma Request (clique → banco → tela)

```
Frontend                              Backend                              Banco
─────────                             ───────                              ─────
1. Usuário clica "Salvar"
2. React Hook Form valida (Zod)
3. useMutation dispara
4. Service HTTP monta request
5. Axios envia com Bearer token ──→ 6. Request chega no NestJS
                                    7. ValidationPipe valida body (DTO)
                                    8. JwtAuthGuard verifica token
                                    9. Controller delega → Service
                                   10. Service aplica lógica
                                   11. Repository executa ──────────→ 12. PostgreSQL retorna
                                   13. Response envelopada ←──────── { data, meta }
14. React Query atualiza cache ←── Response volta
15. UI re-renderiza
```

#### Repositórios separados

```
{projeto}-api    → Backend NestJS
{projeto}-web    → Frontend Next.js
```

Comunicação exclusiva via API REST. Frontend nunca acessa o banco.

#### Ambientes

| Ambiente | Web | API | Banco |
|---|---|---|---|
| Local | `localhost:3000` | `localhost:3001` | Docker `localhost:5432` |
| Staging | `staging.{seu-dominio}` | `api-staging.{seu-dominio}` | PostgreSQL isolado |
| Produção | `app.{seu-dominio}` | `api.{seu-dominio}` | PostgreSQL + backup diário |

### Backend NestJS — estrutura detalhada

```
src/
├── main.ts                          # Bootstrap: pipes, filters, interceptors, CORS, Swagger
├── app.module.ts                    # Módulo raiz
├── common/
│   ├── constants/                   # UPPER_SNAKE constantes
│   ├── decorators/                  # @CurrentUser(), @Roles(), @Auth()
│   ├── dtos/pagination.dto.ts       # PaginationDto reutilizável
│   ├── enums/role.enum.ts
│   ├── filters/http-exception.filter.ts
│   ├── guards/{jwt-auth,roles}.guard.ts
│   ├── interceptors/{logging,transform}.interceptor.ts
│   ├── pipes/parse-uuid.pipe.ts
│   └── types/
├── config/                          # registerAs() configs tipadas
├── database/
│   ├── prisma.module.ts             # @Global, exports PrismaService
│   └── prisma.service.ts            # extends PrismaClient, onModuleInit
└── modules/
    └── {nome}/
        ├── {nome}.module.ts
        ├── {nome}.controller.ts
        ├── {nome}.service.ts
        ├── {nome}.repository.ts
        └── dtos/
            ├── create-{nome}.dto.ts
            ├── update-{nome}.dto.ts
            └── {nome}-response.dto.ts
```

#### Template: main.ts

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.use(helmet());
  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: config.get<string>('CORS_ORIGIN', 'http://localhost:3000'),
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  const swagger = new DocumentBuilder()
    .setTitle('API').setVersion('1.0').addBearerAuth().build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger));

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
  new Logger('Bootstrap').log(`Rodando em http://localhost:${port}`);
}
bootstrap();
```

#### Template: Controller

```typescript
@ApiTags('Recursos')
@Controller('recursos')
export class RecursosController {
  constructor(private readonly recursosService: RecursosService) {}

  @Post()
  async create(@Body() dto: CreateRecursoDto) {
    return this.recursosService.create(dto);
  }

  @Get()
  async findAll(@Query() pagination: PaginationDto) {
    return this.recursosService.findAll(pagination);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.recursosService.findOne(id);
  }

  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRecursoDto) {
    return this.recursosService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.recursosService.remove(id);
  }
}
```

#### Template: Service

```typescript
@Injectable()
export class RecursosService {
  constructor(private readonly recursosRepository: RecursosRepository) {}

  async create(dto: CreateRecursoDto): Promise<RecursoResponseDto> {
    const entity = await this.recursosRepository.create(dto);
    return RecursoResponseDto.fromEntity(entity);
  }

  async findAll(pagination: PaginationDto) {
    const { items, total } = await this.recursosRepository.findAll({
      skip: pagination.skip, take: pagination.limit, where: { deletedAt: null },
    });
    return { items: items.map(RecursoResponseDto.fromEntity), total, page: pagination.page, limit: pagination.limit };
  }

  async findOne(id: string): Promise<RecursoResponseDto> {
    const entity = await this.recursosRepository.findById(id);
    if (!entity) throw new NotFoundException(`Recurso "${id}" não encontrado`);
    return RecursoResponseDto.fromEntity(entity);
  }

  async update(id: string, dto: UpdateRecursoDto): Promise<RecursoResponseDto> {
    await this.findOne(id);
    const updated = await this.recursosRepository.update(id, dto);
    return RecursoResponseDto.fromEntity(updated);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.recursosRepository.softDelete(id);
  }
}
```

#### Template: Repository

```typescript
@Injectable()
export class RecursosRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.RecursoCreateInput) {
    return this.prisma.recurso.create({ data });
  }

  async findAll(params: { skip?: number; take?: number; where?: Prisma.RecursoWhereInput }) {
    const { skip, take, where } = params;
    const [items, total] = await Promise.all([
      this.prisma.recurso.findMany({ skip, take, where, orderBy: { createdAt: 'desc' } }),
      this.prisma.recurso.count({ where }),
    ]);
    return { items, total };
  }

  async findById(id: string) {
    return this.prisma.recurso.findFirst({ where: { id, deletedAt: null } });
  }

  async update(id: string, data: Prisma.RecursoUpdateInput) {
    return this.prisma.recurso.update({ where: { id }, data });
  }

  async softDelete(id: string) {
    return this.prisma.recurso.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
```

#### Template: DTOs

```typescript
// create-recurso.dto.ts
export class CreateRecursoDto {
  @ApiProperty({ example: 'Nome' })
  @IsString() @IsNotEmpty() @MaxLength(255)
  name: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(1000)
  description?: string;

  @ApiProperty({ example: 79.9 })
  @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive()
  price: number;
}

// update-recurso.dto.ts
export class UpdateRecursoDto extends PartialType(CreateRecursoDto) {}

// recurso-response.dto.ts
export class RecursoResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() createdAt: Date;

  static fromEntity(entity: any): RecursoResponseDto {
    const dto = new RecursoResponseDto();
    Object.assign(dto, { id: entity.id, name: entity.name, createdAt: entity.createdAt });
    return dto;
  }
}
```

#### Template: Module

```typescript
@Module({
  imports: [DatabaseModule],
  controllers: [RecursosController],
  providers: [RecursosService, RecursosRepository],
  exports: [RecursosService],
})
export class RecursosModule {}
```

#### Template: PaginationDto

```typescript
export class PaginationDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit: number = 20;

  get skip(): number { return (this.page - 1) * this.limit; }
}
```

### Frontend Next.js — estrutura detalhada

```
src/
├── app/                              # Rotas (App Router)
│   ├── layout.tsx                    # Providers, fontes, metadata global
│   ├── (auth)/login/page.tsx         # Rotas públicas
│   └── (dashboard)/
│       ├── layout.tsx                # Sidebar + header
│       └── products/page.tsx         # Listagem
├── components/
│   ├── ui/                           # shadcn/ui (não editar)
│   ├── layout/                       # sidebar, header, breadcrumbs
│   └── shared/                       # data-table, confirm-dialog, page-header
├── features/{nome}/
│   ├── components/                   # Componentes da feature
│   ├── hooks/                        # useProducts, useCreateProduct
│   ├── services/                     # HTTP calls via Axios
│   ├── schemas/                      # Zod schemas
│   └── types/                        # Interfaces TypeScript
├── hooks/                            # Hooks globais (useDebounce, useAuth)
├── lib/
│   ├── api.ts                        # Axios instance + interceptors
│   ├── utils.ts                      # cn() helper
│   └── query-client.ts               # React Query config
├── providers/                        # QueryProvider, AuthProvider
├── stores/                           # Zustand (sidebar, tema)
├── types/                            # Tipos compartilhados
└── middleware.ts                     # Auth redirect no edge
```

#### Template: Service HTTP

```typescript
import { api } from '@/lib/api';
import type { Product, CreateProductPayload, ProductsResponse } from '../types/product.types';

export const productService = {
  async getAll(filters?: ProductFilters): Promise<ProductsResponse> {
    const { data } = await api.get<ProductsResponse>('/products', { params: filters });
    return data;
  },
  async getById(id: string): Promise<Product> {
    const { data } = await api.get<Product>(`/products/${id}`);
    return data;
  },
  async create(payload: CreateProductPayload): Promise<Product> {
    const { data } = await api.post<Product>('/products', payload);
    return data;
  },
  async update({ id, ...payload }: UpdateProductPayload): Promise<Product> {
    const { data } = await api.patch<Product>(`/products/${id}`, payload);
    return data;
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/products/${id}`);
  },
};
```

#### Template: Hooks React Query

```typescript
export const PRODUCTS_QUERY_KEY = ['products'];

export function useProducts(filters?: ProductFilters) {
  return useQuery({
    queryKey: [...PRODUCTS_QUERY_KEY, filters],
    queryFn: () => productService.getAll(filters),
    placeholderData: (prev) => prev,
  });
}

export function useCreateProduct() {
  const router = useRouter();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateProductPayload) => productService.create(payload),
    onSuccess: () => {
      toast.success('Produto criado!');
      qc.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY });
      router.push('/products');
    },
    onError: (err: Error) => { toast.error(err.message || 'Erro ao criar produto'); },
  });
}
```

#### Template: Schema Zod + Formulário

```typescript
// schema
export const productSchema = z.object({
  name: z.string().min(3, 'Mínimo 3 caracteres').max(120),
  description: z.string().min(10).max(500),
  price: z.number().positive('Deve ser positivo').multipleOf(0.01),
  status: z.enum(['active', 'inactive', 'draft']),
});
export type ProductFormData = z.infer<typeof productSchema>;
```

```tsx
// formulário
'use client';
export function ProductForm({ defaultValues, onSubmit, isLoading }: ProductFormProps) {
  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: defaultValues ?? { name: '', description: '', price: 0, status: 'draft' },
  });
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem><FormLabel>Nome</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
        </Button>
      </form>
    </Form>
  );
}
```

#### Template: Axios com interceptors

```typescript
export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      // Tentar refresh ou redirecionar para /login
    }
    return Promise.reject(new Error(error.response?.data?.message || error.message));
  },
);
```

### Banco de Dados (Prisma)

#### Regras de modelagem

| Regra | Exemplo |
|---|---|
| Models em PascalCase singular | `model Order` |
| Campos `id`, `createdAt`, `updatedAt`, `deletedAt` em todo model | Template abaixo |
| `@@map` para snake_case plural | `@@map("orders")` |
| `@map` para colunas snake_case | `createdAt @map("created_at")` |
| Relações explícitas com `@relation` | `@relation(fields: [customerId], references: [id])` |
| Índices nomeados | `@@index([field], name: "idx_table_field")` |
| IDs com UUID | `@id @default(cuid())` ou `@default(uuid())` |

#### Template: Model Prisma

```prisma
model NomeDoModel {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  deletedAt DateTime? @map("deleted_at")

  name    String
  // ... campos específicos

  @@map("nome_da_tabela_plural")
}
```

#### Comandos essenciais

| Comando | Quando |
|---|---|
| `npx prisma migrate dev --name descricao` | Dev: cria e aplica migration |
| `npx prisma migrate deploy` | Produção: aplica pendentes |
| `npx prisma migrate reset` | Dev: destrói e recria + seed |
| `npx prisma generate` | Regenera Client após mudar schema |
| `npx prisma studio` | Interface visual do banco |
| `npx prisma db seed` | Popula dados iniciais |

#### Patterns de query

```typescript
// Paginação
const [items, total] = await Promise.all([
  prisma.product.findMany({ where: { deletedAt: null }, skip, take, orderBy: { createdAt: 'desc' } }),
  prisma.product.count({ where: { deletedAt: null } }),
]);

// Transação atômica
return prisma.$transaction(async (tx) => {
  const order = await tx.order.create({ data: orderData });
  await tx.product.update({ where: { id: productId }, data: { stock: { decrement: qty } } });
  return order;
});

// Filtros dinâmicos
const where: Prisma.ProductWhereInput = { organizationId: orgId, deletedAt: null };
if (search) where.OR = [
  { name: { contains: search, mode: 'insensitive' } },
  { description: { contains: search, mode: 'insensitive' } },
];
```

### Autenticação

#### Fluxo JWT

```
Registro/Login → Backend gera accessToken (15min) + refreshToken (7d)
                 refreshToken salvo hasheado (bcrypt) no banco
Request autenticado → Header: Authorization: Bearer <accessToken>
                      JwtAuthGuard valida → JwtStrategy extrai user
Token expirado → 401 → Frontend POST /auth/refresh { refreshToken }
                       → Novo par de tokens (rotation)
Logout → Remove refreshToken do banco + limpa client
```

#### Guards globais (secure by default)

```typescript
{ provide: APP_GUARD, useClass: JwtAuthGuard },   // Toda rota protegida
{ provide: APP_GUARD, useClass: RolesGuard },      // Verifica @Roles()
```

Rotas públicas usam `@Public()` para desativar JwtAuthGuard.

#### RBAC

```typescript
@Roles(Role.ADMIN, Role.MANAGER)
@Post()
async create(@Body() dto: CreateDto) { ... }

// Frontend: esconder UI por role
<RoleGate allowedRoles={['ADMIN']}><AdminPanel /></RoleGate>
```

### API REST

#### Verbos e Status Codes

| Método | Rota | Ação | Status sucesso |
|---|---|---|---|
| GET | `/resources` | Listar | 200 |
| GET | `/resources/:id` | Buscar um | 200 |
| POST | `/resources` | Criar | 201 |
| PATCH | `/resources/:id` | Atualizar parcial | 200 |
| DELETE | `/resources/:id` | Remover | 204 |

#### Envelope de response

```json
{ "data": { "id": "...", "name": "..." }, "meta": { "timestamp": "...", "requestId": "..." } }

{ "data": [...], "meta": { "pagination": { "page": 1, "limit": 20, "total": 142, "totalPages": 8 } } }

{ "statusCode": 404, "message": "Recurso não encontrado", "error": "Not Found", "timestamp": "...", "path": "/api/v1/..." }
```

### DevOps

#### Dockerfile NestJS (multi-stage)

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json prisma/ ./
RUN npm ci --ignore-scripts && npx prisma generate

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nestjs && adduser --system --uid 1001 nestjs
COPY --from=build /app/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
USER nestjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget --spider http://localhost:3000/health || exit 1
CMD ["node", "dist/main.js"]
```

#### Dockerfile Next.js (standalone)

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nextjs && adduser --system --uid 1001 nextjs
COPY --from=build /app/public ./public
COPY --from=build --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nextjs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3001
CMD ["node", "server.js"]
```

#### docker-compose.yml (dev)

> Credenciais abaixo são **placeholders de desenvolvimento local** — defina as suas via `.env` (nunca commitar senha real).

```yaml
services:
  postgres:
    image: postgres:16-alpine
    ports: ["5432:5432"]
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-app}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-change_me_dev}
      POSTGRES_DB: ${POSTGRES_DB:-app_dev}
    volumes: [pg_data:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER:-app}"]
      interval: 10s
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
volumes:
  pg_data:
```

### Segurança — Checklist

| # | Item | Detalhe |
|---|---|---|
| 1 | Helmet | Primeiro middleware, headers de segurança |
| 2 | CORS | Whitelist de origens, nunca `*` em prod |
| 3 | Rate limiting | `@nestjs/throttler` global + restritivo em login |
| 4 | ValidationPipe | `whitelist: true`, `forbidNonWhitelisted: true` |
| 5 | Secrets | Nunca no git, validar com Zod na inicialização |
| 6 | Bcrypt | 12 rounds, nunca plaintext |
| 7 | JWT secret | 64+ bytes, access 15min, refresh 7d com rotation |
| 8 | HTTPS | Obrigatório em produção |
| 9 | `npm audit` | Zero vulnerabilidades críticas |
| 10 | Queries parametrizadas | Nunca `$queryRawUnsafe` |
| 11 | Uploads | Validar tipo, tamanho, renomear com UUID |
| 12 | Logs | Nunca logar senhas/tokens |
| 13 | Login genérico | Sempre "Credenciais inválidas" |

### Anti-patterns comuns de LLMs

| Anti-pattern | Correção |
|---|---|
| Lógica de negócio no Controller | Mover para Service |
| `any` no TypeScript | Tipar explicitamente ou `unknown` + narrowing |
| `console.log` | Logger do NestJS |
| Queries sem paginação | Sempre skip/take com limite máximo |
| Senhas em plaintext | bcrypt hash + compare |
| Prisma direto no Service | Usar Repository |
| Retornar entidade do banco direto | Mapear para ResponseDto |
| God components (500+ linhas) | Componentes de ~150 linhas |
| fetch direto no componente | Service HTTP + React Query hook |
| Estado do servidor no Zustand | React Query para server state |
| `process.env` direto | ConfigService do NestJS |
| Sem loading/error states | Sempre tratar isLoading, isError, empty state |

### Ordem para criar uma feature nova

| # | Etapa | Camada | Arquivo |
|---|---|---|---|
| 1 | Model Prisma | Banco | `prisma/schema.prisma` |
| 2 | Migration | Banco | `npx prisma migrate dev --name ...` |
| 3 | Repository | Backend | `{nome}.repository.ts` |
| 4 | Service | Backend | `{nome}.service.ts` |
| 5 | DTOs | Backend | `create/update/response.dto.ts` |
| 6 | Controller | Backend | `{nome}.controller.ts` |
| 7 | Module | Backend | `{nome}.module.ts` + registrar no `app.module.ts` |
| 8 | Testar endpoints | Backend | curl/Postman |
| 9 | Types | Frontend | `{nome}.types.ts` |
| 10 | Service HTTP | Frontend | `{nome}.service.ts` |
| 11 | Hooks | Frontend | `use-{nome}.ts`, `use-create-{nome}.ts` |
| 12 | Schema Zod | Frontend | `{nome}.schema.ts` |
| 13 | Componentes | Frontend | `{nome}-table.tsx`, `{nome}-form.tsx` |
| 14 | Páginas | Frontend | `page.tsx`, `new/page.tsx`, `[id]/page.tsx` |

### Variáveis de Ambiente (.env.example)

> Sempre commitar só o `.env.example` com placeholders — nunca o `.env` real.

```env
NODE_ENV=development
PORT=3000
CORS_ORIGIN=http://localhost:3001
DATABASE_URL=postgresql://<user>:<password>@localhost:5432/<database>
JWT_ACCESS_SECRET=<gere: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
JWT_REFRESH_SECRET=<gere outro diferente>
REDIS_URL=redis://localhost:6379
NEXT_PUBLIC_API_URL=http://localhost:3000
```

---

> **Este documento é auto-contido.** Ao recebê-lo, entre em modo planejamento, faça as perguntas de descoberta, e monte o plano completo do projeto antes de escrever qualquer código.
