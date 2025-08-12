
// ===== Utilities & Storage =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const DBKEY = 'vocab-helden-v1';
const state = {
  data: [], // normalized: {id, lesson, de, la, en}
  due: [],  // ids due now (flashcards)
  current: null,
  mode: 'flash',
  lang: 'latin',
  kids: ['Kind A','Kind B'],
  activeKid: 0,
  xp: 0,
  streak: 0,
  lastDay: null,
  reviewsToday: 0,
  goals: { lessons: [], minutes: 15 },
  scheduleNoti: false,
  perCard: {} // id -> {EF, interval, due, reps}
};

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(DBKEY) || '{}');
    Object.assign(state, saved);
    if (state.lastDay && new Date(state.lastDay).toDateString() !== new Date().toDateString()) {
      state.reviewsToday = 0;
    }
  } catch(e){ console.warn(e); }
}
function save() {
  const {data, perCard, xp, streak, lastDay, reviewsToday, goals, scheduleNoti, lang} = state;
  localStorage.setItem(DBKEY, JSON.stringify({data, perCard, xp, streak, lastDay, reviewsToday, goals, scheduleNoti, lang}));
}
load();

// Quotes + mascots
const QUOTES = [
  ["turtle","Langsam ist auch schnell – Schritt für Schritt!"],
  ["frog","Sprung! Ein Punkt mehr in Richtung Meisterschaft!"],
  ["sheep","Mäh‑gnifique! So merkt man's sich!"],
  ["turtle","Kleine Siege bringen große Erfolge."],
  ["frog","Quak! Neue XP erbeutet!"],
  ["sheep","Wolllah! Weiter so!"]
];
function cheer() {
  const [id, text] = QUOTES[Math.floor(Math.random()*QUOTES.length)];
  $("#mascot use").setAttribute('href', `assets/mascots.svg#${id}`);
  $("#quote").textContent = text;
  toast(text);
}

