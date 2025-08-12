
const $=q=>document.querySelector(q); const $$=q=>Array.from(document.querySelectorAll(q));
const DBKEY='vocab-helden-v8';
const state={data:[],mode:'flash',lang:'latin',book:null,themes:[
  {id:'ocean',name:'Ocean',vars:{bg:'#0b132b',panel:'#1c2541',accent:'#3a86ff',text:'#f6f7fb',btn:'#0d1b2a'}},
  {id:'forest',name:'Forest',vars:{bg:'#0b2b1a',panel:'#163822',accent:'#34d399',text:'#eafff3',btn:'#0a1f14'}},
  {id:'sunset',name:'Sunset',vars:{bg:'#2b0b14',panel:'#3a1421',accent:'#ff7a59',text:'#fff4f0',btn:'#2a0e15'}},
  {id:'contrast',name:'Kontrast',vars:{bg:'#000',panel:'#111',accent:'#ffd60a',text:'#fff',btn:'#1c1c1c'}}
],theme:'ocean',profiles:{},activeKid:null,firstWrongInRound:false,writeAwaitNext:false};

function defaultProfile(){return{xp:0,streak:0,lastDay:null,reviewsToday:0,perCard:{},goals:{lessons:[],minutes:15},scheduleNoti:false};}
function load(){try{const saved=JSON.parse(localStorage.getItem(DBKEY)||'{}');Object.assign(state,saved);if(!state.activeKid){state.profiles['Kind 1']=state.profiles['Kind 1']||defaultProfile();state.profiles['Kind 2']=state.profiles['Kind 2']||defaultProfile();state.activeKid='Kind 1';}for(const k in state.profiles){const p=state.profiles[k];if(p.lastDay&&new Date(p.lastDay).toDateString()!==new Date().toDateString()){p.reviewsToday=0;}}}catch(e){console.warn(e);}}
function save(){localStorage.setItem(DBKEY,JSON.stringify(state));}
load();

function applyTheme(id){const t=state.themes.find(x=>x.id===id)||state.themes[0];state.theme=t.id;save();const r=document.documentElement;
r.style.setProperty('--bg',t.vars.bg);r.style.setProperty('--panel',t.vars.panel);r.style.setProperty('--accent',t.vars.accent);r.style.setProperty('--text',t.vars.text);r.style.setProperty('--btn',t.vars.btn||'#0d1b2a');
$$("select, button, input[type='text'], input[type='number']").forEach(el=>{el.style.background='var(--btn)';el.style.color='var(--text)';});}
function openThemePopup(){const pop=$("#themePopup");const dots=$("#themeDots");dots.innerHTML='';state.themes.forEach(t=>{const b=document.createElement('button');b.className='theme-dot'+(state.theme===t.id?' active':'');b.style.background=t.vars.accent;b.title=t.name;b.onclick=()=>{applyTheme(t.id);$$('#themeDots .theme-dot').forEach((x,i)=>x.classList.toggle('active',state.themes[i].id===state.theme));};dots.appendChild(b);});pop.classList.remove('hidden');}
function closeThemePopup(){ $("#themePopup").classList.add('hidden'); }
function toast(){ /* disabled */ }"/></svg><div>${msg}</div></div>`;document.body.appendChild(t);setTimeout(()=>t.remove(),1800);}
function cheer(){ /* disabled */ }
function P(){return state.profiles[state.activeKid]}
function setKid(n){state.activeKid=n;save();refreshKpis();renderProgress();}
function refreshKpis(){$("#xp").textContent=P().xp;$("#streak").textContent=P().streak;$("#kidBadge").textContent=state.activeKid;}

