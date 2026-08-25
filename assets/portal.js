/* ============================================================================
 * Adeptio Incident Trace · PORTAL engine (page 3)
 *
 * A deliberately small ticketing surface: board + list + detail + create, over
 * window.ADEPTIO_TICKETS. Everything is mock. Edits persist to localStorage
 * under "adeptio_tickets_v1" and fall back to an in-memory store when storage
 * is unavailable (file:// in some browsers, private mode, quota).
 *
 * Scope follows the micro-platform recommendation: ONE priority axis, three
 * status categories, no SLA timers, no JQL, no workflow config.
 * ==========================================================================*/
(function(){
"use strict";

const SEED  = window.ADEPTIO_TICKETS || {project:'INC', now:0, tickets:[], byWindow:{}};
const DATA  = window.ADEPTIO_DATA || {};
const RCA   = window.ADEPTIO_RCA  || {nodes:{}};
const INC   = DATA.INC || {};
const NODES = DATA.NODES || [];
const DAY   = DATA.DAY || 288, STEP = DATA.STEP_MIN || 5, N = DATA.N || 2016;
const NOW   = SEED.now || (N-1);
const STORE_KEY = 'adeptio_tickets_v1';

/* ---------- timeline-index time helpers (same maths as the dashboard) ----
 * v2.0.1 calendar labels: the demo week is WK34 of 2027, Mon Aug 23 -> Sun Aug 29.
 * dstamp()'s day index is 1-based — i runs 0..2015 and d = floor(i/DAY)+1 lands in
 * 1..7 — so day d reads from DAY_LBL[d-1]. Stamps carry NO year; the year is
 * stated once in the page header. data/manifest.js publishes ADEPTIO_DATA.WEEK;
 * the literal below is the fallback so the portal labels correctly on its own. */
const WEEK    = DATA.WEEK || null;
const DAY_LBL = (WEEK && WEEK.days && WEEK.days.length===7) ? WEEK.days
              : ['Aug 23','Aug 24','Aug 25','Aug 26','Aug 27','Aug 28','Aug 29'];
function dayLabel(d){ return DAY_LBL[d-1] || DAY_LBL[0]; }
function dstamp(i){ const d=Math.floor(i/DAY)+1, m=(i%DAY)*STEP;
  return dayLabel(d)+' '+String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0'); }
function rel(i){ const mins=Math.max(0,(NOW-i))*STEP;
  if(mins<1) return 'just now';
  if(mins<60) return mins+'m ago';
  const h=Math.round(mins/60); if(h<24) return h+'h ago';
  const d=Math.round(mins/1440); return d+'d ago'; }

/* ---------- small utilities ---------------------------------------------- */
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function el(id){ return document.getElementById(id); }
/* Myanmar honorifics are prefixes, but "Ko" and "Ma" are also ordinary name
   syllables (U Aung Ko Ko) — so strip only from the FRONT, and never strip the
   whole name away. */
const HONORIFIC=/^(u|daw|ko|ma|sayar|mg)$/i;
function initials(name){
  const words=String(name||'?').trim().split(/\s+/);
  let i=0; while(i<words.length-1 && HONORIFIC.test(words[i])) i++;
  const src=words.slice(i);
  return (src.slice(0,2).map(w=>w[0]||'').join('')||'?').toUpperCase();
}
function nodeName(id){ const n=NODES.find(x=>x.id===id); return n?n.name:id; }

/* ---------- Jira-convention presentation --------------------------------- */
const STATUSES=[{k:'todo',label:'To Do'},{k:'inprog',label:'In Progress'},{k:'done',label:'Done'}];
const SLABEL={todo:'To Do',inprog:'In Progress',done:'Done'};
const PRIOS=[{k:'highest',label:'Highest'},{k:'high',label:'High'},{k:'medium',label:'Medium'},{k:'low',label:'Low'}];
const PLABEL={highest:'Highest',high:'High',medium:'Medium',low:'Low'};
/* chevron set: up for Highest/High, neutral bar for Medium, down for Low —
   shape carries the meaning, colour only reinforces it. */
function prioIcon(p){
  const c={highest:'var(--crit)',high:'var(--warn)',medium:'var(--warn)',low:'var(--maint)'}[p]||'var(--unk)';
  const body={
    highest:'<path d="M4 12l6-6 6 6M4 17l6-6 6 6"/>',
    high:'<path d="M4 15l6-6 6 6"/>',
    medium:'<path d="M4 8h12M4 14h12"/>',
    low:'<path d="M4 8l6 6 6-6"/>'
  }[p]||'<path d="M4 11h12"/>';
  return '<svg class="p-pri" viewBox="0 0 20 20" fill="none" stroke="'+c+'" stroke-width="2.4" '+
         'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+body+'</svg>';
}
const TYPEC={incident:'var(--crit)',bug:'var(--warn)',task:'var(--maint)'};
function typeIcon(t){ return '<span class="p-ty" title="'+esc(t)+'" style="background:'+(TYPEC[t]||'var(--unk)')+'"></span>'; }
function lozenge(s){ return '<span class="p-lz '+s+'">'+esc(SLABEL[s]||s)+'</span>'; }
function avatar(name,title){ return '<span class="p-av" title="'+esc(title||name||'Unassigned')+'">'+esc(initials(name))+'</span>'; }

/* ---------- assignee roster, straight from data/rcameta.js --------------- */
const ROSTER=(function(){
  const seen={}, out=[];
  Object.keys(RCA.nodes||{}).forEach(id=>{ const o=(RCA.nodes[id]||{}).owner; if(!o||!o.name)return;
    if(seen[o.name])return; seen[o.name]=1; out.push({name:o.name,team:o.team||''}); });
  SEED.tickets.forEach(t=>{ const a=t.assignee; if(a&&a.name&&!seen[a.name]){ seen[a.name]=1; out.push({name:a.name,team:a.team||''}); } });
  out.sort((a,b)=>a.team.localeCompare(b.team)||a.name.localeCompare(b.name));
  return out;
})();

/* ---------- state + persistence ------------------------------------------ */
const FINGERPRINT = SEED.tickets.length+':'+SEED.tickets.map(t=>t.key).join(',');
let STORAGE_OK=true, MEM=null;                 // MEM = session fallback
function storeRead(){
  try{ const raw=window.localStorage.getItem(STORE_KEY); return raw?JSON.parse(raw):null; }
  catch(e){ STORAGE_OK=false; return MEM; }
}
function storeWrite(obj){
  try{ window.localStorage.setItem(STORE_KEY,JSON.stringify(obj)); }
  catch(e){ STORAGE_OK=false; MEM=obj; }
}
function storeClear(){ try{ window.localStorage.removeItem(STORE_KEY); }catch(e){ STORAGE_OK=false; } MEM=null; }

function seedClone(){ return JSON.parse(JSON.stringify(SEED.tickets)); }
let TICKETS=(function(){
  const saved=storeRead();
  if(saved && saved.fp===FINGERPRINT && Array.isArray(saved.tickets)) return saved.tickets;
  return seedClone();
})();
function persist(){ storeWrite({v:1, fp:FINGERPRINT, tickets:TICKETS}); }

const UI={view:'board', filter:'all', q:'', open:null};
function get(key){ return TICKETS.find(t=>t.key===key); }

/* ---------- filtering ----------------------------------------------------- */
const FILTERS={
  all:      ()=>true,
  open:     t=>t.status!=='done',
  critical: t=>t.priority==='highest',
  major:    t=>!!t.major,
  incidents:t=>t.type==='incident',
  tasks:    t=>t.type!=='incident'
};
function visible(){
  const f=FILTERS[UI.filter]||FILTERS.all, q=UI.q.trim().toLowerCase();
  return TICKETS.filter(t=>{
    if(!f(t)) return false;
    if(!q) return true;
    return (t.key+' '+t.summary).toLowerCase().indexOf(q)>=0;
  });
}
function countsRefresh(){
  document.querySelectorAll('.p-chip .n').forEach(s=>{
    const f=FILTERS[s.dataset.c]||FILTERS.all; s.textContent=TICKETS.filter(f).length; });
}

/* ---------- board --------------------------------------------------------- */
const CATCOL={todo:'var(--jtodo)',inprog:'var(--jprog)',done:'var(--jdone)'};
function cardHTML(t){
  const labels=(t.labels||[]).slice(0,3).map(l=>'<span class="p-lbl">'+esc(l)+'</span>').join('');
  return '<article class="p-card" tabindex="0" data-key="'+esc(t.key)+'">'+
    '<div class="top">'+prioIcon(t.priority)+typeIcon(t.type)+
      '<span class="p-key">'+esc(t.key)+'</span>'+
      (t.major?'<span class="p-major">MAJOR</span>':'')+'</div>'+
    '<p class="sm">'+esc(t.summary)+'</p>'+
    '<div class="bot">'+labels+'<span class="sp"></span>'+
      '<span class="up">'+esc(rel(t.updated))+'</span>'+
      avatar(t.assignee&&t.assignee.name, (t.assignee?t.assignee.name+' — '+t.assignee.team:'Unassigned'))+
    '</div></article>';
}
function boardHTML(rows){
  return '<div class="p-board">'+STATUSES.map(st=>{
    const mine=rows.filter(t=>t.status===st.k);
    return '<section class="p-col" data-col="'+st.k+'">'+
      '<div class="p-colh"><span class="dot" style="background:'+CATCOL[st.k]+'"></span>'+
        '<span class="nm">'+esc(st.label)+'</span><span class="c">'+mine.length+'</span></div>'+
      '<div class="p-cards">'+(mine.map(cardHTML).join('')||
        '<div class="p-empty" style="padding:18px 8px;font-size:11.5px">Nothing here</div>')+'</div></section>';
  }).join('')+'</div>';
}
function listHTML(rows){
  if(!rows.length) return '<div class="p-list"><div class="p-empty">No tickets match this filter.</div></div>';
  return '<div class="p-list"><table><thead><tr>'+
    '<th style="width:96px">Key</th><th>Summary</th><th style="width:118px">Status</th>'+
    '<th style="width:96px">Priority</th><th style="width:150px">Assignee</th><th style="width:88px">Updated</th>'+
    '</tr></thead><tbody>'+rows.map(t=>
      '<tr data-key="'+esc(t.key)+'" tabindex="0">'+
      '<td><span class="p-key">'+esc(t.key)+'</span></td>'+
      '<td class="sm">'+typeIcon(t.type)+' '+esc(t.summary)+(t.major?' <span class="p-major">MAJOR</span>':'')+'</td>'+
      '<td>'+lozenge(t.status)+'</td>'+
      '<td class="mut">'+prioIcon(t.priority)+' '+esc(PLABEL[t.priority]||t.priority)+'</td>'+
      '<td>'+avatar(t.assignee&&t.assignee.name)+' <span class="mut" style="font-size:11px">'+
        esc((t.assignee&&t.assignee.name)||'Unassigned')+'</span></td>'+
      '<td class="mut">'+esc(rel(t.updated))+'</td></tr>').join('')+
    '</tbody></table></div>';
}
function render(){
  const rows=visible().slice().sort((a,b)=>b.updated-a.updated);
  el('main').innerHTML = UI.view==='board' ? boardHTML(rows) : listHTML(rows);
  el('shown').textContent = rows.length+' of '+TICKETS.length+' shown';
  countsRefresh();
  wireRows();
}

/* ---------- row / card wiring incl. drag-to-transition --------------------
 * Pointer events rather than HTML5 drag-and-drop: HTML5 DnD does not exist on
 * touch devices and is awkward to drive from a test harness, and we need none
 * of its cross-window plumbing. Below the movement threshold a press is just a
 * click, so cards stay keyboard- and tap-friendly. */
const DRAG_THRESH=5;
let drag=null;
function wireRows(){
  document.querySelectorAll('.p-list tbody tr').forEach(node=>{
    node.addEventListener('click',()=>openDetail(node.dataset.key));
    node.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); openDetail(node.dataset.key); } });
  });
  document.querySelectorAll('.p-card').forEach(c=>{
    c.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); openDetail(c.dataset.key); } });
    c.addEventListener('pointerdown',onDown);
  });
}
function onDown(e){
  if(e.button!==0 || (e.target.closest && e.target.closest('a,button'))) return;
  const card=e.currentTarget;
  drag={key:card.dataset.key, card:card, x0:e.clientX, y0:e.clientY, moved:false, ghost:null, col:null};
  window.addEventListener('pointermove',onMove);
  window.addEventListener('pointerup',onUp,{once:true});
  window.addEventListener('pointercancel',onUp,{once:true});
}
function beginDrag(e){
  drag.moved=true; document.body.style.userSelect='none';
  const r=drag.card.getBoundingClientRect();
  const g=drag.card.cloneNode(true);
  g.classList.add('p-ghostcard');
  g.style.cssText='position:fixed;left:'+r.left+'px;top:'+r.top+'px;width:'+r.width+'px;'+
    'pointer-events:none;z-index:80;margin:0';
  document.body.appendChild(g);
  drag.ghost=g; drag.dx=e.clientX-r.left; drag.dy=e.clientY-r.top;
  drag.card.classList.add('drag');
}
function onMove(e){
  if(!drag) return;
  if(!drag.moved){
    if(Math.abs(e.clientX-drag.x0)<DRAG_THRESH && Math.abs(e.clientY-drag.y0)<DRAG_THRESH) return;
    beginDrag(e);
  }
  drag.ghost.style.left=(e.clientX-drag.dx)+'px';
  drag.ghost.style.top =(e.clientY-drag.dy)+'px';
  const under=document.elementFromPoint(e.clientX,e.clientY);
  const col=(under&&under.closest)?under.closest('.p-col'):null;
  if(col!==drag.col){
    if(drag.col) drag.col.classList.remove('over');
    drag.col=col; if(col) col.classList.add('over');
  }
}
function onUp(){
  window.removeEventListener('pointermove',onMove);
  if(!drag) return;
  const d=drag; drag=null;
  document.body.style.userSelect='';
  if(d.ghost) d.ghost.remove();
  d.card.classList.remove('drag');
  if(d.col) d.col.classList.remove('over');
  if(!d.moved){ openDetail(d.key); return; }
  if(d.col && d.col.dataset.col) setStatus(d.key,d.col.dataset.col);
}

