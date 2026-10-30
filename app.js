/* مليونير كرة القدم — منطق اللعبة */
(function () {
"use strict";
const $ = (s, r = document) => r.querySelector(s);
const CFG = window.CFG || {};
const LADDER = [100,200,300,500,1000,2000,4000,8000,16000,32000,64000,125000,250000,500000,1000000];
const SAFE = [4, 9]; // بعد السؤال 5 و 10
const RANKS = [[0,"مبتدئ"],[1000,"هاوي"],[10000,"لاعب"],[50000,"محترف"],[200000,"نجم"],[1000000,"أسطورة اللعبة"]];
const DAILY_GEMS = [50,75,100,150,200,300,500];
const LL = {
  fifty: { ic: "½", nm: "50:50", price: 40 },
  aud:   { ic: "👥", nm: "الجمهور", price: 40 },
  call:  { ic: "📞", nm: "صديق", price: 40 },
  skip:  { ic: "⏭", nm: "تخطي", price: 60 }
};
const LET = ["أ","ب","ج","د"];

/* ---------- أدوات ---------- */
const today = () => { const d = new Date(); return d.getFullYear() + "-" + (d.getMonth()+1) + "-" + d.getDate(); };
const yesterday = () => { const d = new Date(Date.now() - 864e5); return d.getFullYear() + "-" + (d.getMonth()+1) + "-" + d.getDate(); };
const fmt = n => n >= 1e6 ? "مليون" : n >= 1000 ? (n/1000) + " ألف" : String(n);
const num = n => Number(n).toLocaleString("en-US");
const shuffle = a => { a = a.slice(); for (let i = a.length-1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [a[i],a[j]] = [a[j],a[i]]; } return a; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const hashStr = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
const qid = r => hashStr(r[0]);
async function sha(s) {
  try { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("fm:" + s));
    return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2,"0")).join(""); }
  catch (e) { return "h" + hashStr("fm:" + s); }
}
const rankOf = p => { let r = RANKS[0][1]; RANKS.forEach(x => { if (p >= x[0]) r = x[1]; }); return r; };
const firebaseOn = () => CFG.FIREBASE && CFG.FIREBASE.apiKey;

/* ---------- صوت واهتزاز ---------- */
let AC;
function beep(f, d, type, when) {
  if (!S || !S.set.sound) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = type || "sine"; o.frequency.value = f;
    const t = AC.currentTime + (when || 0);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.18, t + .02);
    g.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + d + .02);
  } catch (e) {}
}
const sfx = {
  tap: () => beep(520, .06, "triangle"),
  ok: () => { beep(660,.12,"triangle"); beep(880,.12,"triangle",.12); beep(1175,.2,"triangle",.24); },
  no: () => { beep(220,.25,"sawtooth"); beep(150,.35,"sawtooth",.2); },
  tick: () => beep(900, .04, "square"),
  win: () => [523,659,784,1047,1319].forEach((f,i) => beep(f,.18,"triangle",i*.12))
};
function crowd(dur, when, vol, lo, hi) {   // صوت جمهور مُصطنع (ضجيج مفلتر)
  if (!S || !S.set.sound) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const n = Math.floor(AC.sampleRate * dur), buf = AC.createBuffer(1, n, AC.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (Math.random() < .12 ? 1 : .45);
    const src = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain(), t = AC.currentTime + (when || 0);
    src.buffer = buf; f.type = "bandpass"; f.Q.value = .8; f.frequency.setValueAtTime(lo, t); f.frequency.linearRampToValueAtTime(hi, t + dur);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .15); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(AC.destination); src.start(t);
  } catch (e) {}
}
sfx.cheer = () => { crowd(1.6, 0, .5, 1500, 2600); beep(784, .15, "triangle", .05); beep(988, .25, "triangle", .2); };
sfx.groan = () => { crowd(1.3, 0, .35, 700, 220); beep(300, .7, "sawtooth", .05); beep(180, .8, "sawtooth", .35); };
sfx.bigcheer = () => { crowd(3.2, 0, .7, 1300, 3000); crowd(2.6, .5, .5, 2000, 1200); sfx.win(); };
const vib = ms => { try { if (S && S.set.vibrate && navigator.vibrate) navigator.vibrate(ms); } catch (e) {} };

/* ---------- الحفظ ---------- */
let SES = lsGet("fm_session", null);
let S = null;
const defData = () => ({
  gems: 200, points: 0, xp: 0, lvl: 1,
  stats: { games: 0, correct: 0, wrong: 0, best: 0, millions: 0, streak: 0, bestStreak: 0, dailyDone: 0 },
  daily: { last: "", streak: 0, claimedToday: false },
  mis: { date: "", correct: 0, c10: false, c25: false },
  dc: "", inv: { fifty: 0, aud: 0, call: 0, skip: 0 },
  seen: [], recent: [], hist: [], ach: {}, set: { sound: true, vibrate: true }
});
function loadData() {
  if (!SES) return;
  S = Object.assign(defData(), lsGet("fm_data_" + SES.id, {}));
  S.set = Object.assign({ sound: true, vibrate: true }, S.set);
  S.stats = Object.assign(defData().stats, S.stats);
  S.inv = Object.assign(defData().inv, S.inv);
  S.lvl = clamp(S.lvl || 1, 1, 4);
  if (S.mis.date !== today()) S.mis = { date: today(), correct: 0, c10: false, c25: false };
  if (S.daily.last !== today()) S.daily.claimedToday = false;
}
const save = () => { if (SES && S) lsSet("fm_data_" + SES.id, S); };

/* ---------- الأسئلة: ذكاء اصطناعي (أونلاين) + 200 سؤال محفوظ (أوفلاين) ---------- */
const BUNDLED = window.BUNDLED_QUESTIONS || [];
const AICFG = CFG.AI || {};
const CACHE_MAX = 200;
let REMOTE = lsGet("fm_remote", []);
let CACHE = lsGet("fm_cache", []);          // آخر/أهم 200 سؤال محفوظين للعب بدون نت
const BUF = {};                              // أسئلة جاهزة مسبقاً لكل مستوى صعوبة
const inflight = {};
let aiDownUntil = 0, filling = false, fillRuns = 0;
const online = () => navigator.onLine !== false;
const aiOn = () => AICFG.ENABLED !== false && AICFG.ENDPOINT;
const remoteConfigured = () => CFG.QUESTIONS_URL && !/USERNAME|REPO/.test(CFG.QUESTIONS_URL);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lvOf = d => d <= 3 ? 1 : d <= 7 ? 2 : 3;          // تحويل صعوبة 1-10 لمستوى 1-3 للأسئلة المدمجة
const rawD = r => r[6] || (r[5] * 3 - 1);
function validQ(r) { return Array.isArray(r) && r.length >= 6 && r.slice(0,5).every(x => typeof x === "string" && x.trim()) && new Set(r.slice(1,5).map(x => x.trim())).size === 4; }
async function refreshQuestions() {
  if (!online() || !remoteConfigured()) return false;
  try {
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 8000);
    const res = await fetch(CFG.QUESTIONS_URL + "?t=" + Date.now(), { signal: ctl.signal, cache: "no-store" });
    clearTimeout(to);
    if (!res.ok) return false;
    const data = await res.json();
    const arr = (Array.isArray(data) ? data : data.questions || []).filter(validQ);
    if (arr.length >= 10) { REMOTE = arr; lsSet("fm_remote", arr); return true; }
  } catch (e) {}
  return false;
}
function poolAll() {
  const m = new Map();
  BUNDLED.concat(REMOTE).forEach(r => { if (validQ(r)) m.set(qid(r), r); });
  return Array.from(m.values());
}

/* --- الكاش (200 سؤال) --- */
function cacheSave() { lsSet("fm_cache", CACHE); }
function cacheAdd(r, d, fill) {
  if (!validQ(r)) return;
  const id = qid(r), had = CACHE.findIndex(x => qid(x) === id);
  if (had >= 0) { if (fill) return; CACHE.splice(had, 1); }
  if (CACHE.length >= CACHE_MAX) {
    const bi = CACHE.findIndex(x => x[7] === "b");       // نشيل المدمجة المحشوّة الأول
    if (bi >= 0) CACHE.splice(bi, 1); else if (fill) return; else CACHE.shift();
  }
  CACHE.push([r[0], r[1], r[2], r[3], r[4], r[5] || lvOf(d), d || rawD(r)]);
  cacheSave();
}
function padCache() {            // نضمن إن فيه 200 سؤال جاهزين حتى لو أول مرة وبدون نت
  if (CACHE.length >= CACHE_MAX) return;
  const have = new Set(CACHE.map(qid));
  const extra = shuffle(poolAll()).filter(r => !have.has(qid(r))).slice(0, CACHE_MAX - CACHE.length).map(r => [r[0], r[1], r[2], r[3], r[4], r[5], rawD(r), "b"]);
  CACHE = extra.concat(CACHE); cacheSave();
}

