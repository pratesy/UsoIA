# FRONTEND.md

Referência linha a linha do `src/` — `app.js`, `index.html`, `styles.css`. Para
o fluxo de dados e o "porquê", veja [ARCHITECTURE.md](ARCHITECTURE.md) primeiro.

```
src/
├── index.html   # marcação de todas as skins + painel ⚙ (220 linhas)
├── styles.css    # tema via CSS vars, todas as skins (557 linhas)
└── app.js         # prefs, render, chamadas Tauri (413 linhas)
```

Arquivo único por camada, `"use strict"`, sem imports, sem build step. Detecta
o ambiente:

```js
const TAURI = window.__TAURI__;
const invoke = TAURI ? TAURI.core.invoke : null;
const IS_APP = !!invoke;   // false quando aberto direto no navegador (modo demo)
```

## Preferências (`prefs`)

Objeto único, persistido em `localStorage["usoai.prefs"]`. `loadPrefs()` faz
merge de `DEFAULTS` com o que estiver salvo; `savePrefs()` grava de volta.

```js
const DEFAULTS = {
  skin: "plano",        // plano | sabre | duo | maul | kart | minimal
  driver: "weekly",     // qual janela enche sabre/kart: weekly | session
  accentS: "#2f7bff",   // cor da sessão
  accentW: "#ff4cd0",   // cor da semana
  invert: false,        // modo inverso: começa cheio e vai apagando
  noBg: false,          // sem o cartão de fundo (só a skin)
  orient: "v",          // orientação: v (em pé) | h (deitada)
  size: "medium",        // small | medium | large
  opacity: 35,            // opacidade do fundo (0–100)
  interval: 60,           // segundos entre leituras (cada uma custa ~1 token Haiku)
  alertThreshold: 90,     // % que dispara o alerta visual
  showNumbers: true,
  alwaysTop: true,
};
const SIZE_SCALE = { small: 0.85, medium: 1.0, large: 1.18 };
```

Para adicionar uma preferência nova: (1) campo em `DEFAULTS`, (2) controle no
`index.html`, (3) ler/escrever em `applyTheme()` e no listener correspondente
dentro de `wire()`.

## Helpers

- `$(sel, root)` / `$$(sel, root)` — `querySelector` / `querySelectorAll` com
  root opcional.
- `bind(name)` — atalho para `$('[data-bind="name"]')`.
- `clamp(x, a, b)`.
- `pctText(util)` — `"NN%"` a partir de um valor 0–1.
- `resetRelative(epoch)` — `"Reinicia em 4h 33min"` (usado na sessão de 5h).
- `resetAbsolute(epoch)` — `"Reinicia sex., 18:00"` (usado na semana de 7d).
- `resetShort(epoch, weekly)` — versão curta para sabre/kart; se `weekly`,
  formato `"sex 18:00"`; senão, `"4h33"` ou `"33min"` ou `"agora"`.

## `applyTheme()` — preferências → UI

Aplica CSS vars no `documentElement`: `--accent-s`, `--accent-w`, `--accent`
(= `accentS`, cor geral do "chrome"), `--accent-soft` (via `color-mix`),
`--bg-alpha` (= `opacity/100`), `--scale` (via `SIZE_SCALE`).

Mostra só a skin ativa (`el.hidden = el.dataset.skin !== prefs.skin`) e aplica
classes no `#widget`: `hide-numbers`, `bare` (= `noBg`), `orient-h`.

Sincroniza todos os controles do painel ⚙ com `prefs` atual (`setSeg`, valores
de inputs, checkboxes, labels de range). Termina chamando `autoSize()` para
redimensionar a janela conforme a skin ativa (a menos que o painel de
configurações esteja aberto).

`setSeg(group, val)` — marca `.active` no botão certo dentro de
`.seg[data-group="group"]`.

`tokenStatus()` — atualiza `data-bind="token-status"` com um dos três textos:
"✓ token guardado no cofre do sistema" / "nenhum token salvo" (no app sem
token) / "modo navegador (demonstração)" (fora do app).

## `render(d)` — pinta os dados nas skins

Recebe `d` = objeto `Limits` (do Rust) ou `{ok:false, error}`. Se `!d.ok`,
só escreve a mensagem de erro em `stamp` e sai.

Calcula `s = clamp(session_util, 0, 1)` e `w = clamp(weekly_util, 0, 1)`, então
preenche **todas as skins ao mesmo tempo** (mesmo as escondidas — é barato e
evita re-render ao trocar de skin):

