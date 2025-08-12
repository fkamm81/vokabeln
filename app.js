
const $=s=>document.querySelector(s);const $$=s=>Array.from(document.querySelectorAll(s));
const DBKEY='vocab-v9';
const state={data:[],lang:'latin',book:null,profiles:{},activeKid:null,theme:'ocean',currentByMode:{},firstWrongInRound:false};
function defaultProfile(){return{xp:0,streak:0,lastDay:null,reviewsToday:0,perCard:{}}}
function load(){try{const saved=JSON.parse(localStorage.getItem(DBKEY)||'{}');Object.assign(state,saved);if(!state.activeKid){state.profiles['Kind 1']=state.profiles['Kind 1']||defaultProfile();state.activeKid='Kind 1';}}catch(e){}}
function save(){localStorage.setItem(DBKEY,JSON.stringify(state))}load();
function P(){return state.profiles[state.activeKid]}
function refresh(){ $('#xp').textContent=P().xp; $('#streak').textContent=P().streak; $('#kidBadge').textContent=state.activeKid; }
function toast(m){const t=document.createElement('div');t.className='toast';t.innerHTML=`<div class="msg"><svg><use href="assets/mascots.svg#turtle"/></svg><div>${m}</div></div>`;document.body.appendChild(t);setTimeout(()=>t.remove(),1500)}
function normalizeText(t){return (t||'').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'')}
function splitAlternatives(s){return String(s||'').split(/[,/;]| oder |\bor\b/).map(x=>x.trim()).filter(Boolean)}
function exactOrAltMatch(opt,correct){const A=normalizeText(opt);const alts=splitAlternatives(correct).map(normalizeText);return alts.includes(A)}
function nearMiss(ans,want){const A=normalizeText(ans);const alts=splitAlternatives(want).map(normalizeText);function lev(a,b){const m=a.length,n=b.length;if(!m)return n;if(!n)return m;const dp=Array(n+1).fill(0).map((_,j)=>j);for(let i=1;i<=m;i++){let prev=dp[0];dp[0]=i;for(let j=1;j<=n;j++){const tmp=dp[j];const cost=a[i-1]===b[j-1]?0:1;dp[j]=Math.min(dp[j]+1,dp[j-1]+1,prev+cost);prev=tmp;}}return dp[n];}for(const W of alts){let tol=0;if(W.length<=4)tol=0;else if(W.length<=7)tol=1;else tol=Math.max(2,Math.floor(W.length*0.15));if(A!==W){const d=lev(A,W);if(d>0&&d<=tol) return true;}}return false}
function fields(){switch(state.lang){case'latin':return['la','de'];case'latin_rev':return['de','la'];case'english':return['en','de'];case'english_rev':return['de','en']}}
function base(){return state.lang.startsWith('latin')?'latin':'english'}
function pool(){const ls=Array.from($('#lessonSelect').selectedOptions).map(o=>o.value);return state.data.filter(d=>d.book===state.book&&d.base===base()&&(ls.length?ls.includes(d.lesson):true))}
function buildDue(){const now=Date.now(),p=P();p.due=pool().filter(d=>{const s=p.perCard[d.id];return !s||!s.due||s.due<=now}).map(d=>d.id)}
function pickDueOrPool(arr){const p=P();const due=(p.due||[]).filter(id=>arr.some(x=>x.id===id));return due.length?arr.filter(x=>due.includes(x.id)):arr}
function reviewOutcome(quality,card){const p=P();const id=card?.id;if(!id)return;let s=p.perCard[id]||{EF:2.5,interval:0,reps:0,due:0};if(quality<3){s.reps=0;s.interval=1}else{s.reps+=1;if(s.reps===1)s.interval=1;else if(s.reps===2)s.interval=6;else s.interval=Math.round(s.interval*s.EF);s.EF=Math.max(1.3,s.EF+(0.1-(5-quality)*(0.08+(5-quality)*0.02)))}s.due=Date.now()+Math.max(1,s.interval)*86400000;p.perCard[id]=s;P().reviewsToday++;save();buildDue()}
function addXP(n){const p=P();p.xp+=n;const today=new Date().toDateString();if(p.lastDay!==today){const y=new Date(p.lastDay||Date.now()-86400000);const diff=Math.floor((new Date(today)-new Date(y.toDateString()))/86400000);p.streak=(diff===1)?(p.streak+1):1;p.lastDay=today}save();refresh()}
function setCurrent(mode,card){state.currentByMode[mode]=card}
function current(mode){return state.currentByMode[mode]}

