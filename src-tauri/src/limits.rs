//! Limites reais do plano (sessão de 5h e semana de 7d).
//!
//! Os números que o painel `/usage` mostra (% usado + horário de reset) NÃO
//! ficam nas transcrições locais — eles vêm da Anthropic. Toda resposta da API
//! traz headers `anthropic-ratelimit-unified-*` com a utilização (0.0–1.0) e o
//! reset (epoch) de cada janela. Fazemos uma chamada barata (1 token Haiku) com
//! um token OAuth de longa duração (gerado por `claude setup-token`) e lemos
//! esses headers — tanto no 200 quanto no 429 eles vêm preenchidos.

use serde::Serialize;

#[derive(Serialize, Clone, Default)]
pub struct Limits {
    pub ok: bool,
    pub error: Option<String>,
    pub session_util: f64,  // 0.0–1.0  (janela de 5h)
    pub session_reset: i64, // epoch (s)
    pub weekly_util: f64,   // 0.0–1.0  (janela de 7d, todos os modelos)
    pub weekly_reset: i64,  // epoch (s)
    pub status: String,     // allowed | allowed_warning | exceeded | ...
}

impl Limits {
    pub fn err(msg: &str) -> Self {
        Limits {
            ok: false,
            error: Some(msg.to_string()),
            ..Default::default()
        }
    }
}

/// Versão do Claude Code usada no User-Agent (a API espera esse formato).
const UA: &str = "claude-code/2.0.37";

pub fn fetch(token: &str) -> Limits {
    let token = token.trim();
    if token.is_empty() {
        return Limits::err("sem token");
    }

    let body = serde_json::json!({
        "model": "claude-haiku-4-5-20251001",
        "max_tokens": 1,
        "messages": [{ "role": "user", "content": "x" }]
    });

    let req = ureq::post("https://api.anthropic.com/v1/messages")
        .set("Authorization", &format!("Bearer {}", token))
        .set("anthropic-version", "2023-06-01")
        .set("anthropic-beta", "oauth-2025-04-20")
        .set("User-Agent", UA)
        .set("Content-Type", "application/json")
        .timeout(std::time::Duration::from_secs(20));

    let resp = match req.send_json(body) {
        Ok(r) => r,
        // 429 (rate limited) ainda traz os headers de utilização — aproveitamos.
        Err(ureq::Error::Status(code, r)) => {
            if r.header("anthropic-ratelimit-unified-5h-utilization").is_some() {
                r
            } else if code == 401 || code == 403 {
                return Limits::err("token inválido ou expirado");
            } else {
                return Limits::err(&format!("HTTP {}", code));
            }
        }
        Err(e) => return Limits::err(&format!("falha de rede: {}", e)),
    };

    from_headers(&resp)
}

fn from_headers(r: &ureq::Response) -> Limits {
    let f = |name: &str| r.header(name).and_then(|v| v.trim().parse::<f64>().ok());
    let i = |name: &str| r.header(name).and_then(|v| v.trim().parse::<i64>().ok());

    Limits {
        ok: true,
        error: None,
        session_util: f("anthropic-ratelimit-unified-5h-utilization").unwrap_or(0.0),
        session_reset: i("anthropic-ratelimit-unified-5h-reset").unwrap_or(0),
        weekly_util: f("anthropic-ratelimit-unified-7d-utilization").unwrap_or(0.0),
        weekly_reset: i("anthropic-ratelimit-unified-7d-reset").unwrap_or(0),
        status: r
            .header("anthropic-ratelimit-unified-status")
            .unwrap_or("")
            .to_string(),
    }
}
