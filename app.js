
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const DBKEY = 'vocab-helden-v7';
const state = {
  data: [], // {id, book, base:'latin'|'english', lesson, de, la, en}
  mode: 'flash',
  lang: 'latin',
  book: null,
  themes: [
    {id:'ocean', name:'Ocean', vars:{bg:'#0b132b', panel:'#1c2541', accent:'#3a86ff', text:'#f6f7fb', btn:'#0d1b2a'}},
    {id:'forest', name:'Forest', vars:{bg:'#0b2b1a', panel:'#163822', accent:'#34d399', text:'#eafff3', btn:'#0a1f14'}},
    {id:'sunset', name:'Sunset', vars:{bg:'#2b0b14', panel:'#3a1421', accent:'#ff7a59', text:'#fff4f0', btn:'#2a0e15'}},
    {id:'contrast', name:'Kontrast', vars:{bg:'#000000', panel:'#111111', accent:'#ffd60a', text:'#ffffff', btn:'#1c1c1c'}},
  ],
  theme: 'ocean',
  profiles: {},
  activeKid: null,
  quizRound: null,
  firstWrongInRound: false,
  writeAwaitNext: false
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
function save() { localStorage.setItem(DBKEY, JSON.stringify(state)); }
load();

// THEME
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
}
function openThemePopup(){
  const pop = $("#themePopup");
  const dots = $("#themeDots"); dots.innerHTML='';
  state.themes.forEach(t=>{
    const d = document.createElement('button');
    d.className = 'theme-dot'+(state.theme===t.id?' active':'');
    d.style.background = t.vars.accent;
    d.title = t.name;
    d.addEventListener('click', ()=>{ applyTheme(t.id); renderDots(); });
    dots.appendChild(d);
  });
  function renderDots(){
    $$("#themeDots .theme-dot").forEach((b,i)=>{
      const id = state.themes[i].id;
      b.classList.toggle('active', id===state.theme);
    });
  }
  renderDots();
  pop.classList.remove('hidden');
}
function closeThemePopup(){ $("#themePopup").classList.add('hidden'); }

// TOAST + MASCOTS
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

// PROFILES
function P(){ return state.profiles[state.activeKid]; }
function setKid(name){ state.activeKid = name; save(); refreshKpis(); renderProgress(); }
function refreshKpis(){
  $("#xp").textContent = P().xp;
  $("#streak").textContent = P().streak;
  $("#kidBadge").textContent = state.activeKid;
}

// CSV/JSON IMPORT
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

function availableLangOptions(){
  const pool = state.data.filter(d=> d.book===state.book);
  const bases = new Set(pool.map(d=>d.base));
  const opts = [];
  if (bases.has('latin')) { opts.push(['latin','Latein → Deutsch'], ['latin_rev','Deutsch → Latein']); }
  if (bases.has('english')) { opts.push(['english','Englisch → Deutsch'], ['english_rev','Deutsch → Englisch']); }
  return opts;
}
function populateLangSelect(){
  const sel = $("#langSelect"); sel.innerHTML='';
  const opts = availableLangOptions();
  if (!opts.length) {
    sel.appendChild(new Option('(keine Richtung)', 'latin'));
    return;
  }
  let found=false;
  for (const [val,label] of opts){
    const o = new Option(label, val); sel.appendChild(o);
    if (state.lang===val) found=true;
  }
  if (!found) state.lang = opts[0][0];
  sel.value = state.lang;
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

// Notifications (local reminder)
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

// Spaced Repetition
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
  save();
  buildDue();
}
function pickDueOrPool(pool){
  const p = P();
  const dueIds = (p.due||[]).filter(id => pool.some(x=>x.id===id));
  return dueIds.length ? pool.filter(d=>dueIds.includes(d.id)) : pool;
}

