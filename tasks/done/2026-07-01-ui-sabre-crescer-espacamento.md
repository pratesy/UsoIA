# UI/UX Sabre de Luz — Crescimento em vez de apagamento + espaçamento do valor

**Data:** 2026-07-01  
**Status:** concluído  
**Tipo:** feature / visual polish

## Contexto

A skin sabre (simples e duo) e a skin maul sofrem de dois problemas visuais:

1. **O valor `%` fica colado/sobreposto à ponta da lâmina.** O `.tip-pct` está
   posicionado apenas 2px acima do topo da `.sabre-blade` no modo vertical
   (`bottom: 112px` vs topo da lâmina em `110px`). No modo horizontal o mesmo
   gap de 2px ocorre no eixo `left`. Já no maul, o `tip-pct` está em
   `top: -2px` com a lâmina chegando até `~7px` do topo do stage — também
   quase sem espaço.

2. **A lâmina apaga em vez de crescer/diminuir.** O mecanismo atual usa
   `opacity: var(--lit)` para indicar o uso — a lâmina vai perdendo brilho. O
   efeito desejado é a lâmina crescer e diminuir em altura/largura (como uma
   lightsaber que vai se energizando), mantendo sempre a cor total.

## Escopo

### O que será feito

- Aumentar o espaçamento do `.tip-pct` para ~10 px acima da ponta da lâmina
  (vertical e horizontal) em todas as skins afetadas: sabre, duo e maul.
- Substituir o controle de `opacity` (`--lit`) por controle de
  `height` / `width` (`--fill`) nas lâminas `.sabre-blade` e `.maul-blade`.
- A `height` (vertical) ou `width` (horizontal) da lâmina varia de ~5% a 100%
  do tamanho máximo conforme o uso, com transição suave de 0.7s.
- O `.sabre-ghost` permanece sem alteração — já cumpre o papel de "fantasma"
  mostrando onde a lâmina estaria a 100%.
- O modo inverso (`prefs.invert`) continua funcionando: ao invés de
  `fill = u`, usa `fill = 1 - u`.
- A animação `sabrePulse` no `::after` (pulsação da aura) permanece — não
  toca nela.

### Fora de escopo

- Não alterar tamanho da janela (`WIN_SIZE`).
- Não alterar a skin kart.
- Não alterar a skin plano/minimal.
- Não alterar a lógica de alerta (`bladePulse`).

## Especificação técnica

### Arquivos a modificar

- `src/styles.css` — remover `opacity: var(--lit)` das lâminas, adicionar
  `height`/`width` dinâmicos via `var(--fill)`, ajustar posição do `.tip-pct`.
- `src/app.js` — trocar `--lit` por `--fill` em `setBlade()` e trocar a
  função `lit()` por `fill()`.

### Abordagem

#### 1. `app.js` — trocar `lit` por `fill`

```js
// ANTES:
const lit  = (u) => clamp(inv ? 1 - u : u, 0.22, 1);
const setBlade = (sel, u) => $$(sel).forEach((el) =>
  el.style.setProperty("--lit", lit(u).toFixed(2)));

// DEPOIS:
const fill = (u) => clamp(inv ? 1 - u : u, 0.05, 1);
const setBlade = (sel, u) => $$(sel).forEach((el) =>
  el.style.setProperty("--fill", fill(u).toFixed(2)));
```

Piso de `0.05` (5% da altura): sabre nunca some completamente — sempre aparece
uma pequena chama na base.

#### 2. `styles.css` — `.sabre-blade` (vertical)

```css
/* ANTES */
opacity: var(--lit, 1);
transition: opacity 0.7s ease;

/* DEPOIS */
height: calc(84px * var(--scale) * var(--fill, 1));
transition: height 0.7s ease;
```

Como `.sabre-blade` tem `position: absolute; bottom: calc(26px * var(--scale))`,
diminuir a altura faz a lâmina "recolher" para dentro do cabo — comportamento
correto.

#### 3. `styles.css` — `.orient-h .sabre-blade` (horizontal)

```css
/* ANTES */
width: calc(84px * var(--scale));
transform: translateY(-50%);

/* DEPOIS */
width: calc(84px * var(--scale) * var(--fill, 1));
transform: translateY(-50%);
transition: width 0.7s ease;
```

Como `.orient-h .sabre-blade` tem `left: calc(26px * var(--scale))`, diminuir a
largura faz a ponta recuar para a direita (sentido hilt).

#### 4. `styles.css` — `.maul-blade` (vertical)