function parseCSV(text){const rows=[];let row=[],field='',inQ=false;for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1];if(c==='\"'){if(inQ&&n==='\"'){field+='\"';i++;}else inQ=!inQ;}else if(c===','&&!inQ){row.push(field.trim());field='';}else if((c==='\n'||c==='\r')&&!inQ){if(field!==''||row.length){row.push(field.trim());rows.push(row);row=[];field='';}}else field+=c;}if(field!==''||row.length){row.push(field.trim());rows.push(row);}const header=rows.shift().map(h=>h.toLowerCase());return rows.map(r=>Object.fromEntries(header.map((h,i)=>[h,r[i]])));}
function normalize(records,book,base){const out=[];for(const r of records){const k=Object.fromEntries(Object.keys(r).map(x=>[x.toLowerCase(),x]));const de=r[k.deutsch]??r[k.de]??r[k.german]??'';const la=r[k.latein]??r[k.latin]??r[k.lat]??r[k.la]??'';const en=r[k.englisch]??r[k.english]??r[k.en]??'';const lesson=r[k.lektion]??r[k.lesson]??r[k.kapitel]??'1';if((de&&la)||(de&&en)||(la&&en)){out.push({id:crypto.randomUUID(),book,base,lesson:String(lesson).trim(),de:(de||'').trim(),la:(la||'').trim(),en:(en||'').trim()});}}return out;}
function allBooks(){return [...new Set(state.data.map(d=>d.book))].filter(Boolean).sort();}
function populateBooks(){const sel=$("#bookSelect");sel.innerHTML='';const books=allBooks();if(!books.length){state.book=null;sel.appendChild(new Option('(kein Buch)',''));return;}books.forEach(b=>sel.appendChild(new Option(b,b)));if(!state.book||!books.includes(state.book))state.book=books[0];sel.value=state.book;}
function availableLangOptions(){const pool=state.data.filter(d=>d.book===state.book);const bases=new Set(pool.map(d=>d.base));const opts=[];if(bases.has('latin'))opts.push(['latin','Latein → Deutsch'],['latin_rev','Deutsch → Latein']);if(bases.has('english'))opts.push(['english','Englisch → Deutsch'],['english_rev','Deutsch → Englisch']);return opts;}
function populateLangSelect(){const sel=$("#langSelect");sel.innerHTML='';const opts=availableLangOptions();if(!opts.length){sel.appendChild(new Option('(keine Richtung)','latin'));return;}let found=false;for(const [v,l] of opts){const o=new Option(l,v);sel.appendChild(o);if(state.lang===v)found=true;}if(!found)state.lang=opts[0][0];sel.value=state.lang;}
function populateLessons(){const sel=$("#lessonSelect");sel.innerHTML='';const pool=state.data.filter(d=>d.book===state.book&&baseForMode()===d.base);const lessons=[...new Set(pool.map(d=>d.lesson))].sort((a,b)=>(a*1)-(b*1));lessons.forEach(L=>sel.appendChild(new Option('Lektion '+L,L)));}

async function ensureNotifications(){if(!('Notification'in window))return false; if(Notification.permission==='granted')return true; if(Notification.permission!=='denied'){const p=await Notification.requestPermission();return p==='granted';} return false;}
function scheduleDailyReminder(h=17){P().scheduleNoti=true;save();ensureNotifications().then(g=>{if(!g){toast('Benachrichtigungen nicht erlaubt.');return;}const check=()=>{const n=new Date();if(n.getHours()>=h&&(localStorage.getItem('remindedDay_'+state.activeKid)!==n.toDateString())){new Notification('Vokabelhelden',{body:`${state.activeKid}: kurze Vokabelrunde? 🔥`,icon:'icons/icon-192.png'});localStorage.setItem('remindedDay_'+state.activeKid,n.toDateString());}};check();setInterval(check,3600000);});}

function addXP(n=5){const p=P();p.xp+=n;const today=new Date().toDateString();if(p.lastDay!==today){const y=new Date(p.lastDay||Date.now()-86400000);const diff=Math.floor((new Date(today)-new Date(y.toDateString()))/86400000);p.streak=(diff===1)?(p.streak+1):1;p.lastDay=today;}p.reviewsToday++;save();refreshKpis();}

function baseForMode(){return state.lang.startsWith('latin')?'latin':'english';}
function fieldsForMode(){switch(state.lang){case'latin':return['la','de'];case'latin_rev':return['de','la'];case'english':return['en','de'];case'english_rev':return['de','en'];}}
function chosenLessons(){return Array.from($("#lessonSelect").selectedOptions).map(o=>o.value);}
function poolItems(){const base=baseForMode();return state.data.filter(d=>d.book===state.book&&d.base===base&&(chosenLessons().length?chosenLessons().includes(d.lesson):true));}
function buildDue(){const now=Date.now();const p=P();p.due=poolItems().filter(d=>{const s=p.perCard[d.id];return !s||!s.due||s.due<=now;}).map(d=>d.id);}
function reviewOutcome(q){const p=P();const id=state.current?.id;if(!id) return;let s=p.perCard[id]||{EF:2.5,interval:0,reps:0,due:0};if(q<3){s.reps=0;s.interval=1;}else{s.reps+=1;if(s.reps===1)s.interval=1;else if(s.reps===2)s.interval=6;else s.interval=Math.round(s.interval*s.EF);s.EF=Math.max(1.3,s.EF+(0.1-(5-q)*(0.08+(5-q)*0.02)));}s.due=Date.now()+Math.max(1,s.interval)*86400000;p.perCard[id]=s;save();buildDue();}
function pickDueOrPool(pool){const p=P();const due=(p.due||[]).filter(id=>pool.some(x=>x.id===id));return due.length?pool.filter(d=>due.includes(d.id)):pool;}

