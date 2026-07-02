# T1 — Fix espaçamento tip-pct no Maul vertical

**Data:** 2026-07-01  
**Status:** aguardando aprovação  
**Tipo:** bug / visual polish  
**Dependência:** implementar após T3 (sabre maior), pois mudar as dimensões da lâmina afeta o cálculo do espaçamento

## Contexto

Após a task anterior, o Maul horizontal ficou correto. No Maul **vertical**, a
porcentagem (`.tip-pct` e `.tip-pct.down`) ainda fica colada à ponta da lâmina.
O ajuste de `-14px` foi insuficiente porque:

- A `.maul-blade.up` com `height: 46px * scale` a 100% de fill chega até `~7px`
  do topo do `.maul-stage`.
- O `.tip-pct` em `top: -14px * scale` tem a borda inferior a ~0px do stage —
  restando apenas 7px de gap, que some com o glow (`box-shadow`) da lâmina.

Além disso, se T3 aumentar a lâmina do maul (de 46px para algo maior), este
bug reaparece na mesma proporção.

## Escopo

### O que será feito

- Aumentar o offset do `.tip-pct` no Maul vertical para dar ≥ 12px de gap
  visual entre o texto e a ponta da lâmina a 100% de fill.
- Ajustar também o `.maul-stage` height se necessário para não cortar o texto.
- Coordenar os valores finais com as dimensões definidas em T3.

### Fora de escopo

- Não alterar Maul horizontal (já correto).
- Não alterar outras skins.

## Especificação técnica

### Arquivos a modificar

- `src/styles.css` — `.maul-stage .tip-pct` e `.tip-pct.down`, e possivelmente `.maul-stage` height.

### Abordagem

Com lâmina atual de 46px:
- `blade.up` topo: `132px/2 - 13px - 46px = 7px` do topo do stage.
- Para 12px de gap + altura do texto (~14px): precisamos de `top: calc(-26px * var(--scale))`.

Se T3 aumentar a lâmina para 56px:
- `blade.up` topo: `132px/2 - 13px - 56px = -3px` → lâmina já sai do stage.
- O `.maul-stage` terá que crescer junto (ver T3), e o offset de `tip-pct` deve
  ser recalculado a partir das novas dimensões.

**Recomendação:** implementar T3 primeiro, fixar as dimensões, depois aplicar
este fix com os valores corretos. Anotar aqui ao implementar.

### Gotchas / riscos

- O `.maul-stage` tem `overflow: hidden`? Verificar se o texto em posição negativa
  (`top: -26px`) é visível ou fica cortado — pode ser necessário usar
  `overflow: visible`.

## Critérios de aceite

- [ ] No Maul vertical, a `%` de cima e de baixo têm ≥ 10px de gap visual em
  relação à ponta da lâmina a 100% de fill.
- [ ] O texto não é cortado pelo container.
- [ ] Maul horizontal não é afetado.

## Perguntas em aberto

- Valores exatos dependem de T3. Calcular após definir novas dimensões do Maul.