function parseCSV(text){const rows=[];let row=[],field='',q=false;for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1];if(c=='"'){if(q&&n=='"'){field+='"';i++;}else q=!q;}else if(c==','&&!q){row.push(field.trim());field='';}else if((c=='\n'||c=='\r')&&!q){if(field!==''||row.length){row.push(field.trim());rows.push(row);row=[];field='';}}else field+=c;}if(field!==''||row.length){row.push(field.trim());rows.push(row);}const header=rows.shift().map(h=>h.toLowerCase());return rows.map(r=>Object.fromEntries(header.map((h,i)=>[h,r[i]])))}
function normalize(records,book,b){const out=[];for(const r of records){const k=Object.fromEntries(Object.keys(r).map(x=>[x.toLowerCase(),x]));const de=r[k.deutsch]??r[k.de]??'';const la=r[k.latein]??r[k.latin]??r[k.lat]??'';const en=r[k.englisch]??r[k.english]??'';const lesson=(r[k.lektion]??r[k.lesson]??r[k.kapitel]??'1')+'';if((de&&la)||(de&&en)||(la&&en)){out.push({id:crypto.randomUUID(),book,base:b,lesson:lesson.trim(),de:(de||'').trim(),la:(la||'').trim(),en:(en||'').trim()})}}return out}
function allBooks(){return [...new Set(state.data.map(d=>d.book))].filter(Boolean).sort()}
function populateBooks(){const sel=$('#bookSelect');sel.innerHTML='';const books=allBooks();if(!books.length){state.book=null;sel.appendChild(new Option('(kein Buch)',''));return}for(const b of books){sel.appendChild(new Option(b,b))}if(!state.book||!books.includes(state.book))state.book=books[0];sel.value=state.book}
function availableLangOptions(){const bases=new Set(state.data.filter(d=>d.book===state.book).map(d=>d.base));const o=[];if(bases.has('latin')){o.push(['latin','Latein → Deutsch'],['latin_rev','Deutsch → Latein'])}if(bases.has('english')){o.push(['english','Englisch → Deutsch'],['english_rev','Deutsch → Englisch'])}return o}
function populateLangSelect(){const sel=$('#langSelect');sel.innerHTML='';const opts=availableLangOptions();if(!opts.length){sel.appendChild(new Option('(keine)',''));return}let found=false;for(const [v,l] of opts){const o=new Option(l,v);sel.appendChild(o);if(state.lang===v)found=true}if(!found)state.lang=opts[0][0];sel.value=state.lang}
function populateLessons(){const sel=$('#lessonSelect');sel.innerHTML='';const lessons=[...new Set(state.data.filter(d=>d.book===state.book&&d.base===base()).map(d=>d.lesson))].sort((a,b)=>(a*1)-(b*1));for(const L of lessons){sel.appendChild(new Option('Lektion '+L,L))}}