function toast(msg) {
  let t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<div class="msg">${msg}</div>`;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(), 1800);
}

// ===== CSV/JSON Import =====
function parseCSV(text) {
  // Tiny CSV parser with quotes support
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

function normalize(records) {
  // Try to infer columns: deutsch/de, latein/lat/la, englisch/en, lektion/lesson
  const norm = [];
  for (const r of records) {
    const keys = Object.fromEntries(Object.keys(r).map(k=>[k.toLowerCase(), k]));
    const de = r[keys.deutsch] ?? r[keys.de] ?? r[keys.german] ?? r[keys['de']] ?? '';
    const la = r[keys.latein] ?? r[keys.latin] ?? r[keys.lat] ?? r[keys.la] ?? '';
    const en = r[keys.englisch] ?? r[keys.english] ?? r[keys.en] ?? '';
    const lesson = r[keys.lektion] ?? r[keys.lesson] ?? r[keys.lektion_nr] ?? r[keys.kapitel] ?? r[keys['lektion ']] ?? '1';
    if ((de && la) || (de && en)) {
      norm.push({ id: crypto.randomUUID(), lesson: String(lesson).trim(), de: (de||'').trim(), la: (la||'').trim(), en: (en||'').trim() });
    }
  }
  return norm;
}

function populateLessons() {
  const sel = $("#lessonSelect");
  sel.innerHTML = '';
  const lessons = [...new Set(state.data.map(d=>d.lesson))].sort((a,b)=> (a*1)-(b*1));
  for (const L of lessons) {
    const opt = document.createElement('option');
    opt.value = L; opt.textContent = 'Lektion ' + L;
    sel.appendChild(opt);
  }
}

$("#btnImport").addEventListener('click', ()=> $("#fileInput").click());
$("#fileInput").addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  let records = [];
  if (file.name.endsWith('.json')) {
    records = JSON.parse(text);
  } else {
    records = parseCSV(text);
  }
  const items = normalize(records);
  if (!items.length) { toast('Konnte keine Vokabeln erkennen.'); return; }
  // merge (avoid duplicates by de+la/en)
  const key = (o)=> (o.de+'|'+(o.la||'')+'|'+(o.en||''));
  const existing = new Set(state.data.map(key));
  for (const it of items) if (!existing.has(key(it))) state.data.push(it);
  save();
  populateLessons();
  toast(`Import ok: ${items.length} Einträge`);
  buildDue();
  nextCard();
});

// ===== Scheduling / Notifications (best-effort local) =====
async function ensureNotifications() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission !== 'denied') {
    const perm = await Notification.requestPermission();
    return perm === 'granted';
  }
  return false;
}

function scheduleDailyReminder(hour=17) {
  // Local non-persistent reminder: when app opens after target hour and lastSeen < today, show a notification.
  state.scheduleNoti = true; save();
  ensureNotifications().then(granted => {
    if (!granted) { toast('Benachrichtigungen nicht erlaubt.'); return; }
    const check = () => {
      const now = new Date();
      if (now.getHours() >= hour && localStorage.getItem('remindedDay') !== now.toDateString()) {
        new Notification('Vokabelhelden', { body:'Kurze Vokabelrunde? 🔥', badge:'icons/icon-192.png', icon:'icons/icon-192.png' });
        localStorage.setItem('remindedDay', now.toDateString());
      }
    };
    check();
    setInterval(check, 60*60*1000); // hourly while app is open
  });
}

// ===== Streak & XP =====
function addXP(n=5) {
  state.xp += n;
  const todayStr = new Date().toDateString();
  if (state.lastDay !== todayStr) {
    const y = new Date(state.lastDay||Date.now()-86400000);
    const diff = Math.floor((new Date(todayStr) - new Date(y.toDateString()))/86400000);
    state.streak = (diff === 1) ? (state.streak+1) : 1;
    state.lastDay = todayStr;
  }
  state.reviewsToday++;
  save();
  $("#xp").textContent = state.xp;
  $("#streak").textContent = state.streak;
}

// ===== Spaced Repetition (SM-2 light) =====
function buildDue() {
  const now = Date.now();
  state.due = state.data.filter(d => {
    const s = state.perCard[d.id];
    return !s || !s.due || s.due <= now;
  }).map(d=>d.id);
}

function reviewOutcome(quality) {
  // quality: 0..5 (hard=2, good=4, easy=5)
  const id = state.current?.id; if (!id) return;
  let s = state.perCard[id] || { EF: 2.5, interval: 0, reps: 0, due: 0 };
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
  state.perCard[id] = s;
  addXP(5 + (quality>=4?3:0));
  save();
  cheer();
  buildDue();
  nextCard();
}

// ===== Language helpers =====
function fieldsForMode() {
  switch(state.lang){
    case 'latin': return ['la', 'de'];
    case 'latin_rev': return ['de', 'la'];
    case 'english': return ['en', 'de'];
    case 'english_rev': return ['de', 'en'];
  }
}

function filterByLessons() {
  const sel = $("#lessonSelect");
  const chosen = Array.from(sel.selectedOptions).map(o=>o.value);
  const all = chosen.length? state.data.filter(d=>chosen.includes(d.lesson)) : state.data;
  return all;
}

// ===== Activities =====
function nextCard() {
  if (!state.data.length) { $("#flashCard").textContent = "Bitte Daten importieren."; return; }
  const [qField, aField] = fieldsForMode();
  // pick due first
  const pool = filterByLessons().filter(d => state.due.includes(d.id));
  const arr = pool.length ? pool : filterByLessons();
  const pick = arr[Math.floor(Math.random()*arr.length)];
  state.current = pick;
  $("#flashCard").textContent = pick[qField] || '–';
  $("#flashCard").dataset.answer = pick[aField] || '–';
}

$("#btnShow").addEventListener('click', ()=>{
  $("#flashCard").innerHTML = `<div>${state.current ? (state.current[fieldsForMode()[0]]||'') : ''}</div>
  <div class="badge">${state.current ? (state.current[fieldsForMode()[1]]||'') : ''}</div>`;
});

$("#btnEasy").addEventListener('click', ()=> reviewOutcome(5));
$("#btnGood").addEventListener('click', ()=> reviewOutcome(4));
$("#btnHard").addEventListener('click', ()=> reviewOutcome(2));

// Quiz
function buildQuiz() {
  const pool = filterByLessons();
  if (pool.length < 4) { $("#quizPrompt").textContent="Bitte mehr Vokabeln importieren."; return; }
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
      if (opt === correct[aField]) { addXP(5); cheer(); buildQuiz(); }
      else { toast('Knapp daneben – weiter!'); }
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
  const ans = $("#listenInput").value.trim().toLowerCase();
  const want = (state.current?.[fieldsForMode()[1]]||'').toLowerCase();
  if (ans && want && (ans === want)) { addXP(6); cheer(); $("#listenInput").value=''; nextCard(); }
  else toast(`Gesucht: ${want}`);
});

// Speak (Web Speech API)
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
  const pool = filterByLessons().slice().sort(()=>Math.random()-0.5).slice(0,6);
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
          if (sel.L === sel.R) { addXP(3); cheer(); // remove matched
            col.querySelector(`[data-id="${sel[side]}"]`)?.remove();
            wrap.querySelector(`[data-id="${sel[side]}"]`)?.remove();
          } else { toast('Nicht ganz – probier weiter!'); $$('#matchGrid .badge').forEach(x=>x.classList.remove('badge')); }
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
  const ans = $("#writeInput").value.trim().toLowerCase();
  const want = (state.current?.[fieldsForMode()[1]]||'').toLowerCase();
  if (ans && want && (ans === want)) { addXP(6); cheer(); $("#writeInput").value=''; nextCard(); }
  else toast(`Gesucht: ${want}`);
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

// Language & lessons
$("#langSelect").addEventListener('change', (e)=>{ state.lang = e.target.value; save(); nextCard(); if (state.mode==='quiz') buildQuiz(); if (state.mode==='match') buildMatch(); });
$("#lessonSelect").addEventListener('change', ()=>{ buildDue(); nextCard(); if (state.mode==='quiz') buildQuiz(); if (state.mode==='match') buildMatch(); });

// Theme
let dark = true;
$("#btnTheme").addEventListener('click', ()=>{
  dark = !dark;
  document.documentElement.style.setProperty('--bg', dark?'#0b132b':'#f7f7fb');
  document.documentElement.style.setProperty('--panel', dark?'#1c2541':'#ffffff');
  document.documentElement.style.setProperty('--text', dark?'#0b132b':'#0b132b');
  document.body.style.color = dark?'#f6f7fb':'#0b132b';
});

// Parent: goals + reminders + progress
$("#btnSaveGoal").addEventListener('click', ()=>{
  state.goals.lessons = $("#goalLessons").value.split(',').map(s=>s.trim()).filter(Boolean);
  state.goals.minutes = parseInt($("#goalMinutes").value||'15',10);
  save(); toast('Ziel gespeichert.');
});
$("#reminders").addEventListener('change', (e)=>{
  if (e.target.checked) scheduleDailyReminder(17);
  else { state.scheduleNoti=false; save(); toast('Erinnerungen deaktiviert.'); }
});

function renderProgress() {
  const list = $("#progressList"); list.innerHTML='';
  const today = new Date().toLocaleDateString();
  const items = [
    `Heute: ${state.reviewsToday} Aufgaben, ${state.xp} XP gesamt`,
    `Streak: ${state.streak} Tage`,
    state.goals.lessons.length ? `Ziel‑Lektionen heute: ${state.goals.lessons.join(', ')}` : 'Kein Lektionen‑Ziel gesetzt',
    `Zeit‑Ziel: ${state.goals.minutes} Minuten`
  ];
  for (const it of items) {
    const div = document.createElement('div'); div.textContent = it; list.appendChild(div);
  }
}

function init() {
  $("#xp").textContent = state.xp;
  $("#streak").textContent = state.streak;
  populateLessons();
  buildDue();
  nextCard();
  renderProgress();
  if (state.scheduleNoti) scheduleDailyReminder(17);
  // preload a fun cheer
  setTimeout(cheer, 1200);
}
init();
