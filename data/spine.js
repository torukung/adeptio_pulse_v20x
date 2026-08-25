/* ============================================================================
 * ADEPTIO Pulse — DEMO SITE v2.0 · CANONICAL SPINE  (window.PULSE_SPINE)
 *
 * ONE seeded generator producing the canonical bucket for the whole estate.
 * Every menu in the demo is computed from what this file emits — there is no
 * second data source anywhere in the site.
 *
 * Determinism: all randomness runs through mulberry32(keySeed(key)) off
 * ADEPTIO_SEED = 20260815 — the same constant and the same two helpers as
 * assets/engine.js (copied verbatim, lines 35-37 there). Every series re-seeds
 * from its own key, so generation order does not matter and a page that only
 * asks for three routes gets exactly the same numbers as a page that asks for
 * all thirty-six.
 *
 * SERIES KEYS ARE PREFIXED 'v2:' so no key collides with the front page's own
 * series. data/manifest.js, assets/engine.js and the front-page week are
 * untouched and byte-identical.
 *
 * Time base (identical to the front page): N = 2016 steps x 5 min = 7 days,
 * DAY = 288, labels Aug 23 00:00 .. Aug 29 23:55, now = 2015.
 *
 * THE CANONICAL BUCKET, per route per 5 minutes:
 *   count  ok  biz_fail  tech_fail  unknown  p50 p75 p95 p99  within_T
 * ...plus a 1-minute sub-series for the last 24 h, per-downstream buckets,
 * per-monitor checks, per-error-group hourly counts with sampled occurrences,
 * per-result-code hourly counts, and per-journey hourly funnels.
 *
 * Load order: manifest.js -> rcameta.js -> tickets.js -> registry.js ->
 *             SPINE.js -> ../assets/synth.js
 * ==========================================================================*/
