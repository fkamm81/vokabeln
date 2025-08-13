
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

const DBKEY = 'vocab-helden-release';
const state = {
  data: [],
  mode: 'flash',
  lang: 'latin',
  book: null,
  themes: [
    {id:'ocean', name:'Ocean', vars:{bg:'#0b132b', panel:'#1c2541', accent:'#3a86ff', text:'#f6f7fb', btn:'#0d1b2a'}},
    {id:'forest', name:'Forest', vars:{bg:'#0b2b1a', panel:'#163822', accent:'#34d399', text:'#eafff3', btn:'#0a1f14'}},
    {id:'sunset', name:'Sunset', vars:{bg:'#2b0b14', panel:'#3a1421', accent:'#ff7a59', text:'#fff4f0', btn:'#2a0e15'}},
    {id:'contrast', name:'Kontrast', vars:{bg:'#000', panel:'#111', accent:'#ffd60a', text:'#fff', btn:'#1c1c1c'}},
  ],
  theme: 'ocean',
  profiles: {},
  activeKid: null,
  lastByMode: {},
  currentByMode: {},
  firstWrongInRound: false,
  writeAwaitNext: false
};

function defaultProfile(){ return { xp:0, streak:0, lastDay:null, reviewsToday:0, perCard:{}, goals:{lessons:[], minutes:15}, scheduleNoti:false }; }
function load(){
  try{
    const saved = JSON.parse(localStorage.getItem(DBKEY)||'{}');
    Object.assign(state, saved);
    if(!state.activeKid){
      state.profiles["Kind 1"] = state.profiles["Kind 1"] || defaultProfile();
      state.profiles["Kind 2"] = state.profiles["Kind 2"] || defaultProfile();
      state.activeKid = "Kind 1";
    }
    for(const k in state.profiles){
      const p = state.profiles[k];
      if(p.lastDay && new Date(p.lastDay).toDateString() !== new Date().toDateString()) p.reviewsToday = 0;
    }
  }catch(e){}
}
function save(){ localStorage.setItem(DBKEY, JSON.stringify(state)); }
load();

function applyTheme(id){
  const theme = state.themes.find(t=>t.id===id) || state.themes[0];
  state.theme = theme.id; save();
  const root = document.documentElement;
  root.style.setProperty('--bg', theme.vars.bg);
  root.style.setProperty('--panel', theme.vars.panel);
  root.style.setProperty('--accent', theme.vars.accent);
  root.style.setProperty('--text', theme.vars.text);
  root.style.setProperty('--btn', theme.vars.btn || '#0d1b2a');
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
  function renderDots(){ $$("#themeDots .theme-dot").forEach((b,i)=>{ const id = state.themes[i].id; b.classList.toggle('active', id===state.theme); }); }
  renderDots();
  pop.classList.remove('hidden');
}
function closeThemePopup(){ $("#themePopup").classList.add('hidden'); }

// toasts disabled
function toast(){}
function cheer(){}

const QUOTES=[];

function P(){ return state.profiles[state.activeKid]; }
function setKid(name){ state.activeKid = name; save(); refreshKpis(); renderProgress(); }
function refreshKpis(){ $("#xp").textContent = P().xp; $("#streak").textContent = P().streak; $("#kidBadge").textContent = state.activeKid; }

// CSV/JSON IMPORT
function parseCSV(text){
  const rows=[]; let row=[], field='', inQuotes=false;
  for(let i=0;i<text.length;i++){
    const c=text[i], n=text[i+1];
    if(c==='\"'){ if(inQuotes && n==='\"'){ field+='\"'; i++; } else inQuotes=!inQuotes; }
    else if(c===',' && !inQuotes){ row.push(field.trim()); field=''; }
    else if((c==='\n'||c==='\r') && !inQuotes){ if(field!==''||row.length){ row.push(field.trim()); rows.push(row); row=[]; field=''; } }
    else field+=c;
  }
  if(field!==''||row.length){ row.push(field.trim()); rows.push(row); }
  const header = rows.shift().map(h=>h.toLowerCase());
  return rows.map(r=>Object.fromEntries(header.map((h,i)=>[h, r[i]])));
}
function normalize(records, book, base){
  const out=[];
  for(const r of records){
    const keys = Object.fromEntries(Object.keys(r).map(k=>[k.toLowerCase(),k]));
    const de = r[keys.deutsch]??r[keys.de]??r[keys.german]??r[keys['de']]??'';
    const la = r[keys.latein]??r[keys.latin]??r[keys.lat]??r[keys.la]??'';
    const en = r[keys.englisch]??r[keys.english]??r[keys.en]??'';
    const lesson = r[keys.lektion]??r[keys.lesson]??r[keys.kapitel]??'1';
    if((de&&la)||(de&&en)||(la&&en)){
      out.push({ id: crypto.randomUUID(), book, base, lesson: String(lesson).trim(), de:(de||'').trim(), la:(la||'').trim(), en:(en||'').trim() });
    }
  }
  return out;
}

