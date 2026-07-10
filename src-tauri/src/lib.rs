mod limits;
mod secret;
mod usage;

use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{Manager, WebviewWindow};

/// Uso local em tokens (lido das transcrições .jsonl). Opcional.
#[tauri::command]
fn get_usage() -> usage::UsageReport {
    usage::collect()
}

/// Limites reais do plano (% + reset de sessão e semana) via OAuth.
/// Roda em thread separada porque a chamada de rede é bloqueante.
#[tauri::command]
async fn get_limits(token: String) -> limits::Limits {
    tauri::async_runtime::spawn_blocking(move || limits::fetch(&token))
        .await
        .unwrap_or_else(|_| limits::Limits::err("erro interno"))
}

/// Guarda o token no cofre do SO (ou fallback 0600).
#[tauri::command]
fn save_token(token: String) -> Result<(), String> {
    secret::save(token.trim())
}

/// Lê o token salvo ("" se não houver).
#[tauri::command]
fn load_token() -> String {
    secret::load()
}

/// Remove o token salvo.
#[tauri::command]
fn clear_token() {
    secret::clear()
}

/// Fixa / desafixa o "sempre no topo".
#[tauri::command]
fn set_always_on_top(window: WebviewWindow, value: bool) -> Result<(), String> {
    window.set_always_on_top(value).map_err(|e| e.to_string())
}

/// Mostra ou esconde o widget.
fn toggle_window(window: &WebviewWindow) {
    if window.is_visible().unwrap_or(true) {
        let _ = window.hide();
    } else {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Traz o widget de volta ao centro da tela. Serve para resgatar a janela
/// quando ela ficou fora da área visível (ex.: atrás da barra lateral direita).
/// Ao mover, o handler `onMoved` do front-end persiste a nova posição sozinho.
fn center_window(window: &WebviewWindow) {
    let _ = window.show();
    let _ = window.center();
    let _ = window.set_focus();
}

/// Auto-update silencioso: checa o `latest.json` no GitHub Releases, e se houver
/// versão nova, baixa, instala e reinicia. Só roda em builds de release — em
/// `tauri dev` não há app empacotado para atualizar. Falhas (offline, etc.) são
/// ignoradas de propósito: nunca deve travar a abertura do widget.
#[cfg(not(debug_assertions))]
async fn try_update(handle: tauri::AppHandle) -> tauri_plugin_updater::Result<()> {
    use tauri_plugin_updater::UpdaterExt;
    if let Some(update) = handle.updater()?.check().await? {
        update.download_and_install(|_chunk, _total| {}, || {}).await?;
        handle.restart();
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            get_usage,
            get_limits,
            save_token,
            load_token,
            clear_token,
            set_always_on_top
        ])
        .setup(|app| {
            // Ícone na bandeja com menu mínimo.
            let show = MenuItem::with_id(app, "show", "Mostrar / Esconder", true, None::<&str>)?;
            let center = MenuItem::with_id(app, "center", "Centralizar na tela", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Sair", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &center, &quit])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("UsoAI — uso do Claude Code")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            toggle_window(&w);
                        }
                    }
                    "center" => {
                        if let Some(w) = app.get_webview_window("main") {
                            center_window(&w);
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;

            // Verifica atualizações em segundo plano (apenas em release).
            #[cfg(not(debug_assertions))]
            {
                let handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    if let Err(e) = try_update(handle).await {
                        eprintln!("updater: {e}");
                    }
                });
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o UsoAI");
}
