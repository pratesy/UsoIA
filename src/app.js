"use strict";

/* ============================================================
   UsoAI — widget de limites do Claude Code
   Mostra o % REAL de uso (sessão de 5h e semana de 7d) + reset,
   lendo os headers anthropic-ratelimit-unified-* via comando Tauri
   `get_limits` (que usa um token OAuth do `claude setup-token`).
   Fora do app, roda em modo demo para pré-visualizar as skins.
   ============================================================ */

const TAURI = window.__TAURI__;
const invoke = TAURI ? TAURI.core.invoke : null;
const IS_APP = !!invoke;

const DEFAULTS = {
  skin: "plano",        // plano | sabre | kart | minimal
  driver: "weekly",     // qual janela enche sabre/kart: weekly | session
  accentS: "#2f7bff",   // cor da sessão
  accentW: "#ff4cd0",   // cor da semana
  invert: false,        // modo inverso: começa cheio e vai apagando
  noBg: false,          // sem o cartão de fundo (só a skin)
  orient: "v",          // orientação: v (em pé) | h (deitada)
  size: "medium",
  opacity: 35,
  interval: 60,         // segundos (cada leitura custa ~1 token Haiku)
  alertThreshold: 90,   // % que dispara o alerta
  showNumbers: true,
  alwaysTop: true,
  textHover: true,      // ocultar textos — só o visual por padrão; hover mostra tudo
  userResized: false,   // true quando o usuário redimensionou manualmente
};
const SIZE_SCALE = { small: 0.85, medium: 1.0, large: 1.18 };

let prefs = loadPrefs();
let timer = null;
let authToken = "";   // token em memória (vem do cofre do SO, nunca do localStorage)

function loadPrefs() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem("usoai.prefs") || "{}") }; }
  catch { return { ...DEFAULTS }; }
}
function savePrefs() { localStorage.setItem("usoai.prefs", JSON.stringify(prefs)); }

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const bind = (n) => $(`[data-bind="${n}"]`);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

function pctText(util) { return Math.round(clamp(util, 0, 1) * 100) + "%"; }