function allBooks(){ return [...new Set(state.data.map(d=>d.book))].filter(Boolean).sort(); }
function populateBooks(){
  const sel=$("#bookSelect"); sel.innerHTML='';
  const books=allBooks();
  if(!books.length){ state.book=null; sel.appendChild(new Option('(kein Buch)','')); return; }
  books.forEach(b=>{ sel.appendChild(new Option(b,b)); });
  if(!state.book || !books.includes(state.book)) state.book = books[0];
  sel.value = state.book;
}
function availableLangOptions(){
  const pool=state.data.filter(d=>d.book===state.book);
  const bases=new Set(pool.map(d=>d.base)); const opts=[];
  if(bases.has('latin')){ opts.push(['latin','Latein → Deutsch'],['latin_rev','Deutsch → Latein']); }
  if(bases.has('english')){ opts.push(['english','Englisch → Deutsch'],['english_rev','Deutsch → Englisch']); }
  return opts;
}
function populateLangSelect(){
  const sel=$("#langSelect"); sel.innerHTML='';
  const opts=availableLangOptions();
  let found=false;
  for(const [val,label] of opts){ const o=new Option(label,val); sel.appendChild(o); if(state.lang===val) found=true; }
  if(!found && opts.length) state.lang=opts[0][0];
  sel.value=state.lang;
}
function populateLessons(){
  const sel=$("#lessonSelect"); sel.innerHTML='';
  const pool=state.data.filter(d=>d.book===state.book && baseForMode()===d.base);
  const lessons=[...new Set(pool.map(d=>d.lesson))].sort((a,b)=>(a*1)-(b*1));
  lessons.forEach(L=> sel.appendChild(new Option('Lektion '+L, L)));
}

async function ensureNotifications(){
  if(!('Notification' in window)) return false;
  if(Notification.permission==='granted') return true;
  if(Notification.permission!=='denied'){ const perm=await Notification.requestPermission(); return perm==='granted'; }
  return false;
}
function scheduleDailyReminder(hour=17){
  P().scheduleNoti=true; save();
  ensureNotifications().then(granted=>{
    if(!granted) return;
    const check=()=>{
      const now=new Date();
      if(now.getHours()>=hour && (localStorage.getItem('remindedDay_'+state.activeKid)!== now.toDateString())){
        new Notification('Vokabelhelden',{body:`${state.activeKid}: kurze Vokabelrunde? 🔥`,badge:'icons/icon-192.png',icon:'icons/icon-192.png'});
        localStorage.setItem('remindedDay_'+state.activeKid, now.toDateString());
      }
    };
    check(); setInterval(check, 3600000);
  });
}

function addXP(n=5){
  const p=P(); p.xp+=n;
  const today=new Date().toDateString();
  if(p.lastDay!==today){
    const y=new Date(p.lastDay||Date.now()-86400000);
    const diff=Math.floor((new Date(today) - new Date(y.toDateString()))/86400000);
    p.streak=(diff===1)?(p.streak+1):1; p.lastDay=today;
  }
  p.reviewsToday++; save(); refreshKpis();
}

