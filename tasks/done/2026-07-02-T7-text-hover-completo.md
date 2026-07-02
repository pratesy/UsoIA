# T7 — Text-hover: ocultar TUDO por padrão (só visual visível)

**Data:** 2026-07-02  
**Status:** aguardando aprovação  
**Tipo:** feature (extensão do T4)

## Contexto

O T4 implementou um modo `textHover` que oculta textos **secundários** (reset
times, labels) e os mostra no hover. Porém a **porcentagem** (`tip-pct`,
`lim-pct`, `kart-pct`, etc.) continuava sempre visível.

O comportamento desejado é:

- **Padrão (sem hover):** só o elemento visual — lâmina do sabre, barra do plano,
  pista do kart, pills do minimal — sem nenhum texto.
- **No hover:** tudo aparece (%, reset, labels).
- **Padrão ativo:** `textHover: true` já vem ligado. O usuário pode desabilitar
  em ⚙ se quiser os textos sempre visíveis.

## Escopo

### O que será feito

1. Mudar `textHover: false` → `textHover: true` em `DEFAULTS` (`app.js`).
2. Ampliar os seletores CSS de `#widget.text-hover` para cobrir **todos** os
   textos numéricos e de label, não só os secundários.

### Fora de escopo

- Não remover o checkbox em ⚙ — continua como preferência.
- Não alterar `showNumbers` (modo "sem números" permanente — é diferente).
- Não afetar o `.stamp` (timestamp no hover já funciona independente).

## Especificação técnica

### Mapa completo de elementos a ocultar por skin

| Skin | Seletores |
|------|-----------|
| plano | `.lim-pct`, `.lim-reset` |
| sabre | `.tip-pct`, `.sabre-base`, `[data-bind="driver-reset"]` |
| duo | `.tip-pct`, `.duo-label`, `.sabre-base` (cobre `duo-s-reset`, `duo-w-reset`) |
| maul | `.tip-pct`, `.maul-readout` |
| kart | `.kart-pct`, `.kart-base` |
| minimal | `.pill .val`, `.pill .label` |

### `styles.css` — substituir regras T4 por versão ampliada

Substituir o bloco `#widget.text-hover` existente por:

```css
/* text-hover: só o visual — todos os textos somem no repouso */
#widget.text-hover .tip-pct,
#widget.text-hover .kart-pct,
#widget.text-hover .lim-pct,
#widget.text-hover .lim-reset,
#widget.text-hover .sabre-base,
#widget.text-hover .kart-base,
#widget.text-hover .maul-readout,
#widget.text-hover .duo-label,
#widget.text-hover .pill .val,
#widget.text-hover .pill .label {
  opacity: 0;
  transition: opacity 0.2s ease;
}

/* aparecem no hover */
#widget.text-hover:hover .tip-pct,
#widget.text-hover:hover .kart-pct,
#widget.text-hover:hover .lim-pct,
#widget.text-hover:hover .lim-reset,
#widget.text-hover:hover .sabre-base,
#widget.text-hover:hover .kart-base,
#widget.text-hover:hover .maul-readout,
#widget.text-hover:hover .duo-label,
#widget.text-hover:hover .pill .val,
#widget.text-hover:hover .pill .label {
  opacity: 1;
}
```

> Nota: os seletores antigos do T4 (`[data-bind="driver-reset"]`,
> `[data-bind="maul-s-reset"]`, `[data-bind="maul-w-reset"]`) são cobertos pelos
> novos seletores de classe (`.sabre-base` e `.maul-readout`) — remover os
> antigos `[data-bind]` para não duplicar.

### `app.js` — mudar default

```js
const DEFAULTS = {
  ...
  textHover: true,   // era false — agora é o padrão
  ...
};
```

### Atualizar `FRONTEND.md`

Atualizar o DEFAULTS documentado para refletir `textHover: true`.

## Critérios de aceite

- [ ] App inicia com sabre visível e SEM texto (nem % nem reset).
- [ ] Hover no widget → % e reset aparecem suavemente (0.2s).
- [ ] Funciona em todas as skins: plano, sabre, duo, maul, kart, minimal.
- [ ] Desabilitar "Textos só no hover" em ⚙ → textos sempre visíveis.
- [ ] `.stamp` não é afetado (continua no hover independente).
- [ ] `showNumbers: false` (modo sem números) ainda funciona separado.