/* ---------- mutations ----------------------------------------------------- */
function touch(t,what){ t.updated=NOW; (t.history=t.history||[]).push({at:NOW,what:what}); }
function setStatus(key,st){
  const t=get(key); if(!t||t.status===st||!SLABEL[st]) return;
  const from=SLABEL[t.status]; t.status=st;
  touch(t,'You changed status '+from+' to '+SLABEL[st]);
  persist(); render(); if(UI.open===key) renderDetail();
}
function setField(key,field,value,label){
  const t=get(key); if(!t||t[field]===value) return;
  const before=label?label(t[field]):t[field]; t[field]=value;
  touch(t,'You changed '+field+' '+before+' to '+(label?label(value):value));
  persist(); render(); renderDetail();
}
function setAssignee(key,name){
  const t=get(key); if(!t) return;
  const person=ROSTER.find(p=>p.name===name);
  const before=(t.assignee&&t.assignee.name)||'Unassigned';
  t.assignee = person?{name:person.name,team:person.team}:null;
  if(before===(person?person.name:'Unassigned')) return;
  touch(t,'You assigned '+(person?person.name:'nobody')+' (was '+before+')');
  persist(); render(); renderDetail();
}
function addComment(key,text){
  const t=get(key); if(!t||!text.trim()) return;
  (t.comments=t.comments||[]).push({who:'You',at:NOW,text:text.trim()});
  t.updated=NOW; persist(); render(); renderDetail();
  const box=el('detailbox').querySelector('.p-act'); if(box) box.scrollIntoView({block:'end'});
}

