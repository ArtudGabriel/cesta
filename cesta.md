# Cesta — Documento de Produto

> Versão: 0.2  
> Identidade visual: ver [`cesta-identidade-visual.md`](./cesta-identidade-visual.md)  
> Padrões de desenvolvimento: ver [`claude-geral-consolidado.md`](./claude-geral-consolidado.md) — **leitura obrigatória antes de qualquer sessão de código**

---

## 1. Visão Geral

**Cesta** é um aplicativo mobile-first para a **Comunidade de Madrid** — que inclui a capital e todos os seus municípios e pueblos — que ajuda qualquer pessoa a comparar preços de produtos nas principais redes de supermercados da Espanha, controlar seus gastos de mercado e planejar o orçamento alimentar da sua família.

O app é desenvolvido primeiramente para **celular** (Android e iOS via PWA ou app nativo) e disponibilizado nos idiomas **espanhol** e **português brasileiro**, podendo ser expandido para outros idiomas posteriormente.

**Supermercados cobertos (fase inicial):**  
Mercadona, Carrefour, Alcampo, LIDL, Froiz, DIA, Aldi — com possibilidade de expansão para outras redes.

---

## 2. Público-alvo

- Moradores da Comunidade de Madrid (españoles e imigrantes, especialmente a comunidade brasileira e latino-americana)
- Famílias que querem economizar nas compras de supermercado
- Pessoas que fazem controle financeiro pessoal
- Consumidores que se preocupam com nutrição e qualidade dos alimentos

---

## 3. Funcionalidades

### 3.1 Catálogo de Produtos e Comparação de Preços

O catálogo central do app lista produtos disponíveis nos supermercados cobertos com seus respectivos preços.

**O usuário pode:**
- Buscar produtos por nome genérico (ex: "leche entera") ou por marca
- Ver o preço do mesmo produto em diferentes supermercados lado a lado
- Comparar por **unidade de medida padronizada**: preço por litro, por kg, por 100ml, por 100g, por unidade — independentemente da embalagem original do produto
- Visualizar variações de preço ao longo do tempo (histórico)
- Ver se o produto está em promoção em alguma rede

**Filtros disponíveis:**
- Por supermercado
- Por categoria (lácteos, carnes, frutas, higiene, etc.)
- Por preço (faixa de preço, menor preço primeiro, melhor custo-benefício por medida)
- Por informação nutricional (calorias, proteínas, gorduras, açúcar, sal, etc.)
- Por marca
- Por produtos em promoção
- Por produtos avaliados pela comunidade (melhores avaliados)
- Por restrições alimentares (sem glúten, sem lactose, vegano, vegetariano, etc.)

---

### 3.2 Comparação por Medida Padronizada

Produtos de embalagens diferentes (ex: leite de 1L vs 1,5L) são normalizados para comparação justa:

- Preço por **litro** (bebidas, azeite, leite, etc.)
- Preço por **kg** (carnes, frutas, vegetais, arroz, etc.)
- Preço por **100g** (embutidos, queijos, etc.)
- Preço por **100ml** (sucos, iogurtes, etc.)
- Preço por **unidade** (ovos, frutas vendidas individualmente, etc.)

O usuário vê claramente qual embalagem e qual mercado oferecem o menor preço real, sem precisar fazer cálculos.

---

### 3.3 Controle de Gastos

O usuário pode registrar suas compras e acompanhar o quanto gasta no mercado ao longo do tempo.

**Formas de registrar uma compra:**
1. **Escaneando a nota fiscal** com a câmera do celular (OCR automático extrai itens e valores)
2. **Enviando uma foto** da nota fiscal da galeria do celular
3. **Inserção manual** de itens e valores

**Visualizações disponíveis:**
- Gasto total por **dia**
- Gasto total por **semana**
- Gasto total por **mês**
- Gasto total por **supermercado**
- Gasto total por **categoria** de produto
- **Histórico** de todas as compras registradas
- Comparação entre períodos (esta semana vs semana passada, este mês vs mês anterior)
- **Equilíbrio da cesta**: distribuição percentual do gasto entre categorias (proteínas, carboidratos, higiene, etc.)

