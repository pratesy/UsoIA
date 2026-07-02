# CLAUDE.md — guia para agentes de IA

Ponto de entrada para qualquer IA (Claude Code, Cursor, etc.) trabalhar no
**UsoAI** com segurança. Este arquivo é lido automaticamente toda sessão — por
isso fica enxuto de propósito. Detalhes de implementação ficam nos arquivos
linkados abaixo; leia só o que a tarefa pedir.

## O que é o projeto

Widget desktop flutuante (Tauri v2) que mostra os **limites de uso do Claude Code**
— `%` da sessão (5h) e da semana (7d) + horários de reset — em Windows, Linux e
macOS. Front-end em HTML/CSS/JS *vanilla* (sem bundler); back-end em Rust.

## Stack e princípios

- **Tauri v2** (Rust) para a janela transparente, sem borda, always-on-top e a bandeja.
- **Front-end vanilla**: um único `src/app.js`, sem dependências npm, sem build step.
  `frontendDist` aponta direto para `src/`. Usa `withGlobalTauri: true`, então o JS
  acessa `window.__TAURI__.core.invoke`.
- **Sem framework, sem TypeScript.** Mantenha assim — a simplicidade é proposital.
- Comentários e textos de UI em **pt-BR**.

## Mapa da documentação

Leia sob demanda, conforme a tarefa — não é preciso carregar tudo de uma vez:

| Arquivo | Quando ler |
| --- | --- |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | entender o fluxo de dados de ponta a ponta antes de mexer em qualquer coisa |
| [BACKEND.md](docs/BACKEND.md) | mexer em `src-tauri/` — comandos Tauri, `limits.rs`, `secret.rs`, `usage.rs`, config Tauri/Cargo/capabilities |
| [FRONTEND.md](docs/FRONTEND.md) | mexer em `src/` — prefs, `render()`, skins, CSS, `index.html` |
| [README.md](README.md) | apresentação pro usuário final, como rodar, créditos |
| [ROADMAP.md](docs/ROADMAP.md) | o que ainda falta / próximas etapas |

## Estrutura

```
src/                     # front-end — ver docs/FRONTEND.md
  index.html · styles.css · app.js
src-tauri/src/           # back-end — ver docs/BACKEND.md
  limits.rs · secret.rs · usage.rs · lib.rs · main.rs
src-tauri/tauri.conf.json · capabilities/default.json
```

## Como rodar / validar

```bash
node --check src/app.js        # checagem de sintaxe do front-end
npm run dev                    # app com hot reload (precisa de Rust + Node)
npm run build                  # instaladores
```

Para inspecionar visualmente sem compilar: abra `src/index.html` no navegador
(entra em **modo demo** — `IS_APP` falso → usa `mockLimits()`).

## Fluxo de dados (resumo — detalhe completo em docs/ARCHITECTURE.md)

1. `app.js` chama o comando Tauri `get_limits(token)`.
2. `limits.rs` faz `POST https://api.anthropic.com/v1/messages` (1 token Haiku) com
   o token OAuth e lê os headers `anthropic-ratelimit-unified-*` da resposta
   (funciona em 200 e em 429).
3. Retorna `{ ok, session_util, session_reset, weekly_util, weekly_reset, status }`.
4. `render()` desenha a skin ativa a partir desses valores.

## Cuidados (gotchas) — não quebrar isso

- **Endpoint não oficial.** `limits.rs` depende de headers internos da Anthropic.
  Não invente limites fixos no cliente; tudo vem dos headers. Se quebrar, conserte
  só ali. O User-Agent (`claude-code/x.y.z`) e o beta `oauth-2025-04-20` são
  necessários para o token OAuth autenticar em `/v1/messages`.
- **Token = segredo.** Nunca logue, commite ou envie o `sk-ant-oat01-…` para
  qualquer lugar além de `api.anthropic.com`. Ele é guardado no cofre do SO via
  `secret.rs` (crate `keyring`, com fallback de arquivo `0600`) — **nunca** no
  `localStorage`. No front-end ele vive só em memória (`authToken`).
- **Janela transparente** exige `transparent: true` + `macOSPrivateApi: true`
  (mac). Arrastar usa `data-tauri-drag-region`.
- **Capabilities**: comandos custom não precisam de permissão, mas chamadas a
  plugins de janela (hide/show/always-on-top a partir do JS) precisam estar em
  `capabilities/default.json`.
- **color-mix()** é usado no CSS — ok em WebView2/WebKit recentes.
- **Custo**: cada leitura de limites gasta ~1 token Haiku. O slider de intervalo
  vai de 5s a 300s (padrão 60s) — quanto menor, mais chamadas por minuto.

## O que NÃO fazer

- Não adicionar bundler/framework/TypeScript sem necessidade real.
- Não persistir o token fora do dispositivo nem em texto em logs.
- Não hardcodar os limites do plano (são dinâmicos no servidor).