// Fuzzy & exact helpers
function normalizeText(t){
  return (t||'')
    .toLowerCase()
    .replace(/\b(der|die|das|ein|eine|the|a|an)\b/g,'')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-zäöüß \-]/g,'')
    .replace(/\s+/g,' ')
    .trim();
}
function splitAlternatives(s){
  return String(s||'').split(/[,/;]| oder |\bor\b/).map(x=>x.trim()).filter(Boolean);
}
function exactOrAltMatch(opt, correctText){
  const A = normalizeText(opt);
  const alts = splitAlternatives(correctText).map(normalizeText);
  return alts.includes(A);
}
function isNearMiss(ans, want){
  const A = normalizeText(ans);
  const alts = splitAlternatives(want).map(normalizeText);
  function lev(a,b){
    const m=a.length,n=b.length;
    if(!m) return n; if(!n) return m;
    const dp = Array(n+1).fill(0).map((_,j)=>j);
    for(let i=1;i<=m;i++){
      let prev = dp[0]; dp[0]=i;
      for(let j=1;j<=n;j++){
        const tmp = dp[j];
        const cost = a[i-1]===b[j-1]?0:1;
        dp[j] = Math.min(dp[j]+1, dp[j-1]+1, prev+cost);
        prev = tmp;
      }
    }
    return dp[n];
  }
  for(const W of alts){
    const len = W.length;
    let tol = 0;
    if(len <= 4) tol = 0;
    else if(len <= 7) tol = 1;
    else tol = Math.max(2, Math.floor(len*0.15));
    if (A !== W){
      const d = lev(A, W);
      if (d > 0 && d <= tol) return true;
    }
  }
  return false;
}

// NEXT CARD
function nextCard() {
  if (!state.data.length || !state.book) { $("#flashCard").textContent = "Bitte Daten importieren und Buch wählen."; return; }
  const [qField, aField] = fieldsForMode();
  const pool = poolItems();
  if (!pool.length){ $("#flashCard").textContent = "Keine passenden Vokabeln in diesem Buch/Modus."; return; }
  const arr = pickDueOrPool(pool);
  const pick = arr[Math.floor(Math.random()*arr.length)];
  state.current = pick;

  // Flash
  $("#flashCard").textContent = pick[qField] || '–';
  $("#flash").classList.remove('revealed');

  // Write
  $("#writePrompt").textContent = pick[qField] ? `Was bedeutet „${pick[qField]}“?` : 'Was bedeutet …?';
  $("#writeFeedback").textContent = '';
  $("#writeCard").classList.remove('ok','bad');
  $("#writeInput").value='';
  $("#btnCheckWrite").textContent='Prüfen';
  state.writeAwaitNext = false;

  // Listen (no word revealed)
  $("#listenPrompt").textContent = '🎧 Wir sprechen ein Wort – übersetze es.';
  $("#listenInput").value='';

  // Speak (show what to translate)
  $("#speakPrompt").textContent = pick[qField] ? `🎙️ Sprich die Übersetzung von: „${pick[qField]}“` : '🎙️ Sprich die Übersetzung.';

  // focus input if in write mode
  if (!$('#write').classList.contains('hidden')) {
    setTimeout(()=> $("#writeInput")?.focus(), 50);
  }
}

// FLASHCARDS
$("#btnShow").addEventListener('click', ()=>{
  const [qField, aField] = fieldsForMode();
  const q = state.current ? (state.current[qField] || '') : '';
  const a = state.current ? (state.current[aField] || '') : '';
  $("#flashCard").innerHTML = `<div>${q}</div><div class="badge">${a}</div>`;
  $("#flash").classList.add('revealed');
});
$("#btnEasy").addEventListener('click', ()=> { reviewOutcome(5); addXP(8); cheer(); nextCard(); });
$("#btnGood").addEventListener('click', ()=> { reviewOutcome(4); addXP(6); cheer(); nextCard(); });
$("#btnHard").addEventListener('click', ()=> { reviewOutcome(2); addXP(3); cheer(); nextCard(); });

