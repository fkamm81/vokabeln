
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const DBKEY = 'vocab-helden-v6';
const state = {
  data: [], mode: 'flash', lang: 'latin', book: null,
  themes: [
    {id:'ocean', name:'Ocean', vars:{bg:'#0b132b', panel:'#1c2541', accent:'#3a86ff', text:'#f6f7fb', btn:'#0d1b2a'}},
    {id:'forest', name:'Forest', vars:{bg:'#0b2b1a', panel:'#163822', accent:'#34d399', text:'#eafff3', btn:'#0a1f14'}},
    {id:'sunset', name:'Sunset', vars:{bg:'#2b0b14', panel:'#3a1421', accent:'#ff7a59', text:'#fff4f0', btn:'#2a0e15'}},
    {id:'contrast', name:'Kontrast', vars:{bg:'#000', panel:'#111', accent:'#ffd60a', text:'#fff', btn:'#1c1c1c'}},
  ],
  theme: 'ocean',
  profiles: {},
  activeKid: null,
  quizRound: null,
  writeAwaitNext: false
};

function defaultProfile(){ return { xp:0, streak:0, lastDay:null, reviewsToday:0, perCard:{}, goals:{lessons:[], minutes:15}, scheduleNoti:false }; }
function load(){ try{ const saved = JSON.parse(localStorage.getItem(DBKEY)||'{}'); Object.assign(state, saved);
  if (!state.activeKid){ state.profiles['Kind 1']=state.profiles['Kind 1']||defaultProfile(); state.profiles['Kind 2']=state.profiles['Kind 2']||defaultProfile(); state.activeKid='Kind 1'; }
  for (const k in state.profiles){ const p=state.profiles[k]; if (p.lastDay && new Date(p.lastDay).toDateString() !== new Date().toDateString()) p.reviewsToday=0; }
}catch(e){}}
function save(){ localStorage.setItem(DBKEY, JSON.stringify(state)); }
load();

// Theme
function applyTheme(id){ const t=state.themes.find(x=>x.id===id)||state.themes[0]; state.theme=t.id; save();
  const r=document.documentElement; r.style.setProperty('--bg',t.vars.bg); r.style.setProperty('--panel',t.vars.panel); r.style.setProperty('--accent',t.vars.accent); r.style.setProperty('--text',t.vars.text); r.style.setProperty('--btn',t.vars.btn||'#0d1b2a');
  $$("select, button, input[type='text'], input[type='number']").forEach(el=>{el.style.background='var(--btn)'; el.style.color='var(--text)';});
}
function openThemePopup(){
  const pop=$("#themePopup"), dots=$("#themeDots"); dots.innerHTML='';
  state.themes.forEach(t=>{ const b=document.createElement('button'); b.className='theme-dot'+(state.theme===t.id?' active':''); b.style.background=t.vars.accent; b.title=t.name; b.addEventListener('click',()=>{applyTheme(t.id); render();}); dots.appendChild(b);});
  function render(){ $$("#themeDots .theme-dot").forEach((b,i)=>b.classList.toggle('active', state.themes[i].id===state.theme)); }
  render(); pop.classList.remove('hidden');
}
function closeThemePopup(){ $("#themePopup").classList.add('hidden'); }

// Toast
const QUOTES=[["turtle","Langsam ist auch schnell – Schritt für Schritt!"],["frog","Sprung! Ein Punkt mehr!"],["sheep","Mäh‑gnifique! Weiter so!"]];
function toast(msg, id='turtle'){ const t=document.createElement('div'); t.className='toast'; t.innerHTML=`<div class="msg"><svg><use href="assets/mascots.svg#${id}"/></svg><div>${msg}</div></div>`; document.body.appendChild(t); setTimeout(()=>t.remove(),1800); }
function cheer(){ const [id,txt]=QUOTES[Math.floor(Math.random()*QUOTES.length)]; toast(txt,id); }

// Profiles/KPIs
function P(){ return state.profiles[state.activeKid]; }
function setKid(n){ state.activeKid=n; save(); refreshKpis(); renderProgress(); }
function refreshKpis(){ $("#xp").textContent=P().xp; $("#streak").textContent=P().streak; $("#kidBadge").textContent=state.activeKid; }