/* --- توليد الأسئلة بالذكاء الاصطناعي --- */
const TOPICS = ["كأس العالم","دوري أبطال أوروبا","الدوري الإنجليزي الممتاز","الدوري الإسباني","الدوري الإيطالي","الدوري الألماني","الدوري المصري","كأس الأمم الأفريقية","الأهلي والزمالك","المنتخب المصري","اللاعبون العرب","صفقات الانتقالات","الكرة الذهبية","الهدّافون التاريخيون","المدربون","الملاعب والأندية الكبرى","الأرقام القياسية","كأس أمم أوروبا وكوبا أمريكا","أساطير الكرة","قوانين اللعبة","الدوري الفرنسي والبرتغالي","نهائيات البطولات الكبرى","كأس العالم للأندية"];
const DESC = d => d <= 2 ? "easy (a casual fan knows it)" : d <= 4 ? "medium (most fans would hesitate)" : d <= 6 ? "hard (most dedicated fans get it wrong; needs specific details such as years, scores, minor players, records)" : d <= 8 ? "very hard (only serious football followers know it: obscure finals, lesser-known players, exact stats, managers, transfer fees)" : "extremely hard (expert level: football historians and statisticians only; very specific facts)";
async function aiAsk(d, n) {
  const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)];
  const avoid = (S && S.recent ? S.recent.slice(-20) : []).map(r => r[0].slice(0, 70)).join(" | ");
  const prompt = `Write ${n} NEW multiple-choice trivia questions in Arabic about MEN'S football only.\nDifficulty: ${d}/10 — ${DESC(d)}. Main topic: ${topic} (you may vary a little).\nIMPORTANT: do NOT write famous or basic questions (e.g. who won the last World Cup, which club Messi or Ronaldo plays for, number of players on a team). Make the questions genuinely challenging for the stated difficulty.\nRules: each question has exactly ONE undeniably correct answer; use only facts you are 100% sure of; no questions about the future or anything dated/uncertain; wrong answers must be plausible but clearly wrong; keep every answer under 40 characters; write in simple Arabic; do not repeat these already-asked questions: ${avoid || "none"}.\nOutput ONLY a JSON array (no markdown, no explanation) where each item is: ["السؤال","الإجابة الصحيحة","خطأ 1","خطأ 2","خطأ 3"].`;
  const headers = { "Content-Type": "application/json" };
  if (AICFG.API_KEY) headers.Authorization = "Bearer " + AICFG.API_KEY;
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 20000);
  try {
    const res = await fetch(AICFG.ENDPOINT, { method: "POST", headers, signal: ctl.signal, body: JSON.stringify({ model: AICFG.MODEL || "openai", seed: Math.floor(Math.random() * 1e9), temperature: 1, messages: [{ role: "system", content: "You are a precise football quiz writer. You answer with raw JSON only." }, { role: "user", content: prompt }] }) });
    if (!res.ok) throw new Error("http " + res.status);
    const j = await res.json();
    let txt = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || (typeof j === "string" ? j : "");
    txt = String(txt).replace(/```json|```/g, "");
    const arr = JSON.parse(txt.slice(txt.indexOf("["), txt.lastIndexOf("]") + 1));
    const seen = new Set(S ? S.seen : []), out = [], ids = new Set();
    arr.forEach(it => {
      if (it && !Array.isArray(it) && typeof it === "object") it = [it.q || it.question, it.correct || it.answer, ...(it.wrong || [])];
      if (!Array.isArray(it)) return;
      it = it.slice(0, 5).map(x => String(x == null ? "" : x).trim());
      if (!validQ(it.concat([1])) || it[0].length < 8 || !/[\u0600-\u06FF]/.test(it[0]) || it.some(x => x.length > 70)) return;
      const r = [it[0], it[1], it[2], it[3], it[4], lvOf(d), d];
      const id = qid(r); if (seen.has(id) || ids.has(id)) return;
      ids.add(id); out.push(r);
    });
    if (!out.length) throw new Error("empty");
    return out;
  } finally { clearTimeout(to); }
}
function generate(d, n) {
  if (inflight[d]) return inflight[d];
  const p = (async () => {
    try { const qs = await aiAsk(d, n); (BUF[d] = BUF[d] || []).push(...qs); return qs.length; }
    catch (e) { aiDownUntil = Date.now() + 45000; return 0; }
    finally { delete inflight[d]; }
  })();
  return (inflight[d] = p);
}
function aiReady() { return online() && aiOn() && Date.now() >= aiDownUntil; }
function prefetch(d) { if (!aiReady()) return; [clamp(d + 1, 1, 10), d].forEach(x => { if (!(BUF[x] && BUF[x].length)) generate(x, 3); }); }
async function fillCache() {        // في الخلفية: نملّي الـ200 سؤال بأسئلة جديدة من الذكاء الاصطناعي
  if (filling || !aiReady() || !S) return;
  filling = true;
  try {
    const order = [2, 5, 8, 3, 6, 9, 4, 7, 10, 1];
    for (let k = 0; k < 8 && fillRuns < 40 && aiReady() && online(); k++, fillRuns++) {
      if (CACHE.filter(x => x[7] !== "b").length >= CACHE_MAX) break;
      const d = order[fillRuns % order.length];
      try { const qs = await aiAsk(d, 5); qs.forEach(r => cacheAdd(r, d, true)); } catch (e) { aiDownUntil = Date.now() + 45000; break; }
      await new Promise(r => setTimeout(r, 1500));
    }
  } finally { filling = false; }
}

/* --- اختيار السؤال --- */
const usedSet = () => (G && G.usedIds) || (M && M.used) || new Set();
function takeBuf(d) {
  const arr = BUF[d] || [];
  while (arr.length) { const r = arr.shift(); if (!S.seen.includes(qid(r)) && !usedSet().has(qid(r))) return r; }
  return null;
}
function pickPool(d) {            // أسئلة مدمجة/GitHub لم تظهر للاعب من قبل
  const lv = lvOf(d), pool = poolAll(), seen = new Set(S.seen);
  const free = r => !seen.has(qid(r)) && !usedSet().has(qid(r));
  let c = pool.filter(r => r[5] === lv && free(r));
  if (!c.length) c = pool.filter(r => r[5] > lv && free(r));
  if (!c.length) c = pool.filter(r => Math.abs(r[5] - lv) <= 1 && free(r));
  return c.length ? c[Math.floor(Math.random() * c.length)] : null;
}
function pickCache(d) {           // أوفلاين: من الـ200 المحفوظين (بيتكرروا)
  if (!CACHE.length) padCache();
  let pool = CACHE.filter(r => !usedSet().has(qid(r)));
  if (!pool.length) { usedSet().clear(); pool = CACHE.slice(); }
  if (!pool.length) return null;
  pool.sort((x, y) => Math.abs(rawD(x) - d) - Math.abs(rawD(y) - d) + (Math.random() - .5) * 2.5);
  return pool[0];
}
function curD() {
  let d;
  if (G.mode === "cup") d = G.stD + G.rs - G.ws * .5;
  else d = 2 + S.lvl + (G.right - G.wrong);
  return clamp(Math.round(d), 1, 10);
}
async function fetchQuestion(g) {
  const d = curD(); g.d = d; g.maxD = Math.max(g.maxD || 0, d);
  let raw = null, src = "ai";
  if (online()) {
    raw = takeBuf(d);
    if (!raw && aiReady()) { await generate(d, g.mode === "speed" ? 4 : 3); if (G !== g) return null; raw = takeBuf(d); }
    if (!raw) { raw = pickPool(d); src = "pool"; }
  }
  if (!raw) { raw = pickCache(d); src = "cache"; }
  if (!raw) return null;
  g.usedIds.add(qid(raw));
  const q = norm(raw, d); q.src = src; return q;
}
function norm(r, d) {
  const opts = shuffle([0,1,2,3]).map(i => ({ t: r[1 + i], ok: i === 0 }));
  return { raw: r, id: qid(r), q: r[0], opts, ans: opts.findIndex(o => o.ok), l: r[5], d: d || rawD(r) };
}
function markServed(q) {
  if (!online()) return;                      // أوفلاين: مفيش تسجيل، الأسئلة المحفوظة بتتكرر
  S.seen = S.seen.filter(x => x !== q.id); S.seen.push(q.id);
  if (S.seen.length > 5000) S.seen = S.seen.slice(-5000);
  S.recent = S.recent.filter(r => qid(r) !== q.id); S.recent.push(q.raw);
  if (S.recent.length > 100) S.recent = S.recent.slice(-100);
  cacheAdd(q.raw, q.d);
  save();
}

/* ---------- واجهة عامة ---------- */
let screen = "splash", timerId = null, G = null;
const app = $("#app");
function stopTimer() { if (timerId) { clearInterval(timerId); timerId = null; } mClear(); }
function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.remove("hidden"); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.add("hidden"), 2400); }
function modal(html) { const m = $("#modal"); m.innerHTML = '<div class="mbox">' + html + "</div>"; m.classList.remove("hidden"); }
function closeModal() { $("#modal").classList.add("hidden"); $("#modal").innerHTML = ""; }
function confetti() {
  const d = document.createElement("div"); d.className = "conf";
  const cols = ["#ffe58a","#f5b727","#38d4ff","#2f7bff","#22c55e","#fff"];
  for (let i = 0; i < 60; i++) { const e = document.createElement("i"); e.style.left = Math.random()*100 + "%"; e.style.background = cols[i % cols.length]; e.style.animationDuration = (1.8 + Math.random()*1.8) + "s"; e.style.animationDelay = Math.random()*.6 + "s"; d.appendChild(e); }
  document.body.appendChild(d); setTimeout(() => d.remove(), 4500);
}
function netBadge() { return online() ? '<span class="net on">● أونلاين</span>' : '<span class="net off">● أوفلاين</span>'; }

function header() {
  const name = SES ? SES.name : "";
  return `<div class="top">
    <button class="avatar" data-go="profile">👑</button>
    <div class="who"><b>${esc(name)}</b><small>★ ${rankOf(S.points)}</small></div>
    <div class="gems"><span>💎</span><span>${num(S.gems)}</span><button class="plus" data-go="rewards">+</button></div>
    <button class="ibtn" data-go="board">🏆</button>
    <button class="ibtn" data-go="settings">⚙</button>
  </div>`;
}
function nav(cur) {
  const it = [["home","🏠","الرئيسية"],["challenges","⚡","التحديات"],["arena","🌍","البطولات"],["board","🏆","نتائجي"],["profile","👤","حسابي"]];
  return '<div class="nav">' + it.map(x => `<button data-go="${x[0]}" class="${cur === x[0] ? "on" : ""}"><span>${x[1]}</span>${x[2]}</button>`).join("") + "</div>";
}
function go(name, p) { stopTimer(); closeModal(); screen = name; window.scrollTo(0, 0); (R[name] || R.home)(p); }

/* ---------- الشاشات ---------- */
const R = {};

R.splash = function () {
  app.innerHTML = '<div class="splash"><img src="icon.png" alt=""></div>';
  setTimeout(() => { loadData(); if (SES && S) { dailyLogin(); go("home"); if (SES.guest && (!SES.name || SES.name === "ضيف")) askName(true); } else go("login"); }, 1100);
};