| Skin | `data-bind` / `data-blade` usados | O que recebe |
| --- | --- | --- |
| **plano** | `s-pct`, `w-pct`, `s-bar`, `w-bar`, `s-reset`, `w-reset` | `%` + barra + reset de cada janela, separado |
| **minimal** | `s-pct2`, `w-pct2`, `s-bar2`, `w-bar2` | igual ao plano, versão compacta |
| **sabre** | `data-blade="single"`, `driver-value`, `driver-reset` | usa a janela escolhida em `prefs.driver` (`weekly`/`session`) |
| **duo** | `data-blade="s"` / `"w"`, `duo-s-pct`, `duo-w-pct`, `duo-s-reset`, `duo-w-reset` | sessão e semana lado a lado, sempre as duas |
| **maul** | `data-blade="ms"` / `"mw"`, `maul-s-pct`, `maul-w-pct`, `maul-s-reset`, `maul-w-reset` | lâmina de cima = sessão, de baixo = semana |
| **kart** | `data-bind="kart"` (elemento movido via `transform`), `driver-value`, `driver-reset` | usa `prefs.driver`, mesma lógica do sabre simples |

Funções de preenchimento:

- `fr(u) = inv ? 1-u : u` — fração de preenchimento/posição (respeita o modo
  inverso).
- `op(u) = inv ? (0.3 + 0.7*(1-u)) : 1` — opacidade do kart no modo inverso.
- `lit(u) = clamp(inv ? 1-u : u, 0.22, 1)` — brilho do sabre; piso `0.22` para
  o sabre nunca sumir de vez.
- `setBlade(sel, u)` — para cada elemento em `sel`, seta `--lit` (propriedade
  CSS custom) conforme `lit(u)`.
- `paintBar(el, util)` — seta `width` da barra e alterna classes `warn`
  (≥90% e <95%) / `crit` (≥95%).

Cor por janela: sabre/kart simples recebem a cor da janela ativa
(`driverColor = weekly ? accentW : accentS`) via `style.setProperty("--accent",
...)` diretamente no JS — as demais skins (plano, duo, maul, minimal) recebem a
cor via CSS puro (seção "cores por janela" abaixo).

Alerta global: `peak = max(s, w) * 100`; classe `.alert` no `#widget` se `peak
>= prefs.alertThreshold`; classe `.over` se `peak >= 100`.

`stamp` sempre mostra `"atualizado HH:MM"` ao final do render.

## Dados: `mockLimits()` e `refresh()`

- `mockLimits()` — usado fora do app (`!IS_APP`). Gera valores crescentes
  (`session_util` sobe ~3%/tick, `weekly_util` ~1.2%/tick) para demonstrar a
  animação sem precisar de rede. `session_reset` = agora + 4h33; `weekly_reset`
  = próxima sexta-feira às 18:00.
- `refresh()`:
  - fora do app → `mockLimits()`;
  - no app sem `authToken` → `{ok:false, error:"configure o token em ⚙"}`;
  - no app com token → `await invoke("get_limits", {token: authToken})`.
  - Sempre termina chamando `render(d)`; em exceção, escreve "erro ao ler
    limites" em `stamp` e loga no console.
- `restartTimer()` — recria o `setInterval(refresh, prefs.interval * 1000)`,
  chamado sempre que `prefs.interval` muda.

## Posição da janela

- `restoreWindowPos()` — lê `localStorage["usoai.winpos"]` (`{x, y}`) e
  reposiciona via `TAURI.window.getCurrentWindow().setPosition(new
  PhysicalPosition(x, y))`.
- `watchWindowPos()` — escuta `onMoved`, debounce de 300ms, grava a nova
  posição em `localStorage["usoai.winpos"]`.

## Tamanho da janela por skin (`WIN_SIZE`)

```js
const WIN_SIZE = {
  plano:   { v: [236, 104], h: [300, 88] },
  minimal: { v: [152, 60],  h: [270, 48] },
  sabre:   { v: [100, 152], h: [152, 84] },
  duo:     { v: [160, 152], h: [165, 132] },
  maul:    { v: [82, 164],  h: [186, 96] },
  kart:    { v: [216, 82],  h: [216, 82] },
};
const SETTINGS_SIZE = [300, 448];
```

`sizeWindow(w, h)` chama `getCurrentWindow().setSize(new LogicalSize(...))`
(no-op fora do app). `autoSize()` calcula `[w,h]` a partir de `WIN_SIZE[skin]`,
orientação e `SIZE_SCALE[size]`, mas **não encolhe durante a edição** (painel ⚙
aberto). `openSettings(open)` mostra/esconde `#settings` e redimensiona a
janela para `SETTINGS_SIZE` (aberto) ou volta ao `autoSize()` (fechado).

## `wire()` — todos os event listeners