/* ---------- detail overlay ------------------------------------------------ */
let hashGuard=false;
function openDetail(key){
  if(!get(key)) return;
  UI.open=key; el('detail').classList.add('on'); renderDetail();
  hashGuard=true; try{ location.hash=key; }catch(e){} setTimeout(()=>hashGuard=false,0);
}
function closeDetail(){
  UI.open=null; el('detail').classList.remove('on'); el('detailbox').innerHTML='';
  hashGuard=true;
  try{ history.replaceState(null,'',location.pathname+location.search); }
  catch(e){ location.hash=''; }
  setTimeout(()=>hashGuard=false,0);
}
/* deep link into the dashboard: an incident ticket points at its window peak,
   anything else at the moment it was last touched */
function dashHref(t){
  const w=t.incKey&&INC[t.incKey];
  const idx=w?(w.length===3?w[1]:w[1]):t.updated;
  return 'index.html#t='+idx;
}
function activityHTML(t){
  const evs=[]
    .concat((t.comments||[]).map(c=>({at:c.at,kind:'c',who:c.who,text:c.text})))
    .concat((t.history||[]).map(h=>({at:h.at,kind:'h',text:h.what})));
  evs.sort((a,b)=>a.at-b.at||(a.kind==='h'?-1:1));      // newest last
  if(!evs.length) return '<div class="p-desc" style="color:var(--muted)">No activity yet.</div>';
  return '<div class="p-act">'+evs.map(e=>e.kind==='c'
    ? '<div class="p-ev">'+avatar(e.who)+'<div class="bd"><span class="who">'+esc(e.who)+
      '</span><span class="when">'+esc(rel(e.at))+' &middot; '+esc(dstamp(e.at))+
      '</span><div class="tx">'+esc(e.text)+'</div></div></div>'
    : '<div class="p-ev hist"><span class="p-av">&#9679;</span><div class="bd"><div class="tx">'+
      esc(e.text)+' <span class="when">'+esc(dstamp(e.at))+'</span></div></div></div>'
  ).join('')+'</div>';
}
function renderDetail(){
  const t=get(UI.open); if(!t){ closeDetail(); return; }
  const links=(t.links||[]).map(l=>{ const o=get(l.key); if(!o) return '';
    return '<div class="p-lrow" data-goto="'+esc(l.key)+'"><span class="p-rel">'+esc(l.rel)+'</span>'+
      typeIcon(o.type)+'<span class="p-key">'+esc(o.key)+'</span>'+
      '<span class="sm">'+esc(o.summary)+'</span>'+lozenge(o.status)+'</div>'; }).join('');

  el('detailbox').innerHTML=
  '<div class="p-mh"><span class="crumb">'+esc(SEED.name||'Incidents')+' / </span>'+
    '<span class="p-key">'+esc(t.key)+'</span>'+typeIcon(t.type)+
    '<span class="crumb">'+esc(t.type)+'</span>'+(t.major?'<span class="p-major">MAJOR INCIDENT</span>':'')+
    '<span class="sp"></span><button class="p-x" id="dx" title="Close (Esc)">&#10005;</button></div>'+
  '<div class="p-two"><div class="p-left">'+
    '<h1 class="p-h1">'+esc(t.summary)+'</h1>'+
    '<div class="p-sec">Description</div><p class="p-desc">'+esc(t.desc)+'</p>'+
    (links?'<div class="p-sec">Linked issues</div><div class="p-links">'+links+'</div>':'')+
    '<div class="p-sec">Activity</div>'+activityHTML(t)+
    '<div class="p-comp">'+avatar('You')+
      '<textarea id="cbox" placeholder="Add a comment&hellip;" aria-label="Add a comment"></textarea></div>'+
    '<div class="p-comprow"><button class="p-create" id="csave">Comment</button></div>'+
  '</div><div class="p-right">'+
    '<div class="p-fld"><label for="fStatus">Status</label><select id="fStatus">'+
      STATUSES.map(s=>'<option value="'+s.k+'"'+(t.status===s.k?' selected':'')+'>'+s.label+'</option>').join('')+
    '</select></div>'+
    '<div class="p-fld"><label for="fPrio">Priority</label><select id="fPrio">'+
      PRIOS.map(p=>'<option value="'+p.k+'"'+(t.priority===p.k?' selected':'')+'>'+p.label+'</option>').join('')+
    '</select></div>'+
    '<div class="p-fld"><label for="fAss">Assignee</label><select id="fAss">'+
      '<option value="">Unassigned</option>'+
      ROSTER.map(p=>'<option value="'+esc(p.name)+'"'+((t.assignee&&t.assignee.name===p.name)?' selected':'')+'>'+
        esc(p.name)+' &mdash; '+esc(p.team)+'</option>').join('')+
    '</select></div>'+
    '<div class="p-fld"><label>Reporter</label><div class="p-fv">'+avatar(t.reporter)+esc(t.reporter||'—')+'</div></div>'+
    '<div class="p-fld"><label>Labels</label><div class="p-labels">'+
      ((t.labels||[]).map(l=>'<span class="p-lbl">'+esc(l)+'</span>').join('')||'<span class="p-fv mut">None</span>')+
    '</div></div>'+
    '<div class="p-fld"><label>Object</label>'+
      '<a class="p-nodechip" href="'+dashHref(t)+'">'+esc(nodeName(t.node))+' &middot; view on dashboard &rarr;</a>'+
    '</div>'+
    '<div class="p-dates">Created &nbsp;'+esc(rel(t.created))+' &nbsp;<span style="opacity:.7">('+esc(dstamp(t.created))+')</span><br/>'+
      'Updated &nbsp;'+esc(rel(t.updated))+' &nbsp;<span style="opacity:.7">('+esc(dstamp(t.updated))+')</span></div>'+
  '</div></div>';

  el('dx').onclick=closeDetail;
  el('fStatus').onchange=e=>setStatus(t.key,e.target.value);
  el('fPrio').onchange=e=>setField(t.key,'priority',e.target.value,v=>PLABEL[v]||v);
  el('fAss').onchange=e=>setAssignee(t.key,e.target.value);
  el('csave').onclick=()=>{ const b=el('cbox'); addComment(t.key,b.value); };
  el('detailbox').querySelectorAll('[data-goto]').forEach(r=>r.onclick=()=>openDetail(r.dataset.goto));
}