/* تسجيل الدخول */
R.login = function (tab) {
  tab = tab || "in";
  app.innerHTML = `<div class="login">
    <img src="icon.png" alt="مليونير كرة القدم">
    <div class="tabs"><button data-tab="in" class="${tab==="in"?"on":""}">تسجيل الدخول</button><button data-tab="up" class="${tab==="up"?"on":""}">حساب جديد</button></div>
    ${tab==="up" ? '<input class="inp" id="nm" placeholder="الاسم في اللعبة" maxlength="20" autocomplete="nickname">' : ""}
    <input class="inp" id="em" type="email" placeholder="البريد الإلكتروني" dir="ltr" autocomplete="email">
    <input class="inp" id="pw" type="password" placeholder="كلمة السر (6 أحرف على الأقل)" dir="ltr" autocomplete="${tab==="up"?"new-password":"current-password"}">
    <div class="err" id="err"></div>
    <button class="btn" id="sub">${tab==="up" ? "إنشاء الحساب" : "دخول"}</button>
    ${tab==="in" && firebaseOn() ? '<button class="btn ghost" id="forgot" style="margin-top:8px">نسيت كلمة السر؟</button>' : ""}
    <div class="or">أو</div>
    <input class="inp" id="gn" placeholder="اكتب اسمك عشان تلعب كضيف" maxlength="20" autocomplete="nickname">
    <button class="btn sec" id="guest">👤 العب كضيف</button>
    <p class="mut" style="margin-top:14px">${netBadge()}</p>
  </div>`;
  app.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => R.login(b.dataset.tab));
  $("#guest").onclick = () => { const n = $("#gn").value.trim(); if (n.length < 2) return ($("#err").textContent = "اكتب اسمك الأول (حرفين على الأقل)"); startSession({ id: "guest", name: n, guest: true }); };
  $("#sub").onclick = () => doAuth(tab);
  const f = $("#forgot"); if (f) f.onclick = forgot;
};
const authErr = c => ({ EMAIL_EXISTS: "الإيميل ده مسجل قبل كده", INVALID_LOGIN_CREDENTIALS: "الإيميل أو كلمة السر غلط", INVALID_PASSWORD: "كلمة السر غلط", EMAIL_NOT_FOUND: "مفيش حساب بالإيميل ده", WEAK_PASSWORD: "كلمة السر ضعيفة", INVALID_EMAIL: "الإيميل غير صحيح", TOO_MANY_ATTEMPTS_TRY_LATER: "محاولات كتير، جرّب بعد شوية" }[c] || "حصلت مشكلة، حاول تاني");
async function fbCall(path, body) {
  const r = await fetch("https://identitytoolkit.googleapis.com/v1/" + path + "?key=" + CFG.FIREBASE.apiKey, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json(); if (!r.ok) throw new Error(((j.error && j.error.message) || "").split(" ")[0]); return j;
}
async function doAuth(tab) {
  const em = $("#em").value.trim().toLowerCase(), pw = $("#pw").value, nm = tab === "up" ? $("#nm").value.trim() : "";
  const err = m => { $("#err").textContent = m; };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return err("اكتب إيميل صحيح");
  if (pw.length < 6) return err("كلمة السر لازم 6 أحرف على الأقل");
  if (tab === "up" && nm.length < 2) return err("اكتب اسمك في اللعبة");
  const btn = $("#sub"); btn.disabled = true; err("");
  const accs = lsGet("fm_accounts", {}); const h = await sha(em + "|" + pw);
  try {
    if (firebaseOn() && online()) {
      const j = await fbCall(tab === "up" ? "accounts:signUp" : "accounts:signInWithPassword", { email: em, password: pw, returnSecureToken: true });
      const name = tab === "up" ? nm : (accs[em] && accs[em].name) || em.split("@")[0];
      accs[em] = { h, name, id: j.localId }; lsSet("fm_accounts", accs);
      return startSession({ id: j.localId, email: em, name });
    }
    if (firebaseOn() && !online() && tab === "up") { btn.disabled = false; return err("محتاج نت لإنشاء حساب جديد"); }
    if (tab === "up") {
      if (accs[em]) { btn.disabled = false; return err("الإيميل ده مسجل قبل كده"); }
      accs[em] = { h, name: nm, id: "u" + hashStr(em) }; lsSet("fm_accounts", accs);
      return startSession({ id: accs[em].id, email: em, name: nm });
    }
    if (!accs[em] || accs[em].h !== h) { btn.disabled = false; return err(accs[em] || !firebaseOn() ? "الإيميل أو كلمة السر غلط" : "سجّل دخولك أونلاين أول مرة"); }
    startSession({ id: accs[em].id, email: em, name: accs[em].name });
  } catch (e) { btn.disabled = false; err(authErr(e.message)); }
}
async function forgot() {
  const em = $("#em").value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return ($("#err").textContent = "اكتب إيميلك الأول");
  try { await fbCall("accounts:sendOobCode", { requestType: "PASSWORD_RESET", email: em }); toast("بعتنالك رسالة على الإيميل ✉"); }
  catch (e) { $("#err").textContent = authErr(e.message); }
}
function askName(force) {
  modal(`<h3>✏️ اسمك في اللعبة</h3><p>الاسم ده بيظهر لخصمك في الماتشات.</p><input class="inp" id="nn" maxlength="20" value="${esc(SES.name === "ضيف" ? "" : SES.name)}" placeholder="اكتب اسمك"><div class="err" id="nerr"></div><button class="btn" id="ns">حفظ</button>${force ? "" : '<button class="btn ghost" id="nc">إلغاء</button>'}`);
  $("#ns").onclick = () => { const n = $("#nn").value.trim(); if (n.length < 2) return ($("#nerr").textContent = "اكتب اسم من حرفين على الأقل"); SES.name = n; lsSet("fm_session", SES); closeModal(); toast("اتحفظ الاسم ✓"); if (screen === "home") R.home(); else if (screen === "profile") R.profile(); };
  const c = $("#nc"); if (c) c.onclick = closeModal;
}
function startSession(s) { SES = s; lsSet("fm_session", s); loadData(); save(); dailyLogin(); go("home"); }
function logout() { SES = null; S = null; try { localStorage.removeItem("fm_session"); } catch (e) {} go("login"); }

function dailyLogin() {
  if (S.daily.last === today()) return;
  S.daily.streak = S.daily.last === yesterday() ? S.daily.streak + 1 : 1;
  S.daily.last = today(); S.daily.claimedToday = false; save();
}

/* الرئيسية */
R.home = function () {
  const rows = LADDER.map((v, i) => i).reverse().map(i => {
    const cls = i === 14 ? "mil" : SAFE.includes(i) ? "safe" : "";
    return `<div class="r ${cls}"><span>${i === 14 ? "👑 " : ""}${String(i+1).padStart(2,"0")}</span><span>${fmt(LADDER[i])}${i===14?"":'<i></i>'}</span></div>`;
  }).join("");
  const n = [!S.daily.claimedToday ? "🎁" : ""].join("");
  app.innerHTML = header() + `
    <div class="hero">
      <div class="emb"><div class="tag">اختبر معرفتك.. وكن مليونيراً!</div><img src="icon.png" alt=""></div>
      <div class="ladder">${rows}</div>
    </div>
    <div class="ticker"><span>⚽</span><span>أسئلة كروية</span><span>•</span><span>تحدي المشجعين</span><span>•</span><span>هل أنت جاهز؟</span><span>⚽</span></div>
    <button class="btn big" id="play">▶ ابدأ اللعب</button>
    <div class="tiles">
      <button class="tile" data-go="stats"><div class="ic">📊</div><b>إحصائياتي</b><small>شوف مستواك</small></button>
      <button class="tile" data-go="rewards"><div class="ic">🎁</div><b>المكافآت ${n}</b><small>جوائز وهدايا</small></button>
      <button class="tile" data-go="helps"><div class="ic">💡</div><b>المساعدات</b><small>استخدمها بحكمة</small></button>
    </div>
    <div class="banner"><div class="ic">👑⚽</div><div>ليس فقط عن كرة القدم.. بل عن ذكائك وشغفك بها! <div style="margin-top:4px">${netBadge()}</div></div></div>
  ` + nav("home");
  $("#play").onclick = () => startGame("classic");
  fillCache();
};

/* الإحصائيات */
const ACH = [
  ["first", "🎯", "أول فوز", "أجب بشكل صحيح على سؤال", s => s.stats.correct >= 1],
  ["c50", "⚽", "عاشق الكرة", "50 إجابة صحيحة", s => s.stats.correct >= 50],
  ["c250", "🏅", "خبير الكرة", "250 إجابة صحيحة", s => s.stats.correct >= 250],
  ["st10", "🔥", "سلسلة نارية", "10 إجابات صحيحة متتالية", s => s.stats.bestStreak >= 10],
  ["g10", "🎮", "مدمن اللعب", "العب 10 مباريات", s => s.stats.games >= 10],
  ["mil", "👑", "المليونير", "اوصل لمليون", s => s.stats.millions >= 1]
];
function checkAch() { ACH.forEach(a => { if (!S.ach[a[0]] && a[4](S)) { S.ach[a[0]] = 1; S.gems += 50; toast("🏆 إنجاز جديد: " + a[2] + " (+50 💎)"); } }); }
R.stats = function () {
  const st = S.stats, tot = st.correct + st.wrong, acc = tot ? Math.round(st.correct / tot * 100) : 0;
  const next = RANKS.find(r => r[0] > S.points); const prev = [...RANKS].reverse().find(r => r[0] <= S.points);
  const pct = next ? Math.round((S.points - prev[0]) / (next[0] - prev[0]) * 100) : 100;
  app.innerHTML = header() + `<h2>📊 إحصائياتي</h2>
    <div class="card"><div class="row"><b class="grow">${rankOf(S.points)}</b><span class="pill">${num(S.points)} نقطة</span></div>
      <div class="bar" style="margin-top:10px"><i style="width:${pct}%"></i></div>
      <div class="mut" style="margin-top:6px">${next ? "الرتبة الجاية: " + next[1] + " عند " + num(next[0]) + " نقطة" : "وصلت لأعلى رتبة 👑"}</div></div>
    <div class="grid2">
      <div class="card stat"><b>${st.games}</b><small>مباريات</small></div>
      <div class="card stat"><b>${acc}%</b><small>نسبة الدقة</small></div>
      <div class="card stat"><b>${st.correct}</b><small>إجابات صحيحة</small></div>
      <div class="card stat"><b>${st.wrong}</b><small>إجابات خاطئة</small></div>
      <div class="card stat"><b>${st.best ? fmt(st.best) : "—"}</b><small>أعلى جائزة</small></div>
      <div class="card stat"><b>${st.bestStreak}</b><small>أطول سلسلة صح</small></div>
    </div>
    <h2>🏅 الإنجازات</h2><div class="card">${ACH.map(a => `<div class="ach ${S.ach[a[0]]?"on":""}"><span class="ic">${a[1]}</span><div><b>${a[2]}</b><div class="mut">${a[3]}</div></div></div>`).join("")}</div>
  ` + nav("profile");
};

/* المكافآت */
R.rewards = function () {
  const st = S.daily.streak, idx = (st - 1) % 7;
  const days = DAILY_GEMS.map((g, i) => `<div class="day ${i < idx || (i === idx && S.daily.claimedToday) ? "done" : ""} ${i === idx && !S.daily.claimedToday ? "now" : ""}">يوم ${i+1}<b>${g}</b>💎</div>`).join("");
  const m = S.mis;
  const mis = (key, need, gems, label) => {
    const ok = m.correct >= need, done = m[key];
    return `<div class="row" style="padding:8px 0"><div class="grow"><b>${label}</b><div class="mut">${Math.min(m.correct, need)} / ${need}</div><div class="bar" style="margin-top:4px"><i style="width:${Math.min(100, m.correct/need*100)}%"></i></div></div>
      <button class="btn ${done ? "ghost" : ""}" data-mis="${key}" style="width:auto;padding:8px 14px;font-size:14px" ${!ok || done ? "disabled" : ""}>${done ? "تم ✓" : "+" + gems + " 💎"}</button></div>`;
  };
  app.innerHTML = header() + `<h2>🎁 المكافآت</h2>
    <div class="card"><b>الهدية اليومية</b> <span class="pill">أيام متتالية: ${st}</span><div class="days">${days}</div>
      <button class="btn" id="claim" ${S.daily.claimedToday ? "disabled" : ""}>${S.daily.claimedToday ? "استلمت هدية النهاردة ✓" : "استلم +" + DAILY_GEMS[idx] + " 💎"}</button></div>
    <div class="card"><b>مهام اليوم</b>${mis("c10", 10, 60, "جاوب 10 أسئلة صح")}${mis("c25", 25, 150, "جاوب 25 سؤال صح")}</div>
    <p class="mut" style="text-align:center">اللعبة ترفيهية، والجوائز والأرباح افتراضية داخل اللعبة فقط.</p>
  ` + nav("home");
  $("#claim").onclick = () => { if (S.daily.claimedToday) return; S.gems += DAILY_GEMS[idx]; S.daily.claimedToday = true; save(); sfx.win(); toast("+" + DAILY_GEMS[idx] + " 💎"); R.rewards(); };
  app.querySelectorAll("[data-mis]").forEach(b => b.onclick = () => { const k = b.dataset.mis; const g = k === "c10" ? 60 : 150; if (S.mis[k]) return; S.mis[k] = true; S.gems += g; save(); sfx.win(); toast("+" + g + " 💎"); R.rewards(); });
};

/* المساعدات */
R.helps = function () {
  app.innerHTML = header() + `<h2>💡 المساعدات</h2>
    <p class="mut">في كل مباراة معاك مرة من كل مساعدة. تقدر تشتري زيادة بالجواهر 💎 وتحتفظ بيها.</p>` +
    Object.keys(LL).map(k => `<div class="chal"><div class="ic">${LL[k].ic}</div><div class="t grow"><b>${LL[k].nm}</b><small>${{fifty:"يشيل إجابتين غلط",aud:"الجمهور يصوّت على الإجابة",call:"صديقك يقترح إجابة (مش مضمونة)",skip:"تعدّي السؤال بدون ما تخسر"}[k]}</small><br><small>معاك زيادة: ${S.inv[k]}</small></div><button class="btn" data-buy="${k}">${LL[k].price} 💎</button></div>`).join("") + nav("home");
  app.querySelectorAll("[data-buy]").forEach(b => b.onclick = () => { const k = b.dataset.buy; if (S.gems < LL[k].price) return toast("جواهرك مش كفاية — خدها من المكافآت 🎁"); S.gems -= LL[k].price; S.inv[k]++; save(); sfx.ok(); R.helps(); });
};

/* نتائجي / المتصدرين */
R.board = function () {
  const h = S.hist.slice(0, 15);
  app.innerHTML = header() + `<h2>🏆 سجل نتائجي</h2>
    <div class="card"><div class="row"><div class="grow"><b>${esc(SES.name)}</b><div class="mut">${rankOf(S.points)}</div></div><span class="pill">${num(S.points)} نقطة</span></div></div>
    <div class="card lb">${h.length ? h.map((x, i) => `<div class="r"><span class="n">${i+1}</span><div class="grow"><b>${x.mode}</b><div class="mut">${x.date}</div></div><div style="text-align:left"><b style="color:var(--gold1)">+${num(x.pts)}</b><div class="mut">${x.info}</div></div></div>`).join("") : '<div class="mut" style="text-align:center;padding:16px">لسه ماعبتش أي مباراة — ابدأ دلوقتي!</div>'}</div>
    ${SES.guest ? '<p class="mut" style="text-align:center">سجّل بحساب لحفظ تقدّمك باسمك.</p>' : ""}` + nav("board");
};

/* الحساب */
R.profile = function () {
  app.innerHTML = header() + `<h2>👤 حسابي</h2>
    <div class="card"><div class="row"><div class="avatar">👑</div><div class="grow"><b>${esc(SES.name)}</b><div class="mut" dir="ltr" style="text-align:right">${esc(SES.email || "حساب ضيف")}</div><div class="mut">★ ${rankOf(S.points)}</div></div></div></div>
    <button class="btn sec" id="rn" style="margin-bottom:10px">✏️ غيّر اسمك</button>
    <button class="btn sec" data-go="stats" style="margin-bottom:10px">📊 إحصائياتي والإنجازات</button>
    <button class="btn sec" data-go="rewards" style="margin-bottom:10px">🎁 المكافآت</button>
    <button class="btn sec" data-go="settings" style="margin-bottom:10px">⚙ الإعدادات</button>
    <button class="btn ghost" id="lo">${SES.guest ? "تسجيل حساب / دخول" : "تسجيل الخروج"}</button>` + nav("profile");
  $("#lo").onclick = logout; $("#rn").onclick = () => askName(false);
};

/* الإعدادات */
R.settings = function () {
  const sw = (k, t) => `<div class="sw"><span>${t}</span><button class="tg ${S.set[k] ? "on" : ""}" data-sw="${k}"></button></div>`;
  app.innerHTML = header() + `<h2>⚙ الإعدادات</h2><div class="card">${sw("sound", "🔊 الصوت")}${sw("vibrate", "📳 الاهتزاز")}</div>
    <div class="card"><b>الأسئلة</b><div class="mut" style="margin:6px 0">${netBadge()} — ${online() ? (aiOn() ? "🤖 أسئلة جديدة بالذكاء الاصطناعي بدون تكرار" : "الأسئلة المدمجة") : "بتلعب بالأسئلة المحفوظة"}<br>محفوظ للعب بدون نت: ${CACHE.length} / ${CACHE_MAX} سؤال<br>صعوبتك الحالية: ${S.lvl} (بتزيد مع كل إجابة صح)</div>
      <button class="btn sec" id="setdb2" style="margin-bottom:8px">🌐 رابط الماتشات الأونلاين</button>
      <button class="btn sec" id="upd">🔄 تحديث الأسئلة الآن</button></div>
    <div class="card mut">مليونير كرة القدم — لعبة ترفيهية. الجوائز افتراضية ولا توجد أي جوائز مالية حقيقية. الأسئلة عن كرة القدم للرجال.</div>` + nav("profile");
  app.querySelectorAll("[data-sw]").forEach(b => b.onclick = () => { S.set[b.dataset.sw] = !S.set[b.dataset.sw]; save(); R.settings(); });
  $("#setdb2").onclick = askDbUrl;
  $("#upd").onclick = async () => { if (!online()) return toast("مفيش نت حالياً"); toast("جاري التحديث..."); aiDownUntil = 0; fillRuns = 0; const ok = await refreshQuestions(); fillCache(); toast(ok ? "تم تحديث الأسئلة ✓" : "بنجهّز أسئلة جديدة في الخلفية 🤖"); R.settings(); };
};

/* التحديات */
R.challenges = function () {
  const doneToday = S.dc === today();
  const c = (ic, t, d, id, extra, dis) => `<div class="chal"><div class="ic">${ic}</div><div class="t grow"><b>${t}</b><small>${d}</small></div><button class="btn" data-ch="${id}" ${dis ? "disabled" : ""}>${extra}</button></div>`;
  app.innerHTML = header() + `<h2>⚡ التحديات</h2>` +
    c("📅", "تحدي اليوم", "10 أسئلة — مرة كل يوم — 20 💎 لكل إجابة صح", "daily", doneToday ? "تم ✓" : "العب", doneToday) +
    c("⏱", "تحدي السرعة", "60 ثانية: جاوب أكبر عدد من الأسئلة", "speed", "العب") +
    c("🔥", "تحدي الصمود", "كمّل لحد أول غلطة — كل إجابة صح بنقاط أعلى", "survive", "العب") +
    c("👑", "المليونير الكلاسيكي", "15 سؤال والمساعدات الأربعة", "classic", "العب") + nav("challenges");
  app.querySelectorAll("[data-ch]").forEach(b => b.onclick = () => startGame(b.dataset.ch));
};


/* البطولات: بتصرف فيها الجواهر 💎 */
const CUPS = {
  wc:   { nm: "كأس العالم", ic: "🌍", fee: 150, per: 3, need: 2, stages: [["دور المجموعات", 40], ["دور الـ16", 80], ["ربع النهائي", 150], ["نصف النهائي", 250], ["النهائي", 500]] },
  ucl:  { nm: "دوري أبطال أوروبا", ic: "⭐", fee: 80, per: 3, need: 2, stages: [["دور المجموعات", 30], ["ربع النهائي", 70], ["نصف النهائي", 120], ["النهائي", 250]] },
  afcon:{ nm: "كأس الأمم الأفريقية", ic: "🦁", fee: 50, per: 3, need: 2, stages: [["دور المجموعات", 25], ["نصف النهائي", 60], ["النهائي", 140]] }
};
const stageD = (cup, i) => 3 + Math.round(i * 6 / (cup.stages.length - 1));
R.arena = function () {
  app.innerHTML = header() + `<h2>🌍 البطولات</h2>
    <p class="mut">ادفع جواهرك 💎 وادخل البطولة. في كل دور لازم تجاوب ${CUPS.wc.need} من ${CUPS.wc.per} صح عشان تعدّي — وكل إجابة صح بتخلّي السؤال الجاي أصعب. وكل دور تعدّيه بتاخد جواهر!</p>` +
    duelCard() +
    Object.keys(CUPS).map(k => { const c = CUPS[k], tot = c.stages.reduce((a, x) => a + x[1], 0);
      return `<div class="card"><div class="row"><div class="ic" style="font-size:34px">${c.ic}</div><div class="grow"><b>${c.nm}</b><div class="mut">${c.stages.length} أدوار • الجائزة الكاملة ${tot} 💎</div><div class="mut">${c.stages.map(x => x[0]).join(" ← ")}</div></div></div>
      <button class="btn" data-cup="${k}" style="margin-top:10px" ${S.gems < c.fee ? "disabled" : ""}>ادخل البطولة — ${c.fee} 💎</button></div>`; }).join("") +
    `<button class="btn sec" data-go="helps" style="margin:6px 0 10px">💡 اشترِ مساعدات بالجواهر</button>
    <p class="mut" style="text-align:center">الجواهر بتيجي من الهدية اليومية والمهام واللعب. 🎁</p>` + nav("arena");
  bindDuel();
  app.querySelectorAll("[data-cup]").forEach(b => b.onclick = () => {
    const c = CUPS[b.dataset.cup];
    modal(`<div class="big">${c.ic}</div><h3>${c.nm}</h3><p>رسوم الدخول ${c.fee} 💎. لو خرجت من البطولة بتحتفظ بالجواهر اللي كسبتها في الأدوار اللي عدّيتها.</p><button class="btn" id="y">ادفع وابدأ</button><button class="btn ghost" id="n">لأ</button>`);
    $("#y").onclick = () => { closeModal(); startGame("cup", b.dataset.cup); }; $("#n").onclick = closeModal;
  });
};

/* ---------- اللعب ---------- */
async function startGame(mode, cupId) {
  sfx.tap();
  if (!S) return;
  let cup = null;
  if (mode === "cup") {
    cup = CUPS[cupId];
    if (!cup || S.gems < cup.fee) return toast("جواهرك مش كفاية 💎");
    S.gems -= cup.fee; save();
  }
  if (online() && remoteConfigured() && !startGame.did) { startGame.did = 1; refreshQuestions(); }
  G = { mode, i: 0, q: null, usedIds: new Set(), locked: false, free: { fifty: 1, aud: 1, call: 1, skip: 1 }, score: 0, right: 0, wrong: 0, streak: 0, t: 0, over: false, hidden: [], maxD: 0 };
  if (mode === "speed") G.total = 60;
  if (cup) Object.assign(G, { cup, cupId, stage: 0, qi: 0, rs: 0, ws: 0, cupGems: 0, stD: stageD(cup, 0) });
  go("game");
}
const qTime = () => G.mode === "cup" ? 40 : G.i < 5 ? 30 : G.i < 10 ? 45 : 60;
const llCount = k => G.free[k] + S.inv[k];

R.game = async function () {
  if (!G) return go("home");
  const ref = G;
  if (!G.q) {
    stopTimer();
    app.innerHTML = `<div class="gtop"><button class="ibtn" id="quit">✕</button><div class="prize"><small>${online() ? "🤖 جاري تجهيز سؤال جديد" : "📴 أسئلة محفوظة"}</small><b>⏳</b></div><div class="timer">·</div></div><div class="qbox" style="text-align:center;margin-top:30px">بنجهّز لك السؤال...</div>`;
    $("#quit").onclick = confirmQuit;
    const q = await fetchQuestion(ref);
    if (G !== ref) return;
    if (!q) { G = null; toast("مفيش أسئلة متاحة حالياً"); return go("home"); }
    G.q = q;
  }
  renderQ();
};
function renderQ() {
  const q = G.q, m = G.mode;
  markServed(q); G.hidden = []; G.locked = false; prefetch(G.d);
  const classic = m === "classic", cup = m === "cup";
  const llHtml = (classic || m === "daily" || cup) ? '<div class="ll">' + Object.keys(LL).map(k => `<button data-ll="${k}" ${llCount(k) < 1 ? "disabled" : ""}><span>${LL[k].ic}</span>${LL[k].nm}<em>${llCount(k)}</em></button>`).join("") + "</div>" : "";
  const label = classic ? `السؤال <bdi>${G.i + 1} / 15</bdi>` : cup ? `${G.cup.stages[G.stage][0]} — <bdi>${G.qi + 1} / ${G.cup.per}</bdi>` : m === "daily" ? `السؤال <bdi>${G.i + 1} / 10</bdi>` : m === "speed" ? `صح: ${G.right}` : `سلسلة: ${G.right}`;
  const centre = classic ? `<small>الجائزة الحالية</small><b>${fmt(LADDER[G.i])}</b>` : cup ? `<small>${G.cup.nm}</small><b>${G.cupGems} 💎</b>` : m === "daily" ? `<small>الإجابات الصح</small><b>${G.right}</b>` : m === "speed" ? `<small>النقاط</small><b>${G.score}</b>` : `<small>النقاط</small><b>${num(G.score)}</b>`;
  const dots = `<span class="pill" style="margin-inline-start:6px">🔥 صعوبة ${G.d}/10 ${q.src === "ai" ? "🤖" : q.src === "pool" ? "📚" : "📴"}</span>`;
  app.innerHTML = `<div class="gtop">
      <button class="ibtn" id="quit">✕</button>
      <div class="prize">${centre}</div>
      <div class="timer" id="tm">${m === "speed" ? G.total : qTime()}</div>
    </div>
    <span class="pill qn">${label}</span>${dots}
    <div class="qbox">${esc(q.q)}</div>
    ${llHtml}
    <div class="opts">${q.opts.map((o, i) => `<button class="opt" data-o="${i}"><b>${LET[i]}</b><span class="tx">${esc(o.t)}</span><span class="pc"></span></button>`).join("")}</div>
    ${classic ? '<div class="gfoot"><button class="btn ghost" id="wd">💰 انسحب بـ ' + (G.i ? fmt(LADDER[G.i-1]) : "0") + "</button></div>" : ""}`;
  app.querySelectorAll("[data-o]").forEach(b => b.onclick = () => answer(+b.dataset.o));
  app.querySelectorAll("[data-ll]").forEach(b => b.onclick = () => useLL(b.dataset.ll));
  $("#quit").onclick = () => confirmQuit();
  const wd = $("#wd"); if (wd) wd.onclick = () => { if (!G.i) return; modal(`<h3>تنسحب؟</h3><p>هتاخد ${fmt(LADDER[G.i-1])} وتنهي المباراة.</p><button class="btn" id="y">أيوه، انسحب</button><button class="btn ghost" id="n">كمّل اللعب</button>`); $("#y").onclick = () => { closeModal(); finish("withdraw"); }; $("#n").onclick = closeModal; };
  startQTimer();
}
function startQTimer() {
  stopTimer();
  const tm = $("#tm");
  if (G.mode === "speed") {
    timerId = setInterval(() => { G.total--; tm.textContent = G.total; tm.classList.toggle("low", G.total <= 10); if (G.total <= 10) sfx.tick(); if (G.total <= 0) { stopTimer(); finish("time"); } }, 1000);
  } else {
    G.t = qTime(); tm.textContent = G.t;
    timerId = setInterval(() => { G.t--; tm.textContent = G.t; tm.classList.toggle("low", G.t <= 8); if (G.t <= 5) sfx.tick(); if (G.t <= 0) { stopTimer(); answer(-1); } }, 1000);
  }
}
function confirmQuit() {
  modal(`<h3>خروج؟</h3><p>${G.mode === "classic" ? "لو خرجت دلوقتي هتخسر المباراة (من غير ما تاخد الجائزة)." : G.mode === "cup" ? "هتخسر رسوم الدخول، والجواهر اللي كسبتها في الأدوار اللي عدّيتها محفوظة." : "هيتحسب اللي حققته لحد دلوقتي."}</p><button class="btn" id="y">خروج</button><button class="btn ghost" id="n">كمّل</button>`);
  $("#y").onclick = () => { closeModal(); if (G.mode === "classic" && G.q) { G = null; go("home"); } else if (!G.q && G.mode === "classic") { G = null; go("home"); } else finish("quit"); };
  $("#n").onclick = closeModal;
}
function useLL(k) {
  if (G.locked || llCount(k) < 1) return;
  const q = G.q;
  if (G.free[k] > 0) G.free[k]--; else S.inv[k]--;
  save(); sfx.tap();
  if (k === "fifty") {
    const wrong = shuffle(q.opts.map((o, i) => i).filter(i => i !== q.ans)).slice(0, 2);
    wrong.forEach(i => { G.hidden.push(i); const b = app.querySelector(`[data-o="${i}"]`); if (b) b.classList.add("gone"); });
  } else if (k === "skip") {
    G.q = null; return R.game();
  } else if (k === "aud") {
    const strength = clamp(.8 - q.d * .05, .3, .78);
    let c = Math.round((strength + Math.random() * .15) * 100); c = Math.min(c, 90);
    const left = q.opts.map((o, i) => i).filter(i => i !== q.ans && !G.hidden.includes(i));
    let rest = 100 - c; const pc = {}; pc[q.ans] = c;
    left.forEach((i, idx) => { const v = idx === left.length - 1 ? rest : Math.round(Math.random() * rest * .7); pc[i] = v; rest -= v; });
    const shown = q.opts.map((o, i) => i).filter(i => !G.hidden.includes(i));
    modal(`<h3>👥 رأي الجمهور</h3>${shown.map(i => `<div class="pollrow"><b>${LET[i]}</b><div class="bar"><i style="width:${pc[i]||0}%"></i></div><span>${pc[i]||0}%</span></div>`).join("")}<button class="btn" id="ok">تمام</button>`);
    $("#ok").onclick = closeModal;
  } else if (k === "call") {
    const acc = clamp(.96 - q.d * .055, .4, .92);
    const pool = q.opts.map((o, i) => i).filter(i => !G.hidden.includes(i));
    const pick = Math.random() < acc ? q.ans : shuffle(pool.filter(i => i !== q.ans))[0];
    const sure = Math.random() < acc;
    modal(`<div class="big">📞</div><h3>صديقك بيقول:</h3><p>${sure ? "أنا متأكد تقريباً" : "مش متأكد أوي، بس أعتقد"} إن الإجابة <b style="color:var(--gold1)">(${LET[pick]}) ${esc(q.opts[pick].t)}</b></p><button class="btn" id="ok">شكراً</button>`);
    $("#ok").onclick = closeModal;
  }
  const bt = app.querySelector(`[data-ll="${k}"]`); if (bt) { bt.querySelector("em").textContent = llCount(k); if (llCount(k) < 1) bt.disabled = true; }
}
function answer(i) {
  if (G.locked) return; G.locked = true;
  if (G.mode !== "speed") stopTimer();
  const q = G.q, btns = app.querySelectorAll("[data-o]");
  btns.forEach(b => b.setAttribute("disabled", ""));
  const right = i === q.ans;
  if (i >= 0) btns[i].classList.add("sel");
  const delay = G.mode === "speed" ? 350 : 1100, ref = G;
  setTimeout(() => {
    if (G !== ref) return;
    if (i >= 0) btns[i].classList.remove("sel");
    btns[q.ans].classList.add("ok");
    if (i >= 0 && !right) btns[i].classList.add("no");
    right ? (sfx.ok(), sfx.cheer(), vib(40)) : (sfx.no(), sfx.groan(), vib([80, 60, 120]));
    if (ref.mode !== "speed") toast(right ? "👏 برافو! الجمهور بيصفّق لك" : "😢 يا خسارة! الجمهور زعلان");
    S.stats[right ? "correct" : "wrong"]++;
    if (right) { S.mis.correct++; G.right++; G.streak++; S.stats.streak = G.streak; S.stats.bestStreak = Math.max(S.stats.bestStreak, G.streak); G.score += G.mode === "survive" ? 50 * q.l + G.streak * 5 : G.mode === "speed" ? 100 + 20 * q.l : 0; }
    else { G.wrong++; G.streak = 0; S.stats.streak = 0; }
    save();
    setTimeout(() => { if (G === ref) next(right, i === -1); }, ref.mode === "speed" ? 450 : 1300);
  }, delay);
}
function nextQ() { G.q = null; R.game(); }
function next(right, timeout) {
  if (G.mode === "classic") {
    if (!right) return finish(timeout ? "timeout" : "wrong");
    if (G.i === 14) return finish("million");
    G.i++; return nextQ();
  }
  if (G.mode === "daily") { if (G.i >= 9) return finish("done"); G.i++; return nextQ(); }
  if (G.mode === "survive") { if (!right) return finish("wrong"); if (G.i >= 79) return finish("done"); G.i++; return nextQ(); }
  if (G.mode === "speed") { G.i++; return nextQ(); }
  if (G.mode === "cup") {
    right ? G.rs++ : G.ws++; G.qi++; G.i++;
    if (G.qi < G.cup.per) return nextQ();
    const st = G.cup.stages[G.stage];
    if (G.rs < G.cup.need) return finish("out");
    G.cupGems += st[1]; S.gems += st[1]; save();
    if (G.stage >= G.cup.stages.length - 1) return finish("champion");
    const done = st[0], nxtName = G.cup.stages[G.stage + 1][0];
    G.stage++; G.qi = 0; G.rs = 0; G.ws = 0; G.stD = stageD(G.cup, G.stage);
    sfx.bigcheer(); confetti();
    modal(`<div class="big">✅</div><h3>عدّيت ${done}!</h3><p>+${st[1]} 💎<br>الدور الجاي: <b style="color:var(--gold1)">${nxtName}</b> — الأسئلة أصعب</p><button class="btn" id="ok">كمّل</button>`);
    $("#ok").onclick = () => { closeModal(); nextQ(); };
  }
}

function finish(why) {
  stopTimer();
  const g = G; G = null; if (!g) return go("home");
  let prize = 0, pts = 0, gems = 0, title = "", icon = "⚽", msg = "", info = "";
  const name = g.mode === "cup" ? g.cup.nm : { classic: "المليونير الكلاسيكي", daily: "تحدي اليوم", speed: "تحدي السرعة", survive: "تحدي الصمود" }[g.mode];
  let shownGems = null;
  if (g.mode === "classic") {
    if (why === "million") { prize = 1000000; S.stats.millions++; }
    else if (why === "withdraw") prize = g.i ? LADDER[g.i - 1] : 0;
    else { const s = [...SAFE].reverse().find(x => g.i > x); prize = s !== undefined ? LADDER[s] : 0; }
    pts = prize; gems = Math.round(prize / 400) + (why === "million" ? 500 : 0);
    S.stats.best = Math.max(S.stats.best, prize);
    info = fmt(prize);
    if (why === "million") { icon = "👑"; title = "مبروك! أنت مليونير كرة القدم!"; msg = "جاوبت على كل الأسئلة الـ15 صح 🎉"; }
    else if (why === "withdraw") { icon = "💰"; title = "انسحاب ذكي"; msg = `خدت ${fmt(prize)}`; }
    else { icon = why === "timeout" ? "⏰" : "😢"; title = why === "timeout" ? "خلص الوقت!" : "إجابة غلط!"; msg = `الإجابة الصح: <b style="color:var(--gold1)">${esc(g.q.opts[g.q.ans].t)}</b><br>جايزتك: ${prize ? fmt(prize) : "0"}`; }
  } else if (g.mode === "cup") {
    pts = g.cupGems * 4; gems = 0; shownGems = g.cupGems; info = g.cupGems + " 💎";
    if (why === "champion") { icon = "🏆"; title = "بطل " + g.cup.nm + "!"; msg = "عدّيت كل الأدوار وكسبت " + g.cupGems + " 💎"; }
    else if (why === "out") { icon = "😢"; title = "خرجت من البطولة"; msg = `ودّعت في ${g.cup.stages[g.stage][0]}<br>كسبت ${g.cupGems} 💎 من الأدوار اللي عدّيتها`; }
    else { icon = "🚪"; title = "انسحبت من البطولة"; msg = `محفوظ لك ${g.cupGems} 💎`; }
  } else if (g.mode === "daily") {
    S.dc = today(); S.stats.dailyDone++; pts = g.right * 50; gems = g.right * 20; info = g.right + "/10";
    icon = g.right >= 7 ? "🏆" : "👏"; title = "خلصت تحدي اليوم"; msg = `جاوبت ${g.right} من 10`;
  } else if (g.mode === "speed") {
    pts = g.score; gems = Math.floor(g.right / 2) * 5; info = g.right + " صح"; icon = "⏱"; title = "انتهى الوقت!"; msg = `جاوبت ${g.right} إجابة صح`;
  } else {
    pts = g.score; gems = Math.floor(g.right / 3) * 5; info = g.right + " صح"; icon = "🔥"; title = why === "done" ? "ما غلطتش ولا مرة!" : "غلطة وخلصت"; msg = `سلسلتك: ${g.right} إجابة صح`;
  }
  S.stats.games++; S.points += pts; S.gems += gems;
  S.lvl = g.right >= 3 ? clamp(Math.round(g.maxD / 2.5), S.lvl, 4) : clamp(S.lvl - (g.wrong > g.right ? 1 : 0), 1, 4);
  S.hist.unshift({ mode: name, date: new Date().toLocaleDateString("ar-EG"), pts, info }); S.hist = S.hist.slice(0, 30);
  checkAch(); save();
  const win = pts > 0 && why !== "wrong" && why !== "timeout" && why !== "out";
  (why === "million" || why === "champion" ? (sfx.bigcheer(), toast("🏆🎉 فرحة البطولة! الجمهور بيهتف باسمك")) : win ? sfx.ok() : sfx.no()); if (why === "million" || why === "champion" || (win && g.mode !== "classic" && g.mode !== "cup")) confetti();
  screen = "result"; window.scrollTo(0, 0);
  app.innerHTML = `<div style="text-align:center;padding-top:40px"><div style="font-size:72px">${icon}</div><h2 style="font-size:26px">${title}</h2><p style="line-height:1.8">${msg}</p>
    <div class="grid2" style="margin:18px 0"><div class="card stat"><b>+${num(pts)}</b><small>نقاط</small></div><div class="card stat"><b>+${num(shownGems == null ? gems : shownGems)} 💎</b><small>جواهر</small></div></div>
    <button class="btn" id="again">🔁 العب تاني</button><button class="btn sec" id="hm" style="margin-top:10px">🏠 الرئيسية</button></div>`;
  $("#again").onclick = () => g.mode === "daily" ? go("challenges") : g.mode === "cup" ? go("arena") : startGame(g.mode);
  $("#hm").onclick = () => go("home");
}

/* ---------- ماتش 1 ضد 1 ---------- */
const TIERS = {
  b: { nm: "مبتدئ", ic: "🥉", stake: 25,  ds: [6, 7, 7, 8, 8],   bot: .45 },
  p: { nm: "محترف", ic: "🥈", stake: 50,  ds: [7, 8, 8, 9, 9],   bot: .55 },
  c: { nm: "بطل",   ic: "🥇", stake: 100, ds: [8, 9, 9, 10, 10], bot: .65 }
};
const MQ_TIME = 25;
let M = null, mTick = null;
const sleep = ms => new Promise(r => setTimeout(r, ms));
function mClear() { if (mTick) { clearInterval(mTick); mTick = null; } }
const DEV = (() => { let d = lsGet("fm_dev", null); if (!d) { d = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); lsSet("fm_dev", d); } return d; })();
const dbUrl = () => ((lsGet("fm_dburl", "") || (CFG.MATCH && CFG.MATCH.DB_URL) || "") + "").replace(/\/+$/, "");
const pvpOn = () => !!dbUrl();
async function db(method, path, body) {
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 7000);
  try {
    const r = await fetch(dbUrl() + "/fm/" + path + ".json", { method, signal: ctl.signal, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!r.ok) throw new Error("db " + r.status);
    return await r.json();
  } finally { clearTimeout(to); }
}
function duelCard() {
  return `<div class="card"><div class="row"><div class="ic" style="font-size:34px">⚔️</div><div class="grow"><b>ماتش 1 ضد 1</b><div class="mut">5 أسئلة صعبة جداً — نفس الأسئلة للاتنين — اللي يجاوب أكتر ياخد الرهان كله 💎</div></div></div>
    <div style="display:flex;gap:8px;margin-top:10px">${Object.keys(TIERS).map(k => { const t = TIERS[k]; return `<button class="btn" data-duel="${k}" style="padding:10px 4px;font-size:13px" ${S.gems < t.stake ? "disabled" : ""}>${t.ic} ${t.nm}<br>${t.stake} 💎</button>`; }).join("")}</div>
    ${pvpOn() ? '<button class="btn sec" id="joincode" style="margin-top:10px">🔑 عندي كود من صديق</button>' : ""}${pvpOn() ? "" : '<button class="btn sec" id="setdb" style="margin-top:10px">🌐 فعّل اللعب ضد لاعب حقيقي</button>'}<div class="mut" style="margin-top:8px">${pvpOn() ? "🌐 لاعب عشوائي أو صديق بكود أو الكمبيوتر" : "حالياً ضد الكمبيوتر — اللاعب الحقيقي محتاج ربط قاعدة بيانات (شوف الشرح)"}</div></div>`;
}
function askDbUrl() {
  modal(`<h3>🌐 تفعيل اللعب أونلاين</h3><p>الصق رابط قاعدة Firebase (بينتهي بـ firebaseio.com). كل اللاعبين لازم يحطوا نفس الرابط.</p><input class="inp" id="du" dir="ltr" placeholder="https://xxxx-default-rtdb.firebaseio.com" value="${esc(dbUrl())}"><div class="err" id="derr"></div><button class="btn" id="ds">حفظ</button><button class="btn ghost" id="dx">إلغاء</button>`);
  $("#ds").onclick = () => { let u = $("#du").value.trim().replace(/\/+$/, ""); if (u && !/^https:\/\/[^\s]+\.(firebaseio\.com|firebasedatabase\.app)$/.test(u)) return ($("#derr").textContent = "الرابط مش صح — لازم يبدأ بـ https وينتهي بـ firebaseio.com"); lsSet("fm_dburl", u); closeModal(); toast(u ? "اتفعّل اللعب أونلاين ✓" : "اتلغى"); if (screen === "arena") R.arena(); else if (screen === "settings") R.settings(); };
  $("#dx").onclick = closeModal;
}
function bindDuel() {
  const sd = $("#setdb"); if (sd) sd.onclick = askDbUrl;
  const jc = $("#joincode");
  if (jc) jc.onclick = () => {
    modal(`<h3>🔑 كود الماتش</h3><p>اكتب الكود اللي صاحبك بعته لك.</p><input class="inp" id="cd" maxlength="6" dir="ltr" style="text-align:center;font-size:24px;letter-spacing:4px;text-transform:uppercase" placeholder="ABC12"><button class="btn" id="cg">ادخل الماتش</button><button class="btn ghost" id="cx">إلغاء</button>`);
    $("#cg").onclick = () => { const c = $("#cd").value; closeModal(); joinByCode(c); }; $("#cx").onclick = closeModal;
  };
  app.querySelectorAll("[data-duel]").forEach(b => b.onclick = () => {
    const id = b.dataset.duel, t = TIERS[id];
    modal(`<div class="big">${t.ic}</div><h3>ماتش ${t.nm}</h3><p>رهان ${t.stake} 💎 من كل لاعب. الفايز ياخد ${t.stake * 2} 💎.</p><button class="btn" id="vp">🎲 خصم عشوائي (لاعب حقيقي بيدوّر دلوقتي)</button><button class="btn" id="vi" style="margin-top:8px">📲 العب مع صديق — رابط واتساب</button>${pvpOn() ? "" : '<button class="btn sec" id="vb" style="margin-top:8px">🤖 ضد الكمبيوتر</button>'}<button class="btn ghost" id="vn">لأ</button>`);
    const net = k => () => { closeModal(); if (!pvpOn()) return askDbUrl(); if (!online()) return toast("محتاج نت للعب ضد لاعب حقيقي"); startDuel(id, k); };
    const vp = $("#vp"); if (vp) vp.onclick = net("random");
    const vi = $("#vi"); if (vi) vi.onclick = net("invite");
    const vb = $("#vb"); if (vb) vb.onclick = () => { closeModal(); startDuel(id, "bot"); };
    $("#vn").onclick = closeModal;
  });
}
function duelWaiting(msg) {
  screen = "duel"; window.scrollTo(0, 0);
  app.innerHTML = `<div style="text-align:center;padding-top:70px"><div style="font-size:64px">⚔️</div><h2 id="dmsg">${msg}</h2><p class="mut" id="dst"></p><button class="btn ghost" id="dcancel" style="margin-top:20px">إلغاء</button></div>`;
  $("#dcancel").onclick = cancelDuel;
}
function cancelDuel() {
  const m = M;
  if (m) { m.cancelled = true; if (!m.bot && m.role === "h" && m.id) { db("DELETE", "q/" + m.tier + "/" + m.id).catch(() => {}); if (m.kind === "invite") db("DELETE", "m/" + m.id).catch(() => {}); } }
  M = null; go("arena");
}
const setMsg = t => { const e = $("#dmsg"); if (e) e.textContent = t; };
const setSt = t => { const e = $("#dst"); if (e) e.textContent = t; };

