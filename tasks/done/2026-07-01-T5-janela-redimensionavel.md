# T5 — Janela redimensionável pelo usuário

**Data:** 2026-07-01  
**Status:** aguardando aprovação  
**Tipo:** feature

## Contexto

O Tauri já tem `resizable: true` e `minWidth/minHeight` definidos no
`tauri.conf.json`. Porém, como `decorations: false`, a janela não tem alças
de resize visíveis — o usuário não consegue arrastar para redimensionar.

Além disso, `autoSize()` re-impõe o tamanho fixo de `WIN_SIZE` sempre que a
skin muda, apagando qualquer resize manual feito via debug ou API.

O objetivo é: permitir que o usuário arraste a janela para qualquer tamanho e o
conteúdo se adapte, com a escala (`--scale`) respondendo ao tamanho real.

## Escopo

### O que será feito

- Adicionar um handle de resize visível no canto inferior direito da janela
  (`#resize-handle`), que aciona o resize nativo do Tauri via
  `startDragging()` ou `startResizeDragging()`.
- Quando o usuário redimensionar manualmente, desativar o `autoSize()` e salvar
  o tamanho em `localStorage` (`usoai.winsize`).
- `--scale` passa a ser calculado a partir da altura real da janela, não só de
  `prefs.size`.
- Um duplo-clique no handle restaura o tamanho padrão da skin ativa
  (`WIN_SIZE[skin]`).

### Fora de escopo

- Não adicionar decorações nativas do OS (`decorations` permanece `false`).
- Não remover o seletor P/M/G do painel ⚙ — ele vira um "ponto de partida"
  para o tamanho inicial.
- Não implementar resize horizontal separado do vertical nesta task.

## Especificação técnica

### Arquivos a modificar

- `src/index.html` — adicionar `#resize-handle`.
- `src/styles.css` — estilo do handle (alça sutil no canto).
- `src/app.js` — lógica de resize nativo, `ResizeObserver`, cálculo de
  `--scale` dinâmico, salvar/restaurar tamanho.
- `src-tauri/capabilities/default.json` — verificar se
  `window.startResizeDragging` precisa de permissão explícita.

### Abordagem

#### Handle de resize — HTML

```html
<!-- dentro de #widget, após .stamp -->
<div id="resize-handle" title="Arrastar para redimensionar · duplo-clique para restaurar"></div>
```

#### Handle — CSS

```css
#resize-handle {
  position: fixed;
  bottom: 2px; right: 2px;
  width: 12px; height: 12px;
  cursor: se-resize;
  opacity: 0;
  transition: opacity 0.15s;
  /* ícone sutil: três linhas diagonais */
  background: repeating-linear-gradient(
    -45deg,
    var(--fg-dim) 0 1px, transparent 1px 4px
  );
}
#widget:hover #resize-handle { opacity: 0.4; }
#resize-handle:hover { opacity: 0.8 !important; }
```

#### Resize nativo — JS

```js
// No wire():
const handle = $("#resize-handle");
if (handle && IS_APP) {
  handle.addEventListener("mousedown", () => {
    // Tauri v2: startResizeDragging com direção SE
    const win = TAURI.window.getCurrentWindow();
    win.startResizeDragging(TAURI.window.ResizeDirection.SouthEast);
    prefs.userResized = true;  // flag: não sobrescrever com autoSize
    savePrefs();
  });
  handle.addEventListener("dblclick", () => {
    prefs.userResized = false;
    savePrefs();
    autoSize();  // restaura tamanho padrão da skin
  });
}
```

#### `autoSize()` — respeitar resize manual

```js
function autoSize() {
  if (settingsOpen) return;
  if (prefs.userResized) return;  // não sobrescrever resize manual
  // ... lógica atual ...
}
```

#### `--scale` dinâmico via `ResizeObserver`

```js
// No boot (após IS_APP):
if (IS_APP) {
  const ro = new ResizeObserver(([entry]) => {
    const h = entry.contentRect.height;
    const baseH = WIN_SIZE[prefs.skin]?.v[1] ?? 152;
    const dynScale = clamp(h / baseH, 0.6, 2.0);
    document.documentElement.style.setProperty("--scale", dynScale.toFixed(3));
  });
  ro.observe(document.documentElement);
}
```

Isso faz o conteúdo crescer/encolher proporcionalmente ao tamanho real da janela,
independente do seletor P/M/G.

#### `localStorage` — salvar tamanho no `usoai.winpos`

Já existe `watchWindowPos()` que salva posição. Adicionar `watchWindowSize()` de
forma análoga, debounce 300ms, gravando `{w, h}` em `localStorage["usoai.winsize"]`.
Restaurar no boot via `win.setSize(new LogicalSize(w, h))` antes de `autoSize()`.

#### `capabilities/default.json`

Verificar se `startResizeDragging` precisa de entrada. Na v2 do Tauri, funções de
janela invocadas via JS geralmente precisam de:

```json
"window:startResizeDragging": {}
```

Adicionar se necessário.

### Gotchas / riscos

- **`TAURI.window.ResizeDirection`**: confirmar que esse enum existe na versão
  do `@tauri-apps/api` instalada. Se não existir, usar string `"SouthEast"`.
- **`ResizeObserver` e `--scale`**: o `applyTheme()` seta `--scale` a partir de
  `SIZE_SCALE[prefs.size]`. Após o `ResizeObserver`, `applyTheme()` pode
  sobrescrever o valor dinâmico. Fazer o `ResizeObserver` ter prioridade quando
  `prefs.userResized === true` — e em `applyTheme()`, pular o `setProperty(--scale)`
  nesse caso.
- **Cross-platform**: `startResizeDragging` é suportado no Windows, macOS e Linux
  pelo Tauri v2. Verificar na release notes da versão usada.
- **Orientação horizontal**: o `ResizeObserver` usa a `height` atual para calcular
  scale. No modo `orient-h`, a referência muda. Usar `WIN_SIZE[skin][orient === "h" ? "h" : "v"][1]`
  como base.

## Critérios de aceite

- [ ] Handle visível no hover no canto inferior direito.
- [ ] Arrastar o handle redimensiona a janela nativamente.
- [ ] Conteúdo escala proporcionalmente ao novo tamanho.
- [ ] Duplo-clique no handle restaura o tamanho padrão da skin.
- [ ] Tamanho manual persiste após fechar e reabrir o app.
- [ ] Trocar de skin **não** sobrescreve o tamanho manual.
- [ ] P/M/G ainda funciona como "ponto de partida" (reseta `userResized = false`
  ao clicar).

## Perguntas em aberto

- Confirmar o enum `ResizeDirection` disponível na versão do `@tauri-apps/api`
  em uso no projeto (verificar `package.json`).