// QUIZ
function buildQuiz() {
  const pool = poolItems();
  const prompt = $("#quizPrompt"), wrap = $("#quizOptions");
  if (pool.length < 4) { prompt.textContent="Bitte mehr Vokabeln importieren."; wrap.innerHTML=''; return; }
  const [qField, aField] = fieldsForMode();
  const arr = pickDueOrPool(pool);
  const correct = arr[Math.floor(Math.random()*arr.length)];
  state.current = correct;
  state.firstWrongInRound = false;

  prompt.textContent = correct[qField];
  const correctText = correct[aField];

  const options = new Set([correctText]);
  while (options.size < 4) options.add(pool[Math.floor(Math.random()*pool.length)][aField]);
  const shuffled = [...options].sort(()=>Math.random()-0.5);

  wrap.innerHTML = '';
  shuffled.forEach(opt => {
    const b = document.createElement('button'); b.textContent = opt;
    b.addEventListener('click', ()=>{
      const good = exactOrAltMatch(opt, correctText);
      if (good){
        b.classList.add('ok');
        wrap.querySelectorAll('button').forEach(x=> x.disabled = true);
        setTimeout(()=>{
          reviewOutcome(state.firstWrongInRound ? 2 : 4);
          addXP(state.firstWrongInRound ? 3 : 5);
          cheer();
          buildQuiz();
        }, 500);
      } else {
        state.firstWrongInRound = true;
        b.classList.add('bad');
        b.disabled = true; // keep round until correct clicked
      }
    });
    wrap.appendChild(b);
  });
}

// LISTEN
const synth = window.speechSynthesis;
function speak(text, lang) {
  if (!synth) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  synth.cancel(); synth.speak(u);
}
$("#btnSpeak").addEventListener('click', ()=>{
  if (!state.current) nextCard();
  const [qField] = fieldsForMode();
  const langCode = (qField==='la') ? 'la' : (qField==='en' ? 'en-US' : 'de-DE');
  speak(state.current[qField], langCode);
});
$("#btnCheckListen").addEventListener('click', ()=>{
  const ans = $("#listenInput").value;
  const want = (state.current?.[fieldsForMode()[1]]||'');
  const fb = $("#listenPrompt");

  const exact = exactOrAltMatch(ans, want);
  const near  = !exact && isNearMiss(ans, want);

  if (exact){
    fb.classList.add('ok'); fb.classList.remove('bad'); fb.textContent='Richtig!';
    reviewOutcome(4); addXP(6); cheer();
    setTimeout(()=>{ fb.classList.remove('ok'); $("#listenInput").value=''; nextCard(); }, 500);
  } else if (near){
    fb.classList.add('bad'); fb.textContent=`Fast richtig (Tippfehler). Gesucht: ${splitAlternatives(want).join(', ')}`;
    reviewOutcome(2); addXP(2);
    setTimeout(()=>{ fb.classList.remove('bad'); $("#listenInput").value=''; nextCard(); }, 700);
  } else {
    fb.classList.add('bad'); fb.textContent=`Gesucht: ${splitAlternatives(want).join(', ')}`;
    reviewOutcome(2);
    setTimeout(()=>{ fb.classList.remove('bad'); $("#listenInput").value=''; nextCard(); }, 700);
  }
});

// SPEAK
let rec;
$("#btnStartRec").addEventListener('click', ()=>{
  const w = window;
  const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!SR) { toast('Spracheingabe nicht verfügbar.'); return; }
  rec = new SR(); rec.lang = (fieldsForMode()[1]==='la')?'la':'de-DE';
  rec.onresult = (e)=>{
    const text = e.results[0][0].transcript;
    $("#recOut").textContent = 'Erkannt: ' + text;
    const want = (state.current?.[fieldsForMode()[1]] || '');
    const exact = exactOrAltMatch(text, want);
    const near  = !exact && isNearMiss(text, want);
    if (exact){ reviewOutcome(4); addXP(5); cheer(); nextCard(); }
    else if (near){ toast('Fast richtig (Tippfehler)','sheep'); reviewOutcome(2); nextCard(); }
    else { toast('Nochmal versuchen!','frog'); reviewOutcome(2); }
  };
  rec.start(); $("#recOut").textContent = '…hört zu';
});
$("#btnStopRec").addEventListener('click', ()=>{ try{ rec && rec.stop(); }catch{} });
$("#btnSelfOk").addEventListener('click', ()=>{ reviewOutcome(4); addXP(4); cheer(); nextCard(); });