/* ---------- create -------------------------------------------------------- */
function nextKey(){
  let max=0; TICKETS.forEach(t=>{ const m=/-(\d+)$/.exec(t.key); if(m) max=Math.max(max,+m[1]); });
  return (SEED.project||'INC')+'-'+(max+1);
}
function openCreate(){
  el('createbox').innerHTML=
  '<div class="p-mh"><span class="crumb">'+esc(SEED.name||'Incidents')+' / </span><b style="font-size:13px">Create</b>'+
    '<span class="sp"></span><button class="p-x" id="nx" title="Close (Esc)">&#10005;</button></div>'+
  '<div style="padding:16px 18px">'+
    '<div class="p-fld"><label for="nType">Type</label><select id="nType">'+
      '<option value="incident">Incident</option><option value="task" selected>Task</option><option value="bug">Bug</option>'+
    '</select></div>'+
    '<div class="p-fld"><label for="nSum">Summary</label><input id="nSum" placeholder="One line — what is wrong or what needs doing"/></div>'+
    '<div class="p-fld"><label for="nPrio">Priority</label><select id="nPrio">'+
      PRIOS.map(p=>'<option value="'+p.k+'"'+(p.k==='medium'?' selected':'')+'>'+p.label+'</option>').join('')+
    '</select></div>'+
    '<div class="p-fld"><label for="nAss">Assignee</label><select id="nAss"><option value="">Unassigned</option>'+
      ROSTER.map(p=>'<option value="'+esc(p.name)+'">'+esc(p.name)+' &mdash; '+esc(p.team)+'</option>').join('')+
    '</select></div>'+
    '<div class="p-fld"><label for="nDesc">Description</label><textarea id="nDesc" rows="5" placeholder="Context, evidence, what you already checked"></textarea></div>'+
    '<div class="p-comprow"><button class="p-ghost" id="ncancel">Cancel</button><button class="p-create" id="ncreate">Create</button></div>'+
  '</div>';
  el('createwrap').classList.add('on');
  el('nx').onclick=closeCreate; el('ncancel').onclick=closeCreate;
  el('ncreate').onclick=doCreate;
  setTimeout(()=>{ const s=el('nSum'); if(s)s.focus(); },30);
}
function closeCreate(){ el('createwrap').classList.remove('on'); el('createbox').innerHTML=''; }
function doCreate(){
  const sum=el('nSum').value.trim();
  if(!sum){ el('nSum').focus(); el('nSum').style.borderColor='var(--crit)'; return; }
  const name=el('nAss').value, person=ROSTER.find(p=>p.name===name);
  const t={ key:nextKey(), type:el('nType').value, major:false, status:'todo',
    priority:el('nPrio').value, summary:sum, desc:el('nDesc').value.trim()||'(no description)',
    assignee:person?{name:person.name,team:person.team}:null, reporter:'You', labels:[],
    incKey:null, node:null, created:NOW, updated:NOW,
    comments:[], history:[{at:NOW,what:'You created the work item'}], links:[] };
  TICKETS.push(t); persist(); closeCreate(); render(); openDetail(t.key);
}