function splitAlternatives(s){return String(s||'').split(/[,/;]| oder |\bor\b/).map(x=>x.trim()).filter(Boolean);}
/* EXACT algorithm for Quiz: exact string equality (trim), case-sensitive off? We'll keep case-insensitive exact */
function exactOptionMatch(option, correctText){const o=option.trim();return splitAlternatives(correctText).some(w=>w.trim().toLowerCase()===o.toLowerCase());}

function nextCard(){
  if(!state.data.length||!state.book){$("#flashCard").textContent="Bitte Daten importieren und Buch wählen.";return;}
  const [qField]=fieldsForMode();const pool=poolItems();if(!pool.length){$("#flashCard").textContent="Keine passenden Vokabeln.";return;}
  const arr=pickDueOrPool(pool);const pick=arr[Math.floor(Math.random()*arr.length)];state.current=pick;
  $("#flashCard").textContent=pick[qField]||'–';$("#flash").classList.remove('revealed');
  $("#writePrompt").textContent=pick[qField]?`Was bedeutet „${pick[qField]}“?`:'Was bedeutet …?';$("#writeFeedback").textContent='';$("#writeCard").classList.remove('ok','bad');$("#writeInput").value='';$("#btnCheckWrite").textContent='Prüfen';state.writeAwaitNext=false;
  $("#listenPrompt").textContent='🎧 Wir sprechen ein Wort – übersetze es.';$("#listenInput").value='';
  $("#speakPrompt").textContent=pick[qField]?`🎙️ Sprich die Übersetzung von: „${pick[qField]}“`:'🎙️ Sprich die Übersetzung.';
  if(!$('#write').classList.contains('hidden')) setTimeout(()=>$("#writeInput")?.focus(),50);
}

// Flashcards
$("#btnShow").onclick=()=>{const [qField,aField]=fieldsForMode();const q=state.current?state.current[qField]||'':'';const a=state.current?state.current[aField]||'':'';$("#flashCard").innerHTML=`<div>${q}</div><div class="badge">${a}</div>`;$("#flash").classList.add('revealed');};
$("#btnEasy").onclick=()=>{reviewOutcome(5);addXP(8);cheer();nextCard();};
$("#btnGood").onclick=()=>{reviewOutcome(4);addXP(6);cheer();nextCard();};
$("#btnHard").onclick=()=>{reviewOutcome(2);addXP(3);cheer();nextCard();};

// QUIZ (exact matching)
function buildQuiz(){
  const pool=poolItems();const prompt=$("#quizPrompt"),wrap=$("#quizOptions");
  if(pool.length<4){prompt.textContent="Bitte mehr Vokabeln importieren.";wrap.innerHTML='';return;}
  const [qField,aField]=fieldsForMode();const arr=pickDueOrPool(pool);const correct=arr[Math.floor(Math.random()*arr.length)];
  state.current=correct; state.firstWrongInRound=false;
  prompt.textContent=correct[qField]; const correctText=correct[aField]; // reference string
  const opts=new Set([correctText]); while(opts.size<4) opts.add(pool[Math.floor(Math.random()*pool.length)][aField]);
  const shuffled=[...opts].sort(()=>Math.random()-0.5);
  wrap.innerHTML='';
  shuffled.forEach(opt=>{
    const b=document.createElement('button'); b.textContent=opt;
    b.onclick=()=>{
      const good = opt.trim().toLowerCase() === correctText.trim().toLowerCase();
      if(good){
        b.classList.add('ok'); wrap.querySelectorAll('button').forEach(x=>x.disabled=true);
        setTimeout(()=>{reviewOutcome(state.firstWrongInRound?2:4);addXP(state.firstWrongInRound?3:5);cheer();buildQuiz();},500);
      } else {
        state.firstWrongInRound=true; b.classList.add('bad'); b.disabled=true; // keep round until correct
      }
    };
    wrap.appendChild(b);
  });
}

