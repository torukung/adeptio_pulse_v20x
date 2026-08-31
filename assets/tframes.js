/* ============================================================================
 * ADEPTIO Pulse — Spin 2.0.4 · DOCK LAYER
 * assets/tframes.js — the Line Conditions reference window (R2 §5) and
 * Timeframe D, the line-episode table (R2 §6).
 *
 * Classic script, no modules, no build step: it opens straight off disk over
 * file:// like every other asset on this page. Loaded IMMEDIATELY AFTER
 * assets/engine.js and publishes:
 *
 *     window.PULSE_TFD = { init(api), refresh(), focusNewest() }
 *
 *   init(api)      — called once by the engine after its boot precompute, with
 *                    window.PULSE_ENGINE. Stores the api, fills #dNode, wires
 *                    the controls, renders D.
 *   refresh()      — called from renderTables() (after its closed-gate) and
 *                    after every setCur-driven repaint. Re-renders D only.
 *   focusNewest()  — the "+N more lines changed" balloon badge lands here:
 *                    clears the filters, sorts newest-first, scrolls D to the
 *                    top and flashes the newest row.
 *
 * EVERY read of the api is guarded and every entry point is wrapped, so a
 * missing member, a throwing helper or an engine that never boots at all can
 * only ever cost this file its own content — never the page. If init() is
 * never called, the Line Conditions window still renders its full reference
 * content on DOMContentLoaded, because it is documentation and does not need
 * the engine to be true.
 * ==========================================================================*/