/* ---------- chrome wiring ------------------------------------------------- */
el('vBoard').onclick=()=>{ UI.view='board'; el('vBoard').classList.add('on'); el('vList').classList.remove('on');
  el('vBoard').setAttribute('aria-selected','true'); el('vList').setAttribute('aria-selected','false'); render(); };
el('vList').onclick=()=>{ UI.view='list'; el('vList').classList.add('on'); el('vBoard').classList.remove('on');
  el('vList').setAttribute('aria-selected','true'); el('vBoard').setAttribute('aria-selected','false'); render(); };
document.querySelectorAll('.p-chip').forEach(c=>c.onclick=()=>{
  UI.filter=c.dataset.f;
  document.querySelectorAll('.p-chip').forEach(x=>x.classList.toggle('on',x===c)); render(); });
el('q').addEventListener('input',e=>{ UI.q=e.target.value; render(); });
el('createbtn').onclick=openCreate;
el('resetbtn').onclick=()=>{ storeClear(); TICKETS=seedClone(); persist(); closeDetail(); render(); };
/* v2.0.2: #themebtn lives inside .p-top, which the shell hides once mounted
   (the shell owns theme now — assets/incident-trace.html <style>, rule 2).
   The button and this binding still work fine stand-alone / pre-mount; this
   guard only protects against a build where #themebtn is absent from the DOM
   entirely, so this line can never throw either way. */