function baseForMode(){ return (state.lang.startsWith('latin'))?'latin':'english'; }
function fieldsForMode(){
  switch(state.lang){
    case 'latin': return ['la','de'];
    case 'latin_rev': return ['de','la'];
    case 'english': return ['en','de'];
    case 'english_rev': return ['de','en'];
  }
}
function chosenLessons(){
  const sel=$("#lessonSelect"); return Array.from(sel.selectedOptions).map(o=>o.value);
}
function poolItems(){
  const base=baseForMode();
  const pool=state.data.filter(d=> d.book===state.book && d.base===base && (chosenLessons().length? chosenLessons().includes(d.lesson): true));
  return pool;
}
function buildDue(){
  const now=Date.now(); const p=P();
  p.due=poolItems().filter(d=>{ const s=p.perCard[d.id]; return !s || !s.due || s.due<=now; }).map(d=>d.id);
}
function reviewOutcome(quality){
  const p=P(); const id=state.current?.id; if(!id) return;
  let s=p.perCard[id] || {EF:2.5, interval:0, reps:0, due:0};
  if(quality<3){ s.reps=0; s.interval=1; }
  else{
    s.reps+=1;
    if(s.reps===1) s.interval=1;
    else if(s.reps===2) s.interval=6;
    else s.interval=Math.round(s.interval*s.EF);
    s.EF=Math.max(1.3, s.EF + (0.1 - (5-quality)*(0.08 + (5-quality)*0.02)));
  }
  const days=Math.max(1, s.interval);
  s.due=Date.now()+days*86400000;
  p.perCard[id]=s; save(); buildDue();
}
function pickDueOrPool(pool){
  const p=P(); const dueIds=(p.due||[]).filter(id=> pool.some(x=>x.id===id));
  return dueIds.length? pool.filter(d=>dueIds.includes(d.id)) : pool;
}