```css
/* ANTES */
opacity: var(--lit, 1);
height: calc(46px * var(--scale));
transition: opacity 0.7s ease;

/* DEPOIS */
height: calc(46px * var(--scale) * var(--fill, 1));
transition: height 0.7s ease;
```

`blade.up` tem `bottom: calc(50% + 13px * var(--scale))` → encolhe para baixo
(em direção ao cabo). `blade.down` tem `top: calc(50% + 13px * var(--scale))`
→ encolhe para cima. Ambos corretos.

#### 5. `styles.css` — `.orient-h .maul-blade` (horizontal)

```css
/* ANTES */
width: calc(46px * var(--scale));

/* DEPOIS */
width: calc(46px * var(--scale) * var(--fill, 1));
transition: width 0.7s ease;
```

`blade.up` usa `right: calc(50% + 13px)` → ponta recua para a direita (hilt).
`blade.down` usa `left: calc(50% + 13px)` → ponta recua para a esquerda (hilt).

#### 6. `styles.css` — espaçamento `.tip-pct`

**Sabre vertical:**
```css
/* ANTES */
bottom: calc(112px * var(--scale));

/* DEPOIS */
bottom: calc(122px * var(--scale));   /* +10px acima da ponta da lâmina */
```

**Sabre horizontal:**
```css
/* ANTES */
left: calc(112px * var(--scale));

/* DEPOIS */
left: calc(122px * var(--scale));   /* +10px após a ponta da lâmina */
```

**Maul vertical (`.maul-stage .tip-pct`):**
```css
/* ANTES */
top: calc(-2px * var(--scale));

/* DEPOIS */
top: calc(-14px * var(--scale));   /* ~12px mais afastado */
```

**Maul vertical (`.tip-pct.down`):**
```css
/* ANTES */
bottom: calc(-2px * var(--scale));

/* DEPOIS */
bottom: calc(-14px * var(--scale));
```

**Maul horizontal** — já está em `left: 0` / `right: 0` nos cantos do stage,
não fica sobreposto. Não precisa de ajuste.

### Gotchas / riscos

- **`opacity` na animação de alerta (`bladePulse`)**: a animação de alerta
  (`#widget.alert .sabre-blade`) usa `animation: bladePulse`. Verificar se
  `bladePulse` altera `opacity`. Se sim, remover essa parte do keyframe para
  não conflitar com o novo comportamento de cor constante.
- **`sabrePulse` no `::after`**: pulsa a aura colorida com `opacity`.
  Permanece intacto — está no pseudo-elemento, não no `.sabre-blade` principal.
- **Orientação horizontal do duo**: o `.orient-h .duo-cell` não tem regras
  especiais de `.tip-pct` — herdará a correção do `.sabre-wrap .tip-pct`.
  Conferir no browser que não fica cortado.

## Critérios de aceite

- [ ] No modo vertical, o `%` do sabre simples tem pelo menos 8px de espaço
  visível acima da ponta da lâmina quando o uso está em 100%.
- [ ] No modo horizontal, o mesmo espaço existe à direita da ponta.
- [ ] A lâmina cresce/encolhe suavemente conforme o uso sobe/desce (testar no
  modo demo abrindo `src/index.html` no browser — `mockLimits()` sobe ~3%/tick).
- [ ] A cor da lâmina permanece constante independente do nível de uso.
- [ ] Com `prefs.invert = true`, a lâmina começa cheia e vai encolhendo.
- [ ] A lâmina nunca some completamente — mínimo ~5% visível.
- [ ] A animação de pulsação da aura (`sabrePulse`) continua funcionando.
- [ ] `node --check src/app.js` passa sem erros.

## Perguntas em aberto

- Nenhuma.

## Implementação

**Concluído em:** 2026-07-01  
**Arquivos modificados:**
- `src/app.js` — trocou `lit()`/`--lit` por `fill()`/`--fill`; piso de 0.05 em vez de 0.22
- `src/styles.css` — `.sabre-blade`: removeu `opacity`, adicionou `height` dinâmico e `transition: height`; `.orient-h .sabre-blade`: `width` dinâmico e `transition: width`; `.maul-blade`: idem (vertical `height`, horizontal `width`); `.tip-pct` vertical +10px, horizontal +10px; maul `.tip-pct` de `-2px` → `-14px`

**Observações:**
- `bladePulse` anima só `box-shadow` — sem conflito com o novo comportamento.
- `sabrePulse` no `::after` permanece intacto.
- `.sabre-wrap` height (`118px`) não precisou ser alterada — espaço suficiente para o `tip-pct` em `122px`.