// Import helpers
function parseCSV(text){ const rows=[]; let row=[], field='', inQ=false; for (let i=0;i<text.length;i++){ const c=text[i],n=text[i+1];
  if (c==='\"'){ if (inQ && n==='\"'){field+='\"'; i++;} else inQ=!inQ; } else if (c===',' && !inQ){ row.push(field.trim()); field=''; }
  else if ((c==='\n'||c==='\r') && !inQ){ if (field!==''||row.length){ row.push(field.trim()); rows.push(row); row=[]; field=''; } }
  else field+=c; }
  if (field!==''||row.length){ row.push(field.trim()); rows.push(row); }
  const header=rows.shift().map(h=>h.toLowerCase()); return rows.map(r=>Object.fromEntries(header.map((h,i)=>[h,r[i]]))); }
function normalize(records, book, base){ const out=[]; for (const r of records){ const k=Object.fromEntries(Object.keys(r).map(x=>[x.toLowerCase(),x])); const de=r[k.deutsch]??r[k.de]??r[k.german]??r[k['de']]??''; const la=r[k.latein]??r[k.latin]??r[k.lat]??r[k.la]??''; const en=r[k.englisch]??r[k.english]??r[k.en]??''; const lesson=r[k.lektion]??r[k.lesson]??r[k.kapitel]??'1'; if ((de&&la)||(de&&en)||(la&&en)) out.push({id:crypto.randomUUID(), book, base, lesson:String(lesson).trim(), de:(de||'').trim(), la:(la||'').trim(), en:(en||'').trim()}); } return out; }
function allBooks(){ return [...new Set(state.data.map(d=>d.book))].filter(Boolean).sort(); }
function populateBooks(){ const sel=$("#bookSelect"); sel.innerHTML=''; const books=allBooks(); if (!books.length){ state.book=null; sel.appendChild(new Option('(kein Buch)','')); return; } books.forEach(b=>sel.appendChild(new Option(b,b))); if (!state.book||!books.includes(state.book)) state.book=books[0]; sel.value=state.book; }

function availableLangOptions(){ const pool=state.data.filter(d=>d.book===state.book); const bases=new Set(pool.map(d=>d.base)); const opts=[]; if (bases.has('latin')) opts.push(['latin','Latein → Deutsch'],['latin_rev','Deutsch → Latein']); if (bases.has('english')) opts.push(['english','Englisch → Deutsch'],['english_rev','Deutsch → Englisch']); return opts; }
function populateLangSelect(){ const sel=$("#langSelect"); sel.innerHTML=''; const opts=availableLangOptions(); if (!opts.length){ sel.appendChild(new Option('(keine Richtung)','latin')); return; } let found=false; for (const [v,l] of opts){ const o=new Option(l,v); sel.appendChild(o); if (state.lang===v) found=true; } if (!found) state.lang=opts[0][0]; sel.value=state.lang; }
function populateLessons(){ const sel=$("#lessonSelect"); sel.innerHTML=''; const pool=state.data.filter(d=>d.book===state.book && baseForMode()===d.base); const lessons=[...new Set(pool.map(d=>d.lesson))].sort((a,b)=>(a*1)-(b*1)); lessons.forEach(L=>sel.appendChild(new Option('Lektion '+L, L))); }

// Notifications omitted (unchanged)

// XP/Streak
function addXP(n=5){ const p=P(); p.xp+=n; const today=new Date().toDateString(); if (p.lastDay!==today){ const y=new Date(p.lastDay||Date.now()-86400000); const diff=Math.floor((new Date(today)-new Date(y.toDateString()))/86400000); p.streak=(diff===1)?(p.streak+1):1; p.lastDay=today; } p.reviewsToday++; save(); refreshKpis(); }

// SR helpers
function baseForMode(){ return state.lang.startsWith('latin')?'latin':'english'; }
function fieldsForMode(){ switch(state.lang){ case 'latin': return ['la','de']; case 'latin_rev': return ['de','la']; case 'english': return ['en','de']; case 'english_rev': return ['de','en']; } }
function chosenLessons(){ const sel=$("#lessonSelect"); return Array.from(sel.selectedOptions).map(o=>o.value); }
function poolItems(){ const base=baseForMode(); return state.data.filter(d=> d.book===state.book && d.base===base && (chosenLessons().length? chosenLessons().includes(d.lesson): true)); }
function buildDue(){ const now=Date.now(); const p=P(); p.due=poolItems().filter(d=>{ const s=p.perCard[d.id]; return !s||!s.due||s.due<=now; }).map(d=>d.id); }

