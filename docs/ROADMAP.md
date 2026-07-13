# ROADMAP — próximas etapas

Ideias para evoluir o UsoAI, da mais simples à mais ambiciosa. Nada aqui é
obrigatório; é um mapa de possibilidades.

## Curto prazo (rápidas)

- [ ] **Iniciar com o sistema** (autostart) via `tauri-plugin-autostart`, com um
      toggle no ⚙.
- [ ] **Lembrar posição/tamanho da janela** entre sessões (salvar x/y/scale).
- [ ] **Aviso ao quase apagar**: no modo inverso, fazer a lâmina piscar/tremular
      quando o restante estiver baixo.
- [ ] **Atalho na bandeja** para abrir o painel ⚙ (útil no modo "sem fundo").
- [ ] **Terceira janela `7d_sonnet`** (semana só de Sonnet) como barra/lâmina
      opcional — os headers já existem.

## Médio prazo

- [ ] **Auto-detectar o token** lendo as credenciais do Claude Code
      (`~/.claude/.credentials.json` no Win/Linux; Keychain no macOS), com
      *fallback* para o `claude setup-token` manual.
- [ ] **Histórico**: guardar utilização ao longo do tempo (SQLite local) e mostrar
      um mini-gráfico de tendência.
- [ ] **Multi-conta**: alternar entre tokens e mostrar a conta com mais "fôlego".
- [ ] **Mais skins**: barra de XP, "tanque de combustível", bateria, termômetro.
- [ ] **Sons/alertas** ao cruzar limites (como o semaphore faz).
- [ ] **i18n**: en/pt-BR.

## Longo prazo

- [ ] **Variante horizontal** do Maul (lâminas para os lados, tipo bastão deitado).
- [ ] **Releases assinados** + workflow de CI (Win/macOS/Linux) publicando
      instaladores no GitHub Releases.
- [ ] **Assinatura Authenticode do instalador Windows** via SignPath Foundation
      (grátis p/ open source, mas exige cadastro + aprovação). Hoje o `.exe` sai
      sem assinatura e dispara o aviso do SmartScreen. Ao aprovar: criar os
      secrets `SIGNPATH_API_TOKEN` e `SIGNPATH_ORGANIZATION_ID`, e reativar no
      `.github/workflows/release.yml` o passo de assinatura — assinando o `.exe`
      com a SignPath **antes** de gerar o `.sig` minisign do updater (a
      Authenticode altera os bytes do PE e invalidaria uma assinatura feita antes).
- [ ] **Stream Deck / barra de menu** como saída alternativa.
- [ ] **Modo "statusline"** para terminal, sem app externo.

## Riscos a monitorar

- O endpoint de limites é **não oficial**; se a Anthropic mudar os headers ou o
  fluxo OAuth, o `limits.rs` precisará de ajuste. Manter um *fallback* claro e uma
  mensagem de erro amigável.
- Empacotamento macOS exige `.icns` (rode `npm run icon`) e, idealmente,
  notarização para evitar o aviso de "app danificado".