- `#btnSettings` → abre painel; `#btnClose` → fecha; `#btnHide` → esconde a
  janela (continua na bandeja).
- `.seg` (segmented control genérico) → ao clicar num botão, seta
  `prefs[seg.dataset.group] = btn.dataset.val`, salva, reaplica tema e
  atualiza.
- `setToken(v)` — trim, guarda em `authToken` (memória), chama
  `invoke("save_token", ...)` no app, limpa o campo `#token` do DOM (não deixa
  o segredo visível), atualiza `tokenStatus()`.
- `#token` `change` → `setToken` + `refresh()`.
- `#testToken` click → `setToken` + testa a chamada real (`get_limits`),
  escreve resultado em `hint` (`"OK! Sessão N% · Semana N%"` ou `"Falhou:
  ..."`).
- `#clearToken` click → limpa `authToken`, chama `invoke("clear_token")`,
  atualiza status e `hint`, `refresh()`.
- `#accentS` / `#accentW` `input` → atualiza cor, salva, reaplica tema,
  atualiza.
- `#invert` / `#noBg` / `#showNumbers` `change` → salva prefs, reaplica tema
  (e/ou `refresh()`).
- `#opacity` `input` → salva, reaplica tema.
- `#interval` `input` → salva, atualiza label, `restartTimer()`.
- `#threshold` `input` → salva, atualiza label, `refresh()`.
- `#alwaysTop` `change` → salva, chama `invoke("set_always_on_top", {value})`
  no app.
- `hint` inicial: instrução de arrastar/⚙ no app, aviso de modo demo fora dele.

## Boot (`DOMContentLoaded`)

1. `wire()`, `applyTheme()`.
2. Se `IS_APP`:
   - migra `prefs.token` legado (versões antigas guardavam no
     `localStorage`) para o cofre via `save_token`, depois apaga o campo de
     `prefs`.
   - `authToken = await invoke("load_token")`.
   - se `prefs.alwaysTop`, aplica `set_always_on_top(true)`.
   - `restoreWindowPos()` + `watchWindowPos()`.
   - se não há `authToken`, abre o painel ⚙ automaticamente (1ª vez pede o
     token).
3. `tokenStatus()`, `refresh()` (primeira leitura), `restartTimer()`.

## `index.html` — estrutura

`<html lang="pt-BR">`. Um único `#widget` com `data-tauri-drag-region` (permite
arrastar a janela de qualquer ponto não-controle). Dentro dele:

- `.actions` (aparecem no hover): `#btnSettings` (⚙) e `#btnHide` (—).
- Seis blocos `.skin.skin-<nome>[data-skin="<nome>"]`, todos exceto `plano`
  com `hidden`: `plano`, `sabre`, `duo`, `maul`, `kart`, `minimal` — ver tabela
  acima para os `data-bind`/`data-blade` de cada um.
- `.stamp[data-bind="stamp"]` — timestamp/erro, fora das `.skin` (sempre
  visível no hover).

Depois do `#widget`, o painel `#settings[hidden][data-no-drag]` com:

- Campo de token (`#token`, `type="password"`, placeholder `sk-ant-oat01-…`),
  texto de ajuda com `claude setup-token`, links `#testToken` / `#clearToken`,
  e `data-bind="token-status"`.
- Segmented control `data-group="skin"` com 6 botões (`plano`, `sabre`, `duo`,
  `maul`, `kart`, `minimal` — rotulados "Plano/Sabre/Duo/Maul/Kart/Mini").
- Segmented control `data-group="driver"` (`weekly`/`session`, rotulado
  "Semana"/"Sessão") — só afeta sabre simples e kart.
- Cor da sessão (`#accentS`, `type="color"`) e cor da semana (`#accentW`).
- Segmented `data-group="size"` (P/M/G) e `data-group="orient"` (Em pé/Deitada).
- Ranges: `#opacity` (fundo, 0–100), `#interval` (atualizar, 5–300s, passo 5),
  `#threshold` (alerta em, 50–100%, passo 5).
- Checkboxes: `#invert` (modo inverso), `#noBg` (sem fundo), `#showNumbers`
  (mostrar números), `#alwaysTop` (sempre no topo).
- `<p class="hint" data-bind="hint">` — mensagens contextuais.

## Convenção de abreviação S / W

Em todas as skins e labels visíveis ao usuário, **sessão = S** e **semana = W**.
Nunca usar os termos por extenso na UI — só no painel ⚙ onde há espaço suficiente.
Aplicar esta convenção a qualquer skin nova.

## `styles.css` — convenções visuais

