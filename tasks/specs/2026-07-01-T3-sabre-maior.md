# T3 — Sabre maior (lâmina, stage e WIN_SIZE)

**Data:** 2026-07-01  
**Status:** aguardando aprovação  
**Tipo:** feature / visual polish  
**Bloqueia:** T1 (o fix de spacing do Maul depende das dimensões finais desta task)

## Contexto

As lâminas atuais (sabre: 84px, maul: 46px) foram definidas no início do projeto
e ficaram pequenas visualmente. O usuário quer lâminas proporcionalmente maiores
em todas as skins que usam sabre (sabre simples, duo, maul).

## Escopo

### O que será feito

- Aumentar a altura da `.sabre-blade` de 84 → 104px (≈+24%).
- Aumentar a altura da `.sabre-ghost` proporcionalmente (mesma proporção).
- Aumentar a `.sabre-wrap` height para acomodar a lâmina maior.
- Aumentar a altura da `.maul-blade` de 46 → 58px (≈+26%).
- Aumentar o `.maul-stage` height proporcionalmente.
- Atualizar `tip-pct` offsets para refletir os novos tamanhos (e deixar pronto
  para T1 finalizar o ajuste fino do Maul).
- Atualizar `WIN_SIZE` para as skins afetadas (`sabre`, `duo`, `maul`).
- Modo horizontal: atualizar `width` equivalentes no `.orient-h`.

### Fora de escopo

- Não alterar espessura da lâmina (8px) nem do cabo.
- Não alterar skin kart, plano, minimal.

## Especificação técnica

### Arquivos a modificar

- `src/styles.css` — dimensões de `.sabre-blade`, `.sabre-ghost`, `.sabre-wrap`,
  `.maul-blade`, `.maul-stage` e offsets de `.tip-pct`.
- `src/app.js` — `WIN_SIZE` para `sabre`, `duo`, `maul`.

### Abordagem

#### Novas dimensões

| Elemento | Antes | Depois |
|---|---|---|
| `.sabre-blade` height (v) | 84px | 104px |
| `.sabre-ghost` height (v) | 84px | 104px |
| `.sabre-wrap` height | 118px | 138px |
| `.sabre-wrap .tip-pct` bottom | 122px | 142px |
| `.orient-h .sabre-ghost` width | 84px | 104px |
| `.orient-h .sabre-blade` width | 84px (via --fill) | 104px (via --fill) |
| `.orient-h .sabre-wrap` width | 118px | 138px |
| `.orient-h .sabre-wrap .tip-pct` left | 122px | 142px |
| `.maul-blade` height (v) | 46px | 58px |
| `.maul-stage` height | 132px | 152px |
| `.maul-stage .tip-pct` top | -14px | calc com T1 |
| `.orient-h .maul-blade` width | 46px (via --fill) | 58px (via --fill) |
| `.orient-h .maul-stage` width | 132px | 152px |

#### WIN_SIZE

```js
// ANTES
sabre: { v: [100, 152], h: [152, 84] },
duo:   { v: [160, 152], h: [165, 132] },
maul:  { v: [82,  164], h: [186,  96] },

// DEPOIS (ajustar proporcionalmente à nova altura)
sabre: { v: [100, 172], h: [172, 84] },
duo:   { v: [160, 172], h: [185, 132] },
maul:  { v: [82,  184], h: [206,  96] },
```

*Valores acima são estimativas — validar visualmente no app com `npm run dev`.*

#### `.sabre-blade` bottom

A blade fica ancorada em `bottom: calc(26px * var(--scale))` (logo acima do
cabo de 30px). Não muda — só a height cresce para cima.

### Gotchas / riscos

- **T1 fica bloqueado por esta task.** Após definir os tamanhos finais do Maul,
  calcular os offsets corretos do `.maul-stage .tip-pct` e implementar T1.
- **`WIN_SIZE` versus `autoSize()`**: a janela é redimensionada via `autoSize()`
  sempre que a skin muda. Os novos valores de `WIN_SIZE` vão ter efeito imediato.
  Testar que a janela não fica nem grande demais nem com conteúdo cortado.
- **Modo demo** (`src/index.html` no browser): `autoSize()` é no-op fora do app,
  então a janela não vai redimensionar — checar visualmente via CSS que o card
  fica bem mesmo sem resize.

## Critérios de aceite

- [ ] Skin sabre simples: lâmina visivelmente maior que antes, sem overflow.
- [ ] Skin duo: ambas as lâminas maiores, proporções balanceadas.
- [ ] Skin maul: lâminas proporcionalmente maiores, cabo centralizado.
- [ ] Orientação horizontal: widths atualizadas proporcionalmente.
- [ ] `WIN_SIZE` atualizado e janela redimensiona corretamente ao trocar pra
  essas skins.
- [ ] T1 pode ser implementado em seguida com base nos novos valores.

## Perguntas em aberto

- Nenhuma. Valores de pixel são estimativas a validar visualmente.
