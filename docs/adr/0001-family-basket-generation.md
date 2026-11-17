# ADR 0001 — Family Basket Generation (Sprint 98)

- **Status:** Accepted
- **Date:** 2026-11-17
- **Deciders:** Gabriel Dutra (owner), Claude Code (dev)
- **Supersedes:** —
- **Supersedido por:** —

## Contexto

A feature "Cesta Familiar" (B2C diferenciador do Cesta) gera uma lista de compras otimizada a partir de:

1. composição familiar (bebês, crianças, teens, adultos, idosos)
2. respostas do questionário dietético
3. restrições alimentares (vegan, lactoseFree, etc.)
4. categorias bloqueadas e produtos obrigatórios
5. (opcional) orçamento mensal

Precisamos decidir **como** gerar a cesta: algoritmo síncrono inline vs. otimização (ILP), heurística em worker assíncrono, chamada a LLM, etc.

Também há uma regra de negócio dura: a UI deve permitir *regenerar* a cesta preservando itens que o usuário marcou como `isLocked` ou `isRequired`.

## Decisão

1. **Worker assíncrono via BullMQ**. Endpoint `POST /family-baskets/generate` retorna `202 Accepted` + `jobId`; frontend faz polling via `GET /family-baskets/latest` com `refetchInterval: 2s` enquanto `status === 'pending'`. Nenhum trabalho pesado no request/response do controller.
2. **Algoritmo heurístico determinístico**, em código (classe `BasketGenerator`). Sem LLM e sem solver ILP no MVP. Score por produto = kcal esperada por membro × fator dietético × compatibilidade com answers. Restrictions e blockedCategories agem como filtros duros.
3. **Preservação de locked / required**. O worker lê os `items` da cesta existente, extrai os que têm `isLocked || isRequired`, coloca-os primeiro no resultado e deixa o heurístico escolher o resto.
4. **Rate-limit 1 requisição a cada 24 horas por usuário** nos endpoints `generate` e `regenerate`, para proteger o worker e o Postgres (geração lê catálogo inteiro). Implementado com `@nestjs/throttler` via **override inline do throttler `default`** (`@Throttle({ default: { limit: 1, ttl: 86_400_000 } })`). Decisão consciente: *não* usar throttler nomeado global (`forRoot([..., { name: 'familyBasket', ... }])`), porque todos os throttlers registrados no forRoot aplicam a *todas* as rotas por padrão — 1 request a /family-baskets/generate zerava o bucket global pros 86.4M ms seguintes, derrubando a API inteira (bug P0 Sprint 98 QA). Override inline do `default` restringe o limite ao escopo da rota decorada apenas.
5. **Fonte dos preços**: `ProductPrice.price` do supermercado com menor preço atual na categoria daquele produto. O heurístico não escolhe supermercado — a UI expõe o melhor mercado agregado a partir dos preços já salvos em `FamilyBasketItem.unitPrice`.

## Alternativas consideradas

- **Síncrono no controller.** Rejeitado: geração lê catálogo inteiro e pode levar > 2 s; bloquearia o event loop do NestJS e degradaria o Render free tier.
- **LLM-driven (Claude/OpenAI) picking.** Rejeitado para MVP: custo variável imprevisível, latência > 5 s, resultados não-determinísticos (ruim pra QA). Pode virar fase 2 opcional.
- **ILP (OR-Tools)**. Rejeitado: engenharia pesada para benefício marginal com catálogo pequeno. Heurística deterministic cobre o caso "família típica".
- **Rate-limit por IP em vez de por usuário.** Rejeitado: cada família tem só 1 cesta por `userId` (unique index); IP compartilhado (NAT/colegio) penalizaria usuários legítimos.

## Consequências

Positivas:

- Latência de controller ≤ 50 ms (apenas enfileira job).
- QA pode testar geração offline com fixtures determinísticas.
- Regenerate é exatamente o mesmo caminho de código do generate (um único `BasketGenerator.generate`) — menos superfície de bug.
- Rate-limit evita abuso (um usuário clicar "regenerate" em loop derruba o worker).

Negativas:

- Usuário vê "Pending" por alguns segundos após gerar. Mitigado com skeleton + polling 2s + estado `ready` cacheado por 24h.
- Heurística pode gerar cestas sub-ótimas em casos de família muito grande + restrictions muito exóticas. Mitigado: UI permite editar, remover e substituir itens manualmente.
- Rate-limit 1/24h é restritivo. Decisão consciente: cada regenerate é caro; usuário que quer mudar 1 item deve usar PATCH, não regenerate. Documentar na UX (toast "Tente novamente amanhã").

## Observabilidade

- `basket-generation.processor` loga `Generating basket {id} for user {userId}` + resultado final (items count + custo).
- Erro do job → `FamilyBasket.status = 'failed'`, `errorMessage` populado, UI mostra fallback `FailedState` com CTA para reconfigurar.
- Sentry tag `module: family-baskets` em falhas do worker.

## Testes

- `basket-generator.spec.ts`: locked preservation, restrictions filter, member unit calculation.
- `basket-item.dto.spec.ts`: validação dos DTOs de entrada (Zod-like class-validator).
- Rate-limit test: 2ª chamada em janela 24h retorna 429.
- Frontend `configurar-wizard.test.tsx`: navegação 5 steps + submit happy path.