// LISTEN
const synth=window.speechSynthesis;
function speak(text,lang){ if(!synth) return; const u=new SpeechSynthesisUtterance(text); u.lang=lang; synth.cancel(); synth.speak(u); }
$("#btnSpeak").onclick=()=>{ if(!state.current) nextCard(); const [qField]=fieldsForMode(); const lang=(qField==='la')?'la':(qField==='en'?'en-US':'de-DE'); speak(state.current[qField],lang); };
$("#btnCheckListen").onclick=()=>{
  const ans=$("#listenInput").value; const [_,aField]=fieldsForMode(); const want = state.current?.[aField] || ''; const fb=$("#listenPrompt");
  const exact = splitAlternatives(want).some(w=>w.trim().toLowerCase()===ans.trim().toLowerCase());
  if(exact){ fb.classList.add('ok'); fb.textContent='Richtig!'; reviewOutcome(4); addXP(6); cheer(); setTimeout(()=>{fb.classList.remove('ok'); $("#listenInput").value=''; nextCard();},500); }
  else { fb.classList.add('bad'); fb.textContent=`Gesucht: ${splitAlternatives(want).join(', ')}`; reviewOutcome(2); setTimeout(()=>{fb.classList.remove('bad'); $("#listenInput").value=''; nextCard();},700); }
};

// SPEAK
let rec;
$("#btnStartRec").onclick=()=>{
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition; if(!SR){toast('Spracheingabe nicht verfügbar.');return;}
  rec=new SR(); rec.lang=(fieldsForMode()[1]==='la')?'la':'de-DE';
  rec.onresult=(e)=>{ const txt=e.results[0][0].transcript; $("#recOut").textContent='Erkannt: '+txt; const want=state.current?.[fieldsForMode()[1]]||''; const ok=splitAlternatives(want).some(w=>w.trim().toLowerCase()===txt.trim().toLowerCase()); reviewOutcome(ok?4:2); addXP(ok?5:2); toast(ok?'Top!':'Nochmal!', ok?'turtle':'frog'); nextCard(); };
  rec.start(); $("#recOut").textContent='…hört zu';
};
$("#btnStopRec").onclick=()=>{try{rec&&rec.stop();}catch{}};
$("#btnSelfOk").onclick=()=>{reviewOutcome(4);addXP(4);cheer();nextCard();};

// MATCH
function buildMatch(){
  const pool=poolItems().slice().sort(()=>Math.random()-0.5).slice(0,5);
  if(!pool.length){$("#matchGrid").textContent='Bitte passende Daten importieren.';return;}
  const [qField,aField]=fieldsForMode(); const left=pool.map(x=>({id:x.id,t:x[qField]})); const right=pool.map(x=>({id:x.id,t:x[aField]})).sort(()=>Math.random()-0.5);
  const wrap=$("#matchGrid"); wrap.innerHTML=''; let selectedLeft=null; const solved=new Set();
  function render(items,side){const col=document.createElement('div');col.style.display='grid';col.style.gap='8px';
    items.forEach(it=>{const b=document.createElement('button'); b.textContent=it.t; b.dataset.id=it.id;
      b.onclick=()=>{
        if(solved.has(it.id)) return;
        if(side==='L'){ $$('#matchGrid .selected').forEach(x=>x.classList.remove('selected')); selectedLeft=it.id; b.classList.add('selected'); }
        else {
          if(!selectedLeft){ b.classList.add('bad'); setTimeout(()=>b.classList.remove('bad'),500); return; }
          const leftBtn=wrap.querySelector(`[data-id="${selectedLeft}"]`);
          const isMatch = selectedLeft===it.id;
          if(isMatch){
            leftBtn.classList.add('ok','solved'); leftBtn.disabled=true;
            b.classList.add('ok','solved'); b.disabled=true;
            solved.add(it.id); state.current=pool.find(x=>x.id===it.id); reviewOutcome(4); addXP(3); cheer(); selectedLeft=null;
            if(solved.size===pool.length) setTimeout(()=>buildMatch(),600);
          } else {
            leftBtn.classList.add('bad'); b.classList.add('bad'); setTimeout(()=>{leftBtn.classList.remove('bad'); b.classList.remove('bad');},500); state.current=pool.find(x=>x.id===selectedLeft); reviewOutcome(2);
          }
        }
      };
      col.appendChild(b);
    }); return col; }
  const cont=document.createElement('div'); cont.style.display='grid'; cont.style.gridTemplateColumns='1fr 1fr'; cont.style.gap='12px';
  cont.appendChild(render(left,'L')); cont.appendChild(render(right,'R')); wrap.appendChild(cont);
}