O usuário pode adicionar notas a cada compra registrada.

---

### 3.4 Alertas de Preço e Promoções

O usuário pode monitorar produtos específicos e receber notificações quando houver mudança de preço ou promoção.

**Tipos de alerta:**
- Produto entra em promoção em qualquer supermercado
- Produto atinge um preço-alvo definido pelo usuário (ex: "me avise quando o azeite baixar de €3,50")
- Promoção prestes a terminar (urgência)
- Produto volta ao estoque (disponibilidade)

**Gestão de alertas:**
- Lista de todos os alertas ativos
- Histórico de alertas disparados
- Ativar/desativar alertas individualmente

---

### 3.5 Avaliações e Comentários

Cada produto no catálogo possui uma seção de avaliações feitas pela comunidade de usuários do Cesta.

**O usuário pode:**
- Dar uma nota ao produto (1 a 5 estrelas)
- Escrever um comentário explicando sua avaliação
- Marcar comentários de outros usuários como úteis
- Reportar comentários inadequados
- Filtrar avaliações por nota, por mais recentes, por mais úteis
- Ver a nota média do produto e a distribuição das notas

**Regras:**
- Avaliações são vinculadas ao perfil do usuário (não anônimas)
- Apenas usuários que registraram a compra do produto podem avaliar (opcional, configurável)
- Moderação básica para evitar spam e conteúdo impróprio

---

### 3.6 Cesta Familiar (Planejamento de Orçamento)

Funcionalidade de planejamento que gera uma **cesta de compras estimada** com base no perfil da família do usuário, entregando uma média de custo mensal de mercado e uma lista de produtos sugeridos.

#### 3.6.1 Configuração do Perfil Familiar

O usuário preenche um formulário guiado com as seguintes informações:

**Composição da família** (por faixas etárias):
- Bebês (0–2 anos)
- Crianças pequenas (3–6 anos)
- Crianças (7–12 anos)
- Adolescentes (13–17 anos)
- Adultos (18–59 anos)
- Idosos (60+ anos)

**Perguntas sobre hábitos alimentares** (exemplos):
- A família come carne? (Sim / Não / Alguns membros)
- Come peixe? (Sim / Não / Alguns membros)
- Come pão regularmente?
- Consome laticínios?
- Alguém tem intolerância à lactose?
- Alguém tem doença celíaca ou intolerância ao glúten?
- A família segue dieta vegana ou vegetariana?
- Consome álcool (vinho, cerveja)?
- Com que frequência come frutas e vegetais?
- Faz refeições em casa todos os dias ou come fora com frequência?
- Tem pets em casa que consomem ração?

#### 3.6.2 Cesta Gerada

Com base nas respostas, o app gera automaticamente:

- **Lista de produtos recomendados** por categoria, com quantidades estimadas para o mês
- **Custo médio mensal estimado** com base nos preços atuais dos supermercados cobertos
- **Variação de custo** entre supermercados (quanto custaria a mesma cesta em cada rede)
- Destaque para produtos da cesta que estão em promoção no momento

#### 3.6.3 Edição da Cesta Familiar

O usuário tem controle total sobre a cesta gerada:

- **Adicionar produto** não sugerido
- **Remover produto** sugerido
- **Alterar quantidade** de qualquer produto
- **Substituir produto** por similar (ex: trocar leite integral por desnatado)
- **Marcar produto como obrigatório** (sempre incluso, nunca removido por sugestões automáticas)
- **Adicionar restrição** (ex: "nunca sugerir essa marca", "sem produtos com palma")
- **Bloquear categoria inteira** (ex: "sem bebidas alcoólicas")
- Regenerar sugestões mantendo as restrições e obrigatórios

A cesta familiar é atualizada automaticamente quando os preços mudam, refletindo sempre o custo estimado atual.

---

## 4. Navegação e Estrutura do App

