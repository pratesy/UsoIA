# BACKEND.md

Referência linha a linha do `src-tauri/` — código, structs, configs. Para o
fluxo de dados e o "porquê", veja [ARCHITECTURE.md](ARCHITECTURE.md) primeiro.

```
src-tauri/
├── Cargo.toml               # dependências Rust
├── build.rs
├── tauri.conf.json           # janela, CSP, bundle
├── capabilities/default.json # permissões mínimas
└── src/
    ├── main.rs                # entry point
    ├── lib.rs                 # comandos Tauri + bandeja (tray)
    ├── limits.rs               # limites reais via OAuth (fonte primária)
    ├── secret.rs               # token no cofre do SO (keyring + fallback)
    └── usage.rs                # uso local em tokens via .jsonl (opcional)
```

## `main.rs`

Entry point mínimo. Em release no Windows, evita abrir console extra
(`windows_subsystem = "windows"`). Só chama `usoai_lib::run()`.

## `lib.rs` — comandos Tauri e bandeja

Módulos: `mod limits; mod secret; mod usage;`

Comandos expostos via `invoke_handler(tauri::generate_handler![...])`:

| Comando | Assinatura | O quê |
| --- | --- | --- |
| `get_usage()` | `() -> usage::UsageReport` | uso local em tokens, síncrono |
| `get_limits(token)` | `(String) -> limits::Limits` (async) | limites reais via OAuth; roda em `spawn_blocking` porque a chamada HTTP é bloqueante; erro interno vira `Limits::err("erro interno")` |
| `save_token(token)` | `(String) -> Result<(), String>` | grava no cofre do SO via `secret::save`, faz `trim()` antes |
| `load_token()` | `() -> String` | lê o token salvo (`""` se não houver) |
| `clear_token()` | `()` | remove o token salvo de ambos os lugares (cofre + fallback) |
| `set_always_on_top(window, value)` | `(WebviewWindow, bool) -> Result<(), String>` | fixa/solta o "sempre no topo" da janela |

`toggle_window(window)` — função interna (não é comando Tauri): mostra/esconde
a janela principal, usada pelo menu da bandeja.

No `setup()` do `Builder`, monta o **ícone de bandeja**:
- Menu com dois itens: `"Mostrar / Esconder"` (id `show`) e `"Sair"` (id `quit`).
- `on_menu_event`: `show` chama `toggle_window` na janela `"main"`; `quit` chama
  `app.exit(0)`.
- Tooltip: `"UsoAI — uso do Claude Code"`.

Plugin registrado: `tauri_plugin_opener::init()`.

## `limits.rs` — fonte primária (limites reais)

```rust
pub struct Limits {
    pub ok: bool,
    pub error: Option<String>,
    pub session_util: f64,  // 0.0–1.0  (janela de 5h)
    pub session_reset: i64, // epoch (s)
    pub weekly_util: f64,   // 0.0–1.0  (janela de 7d, todos os modelos)
    pub weekly_reset: i64,  // epoch (s)
    pub status: String,     // allowed | allowed_warning | exceeded | ...
}
```

- `Limits::err(msg)` — atalho para construir um `Limits` de erro (`ok: false`).
- `UA` — User-Agent fixo: `"claude-code/2.0.37"` (a API exige esse formato para
  aceitar o token OAuth). **Se a Anthropic exigir uma versão mais nova, esta
  constante é o lugar a atualizar.**