// MATCH (keep buttons visible, solved state)
function buildMatch() {
  const pool = poolItems().slice().sort(()=>Math.random()-0.5).slice(0,8);
  if (!pool.length){ $("#matchGrid").textContent='Bitte passende Daten importieren.'; return; }
  const [qField, aField] = fieldsForMode();
  const left = pool.map(x=>({id:x.id, t:x[qField]}));
  const right= pool.map(x=>({id:x.id, t:x[aField]})).sort(()=>Math.random()-0.5);
  const wrap = $("#matchGrid");
  wrap.innerHTML = '';
  let selectedLeft = null;
  const solved = new Set();

  function renderColumn(items, side){
    const col = document.createElement('div');
    col.style.display='grid'; col.style.gap='8px';
    items.forEach(it=>{
      const b=document.createElement('button'); b.textContent=it.t; b.dataset.id=it.id;
      b.addEventListener('click', ()=>{
        if (solved.has(it.id)) return;
        if (side==='L'){
          $$('#matchGrid .selected').forEach(x=>x.classList.remove('selected'));
          selectedLeft = it.id; b.classList.add('selected'); // strong white border
        } else {
          if (!selectedLeft){ b.classList.add('bad'); setTimeout(()=>b.classList.remove('bad'), 500); return; }
          const leftBtn = wrap.querySelector(`[data-id="${selectedLeft}"]`);
          const isMatch = selectedLeft === it.id;
          if (isMatch){
            leftBtn.classList.add('ok','solved'); leftBtn.disabled = true;
            b.classList.add('ok','solved'); b.disabled = true;
            solved.add(it.id);
            state.current = pool.find(x=>x.id===it.id);
            reviewOutcome(4); addXP(3); cheer();
            selectedLeft = null;
            if (solved.size === pool.length){
              setTimeout(()=> buildMatch(), 600);
            }
          } else {
            leftBtn.classList.add('bad'); b.classList.add('bad');
            setTimeout(()=>{ leftBtn.classList.remove('bad'); b.classList.remove('bad'); }, 500);
            state.current = pool.find(x=>x.id===selectedLeft);
            reviewOutcome(2);
          }
        }
      });
      col.appendChild(b);
    });
    return col;
  }
  const cont=document.createElement('div');
  cont.style.display='grid'; cont.style.gridTemplateColumns='1fr 1fr'; cont.style.gap='12px';
  cont.appendChild(renderColumn(left,'L'));
  cont.appendChild(renderColumn(right,'R'));
  wrap.appendChild(cont);
}

// WRITE
$("#btnCheckWrite").addEventListener('click', ()=>{
  if (state.writeAwaitNext){ nextCard(); $("#writeInput").focus(); return; }
  const ans = $("#writeInput").value;
  const want = (state.current?.[fieldsForMode()[1]]||'');
  const fb = $("#writeFeedback");
  const full = splitAlternatives(want).join(', ');

  const exact = exactOrAltMatch(ans, want);
  const near  = !exact && isNearMiss(ans, want);

  if (exact){
    fb.textContent = `Richtig: ${full}`;
    $("#writeCard").classList.add('ok'); $("#writeCard").classList.remove('bad');
    reviewOutcome(4); addXP(6); cheer();
  } else if (near){
    fb.textContent = `Fast richtig (Tippfehler). Gesucht: ${full}`;
    $("#writeCard").classList.add('bad'); $("#writeCard").classList.remove('ok');
    reviewOutcome(2); addXP(2);
  } else {
    fb.textContent = `Gesucht: ${full}`;
    $("#writeCard").classList.add('bad'); $("#writeCard").classList.remove('ok');
    reviewOutcome(2);
  }
  $("#btnCheckWrite").textContent = 'Weiter';
  state.writeAwaitNext = true;
  $("#writeInput").value = '';
});
$("#writeInput").addEventListener('keydown', (e)=>{ if (e.key==='Enter') $("#btnCheckWrite").click(); });