if(el('themebtn')){
  el('themebtn').onclick=()=>{ const c=document.documentElement.getAttribute('data-theme');
    const nx=c==='dark'?'light':'dark'; document.documentElement.setAttribute('data-theme',nx);
    el('themebtn').textContent = nx==='dark'?'Light':'Dark'; };
}

document.addEventListener('keydown',e=>{ if(e.key!=='Escape')return;
  if(el('createwrap').classList.contains('on')) closeCreate();
  else if(UI.open) closeDetail(); });
[['detail',closeDetail],['createwrap',closeCreate]].forEach(([id,fn])=>{
  el(id).addEventListener('mousedown',e=>{ if(e.target===el(id)) fn(); }); });

/* deep link: incident-trace.html#INC-1030 */
function fromHash(){
  const k=decodeURIComponent((location.hash||'').replace(/^#/,'')).trim().toUpperCase();
  if(k && get(k)) openDetail(k); }
window.addEventListener('hashchange',()=>{ if(hashGuard)return; const k=(location.hash||'').replace(/^#/,'');
  if(!k){ if(UI.open) closeDetail(); } else fromHash(); });

/* boot */
render();
fromHash();
if(!STORAGE_OK) el('storenote').innerHTML=' <b>Storage unavailable in this browser context</b> &mdash; '+
  'edits are kept for this session only and will be lost on reload.';

/* small surface for the QA harness */
window.ADEPTIO_PORTAL={ get tickets(){return TICKETS;}, get:get, setStatus:setStatus, openDetail:openDetail,
  closeDetail:closeDetail, render:render, storageOk:()=>STORAGE_OK, seedCount:SEED.tickets.length,
  byWindow:SEED.byWindow, ui:UI };
})();
