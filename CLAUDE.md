# Regras do Maestri (só valem quando a sessão roda DENTRO do Maestri)

## 0. Primeiro, descubra em silêncio se você está no Maestri

Na primeira ação da sessão, rode uma vez:

    command -v maestri >/dev/null 2>&1 || [ -n "$MAESTRI_CLI" ] && echo MAESTRI || echo FORA

- **MAESTRI:** todas as regras abaixo valem, sem exceção.
- **FORA:** ignore este arquivo inteiro e trabalhe normal. Subagente interno
  liberado, navegação pelas ferramentas de sempre, sem nota de status, sem
  `maestri list`. E **não comente nada** sobre o Maestri: não avise que não está
  nele, não diga que pulou a nota, não explique a regra. Só siga a vida.

Dentro do Maestri, a regra que manda em todas as outras: **tudo o que você
fizer tem que ser visível para mim no canvas.** Se eu não consigo ver acontecendo,
está errado, mesmo que o resultado final esteja certo.

A CLI `maestri` está no PATH (se não achar, use "$MAESTRI_CLI"). Antes da primeira
ação de qualquer tarefa, rode `maestri list` para ver o que já está conectado a você.

## 1. Uma nota de status por sessão, e só uma

Antes do primeiro trabalho da sessão, rode `maestri list`. Se já existe uma nota
de status conectada a você, use ela. Se não existe, crie UMA:

    maestri note create --name "Status: <assunto da sessão>" "- [ ] etapa 1
    - [ ] etapa 2"

Daí em diante **não crie nota nova**. Cada pedido novo que eu fizer na mesma
sessão entra como item novo nessa mesma nota (`maestri note edit`, acrescentando
as linhas no fim). Nota nova só se eu pedir com essas palavras.

A nota é um checklist com uma linha por etapa. Marque cada etapa com
`maestri note edit` assim que ela terminar, e escreva o resultado final nela.

A nota de status é a ÚNICA nota que você cria por conta própria. Nada de nota
pra guardar texto, prompt, copy ou resultado solto: texto pra colar vai só pro
clipboard. Outra nota só quando eu pedir com essas palavras.

Tarefa pequena também entra na nota, como item. Se você me respondeu sem ter
registrado o pedido na nota, ou se abriu uma segunda nota sem eu pedir, você
descumpriu a regra.

## 2. Agente é terminal no canvas, nunca subagente interno

Está proibido usar sua ferramenta interna de subagente ou de tarefas paralelas.

Quando eu disser "chama X agentes", "manda dois agentes", "faz em paralelo",
"divide isso", "monta um time" ou qualquer coisa parecida, isso é ordem direta.
Recrute imediatamente um terminal por frente de trabalho:

    maestri recruit "Codinome" --preset "<preset>" --role "<papel>"

Rode `maestri preset list` e `maestri role list` antes, para usar os nomes certos.
Depois delegue com `maestri ask "Codinome" "..."`, ou com
`maestri ask --batch '{"A": "...", "B": "..."}'` para falar com vários em paralelo.

Não me pergunte se pode. Não decida por mim que a tarefa é simples demais para
valer um terminal: essa decisão é minha, não sua. Se eu pedi agente, é agente na
tela, mesmo que você resolvesse sozinho em dois minutos.

Se por algum motivo você NÃO conseguir recrutar, pare e me diga a razão exata
(por exemplo: Modo Maestro desligado neste terminal). Nunca faça o trabalho
sozinho e me entregue o resultado como se tivesse delegado.

## 3. Internet é portal no canvas, nunca ferramenta de fora

Está proibido usar WebSearch, WebFetch, curl, Playwright ou qualquer navegador
que eu não veja. Toda navegação acontece em um portal:

    maestri portal create <url> "Nome do portal"

E use os comandos de portal para operar a página: `navigate`, `click`, `type`,
`fill`, `scroll`, `text`, `snapshot`, `screenshot`, `evaluate`.

Todo agente que você recrutar para pesquisar recebe o próprio portal.

## 4. Todo terminal nasce em modo bypass

Os presets já sobem em bypass. Se você precisar sobrescrever o comando, use
`--command "claude --permission-mode bypassPermissions"`. Terminal que sobe
pedindo permissão trava a fila inteira, porque quem chamou ele foi outro agente,
que não vai clicar em nada.

## 5. Conecte todo mundo na nota

Recruta que não enxerga a nota de status trabalha cego. Conecte cada um com
`maestri connect`, e deixe o time inteiro lendo e escrevendo a mesma nota.

## 6. Fechamento

Ao terminar: escreva o resultado na nota, dispense quem acabou com
`maestri dismiss "Codinome"` e me avise com `maestri notify "<mensagem>"`.

# CLAUDE.md — Cesta