// "Reinicia em 4h 33min" (relativo) — para a sessão de 5h
function resetRelative(epoch) {
  if (!epoch) return "";
  const ms = epoch * 1000 - Date.now();
  if (ms <= 0) return "reiniciando…";
  const min = Math.round(ms / 60000);
  const h = Math.floor(min / 60), m = min % 60;
  return h > 0 ? `${h}h ${m}min` : ` ${m}min`;
}
// "Reinicia sex., 18:00" (absoluto) — para a semana de 7d
function resetAbsolute(epoch) {
  if (!epoch) return "";
  const d = new Date(epoch * 1000);
  const wd = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
  const t = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return ` ${wd}., ${t}`;
}
// versão curta p/ sabre/kart
function resetShort(epoch, weekly) {
  if (!epoch) return "";
  if (weekly) {
    const d = new Date(epoch * 1000);
    return d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "") +
      " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  const min = Math.round((epoch * 1000 - Date.now()) / 60000);
  if (min <= 0) return "agora";
  const h = Math.floor(min / 60), m = min % 60;
  return h > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${m}min`;
}

/* ---------- preferências → UI ---------- */
function applyTheme() {
  const root = document.documentElement.style;
  root.setProperty("--accent-s", prefs.accentS);
  root.setProperty("--accent-w", prefs.accentW);
  root.setProperty("--accent", prefs.accentS); // chrome geral (engrenagem, título)
  root.setProperty("--accent-soft", `color-mix(in srgb, ${prefs.accentS} 55%, white)`);
  root.setProperty("--bg-alpha", (prefs.opacity / 100).toFixed(2));
  root.setProperty("--scale", SIZE_SCALE[prefs.size] || 1);

  $$(".skin").forEach((el) => (el.hidden = el.dataset.skin !== prefs.skin));
  $("#widget").classList.toggle("hide-numbers", !prefs.showNumbers);
  $("#widget").classList.toggle("bare", prefs.noBg);
  $("#widget").classList.toggle("orient-h", prefs.orient === "h");
  $("#widget").classList.toggle("text-hover", prefs.textHover);

  setSeg("skin", prefs.skin);
  setSeg("driver", prefs.driver);
  setSeg("size", prefs.size);
  setSeg("orient", prefs.orient);
  $("#accentS").value = prefs.accentS;
  $("#accentW").value = prefs.accentW;
  $("#invert").checked = prefs.invert;
  $("#noBg").checked = prefs.noBg;
  $("#opacity").value = prefs.opacity;
  $("#interval").value = prefs.interval;
  bind("interval-label").textContent = prefs.interval + "s";
  $("#threshold").value = prefs.alertThreshold;
  bind("threshold-label").textContent = prefs.alertThreshold + "%";
  $("#showNumbers").checked = prefs.showNumbers;
  $("#textHover").checked = prefs.textHover;
  $("#alwaysTop").checked = prefs.alwaysTop;
  autoSize();   // ajusta a janela ao tamanho da skin (fora do modo edição)
}
function setSeg(group, val) {
  $$(`.seg[data-group="${group}"] button`).forEach((b) =>
    b.classList.toggle("active", b.dataset.val === val));
}
function tokenStatus() {
  const el = bind("token-status");
  if (!el) return;
  el.textContent = authToken
    ? "✓ token guardado no cofre do sistema"
    : (IS_APP ? "nenhum token salvo" : "modo navegador (demonstração)");
}

/* ---------- pintar uma barra (cor muda perto do limite) ---------- */
function paintBar(el, util) {
  if (!el) return;
  const pct = clamp(util, 0, 1) * 100;
  el.style.width = pct.toFixed(1) + "%";
  el.classList.toggle("warn", pct >= 90 && pct < 95);
  el.classList.toggle("crit", pct >= 95);
}

/* ============================================================
   Render
   ============================================================ */
function render(d) {
  if (!d || d.ok === false) {
    const msg = d && d.error ? d.error : "configure o token em ⚙";
    bind("stamp").textContent = msg;
    return;
  }
  const s = clamp(d.session_util || 0, 0, 1);
  const w = clamp(d.weekly_util || 0, 0, 1);

  // PLANO (igual ao painel /usage)
  if (bind("s-pct")) bind("s-pct").textContent = pctText(s);
  if (bind("w-pct")) bind("w-pct").textContent = pctText(w);
  paintBar(bind("s-bar"), s);
  paintBar(bind("w-bar"), w);
  if (bind("s-reset")) bind("s-reset").textContent = resetShort(d.session_reset, false);
  if (bind("w-reset")) bind("w-reset").textContent = resetShort(d.weekly_reset, true);

  // MINIMAL
  if (bind("s-pct2")) bind("s-pct2").textContent = Math.round(s * 100) + "%";
  if (bind("w-pct2")) bind("w-pct2").textContent = Math.round(w * 100) + "%";
  paintBar(bind("s-bar2"), s);
  paintBar(bind("w-bar2"), w);

  // SABRE / KART — usam a janela escolhida em "Métrica"
  const weekly = prefs.driver === "weekly";
  const util = weekly ? w : s;
  const reset = weekly ? d.weekly_reset : d.session_reset;
  const label = weekly ? "W" : "S";

  const scale = SIZE_SCALE[prefs.size] || 1;
  const inv = prefs.invert;
  const fr = (u) => (inv ? 1 - u : u);                    // posição do kart
  const op = (u) => (inv ? (0.3 + 0.7 * (1 - u)) : 1);    // opacidade do kart
  // preenchimento do sabre: cresce/encolhe com o uso (ou inverso). Piso 0.05
  // para a lâmina nunca desaparecer completamente — sempre uma chama na base.
  const fill = (u) => clamp(inv ? 1 - u : u, 0.05, 1);
  const setBlade = (sel, u) => $$(sel).forEach((el) =>
    el.style.setProperty("--fill", fill(u).toFixed(2)));

  // sabre simples (usa a janela escolhida) — recebe a cor dessa janela
  const driverColor = weekly ? prefs.accentW : prefs.accentS;
  const sabreEl = $(".skin-sabre"), kartEl = $(".skin-kart");
  [sabreEl, kartEl].forEach((el) => {
    if (!el) return;
    el.style.setProperty("--accent", driverColor);
    el.style.setProperty("--accent-soft", `color-mix(in srgb, ${driverColor} 55%, white)`);
  });

  setBlade('[data-blade="single"]', util);
  setBlade('[data-blade="s"]', s);   // duo — sessão
  setBlade('[data-blade="w"]', w);   // duo — semana
  setBlade('[data-blade="ms"]', s);  // maul — cima (sessão)
  setBlade('[data-blade="mw"]', w);  // maul — baixo (semana)
  // expõe --fill-up/down no .maul-stage para o CSS do tip-pct poder seguir a ponta
  const maulStage = $(".maul-stage");
  if (maulStage) {
    maulStage.style.setProperty("--fill-up",   fill(s).toFixed(2));
    maulStage.style.setProperty("--fill-down",  fill(w).toFixed(2));
  }

  const setT = (n, t) => { const el = bind(n); if (el) el.textContent = t; };
  const sp = Math.round(s * 100) + "%", wp = Math.round(w * 100) + "%";
  setT("duo-s-pct", sp); setT("duo-w-pct", wp);
  setT("duo-s-reset", resetRelative(d.session_reset));
  setT("duo-w-reset", resetAbsolute(d.weekly_reset));
  setT("maul-s-pct", sp); setT("maul-w-pct", wp);
  setT("maul-s-reset", "S ↻ " + resetShort(d.session_reset, false));
  setT("maul-w-reset", "W ↻ " + resetShort(d.weekly_reset, true));

  const kart = bind("kart");
  if (kart) {
    const x = fr(util) * (180 * scale - 26 * scale);
    kart.style.transform = `translateX(${x.toFixed(1)}px)`;
    kart.style.opacity = op(util).toFixed(2);
  }
  // ponta = % usada ; base = data/horário de reset
  $$('[data-bind="driver-value"]').forEach((el) => (el.textContent = Math.round(util * 100) + "%"));
  $$('[data-bind="driver-reset"]').forEach((el) =>
    (el.textContent = weekly ? resetAbsolute(reset) : resetRelative(reset)));

  // alerta global
  const peak = Math.max(s, w) * 100;
  $("#widget").classList.toggle("alert", peak >= prefs.alertThreshold);
  $("#widget").classList.toggle("over", peak >= 100);

  bind("stamp").textContent = "atualizado " +
    new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/* ============================================================
   Dados
   ============================================================ */
let mockT = 0;
function mockLimits() {
  mockT += 1;
  const s = clamp(0.16 + mockT * 0.03, 0, 1);   // sobe p/ você ver animar
  const w = clamp(0.09 + mockT * 0.012, 0, 1);
  const nextFriday = (() => {
    const d = new Date(); d.setHours(18, 0, 0, 0);
    d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7));
    return Math.floor(d.getTime() / 1000);
  })();
  return {
    ok: true,
    session_util: s, session_reset: Math.floor(Date.now() / 1000) + 4 * 3600 + 33 * 60,
    weekly_util: w, weekly_reset: nextFriday,
    status: "allowed",
  };
}

async function refresh() {
  try {
    let d;
    if (!IS_APP) d = mockLimits();
    else if (!authToken) d = { ok: false, error: "configure o token em ⚙" };
    else d = await invoke("get_limits", { token: authToken });
    render(d);
  } catch (e) {
    bind("stamp").textContent = "erro ao ler limites";
    console.error(e);
  }
}
function restartTimer() {
  if (timer) clearInterval(timer);
  timer = setInterval(refresh, prefs.interval * 1000);
}

/* ---------- lembrar onde o widget foi largado ---------- */
async function restoreWindowPos() {
  try {
    const raw = localStorage.getItem("usoai.winpos");
    if (!raw) return;
    const { x, y } = JSON.parse(raw);
    const { getCurrentWindow, PhysicalPosition } = TAURI.window;
    await getCurrentWindow().setPosition(new PhysicalPosition(x, y));
  } catch (e) { console.error(e); }
}
let posTimer = null;
async function watchWindowPos() {
  try {
    await TAURI.window.getCurrentWindow().onMoved(({ payload }) => {
      clearTimeout(posTimer);
      posTimer = setTimeout(() => {
        localStorage.setItem("usoai.winpos", JSON.stringify({ x: payload.x, y: payload.y }));
      }, 300);
    });
  } catch (e) { console.error(e); }
}

/* ---------- lembrar tamanho manual do widget ---------- */
async function restoreWindowSize() {
  if (!prefs.userResized) return;
  try {
    const raw = localStorage.getItem("usoai.winsize");
    if (!raw) return;
    const { w, h } = JSON.parse(raw);
    if (w > 0 && h > 0) sizeWindow(w, h);
  } catch (e) { console.error(e); }
}
let sizeTimer = null;
function watchWindowSize() {
  if (!IS_APP) return;
  const ro = new ResizeObserver(([entry]) => {
    if (!prefs.userResized) return; // ignora redimensionamentos automáticos
    const { width, height } = entry.contentRect;
    // ajusta --scale proporcionalmente à altura da janela vs tamanho base da skin
    const orient = prefs.orient === "h" ? "h" : "v";
    const baseH = (WIN_SIZE[prefs.skin]?.[orient]?.[1] ?? 152) * (SIZE_SCALE[prefs.size] || 1);
    const newScale = clamp(height / baseH, 0.4, 3.0);
    document.documentElement.style.setProperty("--scale", newScale.toFixed(3));
    // persiste o novo tamanho (debounce 400ms)
    clearTimeout(sizeTimer);
    sizeTimer = setTimeout(() => {
      localStorage.setItem("usoai.winsize", JSON.stringify({ w: Math.round(width), h: Math.round(height) }));
    }, 400);
  });
  ro.observe(document.documentElement);
}

/* ============================================================
   Interações
   ============================================================ */
/* Tamanho de descanso da janela (logical px) por skin e orientação [larg, alt].
   Ajuste fino aqui se algo cortar. */
const WIN_SIZE = {
  plano:   { v: [236, 104], h: [300, 88] },
  minimal: { v: [110, 58],  h: [234, 46] },
  sabre:   { v: [100, 172], h: [172, 84] },
  duo:     { v: [160, 172], h: [185, 132] },
  maul:    { v: [82,  210], h: [210, 96] },
  kart:    { v: [216, 82],  h: [216, 82] },
};
const SETTINGS_SIZE = [300, 448];

function sizeWindow(w, h) {
  if (!IS_APP) return;
  try {
    const { getCurrentWindow, LogicalSize } = TAURI.window;
    getCurrentWindow().setSize(new LogicalSize(Math.round(w), Math.round(h)));
  } catch (e) { console.error(e); }
}
function autoSize() {
  if (!IS_APP || !$("#settings").hidden) return;   // não encolhe durante a edição
  if (prefs.userResized) return;                   // respeita resize manual do usuário
  const s = SIZE_SCALE[prefs.size] || 1;
  const conf = WIN_SIZE[prefs.skin] || WIN_SIZE.plano;
  const [w, h] = conf[prefs.orient] || conf.v;
  sizeWindow(w * s, h * s);
}
function openSettings(open) {
  $("#settings").hidden = !open;
  if (open) sizeWindow(SETTINGS_SIZE[0], SETTINGS_SIZE[1]);
  else autoSize();
}

function wire() {
  $("#btnSettings").addEventListener("click", () => openSettings(true));
  $("#btnClose").addEventListener("click", () => openSettings(false));
  $("#btnHide").addEventListener("click", async () => {
    if (IS_APP) { try { await TAURI.window.getCurrentWindow().hide(); } catch (e) { console.error(e); } }
  });

  $$(".seg").forEach((seg) => seg.addEventListener("click", (ev) => {
    const btn = ev.target.closest("button"); if (!btn) return;
    prefs[seg.dataset.group] = btn.dataset.val;
    // clicar em P/M/G descarta o resize manual e volta ao tamanho automático
    if (seg.dataset.group === "size") prefs.userResized = false;
    savePrefs(); applyTheme(); refresh();
  }));

  async function setToken(v) {
    v = (v || "").trim();
    if (!v) return;
    authToken = v;
    if (IS_APP) { try { await invoke("save_token", { token: v }); } catch (err) { console.error(err); } }
    $("#token").value = "";   // não deixa o segredo no DOM
    tokenStatus();
  }

  $("#token").addEventListener("change", async (e) => {
    await setToken(e.target.value);
    refresh();
  });
  $("#testToken").addEventListener("click", async (e) => {
    e.preventDefault();
    await setToken($("#token").value);
    if (!IS_APP) { bind("hint").textContent = "No app, isto consulta a Anthropic de verdade."; return; }
    if (!authToken) { bind("hint").textContent = "Cole um token primeiro."; return; }
    bind("hint").textContent = "testando…";
    try {
      const d = await invoke("get_limits", { token: authToken });
      bind("hint").textContent = d.ok
        ? `OK! Sessão ${Math.round(d.session_util * 100)}% · Semana ${Math.round(d.weekly_util * 100)}%`
        : "Falhou: " + (d.error || "erro");
      if (d.ok) render(d);
    } catch (err) { bind("hint").textContent = "Falhou: " + err; }
  });
  $("#clearToken").addEventListener("click", async (e) => {
    e.preventDefault();
    authToken = "";
    if (IS_APP) { try { await invoke("clear_token"); } catch (err) { console.error(err); } }
    tokenStatus();
    bind("hint").textContent = "Token removido.";
    refresh();
  });

  $("#accentS").addEventListener("input", (e) => { prefs.accentS = e.target.value; savePrefs(); applyTheme(); refresh(); });
  $("#accentW").addEventListener("input", (e) => { prefs.accentW = e.target.value; savePrefs(); applyTheme(); refresh(); });
  $("#invert").addEventListener("change", (e) => { prefs.invert = e.target.checked; savePrefs(); refresh(); });
  $("#noBg").addEventListener("change", (e) => { prefs.noBg = e.target.checked; savePrefs(); applyTheme(); });
  $("#opacity").addEventListener("input", (e) => { prefs.opacity = +e.target.value; savePrefs(); applyTheme(); });
  $("#interval").addEventListener("input", (e) => {
    prefs.interval = +e.target.value;
    bind("interval-label").textContent = prefs.interval + "s";
    savePrefs(); restartTimer();
  });
  $("#threshold").addEventListener("input", (e) => {
    prefs.alertThreshold = +e.target.value;
    bind("threshold-label").textContent = prefs.alertThreshold + "%";
    savePrefs(); refresh();
  });
  $("#showNumbers").addEventListener("change", (e) => { prefs.showNumbers = e.target.checked; savePrefs(); applyTheme(); });
  $("#textHover").addEventListener("change", (e) => { prefs.textHover = e.target.checked; savePrefs(); applyTheme(); });
  $("#alwaysTop").addEventListener("change", async (e) => {
    prefs.alwaysTop = e.target.checked; savePrefs();
    if (IS_APP) { try { await invoke("set_always_on_top", { value: prefs.alwaysTop }); } catch (err) { console.error(err); } }
  });

  // handle de resize no canto inferior direito
  const resizeHandle = $("#resize-handle");
  if (resizeHandle && IS_APP) {
    resizeHandle.addEventListener("mousedown", () => {
      try {
        prefs.userResized = true;
        savePrefs();
        const win = TAURI.window.getCurrentWindow();
        const dir = TAURI.window.ResizeDirection?.SouthEast ?? "SouthEast";
        win.startResizeDragging(dir);
      } catch (e) { console.error(e); }
    });
    resizeHandle.addEventListener("dblclick", () => {
      prefs.userResized = false;
      savePrefs();
      localStorage.removeItem("usoai.winsize");
      autoSize();
    });
  }

  bind("hint").textContent = IS_APP
    ? "Arraste pelo corpo. ⚙ personaliza · — esconde (fica na bandeja)."
    : "Pré-visualização no navegador (dados de demonstração).";
}

/* ============================================================
   Início
   ============================================================ */
window.addEventListener("DOMContentLoaded", async () => {
  wire();
  applyTheme();
  if (IS_APP) {
    if (prefs.token) {
      try { await invoke("save_token", { token: prefs.token }); } catch {}
      delete prefs.token; savePrefs();
    }
    try { authToken = await invoke("load_token"); } catch {}
    if (prefs.alwaysTop) { try { await invoke("set_always_on_top", { value: true }); } catch {} }
    await restoreWindowPos();
    await restoreWindowSize();
    watchWindowPos();
    watchWindowSize();
    if (!authToken) openSettings(true);
  }
  tokenStatus();
  await refresh();
  restartTimer();
});
// fim