(function () {
  "use strict";

  var REG = window.PULSE_REG;
  if (!REG) throw new Error("PULSE_REG missing - load data/registry.js before data/spine.js");
  var D_ = window.ADEPTIO_DATA;
  if (!D_) throw new Error("ADEPTIO_DATA missing - load data/manifest.js before data/spine.js");

  var N = D_.N, STEP_MIN = D_.STEP_MIN, DAY = D_.DAY, INC = D_.INC;
  var NOW = REG.NOW, HOURS = N / 12;            /* 168 hours in the week      */
  var MIN_WINDOW = 288;                          /* last 24 h in 5-min buckets */
  var MINUTES = MIN_WINDOW * 5;                  /* 1440 one-minute buckets    */

  /* ===================== SEEDED PRNG — verbatim from assets/engine.js ======= */
  const ADEPTIO_SEED = 20260815;
  function mulberry32(a){ return function(){ a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  function keySeed(key){ let h=ADEPTIO_SEED>>>0; for(let i=0;i<key.length;i++){ h=Math.imul(h^key.charCodeAt(i),16777619)>>>0; } return h; }
  /* ========================================================================= */

  /* ---- the demo week's calendar labels (v2.0.1) ---------------------------
     WK34 of 2027, Mon Aug 23 -> Sun Aug 29. Day index 1..7 renders as a date;
     stamps carry NO year (the year appears only in per-screen header ranges).
     data/manifest.js publishes ADEPTIO_DATA.WEEK; the literal below is the
     fallback so this file still labels correctly on its own.               */
  var WEEK = D_.WEEK || null;
  var DAY_LABELS = (WEEK && WEEK.days && WEEK.days.length === 7)
    ? WEEK.days
    : ["Aug 23", "Aug 24", "Aug 25", "Aug 26", "Aug 27", "Aug 28", "Aug 29"];
  var WEEK_YEAR = (WEEK && WEEK.year) || 2027;
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  /* Days 1..7 are the seeded week. Follow-up dates legitimately fall past it -
     ops ETAs run to index 2180, i.e. day 8, which used to render as "D8" - so
     the calendar CONTINUES instead of wrapping back to day 1, which would put
     a future ETA on the first day of the week and read as the past.       */
  function dayLabel(d) {
    if (d >= 1 && d <= 7) return DAY_LABELS[d - 1];
    var dt = new Date(Date.UTC(WEEK_YEAR, 7, 23) + (d - 1) * 86400000);
    return MON[dt.getUTCMonth()] + " " + dt.getUTCDate();
  }
  /* filename-safe variant: one error message embeds a day inside a path, where
     a space would be wrong (/out/advice_Aug26.psv, not "advice_Aug 26.psv"). */
  function dayLabelCompact(d) { return dayLabel(d).replace(/\s+/g, ""); }

  /* ---- time labels (identical arithmetic to engine.js E1) ----------------- */
  function dayOf(i) { return Math.floor(i / DAY) + 1; }
  function hm(i) {
    var m = (i % DAY) * STEP_MIN;
    return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
  }
  function dstamp(i) { return dayLabel(dayOf(i)) + " " + hm(i); }
  /* minute-resolution stamp for the KPI-live page (last 24 h) */
  function mstamp(mi) {
    var t0 = N - MIN_WINDOW, abs = t0 * STEP_MIN + mi;      /* minutes from Aug 23 00:00 */
    var d = Math.floor(abs / 1440) + 1, r = abs % 1440;
    return dayLabel(d) + " " + String(Math.floor(r / 60)).padStart(2, "0") + ":" + String(r % 60).padStart(2, "0");
  }

  /* ---- incident window shape (identical to engine.js E2) ------------------ */
  function win(t, a, peak, b) { if (t <= a || t >= b) return 0; return t <= peak ? (t - a) / (peak - a) : (b - t) / (b - peak); }
  function ramp(t, a, b) { if (t <= a) return 0; if (t >= b) return 1; return (t - a) / (b - a); }
  function sevAt(k, t) { var w = INC[k]; if (!w) return 0; return w.length === 2 ? ramp(t, w[0], w[1]) : win(t, w[0], w[1], w[2]); }

  /* ---- shape helpers ------------------------------------------------------ */
  function diurnalRaw(h) {
    return 0.58
      + 0.62 * Math.exp(-Math.pow((h - 12.5) / 3.6, 2))
      + 0.80 * Math.exp(-Math.pow((h - 19.5) / 2.6, 2))
      + 0.22 * Math.exp(-Math.pow((h - 8.5) / 2.2, 2))
      - 0.40 * Math.exp(-Math.pow((h - 3.5) / 2.8, 2));
  }
  var DIURNAL = (function () {
    var a = new Float64Array(DAY), s = 0, i;
    for (i = 0; i < DAY; i++) { a[i] = diurnalRaw((i * STEP_MIN) / 60); s += a[i]; }
    var m = s / DAY;
    for (i = 0; i < DAY; i++) a[i] /= m;
    return a;
  }());
  var DOW = [1.00, 1.04, 1.02, 0.99, 1.05, 0.94, 0.90];
  function diurnal(t) { return DIURNAL[t % DAY]; }
  function dow(t) { return DOW[Math.floor(t / DAY) % 7]; }
  /* the whole week's volume shape, precomputed once: this is read 2016 times
     per series and there are ~180 series, so it must not be arithmetic.     */
  var SHAPE = (function () {
    var a = new Float64Array(N);
    for (var t = 0; t < N; t++) a[t] = DIURNAL[t % DAY] * DOW[Math.floor(t / DAY) % 7];
    return a;
  }());
  function shape(t) { return SHAPE[t]; }

  /* ---- normal CDF, used to turn (p50, spread) into a within-threshold ratio */
  function erf(x) {
    var s = x < 0 ? -1 : 1; x = Math.abs(x);
    var t = 1 / (1 + 0.3275911 * x);
    var y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return s * y;
  }
  function phi(z) { return 0.5 * (1 + erf(z / Math.SQRT2)); }
  var Z75 = 0.6744898, Z95 = 1.6448536, Z99 = 2.3263479;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* ---- incident effect resolution ----------------------------------------
   * A route's `inc` map is COMPILED ONCE into a flat array so the per-bucket
   * loop never walks an object with for..in and never allocates. Additive
   * effects add, multipliers take the strongest (MAX), volume takes the
   * strongest (MIN) — the same "worst window wins" rule as engine.js E3.
   * `d.num` carries the scalar form used by monitors, error groups and
   * result codes (a probe-failure probability / a count multiplier).        */
  function compileInc(inc) {
    var out = [];
    for (var k in inc) {
      if (!Object.prototype.hasOwnProperty.call(inc, k)) continue;
      var w = INC[k]; if (!w) continue;
      var d = inc[k], scalar = (typeof d === "number");
      out.push({
        key: k, a: w[0], p: w.length === 3 ? w[1] : w[1], b: w[w.length - 1],
        isRamp: w.length === 2,
        num: scalar ? d : null,
        l: scalar ? 0 : (d.l || d.lat || 0), t: scalar ? 0 : (d.t || 0),
        bz: scalar ? 0 : (d.b || 0), bx: scalar ? 0 : (d.bx || 0), v: scalar ? 0 : (d.v || 0),
        s5: scalar ? 0 : (d.s5 || 0), s4: scalar ? 0 : (d.s4 || 0), dlr: scalar ? 0 : (d.dlr || 0)
      });
    }
    /* window envelope, so the hot loop can skip the whole resolution for the
       ~85% of buckets where no window of this series is open at all         */
    var lo = Infinity, hi = -Infinity, hasRamp = false;
    for (var i = 0; i < out.length; i++) {
      if (out[i].a < lo) lo = out[i].a;
      if (out[i].b > hi) hi = out[i].b;
      if (out[i].isRamp) hasRamp = true;
    }
    out.lo = lo; out.hi = hi; out.hasRamp = hasRamp;
    return out;
  }
  /* never mutated - handed back for every quiet bucket */
  var IDENTITY = { l: 1, t: 0, b: 0, bx: 1, v: 1, s5: 0, s4: 0, dlr: 0, mul: 1, hit: 0, pf: 0 };
  function sevOf(d, t) {
    if (d.isRamp) { if (t <= d.a) return 0; if (t >= d.b) return 1; return (t - d.a) / (d.b - d.a); }
    if (t <= d.a || t >= d.b) return 0;
    return t <= d.p ? (t - d.a) / (d.p - d.a) : (d.b - t) / (d.b - d.p);
  }
  /* one scratch object, reused: every caller reads it immediately */
  var EFF = { l: 1, t: 0, b: 0, bx: 1, v: 1, s5: 0, s4: 0, dlr: 0, mul: 1, hit: 0, pf: 0 };
  function effects(IE, t) {
    if (IE.length === 0 || (!IE.hasRamp && (t <= IE.lo || t >= IE.hi))) return IDENTITY;
    var e = EFF;
    e.l = 1; e.t = 0; e.b = 0; e.bx = 1; e.v = 1; e.s5 = 0; e.s4 = 0; e.dlr = 0; e.mul = 1; e.hit = 0; e.pf = 0;
    for (var i = 0; i < IE.length; i++) {
      var d = IE[i], s = sevOf(d, t); if (s <= 0) continue;
      if (s > e.hit) e.hit = s;
      if (d.num !== null) {
        var pn = d.num * s; if (pn > e.pf) e.pf = pn;
        var mn = 1 + (d.num - 1) * s; if (mn > e.mul) e.mul = mn;
        continue;
      }
      if (d.l) { var lv = 1 + (d.l - 1) * s; if (lv > e.l) e.l = lv; }
      if (d.t) e.t += d.t * s;
      if (d.bz) e.b += d.bz * s;
      if (d.bx) { var bv = 1 + (d.bx - 1) * s; if (bv > e.bx) e.bx = bv; }
      if (d.v) { var vv = 1 - (1 - d.v) * s; if (vv < e.v) e.v = vv; }
      if (d.s5) e.s5 += d.s5 * s;
      if (d.s4) e.s4 += d.s4 * s;
      if (d.dlr) e.dlr += d.dlr * s;
    }
    return e;
  }
  /* scalar form: inc values are plain multipliers (error groups, result codes) */
  function multiplierAt(IE, t) { return effects(IE, t).mul; }

  /* ---- the collector gap -------------------------------------------------- */
  var GAP = REG.gap;
  function inGap(t) { return t >= GAP.t0 && t <= GAP.t1; }
  var GAP_HOURS = (function () {
    var a = [], h0 = Math.floor(GAP.t0 / 12), h1 = Math.floor(GAP.t1 / 12);
    for (var h = h0; h <= h1; h++) a.push(h);
    return a;
  }());

  /* ========================================================================= *
   * CACHE — every generator is lazy and memoised.
   * ========================================================================= */
  var CACHE = { route: {}, minute: {}, down: {}, mon: {}, eg: {}, rc: {}, jf: {} };
  var STATS = { generated: 0, ms: 0 };
  function timed(fn) { var s = Date.now(); var r = fn(); STATS.ms += Date.now() - s; STATS.generated++; return r; }

  /* ========================================================================= *
   * 1 · ROUTE BUCKETS — the canonical unit, 5-minute resolution, whole week.
   * unknown: 0 = observed · 1 = collector gap (UNKNOWN, never zero) ·
   *          2 = route not deployed yet (renders as "-" not as a hole)
   * ========================================================================= */
  function genRoute(r) {
    var rng = mulberry32(keySeed("v2:route:" + r.key));
    var count = new Float32Array(N), ok = new Float32Array(N), biz = new Float32Array(N),
        tech = new Float32Array(N), unk = new Uint8Array(N), p50 = new Float32Array(N),
        p75 = new Float32Array(N), p95 = new Float32Array(N), p99 = new Float32Array(N),
        wT = new Float32Array(N);
    var gapped = (GAP.svc === r.svc), gap0 = GAP.t0, gap1 = GAP.t1;
    var sigma0 = Math.log(r.spread) / Z95;
    /* hot-path constants: ~90% of buckets carry no incident, so the three
       quantile multipliers and the threshold log are computed once, not
       2016 times. Every registry field the loop needs is hoisted into a local
       for the same reason. Keeps the whole-spine build inside the budget. */
    var E75_0 = Math.exp(Z75 * sigma0), E95_0 = Math.exp(Z95 * sigma0), E99_0 = Math.exp(Z99 * sigma0);
    var LOGT = Math.log(r.T_ms), INV0 = 1 / sigma0;
    var volBase = r.rps * STEP_MIN * 60, IE = compileInc(r.inc);
    var P50 = r.p50, E5 = r.e5, E4 = r.e4, INTRO = r.introducedAt;
    for (var t = 0; t < N; t++) {
      if (INTRO !== null && t < INTRO) { unk[t] = 2; continue; }
      if (gapped && t >= gap0 && t <= gap1) { unk[t] = 1; continue; }
      var e = effects(IE, t);
      var vol = volBase * SHAPE[t] * (1 + (rng() - 0.5) * 0.13) * e.v;
      var c = Math.max(0, Math.round(vol));
      count[t] = c;

      var techRate = E5 * (1 + (rng() - 0.5) * 0.7) + e.t;
      if (techRate < 0) techRate = 0; else if (techRate > 0.97) techRate = 0.97;
      var bizCap = 0.97 - techRate;
      var bizRate = E4 * e.bx * (1 + (rng() - 0.5) * 0.28) + e.b;
      if (bizRate < 0) bizRate = 0; else if (bizRate > bizCap) bizRate = bizCap;
      var nTech = Math.round(c * techRate), nBiz = Math.round(c * bizRate);
      if (nTech + nBiz > c) { nBiz = Math.max(0, c - nTech); }
      tech[t] = nTech; biz[t] = nBiz; ok[t] = c - nTech - nBiz;

      var m = P50 * e.l * (1 + (rng() - 0.5) * 0.16), z;
      p50[t] = m;
      if (e.l === 1) {                                  /* quiet bucket: constants */
        p75[t] = m * E75_0; p95[t] = m * E95_0; p99[t] = m * E99_0;
        z = (LOGT - Math.log(m)) * INV0;
      } else {                                          /* incident: sigma widens  */
        var sg = sigma0 * (1 + (e.l - 1) * 0.35);
        p75[t] = m * Math.exp(Z75 * sg);
        p95[t] = m * Math.exp(Z95 * sg);
        p99[t] = m * Math.exp(Z99 * sg);
        z = (LOGT - Math.log(m)) / sg;
      }
      var pw = phi(z);
      if (pw < 0) pw = 0; else if (pw > 1) pw = 1;
      wT[t] = Math.round(c * pw);
    }
    return { key: r.key, svc: r.svc, group: r.group, journey: r.journey, T_ms: r.T_ms,
             count: count, ok: ok, biz_fail: biz, tech_fail: tech, unknown: unk,
             p50: p50, p75: p75, p95: p95, p99: p99, within_T: wT };
  }
  function route(key) {
    if (CACHE.route[key]) return CACHE.route[key];
    var r = REG.byRoute[key];
    if (!r) throw new Error("PULSE_SPINE.route: unknown route " + key);
    return (CACHE.route[key] = timed(function () { return genRoute(r); }));
  }

  /* ---- 1-minute sub-series for the last 24 h (menu 3 precision chips) -----
   * Derived deterministically by splitting each 5-minute bucket into five
   * seeded shares. The 5-minute totals are preserved exactly, so the same
   * window read at 1 m and at 5 m cannot disagree.                            */
  function genMinute(r) {
    var base = route(r.key), rng = mulberry32(keySeed("v2:min:" + r.key));
    var t0 = N - MIN_WINDOW;
    var count = new Float32Array(MINUTES), ok = new Float32Array(MINUTES),
        biz = new Float32Array(MINUTES), tech = new Float32Array(MINUTES),
        unk = new Uint8Array(MINUTES), p50 = new Float32Array(MINUTES),
        p75 = new Float32Array(MINUTES), p95 = new Float32Array(MINUTES),
        p99 = new Float32Array(MINUTES);
    for (var i = 0; i < MIN_WINDOW; i++) {
      var t = t0 + i, w = [0, 0, 0, 0, 0], s = 0, j, idx;
      for (j = 0; j < 5; j++) { w[j] = 0.72 + rng() * 0.56; s += w[j]; }
      var rem = { c: base.count[t], o: base.ok[t], b: base.biz_fail[t], x: base.tech_fail[t] };
      for (j = 0; j < 5; j++) {
        idx = i * 5 + j;
        if (base.unknown[t]) { unk[idx] = base.unknown[t]; continue; }
        var last = (j === 4);
        var f = w[j] / s;
        var c = last ? rem.c : Math.round(base.count[t] * f);
        var o = last ? rem.o : Math.round(base.ok[t] * f);
        var b = last ? rem.b : Math.round(base.biz_fail[t] * f);
        var x = last ? rem.x : Math.round(base.tech_fail[t] * f);
        c = Math.max(0, c); o = Math.max(0, o); b = Math.max(0, b); x = Math.max(0, x);
        rem.c -= c; rem.o -= o; rem.b -= b; rem.x -= x;
        count[idx] = c; ok[idx] = o; biz[idx] = b; tech[idx] = x;
        var jit = 1 + (rng() - 0.5) * 0.22;
        p50[idx] = base.p50[t] * jit; p75[idx] = base.p75[t] * jit;
        p95[idx] = base.p95[t] * jit; p99[idx] = base.p99[t] * jit;
      }
    }
    return { key: r.key, t0: t0, minutes: MINUTES, count: count, ok: ok, biz_fail: biz,
             tech_fail: tech, unknown: unk, p50: p50, p75: p75, p95: p95, p99: p99 };
  }
  function routeMinute(key) {
    if (CACHE.minute[key]) return CACHE.minute[key];
    var r = REG.byRoute[key];
    if (!r) throw new Error("PULSE_SPINE.routeMinute: unknown route " + key);
    return (CACHE.minute[key] = timed(function () { return genMinute(r); }));
  }

  /* ========================================================================= *
   * 2 · DOWNSTREAM BUCKETS — menus 6 and 7. One canonical edge fact per call.
   * ========================================================================= */
  var STATUS_MIX = ["200", "400", "401", "404", "415", "429", "500", "502", "503"];
  /* The per-code status distribution is a pure function of (calls, s5xx, s4xx),
     so it is built ON FIRST ACCESS: menus 4 and 7 never read it and would
     otherwise pay 9 extra arrays x 2016 buckets x 12 downstreams for nothing. */
  function buildCodes(o) {
    var codes = {}, i, t;
    for (i = 0; i < STATUS_MIX.length; i++) codes[STATUS_MIX[i]] = new Float32Array(N);
    for (t = 0; t < N; t++) {
      if (o.unknown[t]) continue;
      var c = o.calls[t], n5 = o.s5xx[t], n4 = o.s4xx[t];
      codes["200"][t] = c - n5 - n4;
      codes["400"][t] = Math.round(n4 * 0.46); codes["404"][t] = Math.round(n4 * 0.24);
      codes["401"][t] = Math.round(n4 * 0.14); codes["429"][t] = Math.round(n4 * 0.10);
      codes["415"][t] = Math.max(0, n4 - codes["400"][t] - codes["404"][t] - codes["401"][t] - codes["429"][t]);
      codes["500"][t] = Math.round(n5 * 0.38); codes["502"][t] = Math.round(n5 * 0.29);
      codes["503"][t] = Math.max(0, n5 - codes["500"][t] - codes["502"][t]);
    }
    return codes;
  }
  function genDown(d) {
    var rng = mulberry32(keySeed("v2:down:" + d.key));
    var calls = new Float32Array(N), s5 = new Float32Array(N), s4 = new Float32Array(N),
        lat = new Float32Array(N), unk = new Uint8Array(N), dlr = new Float32Array(N);
    var gapped = (d.key === "biller-hub" || d.key === "biller-YESC" || d.key === "biller-MESC" || d.key === "biller-ESE");
    var IE = compileInc(d.inc), cpmBase = d.cpm * STEP_MIN;
    var D5 = d.s5, D4 = d.s4, DLAT = d.lat, DDLR = (d.dlr != null ? d.dlr : -1);
    var gap0 = GAP.t0, gap1 = GAP.t1;
    for (var t = 0; t < N; t++) {
      if (gapped && t >= gap0 && t <= gap1) { unk[t] = 1; continue; }
      var e = effects(IE, t);
      var c = Math.max(0, Math.round(cpmBase * SHAPE[t] * (1 + (rng() - 0.5) * 0.15)));
      calls[t] = c;
      var r5 = clamp(D5 * (1 + (rng() - 0.5) * 0.8) + e.s5, 0, 0.95);
      var r4 = clamp(D4 * (1 + (rng() - 0.5) * 0.4) + e.s4, 0, 0.95 - r5);
      var n5 = Math.round(c * r5), n4 = Math.round(c * r4);
      s5[t] = n5; s4[t] = n4;
      lat[t] = DLAT * e.l * (1 + (rng() - 0.5) * 0.18);
      if (DDLR >= 0) dlr[t] = clamp(DDLR - e.dlr, 0, 1);
    }
    var out = { key: d.key, type: d.type, calls: calls, s5xx: s5, s4xx: s4, latency: lat,
                unknown: unk, dlr: (d.dlr != null ? dlr : null) };
    Object.defineProperty(out, "codes", {
      configurable: true, enumerable: true,
      get: function () {
        var c = buildCodes(out);
        Object.defineProperty(out, "codes", { value: c, enumerable: true, writable: false, configurable: true });
        return c;
      }
    });
    return out;
  }
  function downstream(key) {
    if (CACHE.down[key]) return CACHE.down[key];
    var d = REG.byDownstream[key];
    if (!d) throw new Error("PULSE_SPINE.downstream: unknown downstream " + key);
    return (CACHE.down[key] = timed(function () { return genDown(d); }));
  }

  /* ========================================================================= *
   * 3 · MONITOR CHECKS — menu 5. L1 only. ok: 1 pass · 0 fail · 2 no-data
   * (a probe that could not run is not a failed probe).
   * ========================================================================= */
  function genMonitor(m) {
    var rng = mulberry32(keySeed("v2:mon:" + m.id));
    var ok = new Uint8Array(N), rt = new Float32Array(N), st = new Uint16Array(N);
    var gapped = (m.svc === GAP.svc), IE = compileInc(m.inc);
    var MRT = m.rt, isControl = !!m.control, gap0 = GAP.t0, gap1 = GAP.t1;
    var ctlStatus = (m.id === "m21") ? 500 : (m.id === "m22") ? 503 : 401;
    for (var t = 0; t < N; t++) {
      if (gapped && t >= gap0 && t <= gap1) { ok[t] = 2; rt[t] = 0; st[t] = 0; continue; }
      if (isControl) {
        ok[t] = 0; st[t] = ctlStatus;
        rt[t] = MRT * (1 + (rng() - 0.5) * 0.25);
        continue;
      }
      var e = effects(IE, t);
      var pFail = clamp(0.0015 + e.pf, 0, 0.995);
      var fail = rng() < pFail;
      ok[t] = fail ? 0 : 1;
      st[t] = fail ? (rng() < 0.55 ? 503 : (rng() < 0.5 ? 502 : 504)) : 200;
      rt[t] = MRT * (fail ? 3.4 : 1) * (1 + (rng() - 0.5) * 0.30) * (1 + (e.hit * 0.9));
    }
    return { id: m.id, vantage: m.vantage, control: !!m.control, ok: ok, rt: rt, status: st };
  }
  function monitor(id) {
    if (CACHE.mon[id]) return CACHE.mon[id];
    var m = REG.byMonitor[id];
    if (!m) throw new Error("PULSE_SPINE.monitor: unknown monitor " + id);
    return (CACHE.mon[id] = timed(function () { return genMonitor(m); }));
  }

  /* ========================================================================= *
   * 4 · ERROR GROUPS — hourly counts + sampled occurrences (menu 4 / menu 8).
   * ========================================================================= */
  var TOKENS = {
    cid: function (r) { return "chl-" + Math.floor(r() * 9e6 + 1e6).toString(36); },
    carrier: function (r) { return ["carrier-A", "carrier-B", "carrier-C"][Math.floor(r() * 3)]; },
    bind: function (r) { return "esme-0" + (1 + Math.floor(r() * 4)); },
    cluster: function (r) { return ["core-if", "biller-hub", "accounts", "package"][Math.floor(r() * 4)]; },
    upstream: function (r) { return ["10.42.8." + (10 + Math.floor(r() * 40)) + ":8443", "core-if.internal.mm:8443"][Math.floor(r() * 2)]; },
    route: function (r) { return REG.routes[Math.floor(r() * REG.routes.length)].path; },
    vip: function (r) { return "203.0.113." + (10 + Math.floor(r() * 6)); },
    host: function (r) { return ["hub.example-biller.mm", "kyc.example-partner.mm", "api.yesc-utility.mm"][Math.floor(r() * 3)]; },
    exp: function (r) { return dayLabel(1 + Math.floor(r() * 7)) + " " + String(Math.floor(r() * 24)).padStart(2, "0") + ":00"; },
    skew: function (r) { return String(-1 * (2000 + Math.floor(r() * 9000))); },
    avail: function (r) { return String(1000 + Math.floor(r() * 40000)); },
    amt: function (r) { return String(5000 + Math.floor(r() * 90000)); },
    lag: function (r) { return String(30 + Math.floor(r() * 240)); },
    r: function (r) { return String(1000 + Math.floor(r() * 50000)); },
    p: function (r) { return String(1000 + Math.floor(r() * 50000)); },
    k: function (r) { return "idem-" + Math.floor(r() * 9e7).toString(36); },
    acc: function (r) { return "0" + Math.floor(r() * 9e8 + 1e8); },
    h: function (r) { return Math.floor(r() * 9e9).toString(16); },
    mid: function (r) { return "msg-" + Math.floor(r() * 9e6).toString(36); },
    tier: function (r) { return ["BASIC", "PLUS", "PRIME"][Math.floor(r() * 3)]; },
    have: function (r) { return String(Math.floor(r() * 400)); },
    need: function (r) { return String(500 + Math.floor(r() * 800)); },
    v: function (r) { return "\"" + (10 + Math.floor(r() * 20)) + "/13/2027\""; },
    d: function (r) { return dayLabel(1 + Math.floor(r() * 7)); },
    dfile: function (r) { return dayLabelCompact(1 + Math.floor(r() * 7)); },
    t: function (r) { return String(6 + Math.floor(r() * 12)) + ":00"; },
    age: function (r) { return String(185 + Math.floor(r() * 900)); }
  };
  /* Any token without a filler would leak "{name}" onto the screen, so the
     fallback substitutes a stable seeded literal rather than the raw token. */
  function fillMsg(msg, rng) {
    return msg.replace(/\{(\w+)\}/g, function (whole, name) {
      return TOKENS[name] ? TOKENS[name](rng) : String(Math.floor(rng() * 9000) + 1000);
    });
  }
  function genErrorGroup(g) {
    var rng = mulberry32(keySeed("v2:eg:" + g.id)), IE = compileInc(g.inc);
    var hourly = new Float32Array(HOURS), unk = new Uint8Array(HOURS), h, i;
    var gapped = (g.svc === GAP.svc);
    for (h = 0; h < HOURS; h++) {
      if (gapped && GAP_HOURS.indexOf(h) >= 0) { unk[h] = 1; continue; }
      var t = h * 12 + 6;
      var m = multiplierAt(IE, t);
      hourly[h] = Math.max(0, Math.round(g.base * m * SHAPE[t] * (1 + (rng() - 0.5) * 0.55)));
    }
    /* sampled occurrences, weighted to where the counts are: 24 per group.
       The cumulative array is built once and bisected, not rescanned. */
    var cdf = new Float64Array(HOURS), run = 0;
    for (h = 0; h < HOURS; h++) { run += hourly[h]; cdf[h] = run; }
    var total = run;
    var occ = [], want = 24;
    if (total > 0) {
      for (i = 0; i < want; i++) {
        var target = rng() * total, loI = 0, hiI = HOURS - 1;
        while (loI < hiI) { var mid = (loI + hiI) >> 1; if (cdf[mid] >= target) hiI = mid; else loI = mid + 1; }
        var pick = loI;
        var tt = Math.min(N - 1, pick * 12 + Math.floor(rng() * 12));
        occ.push({
          t: tt, ts: dstamp(tt),
          endpoint: g.endpoints[Math.floor(rng() * g.endpoints.length)],
          message: fillMsg(g.msg, rng),
          duration: Math.round(120 + rng() * 24000)
        });
      }
      occ.sort(function (a, b) { return b.t - a.t; });
    }
    return { id: g.id, svc: g.svc, cls: g.cls, kind: g.kind, hourly: hourly, unknown: unk,
             total: total, occurrences: occ };
  }
  function errorGroup(id) {
    if (CACHE.eg[id]) return CACHE.eg[id];
    var g = null;
    for (var i = 0; i < REG.errorGroups.length; i++) if (REG.errorGroups[i].id === id) { g = REG.errorGroups[i]; break; }
    if (!g) throw new Error("PULSE_SPINE.errorGroup: unknown group " + id);
    return (CACHE.eg[id] = timed(function () { return genErrorGroup(g); }));
  }

  /* ========================================================================= *
   * 5 · DOMAIN RESULT CODES — hourly counts (menu 11 error tracking).
   * ========================================================================= */
  function genResultCode(rc) {
    var rng = mulberry32(keySeed("v2:rc:" + rc.code)), IE = compileInc(rc.inc);
    var hourly = new Float32Array(HOURS), total = 0;
    for (var h = 0; h < HOURS; h++) {
      var t = h * 12 + 6, m = multiplierAt(IE, t);
      hourly[h] = Math.max(0, Math.round(rc.base * m * SHAPE[t] * (1 + (rng() - 0.5) * 0.5)));
      total += hourly[h];
    }
    return { code: rc.code, svc: rc.svc, type: rc.type, http: rc.http, hourly: hourly, total: total };
  }
  function resultCode(code) {
    if (CACHE.rc[code]) return CACHE.rc[code];
    var rc = null;
    for (var i = 0; i < REG.resultCodes.length; i++) if (REG.resultCodes[i].code === code) { rc = REG.resultCodes[i]; break; }
    if (!rc) throw new Error("PULSE_SPINE.resultCode: unknown code " + code);
    return (CACHE.rc[code] = timed(function () { return genResultCode(rc); }));
  }

  /* ========================================================================= *
   * 6 · JOURNEY FUNNELS — hourly sessions per step + session_key samples.
   * A step's pass-through is either a UX constant (screen), the route's own
   * success ratio for that hour (api) or the SMS delivery-receipt rate (sms).
   * ========================================================================= */
  function hourRatio(r, h) {
    var s = route(r), c = 0, o = 0, u = 0;
    for (var i = h * 12; i < h * 12 + 12; i++) {
      if (s.unknown[i]) { u++; continue; }
      c += s.count[i]; o += s.ok[i];
    }
    if (u === 12) return { v: null, unknown: true };
    return { v: c > 0 ? o / c : 1, unknown: u > 0 };
  }
  function genFunnel(j) {
    var rng = mulberry32(keySeed("v2:jf:" + j.key));
    var steps = j.steps, S = steps.length;
    var sess = [], unk = new Uint8Array(HOURS), h, i;
    for (i = 0; i < S; i++) sess.push(new Float32Array(HOURS));
    var sms = REG.byDownstream["sms-gateway"] ? downstream("sms-gateway") : null;
    var samples = [];
    for (h = 0; h < HOURS; h++) {
      var t = h * 12 + 6;
      var s0 = Math.round(j.sessionsPerHour * SHAPE[t] * (1 + (rng() - 0.5) * 0.16));
      sess[0][h] = s0;
      var anyUnknown = false, cur = s0;
      for (i = 1; i < S; i++) {
        var st = steps[i], p = 1;
        if (st.kind === "api") {
          var hr = hourRatio(st.api, h);
          if (hr.unknown) anyUnknown = true;
          p = (hr.v == null) ? 1 : hr.v;
        } else if (st.kind === "sms") {
          var d = sms ? sms.dlr[t] : 0.986;
          p = (st.pass || 0.865) * (d / 0.986);
        } else {
          p = st.pass != null ? st.pass : 0.98;
        }
        /* the entry screen's own pass-through applies on the first transition */
        if (i === 1 && steps[0].pass != null) p *= steps[0].pass;
        cur = Math.max(0, Math.round(cur * clamp(p * (1 + (rng() - 0.5) * 0.04), 0, 1)));
        sess[i][h] = cur;
      }
      unk[h] = anyUnknown ? 1 : 0;
      /* three session_key samples per hour, each naming where it stopped */
      for (i = 0; i < 3; i++) {
        var stop = 0, prob = rng();
        for (var k = 1; k < S; k++) {
          var r0 = sess[k - 1][h] || 1, r1 = sess[k][h];
          var dropShare = (r0 - r1) / r0;
          if (prob < dropShare) { stop = k - 1; break; }
          prob -= dropShare; stop = S - 1;
        }
        samples.push({
          hour: h, t: t,
          session_key: "S-" + j.key.toUpperCase().slice(0, 3) + "-D" + dayOf(t) + "-" + String(h).padStart(3, "0") + "-" + Math.floor(rng() * 9000 + 1000),
          lastStep: stop, lastStepLabel: steps[stop].label, ts: dstamp(t)
        });
      }
    }
    return { key: j.key, steps: steps.map(function (s) { return { label: s.label, kind: s.kind, screen: s.screen || null, api: s.api || null, biggestDrop: !!s.biggestDrop }; }),
             sessions: sess, unknown: unk, samples: samples };
  }
  function journeyFunnel(key) {
    if (CACHE.jf[key]) return CACHE.jf[key];
    var j = REG.byJourney[key];
    if (!j) throw new Error("PULSE_SPINE.journeyFunnel: unknown journey " + key);
    return (CACHE.jf[key] = timed(function () { return genFunnel(j); }));
  }

  /* ========================================================================= *
   * 7 · Small aggregate helpers the synthesis layer leans on.
   * ========================================================================= */
  function coverage(key, t0, t1) {
    var s = route(key), total = 0, covered = 0;
    for (var t = t0; t <= t1; t++) {
      if (s.unknown[t] === 2) continue;        /* not deployed: out of scope   */
      total++; if (!s.unknown[t]) covered++;
    }
    return { covered: covered, total: total, ratio: total ? covered / total : 1 };
  }
  function pipelineHealth() {
    var out = [], rng = mulberry32(keySeed("v2:pipeline"));
    for (var i = 0; i < REG.sources.length; i++) {
      var s = REG.sources[i], isGap = (s.node === GAP.node);
      out.push({
        node: s.node, name: s.name, lane: s.lane, state: s.state,
        buffer_bytes: Math.round(isGap ? 41000000 : 120000 + rng() * 900000),
        dropped_records: isGap ? 0 : Math.round(rng() * 4),
        watermark: isGap ? GAP.t0 - 1 : NOW - Math.floor(rng() * 3),
        watermarkLabel: isGap ? dstamp(GAP.t0 - 1) : dstamp(NOW),
        gap: isGap ? { t0: GAP.t0, t1: GAP.t1, mins: GAP.mins, label: GAP.label, reason: GAP.reason } : null
      });
    }
    return out;
  }

  /* ========================================================================= *
   * Publish.
   * ========================================================================= */
  window.PULSE_SPINE = {
    version: "2.0.2",
    SEED: ADEPTIO_SEED,
    N: N, STEP_MIN: STEP_MIN, DAY: DAY, NOW: NOW, HOURS: HOURS,
    MIN_WINDOW: MIN_WINDOW, MINUTES: MINUTES,
    statusMix: STATUS_MIX,
    gap: GAP, gapHours: GAP_HOURS, inGap: inGap,

    /* seeding + time, exposed so the synthesis layer never invents its own */
    mulberry32: mulberry32, keySeed: keySeed,
    dayOf: dayOf, hm: hm, dstamp: dstamp, mstamp: mstamp,
    dayLabel: dayLabel, dayLabelCompact: dayLabelCompact, dayLabels: DAY_LABELS,
    sevAt: sevAt, win: win, ramp: ramp,
    diurnal: diurnal, dow: dow, shape: shape, phi: phi,

    /* the spine itself — every one of these is lazy and memoised */
    route: route, routeMinute: routeMinute,
    downstream: downstream, monitor: monitor,
    errorGroup: errorGroup, resultCode: resultCode,
    journeyFunnel: journeyFunnel,
    coverage: coverage, pipelineHealth: pipelineHealth,

    stats: function () { return { series: STATS.generated, ms: STATS.ms }; },
    clearCache: function () { CACHE = { route: {}, minute: {}, down: {}, mon: {}, eg: {}, rc: {}, jf: {} }; STATS.generated = 0; STATS.ms = 0; }
  };
}());