> **Leitura obrigatória antes de qualquer sessão de código:**
> 1. [`claude-geral-consolidado.md`](./claude-geral-consolidado.md) — padrões globais (stack, nomenclatura, camadas, templates)
> 2. [`cesta.md`](./cesta.md) — documento de produto (features, regras, roadmap)
> 3. [`cesta-identidade-visual.md`](./cesta-identidade-visual.md) — design system

Este arquivo *estende* o `claude-geral-consolidado.md` com contexto específico do Cesta. Não duplicar padrões globais aqui.

---

## Projeto

- **Nome:** Cesta
- **Propósito:** App mobile-first (PWA) de comparação de preços de supermercados para a Comunidade de Madrid. Catálogo em tempo quase-real, controle de gastos via OCR de notas, alertas de preço, avaliações de produtos e cesta familiar personalizada.
- **Status atual:** scaffolding inicial (Layer 1 — infra base)
- **Idiomas UI:** Espanhol (padrão) e Português Brasileiro

---

## Stack (divergências do default)

**Segue 100% o default** (NestJS + Next.js 15 + Prisma + PostgreSQL + Tailwind + shadcn/ui + Docker + BullMQ + Redis + Zod + React Query + Zustand + Axios).

Divergências/ênfases:
- **PWA**: `cesta-web` configurado como PWA com manifest + service worker (`next-pwa` ou equivalente)
- **OCR**: biblioteca Tesseract.js (ou serviço externo) dentro do worker BullMQ `receipts`
- **i18n**: `next-intl` no frontend; mensagens traduzidas em `es.json` + `pt-BR.json`

---

## Arquitetura específica

```
cesta/
├── CLAUDE.md
├── cesta.md
├── cesta-identidade-visual.md
├── claude-geral-consolidado.md
├── docker-compose.yml
├── .env.example
├── _prototype/           ← protótipo original do Perplexity (referência visual)
├── cesta-api/            ← backend NestJS
└── cesta-web/            ← frontend Next.js 15
```

### Módulos previstos (backend)

| Módulo | Responsabilidade |
|--------|------------------|
| `auth` | Register/login (email ou telefone), JWT access/refresh, guards globais |
| `users` | CRUD de usuários, perfil, preferências de idioma |
| `supermarkets` | Catálogo de redes (Mercadona, Carrefour, etc.) |
| `products` | Catálogo de produtos + categorias + info nutricional |
| `product-prices` | Preço atual + histórico (`PriceSnapshot`) por produto/supermercado |
| `catalog-sync` | Adapters por rede + jobs BullMQ de ingestão |
| `reviews` | Avaliações e comentários de produtos |
| `favorites` | Favoritos do usuário |
| `shopping-lists` | Listas manuais recorrentes ("Minha Lista") + cálculo real-time por mercado |
| `alerts` | Alertas de preço do usuário + verificador |
| `receipts` | Scan de nota fiscal (upload + job OCR) |
| `expenses` | Compras registradas + dashboard de gastos |
| `family-profiles` | Perfil familiar (membros + respostas + restrições) |
| `family-baskets` | Cesta familiar gerada (worker BullMQ) |
| `notifications` | Push notifications via BullMQ |

### Features frontend (telas)

| Rota | Função |
|------|--------|
| `/(auth)/login` · `/(auth)/register` | Login/cadastro email ou telefone |
| `/` | Home: busca + categorias + promoções do dia |
| `/produto/[pid]` | Detalhe + preços por mercado + nutrição + reviews |
| `/comparar` | Comparação direta multi-produto |
| `/gastos` | Scan/upload de nota + dashboard |
| `/alertas` | Lista + criação |
| `/minha-lista` · `/minha-lista/[id]` | Lista(s) do usuário + comparativo em tempo real por mercado |
| `/minha-cesta/configurar` | Wizard familiar |
| `/minha-cesta` | Cesta gerada editável |
| `/perfil` | Idioma + localização + favoritos + config |

---

## Regras de negócio chave

- **Preços sempre em `€` com 2 casas decimais**. Nunca float — `Decimal(10,2)` no Prisma, `z.number().multipleOf(0.01)` no front.
- **Preços nunca vêm do frontend**. Toda escrita de preço passa por `catalog-sync` (oficial) ou `price-correction` (crowdsourced via receipt).
- **OCR é job assíncrono**. Endpoint de upload de nota retorna 202 + `jobId`.
- **Geração de cesta familiar é assíncrona**. Trigger retorna 202; cesta fica acessível quando o job conclui.
- **1 review por usuário por produto** (`@@unique([userId, productId])`).
- **Regenerate de cesta** preserva items com `isLocked=true` ou `isRequired=true`; só substitui os demais.
- **Usuário anônimo não existe**: review, favorito, alerta, receipt, cesta familiar — tudo requer login.
- **Login por email OU telefone**. User model tem ambos opcionais, pelo menos um obrigatório.
- **Confiança de preço** (`confidenceScore` em `ProductPrice`): fonte oficial = 1.00; crowdsourced 3+ confirmações = 0.90; 1 confirmação = 0.50.
- **UI mostra aviso quando `isStale=true`** (preço não atualizado há > X horas por falha do adapter).

