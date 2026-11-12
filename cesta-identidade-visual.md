# Cesta — Identidade Visual

> Referenciado em: [`cesta.md`](./cesta.md)  
> Versão: 0.2

---

## 1. Personalidade da Marca

**Cesta** é prática, honesta e próxima. Não é um app corporativo nem um app de banco — é a ferramenta que a sua vizinha te recomenda porque ela economizou €40 esse mês. A marca deve transmitir:

| Atributo | O que significa na prática |
|----------|---------------------------|
| **Confiável** | Dados precisos, visual limpo, sem ruído |
| **Próxima** | Tom amigável, fontes humanistas, ícones acessíveis |
| **Fresca** | Verde vivo, espaços generosos, não parece aplicativo de banco |
| **Prática** | Hierarquia clara, informação direta, zero decoração inútil |
| **Comunitária** | Feita por e para pessoas reais de Madrid |

**Tom de voz:** direto, sem jargão, levemente caloroso. Fala "você" (PT) e "tú" (ES).  
Não usa frases como *"optimiza tu experiencia de compra"*. Usa *"descobre onde está mais barato"*.

---

## 2. Logotipo

### 2.1 Conceito

O símbolo é uma **cesta de compras estilizada** construída com linhas geométricas limpas. O formato da cesta integra sutilmente a letra **C** na alça — reconhecível, mas não forçado. A alça e o corpo formam uma curva contínua, sem ângulos agressivos, transmitindo leveza e movimento.

Abaixo do símbolo (ou ao lado, versão horizontal): o wordmark **"cesta"** em caixa baixa, Cabinet Grotesk ExtraBold.

### 2.2 Variações

| Variação | Uso |
|----------|-----|
| **Símbolo + wordmark (vertical)** | Splash screen, onboarding, marketing |
| **Símbolo + wordmark (horizontal)** | Header do app, e-mails |
| **Símbolo isolado** | Ícone do app, favicon, avatar |
| **Wordmark isolado** | Contextos com espaço horizontal restrito |

### 2.3 Área de respiro

Mínimo de **1× a altura da letra "a"** do wordmark em todos os lados do logo. Nunca comprimir, esticar ou rotacionar o logotipo.

### 2.4 Versões de cor

| Versão | Fundo | Símbolo | Wordmark |
|--------|-------|---------|----------|
| **Principal** | Branco / Creme | Cesta Verde `#1b6b48` | Cesta Verde `#1b6b48` |
| **Negativa** | Cesta Verde `#1b6b48` | Branco `#FFFFFF` | Branco `#FFFFFF` |
| **Monocromática escura** | Qualquer claro | Grafite `#1A1A1A` | Grafite `#1A1A1A` |
| **Monocromática clara** | Qualquer escuro | Branco `#FFFFFF` | Branco `#FFFFFF` |

Nunca usar o logotipo sobre fundos que criem baixo contraste. Nunca aplicar sombra, gradiente ou efeito 3D no logo.

---

## 3. Paleta de Cores

### 3.1 Cores primárias

| Nome | Hex | Uso |
|------|-----|-----|
| **Cesta Verde** | `#1b6b48` | Cor principal da marca, CTAs primários, header |
| **Cesta Verde Claro** | `#2d9163` | Hover, estados ativos, gradientes sutis |
| **Cesta Verde Escuro** | `#124a32` | Pressed states, texto sobre fundo verde |

### 3.2 Cores de suporte

| Nome | Hex | Uso |
|------|-----|-----|
| **Lima** | `#7DC95E` | Tags de promoção, indicadores positivos, ganho |
| **Âmbar** | `#F59E0B` | Alertas de preço, urgência moderada, destaque |
| **Coral** | `#E8513A` | Queda de preço significativa, urgência alta, erro |
| **Roxo** | `#7C5CBF` | Info nutricional, destaque especial |

### 3.3 Neutros

| Nome | Hex | Uso |
|------|-----|-----|
| **Creme** | `#F8F5F0` | Background principal do app |
| **Cinza Claro** | `#F0EDEA` | Cards, superfícies elevadas |
| **Cinza Médio** | `#C4BDB6` | Bordas, divisores, placeholders |
| **Cinza Texto** | `#6B6560` | Texto secundário, labels |
| **Grafite** | `#2A2420` | Texto principal |
| **Branco** | `#FFFFFF` | Fundos de cards, superfícies altas |

### 3.4 Uso de cor por contexto

