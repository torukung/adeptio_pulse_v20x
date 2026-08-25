/* ============================================================================
 * ADEPTIO Pulse — Flow Inspection : Mobile Payment Module · ENGINE
 * Rendering / interaction / tables / timeline. Identical to the single-file
 * build except for ONE thing: series are not generated at boot — they are read
 * from window.ADEPTIO_LOGS (data/log_day1.js … log_day7.js) and stitched into
 * the same o.vals[] / o.stat[] arrays the renderer has always consumed.
 * gen() is kept below as a SEEDED fallback: if ADEPTIO_LOGS is missing the engine
 * regenerates the identical canonical week from ADEPTIO_SEED and the banner is
 * tagged "seeded replay". Both modes therefore produce byte-identical series —
 * the log files are simply a materialised copy of the seeded output.
 * Load order: data/manifest.js → data/log_day*.js (optional) → assets/engine.js
 * ==========================================================================*/
"use strict";

/* ===================== MODEL — SEVEN DAYS ===================== */
const D_ = window.ADEPTIO_DATA;
if(!D_) throw new Error('ADEPTIO_DATA missing — load data/manifest.js before assets/engine.js');
const N = D_.N, STEP_MIN = D_.STEP_MIN, DAY = D_.DAY;
const INC = D_.INC, INCMETA = D_.INCMETA, NODES = D_.NODES, LINKS = D_.LINKS;
const C_DEFAULT_NODE = D_.TABLE_DEFAULTS.cNode, C_DEFAULT_WIN = D_.TABLE_DEFAULTS.cWin;
const A_DEFAULT_WIN  = D_.TABLE_DEFAULTS.aWin;

/* E4: labels are derived from the timeline INDEX, not a real clock — the mock week
   is WK34, Aug 23 – 29, 2027, so index 0 is Aug 23 00:00. Stamps carry no year:
   the year appears once per screen, in the header range. dayOf() is 1-based, so
   the label array is indexed with dayOf(i)-1. data/manifest.js publishes the list
   as ADEPTIO_DATA.WEEK.days; the literal is the fallback. */
const DAY_LBL = (D_.WEEK && D_.WEEK.days && D_.WEEK.days.length===7) ? D_.WEEK.days
  : ['Aug 23','Aug 24','Aug 25','Aug 26','Aug 27','Aug 28','Aug 29'];
