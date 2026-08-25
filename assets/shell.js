/* ============================================================================
 * ADEPTIO Pulse — SHELL  ·  window.PULSE_SHELL   (v2.0.2 "one chrome")
 *
 * The page frame every menu / admin page wears: left nav (expanded / rail /
 * hidden, plus the <1024px off-canvas drawer), a two-row top chrome (a global
 * 56px band — breadcrumb, ⌘K, status, freshness, theme — sitting above each
 * page's own title/range-chip toolbar), a ⌘K command palette, and the footer
 * lineage strip. Also supplies the "Menus" launcher used by index.html /
 * flow-instrumentation.html and the top-only nav strip used by
 * incident-trace.html — both unchanged from v2.0.1.
 *
 * Classic script, no modules, no fetch — works over file://.
 * Requires assets/tokens.css + assets/shell.css. `.chips/.chip` (range chips)
 * are styled by assets/menus.css.
 *
 * PUBLIC API
 *   PULSE_SHELL.NAV                  nav model (groups -> links)
 *   PULSE_SHELL.PAGES                flat list of {path,label,group,icon}
 *   PULSE_SHELL.pathInfo(pathname?)  -> {dir,file,key,prefix}
 *   PULSE_SHELL.href(path)           -> path resolved for this page's depth
 *   PULSE_SHELL.icon(name,cls?)      -> inline <svg> string
 *   PULSE_SHELL.mount(opts)          -> builds the frame, returns the shell obj
 *                                       opts: {title,subtitle,freshness,lineage,
 *                                       ranges,range,navDefault,crumb}
 *   PULSE_SHELL.init(opts)           -> alias of mount() (the v2.0.1 name;
 *                                       kept so pre-contract callers still work)
 *   PULSE_SHELL.setRange(key,silent) / getRange()
 *   PULSE_SHELL.onRange(fn)          -> unsubscribe fn ('pulse:range')
 *   PULSE_SHELL.setTitle / setSubtitle / setFreshness / setLineage
 *   PULSE_SHELL.fresh(text)          -> alias of setFreshness (topbar-v2 name)
 *   PULSE_SHELL.status(ok,deg,crit)  -> renders the topbar-v2 status cluster
 *   PULSE_SHELL.navState() / navState(v)  -> get/set 'expanded'|'rail'|'hidden'
 *   PULSE_SHELL.palette.open/close/toggle -> the ⌘K command palette
 *   PULSE_SHELL.motion.get/set/toggle     -> the reduced-motion override
 *   PULSE_SHELL.theme.get/set/toggle/apply
 *   PULSE_SHELL.launcher(target,opt) -> mounts the Menus chip + dropdown
 *   PULSE_SHELL.strip(target,opt)    -> mounts the top-only nav strip
 *   PULSE_SHELL.main()               -> the page's content element
 *   PULSE_SHELL.ready(fn)            -> DOM-ready helper
 * Events: 'pulse:range' on document — detail {range,label,prev}
 *         'resize' on window — dispatched 220ms after an explicit nav-state
 *         change, so a page's own resize-driven layout (e.g. the front page's
 *         map) can react to the new --pnavw.
 * ==========================================================================*/
