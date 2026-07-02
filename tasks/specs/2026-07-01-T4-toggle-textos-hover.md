# T4 — Toggle de textos: ocultar no repouso, exibir no hover

**Data:** 2026-07-01  
**Status:** aguardando aprovação  
**Tipo:** feature

## Contexto

O card do widget exibe textos de reset, labels e percentuais o tempo todo,
tornando-o visualmente denso. Uma opção de ocultar esses textos por padrão e
exibi-los apenas no hover reduziria a presença visual do widget sem perder
informação.

## Escopo

### O que será feito

- Nova preferência `textHover: false` (padrão = textos sempre visíveis).
- Quando ativada, os textos secundários somem e aparecem suavemente no hover.
- Novo checkbox no painel ⚙ ("textos só no hover").
- A opção não altera o tamanho da janela (o espaço vazio fica transparente —
  a janela é transparente anyway, então visualmente some).

### O que NÃO será feito

- Não redimensionar a janela automaticamente quando textos somem (complexidade
  desnecessária; pode ser adicionado no futuro).
- Não afetar os controles de ação (⚙, —) — esses já têm comportamento de hover.
- Não afetar o `stamp` (timestamp de última atualização) — ele já tem seu próprio
  comportamento de hover.

### Quais textos são afetados

| Skin | Elementos ocultados |
|---|---|
| Plano | `.lim-reset` (horário de reset) |
| Sabre / Duo / Kart | `.sabre-base`, `[data-bind="driver-reset"]` |
| Maul | `[data-bind="maul-s-reset"]`, `[data-bind="maul-w-reset"]` |
| Minimal | `.pill .label` (S / W) |

Os valores percentuais (`.lim-pct`, `.tip-pct`, `.pill .val`, `.driver-value`)
**não** são ocultados — são a informação principal.

## Especificação técnica

### Arquivos a modificar

- `src/app.js` — `DEFAULTS` (nova pref `textHover`), `applyTheme()` (aplicar
  classe), listener em `wire()`.
- `src/index.html` — novo checkbox no painel ⚙.
- `src/styles.css` — regras para `#widget.text-hover`.

### Abordagem

#### JS — `DEFAULTS`

```js
const DEFAULTS = {
  // ... existentes ...
  textHover: false,   // ocultar textos secundários, exibir só no hover
};
```

#### JS — `applyTheme()`

```js
$("#widget").classList.toggle("text-hover", prefs.textHover);
```

#### JS — `wire()`

```js
$("#textHover").addEventListener("change", (e) => {
  prefs.textHover = e.target.checked;
  savePrefs();
  applyTheme();
});
```

#### HTML — painel ⚙

Adicionar após o checkbox `#showNumbers`:

```html
<label>
  <input type="checkbox" id="textHover">
  textos só no hover
</label>
```

E sincronizar em `applyTheme()`:

```js
$("#textHover").checked = prefs.textHover;
```

#### CSS

```css
/* Textos secundários: desaparecem no repouso quando text-hover está ativo */
#widget.text-hover .lim-reset,
#widget.text-hover .sabre-base,
#widget.text-hover [data-bind="driver-reset"],
#widget.text-hover [data-bind="maul-s-reset"],
#widget.text-hover [data-bind="maul-w-reset"],
#widget.text-hover .pill .label {
  opacity: 0;
  transition: opacity 0.2s ease;
}

#widget.text-hover:hover .lim-reset,
#widget.text-hover:hover .sabre-base,
#widget.text-hover:hover [data-bind="driver-reset"],
#widget.text-hover:hover [data-bind="maul-s-reset"],
#widget.text-hover:hover [data-bind="maul-w-reset"],
#widget.text-hover:hover .pill .label {
  opacity: 1;
}
```

### Gotchas / riscos

- **`pointer-events: none`** já está em `.skin *` — o hover precisa vir do
  `#widget`, não dos textos. O seletor `#widget.text-hover:hover` funciona
  porque o hover do `#widget` já propaga para baixo, mesmo com
  `pointer-events: none` nos filhos.
- **Interação com `#widget.hide-numbers`**: as duas opções podem coexistir —
  `hide-numbers` esconde via `display: none` e `text-hover` esconde via
  `opacity`. Se ambas estiverem ativas, `display: none` prevalece. Sem conflito.
- **Stamp**: já tem `opacity: 0` no repouso e `opacity: 0.6` no hover por padrão
  — não adicionar aqui para não criar dupla regra.

## Critérios de aceite

- [ ] Com `textHover: false` (padrão), comportamento idêntico ao atual.
- [ ] Com `textHover: true`, textos secundários somem no repouso e aparecem no
  hover do `#widget`.
- [ ] Valores percentuais nunca somem.
- [ ] Checkbox no painel ⚙ persiste via `localStorage`.
- [ ] `node --check src/app.js` passa.

## Perguntas em aberto

- Nenhuma.