```
├── Home / Busca
│   ├── Busca por produto
│   ├── Categorias em destaque
│   └── Promoções do dia
│
├── Produto (detalhe)
│   ├── Preços por supermercado
│   ├── Comparação por medida
│   ├── Histórico de preço
│   ├── Info nutricional
│   ├── Avaliações e comentários
│   └── Adicionar alerta
│
├── Comparar
│   └── Comparação direta de múltiplos produtos/supermercados
│
├── Gastos
│   ├── Escaneamento de nota fiscal
│   ├── Dashboard de gastos
│   └── Histórico de compras
│
├── Alertas
│   ├── Alertas ativos
│   └── Histórico de alertas
│
├── Minha Cesta
│   ├── Configuração familiar
│   ├── Cesta gerada/editada
│   └── Custo estimado por supermercado
│
└── Perfil
    ├── Idioma (Español / Português)
    ├── Localização (cidade/pueblo)
    ├── Favoritos
    └── Configurações
```

---

## 5. Plataformas e Tecnologia

### 5.1 Entrega

- **Mobile-first**: experiência otimizada para smartphones (Android e iOS)
- **PWA**: instalável via navegador sem necessidade de app store, com suporte a notificações push e câmera
- **Idiomas**: Espanhol (padrão) e Português Brasileiro
- **Offline parcial**: dados de preços e favoritos cacheados localmente para consulta sem internet

### 5.2 Stack técnica

Segue a stack canônica definida em `claude-geral-consolidado.md`. Divergências explicitadas abaixo.

| Camada | Tecnologia | Observação |
|--------|-----------|------------|
| Linguagem | TypeScript | End-to-end, front e back |
| Backend | NestJS | API REST modular |
| Frontend | Next.js 15 (App Router) | Mobile-first PWA |
| Banco | PostgreSQL 16 | — |
| ORM | Prisma | Migrations versionadas |
| Estilo | Tailwind CSS | Tokens mapeados da identidade visual |
| UI | shadcn/ui | Componentes base; customizados com tokens Cesta |
| Auth | JWT | Access 15min + refresh 7d com rotation |
| Validação back | class-validator + class-transformer | DTOs com decorators |
| Validação front | Zod + React Hook Form | Schema → zodResolver |
| Server state | React Query (TanStack) | Cache de preços, produtos, gastos |
| Client state | Zustand | UI state (filtros ativos, idioma, tema) |
| HTTP client | Axios | Interceptors de auth, baseURL por env |
| Filas/Jobs | BullMQ + Redis | OCR de notas fiscais, envio de alertas, notificações push |
| Testes | Jest + Supertest | Unit nos services, e2e na API |
| Containers | Docker + docker-compose | Dev = prod |
| CI/CD | GitHub Actions | Lint → Test → Build → Deploy |

**Idioma no código:** inglês (variáveis, funções, nomes de arquivo, commits). Texto/explicação: PT-BR.

### 5.3 Estrutura de repositórios

```
cesta/
├── CLAUDE.md                  ← contexto do projeto (estende o global)
├── .claude/                   ← skills/agents/memory do projeto
├── cesta.md                   ← este documento (produto)
├── cesta-identidade-visual.md ← design system
├── claude-geral-consolidado.md← padrões globais de desenvolvimento
├── cesta-api/                 ← backend NestJS
└── cesta-web/                 ← frontend Next.js 15
```

Frontend **nunca** acessa o banco diretamente. Comunicação exclusiva via API REST (`cesta-api`).

### 5.4 Processamento assíncrono (BullMQ)

Operações pesadas saem do ciclo request/response e vão para filas:

| Job | Fila | Trigger |
|-----|------|---------|
| OCR de nota fiscal (scan de compra) | `receipts` | Upload de imagem pelo usuário |
| Verificação de alertas de preço | `price-alerts` | Atualização de preços no catálogo |
| Envio de notificação push | `notifications` | Job de alerta disparado |
| Atualização de preços (crawler/import) | `catalog-sync` | Cron periódico |
| Geração de cesta familiar | `basket-generation` | Submissão do perfil familiar |
| Correção crowdsourced de preços | `price-correction` | Nota fiscal processada por OCR |

Endpoint retorna `202 Accepted` com `jobId`; frontend faz polling ou recebe push quando o job conclui.

### 5.5 Ingestão de dados de preços (CORE do produto)

O valor do Cesta depende de **preços reais em tempo quase-real**. Objetivo: usuário olha preço no app → chega no mercado → preço bate. Qualquer divergência relevante quebra a confiança no produto.