async function buildMatchQs(m) {
  const ds = m.T.ds, out = [];
  if (online() && aiReady()) await Promise.all([...new Set(ds)].map(d => generate(d, ds.filter(x => x === d).length + 1)));
  for (const d of ds) {
    let raw = null;
    if (online()) { raw = takeBuf(d); if (!raw) raw = pickPool(d); }
    if (!raw) raw = pickCache(d);
    if (!raw) continue;
    m.used.add(qid(raw));
    const q = norm(raw, d);
    out.push({ q: q.q, o: q.opts.map(x => x.t), a: q.ans, d });
  }
  if (out.length < 3) throw new Error("noq");
  return out;
}
const hostList = list => { const now = Date.now(); return Object.entries(list || {}).filter(([k, v]) => v && v.u !== DEV && v.rdy && Math.abs(now - v.t) < 40000).sort((a, b) => b[1].t - a[1].t); };
async function tryJoin(m, id) {
  await db("PUT", "m/" + id + "/g/" + DEV, { n: SES.name, t: Date.now() });
  for (let k = 0; k < 20 && !m.cancelled; k++) {
    await sleep(1000);
    const g = await db("GET", "m/" + id + "/guest");
    if (g) {
      if (g.u !== DEV) break;
      let qs = null;
      for (let j = 0; j < 10 && !qs && !m.cancelled; j++) { qs = await db("GET", "m/" + id + "/qs"); if (!qs) await sleep(700); }
      if (!qs) break;
      const h = await db("GET", "m/" + id + "/host");
      m.id = id; m.role = "g"; m.qs = qs; m.oppName = (h && h.n) || "لاعب";
      return true;
    }
  }
  db("DELETE", "m/" + id + "/g/" + DEV).catch(() => {});
  return false;
}
async function findOpponent(m) {
  const qp = "q/" + m.tier;
  setMsg("🔍 بندوّر على خصم...");
  const hosts = hostList(await db("GET", qp));
  for (const [id] of hosts.slice(0, 4)) { if (m.cancelled) return; if (await tryJoin(m, id)) return; }
  if (m.cancelled) return;
  setMsg("⏳ بنجهّز الأسئلة الصعبة...");
  const qs = await buildMatchQs(m);
  if (m.cancelled) return;
  const id = Date.now().toString(36) + DEV.slice(0, 4);
  m.id = id; m.role = "h";
  await db("PUT", "m/" + id + "/qs", qs);
  await db("PUT", "m/" + id + "/host", { u: DEV, n: SES.name });
  await db("PUT", qp + "/" + id, { u: DEV, n: SES.name, t: Date.now(), rdy: 1 });
  const t0 = Date.now(); let last = 0;
  try {
    while (!m.cancelled && Date.now() - t0 < 70000) {
      setMsg("🔍 مستنيين لاعب ينضم...");
      setSt(Math.max(0, Math.round((70000 - (Date.now() - t0)) / 1000)) + " ث");
      await sleep(1200);
      if (m.cancelled) return;
      const gs = await db("GET", "m/" + id + "/g");
      if (gs) {
        const key = Object.keys(gs).sort((a, b) => (gs[a].t || 0) - (gs[b].t || 0))[0];
        await db("PUT", "m/" + id + "/guest", { u: key, n: gs[key].n });
        m.qs = qs; m.oppName = gs[key].n; return;
      }
      if (Date.now() - last > 6000) {
        last = Date.now();
        db("PUT", qp + "/" + id + "/t", Date.now()).catch(() => {});
        const others = hostList(await db("GET", qp)).filter(([k]) => k < id);   // لو فيه مضيف تاني اتنين دخلوا سوا: صاحب الرقم الأصغر يفضل
        if (others.length) {
          await db("DELETE", qp + "/" + id);
          for (const [oid] of others.slice(0, 2)) { if (m.cancelled) return; if (await tryJoin(m, oid)) return; }
          await db("PUT", qp + "/" + id, { u: DEV, n: SES.name, t: Date.now(), rdy: 1 });
        }
      }
    }
    if (!m.cancelled) throw new Error("nomatch");
  } finally { db("DELETE", qp + "/" + id).catch(() => {}); }
}
function inviteScreen(m) {
  const T = m.T, code = m.id;
  screen = "duel"; window.scrollTo(0, 0);
  app.innerHTML = `<div style="text-align:center;padding-top:30px"><div style="font-size:56px">📲</div><h2 id="dmsg">ادعُ صديقك للماتش</h2>
    <div class="card"><div class="mut">كود الماتش</div><div style="font-size:40px;font-weight:900;letter-spacing:8px;color:var(--gold1)" dir="ltr">${code}</div><div class="mut">${T.ic} ${T.nm} — رهان ${T.stake} 💎 من كل واحد</div></div>
    <button class="btn" id="wa">📲 ابعت على واتساب</button><button class="btn sec" id="cp" style="margin-top:8px">📋 انسخ الكود</button>
    <p class="mut" id="dst">مستنيين صاحبك يدخل الكود...</p><button class="btn ghost" id="dcancel">إلغاء</button></div>`;
  const link = (CFG.SHARE_URL || "").trim();
  const txt = `${SES.name} بيتحداك في ماتش مليونير كرة القدم ⚔️\nمستوى ${T.nm} — رهان ${T.stake} جوهرة\n${link ? "حمّل اللعبة: " + link + "\n" : ""}افتح اللعبة ← البطولات ← "عندي كود من صديق" واكتب الكود: ${code}`;
  $("#wa").onclick = async () => { try { if (navigator.share) { await navigator.share({ text: txt }); return; } } catch (e) { if (e && e.name === "AbortError") return; } const u = "https://wa.me/?text=" + encodeURIComponent(txt); try { window.open(u, "_blank"); } catch (e) { location.href = u; } };
  $("#cp").onclick = async () => { try { await navigator.clipboard.writeText(code); toast("اتنسخ الكود ✓"); } catch (e) { toast("الكود: " + code); } };
  $("#dcancel").onclick = cancelDuel;
}
async function hostInvite(m) {
  const qs = await buildMatchQs(m);
  if (m.cancelled) return;
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; let code = "";
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  m.id = code; m.role = "h";
  await db("PUT", "m/" + code + "/qs", qs);
  await db("PUT", "m/" + code + "/host", { u: DEV, n: SES.name });
  await db("PUT", "m/" + code + "/info", { tier: m.tier, n: SES.name });
  if (m.cancelled) { db("DELETE", "m/" + code).catch(() => {}); return; }
  inviteScreen(m);
  const t0 = Date.now();
  while (!m.cancelled && Date.now() - t0 < 300000) {
    await sleep(1500);
    if (m.cancelled) return;
    const gs = await db("GET", "m/" + code + "/g");
    if (gs) {
      const key = Object.keys(gs).sort((a, b) => (gs[a].t || 0) - (gs[b].t || 0))[0];
      await db("PUT", "m/" + code + "/guest", { u: key, n: gs[key].n });
      m.qs = qs; m.oppName = gs[key].n; return;
    }
  }
  if (!m.cancelled) { db("DELETE", "m/" + code).catch(() => {}); throw new Error("nomatch"); }
}
async function afterMatch(m) {
  if (m.cancelled || M !== m || !m.qs || !m.qs.length) return;
  if (S.gems < m.T.stake) { M = null; toast("جواهرك مش كفاية 💎"); return go("arena"); }
  S.gems -= m.T.stake; m.paid = true;
  m.qs.forEach(q => { const id = qid([q.q]); S.seen = S.seen.filter(x => x !== id); S.seen.push(id); });
  save(); sfx.win();
  duelWaiting("✅ " + esc(SES.name) + " ⚔ " + esc(m.oppName)); setSt("الماتش بيبدأ...");
  await sleep(1800);
  if (M !== m) return;
  duelQ(m);
}
async function startDuel(tierId, kind) {
  sfx.tap();
  kind = kind === true ? "bot" : !kind ? "random" : kind;
  const T = TIERS[tierId];
  if (!S || M) return;
  if (S.gems < T.stake) return toast("جواهرك مش كفاية 💎");
  const m = M = { tier: tierId, T, bot: kind === "bot", kind, used: new Set(), cancelled: false, paid: false, i: 0, my: [], opp: [], score: [0, 0], role: "h", id: "", miss: 0 };
  duelWaiting(kind === "bot" ? "🤖 بنجهّز الأسئلة الصعبة..." : kind === "invite" ? "⏳ بنجهّز الأسئلة الصعبة..." : "🔍 بندوّر على خصم...");
  try {
    if (kind === "bot") { m.qs = await buildMatchQs(m); m.oppName = "خصم كمبيوتر 🤖"; }
    else if (kind === "invite") await hostInvite(m);
    else await findOpponent(m);
  } catch (e) {
    if (m.cancelled || M !== m) return;
    M = null;
    if (e.message === "nomatch") {
      modal(`<div class="big">😴</div><h3>ماحدش دخل دلوقتي</h3><p>تحب تلعب ضد الكمبيوتر؟</p><button class="btn" id="y">🤖 العب ضد الكمبيوتر</button><button class="btn ghost" id="n">رجوع</button>`);
      $("#y").onclick = () => { closeModal(); startDuel(tierId, "bot"); }; $("#n").onclick = () => { closeModal(); go("arena"); };
    } else { toast("تعذّر الاتصال — جرّب تاني"); go("arena"); }
    return;
  }
  await afterMatch(m);
}
async function joinByCode(code) {
  code = String(code || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!S || M) return;
  if (!pvpOn()) return toast("اللعب مع الأصحاب محتاج ربط قاعدة البيانات");
  if (!online()) return toast("محتاج نت");
  if (code.length < 4) return toast("اكتب الكود صح");
  let info;
  try { info = await db("GET", "m/" + code + "/info"); const gst = await db("GET", "m/" + code + "/guest"); if (!info || !TIERS[info.tier] || gst) return toast("الكود غلط أو الماتش اتملى"); }
  catch (e) { return toast("تعذّر الاتصال"); }
  const T = TIERS[info.tier];
  if (S.gems < T.stake) return toast("محتاج " + T.stake + " 💎 عشان تدخل الماتش ده");
  const m = M = { tier: info.tier, T, bot: false, kind: "join", used: new Set(), cancelled: false, paid: false, i: 0, my: [], opp: [], score: [0, 0], role: "g", id: code, miss: 0 };
  duelWaiting("🔑 بنوصّلك بـ " + esc(info.n || "صاحبك"));
  try {
    const ok = await tryJoin(m, code);
    if (!ok) { if (M === m) { M = null; toast("صاحبك مش موجود دلوقتي"); go("arena"); } return; }
  } catch (e) { if (M === m) { M = null; toast("تعذّر الاتصال"); go("arena"); } return; }
  await afterMatch(m);
}
function duelQ(m) {
  if (M !== m) return;
  const q = m.qs[m.i], n = m.qs.length;
  m.locked = false; m.qStart = Date.now(); m.left = MQ_TIME;
  app.innerHTML = `<div class="gtop"><button class="ibtn" id="quit">✕</button><div class="prize"><small>الرهان ${m.T.stake} 💎 × 2</small><b id="sc">${m.score[0]} : ${m.score[1]}</b></div><div class="timer" id="tm">${MQ_TIME}</div></div>
    <span class="pill qn">⚔ ${m.T.nm} — السؤال <bdi>${m.i + 1} / ${n}</bdi></span><span class="pill" style="margin-inline-start:6px">${esc(SES.name)} ⚔ ${esc(m.oppName)}</span>
    <div class="qbox">${esc(q.q)}</div>
    <div class="opts">${q.o.map((t, i) => `<button class="opt" data-o="${i}"><b>${LET[i]}</b><span class="tx">${esc(t)}</span><span class="pc"></span></button>`).join("")}</div>
    <p class="mut" id="dst" style="text-align:center;margin-top:10px"></p>`;
  app.querySelectorAll("[data-o]").forEach(b => b.onclick = () => duelAnswer(m, +b.dataset.o));
  $("#quit").onclick = duelQuit;
  mClear();
  mTick = setInterval(() => { m.left--; const tm = $("#tm"); if (tm) { tm.textContent = m.left; tm.classList.toggle("low", m.left <= 8); } if (m.left <= 5) sfx.tick(); if (m.left <= 0) duelAnswer(m, -1); }, 1000);
}
function botAnswer(m) { return { c: Math.random() < m.T.bot ? 1 : 0, ms: 4000 + Math.random() * 14000 }; }
async function duelAnswer(m, i) {
  if (M !== m || m.locked) return; m.locked = true; mClear();
  const q = m.qs[m.i], btns = app.querySelectorAll("[data-o]");
  btns.forEach(b => b.setAttribute("disabled", ""));
  const c = i === q.a ? 1 : 0, rec = { c, ms: i < 0 ? MQ_TIME * 1000 : Math.min(MQ_TIME * 1000, Date.now() - m.qStart) };
  m.my[m.i] = rec;
  if (i >= 0) btns[i].classList.add("sel");
  setSt("⏳ مستنيين إجابة الخصم...");
  let oa = null;
  if (m.bot) { oa = botAnswer(m); await sleep(clamp(oa.ms - rec.ms, 700, 4000)); }
  else {
    db("PUT", "m/" + m.id + "/a/" + m.role + "/" + m.i, rec).catch(() => {});
    const opR = m.role === "h" ? "g" : "h", t0 = Date.now(), maxWait = m.miss >= 2 ? 2500 : (MQ_TIME * 1000 - rec.ms) + 8000;
    while (M === m && !oa && Date.now() - t0 < maxWait) {
      try { oa = await db("GET", "m/" + m.id + "/a/" + opR + "/" + m.i); } catch (e) {}
      if (!oa) await sleep(900);
    }
    if (!oa) { m.miss++; oa = { c: 0, ms: MQ_TIME * 1000 }; } else m.miss = 0;
  }
  if (M !== m) return;
  m.opp[m.i] = oa;
  if (i >= 0) btns[i].classList.remove("sel");
  btns[q.a].classList.add("ok"); if (i >= 0 && !c) btns[i].classList.add("no");
  c ? (sfx.ok(), sfx.cheer(), vib(40)) : (sfx.no(), sfx.groan(), vib([80, 60, 120]));
  toast(c ? "👏 برافو! إجابة صح" : "😢 يا خسارة! إجابة غلط");
  m.score[0] += c; m.score[1] += oa.c ? 1 : 0;
  const sc = $("#sc"); if (sc) sc.textContent = m.score[0] + " : " + m.score[1];
  setSt(oa.c ? "الخصم جاوب صح ✓" : "الخصم جاوب غلط ✗");
  await sleep(1800);
  if (M !== m) return;
  m.i++; m.i < m.qs.length ? duelQ(m) : duelEnd(m);
}
function duelQuit() {
  if (!M) return;
  const m = M;
  modal(`<h3>تنسحب؟</h3><p>${m.paid ? "هتخسر الرهان (" + m.T.stake + " 💎) والخصم ياخد الماتش." : "هنلغي البحث."}</p><button class="btn" id="y">أيوه</button><button class="btn ghost" id="n">كمّل</button>`);
  $("#y").onclick = () => { closeModal(); m.cancelled = true; if (m.role === "h" && m.id && !m.bot) db("DELETE", "q/" + m.tier + "/" + m.id).catch(() => {}); if (m.paid) { S.stats.dl = (S.stats.dl || 0) + 1; S.stats.games++; save(); } M = null; mClear(); go("arena"); };
  $("#n").onclick = closeModal;
}
function duelEnd(m) {
  mClear();
  const me = m.score[0], op = m.score[1], T = m.T;
  const sum = a => a.reduce((x, r) => x + (r ? r.ms : MQ_TIME * 1000), 0);
  let res = me > op ? "win" : me < op ? "lose" : "draw";
  if (res === "draw") { const dt = sum(m.my) - sum(m.opp); if (Math.abs(dt) > 500) res = dt < 0 ? "win" : "lose"; }
  const back = res === "win" ? T.stake * 2 : res === "draw" ? T.stake : 0;
  S.gems += back; S.stats.games++;
  const k = res === "win" ? "dw" : res === "lose" ? "dl" : "dd"; S.stats[k] = (S.stats[k] || 0) + 1;
  const pts = res === "win" ? T.stake * 6 : res === "draw" ? T.stake * 2 : 0;
  S.points += pts;
  S.hist.unshift({ mode: "ماتش 1×1 — " + T.nm, date: new Date().toLocaleDateString("ar-EG"), pts, info: me + " : " + op }); S.hist = S.hist.slice(0, 30);
  if (m.role === "h" && !m.bot && m.id) setTimeout(() => db("DELETE", "m/" + m.id).catch(() => {}), 40000);
  save(); M = null; screen = "result"; window.scrollTo(0, 0);
  res === "win" ? (sfx.bigcheer(), confetti()) : res === "draw" ? sfx.ok() : sfx.no();
  const icon = res === "win" ? "🏆" : res === "draw" ? "🤝" : "😢", title = res === "win" ? "كسبت الماتش!" : res === "draw" ? "تعادل" : "خسرت الماتش";
  app.innerHTML = `<div style="text-align:center;padding-top:40px"><div style="font-size:72px">${icon}</div><h2 style="font-size:26px">${title}</h2><p style="line-height:1.8">${esc(SES.name)} <b>${me}</b> : <b>${op}</b> ${esc(m.oppName)}</p>
    <div class="grid2" style="margin:18px 0"><div class="card stat"><b>${res === "win" ? "+" + T.stake : res === "draw" ? "0" : "-" + T.stake} 💎</b><small>صافي الجواهر</small></div><div class="card stat"><b>+${num(pts)}</b><small>نقاط</small></div></div>
    <button class="btn" id="again">⚔ ماتش تاني</button><button class="btn sec" id="hm" style="margin-top:10px">🌍 البطولات</button></div>`;
  $("#again").onclick = () => startDuel(m.tier, m.kind === "join" ? "random" : m.kind);
  $("#hm").onclick = () => go("arena");
}

/* ---------- ربط الأحداث ---------- */
document.addEventListener("click", e => {
  const g = e.target.closest("[data-go]");
  if (g && !g.closest(".modal")) { if (G && screen === "game") return; sfx.tap(); go(g.dataset.go); }
});
const onBack = () => { if (!$("#modal").classList.contains("hidden")) closeModal(); else if (screen === "duel" && M) duelQuit(); else if (screen === "game" && G) confirmQuit(); else if (screen !== "home" && screen !== "login" && SES) go("home"); else if (window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.App) Capacitor.Plugins.App.exitApp(); };
try { if (window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.App) Capacitor.Plugins.App.addListener("backButton", onBack); } catch (e) {}
window.addEventListener("online", () => { aiDownUntil = 0; refreshQuestions(); fillCache(); toast("رجع النت 🌐 — أسئلة جديدة"); if (screen === "home") R.home(); });
window.addEventListener("offline", () => { toast("النت قطع — هتكمل بأسئلة محفوظة 📴"); });

padCache();
go("splash");
})();