function nextCardWriteListenSpeak(){const arr=pickDueOrPool(pool());if(!arr.length){$('#flashCard').textContent='Keine passenden Vokabeln.';return}const pick=arr[Math.random()*arr.length|0];setCurrent('write',pick);setCurrent('listen',pick);setCurrent('speak',pick); // each gets its own, but same pick for simplicity now
// flash shows question as well
const [q,a]=fields();$('#flashCard').textContent=pick[q]||'–';$('#flash').classList.remove('revealed');
$('#writePrompt').textContent=pick[q]?`Was bedeutet „${pick[q]}“?`:'Was bedeutet …?';$('#writeFeedback').textContent='';$('#writeCard').classList.remove('ok','bad');$('#writeInput').value='';$('#btnCheckWrite').textContent='Prüfen';
$('#listenPrompt').textContent='🎧 Wir sprechen ein Wort – übersetze es.';$('#listenInput').value='';
$('#speakPrompt').textContent=pick[q]?`🎙️ Sprich die Übersetzung von: „${pick[q]}“`:'🎙️ Sprich die Übersetzung.';
}

function nextCardQuiz(){const arr=pickDueOrPool(pool());const wrap=$('#quizOptions');const prompt=$('#quizPrompt');if(arr.length<4){prompt.textContent='Bitte mehr Vokabeln importieren.';wrap.innerHTML='';return}
const [q,a]=fields();const card=arr[Math.random()*arr.length|0];setCurrent('quiz',card);state.firstWrongInRound=false;prompt.textContent=card[q];
const correctAlts=splitAlternatives(card[a]);const correctAlt=correctAlts[Math.random()*correctAlts.length|0]; // choose ONE alternative as the correct option
// build distractor pool as single alternatives from other cards
const others=pool().filter(x=>x.id!==card.id);
let distractorAlts=[];for(const c of others){distractorAlts.push(...splitAlternatives(c[a]))}
distractorAlts = distractorAlts.filter(x=>normalizeText(x) && normalizeText(x)!==normalizeText(correctAlt));
// pick 3 unique distractors
const picks=new Set();while(picks.size<3 && distractorAlts.length){const idx=Math.random()*distractorAlts.length|0;picks.add(distractorAlts.splice(idx,1)[0])}
const options=[correctAlt,...picks];while(options.length<4){options.push('—')} // fallback if data too small
options.sort(()=>Math.random()-0.5);
wrap.innerHTML='';options.forEach(opt=>{const b=document.createElement('button');b.textContent=opt;b.addEventListener('click',()=>{
  const good=exactOrAltMatch(opt, card[a]); // compare against ALL alternatives of correct card
  if(good){b.classList.add('ok');wrap.querySelectorAll('button').forEach(x=>x.disabled=true);setTimeout(()=>{reviewOutcome(state.firstWrongInRound?2:4,card);addXP(state.firstWrongInRound?3:5);nextCardQuiz()},500);}
  else{state.firstWrongInRound=true;b.classList.add('bad');b.disabled=true;}
});wrap.appendChild(b);});
}

function init(){applyTheme(state.theme);populateBooks();populateLangSelect();populateLessons();refresh();buildDue();nextCardWriteListenSpeak();}
/* Theme popup (minimal) */
function applyTheme(id){ state.theme=id; save(); }

// Events
$('#tabs').addEventListener('click',e=>{const t=e.target.closest('.tab');if(!t)return;$$('.tab').forEach(x=>x.classList.remove('active'));t.classList.add('active');$$('.activity').forEach(x=>x.classList.add('hidden'));$('#'+t.dataset.tab).classList.remove('hidden');if(t.dataset.tab==='quiz')nextCardQuiz();if(t.dataset.tab==='match')buildMatch();if(t.dataset.tab==='write') setTimeout(()=>$('#writeInput')?.focus(),50)});
$('#btnFilters').addEventListener('click',()=>{const box=$('#filters');const open=!box.classList.contains('open');box.classList.toggle('open',open);$('#btnFilters').textContent=open?'Ausblenden':'Einblenden';});
$('#langSelect').addEventListener('change',e=>{state.lang=e.target.value;save();populateLessons();buildDue();nextCardWriteListenSpeak(); if(!$('#quiz').classList.contains('hidden')) nextCardQuiz();});
$('#bookSelect').addEventListener('change',e=>{state.book=e.target.value;save();populateLangSelect();populateLessons();buildDue();nextCardWriteListenSpeak(); if(!$('#quiz').classList.contains('hidden')) nextCardQuiz();});
$('#lessonSelect').addEventListener('change',()=>{buildDue();nextCardWriteListenSpeak(); if(!$('#quiz').classList.contains('hidden')) nextCardQuiz();});