| Contexto | Cor |
|----------|-----|
| Preço mais barato | Lima `#7DC95E` |
| Promoção ativa | Âmbar `#F59E0B` |
| Maior queda de preço | Coral `#E8513A` |
| Info nutricional | Roxo `#7C5CBF` |
| Alerta ativo | Âmbar `#F59E0B` |
| Alerta disparado / promoção nova | Coral `#E8513A` |
| Avaliação positiva | Lima `#7DC95E` |
| Avaliação negativa | Coral `#E8513A` |
| Dados de gasto | Cesta Verde `#1b6b48` |
| Cesta familiar | Roxo `#7C5CBF` |

---

## 4. Tipografia

### 4.1 Famílias

| Família | Fonte | Uso |
|---------|-------|-----|
| **Display / Headings** | Cabinet Grotesk | Títulos de tela, nome do app, marketing |
| **UI / Body** | Satoshi | Corpo de texto, labels, botões, dados |

Ambas as fontes via [Fontshare API](https://api.fontshare.com). São humanistas, contemporâneas e altamente legíveis em telas pequenas.

### 4.2 Escala tipográfica

| Token | Fonte | Peso | Tamanho | Uso |
|-------|-------|------|---------|-----|
| `display-xl` | Cabinet Grotesk | 800 | 32px | Splash, hero screens |
| `display-lg` | Cabinet Grotesk | 700 | 24px | Título de página |
| `display-md` | Cabinet Grotesk | 700 | 20px | Título de seção |
| `body-lg` | Satoshi | 500 | 16px | Texto principal |
| `body-md` | Satoshi | 400 | 14px | Texto secundário, descrições |
| `body-sm` | Satoshi | 400 | 12px | Labels, tags, metadados |
| `price-xl` | Satoshi | 700 | 28px | Preço em destaque |
| `price-lg` | Satoshi | 700 | 20px | Preço em card |
| `price-md` | Satoshi | 500 | 16px | Preço secundário |
| `caption` | Satoshi | 400 | 11px | Notas de rodapé, datas |

### 4.3 Regras

- Nunca usar menos de **11px** em UI
- Nunca usar mais de **2 pesos diferentes** em um mesmo card
- Preços sempre em **Satoshi Bold** — nunca em peso regular
- Nomes de supermercados sempre em **Satoshi Medium** com cor da respectiva marca quando aplicável

---

## 5. Cores dos Supermercados

Uso em badges, filtros e comparativos para identificação rápida:

| Supermercado | Cor primária | Hex |
|-------------|-------------|-----|
| Mercadona | Verde | `#009D58` |
| Carrefour | Azul | `#004F9F` |
| Alcampo | Vermelho | `#E2001A` |
| LIDL | Amarelo/Azul | `#FFD100` / `#0050AA` |
| Froiz | Verde | `#4BA82E` |
| DIA | Vermelho | `#D0021B` |
| Aldi | Azul Escuro | `#003087` |

---

## 6. Iconografia

### 6.1 Estilo

Ícones **outlined** (contorno), stroke de **1.5px a 2px**, cantos levemente arredondados (não completamente redondos, não completamente quadrados). Coerentes com a suavidade das fontes escolhidas.

**Biblioteca de referência:** [Phosphor Icons](https://phosphoricons.com) (estilo `regular` como base, `bold` para destaque).

### 6.2 Tamanhos

| Contexto | Tamanho |
|----------|---------|
| Tab bar / navegação principal | 24px |
| Dentro de cards | 20px |
| Botões com ícone | 18px |
| Tags e badges | 14px |
| Microinterações | 16px |

### 6.3 Ícones por funcionalidade

| Funcionalidade | Ícone (Phosphor) |
|----------------|-----------------|
| Busca | `MagnifyingGlass` |
| Filtros | `SlidersHorizontal` |
| Comparar | `Scales` |
| Gastos / Dashboard | `ChartBar` |
| Scan de nota | `Camera` / `Receipt` |
| Alertas | `Bell` |
| Favoritos | `Heart` |
| Avaliações | `Star` |
| Comentários | `ChatText` |
| Cesta Familiar | `Users` |
| Produto | `ShoppingBag` |
| Nutrição | `Leaf` |
| Promoção | `Tag` |
| Histórico | `ClockCounterClockwise` |
| Perfil | `UserCircle` |
| Configurações | `GearSix` |
| Localização | `MapPin` |
| Câmera | `Camera` |
| Upload | `UploadSimple` |

---

## 7. Layout e Espaçamento

### 7.1 Grid

- **Base unit:** 4px
- **Espaçamento de componentes:** múltiplos de 4 (4, 8, 12, 16, 24, 32, 48)
- **Padding horizontal de tela:** 16px (mobile) / 24px (tablet)
- **Gap entre cards:** 12px

### 7.2 Cards

| Propriedade | Valor |
|-------------|-------|
| Border radius | 16px |
| Sombra padrão | `0 2px 8px rgba(0,0,0,0.07)` |
| Sombra elevada | `0 4px 16px rgba(0,0,0,0.12)` |
| Padding interno | 16px |
| Background | `#FFFFFF` |

### 7.3 Botões

| Tipo | Fundo | Texto | Radius | Altura |
|------|-------|-------|--------|--------|
| **Primário** | Cesta Verde `#1b6b48` | Branco | 12px | 48px |
| **Secundário** | Transparente | Cesta Verde | 12px + border 1.5px | 48px |
| **Destrutivo** | Coral `#E8513A` | Branco | 12px | 48px |
| **Ghost** | `#F0EDEA` | Grafite | 12px | 40px |
| **Pill / Tag** | `#F0EDEA` ou cor contextual | Texto contextual | 100px | 32px |

---

## 8. Animações e Microinterações

| Ação | Duração | Easing |
|------|---------|--------|
| Transição de tela | 280ms | `ease-in-out` |
| Aparecimento de card | 200ms | `ease-out` |
| Tap feedback | 100ms | `ease-in` |
| Toast / notificação | 320ms entrada / 200ms saída | `spring` |
| Skeleton loading | Loop 1.4s | `linear` |
| Scan de câmera (overlay) | Pulso 1.6s | `ease-in-out` |

Nenhuma animação deve exceder 400ms em uso normal. Respeitar `prefers-reduced-motion`.

---

## 9. Fotografia e Imagens de Produto

- Fotos de produto em **fundo branco** puro, sem sombra artificial
- Formato: quadrado (1:1) para cards, 4:3 para destaque
- Produtos sem foto: placeholder com ícone da categoria em fundo `#F0EDEA` e ícone em `#C4BDB6`
- Nunca usar imagens de banco com pessoas sorridentes segurando sacos de compras — se houver imagens humanas, devem ser fotografia real e espontânea

---

## 10. Voz e Tom na UI

| Situação | Exemplo PT | Ejemplo ES |
|----------|-----------|------------|
| CTA principal | "Ver preços" | "Ver precios" |
| Estado vazio | "Nenhum favorito ainda. Toca o coração em qualquer produto." | "Aún no tienes favoritos. Toca el corazón en cualquier producto." |
| Sucesso | "Alerta criado!" | "¡Alerta creada!" |
| Erro | "Não conseguimos ler a nota. Tenta uma foto com melhor iluminação." | "No pudimos leer el ticket. Prueba con mejor iluminación." |
| Carregando | "Buscando preços…" | "Buscando precios…" |
| Promoção | "Mais barato esta semana" | "Más barato esta semana" |

**Regras de tom:**
- Nunca culpar o usuário em mensagens de erro
- Usar verbos no imperativo informal ("toca", "busca", "adiciona")
- Números de preço sempre com símbolo `€` antes e duas casas decimais: `€2,49`
- Datas no formato local: `12 nov` (PT) / `12 nov` (ES)

---

## 11. Acessibilidade

- Contraste mínimo **4.5:1** para texto normal, **3:1** para texto grande (WCAG AA)
- Todos os ícones interativos com `aria-label` descritivo
- Touch targets mínimos de **44×44px**
- Suporte a tamanho de fonte do sistema (não bloquear zoom)
- Cores nunca como único indicador de informação (sempre acompanhar com ícone ou texto)

---

## 12. Implementação — Tailwind CSS

A stack usa **Tailwind CSS** (ver `claude-geral-consolidado.md` seção 3). Todos os tokens de design desta identidade visual devem ser mapeados no `tailwind.config.ts` do `cesta-web/` para garantir consistência entre design e código.

### 12.1 tailwind.config.ts — tokens Cesta

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cesta: {
          green:       '#1b6b48',
          'green-light': '#2d9163',
          'green-dark':  '#124a32',
        },
        lima:   '#7DC95E',
        amber:  '#F59E0B',
        coral:  '#E8513A',
        violet: '#7C5CBF',
        cream:  '#F8F5F0',
        surface: '#F0EDEA',
        border:  '#C4BDB6',
        muted:   '#6B6560',
        ink:     '#2A2420',
        // Cores dos supermercados
        mercadona: '#009D58',
        carrefour: '#004F9F',
        alcampo:   '#E2001A',
        lidl:      '#FFD100',
        froiz:     '#4BA82E',
        dia:       '#D0021B',
        aldi:      '#003087',
      },
      fontFamily: {
        sans:    ['Satoshi', 'sans-serif'],
        display: ['Cabinet Grotesk', 'sans-serif'],
      },
      fontSize: {
        'display-xl': ['2rem',    { lineHeight: '1.2', fontWeight: '800' }],
        'display-lg': ['1.5rem',  { lineHeight: '1.25', fontWeight: '700' }],
        'display-md': ['1.25rem', { lineHeight: '1.3', fontWeight: '700' }],
        'body-lg':    ['1rem',    { lineHeight: '1.5', fontWeight: '500' }],
        'body-md':    ['0.875rem',{ lineHeight: '1.5', fontWeight: '400' }],
        'body-sm':    ['0.75rem', { lineHeight: '1.4', fontWeight: '400' }],
        'price-xl':   ['1.75rem', { lineHeight: '1.2', fontWeight: '700' }],
        'price-lg':   ['1.25rem', { lineHeight: '1.2', fontWeight: '700' }],
        'price-md':   ['1rem',    { lineHeight: '1.2', fontWeight: '500' }],
        'caption':    ['0.6875rem',{ lineHeight: '1.4', fontWeight: '400' }],
      },
      borderRadius: {
        card:   '16px',
        btn:    '12px',
        pill:   '100px',
      },
      boxShadow: {
        card:      '0 2px 8px rgba(0,0,0,0.07)',
        'card-elevated': '0 4px 16px rgba(0,0,0,0.12)',
      },
      spacing: {
        // base 4px já é o default do Tailwind — custom aliases abaixo
        'screen-x': '16px',   // padding horizontal padrão mobile
        'gap-card': '12px',   // gap entre cards
      },
      transitionDuration: {
        screen: '280ms',
        card:   '200ms',
        tap:    '100ms',
        toast:  '320ms',
      },
    },
  },
  plugins: [],
};

