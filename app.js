
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const DBKEY = 'vocab-helden-v2';
const state = {
  data: [], // {id, book, base:'latin'|'english', lesson, de, la, en}
  mode: 'flash',
  lang: 'latin', // practice direction
  book: null,
  themes: [
    {id:'ocean', name:'Ocean', vars:{bg:'#0b132b', panel:'#1c2541', accent:'#3a86ff', text:'#f6f7fb', btn:'#0d1b2a'}},
    {id:'forest', name:'Forest', vars:{bg:'#0b2b1a', panel:'#163822', accent:'#34d399', text:'#eafff3', btn:'#0a1f14'}},
    {id:'sunset', name:'Sunset', vars:{bg:'#2b0b14', panel:'#3a1421', accent:'#ff7a59', text:'#fff4f0', btn:'#2a0e15'}},
    {id:'contrast', name:'Kontrast', vars:{bg:'#000000', panel:'#111111', accent:'#ffd60a', text:'#ffffff', btn:'#1c1c1c'}},
  ],
  theme: 'ocean',
  profiles: {}, // name -> {xp, streak, lastDay, reviewsToday, perCard, goals:{lessons, minutes}, scheduleNoti}
  activeKid: null
};

function defaultProfile(){
  return { xp:0, streak:0, lastDay:null, reviewsToday:0, perCard:{}, goals:{lessons:[], minutes:15}, scheduleNoti:false };
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(DBKEY) || '{}');
    Object.assign(state, saved);
    if (!state.activeKid) {
      state.profiles["Kind 1"] = state.profiles["Kind 1"] || defaultProfile();
      state.profiles["Kind 2"] = state.profiles["Kind 2"] || defaultProfile();
      state.activeKid = "Kind 1";
    }
    for (const k in state.profiles){
      const p = state.profiles[k];
      if (p.lastDay && new Date(p.lastDay).toDateString() !== new Date().toDateString()) {
        p.reviewsToday = 0;
      }
    }
  } catch(e){ console.warn(e); }
}
function save() {
  localStorage.setItem(DBKEY, JSON.stringify(state));
}
load();

// Themes
function applyTheme(id){
  const theme = state.themes.find(t=>t.id===id) || state.themes[0];
  state.theme = theme.id; save();
  const root = document.documentElement;
  root.style.setProperty('--bg', theme.vars.bg);
  root.style.setProperty('--panel', theme.vars.panel);
  root.style.setProperty('--accent', theme.vars.accent);
  root.style.setProperty('--text', theme.vars.text);
  root.style.setProperty('--btn', theme.vars.btn || '#0d1b2a');
  $$("select, button, input[type='text'], input[type='number']").forEach(el=>{
    el.style.background = 'var(--btn)';
    el.style.color = 'var(--text)';
  });
  renderThemePills();
}
function renderThemePills(){
  const wrap = $("#themePills"); if (!wrap) return;
  wrap.innerHTML='';
  state.themes.forEach(t=>{
    const b = document.createElement('button');
    b.className = 'theme-pill'+(state.theme===t.id?' active':'');
    b.textContent = t.name;
    b.addEventListener('click', ()=> applyTheme(t.id));
    wrap.appendChild(b);
  });
}