(function () {
  "use strict";

  /* ---------------------------------------------------------------- state */
  var api = null;                        /* window.PULSE_ENGINE, once init runs */
  var lcFilled = false;                  /* the reference table is rendered once */
  var lcOpen = false;                    /* expanded state — persists for the session */
  var wiredLC = false, wiredD = false;
  var dSort = { key: 'when', dir: -1 };  /* default: newest first (R2 §6) */

  /* -------------------------------------------------- R2 §5 · THE RULESET
   * Copy verbatim from R2 §5, in precedence order. This is the single source
   * of the plain-English strings used by BOTH the reference table and the
   * title of every LC-xx chip in Timeframe D. `ev` lists the classes the rule
   * actually reads (the others render dimmed); `state` picks the .sevchip. */
  var LC_RULES = [
    { id: 'LC-01', ev: null, state: 'grey', line: 'NOT COVERED',
      cond: 'No evidence is bound to this relationship. Pulse is not watching it.' },
    { id: 'LC-02', ev: ['CONN'], state: 'warn', line: 'DEGRADED',
      cond: 'Connectivity here is collected from a batch file, so the two ends cannot be corroborated inside one 5-minute step. Capped at Degraded.' },
    { id: 'LC-03', ev: ['CONN', 'APP', 'LOG'], state: 'crit', line: 'CRITICAL',
      cond: 'Connectivity between the two objects is critical AND both objects report errors in the same 5-minute step.' },
    { id: 'LC-04', ev: ['CONN'], state: 'crit', line: 'CRITICAL',
      cond: 'Connectivity between the two objects is critical.' },
    { id: 'LC-05', ev: ['CONN', 'APP', 'LOG'], state: 'crit', line: 'CRITICAL',
      cond: 'Connectivity is degraded AND both objects report errors in the same 5-minute step.' },
    { id: 'LC-06', ev: ['APP', 'LOG'], state: 'crit', line: 'CRITICAL',
      cond: 'Both objects report critical application health or app-log errors in the same 5-minute step.' },
    { id: 'LC-07', ev: ['CONN'], state: 'warn', line: 'DEGRADED',
      cond: 'Connectivity between the two objects is degraded.' },
    { id: 'LC-08', ev: ['APP', 'LOG'], state: 'warn', line: 'DEGRADED',
      cond: 'Both objects report degraded health or errors in the same 5-minute step; connectivity is clean or not bound.' },
    { id: 'LC-09', ev: ['APP', 'LOG'], state: 'warn', line: 'DEGRADED',
      cond: 'Only one object reports a problem. The other object and the connectivity between them are clean. Not escalated on one object\'s colour.' },
    { id: 'LC-10', ev: ['CONN', 'APP', 'LOG'], state: 'ok', line: 'OK',
      cond: 'All bound evidence is clean at this step.' }
  ];
  function ruleById(id) {
    for (var i = 0; i < LC_RULES.length; i++) if (LC_RULES[i].id === id) return LC_RULES[i];
    return null;
  }

  /* R2 §5 · evidence-class vocabulary strip + the closing note */
  var VOCAB = [
    ['CONN', 'Connectivity — reachability between the two objects. Bound to the pair.'],
    ['APP', 'Application health — availability and response time at one object.'],
    ['LOG', 'App-log errors — error, decline and failure counts at one object.']
  ];
  var VOCAB_NOTE = 'An objective serves one class per line. Escalation needs evidence from two ends in the same 5-minute step — connectivity alone can escalate, because it is measured across the pair.';

  /* R2 §5 · footer copy */
  var LC_FOOT = [
    'Rules are read top to bottom. The first rule that matches sets the colour.',
    '10 of the 17 relationships on this map have no connectivity evidence bound. Those lines can only reach Critical when both objects report critical evidence in the same step — never on one object\'s colour alone.',
    'Grey is not OK. A grey line means nothing is bound to that relationship.'
  ];

  /* R2 §6 · empty-state copy + the permanent grey-notice line */
  var D_EMPTY_NONE = '✓ No line changed state in this window';
  var D_EMPTY_CRIT = '✓ No critical lines in this window';
  var D_EMPTY_WARN = '✓ No degraded or critical lines in this window';
  var D_EMPTY_NODE = '✓ No line episodes for this object in this window';
  var D_GREY_NOTE = '1 relationship on this map is not covered (core — recon). Not-covered lines are grey and never appear here.';
  var D_NO_ENGINE = 'Line episodes are unavailable — the line-condition engine did not load.';

  /* node short names for the o—o glyph (R2 §6 · D1) */
  var SHORT = {
    client: 'CLI', telco: 'TEL', edge: 'EDG', gw: 'GW', auth: 'AUT', otp: 'OTP',
    smsgw: 'SMS', pay: 'PAY', acct: 'ACC', dbr: 'DBR', core: 'COR', bhub: 'BHB',
    biller: 'BIL', bbatch: 'BBT', mq: 'MQ', recon: 'RCN'
  };
  var WIN_FALLBACK = { '5m': 1, '15m': 3, '1h': 12, '3h': 36, '6h': 72, '12h': 144, '24h': 288, '2d': 576, '7d': 2016 };
  var WIN_LABEL = { '5m': '5 min', '15m': '15 min', '1h': '1 hour', '3h': '3 hours', '6h': '6 hours',
    '12h': '12 hours', '24h': '24 hours', '2d': '2 days', '7d': '7 days' };
  var CLS_ORDER = { conn: 0, appA: 1, appB: 2, logA: 3, logB: 4 };
  var SEV_RANK = { ok: 0, warn: 1, crit: 2 };

  /* ------------------------------------------------------------- plumbing */
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function safe(fn, dflt) { try { return fn(); } catch (e) { return dflt; } }
  function dstamp(i) { return safe(function () { return api.dstamp(i); }, 'step ' + i); }
  function fmtDur(st) { return safe(function () { return api.fmtDur(st); }, (st * 5) + 'm'); }
  function statusColor(s) {
    return safe(function () { return api.statusColor(s); },
      'var(--' + (s === 'ok' || s === 'warn' || s === 'crit' ? s : 'unk') + ')');
  }
  function chip(s) {
    return safe(function () { return api.chip(s); }, '<span class="sevchip ' + esc(s) + '">' + esc(s) + '</span>');
  }
  function tableEmpty(msg, warn, extra) {
    return '<div class="tbl-empty ' + (warn ? 'warnc ' : '') + (extra || '') + '">' + esc(msg) + '</div>';
  }
  function sevRank(s) { return SEV_RANK[s] === undefined ? 0 : SEV_RANK[s]; }
  function winLabel(v) { return WIN_LABEL[v] || v; }
  function winSteps(v) {
    var m = (api && api.WIN) || null;
    return (m && m[v]) || WIN_FALLBACK[v] || WIN_FALLBACK['1h'];
  }
  function curStep() {
    return safe(function () { return api.cur(); },
      (api && typeof api.N === 'number') ? api.N - 1 : 0);
  }
  function reduced() {
    if (document.documentElement.getAttribute('data-motion') === 'reduce') return true;
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function nodeById(id) {
    if (!api || !api.NODES) return null;
    for (var i = 0; i < api.NODES.length; i++) if (api.NODES[i].id === id) return api.NODES[i];
    return null;
  }
  function nodeName(id) { var n = nodeById(id); return (n && n.name) || id || '—'; }
  function shortName(id) { return SHORT[id] || String(id || '').slice(0, 3).toUpperCase(); }
  function objOf(nid, label) {
    var n = nodeById(nid);
    if (!n || !n.objs) return null;
    for (var i = 0; i < n.objs.length; i++) if (n.objs[i].label === label) return n.objs[i];
    return null;
  }
  /* LINKS entries are [from,to,weight] arrays carrying the precomputed line
     model as properties; read defensively so an object-shaped link still works */
  function endA(L) { return (L && L[0] !== undefined) ? L[0] : (L && L.from); }
  function endB(L) { return (L && L[1] !== undefined) ? L[1] : (L && L.to); }
  function linkId(L, i) {
    if (L && L.bind && L.bind.id) return L.bind.id;
    if (L && L.id) return L.id;
    return 'E' + (i + 1 < 10 ? '0' : '') + (i + 1);
  }

  /* ==================================================================== */
  /* ===================== LINE CONDITIONS WINDOW ======================= */
  /* ==================================================================== */

  function evCell(rule) {
    if (!rule.ev) return '<span class="evdash">—</span>';
    var all = ['CONN', 'APP', 'LOG'], h = '';
    for (var i = 0; i < all.length; i++) {
      var on = rule.ev.indexOf(all[i]) >= 0;
      h += '<span class="evtag ' + (on ? all[i].toLowerCase() : 'off') + '">' + all[i] + '</span>';
    }
    return h;
  }

  function renderLC() {
    var body = $('lcBody');
    if (!body || lcFilled) return;
    var h = '';

    /* evidence-class vocabulary strip */
    h += '<div class="lcw-vocab">';
    for (var v = 0; v < VOCAB.length; v++) {
      h += '<div class="evchip"><b>' + esc(VOCAB[v][0]) + '</b><span>' + esc(VOCAB[v][1]) + '</span></div>';
    }
    h += '</div><div class="lcw-note">' + esc(VOCAB_NOTE) + '</div>';

    /* the rule table — .tblwrap + table.dt, so it inherits the sticky header,
       zebra rows and type scale with zero new table CSS */
    h += '<div class="tblwrap"><table class="dt"><thead><tr>' +
      '<th>Rule</th><th>Condition</th><th>Evidence</th><th>Line</th>' +
      '</tr></thead><tbody>';
    for (var i = 0; i < LC_RULES.length; i++) {
      var r = LC_RULES[i];
      h += '<tr data-rule="' + esc(r.id) + '" id="lcrow-' + esc(r.id) + '">' +
        '<td class="rule">' + esc(r.id) + '</td>' +
        '<td class="cond">' + esc(r.cond) + '</td>' +
        '<td class="ev">' + evCell(r) + '</td>' +
        '<td class="st"><span class="sevchip ' + esc(r.state) + '">' + esc(r.line) + '</span></td></tr>';
    }
    h += '</tbody></table></div>';

    /* footer copy */
    h += '<div class="lcw-foot">';
    for (var f = 0; f < LC_FOOT.length; f++) h += '<div>' + esc(LC_FOOT[f]) + '</div>';
    h += '</div>';

    body.innerHTML = h;
    lcFilled = true;
  }

  /* Expanding the reference window inside a 252px dock would leave it a sliver
     (the CSS keeps every section inside --bh rather than letting one spill over
     the timeline). So opening it grows the dock the way dragging #bhandle would
     — same 520px / viewport-220 ceiling the engine's own resize clamps to, only
     ever upward, and Reset puts --bh back to 252 like everything else. */
  function ensureRoom() {
    try {
      var el = document.documentElement;
      var now = parseInt(getComputedStyle(el).getPropertyValue('--bh'), 10);
      if (!now) now = 252;
      var ceil = Math.min(520, Math.max(120, window.innerHeight - 220));
      var want = Math.min(500, ceil);
      if (now < want) el.style.setProperty('--bh', want + 'px');
    } catch (e) { /* the window still opens, just tighter */ }
  }

  function setLC(open) {
    lcOpen = !!open;
    var b = $('lcBody'), t = $('lcToggle');
    if (b) b.classList.toggle('open', lcOpen);
    if (t) t.setAttribute('aria-expanded', lcOpen ? 'true' : 'false');
    if (lcOpen) ensureRoom();
  }

  function wireLC() {
    if (wiredLC) return;
    var t = $('lcToggle');
    if (!t) return;
    t.addEventListener('click', function () { renderLC(); setLC(!lcOpen); });
    /* Reset returns the window to collapsed, and puts Timeframe D's own three
       controls back to their defaults the way resetAll() does for A/B/C. The
       engine owns resetAll(); this listens to the same button rather than
       reaching into it, and runs after it (the engine's onclick was assigned
       first), so the defaults are what survive. */
    var rb = $('resetbtn');
    if (rb) rb.addEventListener('click', function () {
      setLC(false);
      var w = $('dWin'), s = $('dSev'), n = $('dNode');
      if (w) w.value = '1h';
      if (s) s.value = 'all';
      if (n) n.value = 'all';
      dSort = { key: 'when', dir: -1 };
      refresh();
    });
    setLC(false);          /* collapsed by default */
    wiredLC = true;
  }

  /* open the window at one rule — used by every LC-xx chip in Timeframe D */
  function openRule(id) {
    renderLC();
    setLC(true);
    var row = $('lcrow-' + id), body = $('lcBody');
    if (!row || !body) return;
    var rows = body.querySelectorAll('tbody tr');
    for (var i = 0; i < rows.length; i++) rows[i].classList.remove('hit');
    row.classList.add('hit');
    /* scroll inside the window's own scroller. The page itself cannot scroll
       (body{overflow:hidden}), so this can only ever move .lcw-body. */
    if (row.scrollIntoView) safe(function () { row.scrollIntoView({ block: 'nearest' }); });
    else body.scrollTop = Math.max(0, row.offsetTop - 24);
  }

  /* ==================================================================== */
  /* ========================== TIMEFRAME D ============================= */
  /* ==================================================================== */

  /* every episode of every link that intersects the window ending at cur */
  function collect(lo, cur) {
    var out = [];
    if (!api || !api.LINKS) return out;
    for (var i = 0; i < api.LINKS.length; i++) {
      var L = api.LINKS[i], eps = L && L.eps;
      if (!eps || !eps.length) continue;                 /* grey lines have none */
      for (var e = 0; e < eps.length; e++) {
        var ep = eps[e];
        if (!ep || typeof ep.start !== 'number') continue;
        var end = (typeof ep.end === 'number') ? ep.end : ep.start;
        if (ep.start > cur) continue;                    /* never quote the future */
        if (end < lo) continue;
        out.push({ idx: i, L: L, ep: ep, id: linkId(L, i), a: endA(L), b: endB(L),
          clipped: ep.start < lo, shownEnd: Math.min(end, cur) });
      }
    }
    return out;
  }

  function sortRows(rows) {
    var k = dSort.key, d = dSort.dir;
    rows.sort(function (x, y) {
      var vx, vy;
      if (k === 'for') { vx = x.shownEnd - x.ep.start; vy = y.shownEnd - y.ep.start; }
      else if (k === 'sev') { vx = sevRank(x.ep.worst); vy = sevRank(y.ep.worst); }
      else { vx = x.ep.start; vy = y.ep.start; }
      if (vx !== vy) return (vx < vy ? -1 : 1) * d;
      var sx = sevRank(x.ep.worst), sy = sevRank(y.ep.worst);
      if (sx !== sy) return sy - sx;                       /* ties: severity … */
      return x.id < y.id ? -1 : x.id > y.id ? 1 : 0;       /* … then link id */
    });
    return rows;
  }

  function glyph(aId, bId, worst) {
    var col = statusColor(worst), t = esc(nodeName(aId) + ' — ' + nodeName(bId));
    return '<svg class="oo-glyph" viewBox="0 0 96 22" width="96" height="22" role="img" aria-label="' + t + '">' +
      '<title>' + t + '</title>' +
      '<line x1="14" y1="7" x2="82" y2="7" stroke="' + esc(col) + '" stroke-width="2.4" stroke-linecap="round"/>' +
      '<circle class="oo-c" cx="8" cy="7" r="6"/><circle class="oo-c" cx="88" cy="7" r="6"/>' +
      '<text class="oo-t" x="8" y="20">' + esc(shortName(aId)) + '</text>' +
      '<text class="oo-t" x="88" y="20">' + esc(shortName(bId)) + '</text></svg>';
  }

  function clsLabel(cls) { return cls === 'conn' ? 'CONN' : (String(cls || '').indexOf('log') === 0 ? 'LOG' : 'APP'); }

  /* which endpoint an evidence row belongs to. The node that HOSTS the
     objective decides — that is what col-group 2 is grouped by — with the
     class suffix as the fallback when a contrib carries no usable nid. */
  function sideOf(c, aId, bId) {
    if (c && c.nid) { if (c.nid === aId) return 'A'; if (c.nid === bId) return 'B'; }
    if (c && c.side === 'A') return 'A';
    if (c && c.side === 'B') return 'B';
    var cl = String((c && c.cls) || '');
    if (cl.slice(-1) === 'B') return 'B';
    return 'A';
  }

  function caseText(inc) {
    if (!inc) return null;
    var s = String(inc);
    if (/^[A-Za-z]$/.test(s) && api && api.incName) return safe(function () { return api.incName(s); }, s);
    return s;
  }

  /* build the aligned line stacks for col-groups 2 and 3 of one episode */
  function evidenceLines(r) {
    var cs = (r.ep.contrib || []).slice();
    cs.sort(function (x, y) {
      var d = sevRank(y.sev) - sevRank(x.sev);
      if (d) return d;
      var ox = CLS_ORDER[x.cls] === undefined ? 9 : CLS_ORDER[x.cls];
      var oy = CLS_ORDER[y.cls] === undefined ? 9 : CLS_ORDER[y.cls];
      return ox - oy;
    });
    var shown = cs.slice(0, 4), more = cs.length - shown.length, lines = [], s, i;
    var ends = [['A', r.a], ['B', r.b]];
    for (s = 0; s < ends.length; s++) {
      lines.push({ t: 'hd', nid: ends[s][1] });
      var mine = [];
      for (i = 0; i < shown.length; i++) if (sideOf(shown[i], r.a, r.b) === ends[s][0]) mine.push(shown[i]);
      if (!mine.length) lines.push({ t: 'none' });
      else for (i = 0; i < mine.length; i++) lines.push({ t: 'ev', c: mine[i] });
    }
    if (more > 0) lines.push({ t: 'more', n: more });
    return lines;
  }

  var GAP = '<span class="ev-gap"></span>';

  function cellObject(lines) {
    var h = '';
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i];
      if (l.t === 'hd') h += '<span class="objname" title="' + esc(nodeName(l.nid)) + '">' + esc(nodeName(l.nid)) + '</span>';
      else if (l.t === 'none') h += '<span class="ev-l mut">— no evidence bound at this end</span>';
      else if (l.t === 'more') h += '<span class="ev-more">+' + l.n + ' more</span>';
      else h += '<span class="ev-l" title="' + esc(l.c.label) + '">' +
        '<span class="sd" style="background:' + esc(statusColor(l.c.sev)) + '"></span>' + esc(l.c.label) + '</span>';
    }
    return h;
  }
  function cellClass(lines) {
    var h = '';
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i];
      if (l.t !== 'ev') { h += GAP; continue; }
      var cl = clsLabel(l.c.cls);
      h += '<span class="ev-l"><span class="evtag ' + cl.toLowerCase() + '">' + cl + '</span></span>';
    }
    return h;
  }
  function cellPeak(lines, r) {
    var h = '';
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i];
      if (l.t !== 'ev') { h += GAP; continue; }
      var o = objOf(l.c.nid, l.c.label), txt = '—';
      if (o && typeof r.ep.worstStep === 'number' && o.vals) {
        txt = safe(function () { return api.fmtVal(o, o.vals[r.ep.worstStep]); }, String(o.vals[r.ep.worstStep]));
      } else if (l.c.val !== undefined && l.c.val !== null) txt = String(l.c.val);
      h += '<span class="ev-l">' + esc(txt) + '</span>';
    }
    return h;
  }
  function cellThr(lines) {
    var h = '';
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i];
      if (l.t !== 'ev') { h += GAP; continue; }
      var c = l.c, o = objOf(c.nid, c.label);
      var dir = c.dir || (o && o.dir) || 'hi';
      var thr = (c.thr !== undefined && c.thr !== null) ? c.thr
        : (o ? (c.sev === 'crit' ? o.crit : o.warn) : null);
      h += '<span class="ev-l">' + (thr === null || thr === undefined ? '—'
        : esc((dir === 'hi' ? '>' : '<') + ' ' + thr)) + '</span>';
    }
    return h;
  }
  function cellSince(lines) {
    var h = '';
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i];
      if (l.t !== 'ev') { h += GAP; continue; }
      var st = l.c.objEpStart;
      h += '<span class="ev-l">' + (typeof st === 'number' ? esc(dstamp(st)) : '—') + '</span>';
    }
    return h;
  }
  function cellCase(lines) {
    var h = '';
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i];
      if (l.t !== 'ev') { h += GAP; continue; }
      var nm = caseText(l.c.inc);
      if (nm) h += '<span class="ev-l case hit" data-nid="' + esc(l.c.nid) + '" data-ind="' + esc(l.c.label) +
        '" title="' + esc(nm) + ' — open the incident detail">' + esc(nm) + '</span>';
      else h += '<span class="ev-l case">—</span>';
    }
    return h;
  }

  function sortTh(key, label) {
    var on = dSort.key === key;
    return '<th class="st" data-sort="' + key + '">' + label +
      ' <span class="ar">' + (on ? (dSort.dir < 0 ? '▼' : '▲') : '') + '</span></th>';
  }

  function renderD(rows) {
    /* three col-groups, left→right as an incident-explanation tree (R2 §6):
       what changed · where the evidence is · how deep the seeded data goes */
    var h = '<table class="dt">' +
      '<colgroup span="5"></colgroup><colgroup span="2"></colgroup><colgroup span="4"></colgroup>' +
      '<thead>' +
      '<tr class="grp"><th class="g" colspan="5">Line</th>' +
      '<th class="g" colspan="2">Related errors by node</th>' +
      '<th class="g" colspan="4">Log detail</th></tr>' +
      '<tr class="cols"><th class="fix"></th>' +
      sortTh('when', 'When') + sortTh('for', 'For') +
      '<th class="fix">Rule</th>' + sortTh('sev', 'Sev') +
      '<th class="fix grpl">Object</th><th class="fix">Class</th>' +
      '<th class="fix grpl">At peak</th><th class="fix">Threshold</th>' +
      '<th class="fix">Objective since</th><th class="fix">Case</th></tr>' +
      '</thead><tbody>';

    for (var i = 0; i < rows.length; i++) {
      var r = rows[i], ep = r.ep, lines = evidenceLines(r);
      var rule = ruleById(ep.ruleId) || null;
      var when = (r.clipped ? '<span class="dclip">⋯ </span>' : '') +
        esc(dstamp(ep.start)) + ' → ' + esc(dstamp(r.shownEnd));
      var whenTip = r.clipped
        ? 'began ' + dstamp(ep.start) + ' — before this window opened'
        : dstamp(ep.start) + ' → ' + dstamp(r.shownEnd);
      h += '<tr data-link="' + esc(r.id) + '" data-idx="' + r.idx + '" data-step="' +
          (typeof ep.worstStep === 'number' ? ep.worstStep : ep.start) + '">' +
        '<td class="glyph">' + glyph(r.a, r.b, ep.worst) + '</td>' +
        '<td class="when" title="' + esc(whenTip) + '">' + when + '</td>' +
        '<td class="when">' + esc(fmtDur(r.shownEnd - ep.start + 1)) + '</td>' +
        '<td>' + (ep.ruleId
          ? '<span class="lcchip" data-rule="' + esc(ep.ruleId) + '" title="' +
            esc(rule ? rule.cond : ep.ruleId) + '">' + esc(ep.ruleId) + '</span>'
          : '—') + '</td>' +
        '<td>' + chip(ep.worst) + '</td>' +
        '<td class="grpl">' + cellObject(lines) + '</td>' +
        '<td>' + cellClass(lines) + '</td>' +
        '<td class="grpl">' + cellPeak(lines, r) + '</td>' +
        '<td>' + cellThr(lines) + '</td>' +
        '<td>' + cellSince(lines) + '</td>' +
        '<td>' + cellCase(lines) + '</td></tr>';
    }
    return h + '</tbody></table>';
  }

  /* the grey-notice line is permanent: it rides under every render, full or
     empty, so "no rows" can never be read as "everything is fine everywhere" */
  function greyNote() { return tableEmpty(D_GREY_NOTE, true, 'dnote'); }

  function refresh() {
    try {
      var wrap = $('dWrap');
      if (!wrap) return;
      var winV = $('dWin') ? $('dWin').value : '1h';
      var sevV = $('dSev') ? $('dSev').value : 'all';
      var nodeV = $('dNode') ? $('dNode').value : 'all';
      var tag = $('dTag');
      if (tag) tag.textContent = winLabel(winV);

      if (!api) { wrap.innerHTML = tableEmpty(D_NO_ENGINE, true) + greyNote(); return; }

      var cur = curStep(), W = winSteps(winV), lo = Math.max(0, cur - W + 1);
      var rows = collect(lo, cur);

      /* filter in two named steps, so the empty state can name the filter that
         actually emptied the table rather than guessing at precedence */
      var afterNode = (nodeV === 'all') ? rows
        : rows.filter(function (r) { return r.a === nodeV || r.b === nodeV; });
      rows = afterNode;
      if (sevV === 'crit') rows = rows.filter(function (r) { return r.ep.worst === 'crit'; });
      else if (sevV === 'warn') rows = rows.filter(function (r) { return r.ep.worst !== 'ok'; });

      if (!rows.length) {
        var msg = D_EMPTY_NONE, warn = false;
        if (nodeV !== 'all' && !afterNode.length) { msg = D_EMPTY_NODE; warn = true; }
        else if (sevV === 'crit') { msg = D_EMPTY_CRIT; warn = true; }
        else if (sevV === 'warn') { msg = D_EMPTY_WARN; warn = true; }
        else if (nodeV !== 'all') { msg = D_EMPTY_NODE; warn = true; }
        wrap.innerHTML = tableEmpty(msg, warn) + greyNote();
        return;
      }
      sortRows(rows);
      rows = rows.slice(0, 40);                        /* density guard, as table C */
      wrap.innerHTML = renderD(rows) + greyNote();
    } catch (e) { /* the dock never takes the page down with it */ }
  }

  /* ------------------------------------------------------------ behaviour */
  function rowAction(idx, step, alsoRCA) {
    if (!api) return;
    if (typeof step === 'number' && typeof api.seek === 'function') safe(function () { api.seek(step); });
    if (typeof api.focusLinkMid === 'function') safe(function () { api.focusLinkMid(idx); });
    /* The balloon set opens on the next tick, NOT inside this click. The engine
       carries a document-level "click elsewhere dismisses sticky balloons"
       handler; this click is still bubbling towards it, so a set opened here
       would be torn down by the same event that asked for it. Deferring lets
       that handler see the pre-click state (dismissing an older sticky set, as
       it should) and opens this one immediately afterwards. */
    if (typeof api.openLineBalloons === 'function') {
      setTimeout(function () { safe(function () { api.openLineBalloons(idx, true); }); }, 0);
    }
    if (alsoRCA && typeof api.openRCA === 'function') {
      var W = winSteps('1h');                          /* R2 §6 · D11 — the 1h window */
      safe(function () { api.openRCA(alsoRCA.nid, alsoRCA.ind, W); });
    }
  }

  function wireD() {
    if (wiredD) return;
    var wrap = $('dWrap');
    if (!wrap) return;

    wrap.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;

      /* an LC-xx chip explains itself in the reference window — it never seeks */
      var lc = t.closest('.lcchip');
      if (lc) { e.stopPropagation(); openRule(lc.getAttribute('data-rule')); return; }

      /* sortable column headers — the cSortBy pattern, with the .ar marker */
      var th = t.closest('th[data-sort]');
      if (th) {
        var k = th.getAttribute('data-sort');
        if (dSort.key === k) dSort.dir *= -1; else { dSort.key = k; dSort.dir = -1; }
        refresh();
        return;
      }

      var tr = t.closest('tr[data-idx]');
      if (!tr) return;
      var idx = parseInt(tr.getAttribute('data-idx'), 10);
      var step = parseInt(tr.getAttribute('data-step'), 10);
      if (isNaN(idx)) return;

      /* "+N more" — same landing as the row, the balloon set carries the rest */
      var more = t.closest('.ev-more');
      var cs = t.closest('.case.hit');
      var rca = cs ? { nid: cs.getAttribute('data-nid'), ind: cs.getAttribute('data-ind') } : null;
      rowAction(idx, isNaN(step) ? null : step, rca);
      if (more) { /* the balloon set is already open sticky — nothing further */ }
    });

    ['dWin', 'dSev', 'dNode'].forEach(function (id) {
      var el = $(id);
      /* the engine appends these to its own change-listener array too; both
         paths land on the same idempotent render, so a double call is free */
      if (el) el.addEventListener('change', refresh);
    });
    wiredD = true;
  }

  function buildNodeOptions() {
    var sel = $('dNode');
    if (!sel || !api || !api.NODES) return;
    var keep = sel.value || 'all', h = '<option value="all">All objects</option>';
    for (var i = 0; i < api.NODES.length; i++) {
      var n = api.NODES[i];
      h += '<option value="' + esc(n.id) + '">' + esc(n.name) + '</option>';
    }
    sel.innerHTML = h;
    sel.value = keep;
    if (!sel.value) sel.value = 'all';
  }

  /* ==================================================================== */
  /* ============================= API ================================== */
  /* ==================================================================== */

  function init(a) {
    try {
      api = a || window.PULSE_ENGINE || null;
      renderLC(); wireLC();
      buildNodeOptions(); wireD();
      refresh();
    } catch (e) { /* never break the engine's boot */ }
  }

  function focusNewest() {
    try {
      /* the badge can fire while the tables are closed — reopen them through
         the engine's own control rather than reaching into its state */
      var bottom = $('bottom'), tt = $('tabtoggle');
      if (bottom && bottom.classList.contains('closed') && tt) tt.click();
      var s = $('dSev'); if (s) s.value = 'all';
      var n = $('dNode'); if (n) n.value = 'all';
      dSort = { key: 'when', dir: -1 };
      refresh();
      var wrap = $('dWrap');
      if (!wrap) return;
      wrap.scrollTop = 0;
      var first = wrap.querySelector('tbody tr');
      if (first && !reduced()) {
        first.classList.remove('flash');
        void first.offsetWidth;                        /* restart the keyframe */
        first.classList.add('flash');
      }
    } catch (e) { /* nothing here is worth an exception */ }
  }

  window.PULSE_TFD = { init: init, refresh: refresh, focusNewest: focusNewest };

  /* Boot. The Line Conditions window is reference material — it must be there
     whether or not the engine ever calls init(). Both routes are idempotent. */
  function boot() {
    try {
      renderLC(); wireLC(); wireD();
      if (!api) refresh();                             /* D declares its own state */
    } catch (e) { /* ignore */ }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