#### 5.5.1 Fontes por supermercado

| Rede | Fonte primária | Frequência | Dificuldade |
|------|---------------|------------|-------------|
| **Mercadona** | API pública `tienda.mercadona.es` (JSON, por CEP) | Diária | Baixa |
| **Carrefour** | E-commerce JSON endpoints `carrefour.es` | Diária | Baixa-Média |
| **Alcampo** | E-commerce JSON `alcampo.es` | Diária | Média |
| **Froiz** | Website `froiz.com` (scraping HTML) | Semanal | Média |
| **DIA** | E-commerce `dia.es` (JSON) | Diária | Baixa-Média |
| **LIDL** | Folleto semanal PDF + scraping do site | Semanal | **Alta** (sem API, preços em PDF/imagem) |
| **Aldi** | Catálogo semanal + fichas de produto | Semanal | Alta |

#### 5.5.2 Arquitetura de ingestão

```
┌─────────────────────────────────────────────────────┐
│  catalog-sync (BullMQ)                              │
│                                                     │
│  Repeatable jobs por rede:                          │
│    sync:mercadona  → cron diário 03:00              │
│    sync:carrefour  → cron diário 03:30              │
│    sync:alcampo    → cron diário 04:00              │
│    sync:froiz      → cron semanal (terça 05:00)     │
│    sync:dia        → cron diário 04:30              │
│    sync:lidl       → cron semanal + OCR do folleto  │
│    sync:aldi       → cron semanal + OCR do folleto  │
└─────────────────────────────────────────────────────┘
          │
          ▼ Strategy pattern (um adapter por rede)
┌─────────────────────────────────────────────────────┐
│  SupermarketAdapter interface                       │
│    fetchProducts(): Promise<RawProduct[]>           │
│    normalizeProduct(raw): NormalizedProduct         │
└─────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────┐
│  PriceIngestionService                              │
│    - matching produto existente (EAN, nome, marca)  │
│    - cria PriceSnapshot (histórico)                 │
│    - atualiza currentPrice no ProductPrice          │
│    - dispara price-alerts se queda >= limiar        │
└─────────────────────────────────────────────────────┘
```

Cada adapter mora em `cesta-api/src/modules/catalog-sync/adapters/`:
- `mercadona.adapter.ts`
- `carrefour.adapter.ts`
- `alcampo.adapter.ts`
- `froiz.adapter.ts`
- `dia.adapter.ts`
- `lidl.adapter.ts`
- `aldi.adapter.ts`

#### 5.5.3 Correção crowdsourced via notas fiscais

Usuários alimentam/corrigem o catálogo automaticamente ao escanear notas:

1. Usuário escaneia nota fiscal → OCR extrai itens + preços + mercado + data
2. Worker `price-correction` cruza cada item com catálogo:
   - **Match encontrado** + preço bate (±2%) → aumenta `confidenceScore` do snapshot
   - **Match encontrado** + preço diverge → cria `PriceDiscrepancy` → se N usuários reportam o mesmo preço divergente em M dias, atualiza `currentPrice` automaticamente
   - **Match não encontrado** → cria `ProductCandidate` (produto novo não catalogado); fica em moderação até K confirmações
3. Score de confiança por preço: fonte oficial = 1.0; crowdsourced (3+ confirmações) = 0.9; crowdsourced (1 confirmação) = 0.5

#### 5.5.4 Model Prisma (ingestão)

