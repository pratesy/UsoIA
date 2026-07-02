# T2 — Quick wins: Plano (reset inline) + Minimal (abreviações)

**Data:** 2026-07-01  
**Status:** aguardando aprovação  
**Tipo:** feature / visual polish

## Contexto

Duas melhorias de texto independentes que podem ir em uma única task:

**Plano:** o `.lim-reset` ("Reinicia em 4h 33min") fica numa linha separada
abaixo da barra, ocupando espaço vertical e verboso. O usuário quer só a hora
("4h 33min") na mesma linha do label S + %.

**Minimal:** o `.pill .label` exibe "sessão" e "semana" por extenso. O padrão
de abreviação já é S/W em todas as outras skins. Unificar.

## Escopo

### O que será feito

**Plano:**
- Mover o horário de reset para dentro da `.lim-head` (mesma linha que S/W e %).
- Exibir só o tempo curto: "4h33" ou "sex 18:00" — sem o prefixo "Reinicia em".
- A função `resetShort(epoch, weekly)` já existe no `app.js` e retorna exatamente
  esse formato. Usá-la para o bind `s-reset` e `w-reset` da skin plano.
- Remover o elemento `.lim-reset` do HTML (ou reutilizar o `data-bind` dentro do
  `.lim-head`).

**Minimal:**
- Alterar o texto dos dois `.pill .label` de "sessão" / "semana" para "S" / "W"
  no `index.html`.
- Ajustar `min-width` do `.pill .label` no CSS para o novo tamanho (provavelmente
  `min-width: calc(12px * var(--scale))` em vez dos atuais `36px`).
- Documentar em `FRONTEND.md` que S/W é o padrão de abreviação de sessão/semana.

### Fora de escopo

- Não alterar a função `resetRelative` nem `resetAbsolute` — outros places
  (sabre-base, duo) continuam usando-as da forma que estão.
- Não alterar o tamanho da janela do Plano por enquanto (pode ficar levemente
  menor com a linha removida — checar se `WIN_SIZE.plano` precisa de ajuste).

## Especificação técnica

### Arquivos a modificar

- `src/index.html` — Plano: reestruturar `.lim-head` + remover `.lim-reset`;
  Minimal: alterar texto do `.label`.
- `src/app.js` — Plano: mudar `setT("s-reset", ...)` e `setT("w-reset", ...)` para
  usar `resetShort()` e colocar em elemento dentro de `.lim-head`.
- `src/styles.css` — Plano: `.lim-head` com três filhos, ajustar se necessário;
  Minimal: `.pill .label` com `min-width` menor.
- `FRONTEND.md` — documentar convenção S/W.

### Abordagem

#### Plano — HTML

```html
<!-- ANTES -->
<div class="lim-head">
  <span class="lim-title">S</span>
  <span class="lim-pct" data-bind="s-pct">—</span>
</div>
<div class="lim-bar"><i data-bind="s-bar"></i></div>
<div class="lim-reset" data-bind="s-reset">—</div>

<!-- DEPOIS -->
<div class="lim-head">
  <span class="lim-title">S</span>
  <span class="lim-pct" data-bind="s-pct">—</span>
  <span class="lim-reset" data-bind="s-reset">—</span>
</div>
<div class="lim-bar"><i data-bind="s-bar"></i></div>
```

Idem para W.

#### Plano — JS (`render()`)

```js
// ANTES
setT("s-reset", resetRelative(d.session_reset));
setT("w-reset", resetAbsolute(d.weekly_reset));

// DEPOIS
setT("s-reset", resetShort(d.session_reset, false));
setT("w-reset", resetShort(d.weekly_reset, true));
```

#### Minimal — HTML

```html
<!-- ANTES -->
<span class="label">sessão</span>
<span class="label">semana</span>

<!-- DEPOIS -->
<span class="label">S</span>
<span class="label">W</span>
```

#### Minimal — CSS

```css
/* ANTES */
.pill .label { color: var(--fg-dim); min-width: calc(36px * var(--scale)); }

/* DEPOIS */
.pill .label { color: var(--fg-dim); min-width: calc(14px * var(--scale)); }
```

#### FRONTEND.md

Adicionar nota na seção de convenções: `S` = sessão (5h), `W` = semana (7d) —
padrão de abreviação em todas as skins. Labels por extenso não são usados.

### Gotchas / riscos

- `.lim-head` usa `justify-content: space-between`. Com três filhos (título, %,
  reset), o espaço vai se dividir naturalmente. Checar visualmente se fica
  equilibrado ou se o horário fica muito colado ao %.
- `resetShort` para sessão retorna "4h33" (compacto sem espaço) — confirmar que
  cabe bem na linha sem overflow. Se a janela estiver em `size: small`, pode
  apertar; checar com `--scale: 0.85`.
- `#widget.hide-numbers` esconde `.lim-reset` via seletor. Como o elemento agora
  está dentro de `.lim-head`, verificar se o seletor ainda funciona ou precisa
  de ajuste.

## Critérios de aceite

- [ ] Skin Plano exibe `S  52%  4h33` em uma linha + barra abaixo (sem linha
  extra de reset).
- [ ] Sem overflow em `size: small`.
- [ ] `#showNumbers` desmarcado ainda esconde o horário de reset.
- [ ] Skin Minimal exibe "S" e "W" em vez de "sessão" e "semana".
- [ ] `node --check src/app.js` passa.

## Perguntas em aberto

- Nenhuma.
