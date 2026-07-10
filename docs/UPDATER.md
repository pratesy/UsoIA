# Auto-update (updater)

O UsoAI se atualiza sozinho: ao abrir, o app (em build de release) consulta o
`latest.json` da última release no GitHub, e se houver versão nova ele baixa,
verifica a assinatura, instala e reinicia. Tudo em segundo plano — se estiver
offline ou der qualquer erro, o widget abre normalmente e só ignora o update.

Peças envolvidas:

- **Back-end** — `tauri-plugin-updater` registrado em `src-tauri/src/lib.rs`; a
  checagem roda em `setup()` só com `#[cfg(not(debug_assertions))]` (nunca em
  `tauri dev`).
- **Config** — `src-tauri/tauri.conf.json`: `bundle.createUpdaterArtifacts = true`
  e `plugins.updater` com o endpoint do GitHub e a **chave pública**.
- **CI** — `.github/workflows/release.yml` assina os artefatos e publica o
  `latest.json` junto da release.

## Setup único (você precisa fazer isto uma vez)

### 1. Gerar o par de chaves

Na raiz do projeto:

```bash
npx tauri signer generate -w ~/.tauri/usoai.key
```

Ele mostra/gera duas coisas:

- **chave privada** (o conteúdo do arquivo `.key`) + a **senha** que você definir;
- **chave pública** (string base64 impressa no terminal).

> A chave privada e a senha assinam cada release. Se você perder a privada, os
> apps já instalados **param de aceitar updates** (a pública embutida não bate
> com nenhuma nova). Guarde com cuidado.

### 2. Colar a chave pública na config

Em `src-tauri/tauri.conf.json`, troque o placeholder:

```json
"plugins": {
  "updater": {
    "endpoints": ["https://github.com/pratesy/UsoIA/releases/latest/download/latest.json"],
    "pubkey": "SUBSTITUA_PELA_SUA_CHAVE_PUBLICA_DO_UPDATER"
  }
}
```

pela chave pública gerada no passo 1. Commite essa mudança.

### 3. Adicionar os secrets no GitHub

Em **Settings → Secrets and variables → Actions**, crie:

| Secret | Valor |
| --- | --- |
| `TAURI_SIGNING_PRIVATE_KEY` | conteúdo inteiro do arquivo `usoai.key` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | a senha definida no passo 1 |

(Os secrets `SIGNPATH_API_TOKEN` e `SIGNPATH_ORGANIZATION_ID`, da assinatura
Authenticode do Windows, continuam necessários como antes.)

## Como lançar uma versão

O workflow alinha a versão do app à tag automaticamente, então basta:

```bash
git tag v1.6.0
git push origin v1.6.0
```

O CI então:

1. injeta `1.6.0` em `tauri.conf.json` antes de compilar (garante que o app
   reporte a mesma versão da tag — evita loop de update);
2. builda e assina Windows (SignPath → depois minisign), macOS e Linux;
3. gera o `latest.json` com a assinatura de cada plataforma;
4. publica a release (deixa de ser draft).

Apps instalados pegam a nova versão na próxima abertura.

## Gotchas

- **Versão = tag.** Nunca gere um instalador cuja versão seja menor que a do
  `latest.json` apontando pra ele — vira loop infinito de update. O passo
  "Alinhar versão com a tag" existe justamente pra isso; não o remova.
- **Windows: ordem da assinatura.** A minisign do updater é feita **depois** da
  SignPath. A Authenticode altera os bytes do `.exe`; assinar antes invalidaria
  a verificação do updater no download.
- **Linux `.deb`/`.rpm` não se auto-atualizam.** O updater do Tauri só sabe
  substituir **AppImage**. Quem instalou via pacote atualiza manualmente. Por
  isso a release publica também o `.AppImage`.
- **Build local agora exige as chaves.** Como `createUpdaterArtifacts = true`,
  um `npm run build` na sua máquina falha sem `TAURI_SIGNING_PRIVATE_KEY` e
  `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` no ambiente. Exporte as duas antes de
  buildar localmente (ou rode via CI).
- **Endpoint `releases/latest`.** Só aponta pra release marcada como *latest*
  (publicada, não-draft, não-prerelease). O job `publish-release` cuida disso.