CSS vars globais em `:root`: `--accent-s`, `--accent-w`, `--accent`,
`--accent-soft` (via `color-mix`), `--bg-alpha`, `--scale`, `--fg`, `--fg-dim`,
`--font`, `--outline` (contorno escuro em volta do texto, legível em qualquer
fundo), `--hilt-cyl` / `--hilt-bands` (gradientes do cabo do sabre de luz,
compartilhados entre skins `sabre` e `maul`).

Pontos importantes:

- `html, body { background: transparent; }` — a janela do Tauri é transparente
  de verdade; o "cartão" visual é o `#widget` com `background:
  rgba(18,22,28,var(--bg-alpha))` e `backdrop-filter: blur(9px)`. Classe
  `.bare` remove esse cartão (modo "sem fundo").
- Arrastar de qualquer ponto: `.skin, .skin *, .stamp { pointer-events: none;
  }` deixa o clique passar para o `#widget` (drag region); só `.actions`
  captura clique (`pointer-events: auto`).
- `#widget.hide-numbers` esconde uma lista extensa de seletores de texto
  (`.big`, `.sub`, `.pct`, `.tip-pct`, `.lim-pct`, `.pill .val`, etc.) — ao
  adicionar um novo texto numérico numa skin nova, incluir o seletor aqui
  também se ele deve respeitar essa preferência.
- Cores de alerta em barras: `.warn` = laranja `#ff9f43` (≥90%, <95%), `.crit`
  = vermelho `#ff5a5a` (≥95%) — classes setadas em `paintBar()` no JS.
- Técnica do sabre de luz (créditos a Kevin Powell): núcleo branco
  (`::before`) + aura colorida borrada e pulsante (`::after`, `animation:
  sabrePulse 5s linear infinite`) + `box-shadow` em camadas (`--accent` a
  várias intensidades de blur). A opacidade da lâmina (`opacity: var(--lit,
  1)`) é o que o JS controla via `setBlade()`.
- Animações de alerta (`#widget.alert`): sabre/maul pulsam (`bladePulse`),
  kart brilha e treme (`kartGlow`), bandeira do kart acena (`flagWave`), barra
  minimal pisca (`barPulse`). `#widget.over` (≥100%) desenha um anel vermelho
  discreto (`box-shadow: inset`).
- **Cores por janela**: CSS faz o *scoping* redefinindo `--accent`/
  `--accent-soft` para `--accent-s` ou `--accent-w` dentro do subtree certo —
  `.skin-plano .lim:nth-of-type(1/2)`, `.skin-minimal .pill:nth-of-type(1/2)`,
  `.skin-duo .duo-cell:nth-of-type(1/2)`, `.maul-blade.up/.down`. Sabre simples
  e kart, por não terem duas metades fixas (a cor depende de `prefs.driver`),
  recebem a cor via `style.setProperty` direto no JS (ver `render()` acima).
- Orientação horizontal (`.orient-h`): regras específicas por skin que
  reposicionam cabo/lâmina/pills para o layout deitado — todas as skins
  suportam as duas orientações.
- Painel `.settings`: overlay fixo (`position: fixed; inset: 0`), fundo quase
  opaco (`rgba(14,17,22,.97)`), `z-index: 20`.

## Convenção de binding DOM

- Elementos recebem `data-bind="nome"`; o JS usa `bind("nome")` para
  preencher um único elemento, ou `$$('[data-bind="nome"]')` para preencher
  vários iguais de uma vez (usado em `driver-value`/`driver-reset`, que
  aparecem tanto no sabre quanto no kart).
- Lâminas (sabre/maul) usam `data-blade="single|s|w|ms|mw"`; a altura/opacidade
  é setada pelo helper `setBlade(sel, util)` em `render()`, nunca hardcoded no
  CSS.

## Como adicionar uma skin nova

1. **HTML**: um bloco `<div class="skin skin-X" data-skin="X" hidden>` dentro
   de `#widget`, e um botão `<button data-val="X">X</button>` no seletor
   `.seg[data-group="skin"]`.
2. **CSS**: estilos de `.skin-X` em `styles.css`. Reusar `--accent`/
   `--accent-soft` para herdar cor e os estados de alerta já existentes.
3. **JS**: preencher os `data-bind`/`data-blade` da skin nova dentro de
   `render()`. Usar `fr(util)` (respeita o modo inverso) e `op(util)`
   (opacidade que "apaga" no inverso) quando aplicável.
4. Adicionar entrada em `WIN_SIZE` (tamanho de descanso `[v, h]` da janela para
   essa skin) — senão ela herda o tamanho de `plano`.
5. Sem passos extras — **não há registro central de skins**; o `hidden`
   toggle em `applyTheme()` já cobre qualquer skin nova automaticamente.