function dayOf(i){ return Math.floor(i/DAY)+1; }
function hm(i){ const m=(i%DAY)*STEP_MIN; return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0'); }
function dstamp(i){ return DAY_LBL[dayOf(i)-1]+' '+hm(i); }
/* v2.0.1: an incident window is IDENTIFIED in UI text as
   "WK34 · Incident <letter> — <name>". The INC / INCMETA object keys stay single
   letters — only the rendered name gains the week + letter prefix. */
const WK_LBL = (D_.WEEK && D_.WEEK.wk) || 'WK34';
function incName(k){ return WK_LBL+' · Incident '+k+' — '+INCMETA[k][0]; }
function win(t,a,peak,b){ if(t<=a||t>=b) return 0; return t<=peak?(t-a)/(peak-a):(b-t)/(b-peak); }
function ramp(t,a,b){ if(t<=a) return 0; if(t>=b) return 1; return (t-a)/(b-a); }
/* ---------- SEEDED PRNG ----------------------------------------------------
 * All series-generation randomness runs through here. mulberry32 seeded from a
 * fixed constant makes the fallback generator fully deterministic: every load
 * rebuilds the SAME canonical week, so seeded replay == the materialised logs.
 * Each series re-seeds from ADEPTIO_SEED mixed with its own key, so a series is
 * independent of generation order (a partially-missing log set still matches). */
const ADEPTIO_SEED = 20260815;
function mulberry32(a){ return function(){ a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function keySeed(key){ let h=ADEPTIO_SEED>>>0; for(let i=0;i<key.length;i++){ h=Math.imul(h^key.charCodeAt(i),16777619)>>>0; } return h; }
let RNG = mulberry32(ADEPTIO_SEED);
function rnd(n){ return (RNG()-0.5)*n; }
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }

// E2: window shape is inferred from its length — no per-key special cases.
function sevAt(k,t){ const w=INC[k]; if(!w) return 0; return w.length===2 ? ramp(t,w[0],w[1]) : win(t,w[0],w[1],w[2]); }

/* ---------- SEEDED generator (only runs when ADEPTIO_LOGS is absent) ----------
 * E3: o.inc is either a legacy key string (amplitude = o.amp) or {incidentKey: amplitude};
 * multi takes the MAX displacement. Produces exactly the shape the log files ship. */
function gen(o,key){
  RNG = mulberry32(keySeed(key||''));
  const vals=[], stat=[], inc=o.inc, multi = inc!==null && typeof inc==='object';
  for(let t=0;t<N;t++){
    let d=0;
    if(multi){ for(const k in inc){ const x=sevAt(k,t)*inc[k]; if(x>d) d=x; } }
    else if(inc){ d=sevAt(inc,t)*o.amp; }
    let v=o.base+rnd(o.noise)+(o.dir==='hi'?d:-d);
    if(o.min!=null)v=Math.max(o.min,v); if(o.max!=null)v=Math.min(o.max,v);
    v=o.int?Math.round(v):Math.round(v*100)/100; vals.push(v);
    let s = o.dir==='hi' ? (v>=o.crit?'crit':v>=o.warn?'warn':'ok') : (v<=o.crit?'crit':v<=o.warn?'warn':'ok');
    stat.push(s);
  }
  return {vals,stat};
}
const rank={ok:0,warn:1,crit:2,unk:3};
const worse=(a,b)=>rank[a]>=rank[b]?a:b;

/* ---------- SERIES HYDRATION — stitch day slices into full-week arrays ----------
 * Each data/log_dayK.js sets window.ADEPTIO_LOGS.dK = { "<nodeId>.<objIndex>":
 * {vals:[288], stat:[288]}, …, "KPI":{vals,stat} }. Concatenating d1..d7 in
 * order yields the 2016-step arrays. Point this at a real feed by publishing the
 * same object shape (same keys, same per-day length) — nothing else changes. */
const LOG_DAYS = 7;
function collectLogs(){
  const L = window.ADEPTIO_LOGS; if(!L) return null;
  const days = [];
  for(let d=1; d<=LOG_DAYS; d++){ const s=L['d'+d]; if(!s) return null; days.push(s); }
  return days;
}
function stitch(days, key){
  const vals=[], stat=[];
  for(let d=0; d<days.length; d++){
    const s = days[d][key]; if(!s) return null;
    for(let i=0;i<s.vals.length;i++){ vals.push(s.vals[i]); stat.push(s.stat[i]); }
  }
  return (vals.length===N) ? {vals,stat} : null;
}
const LOGDAYS = collectLogs();
let DATA_MODE = LOGDAYS ? 'frozen-logs' : 'seeded replay';
function series(key, def){
  if(LOGDAYS){ const s = stitch(LOGDAYS, key); if(s) return s; DATA_MODE='seeded replay'; }
  return gen(def, key);
}
/* RCA metadata (data/rcameta.js) — optional: the engine degrades to blank copy
   if it is absent, so the dashboard still runs from manifest + engine alone. */
const RCA = window.ADEPTIO_RCA || {nodes:{},indicators:{}};
function rcaNode(id){ return (RCA.nodes&&RCA.nodes[id])||null; }
function rcaInd(id,label){ return (RCA.indicators&&RCA.indicators[id+'.'+label])||null; }
function aboutDefault(id){ const m=rcaNode(id); return m&&m.desc?m.desc:''; }

NODES.forEach(n=>{ n.objs.forEach((o,i)=>{ const g=series(n.id+'.'+i,o); o.vals=g.vals; o.stat=g.stat; o.eps=episodes(o.stat); }); n.note=''; n.pinned=false; n.about=aboutDefault(n.id); });
const KPI = series('KPI', D_.KPI);
window.ADEPTIO_MODE = DATA_MODE;
/* materialised logs are the unmarked default; seeded regeneration says so in the
   banner — same week either way, so the tag is informational, not a warning */
const DATA_TAG = DATA_MODE==='seeded replay'
  ? ' <span style="color:var(--chipink);font-weight:650">· seeded replay</span>' : '';

const ALLOBJ=[]; NODES.forEach(n=>n.objs.forEach(o=>ALLOBJ.push({n,o})));
const ORIG=NODES.map(n=>({x:n.x,y:n.y}));

function episodes(stat){ const r=[]; let s=null; for(let i=0;i<stat.length;i++){ if(stat[i]!=='ok'){ if(!s)s={start:i,worst:stat[i],end:i}; else {s.worst=worse(s.worst,stat[i]);s.end=i;} } else if(s){r.push(s);s=null;} } if(s)r.push(s); return r; }
function nodeStatus(n,t){ let s='ok'; n.objs.forEach(o=>s=worse(s,o.stat[t])); return s; }
function statusColor(s){ return getComputedStyle(document.documentElement).getPropertyValue(s==='ok'?'--ok':s==='warn'?'--warn':s==='crit'?'--crit':'--unk').trim(); }
function byId(id){ return NODES.find(n=>n.id===id); }
function fmtVal(o,v){ return v+(o.unit==='%'?'%':' '+o.unit); }

/* icons */
const ICON={client:'<rect x="4" y="5" width="16" height="11" rx="1.5"/><path d="M9 20h6M12 16v4"/>',cloud:'<path d="M7 18a4 4 0 010-8 5 5 0 019.6-1.5A3.5 3.5 0 0117 18z"/>',shield:'<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',lb:'<circle cx="12" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/><path d="M12 8v3M12 11H6v5M12 11h6v5"/>',web:'<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c2.5 2.5 2.5 13 0 16M12 4c-2.5 2.5-2.5 13 0 16"/>',app:'<rect x="4" y="4" width="16" height="7" rx="1.5"/><rect x="4" y="13" width="16" height="7" rx="1.5"/><path d="M7 7.5h.01M7 16.5h.01"/>',gw:'<path d="M12 3l7 4v10l-7 4-7-4V7z"/><path d="M9 12h6M12 9v6"/>',mq:'<rect x="3" y="6" width="5" height="12" rx="1"/><rect x="10" y="6" width="5" height="12" rx="1"/><rect x="17" y="6" width="4" height="12" rx="1"/>',db:'<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/>',stor:'<rect x="3" y="5" width="18" height="5" rx="1.5"/><rect x="3" y="13" width="18" height="5" rx="1.5"/><path d="M7 7.5h.01M7 15.5h.01"/>',recon:'<path d="M4 12a8 8 0 0114-5.3M20 12a8 8 0 01-14 5.3"/><path d="M18 3v4h-4M6 21v-4h4"/>',link:'<path d="M9 15l6-6"/><path d="M8 8H6a4 4 0 000 8h2M16 16h2a4 4 0 000-8h-2"/>',bank:'<path d="M4 20h16M5 20V10M9 20V10M15 20V10M19 20V10M3 10l9-6 9 6z"/>',switch:'<rect x="3" y="8" width="18" height="8" rx="1.5"/><path d="M7 12h.01M11 12h.01M15 12h.01"/><path d="M6 8V6M18 16v2"/>',core:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 12l2.5 2.5L16 9"/>'};

/* ===================== RENDER ===================== */
const SVG='http://www.w3.org/2000/svg';
const vp=document.getElementById('viewport'),gLinks=document.getElementById('links'),gNodes=document.getElementById('nodes');
let cur=N-1, sel=null;
function mk(tag,a){ const e=document.createElementNS(SVG,tag); for(const k in a)e.setAttribute(k,a[k]); return e; }
function polar(cx,cy,r,ang){ const a=(ang-90)*Math.PI/180; return [cx+r*Math.cos(a),cy+r*Math.sin(a)]; }
function arcPath(cx,cy,r,a0,a1){ const [x0,y0]=polar(cx,cy,r,a1),[x1,y1]=polar(cx,cy,r,a0); const lg=a1-a0<=180?0:1; return `M${x0} ${y0} A${r} ${r} 0 ${lg} 0 ${x1} ${y1}`; }
const NR=24,RING=30;
function buildNodes(){ gNodes.innerHTML=''; NODES.forEach(n=>{ const g=mk('g',{class:'node','data-id':n.id,transform:`translate(${n.x},${n.y})`});
  g.appendChild(mk('circle',{class:'selring',r:RING+6,cx:0,cy:0,style:'display:none'}));
  g.appendChild(mk('g',{class:'arcs'}));
  g.appendChild(mk('circle',{class:'body',r:NR,cx:0,cy:0}));
  const ic=mk('g',{class:'ic',transform:'translate(-11,-11) scale(0.92)'}); ic.innerHTML=ICON[n.type]||ICON.app; g.appendChild(ic);
  const lbl=mk('text',{class:'lbl',x:0,y:RING+16}); lbl.textContent=n.name; g.appendChild(lbl);
  const ip=mk('text',{class:'ip',x:0,y:RING+29}); ip.textContent=n.ip; g.appendChild(ip);
  // third label line: how this object is polled / collected (data-driven, manifest .pm)
  if(n.pm){ const pm=mk('text',{class:'pm',x:0,y:RING+40}); pm.textContent=n.pm; g.appendChild(pm); }
  g.appendChild(mk('circle',{class:'notebadge',r:4,cx:NR-3,cy:-NR+3,style:'display:none'}));
  g.appendChild(mk('circle',{class:'pin',r:4,cx:-NR+3,cy:-NR+3,style:'display:none'}));
  gNodes.appendChild(g); n.el=g; }); }
function buildLinks(){ gLinks.innerHTML=''; LINKS.forEach(L=>{ const p=mk('path',{class:'link'}); gLinks.appendChild(p); L.el=p; }); }
function linkStatus(L,t){ return worse(nodeStatus(byId(L[0]),t),nodeStatus(byId(L[1]),t)); }
function paintLinksOnly(){ LINKS.forEach(L=>{ const a=byId(L[0]),b=byId(L[1]); L.el.setAttribute('d',`M${a.x} ${a.y} L${b.x} ${b.y}`); }); }

function paint(){
  const t=cur;
  LINKS.forEach(L=>{ const a=byId(L[0]),b=byId(L[1]); L.el.setAttribute('d',`M${a.x} ${a.y} L${b.x} ${b.y}`);
    const s=linkStatus(L,t),col=statusColor(s); L.el.setAttribute('stroke',col);
    L.el.setAttribute('stroke-width',s==='ok'?2+L[2]/28:s==='warn'?3.5:4.5); L.el.setAttribute('opacity',s==='ok'?0.5:0.95); L.el.classList.toggle('flow',s!=='ok'); });
  NODES.forEach(n=>{ const arcs=n.el.querySelector('.arcs'); arcs.innerHTML='';
    const k=n.objs.length,gap=k>1?10:0,seg=360/k;
    n.objs.forEach((o,i)=>{ arcs.appendChild(mk('path',{class:'arc',d:arcPath(0,0,RING,i*seg+gap/2,(i+1)*seg-gap/2),stroke:statusColor(o.stat[t])})); });
    const ns=nodeStatus(n,t);
    n.el.querySelector('.body').style.filter=ns==='crit'?'drop-shadow(0 0 7px '+statusColor('crit')+')':ns==='warn'?'drop-shadow(0 0 5px '+statusColor('warn')+')':'none';
    n.el.querySelector('.notebadge').style.display=n.note?'':'none';
    n.el.querySelector('.pin').style.display=n.pinned?'':'none';
  });
  paintSummary(); updateClock(); refreshPanes(); renderTables(); renderRCA();
}
function paintSummary(){ const t=cur; let ok=0,w=0,c=0; NODES.forEach(n=>{ const s=nodeStatus(n,t); if(s==='crit')c++;else if(s==='warn')w++;else ok++; });
  /* v2.0.2: bridge the live counts to the platform shell's topbar status pill
     when one is mounted — guarded/additive, coded against the v2.0.2 shell
     CONTRACT (PULSE_SHELL.status(ok,deg,crit), docs/SPEC-Shell-v2.0.2.md §4)
     so this is a silent no-op against a shell.js that doesn't have it yet.
     The engine keeps painting its own #summary chips below exactly as before. */
  if(window.PULSE_SHELL&&typeof PULSE_SHELL.status==='function') PULSE_SHELL.status(ok,w,c);
  const S=document.getElementById('summary'); S.innerHTML='';
  [['ok',ok,'OK'],['warn',w,'Degraded'],['crit',c,'Critical']].forEach(([k,v,l])=>{ const d=document.createElement('div'); d.className='scount';
    d.innerHTML=`<span class="dot" style="background:${statusColor(k)}"></span><b>${v}</b> <span class="lbl" style="color:var(--muted)">${l}</span>`; S.appendChild(d); });
  const kpi=KPI.vals[t],ks=KPI.stat[t]; const sc=document.getElementById('scbody');
  let active='',best=0;
  for(const k in INC){ const w=INC[k], open_ = w.length===2 ? t>=w[0] : (t>=w[0]&&t<=w[2]); if(!open_) continue;
    const sc=sevAt(k,t)*(INCMETA[k][1]==='crit'?2:1); if(sc>=best){ best=sc; active=k; } }
  // the minimised chip keeps reporting the strongest open window through its dot
  const chip=document.getElementById('scchip'),dot=document.getElementById('scchipdot');
  if(dot){ dot.style.background=statusColor(active?INCMETA[active][1]:'ok');
    chip.title='Scenario · '+(active?incName(active):'nominal')+' — click to expand'; }
  // strongest currently-open incident wins the banner headline
  sc.innerHTML=`<b>Mock scenario week</b> · 7-day replay${DATA_TAG}<br><span style="color:${statusColor(ks)}">●</span> Payment success <b>${kpi.toFixed(1)}%</b> · `+
    `<span style="color:${statusColor(c>0?'crit':w>0?'warn':'ok')}">${c} crit / ${w} deg</span>`+
    (active?` · <b style="color:${statusColor(INCMETA[active][1])}">${incName(active)}</b>`:` · <b style="color:var(--ok)">nominal</b>`)+
    `<br><span style="color:var(--muted);font-size:11px">Success = attempt → debit posted → biller credit confirmed in SLA — business + technical declines both count. Read beside volume: ~7.8k attempts/hr daytime (mock).</span>`+
    `<br><span style="color:var(--muted);font-size:11px">7-day replay · Aug 23 OTP dip · Aug 24 silent false-declines (replica lag) · Aug 25 one carrier, two symptoms · Aug 26–27 storage creep → Aug 27 19:00 CORE OUTAGE, full path red · Aug 28 LB pool loss + EOD overrun · Aug 29 aggregator brownout + deploy regression.</span>`;
  scheduleScFit();   // the copy above changes height at incident boundaries
}
function updateClock(){ document.getElementById('tlcur').textContent=dstamp(cur)+(cur===N-1?' · live':'');
  document.getElementById('tlstart').textContent=dstamp(0); document.getElementById('tlend').textContent=dstamp(N-1);
  document.getElementById('asof').textContent='as of '+dstamp(cur);
  const pct=cur/(N-1); document.getElementById('fill').style.width=(pct*100)+'%'; document.getElementById('head').style.left=(pct*100)+'%';
  document.getElementById('livedot').style.background=cur===N-1?statusColor('ok'):'var(--muted)';
  document.getElementById('brefresh').textContent='window ends '+dstamp(cur);
  /* v2.0.2: bridge freshness to the shell topbar's #pfresh when mounted —
     guarded/additive, same CONTRACT as the status bridge above. The hidden
     legacy #asof/#brefresh keep updating unconditionally (the single-file
     build depends on them). */
  if(window.PULSE_SHELL&&typeof PULSE_SHELL.fresh==='function') PULSE_SHELL.fresh('as of '+dstamp(cur));
}
/* F1 · FULL-SERIES SPARKLINE ---------------------------------------------------
 * The whole week is drawn at every t, so a graph is never empty before you press
 * play. Geometry is identical either side of the cursor; the stretch AFTER t is
 * ghosted (.3) and the stretch up to t is solid, with a 1px now-cursor + dot that
 * sweeps during playback. The numeric read-out beside it stays the value at t.
 *   opt.fluid → svg stretches to the container width (dock panes, RCA panel)
 *   opt.tint  → {start,end,sev} shades one episode region (incident popup)      */
function sparkline(o,w,h,opt){ opt=opt||{};
  const vals=o.vals,mn=Math.min(...vals),mx=Math.max(...vals),rg=(mx-mn)||1,dx=w/(N-1);
  const X=i=>+(i*dx).toFixed(1), Y=v=>+(h-((v-mn)/rg)*(h-4)-2).toFixed(1);
  let dAll='',dPast='';
  for(let i=0;i<N;i++){ const seg=(i?'L':'M')+X(i)+' '+Y(vals[i]); dAll+=seg; if(i<=cur)dPast+=seg; }
  const cx=X(cur),cy=Y(vals[cur]),col=statusColor(o.stat[cur]);
  let tint='';
  if(opt.tint){ const x0=X(clamp(opt.tint.start,0,N-1)),x1=X(clamp(opt.tint.end,0,N-1));
    tint=`<rect x="${x0}" y="0" width="${Math.max(1.5,+(x1-x0).toFixed(1))}" height="${h}" fill="${statusColor(opt.tint.sev||'warn')}" opacity="0.20"/>`; }
  const size=opt.fluid?`width="100%" height="${h}" preserveAspectRatio="none"`:`width="${w}" height="${h}"`;
  return `<svg class="spark" ${size} viewBox="0 0 ${w} ${h}">${tint}`+
    `<path d="${dAll}" fill="none" stroke="var(--muted)" stroke-width="1.1" opacity="0.3"/>`+
    `<path d="${dPast} L${cx} ${h} L0 ${h} Z" fill="${col}" opacity="0.10"/>`+
    `<path d="${dPast}" fill="none" stroke="var(--muted)" stroke-width="1.3" opacity="0.95"/>`+
    `<line x1="${cx}" y1="0" x2="${cx}" y2="${h}" stroke="${col}" stroke-width="1" opacity="0.8"/>`+
    `<circle cx="${cx}" cy="${cy}" r="2.4" fill="${col}"/></svg>`; }

/* hover card */
const hc=document.getElementById('hovercard'); let hoverTimer=null;
function showHover(n,evt){ clearTimeout(hoverTimer); hoverTimer=setTimeout(()=>{ const t=cur,ns=nodeStatus(n,t); let rows='';
  // F1: the hover card carries the same pre-populated full-week graph as the dock
  n.objs.forEach(o=>{ rows+=`<div class="hc-item"><div class="hc-row"><span class="sd" style="background:${statusColor(o.stat[t])}"></span><span class="k">${o.label}</span><span class="v">${fmtVal(o,o.vals[t])}</span></div>${sparkline(o,240,18,{fluid:true})}</div>`; });
  hc.innerHTML=`<div class="hc-h"><span class="sd" style="width:11px;height:11px;background:${statusColor(ns)}"></span><span class="nm">${n.name}</span><span class="pill" style="margin-left:auto;background:${statusColor(ns)}22;color:${statusColor(ns)}">${ns}</span></div><div style="color:var(--muted);font-size:10.5px;margin:-4px 0 6px">${n.ip} · ${dstamp(t)}</div>${rows}<div class="hc-foot">Click to open details →</div>`;
  positionHover(evt); hc.classList.add('on'); },110); }
function positionHover(evt){ const st=document.getElementById('stage').getBoundingClientRect(); let x=evt.clientX-st.left+16,y=evt.clientY-st.top+14; const w=270,h=hc.offsetHeight||180;
  if(x+w>st.width-8)x=evt.clientX-st.left-w-16; if(y+h>st.height-8)y=st.height-h-8; hc.style.left=x+'px'; hc.style.top=Math.max(8,y)+'px'; }
function hideHover(){ clearTimeout(hoverTimer); hc.classList.remove('on'); }

/* dock panes */
const dock=document.getElementById('dock'),dockBody=document.getElementById('dockbody'); let openPanes=[];
function openPane(id){ if(!openPanes.includes(id))openPanes.push(id); sel=id; renderDock(); markSelection(); paint(); dock.classList.add('open'); }
function closePane(id){ openPanes=openPanes.filter(x=>x!==id); byId(id).pinned=false; if(sel===id)sel=openPanes[openPanes.length-1]||null; renderDock(); markSelection(); paint(); if(!openPanes.length)dock.classList.remove('open'); }
function renderDock(){ document.getElementById('dockcount').textContent=openPanes.length?openPanes.length+' open':'';
  if(!openPanes.length){ dockBody.innerHTML='<div class="empty">Click any object on the map to open its live detail here. Panels stack — pin the ones you want to keep watching. Drag the left edge to resize.</div>'; return; }
  dockBody.innerHTML=''; const order=[...openPanes].sort((a,b)=>(byId(b).pinned?1:0)-(byId(a).pinned?1:0)); order.forEach(id=>dockBody.appendChild(buildPane(byId(id)))); refreshPanes(); }
function autoGrow(ta){ ta.style.height='auto'; ta.style.height=(ta.scrollHeight+2)+'px'; }
/* F2 · a pane renders ALL of its objectives at natural height — About first, then
   every objective with its full-week graph and threshold caption, then the note.
   Nothing is capped here: the DOCK BODY scrolls (see .dock-body in styles.css). */
function buildPane(n){ const t=cur,ns=nodeStatus(n,t); const pane=document.createElement('div'); pane.className='pane'; pane.dataset.id=n.id;
  pane.innerHTML=`<div class="pane-h"><span class="ic">${svgIcon(n.type)}</span><div><div class="nm">${n.name}</div><div class="meta">${n.type} · ${n.ip}${n.pm?' — '+n.pm:''}</div></div>
    <span class="pill" style="margin-left:8px;background:${statusColor(ns)}22;color:${statusColor(ns)}" data-role="ns">${ns}</span>
    <div class="acts"><button class="iconbtn ${n.pinned?'act':''}" data-act="pin" title="Pin">${n.pinned?'★':'☆'}</button><button class="iconbtn" data-act="close" title="Close">✕</button></div></div>
    <div class="pane-body">
      <div class="about"><label>About this object <span class="aff">✎ click to edit</span></label>
        <textarea class="abouttx" data-role="about" placeholder="Describe what this object does and who depends on it…">${esc(n.about)}</textarea></div>
      <div data-role="objs"></div>
      <div class="notes"><label>Note / label for this object</label><textarea data-role="note" placeholder="e.g. YESC advice-file cycle 14:00–15:00…">${esc(n.note)}</textarea></div>
    </div>`;
  pane.querySelector('[data-act="close"]').onclick=()=>closePane(n.id);
  pane.querySelector('[data-act="pin"]').onclick=()=>{ n.pinned=!n.pinned; renderDock(); paint(); };
  const nt=pane.querySelector('[data-role="note"]');
  nt.addEventListener('input',e=>{ n.note=e.target.value; autoGrow(e.target); paint(); });
  const ab=pane.querySelector('[data-role="about"]');
  ab.addEventListener('input',e=>{ n.about=e.target.value; autoGrow(e.target); });
  fillObjs(pane,n);
  // size the two free-text fields once the pane is in the DOM and has a width
  requestAnimationFrame(()=>{ autoGrow(ab); autoGrow(nt); });
  return pane; }
function fillObjs(pane,n){ const t=cur,box=pane.querySelector('[data-role="objs"]'); box.innerHTML='';
  n.objs.forEach(o=>{ const d=document.createElement('div'); d.className='obj'; const thr=o.dir==='hi'?`warn ≥ ${o.warn} · crit ≥ ${o.crit}`:`warn ≤ ${o.warn} · crit ≤ ${o.crit}`;
    d.innerHTML=`<div class="obj-h"><span class="sd" style="background:${statusColor(o.stat[t])}"></span><span class="k">${o.label}</span><span class="v">${fmtVal(o,o.vals[t])}</span></div>`+
      `<div class="sub">${sparkline(o,320,34,{fluid:true})}</div><div class="thr">${thr}</div>`; box.appendChild(d); }); }
function refreshPanes(){ if(!openPanes.length)return; dockBody.querySelectorAll('.pane').forEach(pane=>{ const n=byId(pane.dataset.id),ns=nodeStatus(n,cur); const pill=pane.querySelector('[data-role="ns"]'); if(pill){pill.textContent=ns;pill.style.background=statusColor(ns)+'22';pill.style.color=statusColor(ns);} fillObjs(pane,n); }); }
function svgIcon(type){ return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICON[type]||ICON.app}</svg>`; }
function markSelection(){ NODES.forEach(n=>{ const on=n.id===sel; n.el.classList.toggle('sel',on); n.el.querySelector('.selring').style.display=on?'':'none'; });
  if(sel){ const nb=new Set([sel]); LINKS.forEach(L=>{ if(L[0]===sel)nb.add(L[1]); if(L[1]===sel)nb.add(L[0]); }); NODES.forEach(n=>n.el.classList.toggle('dim',!nb.has(n.id))); } else NODES.forEach(n=>n.el.classList.remove('dim')); }
function focusNode(n){ const w=stage.clientWidth-(dock.classList.contains('open')?parseInt(getComputedStyle(document.documentElement).getPropertyValue('--dockW')):0),h=stage.clientHeight; view.k=Math.max(view.k,1.1); view.x=w/2-n.x*view.k; view.y=h/2-n.y*view.k; applyView(); }

/* ===================== LIVE TABLES ===================== */
/* E4: durations can now span days (7-day window) */
function fmtDur(steps){ const m=steps*STEP_MIN; if(m<60)return m+'m'; const h=Math.floor(m/60),mm=m%60;
  if(h<24) return h+'h'+(mm?(' '+mm+'m'):''); return Math.floor(h/24)+'d'+((h%24)?(' '+(h%24)+'h'):''); }
function ago(idx){ const st=cur-idx; if(st<=0)return 'now'; return fmtDur(st)+' ago'; }
function sevW(s){ return s==='crit'?1000:s==='warn'?100:0; }
function chip(s){ return `<span class="sevchip ${s}">${s}</span>`; }
const WSTEPS={'5m':1,'15m':3,'1h':12,'3h':36,'6h':72,'12h':144,'24h':288,'2d':576,'7d':2016};   // E5
function winLabel(v){ return {'5m':'5 min','15m':'15 min','1h':'1 hour','3h':'3 hours','6h':'6 hours','12h':'12 hours','24h':'24 hours','2d':'2 days','7d':'7 days'}[v]||v; }

/* ---------- F4 · WINDOW CLAMP -------------------------------------------------
 * A table window ending at t covers exactly [max(0,t-W+1) .. t]. Every figure a
 * row reports is now derived from ONE walk of that span, via episodes CLIPPED to
 * it — so downtime, event count, first/last seen and worst severity are mutually
 * consistent and can never quote a step outside the window.
 *
 * Previously `down` was counted inside the window but `ev` was counted from the
 * whole-week o.eps by START index, and table B admitted any episode merely
 * OVERLAPPING the window while reporting its true (out-of-window) start and end.
 * That is how history from other days leaked into a short window: a row could
 * show downtime with events 0, an age far longer than the window itself, or an
 * end index in the future relative to t.
 *
 * o.eps (unclipped, whole week) is retained — the incident popup and the
 * sparkline tint legitimately need the real episode extent.                    */
function clipEps(o,lo,hi){ const r=[]; let s=null;
  for(let i=lo;i<=hi;i++){ const st=o.stat[i];
    if(st&&st!=='ok'){ if(!s)s={start:i,worst:st,end:i}; else { s.worst=worse(s.worst,st); s.end=i; } }
    else if(s){ r.push(s); s=null; } }
  if(s)r.push(s);
  /* Aggregates use the CLIPPED extent; "Since" in table B is the episode's real
     start, which is a property of the event rather than of the window — so carry
     the true extent too and mark rows whose event began before the window. */
  r.forEach(e=>{ const src=o.eps.find(E=>E.start<=e.start&&E.end>=e.end);
    e.srcStart=src?src.start:e.start; e.srcEnd=src?src.end:e.end;
    e.truncStart=e.srcStart<lo; });
  return r; }
let _winCache={key:null,rows:null};
function windowScan(upto,W){ const key=upto+'|'+W; if(_winCache.key===key) return _winCache.rows;
  const lo=Math.max(0,upto-W+1), rows=[];
  ALLOBJ.forEach(({n,o})=>{ const eps=clipEps(o,lo,upto); if(!eps.length)return;
    let down=0,worst='ok'; eps.forEach(e=>{ down+=e.end-e.start+1; worst=worse(worst,e.worst); });
    rows.push({n,o,lo,hi:upto,eps,down,worst,ev:eps.length,first:eps[0].start,last:eps[eps.length-1].end}); });
  _winCache={key,rows}; return rows; }
// callers sort/filter freely — hand out a shallow copy, keep the scan cached
function windowRows(upto,W){ return windowScan(upto,W).slice(); }
function recentRows(t,W){ const rows=[];
  windowScan(t,W).forEach(r=>{ r.eps.forEach(e=>{ const active=(e.end===t && r.o.stat[t]!=='ok');
    // endIdx never runs past t — a windowed view cannot quote the future
    rows.push({n:r.n,o:r.o,sev:e.worst,since:e.srcStart,endIdx:e.end,truncStart:e.truncStart,active,key:active?1e9:e.end}); }); });
  rows.sort((a,b)=>(b.key-a.key)||(b.since-a.since)); return rows.slice(0,80); }

function tableEmpty(msg,warn){ return `<div class="tbl-empty ${warn?'warnc':''}">${msg}</div>`; }
function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
/* rows carry the object + indicator + originating window so a click can both
   focus the node (as before) and open the incident panel keyed to that cell */
function rowAttrs(id,label,W){ return `data-nid="${esc(id)}" data-ind="${esc(label)}" data-w="${W}"`; }
window.tableRowClick=function(id){ const n=byId(id); if(n){ openPane(id); focusNode(n); } };

function renderTableA(){
  const W=WSTEPS[document.getElementById('aWin').value], rankBy=document.getElementById('aRank').value;
  document.getElementById('aTag').textContent=winLabel(document.getElementById('aWin').value);
  let rows=windowRows(cur,W);
  rows.sort((a,b)=> rankBy==='ev'? b.ev-a.ev : rankBy==='down'? b.down-a.down : (sevW(b.worst)+b.down)-(sevW(a.worst)+a.down));
  rows=rows.slice(0,14);
  const wrap=document.getElementById('aWrap');
  if(!rows.length){ wrap.innerHTML=tableEmpty('✓ No errors in window'); return; }
  let h='<table class="dt"><thead><tr><th>Object</th><th>Indicator</th><th>Sev</th><th class="num">Events</th><th class="num">Downtime</th><th>Last</th><th>7d</th></tr></thead><tbody>';
  rows.forEach(r=>{ h+=`<tr ${rowAttrs(r.n.id,r.o.label,W)}><td class="objcell">${r.n.name}</td><td>${r.o.label}</td><td>${chip(r.worst)}</td><td class="num">${r.ev}</td><td class="num">${fmtDur(r.down)}</td><td title="${dstamp(r.last)}">${ago(r.last)}</td><td>${sparkline(r.o,88,20)}</td></tr>`; });
  wrap.innerHTML=h+'</tbody></table>';
}
let prevBKeys=new Set();
function renderTableB(){
  const W=WSTEPS[document.getElementById('bWinSel').value];
  document.getElementById('bTag').textContent=winLabel(document.getElementById('bWinSel').value);
  const rows=recentRows(cur,W); const wrap=document.getElementById('bWrap');
  if(!rows.length){ wrap.innerHTML=tableEmpty('✓ No errors in window'); prevBKeys=new Set(); return; }
  let h='<table class="dt"><thead><tr><th>Since</th><th>Age</th><th>Object</th><th>Indicator</th><th>Sev</th><th>Trigger</th><th class="num">Value</th><th>State</th></tr></thead><tbody>';
  const nowKeys=new Set();
  rows.forEach(r=>{ const o=r.o; const vIdx=r.active?cur:r.endIdx; const lim=r.sev==='crit'?o.crit:o.warn; const cmp=o.dir==='hi'?'>':'<'; const rk=r.n.id+'|'+o.label+'|'+r.since; nowKeys.add(rk);
    const isNew=!prevBKeys.has(rk); const stCol=r.active?statusColor(r.sev):'var(--ok)'; const stTxt=r.active?'Active':'Recovered';
    // rows only appear if the episode overlaps the window; "⋯" marks one that was
    // already running when the window opened (its counted downtime is clipped)
    const ageTxt=r.active?(fmtDur(cur-r.since)||'0m'):('ended '+ago(r.endIdx));
    const sinceTxt=(r.truncStart?'⋯ ':'')+dstamp(r.since);
    const sinceTip=r.truncStart?('began '+dstamp(r.since)+' — before this window opened'):dstamp(r.since);
    h+=`<tr class="${isNew?'flash':''}" ${rowAttrs(r.n.id,o.label,W)}><td title="${esc(sinceTip)}">${sinceTxt}</td><td>${ageTxt}</td><td class="objcell">${r.n.name}</td><td>${o.label}</td><td>${chip(r.sev)}</td><td>${fmtVal(o,o.vals[vIdx])} ${cmp} ${lim}</td><td class="num">${o.vals[vIdx]}</td><td style="color:${stCol}">${stTxt}</td></tr>`; });
  wrap.innerHTML=h+'</tbody></table>'; prevBKeys=nowKeys;
}
const C_COLS=[['obj','Object'],['ind','Indicator'],['sev','Severity'],['val','Value'],['thr','Trigger'],['events','Events'],['down','Downtime'],['last','Last seen'],['since','First seen']];
let cShow={obj:1,ind:1,sev:1,val:1,thr:1,events:0,down:1,last:1,since:0}; let cSort={key:'sev',dir:-1};
function renderTableC(){
  const W=WSTEPS[document.getElementById('cWin').value], sev=document.getElementById('cSev').value, node=document.getElementById('cNode').value;
  let rows=windowRows(cur,W);
  if(sev==='crit') rows=rows.filter(r=>r.worst==='crit'); else if(sev==='warn') rows=rows.filter(r=>r.worst!=='ok');
  if(node!=='all') rows=rows.filter(r=>r.n.id===node);
  const g=(r,k)=>({obj:r.n.name,ind:r.o.label,sev:sevW(r.worst),val:r.o.vals[cur],thr:0,events:r.ev,down:r.down,last:r.last,since:r.first}[k]);
  rows.sort((a,b)=>{ const va=g(a,cSort.key),vb=g(b,cSort.key); return (va<vb?-1:va>vb?1:0)*cSort.dir; });
  rows=rows.slice(0,40);
  const wrap=document.getElementById('cWrap');
  if(!rows.length){ wrap.innerHTML=tableEmpty(sev==='all'?'✓ Nothing to show for this window':'✓ No '+sev+' items',sev!=='all'); return; }
  const cols=C_COLS.filter(c=>cShow[c[0]]);
  let h='<table class="dt"><thead><tr>'; cols.forEach(c=>{ const num=['val','events','down'].includes(c[0]); const active=cSort.key===c[0]; h+=`<th class="${num?'num':''}" onclick="cSortBy('${c[0]}')">${c[1]} <span class="ar">${active?(cSort.dir<0?'▼':'▲'):''}</span></th>`; }); h+='</tr></thead><tbody>';
  rows.forEach(r=>{ const o=r.o; const lim=r.worst==='crit'?o.crit:o.warn; const cmp=o.dir==='hi'?'>':'<'; h+=`<tr ${rowAttrs(r.n.id,o.label,W)}>`;
    cols.forEach(c=>{ const k=c[0]; let v='';
      if(k==='obj')v=`<span class="objcell">${r.n.name}</span>`; else if(k==='ind')v=o.label; else if(k==='sev')v=chip(r.worst);
      else if(k==='val')v=`<span>${o.vals[cur]}</span>`; else if(k==='thr')v=`${fmtVal(o,o.vals[cur])} ${cmp} ${lim}`;
      else if(k==='events')v=r.ev; else if(k==='down')v=fmtDur(r.down); else if(k==='last')v=ago(r.last); else if(k==='since')v=dstamp(r.first);
      const num=['val','events','down'].includes(k); h+=`<td class="${num?'num':''}">${v}</td>`; });
    h+='</tr>'; });
  wrap.innerHTML=h+'</tbody></table>';
}
window.cSortBy=function(k){ if(cSort.key===k)cSort.dir*=-1; else {cSort.key=k;cSort.dir=-1;} renderTableC(); };
function renderTables(){ if(document.getElementById('bottom').classList.contains('closed'))return; renderTableA(); renderTableB(); renderTableC(); }

/* ===================== F3 · INCIDENT / RCA PANEL =====================
 * Left slide-in mirroring the right dock. Clicking a table row focuses the node
 * on the map (unchanged) AND opens this panel for that object · indicator, keyed
 * into ADEPTIO_RCA. One at a time; ✕ or Esc closes. Window stats come from the
 * window of the table the row was clicked in, so they agree with the row.      */
const rcaPanel=document.getElementById('rcapanel'), rcaBody=document.getElementById('rcabody');
let rcaOpen=null;
function closeRCA(){ rcaOpen=null; rcaPanel.classList.remove('open'); rcaPanel.setAttribute('aria-hidden','true'); document.body.classList.remove('rca-open'); scTuckSet(false); scReflow(); }
/* the whole left stack slides when the RCA panel opens/closes, so the scenario
   card lands over different nodes — refit once now and once the slide has ended */
function scReflow(){ scheduleScFit(); setTimeout(scheduleScFit,330); }
function openRCA(nid,label,W){ const n=byId(nid); if(!n)return; const o=n.objs.find(x=>x.label===label); if(!o)return;
  rcaOpen={nid,label,W:W||WSTEPS[A_DEFAULT_WIN]};
  rcaPanel.classList.add('open'); rcaPanel.setAttribute('aria-hidden','false'); document.body.classList.add('rca-open'); renderRCA(); scTuckSet(true); scReflow(); }
function rcaSec(num,title,inner){ return `<section class="rsec"><h4><span class="rn">${num}</span>${title}</h4>${inner}</section>`; }
function rcaList(items,cls){ return items&&items.length?`<ul class="rlist ${cls||''}">${items.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'<div class="rnone">—</div>'; }
function renderRCA(){ if(!rcaOpen)return;
  const n=byId(rcaOpen.nid), o=n&&n.objs.find(x=>x.label===rcaOpen.label);
  if(!n||!o){ closeRCA(); return; }
  const W=rcaOpen.W, t=cur;
  const row=windowScan(t,W).find(r=>r.n.id===n.id&&r.o.label===o.label);
  const meta=rcaNode(n.id)||{}, ind=rcaInd(n.id,o.label)||{}, own=meta.owner||{};
  const sev=row?row.worst:o.stat[t];
  // episode to tint: the one covering t, else the last one inside the window,
  // else the most recent whole-series episode before t
  let ep=null;
  if(row&&row.eps.length) ep=row.eps.find(e=>t>=e.start&&e.end>=t)||row.eps[row.eps.length-1];
  else if(o.eps.length){ const past=o.eps.filter(e=>e.start<=t); ep=past.length?past[past.length-1]:null; }
  const lim=(sev==='crit')?o.crit:o.warn, cmp=(o.dir==='hi')?'>':'<';
  const trigIdx=ep?clamp(t,ep.start,ep.end):t;

  const stat=`<div class="rstats">
     <div><span class="rk">Events</span><span class="rv">${row?row.ev:0}</span></div>
     <div><span class="rk">Downtime</span><span class="rv">${row?fmtDur(row.down):'0m'}</span></div>
     <div><span class="rk">Last seen</span><span class="rv">${row?ago(row.last):'—'}</span></div>
     <div><span class="rk">Trigger</span><span class="rv">${fmtVal(o,o.vals[trigIdx])} <span class="rmut">${cmp} ${lim}</span></span></div>
   </div>`;
  const s1=rcaSec(1,'Incident',
    `<div class="rhead"><span class="robj">${esc(n.name)}</span><span class="rind">${esc(o.label)}</span>${chip(sev)}</div>
     <div class="rwin">window ${winLabel(Object.keys(WSTEPS).find(k=>WSTEPS[k]===W)||W+' steps')} ending ${dstamp(t)}</div>
     ${stat}
     <div class="rspark">${sparkline(o,320,44,{fluid:true,tint:ep?{start:ep.start,end:ep.end,sev:ep.worst||sev}:null})}</div>
     <div class="rcap">${ep?('episode '+dstamp(ep.start)+' → '+dstamp(ep.end)+' (tinted)'):'no episode in this window'}</div>`);

  const chips=(meta.systems||[]).map(id=>{ const nb=byId(id); return `<button class="syschip" data-sys="${esc(id)}">${esc(nb?nb.name:id)}</button>`; }).join('');
  const s2=rcaSec(2,'Relevant system / page',
    `<div class="rpage">${esc(meta.page||'—')}</div>
     <div class="rchips">${chips||'<span class="rnone">—</span>'}</div>
     <a class="rflow" href="flow-instrumentation.html">flow map &rarr;</a>`);

  const s3=rcaSec(3,'Recommended checks',
    rcaList(ind.checks)+`<h5>Questions to ask</h5>`+rcaList(ind.questions,'q'));

  const s4=rcaSec(4,'Owner',
    `<div class="rown"><div><span class="rk">Team</span><span class="rv">${esc(own.team||'—')}</span></div>
      <div><span class="rk">Name</span><span class="rv">${esc(own.name||'—')}</span></div>
      <div><span class="rk">Channel</span><span class="rv">${esc(own.channel||'—')}</span></div></div>
     <div class="resc"><span class="rk">Escalate</span> ${esc(own.escalate||'—')}</div>
     ${traceRow(o,t)}`);

  rcaBody.innerHTML=s1+s2+s3+s4;
  rcaBody.querySelectorAll('.syschip').forEach(b=>b.onclick=()=>{ const nb=byId(b.dataset.sys); if(!nb)return; sel=nb.id; markSelection(); focusNode(nb); });
  wireTrace();
}

/* F7 · INCIDENT TRACE ----------------------------------------------------------
 * The RCA panel answers "what broke and who owns it"; this row answers "is there
 * a case open on it". The clicked indicator carries one or more incident-window
 * keys (objective.inc); we take the window that contains the cursor, else the
 * most recent one that started before it, and resolve it through
 * ADEPTIO_TICKETS.byWindow. Collapsed by default — it is context, not headline.*/
const SLZ={todo:'To Do',inprog:'In Progress',done:'Done'};
let traceExpanded=false;
function traceTicket(o,t){
  const T=window.ADEPTIO_TICKETS; if(!T||!T.tickets) return null;
  const keys=!o.inc?[]:(typeof o.inc==='string'?[o.inc]:Object.keys(o.inc));
  if(!keys.length) return null;
  let pick=keys.find(k=>{ const w=INC[k]; return w && t>=w[0] && t<=w[w.length-1]; });
  if(!pick){ let bs=-1; keys.forEach(k=>{ const w=INC[k]; if(w&&w[0]<=t&&w[0]>bs){ bs=w[0]; pick=k; } }); }
  if(!pick) return null;
  const key=T.byWindow&&T.byWindow[pick];
  const tk=key&&T.tickets.find(x=>x.key===key);
  return tk?{tk,incKey:pick}:null;
}
function traceRow(o,t){
  const hit=traceTicket(o,t), tk=hit&&hit.tk;
  const body = tk
    ? `<div class="rtcard">
         <div class="rtrow"><span class="rtlz ${tk.status}">${esc(SLZ[tk.status]||tk.status)}</span>
           <span class="rtkey">${esc(tk.key)}</span>${tk.major?'<span class="rtmaj">MAJOR</span>':''}</div>
         <div class="rtsum">${esc(tk.summary)}</div>
         <div class="rtmeta"><span>Assignee <b>${esc(tk.assignee?tk.assignee.name:'Unassigned')}</b></span>
           <span>Updated <b>${dstamp(tk.updated)}</b></span></div>`
      /*SF-STRIP-START*/ + `<a class="rtopen" href="incident-trace.html#${esc(tk.key)}">Open in Incident Trace Portal &rarr;</a>` /*SF-STRIP-END*/
      + `</div>`
    : `<div class="rtcard"><div class="rtnone">No linked case &mdash; this indicator is not inside a tracked incident window.`
      /*SF-STRIP-START*/ + ` <a class="rtopen" href="incident-trace.html">Open the portal &rarr;</a>` /*SF-STRIP-END*/
      + `</div></div>`;
  return `<div class="rtrace">
    <button class="rtoggle" id="rtoggle" aria-expanded="${traceExpanded}" aria-controls="rtbody">
      <span class="car">&#9654;</span>Incident Trace
      <span class="rtn">${tk?esc(tk.key):'no linked case'}</span></button>
    <div class="rtbody${traceExpanded?' open':''}" id="rtbody">${body}</div></div>`;
}
function wireTrace(){ const b=document.getElementById('rtoggle'); if(!b)return;
  b.onclick=()=>{ traceExpanded=!traceExpanded;
    b.setAttribute('aria-expanded',traceExpanded);
    document.getElementById('rtbody').classList.toggle('open',traceExpanded); }; }
document.getElementById('rcaclose').onclick=closeRCA;
/* one delegated handler for all three tables: focus the node, open the pane, and
   open the incident panel for the exact object · indicator that was clicked */
document.getElementById('btables').addEventListener('click',e=>{
  const tr=e.target.closest('tbody tr'); if(!tr||!tr.dataset.nid)return;
  const n=byId(tr.dataset.nid); if(!n)return;
  openPane(n.id); focusNode(n);
  if(tr.dataset.ind) openRCA(n.id,tr.dataset.ind,parseInt(tr.dataset.w,10)||WSTEPS[A_DEFAULT_WIN]);
});

/* ===================== PAN / ZOOM / DRAG (grid snap) ===================== */
const canvas=document.getElementById('canvas'),stage=document.getElementById('stage'); const SNAP=20;
let view={x:0,y:0,k:1};
function applyView(){ vp.setAttribute('transform',`translate(${view.x},${view.y}) scale(${view.k})`); }
function dockW(){ return dock.classList.contains('open')?parseInt(getComputedStyle(document.documentElement).getPropertyValue('--dockW')):0; }
function fit(){ const pad=90; let minx=1e9,miny=1e9,maxx=-1e9,maxy=-1e9; NODES.forEach(n=>{ minx=Math.min(minx,n.x);miny=Math.min(miny,n.y);maxx=Math.max(maxx,n.x);maxy=Math.max(maxy,n.y); });
  const w=stage.clientWidth-dockW(),h=stage.clientHeight,bw=maxx-minx+pad*2,bh=maxy-miny+pad*2; const k=clamp(Math.min(w/bw,h/bh),0.4,1.6);
  view.k=k; view.x=(w-(minx+maxx)*k)/2; view.y=(h-(miny+maxy)*k)/2; applyView(); balance(); scheduleScFit(); }
/* fit() centres the node CENTRES, but a rendered node hangs well below its centre
   (disc + three label lines), so the map sat top-heavy — ~54px of dead canvas
   above and ~16px below at 1600×900. balance() re-centres on the true rendered
   extent: same scale, pure nudge, and it is what opens the bottom-left pocket the
   scenario card now occupies. The nudge only ever moves the map UP, and is
   clamped so nodes sharing the hint card's column can never ride into it. */
function balance(){
  const st=stage.getBoundingClientRect(), gs=[];
  gNodes.querySelectorAll('.node').forEach(g=>{ const b=g.getBoundingClientRect();
    gs.push({x1:b.left-st.left,x2:b.right-st.left,y1:b.top-st.top,y2:b.bottom-st.top}); });
  if(!gs.length)return;
  const top=Math.min(...gs.map(g=>g.y1)), bot=st.height-Math.max(...gs.map(g=>g.y2));
  let dy=(top-bot)/2; if(dy<=1)return;
  const hb=hintBox();   // 8px of margin, so a node column that merely abuts the
                        // hint is still treated as sharing its lane
  if(hb) gs.forEach(g=>{ if(g.x2>hb.x1-8&&g.x1<hb.x2+8) dy=Math.min(dy,g.y1-(hb.y2+6)); });
  dy=Math.min(dy,top-10);
  if(dy>1){ view.y-=dy; applyView(); }
}
canvas.addEventListener('wheel',e=>{ e.preventDefault(); const r=canvas.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top,f=e.deltaY<0?1.12:1/1.12,nk=clamp(view.k*f,0.3,4);
  view.x=mx-(mx-view.x)*(nk/view.k); view.y=my-(my-view.y)*(nk/view.k); view.k=nk; applyView(); },{passive:false});
document.getElementById('zoomin').onclick=()=>zoomBtn(1.2); document.getElementById('zoomout').onclick=()=>zoomBtn(1/1.2);
function zoomBtn(f){ const r=canvas.getBoundingClientRect(),mx=r.width/2,my=r.height/2,nk=clamp(view.k*f,0.3,4); view.x=mx-(mx-view.x)*(nk/view.k); view.y=my-(my-view.y)*(nk/view.k); view.k=nk; applyView(); }
document.getElementById('fit').onclick=fit;
let drag=null;
canvas.addEventListener('mousedown',e=>{ const g=e.target.closest('.node'); if(g){ const n=byId(g.dataset.id); drag={type:'node',n,sx:e.clientX,sy:e.clientY,ox:n.x,oy:n.y,moved:false}; }
  else { drag={type:'pan',sx:e.clientX,sy:e.clientY,ox:view.x,oy:view.y,moved:false}; canvas.classList.add('panning'); hideHover(); } });
window.addEventListener('mousemove',e=>{ if(!drag)return; const dx=e.clientX-drag.sx,dy=e.clientY-drag.sy; if(Math.abs(dx)+Math.abs(dy)>3)drag.moved=true;
  if(drag.type==='node'){ let nx=drag.ox+dx/view.k, ny=drag.oy+dy/view.k; nx=Math.round(nx/SNAP)*SNAP; ny=Math.round(ny/SNAP)*SNAP; drag.n.x=nx; drag.n.y=ny; drag.n.el.setAttribute('transform',`translate(${nx},${ny})`); paintLinksOnly(); }
  else { view.x=drag.ox+dx; view.y=drag.oy+dy; applyView(); } });
window.addEventListener('mouseup',()=>{ if(drag&&drag.type==='node'&&!drag.moved)openPane(drag.n.id); if(drag&&drag.type==='pan'&&!drag.moved){ sel=null; markSelection(); } canvas.classList.remove('panning'); drag=null; });
gNodes.addEventListener('mouseover',e=>{ const g=e.target.closest('.node'); if(g&&!drag)showHover(byId(g.dataset.id),e); });
gNodes.addEventListener('mousemove',e=>{ if(hc.classList.contains('on')&&!drag)positionHover(e); });
gNodes.addEventListener('mouseout',e=>{ if(e.target.closest('.node'))hideHover(); });

/* dock resizer */
const dockresizer=document.getElementById('dockresizer'); let dres=null;
dockresizer.addEventListener('mousedown',e=>{ dres={sx:e.clientX,ow:parseInt(getComputedStyle(document.documentElement).getPropertyValue('--dockW'))}; e.preventDefault(); document.body.style.cursor='col-resize'; });
window.addEventListener('mousemove',e=>{ if(!dres)return; const nw=clamp(dres.ow-(e.clientX-dres.sx),300,Math.min(720,window.innerWidth-120)); document.documentElement.style.setProperty('--dockW',nw+'px'); });
window.addEventListener('mouseup',()=>{ if(dres){ dres=null; document.body.style.cursor=''; refreshPanes(); } });

/* ===================== SCENARIO CARD (bottom-left stack) =====================
 * The card lives above the status legend and grows upward from it. Three things
 * are handled here and nowhere else:
 *   · fitScenario()  — caps .sc-body's height to the free pocket between the
 *     legend and whatever is above the card (the hint card's reserved band, or a
 *     node label), so the card scrolls internally rather than ever overlapping.
 *   · drag to resize — right edge = width (260…520), top-right corner = both.
 *   · minimise       — collapses to the scenario glyph chip in the same anchor.
 * Width / height / collapsed state are session-scoped (in memory); Reset clears
 * all three back to the responsive default, expanded.
 */
const scEl=document.getElementById('scenario'), scBody=document.getElementById('scbody'),
      scChip=document.getElementById('scchip');
const SC_MINW=260, SC_MAXW=520;
let scW=null, scH=null, scMin=false, scRaf=0;

/* The hint card is dismissible, and a display:none element has no geometry — so
   its box is cached while it is still on screen and the reserve is kept either
   way. Dismissing the hint therefore never shifts the map or resizes the card. */
let HINTB=null;
function hintBox(){ const e=document.getElementById('hint');
  if(e&&getComputedStyle(e).display!=='none'){ const st=stage.getBoundingClientRect(),b=e.getBoundingClientRect();
    HINTB={x1:b.left-st.left,x2:b.right-st.left,y2:b.bottom-st.top}; }
  return HINTB; }

function scheduleScFit(){ if(scRaf)return; scRaf=requestAnimationFrame(()=>{ scRaf=0; fitScenario(); }); }
function fitScenario(){
  if(!scEl||scMin||scEl.hidden||getComputedStyle(scEl).display==='none')return;
  const st=stage.getBoundingClientRect(), lg=document.getElementById('legend').getBoundingClientRect();
  scBody.style.maxHeight='';                                   // measure natural first
  const chrome=scEl.getBoundingClientRect().height-scBody.getBoundingClientRect().height;
  const nat=scBody.scrollHeight;
  const card=scEl.getBoundingClientRect(), cx1=card.left-st.left, cx2=card.right-st.left;
  const hb=hintBox();
  let ceil=(hb&&hb.x2>cx1&&hb.x1<cx2)?hb.y2+8:10;              // floor of whatever is above
  gNodes.querySelectorAll('.node').forEach(g=>{ const b=g.getBoundingClientRect();
    if(b.right-st.left>cx1 && b.left-st.left<cx2) ceil=Math.max(ceil,(b.bottom-st.top)+6); });
  const avail=Math.max(44,(lg.top-st.top)-8-ceil-chrome);
  scBody.style.maxHeight=Math.min(scH||nat, nat, avail)+'px';
}
function scSetMin(v){ scMin=v; scEl.hidden=v; scChip.hidden=!v;
  scChip.setAttribute('aria-expanded',v?'false':'true'); if(!v)scheduleScFit(); }
/* The RCA panel slides the whole left stack 394px into the map, where a 440px
   card would occlude far more of the graph than the legend alone ever did. So the
   card tucks itself into the chip for the duration — and only for the duration:
   a tuck is remembered separately from a deliberate minimise, so whatever state
   the reader chose is what comes back when the panel closes. */
let scTuck=false;
function scUserMin(v){ scTuck=false; scSetMin(v); }
function scTuckSet(v){ if(v){ if(!scMin){ scTuck=true; scSetMin(true); } }
  else if(scTuck){ scTuck=false; scSetMin(false); } }
document.getElementById('scmin').onclick=()=>scUserMin(true);
scChip.onclick=()=>scUserMin(false);

let sres=null;
function scStartRes(e,mode){ sres={mode,sx:e.clientX,sy:e.clientY,
    ow:scEl.getBoundingClientRect().width, oh:scBody.getBoundingClientRect().height};
  e.preventDefault(); e.stopPropagation(); document.body.style.cursor=mode==='c'?'nesw-resize':'col-resize'; }
document.getElementById('scrz').addEventListener('mousedown',e=>scStartRes(e,'w'));
document.getElementById('scrzc').addEventListener('mousedown',e=>scStartRes(e,'c'));
window.addEventListener('mousemove',e=>{ if(!sres)return;
  scW=Math.round(clamp(sres.ow+(e.clientX-sres.sx),SC_MINW,SC_MAXW));
  scEl.style.width=scW+'px';
  if(sres.mode==='c') scH=Math.max(44,Math.round(sres.oh-(e.clientY-sres.sy)));  // drag up = taller
  fitScenario(); });
window.addEventListener('mouseup',()=>{ if(sres){ sres=null; document.body.style.cursor=''; } });
window.addEventListener('resize',scheduleScFit);
/* v2.0.2: the shell dispatches a synthetic window 'resize' ~220ms after a
   sidebar state change (docs/SPEC-Shell-v2.0.2.md §1) so pages with a canvas
   can re-lay-out; a live window resize fires the same event. Nothing here
   previously listened for it: fit() already recomputes view from #stage's
   *current* clientWidth/clientHeight, so listening is enough — coalesced
   through rAF like the scenario card's own handler just above, so a drag-
   resize doesn't run the node-bounds walk every pixel. Additive only; no
   existing call re-lays the map out on resize. */
let fitRaf=0;
window.addEventListener('resize',()=>{ if(fitRaf)return; fitRaf=requestAnimationFrame(()=>{ fitRaf=0; fit(); }); });

/* bottom panel resize + close + table width dividers */
const bottom=document.getElementById('bottom'),bhandle=document.getElementById('bhandle'); let bres=null;
bhandle.addEventListener('mousedown',e=>{ bres={sy:e.clientY,oh:parseInt(getComputedStyle(document.documentElement).getPropertyValue('--bh'))}; e.preventDefault(); document.body.style.cursor='row-resize'; });
window.addEventListener('mousemove',e=>{ if(!bres)return; const nh=clamp(bres.oh-(e.clientY-bres.sy),120,Math.min(520,window.innerHeight-220)); document.documentElement.style.setProperty('--bh',nh+'px'); });
window.addEventListener('mouseup',()=>{ if(bres){ bres=null; document.body.style.cursor=''; } });
document.getElementById('bclose').onclick=()=>toggleTables(false);
document.getElementById('tabtoggle').onclick=()=>toggleTables(bottom.classList.contains('closed'));
function toggleTables(show){ bottom.classList.toggle('closed',!show); document.getElementById('tabtoggle').classList.toggle('on',show); if(show)renderTables(); }
// vertical dividers to resize table widths
document.querySelectorAll('.vdiv').forEach(v=>{ v.addEventListener('mousedown',e=>{ const sec=document.getElementById(v.dataset.l); const start=e.clientX,ow=sec.getBoundingClientRect().width;
  const mv=ev=>{ const nw=clamp(ow+(ev.clientX-start),200,document.getElementById('btables').clientWidth-420); sec.style.width=nw+'px'; sec.style.flex='0 0 auto'; };
  const up=()=>{ document.removeEventListener('mousemove',mv); document.removeEventListener('mouseup',up); document.body.style.cursor=''; };
  document.addEventListener('mousemove',mv); document.addEventListener('mouseup',up); document.body.style.cursor='col-resize'; e.preventDefault(); }); });
// column menu for C
const colmenu=document.getElementById('colmenu');
document.getElementById('cCols').onclick=e=>{ e.stopPropagation(); colmenu.innerHTML=C_COLS.map(c=>`<label><input type="checkbox" data-c="${c[0]}" ${cShow[c[0]]?'checked':''}/> ${c[1]}</label>`).join('');
  colmenu.querySelectorAll('input').forEach(inp=>inp.onchange=()=>{ cShow[inp.dataset.c]=inp.checked?1:0; renderTableC(); });
  const r=e.target.getBoundingClientRect(); colmenu.style.left=Math.min(r.left,window.innerWidth-200)+'px'; colmenu.style.top=(r.bottom-260)+'px'; colmenu.classList.add('on'); };
document.addEventListener('click',e=>{ if(!colmenu.contains(e.target)&&e.target.id!=='cCols')colmenu.classList.remove('on'); });
['aWin','aRank','bWinSel','cWin','cSev','cNode'].forEach(id=>document.getElementById(id).addEventListener('change',renderTables));
document.getElementById('brefreshbtn').onclick=()=>{ const b=document.getElementById('brefreshbtn'); b.classList.add('spin'); setTimeout(()=>b.classList.remove('spin'),650); renderTables(); document.getElementById('brefresh').textContent='refreshed ✓ · '+dstamp(cur); };

/* timeline */
let playing=false,speeds=[1,4,8,16,32,64],si=0,raf=null,acc=0,last=0;   // E6: +64x for the 7-day replay
const playBtn=document.getElementById('playbtn'),playIcon=document.getElementById('playicon');
function setCur(i){ cur=clamp(Math.round(i),0,N-1); paint(); }
function tick(ts){ if(!playing)return; if(!last)last=ts; const dt=ts-last; last=ts; acc+=dt*speeds[si];
  if(acc>150){ const adv=Math.floor(acc/150); acc=acc%150; cur+=adv; if(cur>=N-1){ cur=N-1; paint(); stop(); return; } paint(); } raf=requestAnimationFrame(tick); }
function play(){ if(cur>=N-1)cur=0; playing=true; last=0; acc=0; playIcon.innerHTML='<rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/>'; raf=requestAnimationFrame(tick); }
function stop(){ playing=false; cancelAnimationFrame(raf); playIcon.innerHTML='<path d="M8 5v14l11-7z"/>'; }
playBtn.onclick=()=>{ playing?stop():play(); };
document.getElementById('speed').onclick=e=>{ si=(si+1)%speeds.length; e.target.textContent=speeds[si]+'×'; };
document.getElementById('nowbtn').onclick=()=>{ stop(); setCur(N-1); };
const track=document.getElementById('track'),ghost=document.getElementById('ghost');
function trackIdx(e){ const r=track.getBoundingClientRect(); return clamp(Math.round((e.clientX-r.left)/r.width*(N-1)),0,N-1); }
let scrub=false;
track.addEventListener('mousedown',e=>{ scrub=true; stop(); setCur(trackIdx(e)); });
window.addEventListener('mousemove',e=>{ if(scrub)setCur(trackIdx(e)); });
window.addEventListener('mouseup',()=>{ scrub=false; });
track.addEventListener('mousemove',e=>{ const i=trackIdx(e),r=track.getBoundingClientRect(); ghost.style.left=(e.clientX-r.left)+'px'; ghost.textContent=dstamp(i); ghost.classList.add('on'); });
track.addEventListener('mouseleave',()=>ghost.classList.remove('on'));
function drawBands(){ const bands=document.getElementById('bands'); bands.innerHTML='';
  // E2/E4: bands derived from INC — a 2-value ramp runs to the end of the week at low opacity
  Object.keys(INC).forEach(k=>{ const w=INC[k],ramped=w.length===2; const d=document.createElement('div'); d.className='band';
    d.style.left=(w[0]/(N-1)*100)+'%'; d.style.width=(((ramped?N-1:w[2])-w[0])/(N-1)*100)+'%';
    d.style.background=statusColor(INCMETA[k][1]); if(ramped)d.style.opacity='.10'; bands.appendChild(d); });
  const ht=document.getElementById('hticks'); ht.innerHTML='';
  for(let i=72;i<N;i+=72){ if(i%DAY===0)continue; const d=document.createElement('div'); d.className='htick'; d.style.left=(i/(N-1)*100)+'%'; ht.appendChild(d); }
  for(let d0=0;d0<N/DAY;d0++){ const i=d0*DAY,pc=(i/(N-1)*100)+'%';
    if(d0){ const dv=document.createElement('div'); dv.className='dtick'; dv.style.left=pc; ht.appendChild(dv); }
    const lb=document.createElement('div'); lb.className='dlbl'; lb.style.left=pc; lb.textContent=DAY_LBL[d0]; ht.appendChild(lb); }
}

/* legend / theme / misc */
function buildLegend(){ const L=document.getElementById('legend'); const items=[['ok','OK'],['warn','Degraded'],['crit','Critical'],['unk','No data']];
  let h='<div class="li" style="font-weight:650;color:var(--ink)">Status</div>'; items.forEach(([k,l])=>h+=`<div class="li"><span class="sw" style="background:${statusColor(k)}"></span>${l}</div>`);
  h+='<div class="sep"></div><div class="li">◑ ring = per-objective</div><div class="li">— link = worst-of-path</div><div class="li">● note</div><div class="li">★ pinned</div>';
  // build + provenance remarks — moved here out of the top bar (v1.2.1 chrome pass)
  h+='<div class="li lgfoot">v2.0.2 · Myanmar commercial-bank template · 7-day mock data</div>';
  L.innerHTML=h; }
document.getElementById('theme').onclick=()=>{ const c=document.documentElement.getAttribute('data-theme'),nx=c==='dark'?'light':'dark'; document.documentElement.setAttribute('data-theme',nx);
  document.getElementById('themeicon').innerHTML=nx==='dark'?'<path d="M21 12.8A9 9 0 1111.2 3 7 7 0 0021 12.8z"/>':'<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/>';
  buildLegend(); drawBands(); paint(); };
document.getElementById('hintx').onclick=()=>document.getElementById('hint').style.display='none';
document.getElementById('search').addEventListener('keydown',e=>{ if(e.key!=='Enter')return; const q=e.target.value.toLowerCase().trim(); const n=NODES.find(x=>x.name.toLowerCase().includes(q)||x.id.includes(q)); if(n){ openPane(n.id); focusNode(n); } });
document.getElementById('closeall').onclick=()=>{ [...openPanes].forEach(closePane); };
window.addEventListener('keydown',e=>{ if(e.code==='Space'&&e.target.tagName!=='TEXTAREA'&&e.target.tagName!=='INPUT'){ e.preventDefault(); playing?stop():play(); }
  if(e.key==='Escape'){ if(rcaOpen){ closeRCA(); return; } sel=null; markSelection(); } });
function resetAll(){ stop();
  // Reset restores the seeded "About" text as well as clearing notes (F2c)
  NODES.forEach((n,i)=>{ n.x=ORIG[i].x; n.y=ORIG[i].y; n.note=''; n.pinned=false; n.about=aboutDefault(n.id); if(n.el)n.el.setAttribute('transform',`translate(${n.x},${n.y})`); });
  openPanes=[]; sel=null; dock.classList.remove('open'); closeRCA(); renderDock(); markSelection();
  document.documentElement.style.setProperty('--dockW','390px'); document.documentElement.style.setProperty('--bh','252px');
  document.getElementById('aWin').value=A_DEFAULT_WIN; document.getElementById('aRank').value='sev'; document.getElementById('bWinSel').value='5m'; document.getElementById('cWin').value=C_DEFAULT_WIN; document.getElementById('cSev').value='all'; document.getElementById('cNode').value=C_DEFAULT_NODE;
  cShow={obj:1,ind:1,sev:1,val:1,thr:1,events:0,down:1,last:1,since:0}; cSort={key:'sev',dir:-1};
  document.getElementById('tblA').style.width='34%'; document.getElementById('tblA').style.flex=''; document.getElementById('tblB').style.width='34%'; document.getElementById('tblB').style.flex='';
  // move the clock BEFORE re-opening the tables, so they never render a stale window
  cur=0; toggleTables(true); si=0; document.getElementById('speed').textContent='1×';
  // scenario card back to its responsive default size, expanded (F4 chrome pass)
  scW=null; scH=null; scTuck=false; scEl.style.width=''; scSetMin(false);
  document.getElementById('hint').style.display=''; paintLinksOnly(); paint(); fit();
}
document.getElementById('resetbtn').onclick=resetAll;

/* boot */
(function(){ const cn=document.getElementById('cNode'); cn.innerHTML='<option value="all">All nodes</option>'+NODES.map(n=>`<option value="${n.id}">${n.name}</option>`).join(''); cn.value=C_DEFAULT_NODE; })();
buildLinks(); buildNodes(); buildLegend(); drawBands(); paint(); fit();

/* deep link — index.html#t=<step> lands the timeline on one moment, paused.
   Used by the fault-fingerprint matrix on flow-instrumentation.html. Also honoured
   on hashchange, so a second #t= link inside the same document still seeks. */
function seekHash(){ const m=/^#t=(\d+)$/.exec(location.hash||''); if(!m)return;
  stop(); setCur(clamp(parseInt(m[1],10),0,N-1)); }
window.addEventListener('hashchange',seekHash);
seekHash();
