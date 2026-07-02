<div align="center">

# UsoAI

**Widget flutuante, pequeno e delicado para acompanhar os limites de uso do Claude Code — em qualquer lugar da tela, em Windows, Linux e macOS.**

Mostra o `%` da **sessão (5h)** e da **semana (7d)** com os horários de reset, igual ao painel `/usage` — mas sempre à vista, e com skins divertidas.

</div>

---

## ✨ O que é

Em vez de abrir o painel de limites toda hora, o UsoAI deixa um item minúsculo e
translúcido no canto da sua tela. Você escolhe como ele aparece:

| Skin | Como mostra |
| --- | --- |
| **Plano** (padrão) | Duas barras — *Sessão atual* e *Semana · todos os modelos* — cada uma com `% usado` e `Reinicia em…`. Igual ao painel oficial. |
| **Sabre de luz** | A lâmina **ascende** com o uso. `%` fixa no topo e a data de reset na base. |
| **Duo** | Dois sabres lado a lado — um para a **sessão**, outro para a **semana**. |
| **Maul** | Sabre duplo (Darth Maul): lâmina de **cima = sessão**, de **baixo = semana**. |
| **Kart** | Um carrinho **anda pela pista** rumo à bandeira. |
| **Minimal** | Dois pills discretos com barrinha de progresso. |

Personalização (no ⚙, ao passar o mouse): cor da sessão e da semana separadas,
modo inverso (a lâmina começa cheia e vai *apagando* conforme você usa), modo
sem fundo (só a skin flutuando), tamanho, opacidade, intervalo, limite de alerta,
e "sempre no topo".

---

## 📡 De onde vêm os números (e um aviso honesto)

O `%` do plano e os horários de reset **não estão nos logs locais** — eles vivem
no servidor da Anthropic. Toda resposta da API traz headers
`anthropic-ratelimit-unified-*` com a utilização (0–1) e o reset (epoch) de cada
janela (5h e 7d). O UsoAI faz uma chamada barata (≈1 token Haiku) e lê esses
headers — é a mesma fonte do `/usage`.

