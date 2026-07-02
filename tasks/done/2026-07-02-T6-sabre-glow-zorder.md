# T6 — Sabre: glow atrás do cabo (hilt)

**Data:** 2026-07-02  
**Status:** aguardando aprovação  
**Tipo:** bugfix visual

## Contexto

O `box-shadow` em camadas + `filter: blur` no `::after` do `.sabre-blade` criam
um brilho que se espalha para baixo, sobrepondo o `.sabre-hilt` (cabo).
Visualmente, o halo colorido aparece NA FRENTE do metal do cabo — errado.

A causa é que `.sabre-blade` tem `position: absolute` e `.sabre-hilt` tem
`position: relative`, mas nenhum dos dois tem `z-index` explícito. Em DOM order,
o hilt vem depois do blade, então deveria pintar por cima — mas o `filter: blur`
no pseudo-elemento `::after` pode criar um contexto de empilhamento que inverte
isso em alguns browsers/WebViews.

## Escopo

### O que será feito

Dar z-indexes explícitos aos elementos do `.sabre-wrap` e equivalentes no
`.maul-stage`, garantindo que o hilt sempre ficará na frente do brilho:

```
z-index 0  — .sabre-ghost
z-index 1  — .sabre-blade (e .maul-blade)
z-index 2  — .sabre-hilt  (e .maul-hilt — já tem z-index:2, confirmar)
```

### Fora de escopo

- Não alterar o tamanho nem a intensidade do glow.
- Não mudar a técnica de rendering (box-shadow + pseudo-elementos).

## Especificação técnica

### `styles.css` — mudanças

```css
/* sabre-wrap: garantir ordem de empilhamento */
.sabre-ghost { z-index: 0; }
.sabre-blade { z-index: 1; }        /* já é position:absolute */
.sabre-hilt  { z-index: 2; }        /* já é position:relative */

/* maul-stage: .maul-hilt já tem z-index:2; apenas garantir .maul-blade */
.maul-blade { z-index: 1; }
```

Para o duo (`.skin-duo .sabre-wrap`): as mesmas regras acima já se aplicam,
pois as divs dentro de `.duo-cell` compartilham a mesma estrutura de `.sabre-wrap`.

### Validação

- Abrir o app em skin Sabre vertical → o cabo deve cobrir o glow completamente.
- Skin Duo → mesmo comportamento nos dois sabres.
- Skin Maul → mesma verificação.
- Modo horizontal (orient-h) → verificar que a virada do sabre não quebra o z-order.

## Critérios de aceite

- [ ] Sabre vertical: hilt cobre o glow — sem brilho colorido sobre o metal.
- [ ] Sabre horizontal: idem.
- [ ] Duo: ambos os cabos cobrem seu glow.
- [ ] Maul: cabo duplo cobre o glow das duas lâminas.
- [ ] O brilho ainda aparece nas laterais/topo (efeito natural de lightsaber) —
      só a parte que cobria o metal do cabo desaparece.
