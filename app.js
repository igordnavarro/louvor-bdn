(function(){
"use strict";
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

/* ================= storage ================= */
const store = {
  get(k, d){ try{ const v = localStorage.getItem('bdn:'+k); return v==null ? d : JSON.parse(v); }catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem('bdn:'+k, JSON.stringify(v)); return true; }catch(e){ return false; } },
  del(k){ try{ localStorage.removeItem('bdn:'+k); }catch(e){} }
};
/* profiles: each person using the device keeps their own settings & songs */
let profiles = store.get('profiles', null);
if(!profiles){ profiles=['Principal']; store.set('profiles', profiles);
  // migrate data from the first version
  const old=store.get('overrides',null); if(old) store.set('u:Principal:overrides', old); }
let profile = store.get('profile', profiles[0]); if(!profiles.includes(profile)) profile=profiles[0];
const uget = (k,d) => store.get('u:'+profile+':'+k, d);
const uset = (k,v) => store.set('u:'+profile+':'+k, v);

/* ================= theme ================= */
function applyTheme(t){
  if(t) document.documentElement.setAttribute('data-theme', t); else document.documentElement.removeAttribute('data-theme');
  const dark = t ? t==='dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  $('#icoMoon').style.display = dark ? 'none' : '';
  $('#icoSun').style.display = dark ? '' : 'none';
}
applyTheme(store.get('theme', null));
$('#themeBtn').onclick = () => {
  const c = document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark':'light');
  const n = c==='dark' ? 'light' : 'dark'; store.set('theme', n); applyTheme(n);
};

/* ================= music theory ================= */
const SHARP=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const FLAT =['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
const IDX={C:0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,Fb:4,'E#':5,F:5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11,Cb:11,'B#':0};
const FLAT_MAJ=new Set([5,10,3,8,1]), FLAT_MIN=new Set([2,7,0,5,10,3]);
const mod12 = n => ((n%12)+12)%12;
function parseKey(k){ const m=/^\s*([A-G][#b]?)(m(?!aj))?/.exec(k||''); if(!m) return null; return {r:IDX[m[1]], minor:!!m[2]}; }
function useFlats(r, minor){ return minor ? FLAT_MIN.has(mod12(r)) : FLAT_MAJ.has(mod12(r)); }
function keyName(r, minor){ return (useFlats(r,minor)?FLAT:SHARP)[mod12(r)] + (minor?'m':''); }
const CHORD_RE=/^[A-G][#b]?(?:maj|min|dim|aug|sus|add|m|M|º|°|\+|-|[0-9]|\(|\)|#|b)*(?:\/[A-G][#b]?[0-9]?)?$/;
function isChordTok(t){ const c=t.replace(/^[\(\[]+|[\)\]]+$/g,''); return !!c && CHORD_RE.test(c); }
function isMarkTok(t){ return /^[\(\)\|\-–—\/]+$/.test(t) || /^\(?\d+\s?[xX]\)?$/.test(t) || /^[xX]\d+$/.test(t); }
function isChordLine(s){ const t=s.trim().split(/\s+/); if(!t[0]) return false; let n=0; for(const x of t){ if(isChordTok(x)) n++; else if(!isMarkTok(x)) return false; } return n>0; }
function trChord(tok, semi, flats){
  return tok.replace(/([A-G][#b]?)/g, (m, n, off, str) => {
    const prev = off===0 ? '' : str[off-1];
    if(off!==0 && prev!=='/' && prev!=='(' && prev!=='[') return m;
    const i=IDX[n]; if(i==null) return m;
    return (flats?FLAT:SHARP)[mod12(i+semi)];
  });
}
function trLine(line, semi, flats){
  if(!semi && !flats) return line;
  let out='', re=/\S+/g, m;
  while((m=re.exec(line))){
    let pos=m.index; const tok=isChordTok(m[0]) ? trChord(m[0],semi,flats) : m[0];
    if(out.length && pos < out.length+1) pos = out.length+1;
    out += ' '.repeat(Math.max(0,pos-out.length)) + tok;
  }
  return out;
}
function firstChord(body){ for(const l of (body||'').split('\n')){ if(isChordLine(l)){ const t=l.trim().split(/\s+/).find(isChordTok); if(t) return t.replace(/^[\(\[]+/,''); } } return ''; }

/* ================= songs ================= */
const BASE = (window.SONGS||[]).map(s => ({...s, id:String(s.id)}));
let custom = uget('custom', []);
let SONGS = [];
let overrides = uget('overrides', {});
const norm = s => (s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
function rebuild(){
  SONGS = BASE.concat(custom);
  SONGS.forEach(s => { s._q = norm(s.title+' '+s.artist); s._has = !!(s.body && s.body.trim()); });
  SONGS.sort((a,b)=> a.title.localeCompare(b.title,'pt',{sensitivity:'base'}) || (a.artist||'').localeCompare(b.artist||'','pt'));
}
rebuild();
const ov = s => overrides[s.id] || {};
const capoOf = s => { const o=ov(s); return o.capo!=null ? o.capo : (s.capo||0); };
const bpmOf  = s => ov(s).bpm || s.bpm || null;
const noteOf = s => { const o=ov(s); return o.note!=null ? o.note : (s.note||''); };
const ytOf   = s => ov(s).youtube || s.youtube || '';
function saveOverrides(){ uset('overrides', overrides); }
function setOv(id, patch){ const o={...(overrides[id]||{}), ...patch};
  Object.keys(o).forEach(k=>{ if(o[k]===undefined || o[k]==='' && k!=='note') delete o[k]; });
  if(Object.keys(o).length) overrides[id]=o; else delete overrides[id]; saveOverrides(); }

/* ================= prefs / state ================= */
const prefs = store.get('prefs', {});
if(prefs.snd==='wood') prefs.snd='block';
Object.entries({font:15, sig:4, sub:1, snd:'soft', accent:1, mvol:.7, pvol:.55, tone:'warm', third:0}).forEach(([k,v])=>{ if(prefs[k]==null) prefs[k]=v; });
function savePrefs(){ store.set('prefs', prefs); }
document.documentElement.style.setProperty('--fs', prefs.font+'px');
let cur=null, semi=0, bpm=120, filter='all', visible=[];

/* ================= profile UI ================= */
function renderProfileBtn(){ const b=$('#profBtn'); b.textContent=(profile.trim()[0]||'?').toUpperCase(); b.title='Usuário: '+profile; }
function renderProfiles(){
  const L=$('#profList'); L.innerHTML='';
  profiles.forEach(p=>{
    const row=document.createElement('div'); row.className='prow'+(p===profile?' on':'');
    row.innerHTML=`<button class="pick"><span class="av"></span><span class="nm"></span>${p===profile?'<span class="tag ok">em uso</span>':''}</button><button class="mini ren" title="Renomear">✎</button>${profiles.length>1?'<button class="mini del" title="Excluir">🗑</button>':''}`;
    row.querySelector('.av').textContent=(p[0]||'?').toUpperCase(); row.querySelector('.nm').textContent=p;
    row.querySelector('.pick').onclick=()=>switchProfile(p);
    row.querySelector('.ren').onclick=()=>{ const n=(prompt('Novo nome do usuário:', p)||'').trim(); if(!n||n===p) return; if(profiles.includes(n)) return toast('Já existe um usuário com esse nome');
      ['overrides','custom','padchoice','playlists'].forEach(k=>{ const v=store.get('u:'+p+':'+k,null); if(v!=null){ store.set('u:'+n+':'+k,v); store.del('u:'+p+':'+k);} });
      profiles=profiles.map(x=>x===p?n:x); store.set('profiles',profiles); if(profile===p){ profile=n; store.set('profile',n);} renderProfiles(); renderProfileBtn(); };
    const d=row.querySelector('.del'); if(d) d.onclick=()=>{ if(!confirm(`Excluir o usuário "${p}" e tudo que ele salvou neste aparelho?`)) return;
      ['overrides','custom','padchoice','playlists'].forEach(k=>store.del('u:'+p+':'+k)); profiles=profiles.filter(x=>x!==p); store.set('profiles',profiles);
      if(profile===p) switchProfile(profiles[0]); else renderProfiles(); };
    L.appendChild(row);
  });
}
function switchProfile(p){ profile=p; store.set('profile',p); overrides=uget('overrides',{}); custom=uget('custom',[]); playlists=uget('playlists',[]); plCtx=null; rebuild(); if(view==='pl') renderPlaylists();
  renderProfileBtn(); renderProfiles(); if(cur){ const id=cur.id; const s=SONGS.find(x=>x.id===id); if(s) openSong(id,false); else closeSong(); } else renderList(); toast('Usuário: '+p); }
$('#profBtn').onclick=()=>{ renderProfiles(); openPanel('#profPanel'); };
$('#profAdd').onclick=()=>{ const n=($('#profName').value||'').trim(); if(!n) return; if(profiles.includes(n)) return toast('Esse nome já existe');
  profiles.push(n); store.set('profiles',profiles); $('#profName').value=''; switchProfile(n); };
$('#profName').addEventListener('keydown',e=>{ if(e.key==='Enter') $('#profAdd').click(); });
$('#exportBtn').onclick=()=>{ const data={app:'louvor-bdn', v:2, profile, overrides, custom, playlists, padchoice:uget('padchoice',{}), exported:new Date().toISOString()};
  download(`louvor-bdn-${slug(profile)}.json`, JSON.stringify(data,null,1), 'application/json'); };
$('#importBtn').onclick=()=>$('#importFile').click();
$('#importFile').onchange=async e=>{ const f=e.target.files[0]; e.target.value=''; if(!f) return;
  try{ const d=JSON.parse(await f.text()); if(d.app!=='louvor-bdn') throw 0;
    if(!confirm(`Importar os dados de "${d.profile}" para o usuário "${profile}"? Os ajustes deste usuário serão mesclados.`)) return;
    overrides={...overrides, ...(d.overrides||{})}; const ids=new Set(custom.map(c=>c.id)); (d.custom||[]).forEach(c=>{ if(!ids.has(c.id)) custom.push(c); });
    const pids=new Set(playlists.map(p=>p.id)); (d.playlists||[]).forEach(p=>{ if(!pids.has(p.id)) playlists.push(p); }); savePlaylists();
    uset('overrides',overrides); uset('custom',custom); uset('padchoice',{...uget('padchoice',{}), ...(d.padchoice||{})}); rebuild(); renderList(); toast('Dados importados ✔');
  }catch(err){ toast('Arquivo inválido'); } };

/* ================= library ================= */
function renderList(){
  const q = norm($('#q').value.trim());
  $('#qClear').style.display = q ? 'block':'none';
  const words = q.split(/\s+/).filter(Boolean);
  visible = SONGS.filter(s => (filter==='all' || (filter==='cifra'? s._has : filter==='minhas' ? (s.custom || overrides[s.id]) : !s._has)) && words.every(w => s._q.includes(w)));
  $('#count').textContent = visible.length + (visible.length===1?' música':' músicas') + (profiles.length>1?` · usuário ${profile}`:'');
  const L = $('#list'); L.innerHTML='';
  if(!visible.length){ L.innerHTML = '<div class="empty">Nenhuma música encontrada.<br>Tente outro nome ou artista — ou crie uma nova no botão “Nova música”.</div>'; return; }
  const frag=document.createDocumentFragment();
  for(const s of visible){
    const o = ov(s), pk = parseKey(s.key);
    const k = pk ? keyName(pk.r+(o.semi||0), pk.minor) : '–';
    const b = bpmOf(s);
    const el=document.createElement('button'); el.className='item';
    el.innerHTML = `<div class="k">${k}</div><div class="t"><b></b><span></span></div><div class="m">${b?`<span class="bpm">${b}</span> bpm`:'<span>sem bpm</span>'}<br>${s.custom?'<span class="tag mine">minha</span>':(s._has?'<span class="tag ok">cifra</span>':'<span class="tag">ficha</span>')}${overrides[s.id]?' <span class="tag mine" title="Você personalizou">✎</span>':''}</div>`;
    el.querySelector('b').textContent = s.title;
    el.querySelector('.t span').textContent = s.artist || '—';
    el.onclick = () => openSong(s.id);
    frag.appendChild(el);
  }
  L.appendChild(frag);
}
$('#q').addEventListener('input', renderList);
$('#qClear').onclick = () => { $('#q').value=''; renderList(); $('#q').focus(); };
$('#chips').onclick = e => { const b=e.target.closest('.chip'); if(!b) return; filter=b.dataset.f; $$('.chip').forEach(c=>c.setAttribute('aria-pressed', c===b)); renderList(); };

/* ================= song view ================= */
let plCtx=null; // {pl, idx} when a song is opened from a playlist
function openSong(id, push=true, ctxPl){
  id=String(id); const s = SONGS.find(x=>x.id===id); if(!s) return;
  if(ctxPl!==undefined) plCtx=ctxPl; else if(plCtx && !(plCtx.pl.items[plCtx.idx] && plCtx.pl.items[plCtx.idx].id===id)) plCtx=null;
  cur = s; const o = ov(s);
  const it = plCtx ? plCtx.pl.items[plCtx.idx] : null;
  semi = it && it.semi!=null ? it.semi : (o.semi||0); bpm = bpmOf(s) || 120;
  renderPlBar();
  document.body.classList.add('song-open');
  if(push) history.pushState({id}, '', '#m'+id);
  $('#tTitle').textContent = s.title; $('#tArtist').textContent = s.artist;
  $('#sTitle').textContent = s.title; $('#sArtist').textContent = s.artist;
  document.title = s.title + ' · Louvor BDN';
  buildKeySelect(); renderSong(); updateBpm(false); updatePadLabel();
  window.scrollTo(0,0);
  if(pad.on) pad.retune(true);
}
function closeSong(push=true){
  document.body.classList.remove('song-open'); cur=null; document.title='Louvor BDN';
  if(push) history.pushState({}, '', location.pathname+location.search);
  metro.stop(); pad.stop(); renderList();
}
$('#backBtn').onclick = () => { if(history.state && history.state.id) history.back(); else closeSong(); };
window.addEventListener('popstate', e => { const id = e.state && e.state.id; if(id) openSong(id,false); else if(cur) closeSong(false); });

function curKey(){ const pk=parseKey(cur.key); return pk ? {r:pk.r+semi, minor:pk.minor} : null; }
/* chords are written for shapes (key − song capo); user capo changes the shapes shown */
function displayShift(){ return semi + (cur.capo||0) - capoOf(cur); }
function shapesKey(){ const k=curKey(); return k ? {r:k.r-capoOf(cur), minor:k.minor} : null; }
function writtenFlats(){ const k=shapesKey(); return k ? useFlats(k.r,k.minor) : false; }
function buildKeySelect(){
  const sel=$('#keySel'); sel.innerHTML='';
  const pk=parseKey(cur.key), has=!!pk;
  ['#keyDown','#keyUp','#keySel'].forEach(q=>$(q).disabled=!has);
  if(!has){ sel.innerHTML='<option>–</option>'; return; }
  for(let i=-5;i<=6;i++){ const op=document.createElement('option'); op.value=i; op.textContent = keyName(pk.r+i, pk.minor) + (i===0?' ★':''); sel.appendChild(op); }
  sel.value = String(semi);
}
const normSemi = v => { v = mod12(v+5)-5; return v; };
$('#keySel').onchange = e => setSemi(parseInt(e.target.value,10));
$('#keyDown').onclick = () => setSemi(semi-1);
$('#keyUp').onclick = () => setSemi(semi+1);
function setSemi(v){ semi=normSemi(v); if(plCtx){ plCtx.pl.items[plCtx.idx].semi=semi; savePlaylists(); } else setOv(cur.id,{semi: semi||undefined}); buildKeySelect(); renderSong(); updatePadLabel(); if(pad.on) pad.retune(); }
$('#resetBtn').onclick = () => { if(!overrides[cur.id]) return toast('Já está no original');
  if(!confirm('Voltar tom, capo, BPM, pad e observação para o original da setlist?')) return;
  delete overrides[cur.id]; saveOverrides(); const pc=uget('padchoice',{}); delete pc[cur.id]; uset('padchoice',pc); openSong(cur.id,false); toast('Original restaurado'); };
$('#fontDown').onclick = () => prefs.layout==='fit' ? fitAdj(-1) : setFont(prefs.font-1);
$('#fontUp').onclick = () => prefs.layout==='fit' ? fitAdj(1) : setFont(prefs.font+1);
function fitAdj(d){ prefs.fitAdj=Math.max(-12,Math.min(30,prefs.fitAdj+d)); savePrefs(); applySongLayout(); if(prefs.fitAdj>0) toast('Letra maior que o encaixe — pode ficar uma parte fora da tela ('+(prefs.fitAdj>0?'+':'')+prefs.fitAdj+')'); }
$('#layoutSeg').onclick=e=>{ const b=e.target.closest('button'); if(b) setLayout(b.dataset.v); };
function setFont(v){ prefs.font=Math.max(10,Math.min(32,v)); savePrefs(); document.documentElement.style.setProperty('--fs', prefs.font+'px'); }

const YT_ICO='<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .6 12a31 31 0 0 0 .4 4.8 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .4-4.8 31 31 0 0 0-.4-4.8zM9.7 15.1V8.9l5.4 3.1-5.4 3.1z"/></svg>';
function ytUrl(s){
  const y=ytOf(s);
  if(y) return /^https?:/.test(y) ? y : 'https://www.youtube.com/watch?v='+y;
  const t=s.title.replace(/\((simplificada)\)/i,'').replace(/\s+/g,' ').trim();
  return 'https://www.youtube.com/results?search_query='+encodeURIComponent(t+' '+(s.artist||'')).replace(/%20/g,'+');
}
function esc(s){ return String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function chordHTML(line){ return esc(line).replace(/\S+/g, t => isChordTok(t.replace(/&amp;/g,'&')) ? `<span class="ch">${t}</span>` : t); }
function renderCifra(body, shift, flats){
  const items=[];
  for(const raw of body.split('\n')){
    const line=raw.replace(/\s+$/,'');
    if(!line.trim()){ items.push({t:'gap', h:'<div class="gap"></div>'}); continue; }
    if(line.startsWith('!')){ items.push({t:'nt', h:`<div class="ln"><span class="nt">${esc(line.slice(1).trim())}</span></div>`}); continue; }
    const sm=/^\s*\[([^\]]+)\]\s*(.*)$/.exec(line);
    if(sm){ const rest=sm[2]||''; let r='';
      if(rest && isChordLine(rest)) r=`<span class="rest">${chordHTML(trLine(rest,shift,flats))}</span>`; else if(rest) r=`<span class="rep">${esc(rest)}</span>`;
      items.push({t:'sec', h:`<div class="sec">${esc(sm[1])}${r}</div>`}); continue; }
    if(isChordLine(line)){ items.push({t:'ch', h:`<div class="ln">${chordHTML(trLine(line,shift,flats))}</div>`}); continue; }
    items.push({t:'ly', h:`<div class="ln ly">${esc(line)}</div>`});
  }
  // keep a chord line glued to its lyric line (and a section title to what follows) so columns never split them
  const out=[];
  for(let i=0;i<items.length;i++){
    const it=items[i];
    if(it.t==='ch' && items[i+1] && items[i+1].t==='ly'){ out.push('<div class="pair">'+it.h+items[i+1].h+'</div>'); i++; continue; }
    out.push(it.h);
  }
  return out.join('');
}

/* ---------- encaixe: rolar vs. caber na tela ---------- */
if(!prefs.layout) prefs.layout='scroll';
if(prefs.fitAdj==null) prefs.fitAdj=0;
if(prefs.stageLayout==null) prefs.stageLayout='fit';
// Finds the largest font (and number of columns) that shows the whole song inside box w×h.
function fitInto(el, w, h, adj){
  el.classList.add('fit'); el.style.height=h+'px'; el.style.width=w+'px';
  // widest chord/lyric line, in characters (monospace)
  const maxChars=Math.max(8,...[...el.querySelectorAll('.ln')].map(l=>l.textContent.replace(/\s+$/,'').length));
  const probe=document.createElement('span'); probe.textContent='0'.repeat(20); probe.style.cssText='position:absolute;visibility:hidden;white-space:pre;font-family:var(--mono)'; el.appendChild(probe);
  const charW=f=>{ el.style.fontSize=f+'px'; return probe.getBoundingClientRect().width/20; };
  const tryF=(f,n)=>{ const cw=charW(f); el.style.columnCount=n; const gap=1.6*f, colW=(el.clientWidth-gap*(n-1))/n;
    if(maxChars*cw > colW) return false; return el.scrollWidth<=el.clientWidth+1; };
  let best=null;
  for(let n=1;n<=6;n++){
    let lo=7, hi=56; if(!tryF(lo,n)) continue;
    while(hi-lo>0.5){ const mid=(lo+hi)/2; if(tryF(mid,n)) lo=mid; else hi=mid; }
    if(!best || lo>best.f+0.4) best={f:lo,n};
  }
  let ok=true;
  if(!best){ ok=false; const cw=charW(9); best={f:9, n:Math.max(1,Math.floor((el.clientWidth+14)/(maxChars*cw+14)))}; }
  probe.remove();
  const f=Math.max(7, Math.floor((best.f+adj)*2)/2);
  el.style.fontSize=f+'px'; el.style.columnCount=best.n;
  el.classList.toggle('overflow', !ok || adj>0);
  el.dataset.fit=`${best.n} coluna${best.n>1?'s':''} · ${f}px`+(ok?'':' (música longa: arraste para o lado)');
  return best;
}
function unfit(el){ el.classList.remove('fit'); el.style.height=''; el.style.width=''; el.style.fontSize=''; el.style.columnCount=''; }
function applySongLayout(){
  const el=$('#cifra'), sheet=el.parentElement; if(!cur) return;
  document.body.classList.toggle('fitmode', prefs.layout==='fit');
  $$('#layoutSeg button').forEach(b=>b.setAttribute('aria-pressed', b.dataset.v===prefs.layout));
  if(prefs.layout!=='fit' || !cur._has){ unfit(el); sheet.style.height=''; $('#fitInfo').textContent=''; return; }
  const top=$('.top').getBoundingClientRect().height, dock=$('#dock').getBoundingClientRect().height||0;
  const H=Math.max(220, window.innerHeight-top-dock-18);
  sheet.style.height=H+'px';
  const cs=getComputedStyle(sheet), padX=parseFloat(cs.paddingLeft)+parseFloat(cs.paddingRight), padY=parseFloat(cs.paddingTop)+parseFloat(cs.paddingBottom);
  const r=fitInto(el, sheet.clientWidth-padX, H-padY-2, prefs.fitAdj);
  $('#fitInfo').textContent='Encaixado: '+el.dataset.fit;
}
function scrollToSheet(){ const sh=$('.sheet'); const top=$('.top').getBoundingClientRect().height; window.scrollTo({top: sh.getBoundingClientRect().top+window.scrollY-top-8, behavior:'smooth'}); }
function setLayout(v){ prefs.layout=v; savePrefs(); applySongLayout(); if(v==='fit') scrollToSheet(); }
let fitT=0; window.addEventListener('resize',()=>{ clearTimeout(fitT); fitT=setTimeout(()=>{ if(cur) applySongLayout(); if($('#stage').classList.contains('open')) applyStageLayout(); },150); });
function renderSong(){
  const s=cur, k=curKey(), capo=capoOf(s), o=ov(s);
  const facts=[['Tom', k? keyName(k.r,k.minor) : '—']];
  if(semi) facts.push(['Original', keyName(parseKey(s.key).r, parseKey(s.key).minor)]);
  facts.push(['BPM', bpm + (bpmOf(s)? '' : '*')]);
  facts.push(['Pad', padNote()||'—']);
  if(capo) facts.push(['Capo', capo+'ª casa']);
  $('#facts').innerHTML = facts.map(([a,b])=>`<div class="fact"><span>${a}</span><b>${esc(b)}</b></div>`).join('') + (overrides[s.id]?'<div class="fact mine">✎ personalizado por '+esc(profile)+'</div>':'');
  const note=noteOf(s);
  $('#sNote').innerHTML = note ? `<div class="notebox">${esc(note)}</div>` : '';
  const ci=$('#capoInfo');
  if(capo && k){ const wk=shapesKey(); ci.innerHTML=`Formas de <b>${keyName(wk.r,wk.minor)}</b> com capotraste na <b>${capo}ª casa</b> (soa em ${keyName(k.r,k.minor)}).`; } else ci.innerHTML='';
  const box=$('#cifra');
  if(!s._has){
    box.innerHTML = `<div class="nocifra"><div class="big">Cifra ainda não cadastrada</div>Tom, BPM e pad já estão prontos aqui embaixo.<br>Abra no Cifra Club ou ${s.custom?'edite a música':'crie sua versão'} em “Editar”.</div>`;
  } else box.innerHTML = renderCifra(s.body, displayShift(), writtenFlats());
  requestAnimationFrame(applySongLayout);
  const q=encodeURIComponent((s.title.replace(/\(.*?\)/g,'')+' '+(s.artist||'')).trim());
  const yt = ytUrl(s); $('#ytTop').href = yt;
  $('#links').innerHTML = `<a class="btn yt" href="${yt}" target="_blank" rel="noopener">${YT_ICO} Ver no YouTube</a>
    <a class="btn" href="https://www.cifraclub.com.br/?q=${q}" target="_blank" rel="noopener">Abrir no Cifra Club ↗</a>
    <a class="btn" href="https://www.google.com/search?q=${q}+site%3Asongbpm.com" target="_blank" rel="noopener">Conferir BPM no SongBPM ↗</a>
    ${s.custom?'<button class="btn" id="dlTxt">Baixar .txt (para enviar ao repositório)</button>':''}`;
  const dl=$('#dlTxt'); if(dl) dl.onclick=()=>download(slug(s.title+(s.artist?'--'+s.artist:''))+'.txt', songToTxt(s), 'text/plain');
  const pg=$('#pager'); pg.innerHTML='';
  let p,n,go;
  if(plCtx){ const L=plCtx.pl.items, i=plCtx.idx; const g=j=>SONGS.find(x=>x.id===L[j].id);
    p=i>0?g(i-1):null; n=i<L.length-1?g(i+1):null; go=(x,dir)=>openSong(x.id,true,{pl:plCtx.pl, idx:plCtx.idx+dir}); }
  else { const list = visible.length && visible.some(x=>x.id===s.id) ? visible : SONGS; const i=list.findIndex(x=>x.id===s.id); p=list[i-1]; n=list[i+1]; go=x=>openSong(x.id); }
  [[p,'← Anterior',-1],[n,'Próxima →',1]].forEach(([x,l,dir])=>{ if(!x){ pg.appendChild(document.createElement('span')); return; }
    const b=document.createElement('button'); b.innerHTML=`<small>${l}${plCtx?' na playlist':''}</small><b></b>`; b.querySelector('b').textContent=x.title; b.onclick=()=>go(x,dir); pg.appendChild(b); });
  renderSuggest();
}

/* ================= edit panel (per user) ================= */
function keyOptions(minorFirst){
  const opts=[]; for(let i=0;i<12;i++){ opts.push([SHARP[i], keyName(i,false)]); } for(let i=0;i<12;i++){ opts.push([SHARP[i]+'m', keyName(i,true)]); }
  return opts;
}
function fillSelect(sel, opts, val, blank){ sel.innerHTML=(blank?`<option value="">${blank}</option>`:'')+opts.map(([v,l])=>`<option value="${v}">${l}</option>`).join(''); sel.value=val||''; }
$('#editBtn').onclick=()=> cur.medley ? openMedley(cur) : openEditor(cur);
function openEditor(s){
  // s = song to edit, or null for a brand-new song
  const isNew=!s, isCustom = isNew || s.custom;
  const k = s ? (parseKey(s.key) ? curKeyFor(s) : null) : null;
  $('#edTitle').textContent = isNew ? 'Nova música' : (isCustom ? 'Editar minha música' : 'Minha versão desta música');
  $('#edHint').textContent = isNew ? 'Importe de um PDF, de um print da tela ou cole a cifra do Cifra Club. Fica salvo no usuário '+profile+'.'
    : isCustom ? 'Música criada por você ('+profile+').' : 'As mudanças ficam salvas só para o usuário '+profile+'. A cifra original não muda para os outros.';
  $('#edBasic').style.display = isCustom ? '' : 'none';
  $('#edImport').style.display = isNew ? '' : 'none';
  $('#edBodyWrap').style.display = isCustom ? '' : 'none';
  $('#edDelete').style.display = (!isNew && isCustom) ? '' : 'none';
  $('#edT').value = s ? s.title : ''; $('#edA').value = s ? (s.artist||'') : '';
  $('#edBody').value = s ? (s.body||'') : '';
  const minor = k ? k.minor : false;
  fillSelect($('#edKey'), keyOptions(), k ? (SHARP[mod12(k.r)]+(k.minor?'m':'')) : '', isCustom?'Detectar pela cifra':null);
  $('#edKey').disabled = !isCustom && !k;
  $('#edCapo').innerHTML = Array.from({length:12},(_,i)=>`<option value="${i}">${i===0?'Sem capotraste':i+'ª casa'}</option>`).join('');
  $('#edCapo').value = s ? capoOf(s) : 0;
  $('#edBpm').value = s ? (s===cur ? bpm : (bpmOf(s)||'')) : '';
  const pr = s ? padRootFor(s) : null;
  const o0=s?ov(s):{}; fillSelect($('#edPad'), keyOptions(), (s && (o0.pad || s.custom) && pr) ? SHARP[mod12(pr.r)]+(pr.minor?'m':'') : '', s&&!s.custom ? 'Automático (segue o tom — '+(pr?keyName(pr.r,pr.minor):'—')+')' : 'Igual ao tom');
  $('#edNote').value = s ? noteOf(s) : '';
  $('#edYt').value = s ? ytOf(s) : '';
  $('#edStatus').textContent=''; previewEditor();
  editing = s; openPanel('#editPanel');
  if(isNew) setTimeout(()=>$('#edT').focus(),50);
}
let editing=null;
function curKeyFor(s){ const pk=parseKey(s.key); const o=ov(s); return pk?{r:pk.r+(s===cur?semi:(o.semi||0)), minor:pk.minor}:null; }
function padRootFor(s){ const o=ov(s), sm = s===cur?semi:(o.semi||0);
  if(o.pad){ const p=parseKey(o.pad); return p?{r:p.r+sm,minor:p.minor}:null; }
  const list=[s.pad,...(s.padAlt||[])].filter(Boolean); const ch=(uget('padchoice',{})[s.id])||0; const b=parseKey(list[ch]||list[0]||s.key); return b?{r:b.r+sm,minor:b.minor}:null; }
$('#edSave').onclick=()=>{
  const s=editing, isNew=!s, isCustom=isNew||s.custom;
  const bpmV=parseInt($('#edBpm').value,10); const capoV=parseInt($('#edCapo').value,10)||0;
  const keyV=$('#edKey').value, padV=$('#edPad').value, note=$('#edNote').value.trim(), yt=$('#edYt').value.trim();
  if(isCustom){
    const title=$('#edT').value.trim(); if(!title){ $('#edT').focus(); return toast('Coloque o nome da música'); }
    let body=$('#edBody').value.replace(/\r/g,'').replace(/\t/g,'    ').replace(/\s+$/,'');
    const key = keyV || (firstChord(body).match(/^[A-G][#b]?m?(?!aj)/)||[''])[0];
    const song = { id: s? s.id : 'u'+Date.now().toString(36), custom:true, title, artist:$('#edA').value.trim(),
      key, pad: padV, padAlt:[], bpm: bpmV||null, capo: capoV, note, youtube: yt, body };
    if(isNew) custom.push(song); else custom = custom.map(c=>c.id===song.id?song:c);
    delete overrides[song.id]; saveOverrides();
    if(!uset('custom', custom)) return toast('Sem espaço no aparelho para salvar');
    rebuild(); closePanels(); openSong(song.id, isNew); toast(isNew?'Música criada ✔':'Música salva ✔');
  } else {
    const pk=parseKey(s.key); const patch={};
    if(pk && keyV){ const nk=parseKey(keyV); patch.semi = normSemi(nk.r - pk.r) || undefined; } else patch.semi=undefined;
    const sm = patch.semi||0;
    patch.capo = capoV!==(s.capo||0) ? capoV : undefined;
    patch.bpm = bpmV && bpmV!==s.bpm ? bpmV : undefined;
    if(padV){ const p=parseKey(padV); const base=parseKey(s.pad||s.key); const orig=keyName(p.r-sm,p.minor); patch.pad = (base && mod12(p.r-sm)===mod12(base.r) && p.minor===base.minor) ? undefined : orig; } else patch.pad=undefined;
    patch.note = note!==(s.note||'') ? note : undefined;
    patch.youtube = yt && yt!==(s.youtube||'') ? yt : undefined;
    overrides[s.id]={}; setOv(s.id, patch);
    closePanels(); openSong(s.id,false); toast('Salvo para '+profile+' ✔');
  }
};
$('#edDelete').onclick=()=>{ const s=editing; if(!s||!s.custom) return; if(!confirm(`Excluir "${s.title}"?`)) return;
  custom=custom.filter(c=>c.id!==s.id); uset('custom',custom); rebuild(); closePanels(); closeSong(); toast('Música excluída'); };
['#edBody','#edKey','#edCapo'].forEach(q=>$(q).addEventListener('input', previewEditor));
function previewEditor(){ const b=$('#edBody').value; const pv=$('#edPreview');
  if(!b.trim()){ pv.innerHTML='<div class="src">A pré-visualização aparece aqui.</div>'; return; }
  pv.innerHTML=renderCifra(b.replace(/\t/g,'    '),0,false);
  if(!$('#edKey').value){ const fc=firstChord(b); $('#edKeyHint').textContent = fc ? 'Tom detectado: '+(fc.match(/^[A-G][#b]?m?(?!aj)/)||[''])[0] : ''; } else $('#edKeyHint').textContent='';
}
$('#newBtn').onclick=()=>openEditor(null);

/* ================= importers ================= */
const status = t => { $('#edStatus').textContent=t; };
function loadScript(src){ return new Promise((ok,err)=>{ if(document.querySelector(`script[src="${src}"]`)) return ok(); const s=document.createElement('script'); s.src=src; s.onload=ok; s.onerror=()=>err(new Error('Falha ao carregar '+src)); document.head.appendChild(s); }); }
const PDFJS='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_W='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const TESS='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';

/* Turns positioned words into monospace chord-over-lyric text.
   lines: [[{text,x0,x1}], ...] in reading order */
function alignLines(lines){
  const ws=[]; lines.forEach(l=>l.forEach(w=>{ if(w.text.length>=3 && !isChordTok(w.text)) ws.push((w.x1-w.x0)/w.text.length); }));
  ws.sort((a,b)=>a-b); const cw = ws.length ? ws[Math.floor(ws.length/2)] : 8;
  const minX = Math.min(...lines.flat().map(w=>w.x0));
  const isCL = l => l.length && isChordLine(l.map(w=>w.text).join(' '));
  const out=[];
  for(let i=0;i<lines.length;i++){
    const L=lines[i];
    if(isCL(L) && i+1<lines.length && !isCL(lines[i+1])){
      const ly=lines[i+1]; let s=' '.repeat(Math.max(0,Math.round((ly[0].x0-minX)/cw))); const spans=[];
      ly.forEach((w,j)=>{ if(j) s+=' '; spans.push([s.length,w]); s+=w.text; });
      const col = x => { for(const [st,w] of spans){ if(x>=w.x0-cw*0.5 && x<=w.x1){ return st+Math.round((x-w.x0)/Math.max(1,w.x1-w.x0)*w.text.length); } }
        let last=null; for(const [st,w] of spans){ if(w.x0>x) return Math.max(0,st-1); last=[st,w]; }
        if(!last) return Math.max(0,Math.round((x-minX)/cw)); return last[0]+last[1].text.length+Math.round((x-last[1].x1)/cw); };
      let c=''; L.forEach(w=>{ let p=Math.max(0,col(w.x0)); if(c.length && p<=c.length) p=c.length+1; c+=' '.repeat(p-c.length)+w.text; });
      out.push(c, s); i++; continue;
    }
    let s=' '.repeat(isCL(L)?Math.max(0,Math.round((L[0].x0-minX)/cw)):0);
    L.forEach((w,j)=>{ if(j){ const gap=Math.round((w.x0-L[j-1].x1)/cw); s+=' '.repeat(isCL(L)?Math.max(1,gap):1); } s+=w.text; });
    out.push(s);
  }
  return out;
}
const fixTok=t=>t.replace(/^([A-G])(?:[iHtk\$4f]+|ff)m/,'$1#m').replace(/^([A-G])[H\$t](?=$|[0-9\/])/,'$1#').replace(/\/([A-G])[Hti\$]+$/,'/$1#').replace(/^À$/,'A');
function fixOcrChords(text){
  return text.split('\n').map(l=>{
    const _unused=t=>t.replace(/^([A-G])(?:[iHtk\$4f]+|ff)m/,'$1#m').replace(/^([A-G])[H\$t](?=$|[0-9\/])/,'$1#').replace(/\/([A-G])[Hti\$]+$/,'/$1#').replace(/^À$/,'A');
    const toks=l.trim().split(/\s+/); if(!toks[0]) return l;
    const fixed=toks.map(fixTok); const good=fixed.filter(t=>isChordTok(t)||isMarkTok(t)).length;
    if(good>=Math.max(1,Math.round(fixed.length*.7)) && fixed.some(isChordTok)) return l.replace(/\S+/g,fixTok);
    return l.replace(/\{/g,'[').replace(/\}/g,']');
  }).join('\n');
}
function cleanImported(text){
  // pull "Tom:", "BPM", "Capo" info out of pasted/extracted text
  const lines=text.replace(/\r/g,'').replace(/\t/g,'    ').replace(/ /g,' ').split('\n'); const keep=[];
  for(const l of lines){
    let m;
    if((m=/^\s*tom\s*[:\-]\s*([A-G][#b]?m?)/i.exec(l))){ if(!$('#edKey').value) $('#edKey').value = SHARP[IDX[m[1].replace(/m$/,'')]] + (/m$/.test(m[1])?'m':'');
      const c=/capo[^0-9]*(\d+)/i.exec(l); if(c) $('#edCapo').value=c[1]; continue; }
    if((m=/^\s*bpm\s*[:\-]?\s*(\d{2,3})/i.exec(l))){ if(!$('#edBpm').value) $('#edBpm').value=m[1]; continue; }
    if((m=/^\s*capo(?:traste)?\s*(?:na|:)?\s*(\d+)/i.exec(l))){ $('#edCapo').value=m[1]; continue; }
    if(/^\s*pad\s*:/i.test(l)){ const p=/:\s*([A-G][#b]?m?)/.exec(l); if(p){ const pk=parseKey(p[1]); if(pk) $('#edPad').value=SHARP[pk.r]+(pk.minor?'m':''); } continue; }
    if(/^\s*(afinação|afinacao)\s*:/i.test(l)) continue;
    keep.push(l.replace(/\s+$/,''));
  }
  return keep.join('\n').replace(/\n{3,}/g,'\n\n').trim();
}
function setBody(t, append){ const b=$('#edBody'); b.value = append && b.value.trim() ? b.value.replace(/\s+$/,'')+'\n\n'+t : t; previewEditor(); }

/* --- Cifra Club / text --- */
$('#edLinkGo').onclick=()=>{
  const v=$('#edLink').value.trim(); if(!v) return;
  const m=/cifraclub\.com\.br\/([^\/?#]+)\/([^\/?#]+)/i.exec(v);
  if(m){ const unslug=x=>decodeURIComponent(x).replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
    if(!$('#edT').value) $('#edT').value=unslug(m[2]); if(!$('#edA').value) $('#edA').value=unslug(m[1]);
    window.open(v.replace(/#.*$/,''),'_blank','noopener');
    status('Abri a cifra numa nova aba. Lá, selecione a cifra (do primeiro acorde até o fim), copie e cole no campo “Cifra” abaixo — ou use o botão Colar.');
  } else { status('Cole um link do Cifra Club (ex.: https://www.cifraclub.com.br/artista/musica/)'); }
};
$('#edPaste').onclick=async()=>{ try{ const t=await navigator.clipboard.readText(); if(!t.trim()) return status('A área de transferência está vazia.'); setBody(cleanImported(t)); status('Cifra colada ✔ Confira a pré-visualização.'); }catch(e){ status('Não consegui ler a área de transferência — cole manualmente no campo Cifra (Ctrl+V / segurar e Colar).'); } };
$('#edBody').addEventListener('paste', e=>{ const t=(e.clipboardData||window.clipboardData).getData('text'); if(t && t.length>40 && !$('#edBody').value.trim()){ e.preventDefault(); setBody(cleanImported(t)); status('Cifra colada ✔'); } });

/* --- image (print) via OCR --- */
$('#edImg').onclick=()=>$('#imgFile').click();
$('#imgFile').onchange=async e=>{ const files=[...e.target.files]; e.target.value=''; if(!files.length) return;
  try{ for(let i=0;i<files.length;i++){ status(`Lendo imagem ${i+1}/${files.length}…`); const t=await ocrImage(await fileToCanvas(files[i])); setBody(cleanImported(t), i>0 || !!$('#edBody').value.trim()); }
    status('Pronto ✔ Leitura automática por imagem pode errar alguns acordes — confira antes de salvar.'); }
  catch(err){ status('Não consegui ler a imagem: '+err.message); } };
function fileToCanvas(file){ return new Promise((ok,err)=>{ const img=new Image(); img.onload=()=>{ const c=document.createElement('canvas'); let sc = img.width<1400 ? 2 : 1; c.width=img.width*sc; c.height=img.height*sc; const g=c.getContext('2d'); g.imageSmoothingQuality='high'; g.drawImage(img,0,0,c.width,c.height); URL.revokeObjectURL(img.src); ok(c); }; img.onerror=()=>err(new Error('formato de imagem não suportado')); img.src=URL.createObjectURL(file); }); }
function prepCanvas(c){ // grayscale; invert dark backgrounds; boost contrast of colored chords
  const g=c.getContext('2d'); const d=g.getImageData(0,0,c.width,c.height), p=d.data; let sum=0;
  for(let i=0;i<p.length;i+=4){ sum+=(p[i]+p[i+1]+p[i+2])/3; }
  const dark = sum/(p.length/4) < 110;
  for(let i=0;i<p.length;i+=4){ let v = dark ? 255-Math.max(p[i],p[i+1],p[i+2]) : Math.min(p[i],p[i+1],p[i+2]); v = v<175?0:255; p[i]=p[i+1]=p[i+2]=v; }
  g.putImageData(d,0,0); return c; }
let worker=null;
async function ocrImage(canvas){
  await loadScript(TESS);
  if(!worker){ status('Carregando leitor de texto (só na primeira vez, ~10 MB)…'); worker = await Tesseract.createWorker('por', 1, { logger: m=>{ if(m.status==='recognizing text') status('Lendo texto… '+Math.round(m.progress*100)+'%'); } });
    await worker.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' }); }
  const { data } = await worker.recognize(prepCanvas(canvas));
  const lines=[]; (data.lines||[]).forEach(l=>{ const ws=(l.words||[]).filter(w=>w.text.trim()).map(w=>({text:w.text, x0:w.bbox.x0, x1:w.bbox.x1})); if(!ws.length) return;
    const fx=ws.map(w=>fixTok(w.text)); if(isChordLine(fx.join(' '))) ws.forEach((w,i)=>w.text=fx[i]); lines.push(ws); });
  return fixOcrChords(alignLines(lines).join('\n'));
}

/* --- PDF --- */
$('#edPdf').onclick=()=>$('#pdfFile').click();
$('#pdfFile').onchange=async e=>{ const f=e.target.files[0]; e.target.value=''; if(!f) return;
  try{ status('Abrindo PDF…'); await loadScript(PDFJS); pdfjsLib.GlobalWorkerOptions.workerSrc=PDFJS_W;
    const doc=await pdfjsLib.getDocument({data:await f.arrayBuffer()}).promise; const parts=[];
    for(let n=1;n<=doc.numPages;n++){ status(`Lendo página ${n}/${doc.numPages}…`); const page=await doc.getPage(n);
      const tc=await page.getTextContent(); const items=tc.items.filter(it=>it.str && it.str.trim());
      if(items.length>8){ parts.push(pdfTextToLines(items)); }
      else { const vp=page.getViewport({scale:2.2}); const c=document.createElement('canvas'); c.width=vp.width; c.height=vp.height; await page.render({canvasContext:c.getContext('2d'), viewport:vp}).promise; parts.push(await ocrImage(c)); } }
    const t=cleanImported(parts.join('\n\n'));
    const firstLines=t.split('\n').filter(x=>x.trim());
    const tl=firstLines.find(x=>!isChordLine(x) && !/^\s*[\[!(]/.test(x)); if(!$('#edT').value && tl && firstLines.indexOf(tl)<3 && tl.trim().length<60) $('#edT').value=tl.trim();
    setBody(t); status('PDF importado ✔ Confira a pré-visualização e ajuste o que precisar.');
  }catch(err){ status('Não consegui ler o PDF: '+err.message); } };
function pdfTextToLines(items){
  // group by baseline, split into words with proportional x positions
  const rows=[]; items.forEach(it=>{ const x=it.transform[4], y=it.transform[5], h=Math.abs(it.transform[3])||10;
    let r=rows.find(r=>Math.abs(r.y-y)<h*0.45); if(!r){ r={y,h,ws:[]}; rows.push(r); }
    const str=it.str, w=it.width||str.length*h*0.5; const re=/\S+/g; let m; while((m=re.exec(str))){ r.ws.push({text:m[0], x0:x+w*m.index/str.length, x1:x+w*(m.index+m[0].length)/str.length}); } });
  rows.sort((a,b)=>b.y-a.y); rows.forEach(r=>r.ws.sort((a,b)=>a.x0-b.x0));
  const out=[]; let prev=null;
  // keep blank lines where vertical gaps are large
  const lines=[]; rows.forEach(r=>{ if(prev && prev.y-r.y > r.h*2.4) lines.push(null); lines.push(r.ws); prev=r; });
  const chunks=[]; let curc=[]; lines.forEach(l=>{ if(l===null){ if(curc.length) chunks.push(curc); curc=[]; } else curc.push(l); }); if(curc.length) chunks.push(curc);
  return chunks.map(c=>alignLines(c).join('\n')).join('\n\n');
}


/* ================= playlists (escala do dia) ================= */
let playlists = uget('playlists', []);
function savePlaylists(){ uset('playlists', playlists); }
let view='songs';
function setView(v){ view=v; $$('#viewTabs button').forEach(b=>b.setAttribute('aria-pressed', b.dataset.v===v)); $('#songsView').style.display=v==='songs'?'':'none'; $('#plView').style.display=v==='pl'?'':'none'; if(v==='pl') renderPlaylists(); store.set('view',v); }
$('#viewTabs').onclick=e=>{ const b=e.target.closest('button'); if(b) setView(b.dataset.v); };
const fmtDate = d => { if(!d) return ''; const [y,m,dd]=d.split('-'); const dt=new Date(+y,+m-1,+dd); return dt.toLocaleDateString('pt-BR',{weekday:'short', day:'2-digit', month:'2-digit'}); };
const today = () => { const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };
function songKeyLabel(s, sm){ const pk=parseKey(s.key); return pk?keyName(pk.r+(sm||0),pk.minor):'–'; }
function renderPlaylists(){
  const L=$('#plList'); L.innerHTML='';
  const sorted=[...playlists].sort((a,b)=>(b.date||'').localeCompare(a.date||'') || b.created-a.created);
  if(!sorted.length){ L.innerHTML='<div class="empty">Nenhuma playlist ainda.<br>Crie a escala do louvor do dia e adicione as músicas na ordem do culto.</div>'; return; }
  sorted.forEach(pl=>{ const el=document.createElement('button'); el.className='item pl';
    const names=pl.items.map(it=>{ const s=SONGS.find(x=>x.id===it.id); return s?s.title:'?'; });
    el.innerHTML=`<div class="k cal"><b>${pl.date?pl.date.slice(8,10):'—'}</b><small>${pl.date?new Date(pl.date+'T12:00').toLocaleDateString('pt-BR',{month:'short'}).replace('.',''):''}</small></div><div class="t"><b></b><span></span></div><div class="m"><span class="bpm">${pl.items.length}</span> músicas<br><span>${pl.date?fmtDate(pl.date).split(',')[0]:''}</span></div>`;
    el.querySelector('b:not(.k b)'); el.querySelector('.t b').textContent=pl.name; el.querySelector('.t span').textContent=names.join(' · ')||'vazia';
    el.onclick=()=>openPlEditor(pl); L.appendChild(el); });
}
$('#plNew').onclick=()=>{ const pl={id:'p'+Date.now().toString(36), name:'Escala '+new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}), date:today(), items:[], created:Date.now()}; playlists.push(pl); savePlaylists(); openPlEditor(pl); };
let plEd=null;
function openPlEditor(pl){ plEd=pl; $('#plName').value=pl.name; $('#plDate').value=pl.date||''; $('#plQ').value=''; renderPlItems(); renderPlSearch(); openPanel('#plPanel'); }
$('#plName').oninput=e=>{ plEd.name=e.target.value; savePlaylists(); };
$('#plDate').onchange=e=>{ plEd.date=e.target.value; savePlaylists(); };
function renderPlItems(){
  const L=$('#plItems'); L.innerHTML='';
  if(!plEd.items.length){ L.innerHTML='<div class="src" style="padding:10px 2px">Busque abaixo e toque numa música para adicionar.</div>'; }
  plEd.items.forEach((it,i)=>{ const s=SONGS.find(x=>x.id===it.id); const row=document.createElement('div'); row.className='plrow';
    row.innerHTML=`<span class="n">${i+1}</span><button class="go"><b></b><small></small></button>
      <div class="kctl"><button class="mini" data-a="kd" aria-label="Meio tom abaixo">−</button><span class="kv">${s?songKeyLabel(s,it.semi):'–'}</span><button class="mini" data-a="ku" aria-label="Meio tom acima">+</button></div>
      <button class="mini" data-a="up" aria-label="Subir" ${i?'':'disabled'}>↑</button><button class="mini" data-a="dn" aria-label="Descer" ${i<plEd.items.length-1?'':'disabled'}>↓</button><button class="mini" data-a="rm" aria-label="Remover">✕</button>`;
    row.querySelector('b').textContent=s?s.title:'(música não encontrada)'; row.querySelector('small').textContent=s?((s.artist||'')+(bpmOf(s)?' · '+bpmOf(s)+' bpm':'')):'';
    row.querySelector('.go').onclick=()=>{ if(!s) return; closePanels(); openSong(s.id,true,{pl:plEd, idx:i}); };
    row.onclick=e=>{ const b=e.target.closest('[data-a]'); if(!b) return; const a=b.dataset.a, I=plEd.items;
      if(a==='rm') I.splice(i,1); else if(a==='up'&&i) [I[i-1],I[i]]=[I[i],I[i-1]]; else if(a==='dn'&&i<I.length-1) [I[i+1],I[i]]=[I[i],I[i+1]];
      else if(a==='ku'||a==='kd'){ it.semi=normSemi((it.semi||0)+(a==='ku'?1:-1)); }
      savePlaylists(); renderPlItems(); };
    L.appendChild(row); });
  $('#plCount').textContent=plEd.items.length?`${plEd.items.length} música${plEd.items.length>1?'s':''}`:'';
}
function renderPlSearch(){ const q=norm($('#plQ').value.trim()); const R=$('#plResults'); R.innerHTML='';
  if(!q){ R.innerHTML=''; return; } const w=q.split(/\s+/);
  SONGS.filter(s=>w.every(x=>s._q.includes(x))).slice(0,30).forEach(s=>{ const b=document.createElement('button'); b.className='pres';
    b.innerHTML=`<span class="k">${songKeyLabel(s,ov(s).semi)}</span><span class="t"><b></b><small></small></span><span class="add">＋</span>`; b.querySelector('b').textContent=s.title; b.querySelector('small').textContent=s.artist||'';
    b.onclick=()=>{ plEd.items.push({id:s.id, semi:ov(s).semi||0}); savePlaylists(); renderPlItems(); toast('Adicionada: '+s.title); }; R.appendChild(b); }); }
$('#plQ').addEventListener('input', renderPlSearch);
$('#plStart').onclick=()=>{ const it=plEd.items[0]; if(!it) return toast('Adicione músicas primeiro'); closePanels(); openSong(it.id,true,{pl:plEd, idx:0}); };
$('#plDel').onclick=()=>{ if(!confirm(`Excluir a playlist "${plEd.name}"?`)) return; playlists=playlists.filter(p=>p!==plEd); savePlaylists(); closePanels(); renderPlaylists(); };
const b64e = str => btoa(unescape(encodeURIComponent(str))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const b64d = str => decodeURIComponent(escape(atob(str.replace(/-/g,'+').replace(/_/g,'/'))));
$('#plShare').onclick=async()=>{
  const cs=[]; plEd.items.forEach(it=>{ const s=SONGS.find(x=>x.id===it.id); if(s&&s.custom&&!cs.find(c=>c.id===s.id)) cs.push({id:s.id,title:s.title,artist:s.artist,key:s.key,pad:s.pad,bpm:s.bpm,capo:s.capo,note:s.note,youtube:s.youtube,body:s.body}); });
  const data={n:plEd.name, d:plEd.date, i:plEd.items.map(it=>[it.id, it.semi||0])}; if(cs.length) data.c=cs;
  const url=location.origin+location.pathname+'#pl='+b64e(JSON.stringify(data));
  const lines=plEd.items.map((it,i)=>{ const s=SONGS.find(x=>x.id===it.id); return s?`${i+1}. ${s.title} — ${songKeyLabel(s,it.semi)}${bpmOf(s)?' · '+bpmOf(s)+' bpm':''}`:''; }).filter(Boolean);
  const text=`🎵 ${plEd.name}${plEd.date?' ('+fmtDate(plEd.date)+')':''}\n${lines.join('\n')}\n\nAbrir no app: ${url}`;
  if(navigator.share){ try{ await navigator.share({title:plEd.name, text}); return; }catch(e){ if(e.name==='AbortError') return; } }
  try{ await navigator.clipboard.writeText(text); toast('Escala copiada — cole no WhatsApp ✔'); }catch(e){ prompt('Copie a escala:', text); } };
function renderPlBar(){ const b=$('#plBar'); if(!plCtx){ b.style.display='none'; return; }
  b.style.display=''; b.innerHTML=`<span>▶ <b></b> · ${plCtx.idx+1} de ${plCtx.pl.items.length}</span><button class="mini" id="plBarOpen" aria-label="Ver playlist">☰</button>`;
  b.querySelector('b').textContent=plCtx.pl.name; $('#plBarOpen').onclick=()=>openPlEditor(plCtx.pl); }
/* add current song to a playlist */
$('#addPlBtn').onclick=()=>{ const L=$('#addPlList'); L.innerHTML='';
  const sorted=[...playlists].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  sorted.forEach(pl=>{ const b=document.createElement('button'); b.className='pres'; const has=pl.items.some(x=>x.id===cur.id);
    b.innerHTML=`<span class="k cal sm">${pl.date?pl.date.slice(8,10)+'/'+pl.date.slice(5,7):'—'}</span><span class="t"><b></b><small>${pl.items.length} músicas${has?' · já está nela':''}</small></span><span class="add">＋</span>`; b.querySelector('b').textContent=pl.name;
    b.onclick=()=>{ pl.items.push({id:cur.id, semi}); savePlaylists(); closePanels(); toast(`Adicionada em "${pl.name}" no tom ${keyName(curKey()?curKey().r:0, curKey()?curKey().minor:false)}`); }; L.appendChild(b); });
  if(!sorted.length) L.innerHTML='<div class="src" style="padding:6px 2px 10px">Você ainda não tem playlists. Crie uma abaixo.</div>';
  $('#addPlName').value='Escala '+new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}); openPanel('#addPlPanel'); };
$('#addPlCreate').onclick=()=>{ const n=$('#addPlName').value.trim()||'Nova playlist'; const pl={id:'p'+Date.now().toString(36), name:n, date:today(), items:[{id:cur.id, semi}], created:Date.now()}; playlists.push(pl); savePlaylists(); closePanels(); toast(`Playlist "${n}" criada ✔`); };
/* receiving a shared playlist link */
function checkSharedPlaylist(){ const m=/#pl=([\w-]+)/.exec(location.hash); if(!m) return false;
  try{ const d=JSON.parse(b64d(m[1])); history.replaceState({},'',location.pathname);
    (d.c||[]).forEach(c=>{ if(!SONGS.find(x=>x.id===c.id)){ custom.push({...c, custom:true, padAlt:[]}); } }); uset('custom',custom); rebuild();
    const pl={id:'p'+Date.now().toString(36), name:d.n||'Playlist recebida', date:d.d||today(), items:(d.i||[]).map(([id,sm])=>({id:String(id), semi:sm||0})).filter(it=>SONGS.find(x=>x.id===it.id)), created:Date.now()};
    const same=playlists.find(p=>p.name===pl.name && p.date===pl.date);
    if(same && !confirm(`Você já tem "${pl.name}". Substituir pela versão recebida?`)) { setView('pl'); return true; }
    if(same) Object.assign(same,{items:pl.items}); else playlists.push(pl);
    savePlaylists(); setView('pl'); openPlEditor(same||pl); toast('Playlist recebida e salva para '+profile+' ✔'); }
  catch(e){ toast('Link de playlist inválido'); }
  return true; }


/* ================= tela cheia (stage) ================= */
if(prefs.stageFont==null) prefs.stageFont=24;
let scrollRAF=0, scrollOn=false, scrollLast=0;
function openStage(){
  if(!cur) return; const st=$('#stage');
  $('#stageTitle').textContent=cur.title; $('#stageKey').textContent=(curKey()?keyName(curKey().r,curKey().minor):'')+(capoOf(cur)?' · capo '+capoOf(cur):'')+' · '+bpm+' bpm';
  $('#stageCifra').innerHTML = cur._has ? renderCifra(cur.body, displayShift(), writtenFlats()) : '<div class="nocifra"><div class="big">Sem cifra</div></div>';
  st.style.setProperty('--sfs', prefs.stageFont+'px'); st.classList.add('open'); document.body.classList.add('modal');
  st.scrollTop=0; syncStageMetro(); applyStageLayout();
  const el=document.documentElement; if(el.requestFullscreen && !document.fullscreenElement) el.requestFullscreen().catch(()=>{});
}
function closeStage(){ $('#stage').classList.remove('open'); document.body.classList.remove('modal'); stopScroll(); if(document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(()=>{}); }
function stageFont(v){ prefs.stageFont=Math.max(12,Math.min(64,v)); savePrefs(); $('#stage').style.setProperty('--sfs', prefs.stageFont+'px'); }
function applyStageLayout(){ const st=$('#stage'), el=$('#stageCifra'); const fit=prefs.stageLayout==='fit'; st.classList.toggle('fitmode',fit); $('#stageLayout').classList.toggle('on',fit);
  $('#stageLayout').textContent = fit ? '▦ Encaixado' : '☰ Rolando';
  if(!fit){ unfit(el); return; }
  const bar=$('.stage-bar').getBoundingClientRect().height; const W=st.clientWidth-28, H=window.innerHeight-bar-20;
  fitInto(el, W, H, prefs.stageFitAdj||0); }
function fitStage(){ const box=$('#stageCifra'), st=$('#stage'); const lines=[...box.querySelectorAll('.ln')].map(l=>l.textContent.length); const maxc=Math.max(20,...lines);
  const w=st.clientWidth-40; stageFont(Math.floor(w/(maxc*0.62))); toast('Fonte ajustada à largura da tela'); }
function startScroll(){ scrollOn=true; scrollLast=performance.now(); $('#stageScroll').classList.add('on'); const st=$('#stage'); let acc=0;
  const step=t=>{ if(!scrollOn) return; const dt=(t-scrollLast)/1000; scrollLast=t; acc+=dt*(prefs.scrollSpeed||30); const px=Math.floor(acc); if(px){ st.scrollTop+=px; acc-=px; }
    if(st.scrollTop+st.clientHeight>=st.scrollHeight-2){ stopScroll(); return; } scrollRAF=requestAnimationFrame(step); }; scrollRAF=requestAnimationFrame(step); }
function stopScroll(){ scrollOn=false; cancelAnimationFrame(scrollRAF); const b=$('#stageScroll'); if(b) b.classList.remove('on'); }
function syncStageMetro(){ const b=$('#stageMetro'); if(b) b.classList.toggle('on', metro.on); }
$('#stageBtn').onclick=openStage;
$('#stageClose').onclick=closeStage;
$('#stageFDown').onclick=()=>{ if(prefs.stageLayout==='fit'){ prefs.stageFitAdj=(prefs.stageFitAdj||0)-1; savePrefs(); applyStageLayout(); } else stageFont(prefs.stageFont-2); };
$('#stageFUp').onclick=()=>{ if(prefs.stageLayout==='fit'){ prefs.stageFitAdj=(prefs.stageFitAdj||0)+1; savePrefs(); applyStageLayout(); } else stageFont(prefs.stageFont+2); };
$('#stageLayout').onclick=()=>{ prefs.stageLayout = prefs.stageLayout==='fit'?'scroll':'fit'; savePrefs(); applyStageLayout(); toast(prefs.stageLayout==='fit'?'Música inteira na tela':'Modo rolagem'); };
$('#stageFit').onclick=()=>{ if(prefs.stageLayout==='fit'){ prefs.stageFitAdj=0; savePrefs(); applyStageLayout(); toast('Encaixe automático'); } else fitStage(); };
$('#stageScroll').onclick=()=> scrollOn?stopScroll():startScroll();
$('#stageSlower').onclick=()=>{ prefs.scrollSpeed=Math.max(5,(prefs.scrollSpeed||30)-5); savePrefs(); toast('Rolagem: '+prefs.scrollSpeed); };
$('#stageFaster').onclick=()=>{ prefs.scrollSpeed=Math.min(200,(prefs.scrollSpeed||30)+5); savePrefs(); toast('Rolagem: '+prefs.scrollSpeed); };
$('#stageMetro').onclick=()=>{ metro.toggle(); syncStageMetro(); };
document.addEventListener('fullscreenchange',()=>{ if(!document.fullscreenElement && $('#stage').classList.contains('open')){} });

/* page turner: Bluetooth pedals send PageDown/PageUp or arrow keys */
function turnPage(dir){
  const stage=$('#stage').classList.contains('open');
  const el = stage ? $('#stageCifra') : $('#cifra');
  const fit = el.classList.contains('fit');
  if(fit){ const sc = stage ? el : el.parentElement; const box = el.classList.contains('overflow') ? el : sc; box.scrollBy({left: dir*box.clientWidth*0.95, behavior:'smooth'}); return; }
  if(stage){ const st=$('#stage'); st.scrollBy({top: dir*(st.clientHeight-80), behavior:'smooth'}); }
  else window.scrollBy({top: dir*(window.innerHeight-200), behavior:'smooth'});
}

/* ================= sugestões de medley ================= */
const tonalId = k => k ? mod12(k.minor ? k.r+3 : k.r) : null;   // relative major shares the same notes
function effKey(s){ const pk=parseKey(s.key); if(!pk) return null; const it = (cur===s) ? semi : (ov(s).semi||0); return {r:pk.r+it, minor:pk.minor}; }
function renderSuggest(){
  const box=$('#suggest'); if(!cur){ box.innerHTML=''; return; }
  const k=curKey(); const b=bpm;
  if(!k){ box.innerHTML=''; return; }
  const tid=tonalId(k);
  const cands=SONGS.filter(s=>s.id!==cur.id && !s.medley).map(s=>{ const ek=effKey(s); if(!ek) return null; const sb=bpmOf(s);
      const same=tonalId(ek)===tid, exact=same && mod12(ek.r)===mod12(k.r) && ek.minor===k.minor;
      const d=sb?Math.abs(sb-b):99; const half=sb?Math.min(Math.abs(sb*2-b),Math.abs(sb/2-b)):99;
      return {s,ek,sb,same,exact,d,half}; }).filter(Boolean);
  const top=cands.filter(c=>c.same && (c.d<=8 || c.half<=4)).sort((a,b)=>(a.d-b.d)||(b.exact-a.exact)||(b.s._has-a.s._has)).slice(0,10);
  const near=cands.filter(c=>c.same && !(c.d<=8||c.half<=4)).sort((a,b)=>a.d-b.d).slice(0,6);
  const row=c=>`<div class="sg"><button class="sg-open" data-id="${c.s.id}"><span class="k">${keyName(c.ek.r,c.ek.minor)}</span><span class="t"><b>${esc(c.s.title)}</b><small>${esc(c.s.artist||'')}${c.sb?' · '+c.sb+' bpm':''}${c.d<=8?(c.d===0?' · mesmo BPM':` · ${c.d} bpm de diferença`):(c.half<=4?' · BPM em meio tempo/dobro':'')}${c.exact?'':' · tom relativo'}${c.s._has?'':' · sem cifra'}</small></span></button><button class="mini sg-add" data-id="${c.s.id}" title="Criar medley com esta música" aria-label="Criar medley">＋</button></div>`;
  box.innerHTML = `<div class="sg-head"><b>Sugestões de medley</b><small>Músicas do repertório no tom ${keyName(k.r,k.minor)} (ou relativo ${keyName(k.minor?k.r+3:k.r-3,!k.minor)}) com BPM próximo de ${b}</small></div>`+
    (top.length? top.map(row).join('') : '<div class="src" style="padding:6px 2px">Nenhuma música com tom e BPM parecidos.</div>')+
    (near.length? `<details class="sg-more"><summary>Mesmo tom, BPM diferente (${near.length})</summary>${near.map(row).join('')}</details>`:'')+
    `<button class="btn" id="sgMedley" style="margin-top:10px">🎼 Criar medley a partir desta música</button>`;
  box.querySelectorAll('.sg-open').forEach(x=>x.onclick=()=>openSong(x.dataset.id));
  box.querySelectorAll('.sg-add').forEach(x=>x.onclick=()=>openMedley(null, cur, SONGS.find(s=>s.id===x.dataset.id)));
  $('#sgMedley').onclick=()=>openMedley(null, cur);
}

/* ================= medleys ================= */
const LABELS=['Intro','Primeira Parte','Segunda Parte','Verso','Pré-Refrão','Refrão','Ponte','Solo','Interlúdio','Transição','Final'];
function splitSections(body){
  const out=[]; let curS=null;
  (body||'').split('\n').forEach(l=>{ const m=/^\s*\[([^\]]+)\]\s*(.*)$/.exec(l);
    if(m){ curS={name:m[1].trim(), lines:[]}; out.push(curS); const rest=(m[2]||'').trim(); if(rest && isChordLine(rest)) curS.lines.push(rest); else if(rest) curS.rep=rest; return; }
    if(!curS){ curS={name:'Início', lines:[]}; out.push(curS); } curS.lines.push(l); });
  out.forEach(s=>{ while(s.lines.length && !s.lines[s.lines.length-1].trim()) s.lines.pop(); while(s.lines.length && !s.lines[0].trim()) s.lines.shift(); s.text=s.lines.join('\n'); });
  return out.filter(s=>s.text.trim() || s.rep!==undefined || true);
}
function guessLabel(name){ const n=norm(name); if(/refr/.test(n)) return 'Refrão'; if(/pre/.test(n)) return 'Pré-Refrão'; if(/ponte|bridge/.test(n)) return 'Ponte'; if(/intro/.test(n)) return 'Intro';
  if(/solo/.test(n)) return 'Solo'; if(/final|fim/.test(n)) return 'Final'; if(/segunda/.test(n)) return 'Segunda Parte'; if(/primeira|verso|estrofe/.test(n)) return 'Primeira Parte'; if(/interl/.test(n)) return 'Interlúdio'; if(/transi|passagem/.test(n)) return 'Transição'; return name; }
function writtenKeyOf(s){ const pk=parseKey(s.key); if(!pk) return null; return {r:pk.r-(s.capo||0), minor:pk.minor}; }
function autoSemi(s, mk){ const wk=writtenKeyOf(s); if(!wk||!mk) return 0; return normSemi(tonalId(mk)-tonalId(wk)); }
let MD=null; // medley being edited
function openMedley(existing, base, also){
  if(existing && existing.medley){ MD=JSON.parse(JSON.stringify(existing.medley)); MD.id=existing.id; MD.title=existing.title; MD.bpm=existing.bpm; }
  else {
    const k = base ? (base===cur? curKey() : effKey(base)) : null;
    MD={ id:null, title:'Medley: '+(base?base.title:'')+(also?' + '+also.title:''), key:k?SHARP[mod12(k.r)]+(k.minor?'m':''):'C', bpm: base? (base===cur?bpm:bpmOf(base)) : null, parts:[] };
    const addAll = s => splitSections(s.body).forEach(sec=>{ if(!sec.text.trim()) return; MD.parts.push({songId:s.id, from:sec.name, label:guessLabel(sec.name), reps:repsOf(sec.rep), text:sec.text, semi:autoSemi(s,parseKey(MD.key)), auto:true}); });
    if(base) addAll(base); if(also) addAll(also);
  }
  $('#mdTitle').value=MD.title; fillSelect($('#mdKey'), keyOptions(), MD.key); $('#mdBpm').value=MD.bpm||'';
  $('#mdQ').value=''; $('#mdSrc').innerHTML=''; mdSrcSong=null;
  renderMdParts(); renderMdSearch(); openPanel('#medleyPanel');
}
function repsOf(rep){ const m=/(\d+)\s*[xX]|(\d+)\s*vez/i.exec(rep||''); return m? +(m[1]||m[2]) : 1; }
$('#mdTitle').oninput=e=>{ MD.title=e.target.value; };
$('#mdBpm').oninput=e=>{ MD.bpm=parseInt(e.target.value,10)||null; };
$('#mdKey').onchange=e=>{ MD.key=e.target.value; MD.parts.forEach(p=>{ if(p.auto){ const s=SONGS.find(x=>x.id===p.songId); if(s) p.semi=autoSemi(s,parseKey(MD.key)); } }); renderMdParts(); };
function partHTML(p){ const mk=parseKey(MD.key); return renderCifra(p.text, p.semi||0, mk?useFlats(mk.r,mk.minor):false); }
function renderMdParts(){
  const L=$('#mdParts'); L.innerHTML='';
  if(!MD.parts.length) L.innerHTML='<div class="src" style="padding:12px 4px">Nenhuma parte ainda. Escolha uma música ao lado e adicione refrão, ponte ou um trecho selecionado.</div>';
  MD.parts.forEach((p,i)=>{ const s=SONGS.find(x=>x.id===p.songId); const wk=s?writtenKeyOf(s):null; const mk=parseKey(MD.key);
    const el=document.createElement('div'); el.className='mdp';
    el.innerHTML=`<div class="mdp-h"><span class="n">${i+1}</span>
      <select class="lab">${[...new Set(LABELS.concat([p.label]))].map(l=>`<option ${l===p.label?'selected':''}>${esc(l)}</option>`).join('')}</select>
      <label class="reps">×<input type="number" min="1" max="12" value="${p.reps||1}"></label>
      <span class="spacer"></span>
      <button class="mini" data-a="up" ${i?'':'disabled'} aria-label="Subir">↑</button><button class="mini" data-a="dn" ${i<MD.parts.length-1?'':'disabled'} aria-label="Descer">↓</button><button class="mini" data-a="rm" aria-label="Remover">✕</button></div>
      <div class="mdp-src"><span></span><span class="tr"><button class="mini" data-a="td" aria-label="Meio tom abaixo">−</button><b>${wk&&mk?keyName(wk.r+(p.semi||0),wk.minor):'—'}</b><button class="mini" data-a="tu" aria-label="Meio tom acima">+</button></span></div>
      <div class="cifra mdp-body">${partHTML(p)}</div>`;
    el.querySelector('.mdp-src span').textContent=(s?s.title:'?')+' — '+(p.from||'trecho')+(wk?` (original ${keyName(wk.r,wk.minor)})`:'');
    el.querySelector('.lab').onchange=e=>{ p.label=e.target.value; };
    el.querySelector('.reps input').oninput=e=>{ p.reps=Math.max(1,Math.min(12,parseInt(e.target.value,10)||1)); };
    el.onclick=e=>{ const b=e.target.closest('[data-a]'); if(!b) return; const a=b.dataset.a, P=MD.parts;
      if(a==='rm') P.splice(i,1); else if(a==='up') [P[i-1],P[i]]=[P[i],P[i-1]]; else if(a==='dn') [P[i+1],P[i]]=[P[i],P[i+1]];
      else if(a==='tu'||a==='td'){ p.semi=normSemi((p.semi||0)+(a==='tu'?1:-1)); p.auto=false; }
      renderMdParts(); };
    L.appendChild(el); });
  $('#mdCount').textContent=MD.parts.length?`${MD.parts.length} parte${MD.parts.length>1?'s':''}`:'';
}
let mdSrcSong=null;
function renderMdSearch(){ const q=norm($('#mdQ').value.trim()), R=$('#mdResults'); R.innerHTML=''; if(!q) return;
  const w=q.split(/\s+/); const mk=parseKey(MD.key);
  SONGS.filter(s=>s._has && !s.medley && w.every(x=>s._q.includes(x))).slice(0,20).forEach(s=>{ const ek=effKey(s); const b=document.createElement('button'); b.className='pres';
    b.innerHTML=`<span class="k">${ek?keyName(ek.r,ek.minor):'–'}</span><span class="t"><b></b><small></small></span><span class="add">›</span>`; b.querySelector('b').textContent=s.title;
    b.querySelector('small').textContent=(s.artist||'')+(bpmOf(s)?' · '+bpmOf(s)+' bpm':'')+(ek&&mk&&tonalId(ek)===tonalId(mk)?' · mesmo tom ✓':'');
    b.onclick=()=>pickMdSource(s); R.appendChild(b); }); }
$('#mdQ').addEventListener('input', renderMdSearch);
function pickMdSource(s){ mdSrcSong=s; $('#mdResults').innerHTML=''; $('#mdQ').value='';
  const secs=splitSections(s.body); const box=$('#mdSrc');
  box.innerHTML=`<div class="mds-h"><b></b><button class="mini" id="mdSrcClose" aria-label="Fechar">✕</button></div>
   <div class="mds-secs"></div>
   <div class="mds-free"><div class="src">Ou selecione um trecho no texto abaixo (arraste com o dedo ou o mouse) e toque em “Adicionar trecho”:</div>
   <textarea id="mdFree" readonly spellcheck="false"></textarea>
   <div class="mds-row"><select id="mdFreeLab">${LABELS.map(l=>`<option ${l==='Refrão'?'selected':''}>${l}</option>`).join('')}</select><label class="reps">×<input id="mdFreeReps" type="number" min="1" max="12" value="1"></label><button class="btn primary" id="mdFreeAdd">＋ Adicionar trecho</button></div></div>
   <button class="btn" id="mdAll" style="margin-top:8px">＋ Música inteira</button>`;
  box.querySelector('.mds-h b').textContent=s.title+(s.artist?' — '+s.artist:'');
  const SS=box.querySelector('.mds-secs');
  secs.forEach(sec=>{ if(!sec.text.trim()) return; const d=document.createElement('div'); d.className='mds';
    d.innerHTML=`<div class="mds-t"><b></b><button class="btn sm">＋ Adicionar</button></div><div class="cifra mds-body"></div>`;
    d.querySelector('b').textContent=sec.name+(sec.rep?' · '+sec.rep:''); d.querySelector('.mds-body').innerHTML=renderCifra(sec.text,0,false);
    d.querySelector('button').onclick=()=>addPart(s, sec.name, guessLabel(sec.name), repsOf(sec.rep), sec.text); SS.appendChild(d); });
  $('#mdFree').value=s.body;
  $('#mdSrcClose').onclick=()=>{ box.innerHTML=''; mdSrcSong=null; };
  $('#mdAll').onclick=()=>secs.forEach(sec=>{ if(sec.text.trim()) addPart(s, sec.name, guessLabel(sec.name), repsOf(sec.rep), sec.text, true); });
  $('#mdFreeAdd').onclick=()=>{ const ta=$('#mdFree'); let t=ta.value.slice(ta.selectionStart, ta.selectionEnd);
    if(!t.trim()) return toast('Selecione um trecho do texto primeiro');
    // expand selection to whole lines so chords stay aligned
    let st=ta.value.lastIndexOf('\n', ta.selectionStart-1)+1; let en=ta.value.indexOf('\n', ta.selectionEnd-1); if(en<0) en=ta.value.length;
    // if the first line is lyrics, bring the chord line above it too
    const firstLine=ta.value.slice(st, (ta.value.indexOf('\n',st)+1||ta.value.length+1)-1);
    if(!isChordLine(firstLine) && st>0){ const ps=ta.value.lastIndexOf('\n', st-2)+1; const prev=ta.value.slice(ps, st-1); if(isChordLine(prev)) st=ps; }
    t=ta.value.slice(st,en);
    t=t.split('\n').filter(l=>!/^\s*\[[^\]]+\]\s*$/.test(l)).join('\n').replace(/^\s*\n|\n\s*$/g,'');
    addPart(s, 'trecho', $('#mdFreeLab').value, parseInt($('#mdFreeReps').value,10)||1, t); };
  box.scrollIntoView({block:'nearest'});
}
function addPart(s, from, label, reps, text, quiet){ MD.parts.push({songId:s.id, from, label, reps:reps||1, text, semi:autoSemi(s,parseKey(MD.key)), auto:true}); renderMdParts(); if(!quiet) toast(`${label} de "${s.title}" adicionado`);
  const L=$('#mdParts'); L.scrollTop=L.scrollHeight; }
function medleyBody(){
  const mk=parseKey(MD.key), fl=mk?useFlats(mk.r,mk.minor):false; const out=[]; let last=null;
  MD.parts.forEach(p=>{ const s=SONGS.find(x=>x.id===p.songId);
    out.push(`[${p.label}]${p.reps>1?' '+p.reps+'x':''}`);
    if(p.songId!==last && s) out.push('! '+s.title+(s.artist?' — '+s.artist:''));
    last=p.songId;
    out.push(p.text.split('\n').map(l=>isChordLine(l)?trLine(l,p.semi||0,fl):l).join('\n'), ''); });
  return out.join('\n').replace(/\n+$/,'');
}
$('#mdSave').onclick=()=>{
  if(!MD.parts.length) return toast('Adicione pelo menos uma parte');
  const title=($('#mdTitle').value||'').trim()||'Medley';
  const titles=[...new Set(MD.parts.map(p=>{ const s=SONGS.find(x=>x.id===p.songId); return s?s.title:''; }).filter(Boolean))];
  const song={ id: MD.id || 'u'+Date.now().toString(36), custom:true, title, artist:'Medley · '+titles.join(' + '), key:MD.key, pad:'', padAlt:[], bpm:MD.bpm||null, capo:0,
    note:'', youtube:'', body:medleyBody(), medley:{key:MD.key, parts:MD.parts} };
  if(MD.id) custom=custom.map(c=>c.id===song.id?song:c); else custom.push(song);
  delete overrides[song.id]; saveOverrides();
  if(!uset('custom',custom)) return toast('Sem espaço no aparelho');
  rebuild(); closePanels(); openSong(song.id, !MD.id); toast('Medley salvo ✔');
};
$('#mdPreviewBtn').onclick=()=>{ const w=$('#mdPreview'); const on=w.style.display==='none'||!w.style.display; w.style.display=on?'block':'none';
  if(on){ const mk=parseKey(MD.key); w.innerHTML='<div class="cifra">'+renderCifra(medleyBody(),0,false)+'</div>'; } };
$('#newMedleyBtn').onclick=()=>openMedley(null, null);

/* ================= helpers ================= */
function slug(s){ return norm(s).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }
function download(name, text, type){ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([text],{type})); a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },500); }
function songToTxt(s){ return [`@title ${s.title}`,`@artist ${s.artist||''}`,`@tom ${s.key||''}`,`@pad ${s.pad||''}`,`@bpm ${s.bpm||''}`].concat(s.capo?[`@capo ${s.capo}`]:[]).concat(s.note?[`@note ${s.note}`]:[]).concat(s.youtube?[`@youtube ${s.youtube}`]:[]).join('\n')+'\n\n'+(s.body||'')+'\n'; }
let toastT=0; function toast(t){ const el=$('#toast'); el.textContent=t; el.classList.add('show'); clearTimeout(toastT); toastT=setTimeout(()=>el.classList.remove('show'),2200); }

/* ================= audio ================= */
let AC=null, master=null;
function ctx(){ if(!AC){ AC=new (window.AudioContext||window.webkitAudioContext)(); master=AC.createGain(); master.connect(AC.destination); } if(AC.state==='suspended') AC.resume(); return AC; }
const metro = {
  on:false, next:0, beat:0, timer:null, queue:[], gain:null, raf:0,
  start(){ const a=ctx(); if(!this.gain){ this.gain=a.createGain(); this.gain.connect(master); } this.gain.gain.value=prefs.mvol;
    this.on=true; this.beat=0; this.next=a.currentTime+0.06; this.queue=[]; this.timer=setInterval(()=>this.tick(),25); this.tick(); this.draw(); setPlay('#metroBtn',true); },
  stop(){ this.on=false; clearInterval(this.timer); cancelAnimationFrame(this.raf); setPlay('#metroBtn',false); drawBeats(-1); },
  toggle(){ this.on?this.stop():this.start(); },
  tick(){ const a=AC, spb=60/bpm/prefs.sub, per=prefs.sig*prefs.sub;
    while(this.next < a.currentTime+0.12){ const b=this.beat%per, main=b%prefs.sub===0, bn=Math.floor(b/prefs.sub);
      const lvl = !main ? 0.45 : (!prefs.accent ? 1 : (b===0 ? 2 : (prefs.sig===6 && bn===3 ? 1.5 : 1)));
      this.click(this.next,lvl); if(main) this.queue.push({t:this.next,b:bn}); this.next+=spb; this.beat++; } },
  click(t,lvl){ const a=AC, out=this.gain, acc=lvl>=2, mid=lvl>1 && !acc, vol=(acc?1:mid?.8:lvl>=1?.62:.28);
    const env=(node,peak,dec)=>{ const g=a.createGain(); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(peak,t+0.002); g.gain.exponentialRampToValueAtTime(0.0001,t+dec); node.connect(g); g.connect(out); return g; };
    if(prefs.snd==='soft'){
      // soft, low tick: rounded sine with gentle attack, filtered
      const o=a.createOscillator(); o.type='sine'; const fq=acc?620:(mid?560:520); o.frequency.value=fq;
      const lp=a.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=1400; o.connect(lp);
      const g=a.createGain(); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.85*vol,t+0.006); g.gain.exponentialRampToValueAtTime(0.0001,t+0.11);
      lp.connect(g); g.connect(out); o.start(t); o.stop(t+0.13); return; }
    if(prefs.snd==='low'){
      // deep "tok" like a soft tom / rim on a cushion
      const o=a.createOscillator(); o.type='triangle'; const fq=acc?260:(mid?230:210); o.frequency.setValueAtTime(fq*1.6,t); o.frequency.exponentialRampToValueAtTime(fq,t+0.03);
      const lp=a.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=900; o.connect(lp);
      const g=a.createGain(); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(1.0*vol,t+0.004); g.gain.exponentialRampToValueAtTime(0.0001,t+0.16);
      lp.connect(g); g.connect(out); o.start(t); o.stop(t+0.18); return; }
    if(prefs.snd==='cowbell'){
      // classic 2-oscillator cowbell (808 style) through a band-pass
      const bp=a.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=acc?1100:950; bp.Q.value=1.4;
      const k=acc?1.06:1; [562*k,845*k].forEach(fq=>{ const o=a.createOscillator(); o.type='square'; o.frequency.value=fq; o.connect(bp); o.start(t); o.stop(t+0.5); });
      const g=a.createGain(); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.55*vol,t+0.002); g.gain.exponentialRampToValueAtTime(0.18*vol,t+0.06); g.gain.exponentialRampToValueAtTime(0.0001,t+0.42);
      bp.connect(g); g.connect(out); return; }
    if(prefs.snd==='block'){
      // wood block: short resonant tone + tiny noise transient
      const o=a.createOscillator(); o.type='sine'; const fq=acc?2050:(mid?1800:1600); o.frequency.setValueAtTime(fq*1.25,t); o.frequency.exponentialRampToValueAtTime(fq,t+0.012);
      env(o,0.9*vol,0.07); o.start(t); o.stop(t+0.09);
      const o2=a.createOscillator(); o2.type='triangle'; o2.frequency.value=fq*2.7; env(o2,0.18*vol,0.03); o2.start(t); o2.stop(t+0.05);
      const len=Math.floor(a.sampleRate*0.012), buf=a.createBuffer(1,len,a.sampleRate), d=buf.getChannelData(0); for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*(1-i/len);
      const n=a.createBufferSource(); n.buffer=buf; const bp=a.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=3200; bp.Q.value=2; n.connect(bp); env(bp,0.35*vol,0.015); n.start(t); return; }
    const o=a.createOscillator(); let f,dd,type;
    if(prefs.snd==='beep'){ type='sine'; f=acc?1320:(mid?1100:880); dd=0.06; }
    else { type='square'; f=acc?2000:(mid?1700:1400); dd=0.022; }
    o.type=type; o.frequency.setValueAtTime(f,t); env(o,vol*(type==='square'?0.32:0.9),dd); o.start(t); o.stop(t+dd+0.02); },
  draw(){ if(!this.on) return; let shown=null; while(this.queue.length && this.queue[0].t<=AC.currentTime) shown=this.queue.shift(); if(shown) drawBeats(shown.b); this.raf=requestAnimationFrame(()=>this.draw()); }
};
function drawBeats(b){ const el=$('#beats'); if(el.children.length!==prefs.sig){ el.innerHTML=''; for(let i=0;i<prefs.sig;i++){ const d=document.createElement('i'); if(!i) d.className='first'; el.appendChild(d);} } [...el.children].forEach((d,i)=>d.classList.toggle('on',i===b)); }
function setPlay(sel,on){ const b=$(sel); b.classList.toggle('on',on); b.innerHTML = on ? '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4.5" height="14" rx="1"/><rect x="13.5" y="5" width="4.5" height="14" rx="1"/></svg>' : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>'; b.setAttribute('aria-label', on?'Parar':'Tocar'); }
$('#metroBtn').onclick=()=>{ metro.toggle(); if(typeof syncStageMetro==='function') syncStageMetro(); };
function updateBpm(save=true){ bpm=Math.max(30,Math.min(260,Math.round(bpm))); $('#bpmVal').textContent=bpm; $('#bpmInput').value=bpm;
  if(cur){ const orig=cur.bpm; $('#bpmSrc').textContent = orig ? (bpm===orig ? (cur.bpmSrc==='songbpm'?'Original (via songbpm.com — confira)':'Original da setlist') : `Original: ${orig}`) : 'Música sem BPM na setlist — ajuste aqui'; }
  if(save && cur){ setOv(cur.id,{bpm: bpm!==(cur.bpm||120) ? bpm : undefined}); const f=$$('#facts .fact'); f.forEach(x=>{ if(x.firstChild && x.firstChild.textContent==='BPM') x.querySelector('b').textContent=bpm; }); }
  drawBeats(-1); }
$('#bpmDown').onclick=()=>{ bpm--; updateBpm(); };
$('#bpmUp').onclick=()=>{ bpm++; updateBpm(); };
$$('[data-bpm]').forEach(b=> b.onclick=()=>{ bpm+=+b.dataset.bpm; updateBpm(); });
$('#bpmInput').addEventListener('change', e=>{ const v=parseInt(e.target.value,10); if(v){ bpm=v; updateBpm(); } });
let taps=[];
$('#tapBtn').onclick=()=>{ const t=performance.now(); taps=taps.filter(x=>t-x<2500); taps.push(t); if(taps.length>=3){ const d=[]; for(let i=1;i<taps.length;i++) d.push(taps[i]-taps[i-1]); bpm=60000/(d.reduce((a,b)=>a+b)/d.length); updateBpm(); } };
function seg(id,key,cb){ const el=$(id); const sync=()=>el.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed', String(b.dataset.v)===String(prefs[key])));
  el.onclick=e=>{ const b=e.target.closest('button'); if(!b) return; const v=b.dataset.v; prefs[key]=isNaN(+v)?v:+v; savePrefs(); sync(); cb&&cb(); }; sync(); }
seg('#sigSeg','sig',()=>drawBeats(-1)); seg('#subSeg','sub'); seg('#sndSeg','snd',()=>{ if(!metro.on){ const a=ctx(); if(!metro.gain){ metro.gain=a.createGain(); metro.gain.connect(master);} metro.gain.gain.value=prefs.mvol; metro.click(a.currentTime+0.02, prefs.accent?2:1); } }); seg('#accSeg','accent');
$('#metroVol').value=prefs.mvol; $('#metroVol').oninput=e=>{ prefs.mvol=+e.target.value; savePrefs(); if(metro.gain) metro.gain.gain.value=prefs.mvol; };

/* pad */
function padList(s){ const l=[s.pad,...(s.padAlt||[])].filter(Boolean); if(!l.length && s.key) l.push(s.key); return l; }
function padRoot(){ if(!cur) return null; const o=ov(cur);
  if(o.pad){ const p=parseKey(o.pad); return p?{r:p.r+semi,minor:p.minor}:null; }
  const l=padList(cur), ch=uget('padchoice',{})[cur.id]||0; const b=parseKey(l[ch]||l[0]); return b?{r:b.r+semi,minor:b.minor}:null; }
function padNote(){ const p=padRoot(); return p?keyName(p.r,p.minor):''; }
function updatePadLabel(){ $('#padVal').textContent=padNote()||'—'; $('#padBtn').disabled=!padRoot();
  const pc=$('#padChoice'), o=ov(cur); let l=padList(cur); if(o.pad) l=[o.pad];
  const ch=o.pad?0:(uget('padchoice',{})[cur.id]||0);
  pc.innerHTML=l.map((p,i)=>{ const k=parseKey(p); return `<button data-v="${i}" aria-pressed="${i===ch}">${k?keyName(k.r+semi,k.minor):p}</button>`; }).join('')||'<span class="src">—</span>';
  pc.onclick=e=>{ const b=e.target.closest('button'); if(!b||o.pad) return; const m=uget('padchoice',{}); m[cur.id]=+b.dataset.v; uset('padchoice',m); updatePadLabel(); renderSong(); if(pad.on) pad.retune(); }; }
function makeReverb(a,secs=4.5){ const len=a.sampleRate*secs, buf=a.createBuffer(2,len,a.sampleRate); for(let c=0;c<2;c++){ const d=buf.getChannelData(c); for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.6); } const cv=a.createConvolver(); cv.buffer=buf; return cv; }
const synth={ on:false, voices:null, out:null,
  ensure(){ const a=ctx(); if(!this.out){ this.out=a.createGain(); this.out.gain.value=prefs.pvol; const rev=makeReverb(a), wet=a.createGain(), dry=a.createGain(); wet.gain.value=.55; dry.gain.value=.6;
    this.bus=a.createGain(); this.bus.connect(dry); this.bus.connect(rev); rev.connect(wet); dry.connect(this.out); wet.connect(this.out); this.out.connect(master); } },
  build(root){ const a=AC, t=a.currentTime, g=a.createGain(); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(1,t+2.2);
    const lp=a.createBiquadFilter(); lp.type='lowpass'; lp.Q.value=0.6; const base=prefs.tone==='air'?2600:prefs.tone==='organ'?1800:1100; lp.frequency.value=base;
    const lfo=a.createOscillator(), lg=a.createGain(); lfo.frequency.value=0.09; lg.gain.value=base*0.35; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
    lp.connect(g); g.connect(this.bus);
    const f0=440*Math.pow(2,(mod12(root.r)-9)/12)/2, rootF=f0<120?f0*2:f0;
    const iv=[[-12,.55],[0,.75],[7,.5],[12,.42],[19,.18],[24,.12]]; if(prefs.third) iv.push([root.minor?15:16,.22]);
    const oscs=[lfo];
    for(const [st,amp] of iv){ const f=rootF*Math.pow(2,st/12); const types=prefs.tone==='organ'?['sine','triangle']:prefs.tone==='air'?['triangle','sawtooth']:['sawtooth','sawtooth'];
      [-7,7].forEach((det,ix)=>{ const o=a.createOscillator(); o.type=types[ix]; o.frequency.value=f; o.detune.value=det+(Math.random()*4-2); const vg=a.createGain(); vg.gain.value=amp*(types[ix]==='sawtooth'?0.06:0.12); o.connect(vg); vg.connect(lp); o.start(t); oscs.push(o); }); }
    return {g,oscs}; },
  start(){ const p=padRoot(); if(!p) return; this.ensure(); this.out.gain.value=prefs.pvol; this.voices=this.build(p); this.on=true; },
  fade(v,dur=2.5){ if(!v) return; const t=AC.currentTime; v.g.gain.cancelScheduledValues(t); v.g.gain.setValueAtTime(Math.max(v.g.gain.value,0.0001),t); v.g.gain.exponentialRampToValueAtTime(0.0001,t+dur); v.oscs.forEach(o=>{ try{o.stop(t+dur+0.1);}catch(e){} }); },
  stop(){ if(!this.on) return; this.fade(this.voices,2.2); this.voices=null; this.on=false; },
  retune(fast){ if(!this.on) return; const old=this.voices, p=padRoot(); if(!p){ this.stop(); return; } this.voices=this.build(p); this.fade(old,fast?1.2:2.4); } };

/* --- pads from YouTube (1-hour worship pad videos, one per key) --- */
const YT_PADS = {
  deep:    {name:'Deep Worship Pads', ids:{1:'FBF0WKzk9Ag',2:'oOY8_eUalDA',4:'kEhHYrG4zMI',5:'qG5qM02UOhc',6:'diePwkBKCTU',7:'1hdfzFgQqjw',8:'efMdOJJoIjc',9:'gCl4MYnn6Sk',11:'83Z9g-PHaOA'}},
  shimmer: {name:'Ambient Shimmer Pads', ids:{0:'2wVGy1jcpGA',2:'--FfDXmoL1U',3:'JxhoKHDWfwU',4:'v5-JyS7Y6jg',7:'bsU7Kr4iJxI',9:'FwukygTzCoc',10:'cR-nbUpRbtA',11:'aDPTPnt_pEE'}}
};
function ytPadId(r){ r=mod12(r); const first=YT_PADS[prefs.padSrc==='shimmer'?'shimmer':'deep'], other=YT_PADS[prefs.padSrc==='shimmer'?'deep':'shimmer'];
  return first.ids[r] || other.ids[r] || null; }
let ytApi=null;
function loadYT(){ if(ytApi) return ytApi; ytApi=new Promise((ok,err)=>{ if(window.YT && YT.Player) return ok();
  const prev=window.onYouTubeIframeAPIReady; window.onYouTubeIframeAPIReady=()=>{ prev&&prev(); ok(); };
  const sc=document.createElement('script'); sc.src='https://www.youtube.com/iframe_api'; sc.onerror=()=>{ ytApi=null; err(new Error('sem internet')); }; document.head.appendChild(sc);
  setTimeout(()=>{ if(!(window.YT&&YT.Player)){ ytApi=null; err(new Error('YouTube não respondeu')); } },9000); }); return ytApi; }
const ytPad={ on:false, player:null, vid:null, fadeT:0,
  async start(){ const p=padRoot(); if(!p) return; const id=ytPadId(p.r); if(!id) throw new Error('sem vídeo para este tom');
    this.on=true; $('#ytBox').classList.add('show'); $('#ytKey').textContent='Pad '+keyName(p.r,p.minor);
    await loadYT(); if(!this.on) return;
    if(!this.player){ await new Promise(ok=>{ this.player=new YT.Player('ytPlayer',{ width:'160', height:'90', videoId:id,
        playerVars:{autoplay:1, controls:0, start:45, playsinline:1, modestbranding:1, rel:0, disablekb:1},
        events:{ onReady:e=>{ e.target.setVolume(0); e.target.playVideo(); this.fadeTo(prefs.pvol*100,2500); ok(); },
                 onStateChange:e=>{ if(e.data===YT.PlayerState.ENDED) e.target.seekTo(45,true); } } }); }); this.vid=id; }
    else { this.player.setVolume(0); if(this.vid!==id){ this.player.loadVideoById({videoId:id,startSeconds:45}); this.vid=id; } else this.player.playVideo(); this.fadeTo(prefs.pvol*100,2500); } },
  fadeTo(target,ms,done){ clearInterval(this.fadeT); if(!this.player||!this.player.getVolume) return done&&done(); const from=this.player.getVolume(), steps=Math.max(1,Math.round(ms/80)); let i=0;
    this.fadeT=setInterval(()=>{ i++; const v=from+(target-from)*i/steps; try{ this.player.setVolume(Math.round(v)); }catch(e){} if(i>=steps){ clearInterval(this.fadeT); done&&done(); } },80); },
  stop(){ if(!this.on) return; this.on=false; this.fadeTo(0,1500,()=>{ try{ this.player.pauseVideo(); }catch(e){} $('#ytBox').classList.remove('show'); }); },
  retune(){ if(!this.on||!this.player) return; const p=padRoot(); if(!p) return this.stop(); const id=ytPadId(p.r); $('#ytKey').textContent='Pad '+keyName(p.r,p.minor); if(id===this.vid) return;
    this.fadeTo(0,1200,()=>{ if(!this.on) return; this.player.loadVideoById({videoId:id,startSeconds:45}); this.vid=id; this.fadeTo(prefs.pvol*100,2200); }); },
  volume(){ if(this.on&&this.player&&this.player.setVolume) this.player.setVolume(Math.round(prefs.pvol*100)); } };

const pad={ get on(){ return synth.on||ytPad.on; },
  useYT(){ return prefs.padSrc!=='synth'; },
  async start(){ if(!padRoot()) return; setPlay('#padBtn',true); $('#padUnit').classList.add('pad-on');
    if(this.useYT()){ try{ await ytPad.start(); return; }catch(e){ ytPad.on=false; $('#ytBox').classList.remove('show'); toast('Pad do YouTube indisponível ('+e.message+') — usando pad sintetizado'); } }
    synth.start(); },
  stop(){ synth.stop(); ytPad.stop(); setPlay('#padBtn',false); $('#padUnit').classList.remove('pad-on'); },
  retune(fast){ if(ytPad.on) ytPad.retune(); if(synth.on) synth.retune(fast); },
  restart(){ if(this.on){ synth.stop(); ytPad.on=false; try{ ytPad.player&&ytPad.player.pauseVideo(); }catch(e){} $('#ytBox').classList.remove('show'); this.start(); } },
  toggle(){ this.on?this.stop():this.start(); } };
$('#padBtn').onclick=()=>pad.toggle();
seg('#toneSeg','tone',()=>synth.retune()); seg('#thirdSeg','third',()=>synth.retune());
if(!prefs.padSrc) prefs.padSrc='deep';
seg('#padSrcSeg','padSrc',()=>{ syncPadRows(); pad.restart(); });
function syncPadRows(){ $$('.synth-only').forEach(r=>r.style.display=prefs.padSrc==='synth'?'':'none'); $$('.yt-only').forEach(r=>r.style.display=prefs.padSrc==='synth'?'none':''); }
syncPadRows();
$('#ytStop').onclick=()=>pad.stop();
$('#padVol').value=prefs.pvol; $('#padVol').oninput=e=>{ prefs.pvol=+e.target.value; savePrefs(); if(synth.out) synth.out.gain.setTargetAtTime(prefs.pvol,AC.currentTime,.05); ytPad.volume(); };

/* ================= panels / keys ================= */
function openPanel(id){ $(id).classList.add('open'); document.body.classList.add('modal'); }
function closePanels(){ $$('.panel.open').forEach(p=>p.classList.remove('open')); document.body.classList.remove('modal'); }
$$('.panel').forEach(p=>p.addEventListener('click',e=>{ if(e.target===p || e.target.closest('[data-close]')) closePanels(); }));
$('#metroMore').onclick=()=>{ updateBpm(false); openPanel('#metroPanel'); };
$('#padMore').onclick=()=>openPanel('#padPanel');
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){ if($('#stage').classList.contains('open')) closeStage(); closePanels(); return; }
  const pageKeys={PageDown:1,ArrowDown:1,ArrowRight:1,Enter:1,PageUp:-1,ArrowUp:-1,ArrowLeft:-1};
  if(($('#stage').classList.contains('open') || prefs.layout==='fit') && pageKeys[e.key] && !document.body.classList.contains('modal') || ($('#stage').classList.contains('open') && pageKeys[e.key])){ e.preventDefault(); turnPage(pageKeys[e.key]); return; }
  if($('#stage').classList.contains('open')){ if(e.key===' '){ e.preventDefault(); scrollOn?stopScroll():startScroll(); } else if(e.key==='+'||e.key==='=') stageFont(prefs.stageFont+2); else if(e.key==='-') stageFont(prefs.stageFont-2); return; }
  if(!cur || document.body.classList.contains('modal') || /input|select|textarea/i.test(e.target.tagName)) return;
  if(e.key===' '){ e.preventDefault(); metro.toggle(); } else if(e.key==='p') pad.toggle();
  else if(e.key==='ArrowUp'){ bpm++; updateBpm(); } else if(e.key==='ArrowDown'){ bpm--; updateBpm(); } });
document.addEventListener('visibilitychange',()=>{ if(!document.hidden && AC && AC.state==='suspended' && (metro.on||pad.on)) AC.resume(); });

/* ================= init ================= */
renderProfileBtn(); renderList(); drawBeats(-1); setView(store.get('view','songs'));
if(!checkSharedPlaylist()){ const m=/^#m([\w]+)/.exec(location.hash); if(m){ history.replaceState({id:m[1]},'',location.hash); openSong(m[1],false); } }
if('serviceWorker' in navigator && location.protocol==='https:') navigator.serviceWorker.register('sw.js').catch(()=>{});
})();
