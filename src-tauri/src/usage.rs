//! Leitura e agregação do uso do Claude Code.
//!
//! O Claude Code grava transcrições em `~/.claude/projects/**/*.jsonl`.
//! Cada linha é um objeto JSON; as que têm `message.usage` carregam a
//! contagem de tokens. Aqui agregamos duas janelas:
//!   - `session`: o arquivo .jsonl mais recente (sessão atual)
//!   - `weekly`:  tudo nos últimos 7 dias, em todos os projetos.

use chrono::{DateTime, Duration, Utc};
use serde::Serialize;
use std::collections::HashMap;
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use walkdir::WalkDir;

#[derive(Default, Serialize, Clone)]
pub struct Tokens {
    pub input: u64,
    pub output: u64,
    pub cache_creation: u64,
    pub cache_read: u64,
}

impl Tokens {
    pub fn total(&self) -> u64 {
        self.input + self.output + self.cache_creation + self.cache_read
    }
    fn add_usage(&mut self, u: &serde_json::Value) {
        self.input += u.get("input_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
        self.output += u.get("output_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
        self.cache_creation += u
            .get("cache_creation_input_tokens")
            .and_then(|v| v.as_u64())
            .unwrap_or(0);
        self.cache_read += u
            .get("cache_read_input_tokens")
            .and_then(|v| v.as_u64())
            .unwrap_or(0);
    }
}

#[derive(Default, Serialize, Clone)]
pub struct Bucket {
    pub tokens: Tokens,
    pub total: u64,
    pub cost_usd: f64,
    pub messages: u64,
    pub by_model: HashMap<String, u64>,
}

impl Bucket {
    fn finalize(&mut self) {
        self.total = self.tokens.total();
    }
}

#[derive(Serialize, Clone)]
pub struct UsageReport {
    pub session: Bucket,
    pub weekly: Bucket,
    pub session_id: Option<String>,
    pub updated_at: String,
    /// `true` quando nenhum diretório de transcrições foi encontrado.
    pub no_data: bool,
}

/// Preço aproximado por 1M de tokens: (input, output, cache_write, cache_read).
/// Usado só para a estimativa de custo opcional na UI.
fn price_per_million(model: &str) -> (f64, f64, f64, f64) {
    let m = model.to_lowercase();
    if m.contains("opus") {
        (15.0, 75.0, 18.75, 1.50)
    } else if m.contains("sonnet") {
        (3.0, 15.0, 3.75, 0.30)
    } else if m.contains("haiku") {
        (0.80, 4.0, 1.0, 0.08)
    } else {
        (0.0, 0.0, 0.0, 0.0)
    }
}

fn entry_cost(t: &Tokens, model: &str) -> f64 {
    let (i, o, cw, cr) = price_per_million(model);
    (t.input as f64 * i
        + t.output as f64 * o
        + t.cache_creation as f64 * cw
        + t.cache_read as f64 * cr)
        / 1_000_000.0
}

/// Diretórios candidatos onde o Claude Code guarda transcrições.
fn project_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    // Permite sobrescrever via env (mesma convenção do Claude Code).
    if let Ok(custom) = std::env::var("CLAUDE_CONFIG_DIR") {
        dirs.push(PathBuf::from(custom).join("projects"));
    }
    if let Some(home) = dirs::home_dir() {
        dirs.push(home.join(".claude").join("projects"));
        dirs.push(home.join(".config").join("claude").join("projects"));
    }
    dirs.into_iter().filter(|d| d.exists()).collect()
}

/// Lê e agrega o uso. Nunca entra em pânico: erros de leitura/JSON são ignorados.
pub fn collect() -> UsageReport {
    let now: DateTime<Utc> = Utc::now();
    let week_start = now - Duration::days(7);

    let mut session = Bucket::default();
    let mut weekly = Bucket::default();
    let mut session_id: Option<String> = None;

    let dirs = project_dirs();
    if dirs.is_empty() {
        let mut r = UsageReport {
            session,
            weekly,
            session_id: None,
            updated_at: now.to_rfc3339(),
            no_data: true,
        };
        r.session.finalize();
        r.weekly.finalize();
        return r;
    }

    // Coleta todos os .jsonl e encontra o mais recente (= sessão atual).
    let mut files: Vec<(PathBuf, std::time::SystemTime)> = Vec::new();
    for dir in &dirs {
        for entry in WalkDir::new(dir).into_iter().filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) == Some("jsonl") {
                let mtime = entry
                    .metadata()
                    .ok()
                    .and_then(|m| m.modified().ok())
                    .unwrap_or(std::time::UNIX_EPOCH);
                files.push((path.to_path_buf(), mtime));
            }
        }
    }

    let latest = files
        .iter()
        .max_by_key(|(_, m)| *m)
        .map(|(p, _)| p.clone());

    for (path, _) in &files {
        let is_latest = latest.as_ref() == Some(path);
        let file = match File::open(path) {
            Ok(f) => f,
            Err(_) => continue,
        };
        for line in BufReader::new(file).lines().filter_map(|l| l.ok()) {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }
            let val: serde_json::Value = match serde_json::from_str(line) {
                Ok(v) => v,
                Err(_) => continue,
            };
            let msg = match val.get("message") {
                Some(m) => m,
                None => continue,
            };
            let usage = match msg.get("usage") {
                Some(u) if u.is_object() => u,
                _ => continue,
            };

            let model = msg
                .get("model")
                .and_then(|m| m.as_str())
                .unwrap_or("unknown")
                .to_string();

            // tokens só desta entrada (para custo/model)
            let mut entry_tokens = Tokens::default();
            entry_tokens.add_usage(usage);
            let entry_total = entry_tokens.total();
            let cost = entry_cost(&entry_tokens, &model);

            // janela semanal por timestamp
            let in_week = val
                .get("timestamp")
                .and_then(|t| t.as_str())
                .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                .map(|t| t.with_timezone(&Utc) >= week_start)
                .unwrap_or(false);

            if in_week {
                weekly.tokens.add_usage(usage);
                weekly.messages += 1;
                weekly.cost_usd += cost;
                *weekly.by_model.entry(model.clone()).or_insert(0) += entry_total;
            }

            if is_latest {
                session.tokens.add_usage(usage);
                session.messages += 1;
                session.cost_usd += cost;
                *session.by_model.entry(model.clone()).or_insert(0) += entry_total;
                if session_id.is_none() {
                    session_id = val
                        .get("sessionId")
                        .and_then(|s| s.as_str())
                        .map(|s| s.to_string());
                }
            }
        }
    }

    session.finalize();
    weekly.finalize();

    UsageReport {
        session,
        weekly,
        session_id,
        updated_at: now.to_rfc3339(),
        no_data: false,
    }
}