// WRITE (capture fields to avoid race)
$("#btnCheckWrite").onclick=()=>{
  if(state.writeAwaitNext){ nextCard(); $("#writeInput").focus(); return; }
  const [qField,aField]=fieldsForMode(); const cur=state.current; const want = cur?.[aField] || ''; const ans=$("#writeInput").value; const fb=$("#writeFeedback"); const full=splitAlternatives(want).join(', ');
  const exact = splitAlternatives(want).some(w=>w.trim().toLowerCase()===ans.trim().toLowerCase());
  if(exact){ fb.textContent=`Richtig: ${full}`; $("#writeCard").classList.add('ok'); $("#writeCard").classList.remove('bad'); reviewOutcome(4); addXP(6); cheer(); }
  else { fb.textContent=`Gesucht: ${full}`; $("#writeCard").classList.add('bad'); $("#writeCard").classList.remove('ok'); reviewOutcome(2); }
  $("#btnCheckWrite").textContent='Weiter'; state.writeAwaitNext=true; $("#writeInput").value='';
};
$("#writeInput").addEventListener('keydown',e=>{ if(e.key==='Enter') $("#btnCheckWrite").click(); });

// Tabs
$("#tabs").onclick=(e)=>{const t=e.target.closest('.tab'); if(!t) return; $$('.tab').forEach(x=>x.classList.remove('active')); t.classList.add('active'); state.mode=t.dataset.tab; $$('.activity').forEach(x=>x.classList.add('hidden')); $('#'+state.mode).classList.remove('hidden');if(state.mode==='listen'){ nextCard('listen'); }else if(state.mode==='speak'){ nextCard('speak'); }else if(state.mode==='write'){ nextCard('write'); } if(state.mode==='quiz') buildQuiz(); if(state.mode==='match') buildMatch(); if(state.mode==='write') setTimeout(()=>$("#writeInput")?.focus(),50); save();};

// Lang/book/lessons
$("#langSelect").onchange=e=>{state.lang=e.target.value; save(); populateLessons(); buildDue(); nextCard(); if(state.mode==='quiz') buildQuiz(); if(state.mode==='match') buildMatch();};
$("#bookSelect").onchange=e=>{state.book=e.target.value; save(); populateLangSelect(); populateLessons(); buildDue(); nextCard(); if(state.mode==='quiz') buildQuiz(); if(state.mode==='match') buildMatch();};
$("#lessonSelect").onchange=()=>{buildDue(); nextCard(); if(state.mode==='quiz') buildQuiz(); if(state.mode==='match') buildMatch();};

// Theme + Filters + Parent modal
$("#btnTheme").onclick=()=>{const p=$("#themePopup"); p.classList.contains('hidden')?openThemePopup():closeThemePopup();};
document.addEventListener('click',e=>{const p=$("#themePopup"); if(!p.classList.contains('hidden')&&!p.contains(e.target)&&e.target.id!=='btnTheme') closeThemePopup();});
$("#btnFilters").onclick=()=>{const b=$("#filters");const open=!b.classList.contains('open');b.classList.toggle('open',open);};
$("#btnParent").onclick=()=>{$("#parentModal").classList.remove('hidden');document.body.classList.add('no-scroll');renderParent();};
$("#btnCloseParent").onclick=()=>{$("#parentModal").classList.add('hidden');document.body.classList.remove('no-scroll');};

function renderParent(){const sel=$("#kidSelect"); sel.innerHTML=''; Object.keys(state.profiles).forEach(n=>sel.appendChild(new Option(n,n))); sel.value=state.activeKid; $("#goalLessons").value=(P().goals.lessons||[]).join(', '); $("#goalMinutes").value=P().goals.minutes||15; $("#reminders").checked=!!P().scheduleNoti; $("#importStatus").textContent=''; renderProgress();}
$("#kidSelect").onchange=e=>setKid(e.target.value);
$("#btnAddKid").onclick=()=>{const name=prompt('Name des Kindes?'); if(!name) return; if(state.profiles[name]){alert('Name existiert bereits.');return;} state.profiles[name]=defaultProfile(); setKid(name); renderParent(); save();};
$("#btnSaveGoal").onclick=()=>{P().goals.lessons=$("#goalLessons").value.split(',').map(s=>s.trim()).filter(Boolean); P().goals.minutes=parseInt($("#goalMinutes").value||'15',10); save(); toast('Ziel gespeichert.');};
$("#reminders").onchange=e=>{ if(e.target.checked) scheduleDailyReminder(17); else {P().scheduleNoti=false; save(); toast('Erinnerungen deaktiviert.');}};