- `fetch(token)`:
  1. `trim()` no token; se vazio, `Limits::err("sem token")`.
  2. Monta o body: `{"model": "claude-haiku-4-5-20251001", "max_tokens": 1,
     "messages": [{"role": "user", "content": "x"}]}`.
  3. `POST` para `https://api.anthropic.com/v1/messages` com os headers:
     `Authorization: Bearer <token>`, `anthropic-version: 2023-06-01`,
     `anthropic-beta: oauth-2025-04-20` (permite token OAuth em `/v1/messages`),
     `User-Agent: claude-code/2.0.37`, `Content-Type: application/json`.
     Timeout de 20s. Usa a crate `ureq` (bloqueante).
  4. Em `Err(ureq::Error::Status(code, r))`: se o header de utilização de 5h
     estiver presente, usa a resposta mesmo assim (isso cobre o 429 de rate
     limit); se `code` for 401/403, retorna `"token inválido ou expirado"`;
     caso contrário, `"HTTP {code}"`.
  5. Outros erros de rede → `"falha de rede: {e}"`.
  6. Em sucesso, `from_headers(&resp)` lê os 5 headers (tabela em
     [ARCHITECTURE.md](ARCHITECTURE.md)) e preenche o struct (`unwrap_or(0.0)`
     / `unwrap_or(0)` se algum faltar).

Nunca dá panic — todo erro vira `Limits { ok: false, error: Some(...) }`.

## `secret.rs` — armazenamento do token

- `SERVICE = "com.gyga.usoai"`, `USER = "oauth-token"` — chave usada na crate
  `keyring` (Keychain no macOS, Credential Manager no Windows, Secret
  Service/libsecret no Linux).
- `fallback_path()` — `dirs::config_dir()/usoai/token`, criado se não existir.
- `save(token)`: tenta o cofre primeiro; se salvar com sucesso, remove um
  eventual arquivo de fallback antigo (evita cópia em texto). Se o cofre
  falhar, escreve no arquivo de fallback com permissão `0600` (só Unix —
  `set_perms_600` é no-op em não-Unix).
- `load()`: cofre → fallback → `""`.
- `clear()`: apaga dos dois lugares, ignorando erros.

