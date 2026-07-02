//! Armazenamento do token OAuth no **cofre do sistema operacional**:
//! Keychain (macOS), Credential Manager (Windows) ou Secret Service/libsecret
//! (Linux, via `keyring`).
//!
//! Se o cofre não estiver disponível (ex.: Linux sem um serviço de chaveiro
//! rodando), caímos num arquivo local com permissão `0600` — o mesmo
//! comportamento de fallback que o próprio Claude Code usa no Linux.

use keyring::Entry;
use std::fs;
use std::path::PathBuf;

const SERVICE: &str = "com.gyga.usoai";
const USER: &str = "oauth-token";

fn entry() -> Option<Entry> {
    Entry::new(SERVICE, USER).ok()
}

fn fallback_path() -> Option<PathBuf> {
    let dir = dirs::config_dir()?.join("usoai");
    let _ = fs::create_dir_all(&dir);
    Some(dir.join("token"))
}

/// Salva o token. Tenta o cofre do SO; em caso de falha, arquivo `0600`.
pub fn save(token: &str) -> Result<(), String> {
    if let Some(e) = entry() {
        if e.set_password(token).is_ok() {
            // remove um eventual fallback antigo para não deixar cópia em texto
            if let Some(p) = fallback_path() {
                let _ = fs::remove_file(p);
            }
            return Ok(());
        }
    }
    let path = fallback_path().ok_or("sem diretório de configuração")?;
    fs::write(&path, token).map_err(|e| e.to_string())?;
    set_perms_600(&path);
    Ok(())
}

/// Lê o token (cofre → fallback). Devolve "" se não houver.
pub fn load() -> String {
    if let Some(e) = entry() {
        if let Ok(t) = e.get_password() {
            return t;
        }
    }
    if let Some(p) = fallback_path() {
        if let Ok(t) = fs::read_to_string(p) {
            return t.trim().to_string();
        }
    }
    String::new()
}

/// Apaga o token de ambos os lugares.
pub fn clear() {
    if let Some(e) = entry() {
        let _ = e.delete_password();
    }
    if let Some(p) = fallback_path() {
        let _ = fs::remove_file(p);
    }
}

#[cfg(unix)]
fn set_perms_600(path: &PathBuf) {
    use std::os::unix::fs::PermissionsExt;
    let _ = fs::set_permissions(path, fs::Permissions::from_mode(0o600));
}
#[cfg(not(unix))]
fn set_perms_600(_path: &PathBuf) {}