function normalizeForTolerant(s){
  return String(s||'')
    .toLowerCase()
    .replace(/[.,;:!?¿¡()\[\]{}"„“‚’'`\-]/g,'')
    .replace(/\b(der|die|das|ein|eine|the|a|an)\b/g,'')
    .replace(/\s+/g,' ').trim();
}
function normExact(s){ return String(s||'').toLowerCase().replace(/\s+/g,' ').trim(); }
function tolerantEquals(ans, want){
  const alts = String(want||'').split(/[,/;]| oder |\bor\b/).map(x=>x.trim()).filter(Boolean);
  const A = normalizeForTolerant(ans);
  return alts.some(w => normalizeForTolerant(w) === A);
}

function setCurrent(mode,item){ state.currentByMode[mode]=item; }
function getCurrent(mode){ return state.currentByMode[mode]; }
function reviewOutcomeOn(mode, q){ state.current = getCurrent(mode); reviewOutcome(q); }

function nextCard(mode=state.mode){
  if(!state.data.length || !state.book){ $("#flashCard").textContent="Bitte Daten importieren und Buch wählen."; return; }
  const [qField,aField]=fieldsForMode();
  const pool=poolItems(); if(!pool.length){ $("#flashCard").textContent="Keine passenden Vokabeln."; return; }
  const arr=pickDueOrPool(pool);
  let pick=arr[Math.floor(Math.random()*arr.length)];
  if(arr.length>1 && state.lastByMode[mode]===pick.id){ const alt=arr.find(x=>x.id!==state.lastByMode[mode]); if(alt) pick=alt; }
  state.lastByMode[mode]=pick.id; setCurrent(mode,pick);

  $("#flashCard").textContent = pick[qField] || '–';
  $("#flash").classList.remove('revealed');

  $("#writePrompt").textContent = pick[qField]? `Was bedeutet „${pick[qField]}“?` : 'Was bedeutet …?';
  $("#writeFeedback").textContent=''; $("#writeCard").classList.remove('ok','bad');
  $("#writeInput").value=''; $("#btnCheckWrite").textContent='Prüfen'; state.writeAwaitNext=false;

  $("#listenPrompt").textContent='🎧 Wir sprechen ein Wort – übersetze es.'; $("#listenInput").value='';
  $("#speakPrompt").textContent = pick[qField]? `🎙️ Sprich die Übersetzung von: „${pick[qField]}“`:'🎙️ Sprich die Übersetzung.';

  if(!$('#write').classList.contains('hidden')){ setTimeout(()=> $("#writeInput")?.focus(), 50); }
}

// FLASHCARDS
$("#btnShow").addEventListener('click', ()=>{
  const [qField,aField]=fieldsForMode(); const cur=getCurrent('flash')||getCurrent(state.mode)||getCurrent('write')||getCurrent('listen')||getCurrent('speak')||getCurrent('quiz')||getCurrent('match');
  const q = cur ? (cur[qField]||'') : ''; const a = cur ? (cur[aField]||'') : '';
  $("#flashCard").innerHTML = `<div>${q}</div><div class="badge">${a}</div>`;
  $("#flash").classList.add('revealed');
});
$("#btnEasy").addEventListener('click', ()=>{ reviewOutcomeOn('flash',5); addXP(8); nextCard('flash'); });
$("#btnGood").addEventListener('click', ()=>{ reviewOutcomeOn('flash',4); addXP(6); nextCard('flash'); });
$("#btnHard").addEventListener('click', ()=>{ reviewOutcomeOn('flash',2); addXP(3); nextCard('flash'); });

// QUIZ – exact full-string matching
function buildQuiz(){
  const pool=poolItems(); const prompt=$("#quizPrompt"), wrap=$("#quizOptions");
  if(pool.length<4){ prompt.textContent="Bitte mehr Vokabeln importieren."; wrap.innerHTML=''; return; }
  const [qField,aField]=fieldsForMode();
  const arr=pickDueOrPool(pool);
  const correct = arr[Math.floor(Math.random()*arr.length)];
  setCurrent('quiz', correct); state.firstWrongInRound=false;
  prompt.textContent = correct[qField];
  const correctText = correct[aField];

  const set=new Set([normExact(correctText)]); const options=[correctText];
  const shuffled=pool.slice().sort(()=>Math.random()-0.5);
  for(const it of shuffled){ if(options.length>=4) break; const cand=it[aField]; if(!cand) continue; const n=normExact(cand); if(!set.has(n)){ set.add(n); options.push(cand);} }
  while(options.length<4) options.push(correctText);
  const display=options.slice().sort(()=>Math.random()-0.5);
  wrap.innerHTML='';
  display.forEach(opt=>{
    const b=document.createElement('button'); b.textContent=opt;
    b.addEventListener('click',()=>{
      const good = normExact(opt)===normExact(correctText);
      if(good){
        b.classList.add('ok'); wrap.querySelectorAll('button').forEach(x=>x.disabled=true);
        setTimeout(()=>{ reviewOutcomeOn('quiz', state.firstWrongInRound?2:4); addXP(state.firstWrongInRound?3:5); buildQuiz(); }, 500);
      }else{
        state.firstWrongInRound=true; b.classList.add('bad'); b.disabled=true;
      }
    });
    wrap.appendChild(b);
  });
}

// LISTEN
const synth = window.speechSynthesis;
function speak(text, lang){ if(!synth) return; const u=new SpeechSynthesisUtterance(text); u.lang=lang; synth.cancel(); synth.speak(u); }
$("#btnSpeak").addEventListener('click', ()=>{
  if(!getCurrent('listen')) nextCard('listen');
  const [qField] = fieldsForMode(); const cur=getCurrent('listen'); const langCode=(qField==='la')?'la':(qField==='en'?'en-US':'de-DE'); if(cur) speak(cur[qField], langCode);
});
$("#btnCheckListen").addEventListener('click', ()=>{
  const ans=$("#listenInput").value; const cur=getCurrent('listen'); const want=(cur?.[fieldsForMode()[1]]||''); const fb=$("#listenPrompt");
  const exact = tolerantEquals(ans, want);
  if(exact){ fb.classList.add('ok'); fb.classList.remove('bad'); fb.textContent='Richtig!'; reviewOutcomeOn('listen',4); addXP(6); setTimeout(()=>{ fb.classList.remove('ok'); $("#listenInput").value=''; nextCard('listen'); }, 500); }
  else { fb.classList.add('bad'); fb.textContent='Gesucht: '+want; reviewOutcomeOn('listen',2); setTimeout(()=>{ fb.classList.remove('bad'); $("#listenInput").value=''; nextCard('listen'); }, 700); }
});

// SPEAK
let rec;
$("#btnStartRec").addEventListener('click', ()=>{
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){ alert('Spracheingabe nicht verfügbar.'); return; }
  rec = new SR(); rec.lang = (fieldsForMode()[1]==='la')?'la':'de-DE';
  rec.onresult = (e)=>{
    const text=e.results[0][0].transcript; $("#recOut").textContent='Erkannt: '+text;
    const cur=getCurrent('speak'); const want=(cur?.[fieldsForMode()[1]]||'');
    if(tolerantEquals(text, want)){ reviewOutcomeOn('speak',4); addXP(5); nextCard('speak'); }
    else { reviewOutcomeOn('speak',2); }
  };
  rec.start(); $("#recOut").textContent='…hört zu';
});
$("#btnStopRec").addEventListener('click', ()=>{ try{ rec && rec.stop(); }catch(e){} });
$("#btnSelfOk").addEventListener('click', ()=>{ reviewOutcomeOn('speak',4); addXP(4); nextCard('speak'); });

// MATCH (5 pairs)
function buildMatch(){
  const pool=poolItems().slice().sort(()=>Math.random()-0.5).slice(0,5);
  if(!pool.length){ $("#matchGrid").textContent='Bitte passende Daten importieren.'; return; }
  const [qField,aField]=fieldsForMode();
  const left=pool.map(x=>({id:x.id,t:x[qField]}));
  const right=pool.map(x=>({id:x.id,t:x[aField]})).sort(()=>Math.random()-0.5);
  const wrap=$("#matchGrid"); wrap.innerHTML='';
  let selectedLeft=null; const solved=new Set();
  function render(items, side){
    const col=document.createElement('div'); col.style.display='grid'; col.style.gap='8px';
    items.forEach(it=>{
      const b=document.createElement('button'); b.textContent=it.t; b.dataset.id=it.id;
      b.addEventListener('click',()=>{
        if(solved.has(it.id)) return;
        if(side==='L'){ $$('#matchGrid .selected').forEach(x=>x.classList.remove('selected')); selectedLeft=it.id; b.classList.add('selected'); }
        else{
          if(!selectedLeft){ b.classList.add('bad'); setTimeout(()=>b.classList.remove('bad'),500); return; }
          const leftBtn=wrap.querySelector(`[data-id="${selectedLeft}"]`);
          const isMatch = selectedLeft===it.id;
          if(isMatch){
            leftBtn.classList.add('ok','solved'); leftBtn.disabled=true; b.classList.add('ok','solved'); b.disabled=true;
            solved.add(it.id); setCurrent('match', pool.find(x=>x.id===it.id)); reviewOutcomeOn('match',4); addXP(3); selectedLeft=null;
            if(solved.size===pool.length){ setTimeout(()=> buildMatch(), 600); }
          }else{
            leftBtn.classList.add('bad'); b.classList.add('bad'); setTimeout(()=>{ leftBtn.classList.remove('bad'); b.classList.remove('bad'); }, 500);
            setCurrent('match', pool.find(x=>x.id===selectedLeft)); reviewOutcomeOn('match',2);
          }
        }
      });
      col.appendChild(b);
    });
    return col;
  }
  const cont=document.createElement('div'); cont.style.display='grid'; cont.style.gridTemplateColumns='1fr 1fr'; cont.style.gap='12px';
  cont.appendChild(render(left,'L')); cont.appendChild(render(right,'R')); wrap.appendChild(cont);
}

// WRITE
$("#btnCheckWrite").addEventListener('click', ()=>{
  if(state.writeAwaitNext){ nextCard('write'); $("#writeInput").focus(); return; }
  const ans=$("#writeInput").value; const cur=getCurrent('write'); const want=(cur?.[fieldsForMode()[1]]||''); const fb=$("#writeFeedback"); const full=want;
  const exact=tolerantEquals(ans, want);
  if(exact){ fb.textContent='Richtig: '+full; $("#writeCard").classList.add('ok'); $("#writeCard").classList.remove('bad'); reviewOutcomeOn('write',4); addXP(6); }
  else { fb.textContent='Gesucht: '+full; $("#writeCard").classList.add('bad'); $("#writeCard").classList.remove('ok'); reviewOutcomeOn('write',2); }
  $("#btnCheckWrite").textContent='Weiter'; state.writeAwaitNext=true; $("#writeInput").value='';
});
$("#writeInput").addEventListener('keydown', e=>{ if(e.key==='Enter') $("#btnCheckWrite").click(); });

// TABS
$("#tabs").addEventListener('click', (e)=>{
  const t=e.target.closest('.tab'); if(!t) return;
  $$('.tab').forEach(x=>x.classList.remove('active')); t.classList.add('active');
  state.mode=t.dataset.tab;
  $$('.activity').forEach(x=>x.classList.add('hidden'));
  $('#'+state.mode).classList.remove('hidden');
  if(state.mode==='quiz') buildQuiz();
  else if(state.mode==='match') buildMatch();
  else if(state.mode==='write') { nextCard('write'); setTimeout(()=> $("#writeInput")?.focus(), 50); }
  else if(state.mode==='listen') nextCard('listen');
  else if(state.mode==='speak') nextCard('speak');
  save();
});

// Select changes
$("#langSelect").addEventListener('change', e=>{ state.lang=e.target.value; save(); populateLessons(); buildDue(); nextCard('flash'); if(state.mode==='quiz') buildQuiz(); if(state.mode==='match') buildMatch(); });
$("#bookSelect").addEventListener('change', e=>{ state.book=e.target.value; save(); populateLangSelect(); populateLessons(); buildDue(); nextCard('flash'); if(state.mode==='quiz') buildQuiz(); if(state.mode==='match') buildMatch(); });
$("#lessonSelect").addEventListener('change', ()=>{ buildDue(); nextCard('flash'); if(state.mode==='quiz') buildQuiz(); if(state.mode==='match') buildMatch(); });

// Parent modal open/close are handled by early script too; add import + goal logic
function renderParent(){
  const sel=$("#kidSelect"); sel.innerHTML='';
  Object.keys(state.profiles).forEach(name=> sel.appendChild(new Option(name,name)) );
  sel.value=state.activeKid;
  $("#goalLessons").value=(P().goals.lessons||[]).join(', ');
  $("#goalMinutes").value=P().goals.minutes||15;
  $("#reminders").checked=!!P().scheduleNoti;
  $("#importStatus").textContent='';
  renderProgress();
}
$("#kidSelect").addEventListener('change', e=>{ setKid(e.target.value); });
$("#btnAddKid").addEventListener('click', ()=>{
  const name=prompt('Name des Kindes?'); if(!name) return;
  if(state.profiles[name]){ alert('Name existiert bereits.'); return; }
  state.profiles[name]=defaultProfile(); setKid(name); renderParent(); save();
});
$("#btnSaveGoal").addEventListener('click', ()=>{
  P().goals.lessons=$("#goalLessons").value.split(',').map(s=>s.trim()).filter(Boolean);
  P().goals.minutes=parseInt($("#goalMinutes").value||'15',10); save(); alert('Ziel gespeichert.');
});
$("#reminders").addEventListener('change', e=>{ if(e.target.checked) scheduleDailyReminder(17); else { P().scheduleNoti=false; save(); } });

$("#btnImport").addEventListener('click', async ()=>{
  const btn=$("#btnImport"), status=$("#importStatus"); const file=$("#fileInput").files[0]; const book=$("#bookName").value.trim(); const base=$("#baseLang").value;
  if(!file || !book){ status.textContent='Bitte Datei und Buchname angeben.'; return; }
  btn.disabled=true; const old=btn.textContent; btn.textContent='Importiere…'; status.textContent='Import läuft…';
  try{
    const text=await file.text(); let records=[];
    if(file.name.endsWith('.json')) records=JSON.parse(text); else records=parseCSV(text);
    const items=normalize(records, book, base);
    if(!items.length){ status.textContent='Keine Vokabeln erkannt.'; return; }
    const key=o=>[o.book,o.base,o.de||'',o.la||'',o.en||''].join('|'); const existing=new Set(state.data.map(key)); let added=0;
    for(const it of items) if(!existing.has(key(it))){ state.data.push(it); added++; }
    save(); populateBooks(); $("#bookSelect").value=book; state.book=book; populateLangSelect(); populateLessons(); buildDue(); nextCard('flash');
    status.textContent='Import ok: '+added+' Einträge';
  }catch(err){ status.textContent='Fehler beim Import.'; }
  finally{ btn.disabled=false; btn.textContent=old; }
});

function renderProgress(){
  const list=$("#progressList"); if(!list) return; list.innerHTML='';
  const p=P(); const rows=[
    `Heute: ${p.reviewsToday} Aufgaben, ${p.xp} XP gesamt`,
    `Streak: ${p.streak} Tage`,
    p.goals.lessons?.length? `Ziel‑Lektionen: ${p.goals.lessons.join(', ')}` : 'Kein Lektionen‑Ziel gesetzt',
    `Zeit‑Ziel: ${p.goals.minutes} Minuten`,
    state.book? `Aktuelles Buch: ${state.book}` : 'Kein Buch gewählt'
  ];
  rows.forEach(t=>{ const d=document.createElement('div'); d.textContent=t; list.appendChild(d); });
}

function init(){
  applyTheme(state.theme);
  populateBooks(); populateLangSelect(); populateLessons(); refreshKpis(); buildDue(); nextCard('flash'); nextCard('write'); nextCard('listen'); nextCard('speak');
}
init();