---

## Integrações previstas

- **Fontshare** (fontes Satoshi + Cabinet Grotesk) — carregadas via `next/font/local` após download
- **Mercadona API** (`tienda.mercadona.es`) — adapter `mercadona.adapter.ts`
- **Carrefour/Alcampo/DIA** — endpoints JSON do e-commerce
- **Froiz** — scraping HTML (Cheerio)
- **LIDL/Aldi** — folleto PDF + OCR (fase 2)
- **Tesseract.js** — OCR de notas fiscais (worker `receipts`)
- **Twilio / SNS** — SMS para login por telefone (fase 2; MVP pode começar só com email)
- **Web Push API** — notificações (via BullMQ worker)

---

## Escopo da sessão atual

**Layer 1 — Infra base + repositórios:**
1. Scaffold `cesta-api` (NestJS + Prisma + estrutura common/config/database)
2. Scaffold `cesta-web` (Next.js 15 + Tailwind + shadcn/ui com tokens Cesta)
3. `docker-compose.yml` com Postgres + Redis
4. `.env.example` + `.gitignore`
5. Init git + repositório GitHub privado

**Próximas layers (ordem):**
- Layer 2: módulo `auth` (email/telefone + JWT + refresh) ✓
- Layer 3: módulos `supermarkets` + `products` + `product-prices` + seed inicial (importar Google Sheets do Perplexity)
- Layer 4: módulo `shopping-lists` ("Minha Lista") + comparativo real-time
- Layer 5: módulo `reviews`
- Layer 6: módulos `family-profiles` + `family-baskets` + worker de geração
- Layer 7: `catalog-sync` (primeiro adapter: Mercadona)
- Layer 8: `receipts` + OCR + `price-correction`
- Layer 9: `alerts` + `notifications`

---

## Hospedagem (planejado)

Preferência: **tudo em free tier durante testes/baixo volume**. Railway não é aceitável (cobra por token mesmo em projetos pequenos).

### Plano principal (free tier combinado)

| Peça | Serviço | Free tier |
|------|---------|-----------|
| `cesta-web` (Next.js) | **Vercel Hobby** | 100GB/mês bandwidth, preview deploys automáticos por PR |
| `cesta-api` (NestJS) | **Render free** | 750h/mês, spin-down após 15min idle (OK pra poucos users; cold start ~30s) |
| Postgres | **Neon free** | 3GB, sem spin-down, serverless Postgres |
| Redis (BullMQ) | **Upstash free** | 10k comandos/dia, serverless Redis |

Cold start do Render em free tier: ao acessar após 15min parado, primeira request leva ~30s. Aceitável em testes; migração pra plano pago (US$ 7/mês) remove o spin-down quando houver tráfego real.

### Alternativa "pura Vercel" (trabalho extra)

Se quiser zero spin-down sem custo, exige refatoração:
- Migrar NestJS → Next.js API routes (ou `@vendia/serverless-express` na Vercel) — cold start ruim com Prisma
- Trocar BullMQ worker → **Vercel Cron Jobs** (2 por projeto na Hobby) + **Upstash QStash** (webhook queue) para jobs assíncronos
- OCR de nota fiscal: usar **Vercel Function** com timeout 10s (Hobby) ou 60s (Pro US$20/mês)

Não decidir agora. Avaliar quando houver tráfego real.

### Workflow previsto

Push em branch → Vercel Preview do frontend apontando pra API de staging. Merge `main` → deploy produção.

---

## Particularidades / pegadinhas

- **Diretório na raiz `OneDrive`** — OneDrive pode fazer sync agressivo. Preferir desabilitar sync em `node_modules/` via `.nosync` ou mover projeto futuramente para fora do OneDrive se der problema.
- **PowerShell é o shell padrão**. Scripts devem respeitar sintaxe PS; alternativamente usar bash via WSL/git-bash.
- **Google Sheets do Perplexity** é o seed inicial do catálogo — importar antes de começar features que dependem de produtos.
- **Legal**: scraping tem área cinza. Cada adapter respeita robots.txt, User-Agent identificado, rate-limit baixo (1 req/s), cache agressivo (máx 1 fetch/dia por produto).
- **Preço por geolocalização**: Mercadona varia por CEP. MVP ignora; fase 2 armazena `postalCode` em `ProductPrice`.

---

*Estende `claude-geral-consolidado.md`. Não duplicar padrões globais aqui.*