```prisma
model ProductPrice {
  id             String   @id @default(cuid())
  productId      String   @map("product_id")
  supermarketId  String   @map("supermarket_id")
  currentPrice   Decimal  @db.Decimal(10,2) @map("current_price")
  previousPrice  Decimal? @db.Decimal(10,2) @map("previous_price")
  onPromotion    Boolean  @default(false) @map("on_promotion")
  promotionEnds  DateTime? @map("promotion_ends")
  confidenceScore Decimal @db.Decimal(3,2) @default(1.00) @map("confidence_score")
  source         String   // "official_api"|"scraper"|"crowdsourced"|"folleto_ocr"
  lastSyncedAt   DateTime @map("last_synced_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  product     Product     @relation(fields: [productId], references: [id])
  supermarket Supermarket @relation(fields: [supermarketId], references: [id])

  @@unique([productId, supermarketId])
  @@index([supermarketId, lastSyncedAt])
  @@map("product_prices")
}

model PriceSnapshot {
  id            String   @id @default(cuid())
  productId     String   @map("product_id")
  supermarketId String   @map("supermarket_id")
  price         Decimal  @db.Decimal(10,2)
  onPromotion   Boolean  @default(false) @map("on_promotion")
  source        String
  capturedAt    DateTime @default(now()) @map("captured_at")

  @@index([productId, supermarketId, capturedAt])
  @@map("price_snapshots")
}

model PriceDiscrepancy {
  id              String   @id @default(cuid())
  productPriceId  String   @map("product_price_id")
  reportedPrice   Decimal  @db.Decimal(10,2) @map("reported_price")
  reportedByUserId String  @map("reported_by_user_id")
  receiptId       String?  @map("receipt_id")
  resolved        Boolean  @default(false)
  createdAt       DateTime @default(now()) @map("created_at")

  @@index([productPriceId, resolved])
  @@map("price_discrepancies")
}

model ProductCandidate {
  id              String   @id @default(cuid())
  rawName         String   @map("raw_name")
  normalizedName  String   @map("normalized_name")
  supermarketId   String   @map("supermarket_id")
  reportedPrice   Decimal  @db.Decimal(10,2) @map("reported_price")
  confirmations   Int      @default(1)
  status          String   @default("pending")  // pending|approved|rejected
  createdAt       DateTime @default(now()) @map("created_at")

  @@map("product_candidates")
}
```

#### 5.5.5 Considerações legais e operacionais

- **Robots.txt + ToS**: respeitar em cada rede; rate-limit baixo (segundos entre requests), User-Agent identificado
- **Cache agressivo**: nunca mais de 1 fetch por produto/dia por rede
- **Fallback**: se adapter falha, mantém preço anterior + flag `isStale=true` para UI mostrar aviso
- **Geolocalização**: Mercadona varia preço por CEP; armazenar `postalCode` no `ProductPrice` quando aplicável (fase 2)
- **Seed inicial**: importar Google Sheets existente (do Perplexity) como bootstrap do catálogo

---

## 6. Fases de Desenvolvimento

| Fase | Funcionalidades |
|------|----------------|
| **MVP (v1)** | Catálogo + comparação de preços + filtros básicos + comparação por medida |
| **v1.1** | Alertas de preço e promoções |
| **v1.2** | Controle de gastos (scan de nota fiscal) |
| **v1.3** | Avaliações e comentários |
| **v1.4** | Cesta Familiar |
| **v2.0** | Expansão para outras Comunidades Autônomas da Espanha |

---

## 7. Ordem de construção (por feature)

Seguir sempre a sequência definida em `claude-geral-consolidado.md` seção 8:

```
Banco:    1 model Prisma → 2 migration
Backend:  3 repository → 4 service → 5 DTOs → 6 controller → 7 module → 8 testar endpoints
Frontend: 9 types → 10 service HTTP → 11 hooks → 12 schema Zod → 13 componentes → 14 páginas
```

Uma feature por vez. Revisar cada etapa antes de avançar.

---

## 8. CLAUDE.md do projeto

Ao iniciar qualquer sessão de desenvolvimento, criar/manter `cesta/CLAUDE.md` a partir do template da seção 9 de `claude-geral-consolidado.md`, preenchendo:

- **Nome:** Cesta
- **Propósito:** App mobile-first de comparação de preços de supermercados para a Comunidade de Madrid
- **Stack:** segue 100% o default, com BullMQ ativo para OCR e alertas
- **Escopo da sessão atual:** [preencher a cada sessão]
- **Regras de negócio chave:** preços sempre em `€` com 2 casas decimais; dados de supermercado nunca vêm do frontend; OCR é job assíncrono

---

## 9. Referências

- Identidade visual: [`cesta-identidade-visual.md`](./cesta-identidade-visual.md)
- Padrões de desenvolvimento: [`claude-geral-consolidado.md`](./claude-geral-consolidado.md)