O token **nunca** fica no `localStorage`. No front-end ele vive só em memória
(`authToken`, variável JS). Tokens legados que ficaram em `localStorage` de
versões antigas são migrados para o cofre no primeiro boot (ver
[FRONTEND.md § boot](FRONTEND.md#boot-domcontentloaded)).

## `usage.rs` — fonte secundária (uso local)

Lê `~/.claude/projects/**/*.jsonl` (mais `CLAUDE_CONFIG_DIR` e
`~/.config/claude/projects` como alternativas). Cada linha é um JSON; as que
têm `message.usage` carregam tokens.

```rust
pub struct Tokens { input, output, cache_creation, cache_read: u64 }
pub struct Bucket { tokens: Tokens, total: u64, cost_usd: f64, messages: u64,
                     by_model: HashMap<String, u64> }
pub struct UsageReport { session: Bucket, weekly: Bucket,
                          session_id: Option<String>, updated_at: String,
                          no_data: bool }
```

- `project_dirs()` — monta a lista de diretórios candidatos, filtrando os que
  existem.
- `collect()`:
  - Janela **`session`** = o arquivo `.jsonl` de mtime mais recente entre todos
    os diretórios candidatos.
  - Janela **`weekly`** = tudo com timestamp dentro dos últimos 7 dias (RFC
    3339), em todos os arquivos.
  - Para cada entrada com `message.usage`, soma tokens no bucket correspondente,
    conta mensagens, acumula custo estimado (`entry_cost`) e agrega por modelo
    em `by_model`.
  - Se nenhum diretório de transcrições existir, retorna `no_data: true` com
    buckets vazios — nunca dá panic.
- `price_per_million(model)` — tabela aproximada de preço por 1M tokens
  (input, output, cache_write, cache_read) para Opus/Sonnet/Haiku (detectado
  por substring no nome do modelo, case-insensitive). Modelo desconhecido →
  todos os preços zero.

Este módulo é **opcional**: o widget hoje usa só os limites reais
(`get_limits`); `get_usage` fica disponível para quem quiser mostrar
contagem de tokens/custo na UI (nenhuma skin atual consome isso ainda).

## `Cargo.toml` — dependências

- `tauri` v2, features `["macos-private-api", "tray-icon"]`.
- `tauri-plugin-opener` v2.
- `serde` (`derive`), `serde_json` — serialização.
- `chrono` (`clock`) — timestamps em `usage.rs`.
- `dirs` v5 — diretórios de config/home multiplataforma.
- `walkdir` v2 — varredura recursiva de `~/.claude/projects`.
- `ureq` v2 (`json`, `tls`) — cliente HTTP bloqueante usado em `limits.rs`.
- `keyring` v2 — cofre do SO em `secret.rs`.
- `[lib] crate-type = ["staticlib", "cdylib", "rlib"]`, nome `usoai_lib`.
- `[profile.release]`: `panic = "abort"`, `codegen-units = 1`, `lto = true`,
  `opt-level = "s"` (otimiza tamanho), `strip = true`.

## `tauri.conf.json`

- `productName: "UsoAI"`, `identifier: "com.gyga.usoai"`, `version: "0.1.0"`.
- `build.frontendDist: "../src"` — sem bundler, serve `src/` direto.
- `app.withGlobalTauri: true` — expõe `window.__TAURI__` no front-end vanilla.
- `app.macOSPrivateApi: true` — necessário junto com `transparent: true` no
  macOS.
- Janela `"main"`: `300x150` (min `160x80`), `transparent: true`,
  `decorations: false`, `alwaysOnTop: true`, `resizable: true`,
  `skipTaskbar: true`, `shadow: false`, `center: false`.
- **CSP**: `"default-src 'self'; connect-src 'self' ipc: http://ipc.localhost;
  img-src 'self' asset: data:; style-src 'self' 'unsafe-inline'"`. Restritiva
  de propósito — o WebView não faz rede própria (a chamada HTTPS é feita pelo
  Rust). Se a janela abrir em branco depois de mexer aqui, voltar `csp` para
  `null` para isolar o problema.
- `bundle.targets: "all"`, ícones em `icons/32x32.png`, `128x128.png`,
  `128x128@2x.png`, `icon.ico`.

## `capabilities/default.json`

Permissões mínimas, escopo só na janela `"main"`:
`core:default`, `core:window:allow-start-dragging`,
`core:window:allow-set-always-on-top`, `core:window:allow-set-position`,
`core:window:allow-set-size`, `core:window:allow-hide`,
`core:window:allow-show`, `opener:default`.

> Gotcha: comandos custom (`get_limits`, `save_token`, etc.) não precisam de
> permissão aqui, mas qualquer chamada nova a plugins de janela a partir do JS
> (ex.: mais controles de hide/show/always-on-top) precisa ser adicionada
> nesta lista.

## Build / empacotamento

```bash
npm run dev       # tauri dev — hot reload
npm run build      # tauri build — instaladores
npm run icon        # gera ícones incl. .icns (macOS, 1ª vez)
```

Pré-requisitos por SO:
- **Linux**: `libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf`.
- **Windows**: Visual Studio Build Tools, workload *Desktop development with
  C++* (WebView2 já vem no Windows 10/11).
- **Todos**: Rust stable + Node 20+.

Saída: Windows `.msi` em `src-tauri/target/release/bundle/msi/`; macOS `.dmg`;
Linux `.AppImage`/`.deb`.

## Segurança e privacidade

- Token guardado no **cofre do SO** (Keychain/Credential Manager/Secret
  Service via `keyring`); fallback em arquivo `0600` se o cofre não estiver
  disponível (mesmo comportamento do próprio Claude Code no Linux sem
  chaveiro).
- **Nunca** no `localStorage`, nunca logado, nunca commitado.
- A única conexão de rede que usa o token é HTTPS direto para
  `api.anthropic.com`, feita pelo Rust — sem terceiros.
- Para obter o token: `claude setup-token` gera um OAuth de longa duração
  (`sk-ant-oat01-…`, ≈1 ano de validade).