$("#btnImport").onclick=async()=>{
  const btn=$("#btnImport"), status=$("#importStatus"); const file=$("#fileInput").files[0]; const book=$("#bookName").value.trim(); const base=$("#baseLang").value;
  if(!file||!book){toast('Datei und Buchname angeben.','sheep');return;}
  btn.disabled=true; const old=btn.textContent; btn.textContent='Importiere…'; status.textContent='Import läuft…';
  try{
    const text=await file.text(); let recs=[]; if(file.name.endsWith('.json')) recs=JSON.parse(text); else recs=parseCSV(text);
    const items=normalize(recs,book,base); if(!items.length){status.textContent='Keine Vokabeln erkannt.'; toast('Keine Vokabeln erkannt.','sheep'); return;}
    const key=o=>[o.book,o.base,o.de||'',o.la||'',o.en||''].join('|'); const existing=new Set(state.data.map(key)); let added=0;
    for(const it of items) if(!existing.has(key(it))){ state.data.push(it); added++; }
    save(); populateBooks(); $("#bookSelect").value=book; state.book=book; populateLangSelect(); populateLessons(); buildDue(); nextCard();
    status.textContent=`Import ok: ${added} Einträge`; toast(`Import ok: ${added} Einträge`,'turtle');
  }catch(e){ status.textContent='Fehler beim Import.'; } finally{ btn.disabled=false; btn.textContent=old; }
};

function renderProgress(){const list=$("#progressList"); if(!list) return; list.innerHTML=''; const p=P(); [ `Heute: ${p.reviewsToday} Aufgaben, ${p.xp} XP gesamt`, `Streak: ${p.streak} Tage`, p.goals.lessons?.length?`Ziel‑Lektionen heute: ${p.goals.lessons.join(', ')}`:'Kein Lektionen‑Ziel', `Zeit‑Ziel: ${p.goals.minutes} Minuten`, state.book?`Aktuelles Buch: ${state.book}`:'Kein Buch gewählt' ].forEach(t=>{const d=document.createElement('div'); d.textContent=t; list.appendChild(d);});}

function init(){applyTheme(state.theme); populateBooks(); populateLangSelect(); populateLessons(); refreshKpis(); buildDue(); nextCard(); setTimeout(cheer,1000);}
init();


// Filters collapse with chevron toggle
const fbtn = $("#btnFilters");
fbtn.addEventListener('click', ()=>{
  const box = $("#filters");
  const open = !box.classList.contains('open');
  box.classList.toggle('open', open);
  fbtn.textContent = open ? '▴' : '▾';
});






// === v8-quizfix6: delegated click handlers for header/footer icons ===
document.addEventListener('click', (ev) => {
  const t = ev.target;

  // Filter toggle
  const btnFilters = t.closest && t.closest('#btnFilters');
  if (btnFilters) {
    dbg('Filter: Klick');
    const box = document.getElementById('filters');
    if (box) {
      const open = !box.classList.contains('open');
      box.classList.toggle('open', open);
      btnFilters.setAttribute('aria-expanded', open ? 'true' : 'false');
      btnFilters.textContent = open ? '▴' : '▾';
    }
    return;
  }

  // Theme popup
  const btnTheme = t.closest && t.closest('#btnTheme');
  if (btnTheme) {
    dbg('Theme: Klick');
    const pop = document.getElementById('themePopup');
    if (pop) {
      if (pop.classList.contains('hidden')) openThemePopup(); else closeThemePopup();
    }
    return;
  }

  // Parent modal
  const btnParent = t.closest && t.closest('#btnParent');
  if (btnParent) {
    dbg('Elternbereich: Klick');
    const modal = document.getElementById('parentModal');
    if (modal) {
      modal.classList.remove('hidden');
      document.body.classList.add('no-scroll');
      renderParent();
    }
    return;
  }

  // Close theme popup when clicking outside
  dbg('Theme: Klick');
    const pop = document.getElementById('themePopup');
  if (pop && !pop.classList.contains('hidden')) {
    if (!pop.contains(t) && !t.closest('#btnTheme')) { closeThemePopup(); }
  }
});