// Toast + Mascot
const QUOTES = [
  ["turtle","Langsam ist auch schnell – Schritt für Schritt!"],
  ["frog","Sprung! Ein Punkt mehr in Richtung Meisterschaft!"],
  ["sheep","Mäh‑gnifique! So merkt man's sich!"],
  ["turtle","Kleine Siege bringen große Erfolge."],
  ["frog","Quak! Neue XP erbeutet!"],
  ["sheep","Wolllah! Weiter so!"]
];
function toast(msg, mascotId='turtle') {
  let t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<div class="msg"><svg><use href="assets/mascots.svg#${mascotId}"/></svg><div>${msg}</div></div>`;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(), 1800);
}
function cheer() {
  const [id, text] = QUOTES[Math.floor(Math.random()*QUOTES.length)];
  toast(text, id);
}

// Profiles
function P(){ return state.profiles[state.activeKid]; }
function setKid(name){ state.activeKid = name; save(); refreshKpis(); renderProgress(); }
function refreshKpis(){
  $("#xp").textContent = P().xp;
  $("#streak").textContent = P().streak;
  $("#kidBadge").textContent = state.activeKid;
}

// CSV/JSON import with books
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i=0;i<text.length;i++) {
    const c = text[i], n = text[i+1];
    if (c === '"') {
      if (inQuotes && n === '"') { field += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      row.push(field.trim()); field = '';
    } else if ((c === '\n' || c === '\r') && !inQuotes) {
      if (field !== '' || row.length) { row.push(field.trim()); rows.push(row); row = []; field=''; }
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field.trim()); rows.push(row); }
  const header = rows.shift().map(h => h.toLowerCase());
  return rows.map(r => Object.fromEntries(header.map((h,i)=>[h, r[i]])));
}

function normalize(records, book, base) {
  const norm = [];
  for (const r of records) {
    const keys = Object.fromEntries(Object.keys(r).map(k=>[k.toLowerCase(), k]));
    const de = r[keys.deutsch] ?? r[keys.de] ?? r[keys.german] ?? r[keys['de']] ?? '';
    const la = r[keys.latein] ?? r[keys.latin] ?? r[keys.lat] ?? r[keys.la] ?? '';
    const en = r[keys.englisch] ?? r[keys.english] ?? r[keys.en] ?? '';
    const lesson = r[keys.lektion] ?? r[keys.lesson] ?? r[keys.lektion_nr] ?? r[keys.kapitel] ?? r[keys['lektion ']] ?? '1';
    if ((de && la) || (de && en) || (la && en)) {
      norm.push({ id: crypto.randomUUID(), book: book, base: base, lesson: String(lesson).trim(), de: (de||'').trim(), la: (la||'').trim(), en: (en||'').trim() });
    }
  }
  return norm;
}
function allBooks(){ return [...new Set(state.data.map(d=>d.book))].filter(Boolean).sort(); }
function populateBooks(){
  const sel = $("#bookSelect"); sel.innerHTML='';
  const books = allBooks();
  if (!books.length){ state.book = null; const opt = document.createElement('option'); opt.textContent='(kein Buch)'; sel.appendChild(opt); return; }
  books.forEach(b=>{
    const opt = document.createElement('option'); opt.value=b; opt.textContent=b; sel.appendChild(opt);
  });
  if (!state.book || !books.includes(state.book)) state.book = books[0];
  sel.value = state.book;
}
function populateLessons(){
  const sel = $("#lessonSelect"); sel.innerHTML='';
  const pool = state.data.filter(d=> d.book===state.book && baseForMode()===d.base);
  const lessons = [...new Set(pool.map(d=>d.lesson))].sort((a,b)=> (a*1)-(b*1));
  for (const L of lessons) {
    const opt = document.createElement('option');
    opt.value = L; opt.textContent = 'Lektion ' + L;
    sel.appendChild(opt);
  }
}

// Notifications
async function ensureNotifications() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission !== 'denied') {
    const perm = await Notification.requestPermission();
    return perm === 'granted';
  }
  return false;
}
function scheduleDailyReminder(hour=17){
  P().scheduleNoti = true; save();
  ensureNotifications().then(granted => {
    if (!granted) { toast('Benachrichtigungen nicht erlaubt.'); return; }
    const check = () => {
      const now = new Date();
      if (now.getHours() >= hour && (localStorage.getItem('remindedDay_'+state.activeKid) !== now.toDateString())) {
        new Notification('Vokabelhelden', { body:`${state.activeKid}: kurze Vokabelrunde? 🔥`, badge:'icons/icon-192.png', icon:'icons/icon-192.png' });
        localStorage.setItem('remindedDay_'+state.activeKid, now.toDateString());
      }
    };
    check();
    setInterval(check, 60*60*1000);
  });
}

// XP/Streak
function addXP(n=5) {
  const p = P();
  p.xp += n;
  const todayStr = new Date().toDateString();
  if (p.lastDay !== todayStr) {
    const y = new Date(p.lastDay||Date.now()-86400000);
    const diff = Math.floor((new Date(todayStr) - new Date(y.toDateString()))/86400000);
    p.streak = (diff === 1) ? (p.streak+1) : 1;
    p.lastDay = todayStr;
  }
  p.reviewsToday++;
  save();
  refreshKpis();
}

// SR helpers
function baseForMode(){ return (state.lang.startsWith('latin'))?'latin':'english'; }
function fieldsForMode() {
  switch(state.lang){
    case 'latin': return ['la', 'de'];
    case 'latin_rev': return ['de', 'la'];
    case 'english': return ['en', 'de'];
    case 'english_rev': return ['de', 'en'];
  }
}
function chosenLessons(){
  const sel = $("#lessonSelect");
  const chosen = Array.from(sel.selectedOptions).map(o=>o.value);
  return chosen;
}
function poolItems(){
  const base = baseForMode();
  const pool = state.data.filter(d => d.book===state.book && d.base===base && (chosenLessons().length? chosenLessons().includes(d.lesson): true));
  return pool;
}
function buildDue() {
  const now = Date.now();
  const p = P();
  p.due = poolItems().filter(d => {
    const s = p.perCard[d.id];
    return !s || !s.due || s.due <= now;
  }).map(d=>d.id);
}
function reviewOutcome(quality) {
  const p = P();
  const id = state.current?.id; if (!id) return;
  let s = p.perCard[id] || { EF: 2.5, interval: 0, reps: 0, due: 0 };
  if (quality < 3) { s.reps = 0; s.interval = 1; }
  else {
    s.reps += 1;
    if (s.reps === 1) s.interval = 1;
    else if (s.reps === 2) s.interval = 6;
    else s.interval = Math.round(s.interval * s.EF);
    s.EF = Math.max(1.3, s.EF + (0.1 - (5-quality)*(0.08 + (5-quality)*0.02)));
  }
  const days = Math.max(1, s.interval);
  s.due = Date.now() + days*86400000;
  p.perCard[id] = s;
  addXP(5 + (quality>=4?3:0));
  save();
  cheer();
  buildDue();
  nextCard();
}

// Fuzzy checking
function normalizeText(t){
  return (t||'').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-zäöüß \-]/g,'').replace(/\s+/g,' ').trim();
}
function levenshtein(a,b){
  a = normalizeText(a); b = normalizeText(b);
  const m = a.length, n = b.length;
  if (m===0) return n; if (n===0) return m;
  const dp = new Array(n+1);
  for (let j=0;j<=n;j++) dp[j]=j;
  for (let i=1;i<=m;i++){
    let prev = dp[0]; dp[0]=i;
    for (let j=1;j<=n;j++){
      const temp = dp[j];
      const cost = a[i-1]===b[j-1]?0:1;
      dp[j] = Math.min(dp[j]+1, dp[j-1]+1, prev+cost);
      prev = temp;
    }
  }
  return dp[n];
}
function isFuzzyMatch(ans, want){
  const A = normalizeText(ans), W = normalizeText(want);
  if (!A || !W) return false;
  if (A===W) return true;
  const d = levenshtein(A,W);
  const tol = Math.max(1, Math.floor(W.length*0.2));
  return d <= tol;
}

// Activities
function nextCard() {
  if (!state.data.length || !state.book) { $("#flashCard").textContent = "Bitte Daten importieren und Buch wählen."; return; }
  const [qField, aField] = fieldsForMode();
  const p = P();
  const pool = poolItems();
  if (!pool.length){ $("#flashCard").textContent = "Keine passenden Vokabeln in diesem Buch/Modus."; return; }
  const dueIds = (p.due||[]).filter(id => pool.some(x=>x.id===id));
  const arr = dueIds.length ? pool.filter(d=>dueIds.includes(d.id)) : pool;
  const pick = arr[Math.floor(Math.random()*arr.length)];
  state.current = pick;
  $("#flashCard").textContent = pick[qField] || '–';
  $("#flashCard").dataset.answer = pick[aField] || '–';
  $("#writePrompt").textContent = (pick[qField] ? `Schreibe die Übersetzung von: “${pick[qField]}”` : 'Schreiben');
  $("#listenPrompt").textContent = (pick[qField] ? `🎧 Höre zu und übersetze: “${pick[qField]}”` : '🎧');
}

$("#btnShow").addEventListener('click', ()=>{
  $("#flashCard").innerHTML = `<div>${state.current ? (state.current[fieldsForMode()[0]]||'') : ''}</div>
  <div class="badge">${state.current ? (state.current[fieldsForMode()[1]]||'') : ''}</div>`;
});
$("#btnEasy").addEventListener('click', ()=> reviewOutcome(5));
$("#btnGood").addEventListener('click', ()=> reviewOutcome(4));
$("#btnHard").addEventListener('click', ()=> reviewOutcome(2));

function buildQuiz() {
  const pool = poolItems();
  if (pool.length < 4) { $("#quizPrompt").textContent="Bitte mehr Vokabeln importieren."; $("#quizOptions").innerHTML=''; return; }
  const [qField, aField] = fieldsForMode();
  const correct = pool[Math.floor(Math.random()*pool.length)];
  $("#quizPrompt").textContent = correct[qField];
  const options = new Set([correct[aField]]);
  while (options.size < 4) options.add(pool[Math.floor(Math.random()*pool.length)][aField]);
  const shuffled = [...options].sort(()=>Math.random()-0.5);
  const wrap = $("#quizOptions");
  wrap.innerHTML = '';
  for (const opt of shuffled) {
    const b = document.createElement('button'); b.textContent = opt; b.addEventListener('click', ()=>{
      if (isFuzzyMatch(opt, correct[aField])) { addXP(5); cheer(); buildQuiz(); }
      else { toast('Knapp daneben – weiter!', 'sheep'); }
    });
    wrap.appendChild(b);
  }
}

// Listen
const synth = window.speechSynthesis;
function speak(text, lang) {
  if (!synth) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  synth.cancel(); synth.speak(u);
}
$("#btnSpeak").addEventListener('click', ()=>{
  if (!state.current) nextCard();
  const [qField, aField] = fieldsForMode();
  const langCode = (qField==='la') ? 'la' : (qField==='en' ? 'en-US' : 'de-DE');
  speak(state.current[qField], langCode);
});
$("#btnCheckListen").addEventListener('click', ()=>{
  const ans = $("#listenInput").value;
  const want = (state.current?.[fieldsForMode()[1]]||'');
  if (isFuzzyMatch(ans, want)) { addXP(6); cheer(); $("#listenInput").value=''; nextCard(); }
  else toast(`Gesucht: ${want}`, 'frog');
});

// Speak
let rec;
$("#btnStartRec").addEventListener('click', ()=>{
  const w = window;
  const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!SR) { toast('Spracheingabe nicht verfügbar.'); return; }
  rec = new SR(); rec.lang = (fieldsForMode()[1]==='la')?'la':'de-DE';
  rec.onresult = (e)=>{ const text = e.results[0][0].transcript; $("#recOut").textContent = 'Erkannt: ' + text; };
  rec.start(); $("#recOut").textContent = '…hört zu';
});
$("#btnStopRec").addEventListener('click', ()=>{ try{ rec && rec.stop(); }catch{} });
$("#btnSelfOk").addEventListener('click', ()=>{ addXP(4); cheer(); });

// Match
function buildMatch() {
  const pool = poolItems().slice().sort(()=>Math.random()-0.5).slice(0,6);
  if (!pool.length){ $("#matchGrid").textContent='Bitte passende Daten importieren.'; return; }
  const [qField, aField] = fieldsForMode();
  const left = pool.map(x=>({id:x.id, t:x[qField]}));
  const right = pool.map(x=>({id:x.id, t:x[aField]})).sort(()=>Math.random()-0.5);
  const wrap = $("#matchGrid");
  wrap.innerHTML = '';
  const sel = {L:null, R:null};
  function renderSide(items, side){
    const col = document.createElement('div');
    col.style.display='grid'; col.style.gap='8px';
    for (const it of items) {
      const b = document.createElement('button'); b.textContent = it.t; b.dataset.id = it.id; b.addEventListener('click',()=>{
        sel[side] = it.id;
        b.classList.add('badge');
        if (sel.L && sel.R) {
          if (sel.L === sel.R) { addXP(3); cheer();
            wrap.querySelectorAll(`[data-id="${sel[side]}"]`).forEach(el=>el.remove());
          } else { toast('Nicht ganz – probier weiter!', 'sheep'); $$('#matchGrid .badge').forEach(x=>x.classList.remove('badge')); }
          sel.L = sel.R = null;
          if (!wrap.querySelector('[data-id]')) buildMatch();
        }
      });
      col.appendChild(b);
    }
    return col;
  }
  const cont = document.createElement('div');
  cont.style.display='grid'; cont.style.gridTemplateColumns='1fr 1fr'; cont.style.gap='12px';
  cont.appendChild(renderSide(left,'L'));
  cont.appendChild(renderSide(right,'R'));
  wrap.appendChild(cont);
}

// Write
$("#btnCheckWrite").addEventListener('click', ()=>{
  const ans = $("#writeInput").value;
  const want = (state.current?.[fieldsForMode()[1]]||'');
  if (isFuzzyMatch(ans, want)) { addXP(6); cheer(); $("#writeInput").value=''; nextCard(); }
  else toast(`Gesucht: ${want}`, 'frog');
});

// Tabs
$("#tabs").addEventListener('click', (e)=>{
  const t = e.target.closest('.tab'); if (!t) return;
  $$('.tab').forEach(x=>x.classList.remove('active')); t.classList.add('active');
  state.mode = t.dataset.tab;
  $$('.activity').forEach(x=>x.classList.add('hidden'));
  $('#'+state.mode).classList.remove('hidden');
  if (state.mode==='quiz') buildQuiz();
  if (state.mode==='match') buildMatch();
  save();
});

// Language, book, lessons
$("#langSelect").addEventListener('change', (e)=>{ state.lang = e.target.value; save(); populateLessons(); buildDue(); nextCard(); if (state.mode==='quiz') buildQuiz(); if (state.mode==='match') buildMatch(); });
$("#bookSelect").addEventListener('change', (e)=>{ state.book = e.target.value; save(); populateLessons(); buildDue(); nextCard(); if (state.mode==='quiz') buildQuiz(); if (state.mode==='match') buildMatch(); });
$("#lessonSelect").addEventListener('change', ()=>{ buildDue(); nextCard(); if (state.mode==='quiz') buildQuiz(); if (state.mode==='match') buildMatch(); });

// Footer parent button + modal
$("#btnParent").addEventListener('click', ()=>{ $("#parentModal").classList.remove('hidden'); renderParent(); });
$("#btnCloseParent").addEventListener('click', ()=> $("#parentModal").classList.add('hidden'));

// Parent modal
function renderParent(){
  const sel = $("#kidSelect"); sel.innerHTML='';
  Object.keys(state.profiles).forEach(name=>{
    const opt = document.createElement('option'); opt.value=name; opt.textContent=name; sel.appendChild(opt);
  });
  sel.value = state.activeKid;
  $("#goalLessons").value = (P().goals.lessons||[]).join(', ');
  $("#goalMinutes").value = P().goals.minutes||15;
  $("#reminders").checked = !!P().scheduleNoti;
  renderProgress();
}
$("#kidSelect").addEventListener('change', (e)=>{ setKid(e.target.value); });
$("#btnAddKid").addEventListener('click', ()=>{
  const name = prompt('Name des Kindes?');
  if (!name) return;
  if (state.profiles[name]) { alert('Name existiert bereits.'); return; }
  state.profiles[name] = defaultProfile();
  setKid(name);
  renderParent();
  save();
});

$("#btnSaveGoal").addEventListener('click', ()=>{
  P().goals.lessons = $("#goalLessons").value.split(',').map(s=>s.trim()).filter(Boolean);
  P().goals.minutes = parseInt($("#goalMinutes").value||'15',10);
  save(); toast('Ziel gespeichert.');
});
$("#reminders").addEventListener('change', (e)=>{
  if (e.target.checked) scheduleDailyReminder(17);
  else { P().scheduleNoti=false; save(); toast('Erinnerungen deaktiviert.'); }
});

$("#btnImport").addEventListener('click', async ()=>{
  const file = $("#fileInput").files[0];
  const book = $("#bookName").value.trim();
  const base = $("#baseLang").value;
  if (!file || !book) { toast('Datei und Buchname angeben.', 'sheep'); return; }
  const text = await file.text();
  let records = [];
  if (file.name.endsWith('.json')) { records = JSON.parse(text); } else { records = parseCSV(text); }
  const items = normalize(records, book, base);
  if (!items.length) { toast('Konnte keine Vokabeln erkennen.', 'sheep'); return; }
  const key = (o)=> [o.book, o.base, o.de||'', o.la||'', o.en||''].join('|');
  const existing = new Set(state.data.map(key));
  let added = 0;
  for (const it of items) if (!existing.has(key(it))) { state.data.push(it); added++; }
  save();
  populateBooks();
  $("#bookSelect").value = book; state.book = book;
  populateLessons();
  buildDue(); nextCard();
  toast(`Import ok: ${added} Einträge`, 'turtle');
});

function renderProgress() {
  const list = $("#progressList"); if (!list) return; list.innerHTML='';
  const p = P();
  const items = [
    `Heute: ${p.reviewsToday} Aufgaben, ${p.xp} XP gesamt`,
    `Streak: ${p.streak} Tage`,
    p.goals.lessons?.length ? `Ziel‑Lektionen heute: ${p.goals.lessons.join(', ')}` : 'Kein Lektionen‑Ziel gesetzt',
    `Zeit‑Ziel: ${p.goals.minutes} Minuten`,
    state.book ? `Aktuelles Buch: ${state.book}` : 'Kein Buch gewählt'
  ];
  for (const it of items) {
    const div = document.createElement('div'); div.textContent = it; list.appendChild(div);
  }
}

// Init
function init(){
  applyTheme(state.theme);
  const sel = $("#themePills");
  populateBooks();
  populateLessons();
  refreshKpis();
  buildDue();
  nextCard();
  setTimeout(cheer, 1000);
}
init();
