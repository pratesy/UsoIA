# ARCHITECTURE.md

Visão geral técnica do **UsoAI** — o "porquê" e o fluxo de dados de ponta a
ponta. Para implementação linha a linha, veja [BACKEND.md](BACKEND.md) (Rust)
e [FRONTEND.md](FRONTEND.md) (JS/HTML/CSS). Para o guia de contribuição com
IA, veja [CLAUDE.md](CLAUDE.md).

## Visão geral

```
            ┌─────────────────────────── app (Tauri) ───────────────────────────┐
            │                                                                    │
  ~/.claude │   front-end (WebView)            back-end (Rust)                   │
  /projects │   ┌───────────────┐  invoke()   ┌──────────────────┐  HTTPS        │
  *.jsonl ──┼──▶│ app.js        │────────────▶│ limits.rs        │──────────────▶ api.anthropic.com
  (opcional)│   │  render skins │   get_limits │  lê headers      │   /v1/messages
            │   │  prefs (LS)   │◀────────────│  rate-limit      │◀──────────────  (200 ou 429)
            │   └───────────────┘   {util,...} └──────────────────┘                │
            │           ▲                       ┌──────────────────┐               │
            │           └───────────────────────│ usage.rs (opc.)  │◀── .jsonl     │
            │             get_usage             └──────────────────┘               │
            └────────────────────────────────────────────────────────────────────┘
```

## Fonte primária: limites reais (`limits.rs`)

Os percentuais e resets que o painel `/usage` mostra vêm de **headers HTTP** que a
Anthropic envia em toda resposta da API — não são dados locais. `limits.rs` faz
uma chamada barata (`max_tokens: 1`, ≈1 token Haiku) com o token OAuth do
usuário e lê os headers da resposta, tanto em **200** quanto em **429**
(rate limited — os headers vêm preenchidos do mesmo jeito).

| Header | Significado |
| --- | --- |
| `anthropic-ratelimit-unified-5h-utilization` | uso da sessão (0.0–1.0) |
| `anthropic-ratelimit-unified-5h-reset` | reset da sessão (epoch s) |
| `anthropic-ratelimit-unified-7d-utilization` | uso semanal (0.0–1.0) |
| `anthropic-ratelimit-unified-7d-reset` | reset semanal (epoch s) |
| `anthropic-ratelimit-unified-status` | `allowed` / `allowed_warning` / `exceeded`… |

> Existe também a janela `7d_sonnet` (semana só de Sonnet) — não usada hoje, mas
> trivial de adicionar (ver [ROADMAP.md](ROADMAP.md)).

A chamada de rede é **bloqueante** (`ureq`), então o comando `get_limits` é `async`
e roda em `spawn_blocking` para não travar a UI. Erros nunca causam panic; viram
`Limits { ok: false, error }`. Struct completo, headers obrigatórios na
requisição e tratamento de erro: [BACKEND.md § limits.rs](BACKEND.md#limitsrs--fonte-primária-limites-reais).

## Fonte secundária: uso local (`usage.rs`)

Lê `~/.claude/projects/**/*.jsonl` e agrega tokens em duas janelas: **sessão**
(o `.jsonl` mais recente) e **semana** (últimos 7 dias, todos os projetos).
Inclui uma estimativa de custo por modelo. É **opcional** — o widget hoje usa
só os limites reais; `usage.rs` fica disponível para quem quiser exibir
contagem de tokens/custo. Detalhe dos structs e da agregação:
[BACKEND.md § usage.rs](BACKEND.md#usagers--fonte-secundária-uso-local).

## Comandos Tauri e armazenamento do token

`lib.rs` expõe `get_limits`, `get_usage`, `save_token`/`load_token`/`clear_token`
e `set_always_on_top`, além de montar o ícone de bandeja. O token OAuth é
guardado no cofre do SO via `secret.rs` (crate `keyring`), com fallback em
arquivo `0600`. Tabela de comandos e detalhes do cofre:
[BACKEND.md § lib.rs e secret.rs](BACKEND.md#librs--comandos-tauri-e-bandeja).

## Front-end (`app.js`)

`prefs` (objeto persistido em `localStorage`) guia tudo: qual skin mostrar,
cores, intervalo de atualização, etc. `refresh()` chama `get_limits` (ou
`mockLimits()` fora do app) num timer; `render(d)` preenche a skin ativa a
partir de `session_util`/`weekly_util` (0–1) e dos resets. Não há registro
central de skins — cada uma só precisa dos `data-bind`/`data-blade` certos
para `render()` preencher. Mapeamento completo por skin, convenção de cor por
janela e como adicionar uma skin nova: [FRONTEND.md](FRONTEND.md).

## Janela (`tauri.conf.json`)

`transparent: true`, `decorations: false`, `alwaysOnTop: true`, `skipTaskbar: true`,
`macOSPrivateApi: true`. Arrasto via `data-tauri-drag-region`. `withGlobalTauri`
expõe `window.__TAURI__`.

**CSP**: `default-src 'self'` (mais `connect-src` com os endpoints de IPC do Tauri).
O WebView não faz rede própria — a chamada HTTPS é do Rust —, então a política é
restritiva de propósito. Se algum dia a janela abrir em branco após mexer aqui,
volte `csp` para `null` para isolar o problema. Config completa:
[BACKEND.md § tauri.conf.json](BACKEND.md#tauriconfjson).