// Flashcards
$('#btnShow').addEventListener('click',()=>{const [q,a]=fields();const c=current('write')||current('quiz')||{};$('#flashCard').innerHTML=`<div>${c[q]||''}</div><div class="badge">${c[a]||''}</div>`;$('#flash').classList.add('revealed');});
$('#btnEasy').addEventListener('click',()=>{const c=current('write');reviewOutcome(5,c);addXP(8);nextCardWriteListenSpeak()});
$('#btnGood').addEventListener('click',()=>{const c=current('write');reviewOutcome(4,c);addXP(6);nextCardWriteListenSpeak()});
$('#btnHard').addEventListener('click',()=>{const c=current('write');reviewOutcome(2,c);addXP(3);nextCardWriteListenSpeak()});

// Listen (no reveal of word)
const synth=window.speechSynthesis;
function speak(text,lang){if(!synth)return;const u=new SpeechSynthesisUtterance(text);u.lang=lang;synth.cancel();synth.speak(u);}
$('#btnSpeak').addEventListener('click',()=>{const [q]=fields();const c=current('listen');const code=(q==='la')?'la':(q==='en'?'en-US':'de-DE');if(c&&c[q])speak(c[q],code)});
$('#btnCheckListen').addEventListener('click',()=>{const c=current('listen');const [q,a]=fields();const ans=$('#listenInput').value;const want=c?c[a]:'';const fb=$('#listenPrompt');if(!c)return;
const exact=exactOrAltMatch(ans,want);const near=!exact && nearMiss(ans,want);
if(exact){fb.textContent='Richtig!';fb.classList.add('ok');setTimeout(()=>{fb.classList.remove('ok');$('#listenInput').value='';reviewOutcome(4,c);addXP(6);nextCardWriteListenSpeak()},500);}
else if(near){fb.textContent='Fast richtig (Tippfehler). Gesucht: '+splitAlternatives(want).join(', ');fb.classList.add('bad');setTimeout(()=>{fb.classList.remove('bad');$('#listenInput').value='';reviewOutcome(2,c);addXP(2);nextCardWriteListenSpeak()},700);}
else{fb.textContent='Gesucht: '+splitAlternatives(want).join(', ');fb.classList.add('bad');setTimeout(()=>{fb.classList.remove('bad');$('#listenInput').value='';reviewOutcome(2,c);nextCardWriteListenSpeak()},700);}});

// Schreiben
let writeNext=false;
$('#btnCheckWrite').addEventListener('click',()=>{const c=current('write');if(writeNext){nextCardWriteListenSpeak();$('#writeInput').focus();writeNext=false;return;}if(!c)return;const [q,a]=fields();const ans=$('#writeInput').value;const want=c[a];const fb=$('#writeFeedback');const exact=exactOrAltMatch(ans,want);const near=!exact&&nearMiss(ans,want);const full=splitAlternatives(want).join(', ');
if(exact){fb.textContent='Richtig: '+full;$('#writeCard').classList.add('ok');reviewOutcome(4,c);addXP(6);}
else if(near){fb.textContent='Fast richtig (Tippfehler). Gesucht: '+full;$('#writeCard').classList.add('bad');reviewOutcome(2,c);addXP(2);}
else{fb.textContent='Gesucht: '+full;$('#writeCard').classList.add('bad');reviewOutcome(2,c);}
$('#btnCheckWrite').textContent='Weiter';writeNext=true;$('#writeInput').value='';});