export default config;
```

### 12.2 Carregamento de fontes (Next.js)

As fontes Satoshi e Cabinet Grotesk vêm da API do Fontshare. No `cesta-web/src/app/layout.tsx`:

```typescript
// Fontshare não tem suporte nativo no next/font — usar link direto no <head>
// ou baixar os arquivos e usar next/font/local.
// Opção recomendada para produção: baixar e hospedar localmente com next/font/local.
```

Para desenvolvimento rápido, usar o link existente no HTML:
```
https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&f[]=cabinet-grotesk@700,800&display=swap
```

### 12.3 shadcn/ui — customização

O shadcn/ui usa variáveis CSS (`--background`, `--primary`, etc.). Mapear os tokens Cesta no arquivo `src/app/globals.css`:

```css
@layer base {
  :root {
    --background:   248 245 240;   /* cream #F8F5F0 */
    --foreground:   42 36 32;      /* ink #2A2420 */
    --primary:      27 107 72;     /* cesta-green #1b6b48 */
    --primary-foreground: 255 255 255;
    --secondary:    240 237 234;   /* surface #F0EDEA */
    --secondary-foreground: 42 36 32;
    --muted:        240 237 234;
    --muted-foreground: 107 101 96; /* muted #6B6560 */
    --border:       196 189 182;   /* border #C4BDB6 */
    --radius:       0.75rem;       /* 12px — btn radius */
    --destructive:  232 81 58;     /* coral #E8513A */
    --destructive-foreground: 255 255 255;
  }
}
```

---

## 13. Escala de z-index

Convenção semântica — camadas de empilhamento usadas na app. Tudo acima de `z-40` deve usar classe `z-[valor]` ou classe nomeada do tailwind config. Nunca inline style.

| Camada | Classe Tailwind | Uso |
|---|---|---|
| Base content | (default) | Grids, cards, header sticky da rota |
| Overlay in-flow | `z-10` | Headers sticky, filtros sticky dentro da seção |
| Nav/toolbar flutuante | `z-20` | InstallPrompt, FAB |
| Backdrops modais | `z-30` | Overlay de bottom sheets antes da sheet |
| Modais/sheets | `z-40` | Bottom sheets (CompareAddSheet), modais |
| Navegação primária | `z-50` | BottomNav |
| Popover sobre nav | `z-[60]` | Autocomplete dropdown, tooltips que precisam ficar sobre BottomNav |
| Toasts | `z-[70]` | sonner Toaster |

Regra: ao introduzir componente overlay novo, documentar aqui + usar classe correspondente. Evitar `z-50` igual BottomNav em elementos diferentes (frágil se DOM reorganizar).