(function (global) {
  "use strict";

  var THEME_KEY    = 'adeptio_theme';
  var MOTION_KEY    = 'pulse.motion';
  var NAVSTATE_KEY  = 'pulse.nav.state';
  var RECENT_KEY    = 'pulse.recent';
  var FRESH     = 'Updated Aug 29 23:55 · seeded replay';
  var VALID_STATES = { expanded: 1, rail: 1, hidden: 1 };

  /* ------------------------------------------------------------------ icons
     24-box stroke glyphs. Chrome only — never a status colour. */
  var ICONS = {
    map:      'M3 6.5l6-2.5 6 2.5 6-2.5v14l-6 2.5-6-2.5-6 2.5zM9 4v14M15 6.5v14',
    flow:     'M4 7h5a3 3 0 013 3v4a3 3 0 003 3h5M4 7l3-3M4 7l3 3M20 17l-3-3M20 17l-3 3',
    calendar: 'M4 6a2 2 0 012-2h12a2 2 0 012 2v13a1 1 0 01-1 1H5a1 1 0 01-1-1zM4 9h16M8 2.5v3M16 2.5v3M9 14l2 2 4-4',
    layers:   'M3 4.5h18v5H3zM3 12h18v3.2H3zM3 17.4h18V20H3z',
    pulse:    'M2 12h4l2.5-7 4 14L15 12h7',
    server:   'M3 5.5h18v5H3zM3 13.5h18v5H3zM6.6 8h.01M6.6 16h.01M10.5 8h4M10.5 16h4',
    globe:    'M12 3a9 9 0 100 18 9 9 0 000-18zM3.4 9.5h17.2M3.4 14.5h17.2M12 3c-2.4 2.3-3.6 5.3-3.6 9s1.2 6.7 3.6 9c2.4-2.3 3.6-5.3 3.6-9S14.4 5.3 12 3z',
    plug:     'M9 3v6M15 3v6M6.5 9h11v3.5A5.5 5.5 0 0112 18a5.5 5.5 0 01-5.5-5.5zM12 18v3',
    branch:   'M6.5 4.5v9M6.5 20a2.2 2.2 0 100-4.4 2.2 2.2 0 000 4.4zM6.5 4.5a2.2 2.2 0 100-.1zM17.5 9.7a2.2 2.2 0 100-4.4 2.2 2.2 0 000 4.4zM17.5 9.7v1.6a3 3 0 01-3 3H9.5',
    alert:    'M12 4.2L21 19.5H3zM12 10v4M12 17h.01',
    route:    'M6 20V9a3 3 0 013-3h6a3 3 0 003-3M6 20h12M6 6.6a2.3 2.3 0 100-4.6 2.3 2.3 0 000 4.6zM18 22a2.3 2.3 0 100-4.6A2.3 2.3 0 0018 22z',
    clipboard:'M9 4.2h6M8 4.2h8a2 2 0 012 2V20a1 1 0 01-1 1H7a1 1 0 01-1-1V6.2a2 2 0 012-2zM9.5 11h5M9.5 15h5',
    bug:      'M8 8.5a4 4 0 018 0v4a4 4 0 01-8 0zM4 10h4M16 10h4M4 16h4.6M15.4 16H20M9.5 4.6L11 6.4M14.5 4.6L13 6.4M12 20.5V16',
    ticket:   'M4 7.5h16v3a1.8 1.8 0 000 3.6v3H4v-3a1.8 1.8 0 000-3.6zM12 8v2M12 13v3',
    database: 'M4 6.4c0-1.4 3.6-2.6 8-2.6s8 1.2 8 2.6-3.6 2.6-8 2.6-8-1.2-8-2.6zM4 6.4v11.2c0 1.4 3.6 2.6 8 2.6s8-1.2 8-2.6V6.4M4 12c0 1.4 3.6 2.6 8 2.6s8-1.2 8-2.6',
    grid:     'M4 4.5h6.2v6.2H4zM13.8 4.5H20v6.2h-6.2zM4 13.8h6.2V20H4zM13.8 13.8H20V20h-6.2z',
    menu:     'M4 7h16M4 12h16M4 17h16',
    chevron:  'M6 9.5l6 6 6-6',
    sun:      'M12 7.4a4.6 4.6 0 100 9.2 4.6 4.6 0 000-9.2zM12 2v2.4M12 19.6V22M2 12h2.4M19.6 12H22M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M19.1 4.9l-1.7 1.7M6.6 17.4l-1.7 1.7',
    moon:     'M21 12.8A9 9 0 1111.2 3 7 7 0 0021 12.8z'
  };

  function icon(name, cls) {
    var d = ICONS[name] || ICONS.grid;
    return '<svg class="' + (cls || 'pn-ic') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
           'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
           '<path d="' + d + '"/></svg>';
  }

  /* the search glyph used by #pkbtn and the palette's own input — a two-part
     SVG (circle + path), which the single-<path> icon() helper above cannot
     express, so it is written out once here and reused by both call sites. */
  function searchIconSvg(cls) {
    return '<svg class="' + (cls || 'psrch-ic') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
           'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
           '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>';
  }

  /* ------------------------------------------------------- the nav model
     Groups and order are fixed by SPEC-Shell-v2.0.2 §6: MAIN / HEALTH /
     RELIABILITY / INVESTIGATE / OPERATE. `path` is always written relative to
     the SITE ROOT; href() prepends '../' on menus/ and admin/. Paths and
     icons are unchanged from v2.0.1 — only the grouping/order moved. */
  var NAV = [
    { group: 'MAIN', links: [
      { path: 'index.html',                  label: 'Front page',           icon: 'map'  },
      { path: 'flow-instrumentation.html',   label: 'Flow instrumentation', icon: 'flow' }
    ]},
    { group: 'HEALTH', links: [
      { path: 'menus/kpi-live.html',         label: 'KPI Live',          icon: 'pulse'  },
      { path: 'menus/service-health.html',   label: 'Service Health',    icon: 'server' },
      { path: 'menus/dependencies.html',     label: 'Dependencies',      icon: 'branch' },
      { path: 'menus/downstream.html',       label: 'Downstream Health', icon: 'plug'   }
    ]},
    { group: 'RELIABILITY', links: [
      { path: 'menus/sla-weekly.html',       label: 'SLA Weekly',        icon: 'calendar' },
      { path: 'menus/sla-drilldown.html',    label: 'SLA Drill-down',    icon: 'layers'   },
      { path: 'menus/synthetic.html',        label: 'Synthetic Insight', icon: 'globe'    }
    ]},
    { group: 'INVESTIGATE', links: [
      { path: 'menus/errors.html',           label: 'Errors Explorer',  icon: 'alert'  },
      { path: 'menus/error-tracking.html',   label: 'Error Tracking',   icon: 'bug'    },
      { path: 'menus/journey.html',          label: 'Customer Journey', icon: 'route'  },
      { path: 'incident-trace.html',         label: 'Incident Trace',   icon: 'ticket' }
    ]},
    { group: 'OPERATE', links: [
      { path: 'menus/ops-issues.html',       label: 'Ops Issues',              icon: 'clipboard' },
      { path: 'admin/collectors.html',       label: 'Collectors & management', icon: 'database'  }
    ]}
  ];

  var PAGES = [];
  for (var gi = 0; gi < NAV.length; gi++) {
    for (var li = 0; li < NAV[gi].links.length; li++) {
      var lk = NAV[gi].links[li];
      PAGES.push({ path: lk.path, label: lk.label, icon: lk.icon, group: NAV[gi].group });
    }
  }
  function findPage(path) {
    for (var i = 0; i < PAGES.length; i++) if (PAGES[i].path === path) return PAGES[i];
    return null;
  }

  /* --------------------------------------------------------- path helpers */
  function pathInfo(pathname) {
    var p = pathname;
    if (p == null) p = (typeof location !== 'undefined' && location.pathname) || '';
    try { p = decodeURIComponent(p); } catch (e) { /* keep raw */ }
    var segs = String(p).split('/');
    var file = segs.length ? segs[segs.length - 1] : '';
    var dir  = segs.length > 1 ? segs[segs.length - 2] : '';
    if (!file) file = 'index.html';
    var inSub = (dir === 'menus' || dir === 'admin');
    return {
      dir: dir,
      file: file,
      key: inSub ? (dir + '/' + file) : file,
      prefix: inSub ? '../' : ''
    };
  }

  var INFO = pathInfo();

  function href(path) { return INFO.prefix + path; }

  function isActive(path) {
    if (INFO.key === path) return true;
    /* root pages are keyed by filename alone */
    return (INFO.prefix === '' && path.indexOf('/') === -1 && path === INFO.file);
  }

  /* ------------------------------------------------------------ storage */
  function storeGet(k) {
    try { return global.localStorage ? global.localStorage.getItem(k) : null; }
    catch (e) { return null; }
  }
  function storeSet(k, v) {
    try { if (global.localStorage) global.localStorage.setItem(k, v); }
    catch (e) { /* private mode / blocked origin: stay silent */ }
  }

  /* ------------------------------------------------------------ theme */
  var theme = {
    get: function () {
      var el = global.document && global.document.documentElement;
      return (el && el.getAttribute('data-theme')) || 'dark';
    },
    set: function (v, persist) {
      var t = (v === 'light') ? 'light' : 'dark';
      var el = global.document && global.document.documentElement;
      if (el) el.setAttribute('data-theme', t);
      if (persist !== false) storeSet(THEME_KEY, t);
      syncThemeButtons(t);
      return t;
    },
    toggle: function () { return theme.set(theme.get() === 'dark' ? 'light' : 'dark'); },
    /* honour html[data-theme] as the default; a stored choice wins over it */
    apply: function () {
      var stored = storeGet(THEME_KEY);
      var cur = theme.get();
      var t = (stored === 'light' || stored === 'dark') ? stored : cur;
      var el = global.document && global.document.documentElement;
      if (el && el.getAttribute('data-theme') !== t) el.setAttribute('data-theme', t);
      syncThemeButtons(t);
      return t;
    }
  };

  var themeBtns = [];
  function syncThemeButtons(t) {
    var next = (t === 'dark') ? 'light' : 'dark';
    for (var i = 0; i < themeBtns.length; i++) {
      var b = themeBtns[i];
      if (!b || !b.querySelector) continue;
      var lb = b.querySelector('.pth-l');
      if (lb) lb.textContent = (next === 'light') ? 'Light' : 'Dark';
      var ic = b.querySelector('.pth-i');
      if (ic) ic.innerHTML = iconInner(next === 'light' ? 'sun' : 'moon');
      b.setAttribute('title', 'Switch to the ' + next + ' theme');
      b.setAttribute('aria-label', 'Switch to the ' + next + ' theme');
    }
  }
  function iconInner(name) { return '<path d="' + (ICONS[name] || '') + '"/>'; }

  /* -------------------------------------------------------------- motion
     A user-facing override on top of the OS `prefers-reduced-motion` media
     query. It can only ever force motion OFF (html[data-motion="reduce"]) —
     there is no override to force motion back on against the reader's own
     system preference. "auto" clears the override and defers to the media
     query. Every shell animation (ECG draw, pip beat, nav width/label fade)
     honours BOTH signals — see the reduced-motion rules in shell.css. */
  function motionReduced() {
    var el = global.document && global.document.documentElement;
    if (el && el.getAttribute('data-motion') === 'reduce') return true;
    try { return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches); }
    catch (e) { return false; }
  }
  var motion = {
    get: function () { return motionReduced() ? 'reduce' : 'auto'; },
    isForced: function () {
      var el = global.document && global.document.documentElement;
      return !!(el && el.getAttribute('data-motion') === 'reduce');
    },
    set: function (v, persist) {
      var el = global.document && global.document.documentElement;
      if (v === 'reduce') {
        if (el) el.setAttribute('data-motion', 'reduce');
        if (persist !== false) storeSet(MOTION_KEY, 'reduce');
      } else {
        if (el) el.removeAttribute('data-motion');
        if (persist !== false) storeSet(MOTION_KEY, 'auto');
      }
      return motion.get();
    },
    toggle: function () { return motion.set(motion.isForced() ? 'auto' : 'reduce'); },
    apply: function () {
      var stored = storeGet(MOTION_KEY);
      if (stored === 'reduce' || stored === 'auto') motion.set(stored, false);
      /* no stored value: leave html[data-motion] untouched, OS pref governs */
    }
  };

  /* ------------------------------------------------------------ dom utils */
  function d() { return global.document; }
  function el(tag, cls, html) {
    var n = d().createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function ready(fn) {
    var doc = d();
    if (!doc) return;
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', fn);
    else fn();
  }
  function isTypingTarget(t) {
    if (!t || !t.tagName) return false;
    var tag = String(t.tagName).toUpperCase();
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  }

  /* --------------------------------------------------------- range labels */
  var RANGE_LABEL = {
    '1h': '1h', '4h': '4h', '12h': '12h', '24h': '24h', '7d': '7d',
    'wk': 'Week', 'yesterday': 'Yesterday', '30d': '30d', '5m': '5m', '1m': '1m'
  };
  function rangeList(spec) {
    if (!spec) return [];
    var arr = (typeof spec === 'string') ? spec.split(',') : spec;
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var it = arr[i];
      if (it == null) continue;
      if (typeof it === 'string') {
        var k = it.trim();
        if (!k) continue;
        out.push({ key: k, label: RANGE_LABEL[k] || k });
      } else if (it.key) {
        out.push({ key: it.key, label: it.label || RANGE_LABEL[it.key] || it.key });
      }
    }
    return out;
  }

  /* ============================================================== SHELL === */
  var S = {
    root: null, nav: null, top: null, toolbar: null, mainEl: null, foot: null,
    chipWrap: null, ranges: [], range: null, mode: 'expanded', navDefaultOpt: null
  };

  /* ----------------------------------------------------------- brand block
     .pnav-brand = .pnb-home (mark+wordmark, <a> to site home) + .pnb-expand
     (a full-cover button, shown only in rail — Linear pattern: the mark
     itself is the expand control there) + .pnb-toggle (the chevron, visible
     in expanded state, collapses). Same SVG family as the legacy marks in
     styles.css/flow.css; .pm-pip is new (§3). */
  function brandMarkup() {
    var home = href('index.html');
    var h = '<div class="pnav-brand">';
    h += '<a class="pnb-home" href="' + esc(home) + '" title="Pulse — home" aria-label="Pulse — home">' +
         '<svg class="pulsemark" width="26" height="26" viewBox="0 0 28 28" role="img" aria-label="ADEPTIO Pulse">' +
         '<rect class="pm-badge" x="1" y="1" width="26" height="26" rx="8"/>' +
         '<path class="pm-trace" d="M4.6 14.5H9.6L11.6 8L14.6 20.6L16.6 14.5H23.4"/>' +
         '<circle class="pm-pip" cx="23.4" cy="14.5" r="2.2"/></svg>' +
         '<span class="pnb-t"><span class="pnb-w">adeptio<i>.</i></span><span class="pnb-p">Pulse</span></span>' +
         '</a>';
    h += '<button class="pnb-expand" id="pnbexpand" type="button" title="Expand menu" ' +
         'aria-label="Expand menu" aria-expanded="false" aria-controls="pnav"></button>';
    h += '<button class="pnb-toggle" id="pnbtoggle" type="button" aria-expanded="true" aria-controls="pnav" ' +
         'title="Collapse menu" aria-label="Collapse menu">' +
         '<svg class="pnb-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
         'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>' +
         '</button>';
    h += '</div>';
    return h;
  }

  function navMarkup() {
    var h = '';
    h += brandMarkup();
    h += '<div class="pnav-grip" id="pnavgrip" aria-hidden="true"></div>';
    h += '<nav class="pn-nav" aria-label="Pulse sections">';
    for (var i = 0; i < NAV.length; i++) {
      var g = NAV[i];
      h += '<div class="pn-group"><div class="pn-gt" id="pngt' + i + '">' + g.group + '</div>' +
           '<div role="group" aria-labelledby="pngt' + i + '">';
      for (var j = 0; j < g.links.length; j++) {
        var lk = g.links[j], on = isActive(lk.path);
        h += '<a class="pn-link' + (on ? ' on' : '') + '" href="' + href(lk.path) + '" ' +
             'data-path="' + esc(lk.path) + '"' + (on ? ' aria-current="page"' : '') +
             ' title="' + esc(lk.label) + '">' +
             icon(lk.icon) + '<span class="pn-lb">' + lk.label + '</span></a>';
      }
      h += '</div></div>';
    }
    h += '</nav>';
    h += '<div class="pnav-foot"><b>Seeded replay.</b> One canonical week, ' +
         'computed from collector lanes — no APM agent.</div>';
    return h;
  }

  /* ---------------------------------------------------- topbar v2 (row 1)
     One 56px global band: breadcrumb · spacer · ⌘K · status · freshness ·
     theme. Aligns with the 56px brand block so nav+topbar read as one band. */
  function topbarMarkup(cfg) {
    var h = '';
    h += '<nav class="pcrumb" id="pcrumb" aria-label="Breadcrumb">' + crumbInnerHtml(cfg.crumb, cfg.title) + '</nav>';
    h += '<div class="ptbsp"></div>';
    h += '<button class="pkbtn" id="pkbtn" type="button" aria-haspopup="dialog" aria-expanded="false" ' +
         'aria-controls="ppal" title="Search screens and commands (Ctrl/Cmd K)">' +
         searchIconSvg('psrch-ic') + '<span class="pkbtn-l">Search</span><span class="pkbtn-k">&#8984;K</span></button>';
    h += '<div class="pstatus" id="pstatus" hidden aria-live="polite">' +
         '<span class="pst-dot" aria-hidden="true"></span>' +
         '<span class="pst-n"><b id="pstok">0</b> OK</span>' +
         '<span class="pst-n pst-warn"><b id="pstdeg">0</b> deg</span>' +
         '<span class="pst-n pst-crit"><b id="pstcrit">0</b> crit</span></div>';
    h += '<div class="pfresh"><span class="pdot" aria-hidden="true"></span>' +
         '<span class="pfresh-t" id="pfresh">' + esc(cfg.freshness) + '</span></div>';
    h += '<button class="ptheme" id="pthemebtn" type="button">' +
         '<svg class="pth-i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
         'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"></svg>' +
         '<span class="pth-l">Light</span></button>';
    return h;
  }

  /* -------------------------------------------------- page toolbar (row 2)
     The pre-existing title/subtitle/range-chip row — unchanged in behaviour,
     just relocated beneath the new global band (freshness + theme moved up
     into it, avoiding duplicate ids). This is "the page toolbar" §4 refers
     to: every page's data-title/data-subtitle/data-ranges keep rendering
     here exactly as they did in v2.0.1. */
  function toolbarMarkup(cfg) {
    var h = '';
    h += '<button class="pnavbtn" id="pnavbtn" type="button" aria-expanded="false" aria-controls="pnav" ' +
         'title="Show or hide the navigation" aria-label="Show or hide the navigation">' +
         icon('menu', 'pn-ic') + '</button>';
    h += '<div class="ptitle"><h1 id="ptitle">' + esc(cfg.title) + '</h1>' +
         (cfg.subtitle ? '<p class="psub" id="psub">' + esc(cfg.subtitle) + '</p>' : '<p class="psub" id="psub"></p>') +
         '</div>';
    h += '<div class="psp"></div>';
    h += '<div class="chips" id="prange" role="group" aria-label="Time range"></div>';
    return h;
  }

  function footMarkup(cfg) {
    return '<span class="pf-lin" id="pflineage"><b>Data lineage</b> · ' + esc(cfg.lineage || '—') + '</span>' +
           '<span class="pf-note">Figures are a seeded replay of one week; not customer data. ' +
           'Every number on this page is computed from the collector lanes named above — no APM agent.</span>';
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function readCfg(opts) {
    var b = d().body, ds = (b && b.dataset) || {};
    function pick(a, k, dflt) { return (a && a[k] != null) ? a[k] : (ds[k] != null ? ds[k] : dflt); }
    return {
      title:     pick(opts, 'title', d().title || 'Adeptio Pulse'),
      subtitle:  pick(opts, 'subtitle', ''),
      freshness: pick(opts, 'freshness', FRESH),
      lineage:   pick(opts, 'lineage', ''),
      ranges:    (opts && opts.ranges != null) ? opts.ranges : (ds.ranges != null ? ds.ranges : ''),
      range:     (opts && opts.range != null) ? opts.range : ds.range,
      navDefault:(opts && opts.navDefault != null) ? opts.navDefault : (ds.navDefault != null ? ds.navDefault : null),
      crumb:     (opts && opts.crumb) || null
    };
  }

  function contentEl() {
    var doc = d();
    var host = doc.getElementById('pulse-main') || doc.querySelector('[data-pulse-main]');
    if (host) return host;
    host = el('div', 'pcontent');
    host.id = 'pulse-main';
    var kids = [], b = doc.body, i;
    for (i = 0; i < b.childNodes.length; i++) {
      var n = b.childNodes[i];
      if (n.nodeType === 1 && (n.tagName === 'SCRIPT' || n.tagName === 'TEMPLATE')) continue;
      if (n.nodeType === 8) continue;
      kids.push(n);
    }
    for (i = 0; i < kids.length; i++) host.appendChild(kids[i]);
    return host;
  }

  /* ===================================================================== */
  function init(opts) {
    var doc = d();
    if (!doc || !doc.body) return S;
    if (S.root) return S;                       /* idempotent */
    var cfg = readCfg(opts || {});
    var body = doc.body;
    body.className = body.className ? (body.className + ' pshell-page') : 'pshell-page';

    var host = contentEl();

    var root = el('div', 'pshell');
    root.id = 'pshell';

    var skip = el('a', 'pskip', 'Skip to content');
    skip.href = '#pulse-main';

    var nav = el('aside', 'pnav', navMarkup());
    nav.id = 'pnav';

    var col     = el('div', 'pcol');
    var topbar  = el('header', 'ptopbar', topbarMarkup(cfg));
    topbar.id = 'ptopbar';
    var toolbar = el('div', 'ptop', toolbarMarkup(cfg));
    toolbar.id = 'ptop';
    var main = el('main', 'pmain');
    var foot = el('footer', 'pfoot', footMarkup(cfg));
    main.appendChild(host);
    col.appendChild(topbar); col.appendChild(toolbar); col.appendChild(main); col.appendChild(foot);

    var scrim = el('div', 'pscrim');
    scrim.id = 'pscrim';

    var reopen = el('button', 'pnav-reopen', '&rsaquo;');
    reopen.id = 'pnavreopen'; reopen.type = 'button';
    reopen.setAttribute('title', 'Show navigation');
    reopen.setAttribute('aria-label', 'Show navigation');
    reopen.setAttribute('aria-controls', 'pnav');

    root.appendChild(skip); root.appendChild(nav); root.appendChild(col);
    root.appendChild(scrim); root.appendChild(reopen);
    body.insertBefore(root, body.firstChild);

    S.root = root; S.nav = nav; S.top = topbar; S.toolbar = toolbar; S.mainEl = main; S.foot = foot;
    S.chipWrap = doc.getElementById('prange');
    S.navDefaultOpt = VALID_STATES[cfg.navDefault] ? cfg.navDefault : null;

    /* theme + motion */
    var tb = doc.getElementById('pthemebtn');
    if (tb) {
      themeBtns.push(tb);
      tb.addEventListener('click', function () { theme.toggle(); });
    }
    theme.apply();
    motion.apply();

    /* ---- brand toggle / expand / right-border grip / reopen tab -------- */
    var toggleBtn = doc.getElementById('pnbtoggle');
    var expandBtn = doc.getElementById('pnbexpand');
    var grip = doc.getElementById('pnavgrip');
    if (toggleBtn) toggleBtn.addEventListener('click', function () { toggleExpandRail(); });
    if (expandBtn) expandBtn.addEventListener('click', function () { toggleExpandRail(); });
    if (grip) grip.addEventListener('click', function () { toggleExpandRail(); });
    reopen.addEventListener('click', function () {
      navState('expanded');
      if (toggleBtn && toggleBtn.focus) toggleBtn.focus();
    });

    /* ---- <1024px drawer (hamburger) — existing behaviour, preserved ---- */
    var nb = doc.getElementById('pnavbtn');
    if (nb) nb.addEventListener('click', function () { toggleDrawer(); });
    scrim.addEventListener('click', function () { closeDrawer(); });

    /* ---- recent-screens: record on every sidebar nav click ------------- */
    nav.addEventListener('click', function (ev) {
      var t = ev.target;
      while (t && t !== nav && !(t.className && String(t.className).indexOf('pn-link') > -1)) t = t.parentNode;
      if (t && t !== nav) {
        var p = t.getAttribute && t.getAttribute('data-path');
        if (p) recordRecent(p);
      }
    });

    /* ---- palette ---- */
    buildPalette();
    var kbtn = doc.getElementById('pkbtn');
    if (kbtn) kbtn.addEventListener('click', function () { togglePalette(); });

    /* ---- global keyboard: [, Shift+[, Cmd/Ctrl+K, Esc ------------------
       Never trap keys while typing in an input/textarea/select — except Esc,
       which must still close the palette (or the drawer) from within it. */
    doc.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') {
        if (PAL.isOpen) { closePalette(); return; }
        if (S.root && S.mode === 'off' && S.root.className.indexOf('nav-open') > -1) { closeDrawer(); return; }
        return;
      }
      if (isTypingTarget(ev.target)) return;
      if ((ev.metaKey || ev.ctrlKey) && !ev.altKey && (ev.key === 'k' || ev.key === 'K')) {
        ev.preventDefault(); togglePalette(); return;
      }
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      if (ev.key === '{' || (ev.key === '[' && ev.shiftKey)) { ev.preventDefault(); navState('hidden'); return; }
      if (ev.key === '[') { ev.preventDefault(); toggleExpandRail(); return; }
    });

    /* ---- nav state machine: initial paint + responsive recompute ------- */
    applyMode();
    if (global.addEventListener) {
      var tid = null;
      global.addEventListener('resize', function () {
        if (tid) global.clearTimeout(tid);
        tid = global.setTimeout(applyMode, 120);
      });
    }

    /* ---- range chips ---- */
    buildRanges(rangeList(cfg.ranges), cfg.range);

    /* ---- status cluster default (menus compute once from ADEPTIO_DATA) - */
    computeDefaultStatus();

    /* ---- ECG mark: run-once draw + beating pip -------------------------- */
    animateMark(nav.querySelector('.pnav-brand .pulsemark'));

    return S;
  }

  /* ------------------------------------------------------- nav state machine
     Desktop (>=1024px): exactly one of nav-expanded | nav-rail | nav-hidden
     on #pshell, persisted to localStorage["pulse.nav.state"]. <1024px: the
     v2.0.1 off-canvas drawer (nav-off [+ nav-open]) is preserved unchanged
     and takes priority over whatever desktop state is stored. */
  function viewportW() {
    var doc = d();
    return global.innerWidth || (doc && doc.documentElement && doc.documentElement.clientWidth) || 1280;
  }
  function readStoredState() {
    var v = storeGet(NAVSTATE_KEY);
    return VALID_STATES[v] ? v : null;
  }
  function computeDefaultState() {
    if (S.navDefaultOpt && VALID_STATES[S.navDefaultOpt]) return S.navDefaultOpt;
    return (viewportW() >= 1440) ? 'expanded' : 'rail';
  }
  /* combined getter/setter, per SPEC-Shell-v2.0.2 §1 / the S1 API surface */
  function navState(v) {
    if (v === undefined) return readStoredState() || computeDefaultState();
    if (!VALID_STATES[v]) return navState();
    storeSet(NAVSTATE_KEY, v);
    applyMode();
    scheduleResize();
    return v;
  }
  function toggleExpandRail() { navState(navState() === 'expanded' ? 'rail' : 'expanded'); }
  function scheduleResize() {
    global.setTimeout(function () {
      try { global.dispatchEvent(new global.Event('resize')); }
      catch (e) {
        try { var ev = d().createEvent('Event'); ev.initEvent('resize', true, true); global.dispatchEvent(ev); }
        catch (e2) { /* no synthetic-event support: nothing more we can do */ }
      }
    }, 220);
  }
  function applyMode() {
    if (!S.root) return;
    var w = viewportW();
    if (w < 1024) {
      var open = S.root.className.indexOf('nav-open') > -1;
      S.mode = 'off';
      S.root.className = 'pshell nav-off' + (open ? ' nav-open' : '');
      if (S.nav) S.nav.removeAttribute('aria-hidden');
    } else {
      var st = navState();
      S.mode = st;
      S.root.className = 'pshell nav-' + st;
      if (S.nav) {
        if (st === 'hidden') S.nav.setAttribute('aria-hidden', 'true');
        else S.nav.removeAttribute('aria-hidden');
      }
    }
    syncBrandToggle();
  }
  function syncBrandToggle() {
    var doc = d();
    var expanded = (S.mode === 'expanded');
    var label = expanded ? 'Collapse menu' : 'Expand menu';
    var tbtn = doc.getElementById('pnbtoggle'), ebtn = doc.getElementById('pnbexpand');
    if (tbtn) {
      tbtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      tbtn.setAttribute('title', label);
      tbtn.setAttribute('aria-label', label);
    }
    if (ebtn) ebtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  }
  function toggleDrawer() {
    if (!S.root || S.mode !== 'off') return;
    var open = S.root.className.indexOf('nav-open') > -1;
    if (open) closeDrawer(); else openDrawer();
  }
  function openDrawer() {
    S.root.className = 'pshell nav-off nav-open';
    var nb = d().getElementById('pnavbtn');
    if (nb) nb.setAttribute('aria-expanded', 'true');
    var first = S.nav && S.nav.querySelector('.pn-link');
    if (first && first.focus) first.focus();
  }
  function closeDrawer() {
    if (!S.root) return;
    S.root.className = 'pshell nav-off';
    var nb = d().getElementById('pnavbtn');
    if (nb) { nb.setAttribute('aria-expanded', 'false'); if (nb.focus) nb.focus(); }
  }

  /* ---------------------------------------------------------- range chips */
  function buildRanges(list, initial) {
    S.ranges = list || [];
    if (!S.chipWrap) return;
    if (!S.ranges.length) { S.chipWrap.innerHTML = ''; S.chipWrap.hidden = true; return; }
    S.chipWrap.hidden = false;
    var h = '', i;
    for (i = 0; i < S.ranges.length; i++) {
      h += '<button class="chip" type="button" data-range="' + esc(S.ranges[i].key) + '" ' +
           'aria-pressed="false">' + esc(S.ranges[i].label) + '</button>';
    }
    S.chipWrap.innerHTML = h;
    S.chipWrap.addEventListener('click', function (ev) {
      var t = ev.target;
      while (t && t !== S.chipWrap && !(t.getAttribute && t.getAttribute('data-range'))) t = t.parentNode;
      if (!t || t === S.chipWrap) return;
      setRange(t.getAttribute('data-range'));
    });
    var start = initial;
    if (!start) {
      for (i = 0; i < S.ranges.length; i++) if (S.ranges[i].key === '24h') { start = '24h'; break; }
    }
    setRange(start || S.ranges[0].key, true);
  }

  function setRange(key, silent) {
    if (!key) return null;
    var prev = S.range, found = null, i;
    for (i = 0; i < S.ranges.length; i++) if (S.ranges[i].key === key) found = S.ranges[i];
    if (!found) return null;
    S.range = key;
    if (S.chipWrap) {
      var btns = S.chipWrap.querySelectorAll('[data-range]');
      for (i = 0; i < btns.length; i++) {
        var on = btns[i].getAttribute('data-range') === key;
        btns[i].className = on ? 'chip on' : 'chip';
        btns[i].setAttribute('aria-pressed', on ? 'true' : 'false');
      }
    }
    if (!silent && global.CustomEvent) {
      var evt = new global.CustomEvent('pulse:range', {
        bubbles: true, detail: { range: key, label: found.label, prev: prev }
      });
      (S.chipWrap || d()).dispatchEvent(evt);
    }
    return key;
  }

  function onRange(fn) {
    var doc = d();
    doc.addEventListener('pulse:range', fn);
    return function () { doc.removeEventListener('pulse:range', fn); };
  }

  /* ------------------------------------------------------------ mutators */
  function setText(id, s) { var n = d().getElementById(id); if (n) n.textContent = s; return n; }
  function setTitleTxt(s) { setText('ptitle', s); if (d()) d().title = s; }
  function setSubtitle(s) { setText('psub', s); }
  function setFreshness(s) { setText('pfresh', s); }
  function setLineage(s) {
    var n = d().getElementById('pflineage');
    if (n) n.innerHTML = '<b>Data lineage</b> · ' + esc(s);
  }

  /* ------------------------------------------------------- status cluster
     #pstatus, rendered by PULSE_SHELL.status(ok,deg,crit). Menus compute a
     default once from ADEPTIO_DATA: the incident windows (INC) checked at
     t = N-1 (the last step of the seeded week) — none are active there, so
     the default is {ok: NODES.length, deg:0, crit:0}. Pages without
     ADEPTIO_DATA (e.g. the QA kit) get no default and the cluster hides. */
  function setStatus(ok, deg, crit) {
    var n = d().getElementById('pstatus');
    if (!n) return;
    if (ok == null && deg == null && crit == null) { n.hidden = true; return; }
    ok = ok || 0; deg = deg || 0; crit = crit || 0;
    n.hidden = false;
    n.className = 'pstatus ' + (crit > 0 ? 'crit' : (deg > 0 ? 'warn' : 'ok'));
    setText('pstok', String(ok));
    setText('pstdeg', String(deg));
    setText('pstcrit', String(crit));
    n.setAttribute('aria-label', ok + ' healthy, ' + deg + ' degraded, ' + crit + ' critical');
  }
  function computeDefaultStatus() {
    var D = global.ADEPTIO_DATA;
    if (!D || !D.NODES) return;                 /* guard: no data, cluster stays hidden */
    var total = D.NODES.length;
    var t = (typeof D.N === 'number' ? D.N : 2016) - 1;
    var inc = D.INC || {}, meta = D.INCMETA || {};
    var deg = 0, crit = 0, k;
    for (k in inc) {
      if (!Object.prototype.hasOwnProperty.call(inc, k)) continue;
      var w = inc[k];
      if (!w || !w.length) continue;
      var t0 = w[0], t1 = w[w.length - 1];
      if (t >= t0 && t <= t1) {
        var sev = (meta[k] && meta[k][1]) || 'warn';
        if (sev === 'crit') crit++; else deg++;
      }
    }
    var ok = total - deg - crit;
    if (ok < 0) ok = 0;
    setStatus(ok, deg, crit);
  }

  /* ------------------------------------------------------------ breadcrumb
     Auto-built from NAV: "Pulse" (root, links home) › GROUP › current page
     label. A page absent from NAV (e.g. a docs/dev reference page) falls
     back to "Pulse" › its own title. mount({crumb:[...]}) fully overrides —
     each item is a string (plain text) or {label,href}; the LAST item always
     renders as the current page (never a link), matching breadcrumb norms. */
  function autoCrumb(fallbackTitle) {
    var segs = [{ label: 'Pulse', href: href('index.html') }];
    var gi, li, found = null;
    for (gi = 0; gi < NAV.length && !found; gi++) {
      for (li = 0; li < NAV[gi].links.length; li++) {
        if (isActive(NAV[gi].links[li].path)) {
          found = { group: NAV[gi].group, label: NAV[gi].links[li].label };
          break;
        }
      }
    }
    if (found) {
      segs.push({ label: found.group });
      segs.push({ label: found.label });
    } else {
      segs.push({ label: fallbackTitle || d().title || 'Page' });
    }
    return segs;
  }
  function normalizeCrumb(arr) {
    var out = [], i, it;
    for (i = 0; i < arr.length; i++) {
      it = arr[i];
      if (it == null) continue;
      if (typeof it === 'string') out.push({ label: it });
      else if (it.label != null) out.push({ label: it.label, href: it.href || null });
    }
    return out;
  }
  function crumbInnerHtml(crumbOpt, fallbackTitle) {
    var segs = (crumbOpt && crumbOpt.length) ? normalizeCrumb(crumbOpt) : autoCrumb(fallbackTitle);
    var h = '', i;
    for (i = 0; i < segs.length; i++) {
      var s = segs[i], last = (i === segs.length - 1);
      if (i) h += '<span class="pcr-sep" aria-hidden="true">&rsaquo;</span>';
      if (last) h += '<span class="pcr-c" aria-current="page">' + esc(s.label) + '</span>';
      else if (s.href) h += '<a class="pcr-l" href="' + esc(s.href) + '">' + esc(s.label) + '</a>';
      else h += '<span class="pcr-g">' + esc(s.label) + '</span>';
    }
    return h;
  }

  /* ------------------------------------------------------------- recents
     localStorage "pulse.recent" — up to 5 NAV paths, most-recent-first.
     Updated on sidebar nav clicks (wired in init()) and on palette screen
     navigations (wired below). */
  function getRecents() {
    var raw = storeGet(RECENT_KEY), arr;
    try { arr = raw ? JSON.parse(raw) : []; } catch (e) { arr = []; }
    if (!Array.isArray(arr)) arr = [];
    return arr;
  }
  function recordRecent(path) {
    if (!path) return;
    var arr = getRecents(), out = [path], i;
    for (i = 0; i < arr.length; i++) if (arr[i] !== path) out.push(arr[i]);
    if (out.length > 5) out.length = 5;
    try { storeSet(RECENT_KEY, JSON.stringify(out)); } catch (e) { /* ignore */ }
  }

  /* ---------------------------------------------------------- fuzzy match
     Substring hits rank by earliest position; otherwise an in-order
     subsequence match scores on run length, so tighter matches (fewer gaps)
     sort first. Returns -1 for no match, so callers can filter on score>=0. */
  function fuzzyScore(q, text) {
    if (!q) return 1;
    q = String(q).toLowerCase(); text = String(text).toLowerCase();
    var idx = text.indexOf(q);
    if (idx > -1) return 1000 - idx;
    var ti = 0, qi = 0, score = 0, run = 0;
    while (ti < text.length && qi < q.length) {
      if (text.charAt(ti) === q.charAt(qi)) { qi++; run++; score += run; }
      else run = 0;
      ti++;
    }
    return (qi === q.length) ? score : -1;
  }

  /* ================================================== ⌘K COMMAND PALETTE
     PULSE_SHELL.palette.open()/close()/toggle(). Built once, appended to
     <body> (so the front page's overflow:hidden .topbar cannot clip it, same
     reasoning as the launcher panel below). Sections: Screens (NAV links,
     fuzzy-matched over label+group) and Actions (collapse/expand menu ·
     toggle theme · reduce motion). Empty query = every screen, grouped, with
     recents (max 5) first. ↑/↓ moves the highlight, Enter activates, Esc
     closes (handled by the document-level handler in init()), focus is
     trapped while open and restored to the opener on close. */
  var PAL = {
    scrim: null, panel: null, input: null, list: null,
    isOpen: false, query: '', items: [], activeIndex: -1, restoreFocus: null
  };

  function getActions() {
    var navLabel = (navState() === 'expanded') ? 'Collapse Menu' : 'Expand Menu';
    var moLabel  = motion.isForced() ? 'Reduce Motion Off' : 'Reduce Motion On';
    return [
      { label: navLabel,      hint: '[', run: function () { toggleExpandRail(); } },
      { label: 'Toggle Theme', hint: '', run: function () { theme.toggle(); } },
      { label: moLabel,        hint: '', run: function () { motion.toggle(); } }
    ];
  }

  function sectionHtml(label) { return '<div class="ppal-sec">' + esc(label) + '</div>'; }
  function groupHtml(label) { return '<div class="ppal-gh">' + esc(label) + '</div>'; }
  function screenItemHtml(page, items) {
    var idx = items.length;
    items.push({ type: 'screen', path: page.path });
    return '<a class="ppal-item" id="ppali' + idx + '" role="option" data-idx="' + idx + '" ' +
           'href="' + esc(href(page.path)) + '">' + icon(page.icon, 'pn-ic') +
           '<span class="ppal-lb">' + esc(page.label) + '</span>' +
           '<span class="ppal-meta">' + esc(page.group) + '</span></a>';
  }
  function actionItemHtml(action, items) {
    var idx = items.length;
    items.push({ type: 'action', run: action.run });
    return '<button type="button" class="ppal-item" id="ppali' + idx + '" role="option" data-idx="' + idx + '">' +
           '<span class="ppal-lb">' + esc(action.label) + '</span>' +
           '<span class="ppal-meta">' + (action.hint ? '<span class="ppal-hint">' + esc(action.hint) + '</span>' : '') +
           '</span></button>';
  }

  function renderPaletteList() {
    var q = (PAL.query || '').trim();
    var html = '', items = [], i, j;

    if (!q) {
      var recents = getRecents(), shown = [];
      for (i = 0; i < recents.length; i++) {
        var pg = findPage(recents[i]);
        if (pg) shown.push(pg);
      }
      if (shown.length) {
        html += sectionHtml('Recent');
        for (i = 0; i < shown.length; i++) html += screenItemHtml(shown[i], items);
      }
      html += sectionHtml('Screens');
      for (i = 0; i < NAV.length; i++) {
        html += groupHtml(NAV[i].group);
        for (j = 0; j < NAV[i].links.length; j++) {
          html += screenItemHtml({ path: NAV[i].links[j].path, label: NAV[i].links[j].label,
                                    icon: NAV[i].links[j].icon, group: NAV[i].group }, items);
        }
      }
    } else {
      var scored = [];
      for (i = 0; i < PAGES.length; i++) {
        var sc = fuzzyScore(q, PAGES[i].label + ' ' + PAGES[i].group);
        if (sc >= 0) scored.push({ p: PAGES[i], score: sc });
      }
      scored.sort(function (a, b) { return b.score - a.score; });
      if (scored.length) {
        html += sectionHtml('Screens');
        for (i = 0; i < scored.length; i++) html += screenItemHtml(scored[i].p, items);
      }
    }

    var actions = getActions(), actScored = [];
    for (i = 0; i < actions.length; i++) {
      var sc2 = q ? fuzzyScore(q, actions[i].label) : 1;
      if (sc2 >= 0) actScored.push({ a: actions[i], score: sc2 });
    }
    if (q) actScored.sort(function (a, b) { return b.score - a.score; });
    if (actScored.length) {
      html += sectionHtml('Actions');
      for (i = 0; i < actScored.length; i++) html += actionItemHtml(actScored[i].a, items);
    }

    if (!items.length) html = '<div class="ppal-empty">No matches.</div>';

    PAL.list.innerHTML = html;
    PAL.items = items;
    PAL.activeIndex = items.length ? 0 : -1;
    highlightIndex(-1, PAL.activeIndex);
  }

  function highlightIndex(oldI, newI) {
    var a = oldI > -1 ? d().getElementById('ppali' + oldI) : null;
    var b = newI > -1 ? d().getElementById('ppali' + newI) : null;
    if (a) { a.className = a.className.replace(/\s*\bon\b/, ''); a.setAttribute('aria-selected', 'false'); }
    if (b) {
      b.className += ' on';
      b.setAttribute('aria-selected', 'true');
      if (b.scrollIntoView) { try { b.scrollIntoView({ block: 'nearest' }); } catch (e) { b.scrollIntoView(false); } }
      if (PAL.input) PAL.input.setAttribute('aria-activedescendant', b.id);
    } else if (PAL.input) {
      PAL.input.removeAttribute('aria-activedescendant');
    }
  }
  function moveActive(delta) {
    if (!PAL.items.length) return;
    var old = PAL.activeIndex;
    PAL.activeIndex = (PAL.activeIndex + delta + PAL.items.length) % PAL.items.length;
    highlightIndex(old, PAL.activeIndex);
  }
  function activateSelected() {
    if (PAL.activeIndex < 0 || PAL.activeIndex >= PAL.items.length) return;
    var item = PAL.items[PAL.activeIndex];
    if (item.type === 'screen') {
      recordRecent(item.path);
      closePalette();
      global.location.href = href(item.path);
    } else if (item.type === 'action') {
      item.run();
      closePalette();
    }
  }

  function buildPalette() {
    if (PAL.scrim) return;
    var scrim = el('div', 'ppal-scrim');
    scrim.id = 'ppalscrim';
    scrim.innerHTML =
      '<div class="ppal" id="ppal" role="dialog" aria-modal="true" aria-label="Command palette">' +
        '<div class="ppal-hd">' + searchIconSvg('ppal-sic') +
          '<input class="ppal-in" id="ppalq" type="text" autocomplete="off" spellcheck="false" ' +
          'placeholder="Jump to a screen or run a command…" aria-label="Search screens and actions" ' +
          'role="combobox" aria-expanded="true" aria-controls="ppallist"/>' +
        '</div>' +
        '<div class="ppal-list" id="ppallist" role="listbox" aria-label="Results"></div>' +
        '<div class="ppal-ft"><span>&#8593;&#8595; navigate</span><span>&#8629; select</span><span>esc close</span></div>' +
      '</div>';
    d().body.appendChild(scrim);

    PAL.scrim = scrim;
    PAL.panel = scrim.querySelector('#ppal');
    PAL.input = scrim.querySelector('#ppalq');
    PAL.list  = scrim.querySelector('#ppallist');

    scrim.addEventListener('mousedown', function (ev) { if (ev.target === scrim) closePalette(); });
    PAL.panel.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Tab') return;
      var f = PAL.panel.querySelectorAll('input,button');
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (ev.shiftKey && d().activeElement === first) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && d().activeElement === last) { ev.preventDefault(); first.focus(); }
    });
    PAL.input.addEventListener('input', function () { PAL.query = PAL.input.value; renderPaletteList(); });
    PAL.input.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowDown') { ev.preventDefault(); moveActive(1); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); moveActive(-1); }
      else if (ev.key === 'Enter') { ev.preventDefault(); activateSelected(); }
    });
    PAL.list.addEventListener('click', function (ev) {
      var t = ev.target;
      while (t && t !== PAL.list && (t.getAttribute && t.getAttribute('data-idx') == null)) t = t.parentNode;
      if (!t || t === PAL.list) return;
      var idx = parseInt(t.getAttribute('data-idx'), 10);
      if (isNaN(idx) || !PAL.items[idx]) return;
      var item = PAL.items[idx];
      if (item.type === 'action') { ev.preventDefault(); item.run(); closePalette(); }
      else if (item.type === 'screen') { recordRecent(item.path); closePalette(); /* <a> navigates natively */ }
    });
  }
  function openPalette() {
    if (!PAL.scrim || PAL.isOpen) return;
    PAL.restoreFocus = d().activeElement;
    PAL.isOpen = true;
    PAL.scrim.className = 'ppal-scrim open';
    PAL.query = '';
    if (PAL.input) PAL.input.value = '';
    renderPaletteList();
    if (PAL.input && PAL.input.focus) PAL.input.focus();
    var kbtn = d().getElementById('pkbtn');
    if (kbtn) kbtn.setAttribute('aria-expanded', 'true');
  }
  function closePalette() {
    if (!PAL.isOpen) return;
    PAL.isOpen = false;
    if (PAL.scrim) PAL.scrim.className = 'ppal-scrim';
    var kbtn = d().getElementById('pkbtn');
    if (kbtn) kbtn.setAttribute('aria-expanded', 'false');
    if (PAL.restoreFocus && PAL.restoreFocus.focus) { try { PAL.restoreFocus.focus(); } catch (e) { /* gone */ } }
    PAL.restoreFocus = null;
  }
  function togglePalette() { if (PAL.isOpen) closePalette(); else openPalette(); }

  /* ------------------------------------------------------------- ECG mark
     .pm-trace draws once at mount (getTotalLength() -> dasharray/offset,
     1600ms cubic-bezier(0,0,.2,1), fill-mode both, no loop — shell.css owns
     the keyframes, this only supplies --pm-len and the .pm-run trigger
     class). .pm-pip then beats forever. Reduced motion (media query OR
     html[data-motion="reduce"]): skip the class entirely, so the path keeps
     its default (no dasharray = fully drawn) and the pip stays static. */
  function animateMark(svg) {
    if (!svg) return;
    var path = svg.querySelector('.pm-trace');
    var pip = svg.querySelector('.pm-pip');
    if (motionReduced()) {
      if (pip) pip.setAttribute('class', 'pm-pip pm-static');
      return;
    }
    if (!path) return;
    var L = 60;
    try { var got = path.getTotalLength(); if (got) L = got; } catch (e) { /* keep fallback */ }
    try { path.style.setProperty('--pm-len', String(L)); } catch (e) { /* older engines: no draw, still visible */ }
    path.setAttribute('class', 'pm-trace pm-run');
    if (pip) pip.setAttribute('class', 'pm-pip pm-run');
  }

  /* ========================================================== LAUNCHER === */
  function launcherMarkup(opt) {
    /* the label sits in .pll so the front page can drop it at narrow widths
       and keep an icon-only chip (see the media queries in shell.css) */
    var h = '<button class="plaunch-btn" type="button" aria-haspopup="true" aria-expanded="false" ' +
            'title="Open any Pulse page" aria-label="Menus — open any Pulse page">' +
            icon('grid', 'pll-i') + '<span class="pll">' +
            (opt && opt.label ? esc(opt.label) : 'Menus') + '</span>' +
            '<svg class="plc" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
            'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + ICONS.chevron +
            '"/></svg></button>';
    return h;
  }

  function menuMarkup() {
    var h = '', i, j;
    for (i = 0; i < NAV.length; i++) {
      h += '<div class="pl-gt">' + NAV[i].group + '</div>';
      for (j = 0; j < NAV[i].links.length; j++) {
        var lk = NAV[i].links[j], on = isActive(lk.path);
        h += '<a class="pl-item' + (on ? ' on' : '') + '" role="menuitem" href="' + href(lk.path) + '">' +
             icon(lk.icon) + '<span>' + lk.label + '</span></a>';
      }
    }
    h += '<div class="pl-foot">One seeded week · every page computed from the same spine.</div>';
    return h;
  }

  /* The front page's .topbar carries overflow:hidden (assets/styles.css), so a
     dropdown nested inside it is clipped to the 55px bar. The panel therefore
     lives on <body> and is positioned from the button's rect on open — which
     also keeps it clear of the dock/RCA stacking contexts on the map. */
  function launcher(target, opt) {
    var doc = d();
    if (!doc) return null;
    var host = (typeof target === 'string') ? doc.querySelector(target) : target;
    if (!host) return null;

    var wrap = el('div', 'plaunch' + (opt && opt.align === 'right' ? ' right' : ''), launcherMarkup(opt));
    if (opt && opt.before && opt.before.parentNode === host) host.insertBefore(wrap, opt.before);
    else host.appendChild(wrap);

    var btn = wrap.querySelector('.plaunch-btn');
    var menu = el('div', 'pl-menu', menuMarkup());
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', 'All Pulse pages');
    doc.body.appendChild(menu);

    function place() {
      var r = btn.getBoundingClientRect();
      var vw = global.innerWidth || doc.documentElement.clientWidth || 1024;
      var vh = global.innerHeight || doc.documentElement.clientHeight || 768;
      var w = Math.max(232, Math.min(272, vw - 16));
      var left = (opt && opt.align === 'right') ? (r.right - w) : r.left;
      left = Math.max(8, Math.min(left, vw - w - 8));
      var top = Math.min(r.bottom + 7, vh - 120);
      menu.style.width = w + 'px';
      menu.style.left = Math.round(left) + 'px';
      menu.style.top = Math.round(top) + 'px';
      menu.style.maxHeight = Math.max(160, Math.min(540, vh - top - 12)) + 'px';
    }
    function isOpen() { return menu.className.indexOf('open') > -1; }
    function close() {
      menu.className = 'pl-menu';
      wrap.className = wrap.className.replace(/\s+open\b/, '');
      btn.setAttribute('aria-expanded', 'false');
    }
    function open() {
      place();
      menu.className = 'pl-menu open';
      if (wrap.className.indexOf('open') < 0) wrap.className += ' open';
      btn.setAttribute('aria-expanded', 'true');
    }

    btn.addEventListener('click', function (ev) {
      ev.preventDefault(); ev.stopPropagation();
      if (isOpen()) close(); else open();
    });
    doc.addEventListener('click', function (ev) {
      if (!isOpen()) return;
      var n = ev.target;
      while (n) { if (n === wrap || n === menu) return; n = n.parentNode; }
      close();
    });
    doc.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') close(); });
    if (global.addEventListener) {
      global.addEventListener('resize', function () { if (isOpen()) place(); });
    }
    wrap.menu = menu; wrap.close = close; wrap.open = open;
    return wrap;
  }

  /* ============================================================= STRIP === */
  function strip(target, opt) {
    var doc = d();
    if (!doc) return null;
    var host = (typeof target === 'string') ? doc.querySelector(target) : target;
    if (!host) return null;
    var bar = el('div', 'pstrip');
    bar.setAttribute('role', 'navigation');
    bar.setAttribute('aria-label', 'Pulse sections');
    var h = '<span class="pstrip-t">Pulse</span>', i, j;
    var only = (opt && opt.only) || null;
    for (i = 0; i < NAV.length; i++) {
      if (i) h += '<span class="pstrip-sep" aria-hidden="true"></span>';
      for (j = 0; j < NAV[i].links.length; j++) {
        var lk = NAV[i].links[j];
        if (only && only.indexOf(lk.path) < 0) continue;
        var on = isActive(lk.path);
        h += '<a class="pstrip-l' + (on ? ' on' : '') + '" href="' + href(lk.path) + '"' +
             (on ? ' aria-current="page"' : '') + '>' + icon(lk.icon) + '<span>' + lk.label + '</span></a>';
      }
    }
    bar.innerHTML = h;
    if (opt && opt.mode === 'after' && host.parentNode) {
      host.parentNode.insertBefore(bar, host.nextSibling);
    } else if (opt && opt.mode === 'before' && host.parentNode) {
      host.parentNode.insertBefore(bar, host);
    } else {
      host.appendChild(bar);
    }
    /* the strip scrolls sideways when it does not fit; bring the current page's
       own link into view so the reader can see where they are */
    var cur = bar.querySelector('.pstrip-l.on');
    if (cur && bar.scrollWidth > bar.clientWidth) {
      bar.scrollLeft = Math.max(0, cur.offsetLeft - (bar.clientWidth / 2) + (cur.offsetWidth / 2));
    }
    return bar;
  }

  /* --------------------------------------------------- hook legacy toggles
     index.html (#theme) and incident-trace.html (#themebtn) flip data-theme
     with their own handler and do not persist. We listen after them and write
     the result to localStorage so the choice follows the reader across pages. */
  function adoptLegacyThemeButtons() {
    var doc = d(), ids = ['theme', 'themebtn'], i;
    for (i = 0; i < ids.length; i++) {
      var b = doc.getElementById(ids[i]);
      if (!b) continue;
      b.addEventListener('click', function () {
        storeSet(THEME_KEY, theme.get());
      });
    }
  }

  /* --------------------------------------------------------------- export */
  var API = {
    NAV: NAV, PAGES: PAGES, FRESH: FRESH, THEME_KEY: THEME_KEY,
    pathInfo: pathInfo, info: INFO, href: href, isActive: isActive, icon: icon,
    init: init, mount: init, ready: ready, theme: theme, motion: motion,
    setRange: setRange, getRange: function () { return S.range; }, onRange: onRange,
    ranges: function () { return S.ranges.slice(); },
    setTitle: setTitleTxt, setSubtitle: setSubtitle, setFreshness: setFreshness, setLineage: setLineage,
    fresh: setFreshness, status: setStatus,
    navState: navState,
    palette: { open: openPalette, close: closePalette, toggle: togglePalette },
    launcher: launcher, strip: strip,
    main: function () { return d().getElementById('pulse-main'); },
    shell: function () { return S; },
    esc: esc
  };
  global.PULSE_SHELL = API;

  /* ------------------------------------------------------------- autoboot
     A page opts in with <body data-shell="page"> (full frame),
     data-shell="launcher" (chip only) or data-shell="strip" (top strip).
     Anything else: the page calls PULSE_SHELL.init() itself. */
  if (global.document && global.document.addEventListener) {
    ready(function () {
      var b = global.document.body;
      if (!b) return;
      var mode = b.getAttribute('data-shell');
      theme.apply();
      motion.apply();
      adoptLegacyThemeButtons();
      if (mode === 'page') init();
      else if (mode === 'launcher') launcher(b.getAttribute('data-shell-host') || '.topbar');
      else if (mode === 'strip') strip(b.getAttribute('data-shell-host') || 'header', { mode: 'after' });
    });
  }

})(typeof window !== 'undefined' ? window : this);