// Match (keep visible)
function buildMatch(){const arr=pool().slice().sort(()=>Math.random()-0.5).slice(0,8);const wrap=$('#matchGrid');if(!arr.length){wrap.textContent='Bitte passende Daten importieren.';return}const [q,a]=fields();wrap.innerHTML='';let selected=null;const solved=new Set();
function col(items,side){const c=document.createElement('div');c.style.display='grid';c.style.gap='8px';items.forEach(it=>{const b=document.createElement('button');b.textContent=it.t;b.dataset.id=it.id;b.addEventListener('click',()=>{if(solved.has(it.id))return;if(side==='L'){ $$('#matchGrid .selected').forEach(x=>x.classList.remove('selected')); selected=it.id; b.classList.add('selected'); } else { if(!selected){b.classList.add('bad');setTimeout(()=>b.classList.remove('bad'),500);return;} const leftBtn=wrap.querySelector(`[data-id="${selected}"]`);const isMatch=(selected===it.id);if(isMatch){leftBtn.classList.add('ok','solved');leftBtn.disabled=true;b.classList.add('ok','solved');b.disabled=true;solved.add(it.id);reviewOutcome(4,arr.find(x=>x.id===it.id));addXP(3);selected=null;if(solved.size===arr.length)setTimeout(buildMatch,600);} else {leftBtn.classList.add('bad');b.classList.add('bad');setTimeout(()=>{leftBtn.classList.remove('bad');b.classList.remove('bad')},500);reviewOutcome(2,arr.find(x=>x.id===selected));}}});c.appendChild(b)});return c}
const left=arr.map(x=>({id:x.id,t:x[q]}));const right=arr.map(x=>({id:x.id,t:x[a]})).sort(()=>Math.random()-0.5);const cont=document.createElement('div');cont.style.display='grid';cont.style.gridTemplateColumns='1fr 1fr';cont.style.gap='12px';cont.appendChild(col(left,'L'));cont.appendChild(col(right,'R'));wrap.appendChild(cont);}

// Parent modal / import (minimal)
$('#btnParent').addEventListener('click',()=>{$('#parentModal').classList.remove('hidden');document.body.classList.add('no-scroll');renderParent()});
$('#btnCloseParent').addEventListener('click',()=>{$('#parentModal').classList.add('hidden');document.body.classList.remove('no-scroll')});
function renderParent(){const sel=$('#kidSelect');sel.innerHTML='';Object.keys(state.profiles).forEach(n=>sel.appendChild(new Option(n,n)));sel.value=state.activeKid;$('#importStatus').textContent='';}
$('#kidSelect').addEventListener('change',e=>{state.activeKid=e.target.value;save();refresh()});
$('#btnAddKid').addEventListener('click',()=>{const name=prompt('Name des Kindes?');if(!name)return;if(state.profiles[name]){alert('Name existiert bereits.');return}state.profiles[name]=defaultProfile();state.activeKid=name;save();renderParent();refresh()});
$('#btnImport').addEventListener('click',async ()=>{const f=$('#fileInput').files[0];const book=$('#bookName').value.trim();const baseLang=$('#baseLang').value;if(!f||!book){toast('Datei und Buchname angeben.');return}const btn=$('#btnImport');btn.disabled=true;$('#importStatus').textContent='Import läuft…';const text=await f.text();let recs=[];if(f.name.endsWith('.json'))recs=JSON.parse(text);else recs=parseCSV(text);const items=normalize(recs,book,baseLang);const key=o=>[o.book,o.base,o.de||'',o.la||'',o.en||''].join('|');const exist=new Set(state.data.map(key));let added=0;for(const it of items){if(!exist.has(key(it))){state.data.push(it);added++}}save();populateBooks();$('#bookSelect').value=book;state.book=book;populateLangSelect();populateLessons();buildDue();nextCardWriteListenSpeak();$('#importStatus').textContent='Import ok: '+added+' Einträge';btn.disabled=false;});
// init
function applyTheme(id){state.theme=id;save()}
$('#btnTheme').addEventListener('click',()=>toast('Theme-Popup 😄'));
$('#btnFilters').click();
function init(){populateBooks();populateLangSelect();populateLessons();refresh();buildDue();nextCardWriteListenSpeak()} init();