// TABS
$("#tabs").addEventListener('click', (e)=>{
  const t = e.target.closest('.tab'); if (!t) return;
  $$('.tab').forEach(x=>x.classList.remove('active')); t.classList.add('active');
  state.mode = t.dataset.tab;
  $$('.activity').forEach(x=>x.classList.add('hidden'));
  $('#'+state.mode).classList.remove('hidden');
  if (state.mode==='quiz') buildQuiz();
  if (state.mode==='match') buildMatch();
  if (state.mode==='write') setTimeout(()=> $("#writeInput")?.focus(), 50);
  save();
});

// Language, book, lessons
$("#langSelect").addEventListener('change', (e)=>{ state.lang = e.target.value; save(); populateLessons(); buildDue(); nextCard(); if (state.mode==='quiz') buildQuiz(); if (state.mode==='match') buildMatch(); });
$("#bookSelect").addEventListener('change', (e)=>{ state.book = e.target.value; save(); populateLangSelect(); populateLessons(); buildDue(); nextCard(); if (state.mode==='quiz') buildQuiz(); if (state.mode==='match') buildMatch(); });
$("#lessonSelect").addEventListener('change', ()=>{ buildDue(); nextCard(); if (state.mode==='quiz') buildQuiz(); if (state.mode==='match') buildMatch(); });

// Footer: theme popup
$("#btnTheme").addEventListener('click', ()=>{
  const pop = $("#themePopup");
  if (pop.classList.contains('hidden')) openThemePopup(); else closeThemePopup();
});
document.addEventListener('click', (e)=>{
  const pop = $("#themePopup");
  if (!pop.classList.contains('hidden') && !pop.contains(e.target) && e.target.id!=='btnTheme'){ closeThemePopup(); }
});

// Filters collapse
$("#btnFilters").addEventListener('click', ()=>{
  const box = $("#filters");
  const open = !box.classList.contains('open');
  box.classList.toggle('open', open);
  $("#btnFilters").textContent = open? 'Ausblenden' : 'Einblenden';
});

// Footer parent button + modal, lock background scroll
$("#btnParent").addEventListener('click', ()=>{ $("#parentModal").classList.remove('hidden'); document.body.classList.add('no-scroll'); renderParent(); });
$("#btnCloseParent").addEventListener('click', ()=> { $("#parentModal").classList.add('hidden'); document.body.classList.remove('no-scroll'); });

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
  $("#importStatus").textContent = '';
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
  const btn = $("#btnImport"), status = $("#importStatus");
  const file = $("#fileInput").files[0];
  const book = $("#bookName").value.trim();
  const base = $("#baseLang").value;
  if (!file || !book) { toast('Datei und Buchname angeben.', 'sheep'); return; }
  btn.disabled = true; const oldTxt = btn.textContent; btn.textContent = 'Importiere…'; status.textContent = 'Import läuft…';
  try {
    const text = await file.text();
    let records = [];
    if (file.name.endsWith('.json')) { records = JSON.parse(text); } else { records = parseCSV(text); }
    const items = normalize(records, book, base);
    if (!items.length) { status.textContent = 'Keine Vokabeln erkannt.'; toast('Konnte keine Vokabeln erkennen.', 'sheep'); return; }
    const key = (o)=> [o.book, o.base, o.de||'', o.la||'', o.en||''].join('|');
    const existing = new Set(state.data.map(key));
    let added = 0;
    for (const it of items) if (!existing.has(key(it))) { state.data.push(it); added++; }
    save();
    populateBooks();
    $("#bookSelect").value = book; state.book = book;
    populateLangSelect();
    populateLessons();
    buildDue(); nextCard();
    status.textContent = `Import ok: ${added} Einträge`;
    toast(`Import ok: ${added} Einträge`, 'turtle');
  } catch(err){
    status.textContent = 'Fehler beim Import.';
  } finally {
    btn.disabled = false; btn.textContent = oldTxt;
  }
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

// INIT
function init(){
  applyTheme(state.theme);
  populateBooks();
  populateLangSelect();
  populateLessons();
  refreshKpis();
  buildDue();
  nextCard();
  setTimeout(cheer, 1000);
}
init();