// Fuzzy with stricter short-word rules
function normalizeText(t){ return (t||'').toLowerCase().replace(/\b(der|die|das|ein|eine|the|a|an)\b/g,'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zäöüß \-]/g,'').replace(/\s+/g,' ').trim(); }
function levenshtein(a,b){ a=normalizeText(a); b=normalizeText(b); const m=a.length,n=b.length; if (!m) return n; if (!n) return m; const dp=new Array(n+1); for (let j=0;j<=n;j++) dp[j]=j; for (let i=1;i<=m;i++){ let prev=dp[0]; dp[0]=i; for (let j=1;j<=n;j++){ const tmp=dp[j]; const cost=a[i-1]===b[j-1]?0:1; dp[j]=Math.min(dp[j]+1, dp[j-1]+1, prev+cost); prev=tmp; } } return dp[n]; }
function splitAlternatives(s){ return String(s||'').split(/[,/;]| oder |\bor\b/).map(x=>x.trim()).filter(Boolean); }
function equalsNormalized(ans, want){ const A=normalizeText(ans); const alts=splitAlternatives(want).map(normalizeText); return alts.some(W=>A===W); }
function isFuzzyMatchStrict(ans, want){
  const A=normalizeText(ans);
  const alts=splitAlternatives(want);
  return alts.some(w => {
    const W=normalizeText(w);
    if (!A||!W) return false;
    const len=W.length;
    if (len<=4) return A===W;               // keine Toleranz
    if (len<=7) return levenshtein(A,W)<=1; // max 1
    const tol=Math.max(2, Math.floor(len*0.15));
    return levenshtein(A,W)<=tol;
  });
}

// Activities
function nextCard(){
  if (!state.data.length || !state.book){ $("#flashCard").textContent="Bitte Daten importieren und Buch wählen."; return; }
  const [qField,aField]=fieldsForMode(); const p=P(); const pool=poolItems(); if (!pool.length){ $("#flashCard").textContent="Keine passenden Vokabeln in diesem Buch/Modus."; return; }
  const dueIds=(p.due||[]).filter(id=> pool.some(x=>x.id===id)); const arr= dueIds.length? pool.filter(d=>dueIds.includes(d.id)) : pool;
  const pick=arr[Math.floor(Math.random()*arr.length)]; state.current=pick;
  $("#flashCard").textContent=pick[qField]||'–'; $("#flashCard").dataset.answer=pick[aField]||'–';
  // Reset write
  $("#writePrompt").textContent = pick[qField]? `Was bedeutet „${pick[qField]}“?` : 'Was bedeutet …?';
  $("#writeFeedback").textContent=''; $("#writeCard").classList.remove('ok','bad'); $("#writeInput").value=''; $("#btnCheckWrite").textContent='Prüfen'; state.writeAwaitNext=false;
  // Reset listen
  $("#listenPrompt").textContent = pick[qField]? `🎧 Höre zu und übersetze: “${pick[qField]}”` : '🎧';
  // Hide flash grading buttons until reveal
  $("#btnEasy").classList.add('hidden'); $("#btnGood").classList.add('hidden'); $("#btnHard").classList.add('hidden');
  if (!$('#write').classList.contains('hidden')) setTimeout(()=>$("#writeInput")?.focus(),50);
}

// Flashcards
$("#btnShow").addEventListener('click', ()=>{
  $("#flashCard").innerHTML = `<div>${state.current ? (state.current[fieldsForMode()[0]]||'') : ''}</div>
  <div class="badge">${state.current ? (state.current[fieldsForMode()[1]]||'') : ''}</div>`;
  $("#btnEasy").classList.remove('hidden'); $("#btnGood").classList.remove('hidden'); $("#btnHard").classList.remove('hidden');
});
$("#btnEasy").addEventListener('click', ()=> reviewOutcome(5));
$("#btnGood").addEventListener('click', ()=> reviewOutcome(4));
$("#btnHard").addEventListener('click', ()=> reviewOutcome(2));

function reviewOutcome(q){ const p=P(); const id=state.current?.id; if (!id) return;
  let s=p.perCard[id]||{EF:2.5, interval:0, reps:0, due:0};
  if (q<3){ s.reps=0; s.interval=1; } else { s.reps+=1; if (s.reps===1) s.interval=1; else if (s.reps===2) s.interval=6; else s.interval=Math.round(s.interval*s.EF); s.EF=Math.max(1.3, s.EF + (0.1 - (5-q)*(0.08 + (5-q)*0.02))); }
  s.due=Date.now()+Math.max(1,s.interval)*86400000; p.perCard[id]=s; addXP(5+(q>=4?3:0)); save(); cheer(); buildDue(); nextCard();
}

// Listen
const synth=window.speechSynthesis;
function speak(text, lang){ if (!synth) return; const u=new SpeechSynthesisUtterance(text); u.lang=lang; synth.cancel(); synth.speak(u); }
$("#btnSpeak").addEventListener('click', ()=>{ if (!state.current) nextCard(); const [qField]=fieldsForMode(); const langCode=(qField==='la')?'la':(qField==='en'?'en-US':'de-DE'); speak(state.current[qField], langCode); });
$("#btnCheckListen").addEventListener('click', ()=>{ const ans=$("#listenInput").value; const want=(state.current?.[fieldsForMode()[1]]||''); const fb=$("#listenPrompt");
  if (isFuzzyMatchStrict(ans,want)){ addXP(6); cheer(); $("#listenInput").value=''; fb.classList.add('ok'); fb.classList.remove('bad'); setTimeout(()=>{ fb.classList.remove('ok'); nextCard(); }, 500); }
  else { fb.classList.add('bad'); fb.classList.remove('ok'); fb.textContent=`Gesucht: ${splitAlternatives(want).join(', ')}`; setTimeout(()=> fb.classList.remove('bad'), 700); $("#btnCheckWrite").textContent='Weiter'; }
});

// Speak (unchanged lightweight)
let rec;
$("#btnStartRec").addEventListener('click', ()=>{ const SR=window.SpeechRecognition||window.webkitSpeechRecognition; if (!SR){ toast('Spracheingabe nicht verfügbar.'); return; } rec=new SR(); rec.lang=(fieldsForMode()[1]==='la')?'la':'de-DE'; rec.onresult=e=>{ $("#recOut").textContent='Erkannt: '+ e.results[0][0].transcript; }; rec.start(); $("#recOut").textContent='…hört zu'; });
$("#btnStopRec").addEventListener('click', ()=>{ try{ rec&&rec.stop(); }catch{} });
$("#btnSelfOk").addEventListener('click', ()=>{ addXP(4); cheer(); });

// Match
function buildMatch(){ const pool=poolItems().slice().sort(()=>Math.random()-0.5).slice(0,6); if (!pool.length){ $("#matchGrid").textContent='Bitte passende Daten importieren.'; return; }
  const [qField,aField]=fieldsForMode(); const left=pool.map(x=>({id:x.id,t:x[qField]})); const right=pool.map(x=>({id:x.id,t:x[aField]})).sort(()=>Math.random()-0.5);
  const wrap=$("#matchGrid"); wrap.innerHTML=''; let selectedLeft=null;
  function col(items,side){ const c=document.createElement('div'); c.style.display='grid'; c.style.gap='8px';
    items.forEach(it=>{ const b=document.createElement('button'); b.textContent=it.t; b.dataset.id=it.id; b.addEventListener('click', ()=>{
      if (side==='L'){ $$('#matchGrid .selected').forEach(x=>x.classList.remove('selected')); selectedLeft=it.id; b.classList.add('selected'); }
      else { if (!selectedLeft){ b.classList.add('bad'); setTimeout(()=>b.classList.remove('bad'),500); return; }
        const leftBtn=wrap.querySelector(`[data-id="${selectedLeft}"]`); const isMatch=(selectedLeft===it.id);
        if (isMatch){ leftBtn.classList.add('ok'); b.classList.add('ok'); setTimeout(()=>{ leftBtn.remove(); b.remove(); selectedLeft=null; if (!wrap.querySelector('[data-id]')) buildMatch(); }, 500); addXP(3); cheer(); }
        else { leftBtn.classList.add('bad'); b.classList.add('bad'); setTimeout(()=>{ leftBtn.classList.remove('bad'); b.classList.remove('bad'); }, 500); }
      }
    }); c.appendChild(b); }); return c; }
  const cont=document.createElement('div'); cont.style.display='grid'; cont.style.gridTemplateColumns='1fr 1fr'; cont.style.gap='12px'; cont.appendChild(col(left,'L')); cont.appendChild(col(right,'R')); wrap.appendChild(cont);
}

// WRITE
$("#btnCheckWrite").addEventListener('click', ()=>{
  if (state.writeAwaitNext){ nextCard(); $("#writeInput").focus(); return; }
  const ans=$("#writeInput").value; const want=(state.current?.[fieldsForMode()[1]]||''); const fb=$("#writeFeedback"); const full=splitAlternatives(want).join(', ');
  const correct = isFuzzyMatchStrict(ans,want);
  if (correct){ fb.textContent=`Richtig: ${full}`; $("#writeCard").classList.add('ok'); $("#writeCard").classList.remove('bad'); addXP(6); cheer(); $("#btnCheckWrite").textContent='Weiter'; state.writeAwaitNext=true; }
  else { fb.textContent=`Gesucht: ${full}`; $("#writeCard").classList.add('bad'); $("#writeCard").classList.remove('ok'); $("#btnCheckWrite").textContent='Weiter'; state.writeAwaitNext=true; }
});
$("#writeInput").addEventListener('keydown', e=>{ if (e.key==='Enter') $("#btnCheckWrite").click(); });

// QUIZ strict matching; require correct before next
function buildQuiz(){ const pool=poolItems(); const prompt=$("#quizPrompt"),wrap=$("#quizOptions"); if (pool.length<4){ prompt.textContent="Bitte mehr Vokabeln importieren."; wrap.innerHTML=''; return; }
  const [qField,aField]=fieldsForMode(); const correct = pool[Math.floor(Math.random()*pool.length)]; const correctText=correct[aField]; prompt.textContent=correct[qField];
  const options=new Set([correctText]); while (options.size<4) options.add(pool[Math.floor(Math.random()*pool.length)][aField]); const shuffled=[...options].sort(()=>Math.random()-0.5);
  state.quizRound={ correct: correctText, solved:false };
  wrap.innerHTML='';
  shuffled.forEach(opt=>{ const b=document.createElement('button'); b.textContent=opt;
    b.addEventListener('click', ()=>{
      if (state.quizRound.solved) return;
      const good = equalsNormalized(opt, state.quizRound.correct);
      if (good){ b.classList.add('ok'); state.quizRound.solved=true; setTimeout(()=>{ addXP(5); cheer(); buildQuiz(); }, 550); }
      else { b.classList.add('bad'); setTimeout(()=> b.classList.remove('bad'), 500); /* stay on same question */ }
    });
    wrap.appendChild(b);
  });
}

// Tabs
$("#tabs").addEventListener('click', (e)=>{ const t=e.target.closest('.tab'); if (!t) return; $$('.tab').forEach(x=>x.classList.remove('active')); t.classList.add('active'); state.mode=t.dataset.tab; $$('.activity').forEach(x=>x.classList.add('hidden')); $('#'+state.mode).classList.remove('hidden'); if (state.mode==='quiz') buildQuiz(); if (state.mode==='match') buildMatch(); if (state.mode==='write') setTimeout(()=>$("#writeInput")?.focus(),50); save(); });

// Language/book/lessons
$("#langSelect").addEventListener('change', e=>{ state.lang=e.target.value; save(); populateLessons(); buildDue(); nextCard(); if (state.mode==='quiz') buildQuiz(); if (state.mode==='match') buildMatch(); });
$("#bookSelect").addEventListener('change', e=>{ state.book=e.target.value; save(); populateLangSelect(); populateLessons(); buildDue(); nextCard(); if (state.mode==='quiz') buildQuiz(); if (state.mode==='match') buildMatch(); });
$("#lessonSelect").addEventListener('change', ()=>{ buildDue(); nextCard(); if (state.mode==='quiz') buildQuiz(); if (state.mode==='match') buildMatch(); });

// Footer & Theme
$("#btnTheme").addEventListener('click', ()=>{ const pop=$("#themePopup"); if (pop.classList.contains('hidden')) openThemePopup(); else closeThemePopup(); });
document.addEventListener('click', e=>{ const pop=$("#themePopup"); if (!pop.classList.contains('hidden') && !pop.contains(e.target) && e.target.id!=='btnTheme') closeThemePopup(); });

// Filters collapse
$("#btnFilters").addEventListener('click', ()=>{ const box=$("#filters"); const open=!box.classList.contains('open'); box.classList.toggle('open', open); $("#btnFilters").textContent=open?'Ausblenden':'Einblenden'; });

// Parent modal minimal (unchanged logic from previous versions) -- omitted for brevity in this build
function renderProgress(){ const list=$("#progressList"); if (!list) return; list.innerHTML=''; const p=P(); const items=[`Heute: ${p.reviewsToday} Aufgaben, ${p.xp} XP gesamt`,`Streak: ${p.streak} Tage`, p.goals?.lessons?.length?`Ziel‑Lektionen heute: ${p.goals.lessons.join(', ')}`:'Kein Lektionen‑Ziel', `Zeit‑Ziel: ${p.goals.minutes||15} Minuten`, state.book?`Aktuelles Buch: ${state.book}`:'Kein Buch gewählt']; items.forEach(it=>{ const d=document.createElement('div'); d.textContent=it; list.appendChild(d); }); }

// Parent modal open/close
$("#btnParent").addEventListener('click', ()=>{ $("#parentModal").classList.remove('hidden'); document.body.classList.add('no-scroll'); renderParent(); });
$("#btnCloseParent").addEventListener('click', ()=>{ $("#parentModal").classList.add('hidden'); document.body.classList.remove('no-scroll'); });

function renderParent(){ const sel=$("#kidSelect"); sel.innerHTML=''; Object.keys(state.profiles).forEach(n=> sel.appendChild(new Option(n,n))); sel.value=state.activeKid; $("#goalLessons").value=(P().goals.lessons||[]).join(', '); $("#goalMinutes").value=P().goals.minutes||15; $("#reminders").checked=!!P().scheduleNoti; $("#importStatus").textContent=''; renderProgress(); }
$("#kidSelect").addEventListener('change', e=> setKid(e.target.value));
$("#btnAddKid").addEventListener('click', ()=>{ const name=prompt('Name des Kindes?'); if (!name) return; if (state.profiles[name]){ alert('Name existiert bereits.'); return; } state.profiles[name]=defaultProfile(); setKid(name); renderParent(); save(); });
$("#btnSaveGoal").addEventListener('click', ()=>{ P().goals.lessons=$("#goalLessons").value.split(',').map(s=>s.trim()).filter(Boolean); P().goals.minutes=parseInt($("#goalMinutes").value||'15',10); save(); toast('Ziel gespeichert.'); });

$("#btnImport").addEventListener('click', async ()=>{
  const btn=$("#btnImport"), status=$("#importStatus"); const file=$("#fileInput").files[0]; const book=$("#bookName").value.trim(); const base=$("#baseLang").value;
  if (!file||!book){ toast('Datei und Buchname angeben.','sheep'); return; }
  btn.disabled=true; const old=btn.textContent; btn.textContent='Importiere…'; status.textContent='Import läuft…';
  try{
    const text=await file.text(); let records=[]; if (file.name.endsWith('.json')) records=JSON.parse(text); else records=parseCSV(text);
    const items=normalize(records, book, base); if (!items.length){ status.textContent='Keine Vokabeln erkannt.'; toast('Konnte keine Vokabeln erkennen.','sheep'); return; }
    const key=o=>[o.book,o.base,o.de||'',o.la||'',o.en||''].join('|'); const existing=new Set(state.data.map(key)); let added=0; for (const it of items) if (!existing.has(key(it))){ state.data.push(it); added++; }
    save(); populateBooks(); $("#bookSelect").value=book; state.book=book; populateLangSelect(); populateLessons(); buildDue(); nextCard(); status.textContent=`Import ok: ${added} Einträge`; toast(`Import ok: ${added} Einträge`,'turtle');
  } finally { btn.disabled=false; btn.textContent=old; }
});

function init(){ applyTheme(state.theme); populateBooks(); populateLangSelect(); populateLessons(); refreshKpis(); buildDue(); nextCard(); setTimeout(cheer, 1000); }
init();