> ⚠️ **Esse endpoint não é uma API pública documentada.** É o mesmo mecanismo
> interno que o Claude Code usa, descoberto pela comunidade (veja
> [Créditos](#-créditos)). Pode mudar ou deixar de funcionar a qualquer momento —
> se isso acontecer, o ajuste fica em [`src-tauri/src/limits.rs`](src-tauri/src/limits.rs).

Para autenticar, o app usa um **token OAuth de longa duração** (≈1 ano):

```bash
claude setup-token
```

Cole o `sk-ant-oat01-…` no campo do ⚙. **O token nunca sai da sua máquina** — a
chamada HTTP é feita pelo backend Rust local, direto para `api.anthropic.com`.

---

## 🚀 Como usar

### Ver as skins agora (sem compilar)

Abra [`src/index.html`](src/index.html) no navegador. Fora do app ele entra em
**modo demo** com dados que sobem sozinhos — dá pra ver a lâmina subindo, o kart
andando e testar tudo no ⚙.

### Rodar de verdade

Pré-requisitos: **Rust** (stable) e **Node 20+**. No Linux, instale também:

```bash
sudo apt-get install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
```

No Windows, instale o **Visual Studio Build Tools** com o workload
*Desktop development with C++* (o WebView2 já vem no Windows 10/11).

Depois:

```bash
npm install
npm run dev        # abre o widget lendo seu uso real
```

Na primeira vez o ⚙ abre pedindo o token: rode `claude setup-token`, cole e
clique em **Testar agora**.

### Gerar instalador

```bash
npm run icon       # (macOS, 1ª vez) gera os ícones incl. .icns
npm run build
```

- Windows → `.msi` em `src-tauri/target/release/bundle/msi/`
- macOS → `.dmg` · Linux → `.AppImage` / `.deb`

---

## 🧩 Estrutura

```
UsoAI/
├── src/                    # front-end (vanilla, sem build step)
│   ├── index.html · styles.css · app.js
├── src-tauri/
│   ├── src/
│   │   ├── limits.rs       # limites reais (OAuth) → % + reset
│   │   ├── usage.rs        # uso local em tokens (opcional)
│   │   ├── lib.rs          # comandos Tauri + bandeja
│   │   └── main.rs
│   ├── capabilities/default.json
│   ├── tauri.conf.json     # janela transparente, sem borda, always-on-top
│   ├── icons/ · Cargo.toml
├── README.md
├── CLAUDE.md               # guia para agentes de IA
├── ARCHITECTURE.md         # detalhes técnicos
└── ROADMAP.md              # próximas etapas
```

Detalhes técnicos em [ARCHITECTURE.md](ARCHITECTURE.md). Para estender o projeto
(inclusive com ajuda de IA), veja [CLAUDE.md](CLAUDE.md).

---

## 🔒 Privacidade e segurança

- O token OAuth é guardado no **cofre do sistema operacional** — Keychain (macOS),
  Credential Manager (Windows) ou Secret Service/libsecret (Linux). Se o cofre não
  estiver disponível (ex.: Linux sem chaveiro), cai num arquivo `0600`, o mesmo
  fallback que o Claude Code usa. Nunca fica em `localStorage`.
- O token só trafega numa conexão HTTPS direta para `api.anthropic.com`, feita
  pelo backend Rust. Não é enviado a terceiros nem gravado em logs.
- Trate o token como uma senha: quem o tiver pode consumir a sua cota do Claude.
  Para revogar o acesso, gerencie suas credenciais na sua conta Anthropic.

---

## 🙏 Créditos

O UsoAI tem código próprio, mas se apoia em ideias e descobertas de vários
projetos da comunidade. Obrigado a todos:

- **[semaphore](https://github.com/lucianodiisouza/semaphore)** — por
  *Luciano dii Souza*. Inspiração direta de arquitetura: um widget flutuante
  Tauri, cross-platform, com bandeja, temas e i18n. O formato "item delicado
  sempre no topo" veio daqui. (MIT)
- **[claude-monitor](https://github.com/rjwalters/claude-monitor)** — por
  *R. J. Walters*. Mostrou como obter os limites reais via token OAuth do
  `claude setup-token` e ler a utilização nos headers. (MIT)
- **[claude-meter](https://github.com/abhishekray07/claude-meter)** e o artigo
  *[I Tried to Reverse Engineer Claude Code's Usage Limits](https://www.claudecodecamp.com/p/i-tried-to-reverse-engineer-claude-code-s-usage-limits)*
  — por *Abhishek Ray*. Documentou em detalhe os headers
  `anthropic-ratelimit-unified-*` (janelas 5h/7d, utilização, reset, status).
- **[ccusage](https://github.com/ryoppippi/ccusage)** — por *ryoppippi*. Referência
  para a leitura dos logs locais `~/.claude/projects/**/*.jsonl` (usada no
  `usage.rs` opcional).
- **Kevin Powell** — pela técnica CSS do sabre de luz (núcleo branco + aura
  colorida borrada + glow em camadas) que inspirou a aparência das skins de sabre.
  [CodePen](https://codepen.io/kevinpowell/pen/jOygveP) ·
  [vídeo "how I made it"](https://www.youtube.com/watch?v=CBw9-K6hYVA).
- **[Tauri](https://tauri.app)** — a base que torna o app leve e cross-platform.
- **Anthropic / Claude Code** — a ferramenta cujo uso este widget acompanha.

Documentação oficial consultada:
[Models, usage, and limits in Claude Code](https://support.claude.com/en/articles/14552983-models-usage-and-limits-in-claude-code).

---

## 🗺️ Próximas etapas

Veja [ROADMAP.md](ROADMAP.md).

## Licença

MIT.
