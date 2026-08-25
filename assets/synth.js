/* ============================================================================
 * ADEPTIO Pulse — DEMO SITE v2.0 · SYNTHESIS LAYER  (window.PULSE_SYNTH)
 *
 * One canonical spine (data/spine.js) -> one synthesis layer -> every menu.
 * Page builders code against the signatures documented in
 * docs/SPEC-Site-v2.0.md and never touch the spine or the registry directly.
 *
 * Rules this layer enforces on every page:
 *   - UNKNOWN is not zero. A bucket the collector never delivered is excluded
 *     from the denominator and shrinks `coverage`; it never renders as 0%.
 *   - coverage < 0.98 -> `provisional: true` (badge)
 *     coverage < 0.50 -> `state: "unknown"` and the value is null (NO DATA)
 *   - Group and service rows are recomputed from the constituent buckets,
 *     never averaged from the child rows.
 *   - Probe traffic and the three control monitors are excluded from every
 *     availability denominator.
 *
 * Everything is lazy and memoised in window.PULSE_CACHE. Budget: full spine
 * generation + synthesis for one page <= 400 ms.
 *
 * Load order: data/manifest.js -> data/rcameta.js -> data/tickets.js ->
 *             data/registry.js -> data/spine.js -> assets/synth.js
 * ==========================================================================*/
(function () {
  "use strict";

  var REG = window.PULSE_REG, SP = window.PULSE_SPINE, D_ = window.ADEPTIO_DATA;
  if (!REG) throw new Error("PULSE_REG missing - load data/registry.js first");
  if (!SP) throw new Error("PULSE_SPINE missing - load data/spine.js first");
  if (!D_) throw new Error("ADEPTIO_DATA missing - load data/manifest.js first");

  var TICKETS = window.ADEPTIO_TICKETS || { tickets: [], byWindow: {} };
  var RCA = window.ADEPTIO_RCA || { nodes: {}, indicators: {} };

  var N = SP.N, DAY = SP.DAY, NOW = SP.NOW, HOURS = SP.HOURS, TH = REG.thresholds;

  /* ======================================================================== *
   * CACHE
   * ======================================================================== */
  var CACHE = (window.PULSE_CACHE = window.PULSE_CACHE || {});
  function cached(ns, key, fn) {
    var b = CACHE[ns] || (CACHE[ns] = {});
    if (Object.prototype.hasOwnProperty.call(b, key)) return b[key];
    var t0 = Date.now(), v = fn();
    (CACHE.__timing || (CACHE.__timing = {}))[ns + "|" + key] = Date.now() - t0;
    b[key] = v; return v;
  }
  function clearCache() {
    for (var k in CACHE) { if (Object.prototype.hasOwnProperty.call(CACHE, k)) delete CACHE[k]; }
    AGG_MEMO = {}; EDGE_MEMO = {}; RECENT_MEMO = {};
    SP.clearCache();
  }

  /* ======================================================================== *
   * FORMAT + BAND HELPERS  (every page uses these, nothing formats inline)
   * ======================================================================== */
  function dayOf(t) { return SP.dayOf(t); }
  function hm(t) { return SP.hm(t); }
  function dstamp(t) { return SP.dstamp(t); }
  function mstamp(mi) { return SP.mstamp(mi); }
  function dayLabel(d) { return SP.dayLabel(d); }

  /* ---- incident-window display naming (v2.0.1) ----------------------------
     The KEY stays a single letter EVERYWHERE (D_.INC, D_.INCMETA,
     TICKETS.byWindow, issue.incKey) - only the rendered identity changes.
     Pages must print `windowDisplay` / `incident.windowDisplay` ON ITS OWN:
     it already carries the week, the word "Incident" and the letter, so it
     must never be prefixed with the key again. `windowShort` is the compact
     form for the few places a full name will not fit. The raw INCMETA name
     stays available unchanged as `windowLabel` / `incident.label`.        */
  var WK_KEY = (D_.WEEK && D_.WEEK.wk) || "WK34";
  var WK_TAG = WK_KEY.replace(/^WK/, "W");
  function incName(k) { return (D_.INCMETA[k] || [k, "warn"])[0]; }
  function incDisplay(k) { return WK_KEY + " · Incident " + k + " — " + incName(k); }
  function incShort(k) { return WK_TAG + "·" + k; }

  function fmtNum(n) {
    if (n == null || !isFinite(n)) return "-";
    var s = Math.round(n).toString(), out = "", c = 0;
    for (var i = s.length - 1; i >= 0; i--) { out = s[i] + out; if (++c % 3 === 0 && i > 0) out = "," + out; }
    return out;
  }
  function fmtCompact(n) {
    if (n == null || !isFinite(n)) return "-";
    var a = Math.abs(n);
    if (a >= 1e9) return (n / 1e9).toFixed(a >= 1e10 ? 0 : 1) + "B";
    if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 0 : 1) + "M";
    if (a >= 1e3) return (n / 1e3).toFixed(a >= 1e4 ? 0 : 1) + "K";
    return String(Math.round(n));
  }
  function fmtPct(x, dp) { return (x == null || !isFinite(x)) ? "-" : x.toFixed(dp == null ? 2 : dp) + "%"; }
  function fmtRate(x) { return (x == null || !isFinite(x)) ? "-" : x.toFixed(4) + "%"; }
  function fmtMs(ms) {
    if (ms == null || !isFinite(ms)) return "-";
    if (ms >= 60000) return (ms / 60000).toFixed(1) + "m";
    if (ms >= 1000) return (ms / 1000).toFixed(2) + "s";
    return Math.round(ms) + "ms";
  }
  function fmtDelta(pp, dp) {
    if (pp == null || !isFinite(pp)) return "-";
    var v = pp.toFixed(dp == null ? 2 : dp);
    return (pp > 0 ? "+" : "") + v + "pp";
  }
  function fmtSigned(x, dp) {
    if (x == null || !isFinite(x)) return "-";
    return (x > 0 ? "+" : "") + x.toFixed(dp == null ? 1 : dp) + "%";
  }
  function fmtBytes(b) {
    if (b == null) return "-";
    if (b >= 1e9) return (b / 1e9).toFixed(2) + " GB";
    if (b >= 1e6) return (b / 1e6).toFixed(1) + " MB";
    if (b >= 1e3) return (b / 1e3).toFixed(0) + " KB";
    return b + " B";
  }
  function fmtDur(mins) {
    if (mins == null) return "-";
    if (mins >= 1440) return (mins / 1440).toFixed(1) + " d";
    if (mins >= 60) return Math.floor(mins / 60) + " h " + Math.round(mins % 60) + " m";
    return Math.round(mins) + " m";
  }

  /* colour bands ---------------------------------------------------------- */
  function slaBand(pct) {
    if (pct == null || !isFinite(pct)) return "unk";
    if (pct >= TH.slaBands.ok) return "ok";
    if (pct >= TH.slaBands.warn) return "warn";
    return "crit";
  }
  function latBand(ms, T) {
    if (ms == null || !isFinite(ms)) return "unk";
    T = T || 4500;
    if (ms > T * TH.latBands.severe) return "severe";
    if (ms > T * TH.latBands.warn) return "crit";
    if (ms > T * TH.latBands.ok) return "warn";
    return "ok";
  }
  function errBand(pct) {
    if (pct == null || !isFinite(pct)) return "unk";
    if (pct < TH.errBands.ok) return "ok";
    if (pct < TH.errBands.warn) return "warn";
    return "crit";
  }
  /* journey severity legend (menu 9): green >=95, yellow <95 or delta<-5pp,
     red <80 or delta<-15pp                                                   */
  function journeyBand(pct, deltaPP) {
    if (pct == null || !isFinite(pct)) return "unk";
    if (pct < 80 || (deltaPP != null && deltaPP < -15)) return "crit";
    if (pct < 95 || (deltaPP != null && deltaPP < -5)) return "warn";
    return "ok";
  }
  function covState(ratio) {
    if (ratio == null) return { state: "ok", provisional: false, nodata: false, coverage: 1 };
    if (ratio < TH.coverage.nodata) return { state: "unknown", provisional: true, nodata: true, coverage: ratio };
    if (ratio < TH.coverage.provisional) return { state: "provisional", provisional: true, nodata: false, coverage: ratio };
    return { state: "ok", provisional: false, nodata: false, coverage: ratio };
  }

  /* ======================================================================== *
   * RANGE
   * ======================================================================== */
  var RANGE_BUCKETS = {
    "1h": 12, "4h": 48, "12h": 144, "24h": 288, "48h": 576,
    "7d": 2016, "14d": 2016, "30d": 2016, "wk": 2016
  };
  function range(name) {
    if (name && typeof name === "object") {
      var a = Math.max(0, Math.min(N - 1, name.t0 | 0)), b = Math.max(a, Math.min(N - 1, name.t1 | 0));
      return { key: name.key || "custom", t0: a, t1: b, buckets: b - a + 1,
               label: dstamp(a) + " - " + dstamp(b), clamped: false, custom: true };
    }
    var k = name || "24h";
    if (k === "yesterday") {
      return { key: "yesterday", t0: 5 * DAY, t1: 6 * DAY - 1, buckets: DAY,
               label: "Aug 28 00:00 - Aug 28 23:55 (yesterday)", clamped: false, custom: false };
    }
    if (k === "wk") {
      return { key: "wk", t0: 0, t1: N - 1, buckets: N, label: "Aug 23 00:00 - Aug 29 23:55 (week)",
               clamped: false, custom: false };
    }
    var w = RANGE_BUCKETS[k];
    if (!w) { k = "24h"; w = RANGE_BUCKETS[k]; }
    var clamped = (k === "14d" || k === "30d");
    var t1 = NOW, t0 = Math.max(0, NOW - w + 1);
    return { key: k, t0: t0, t1: t1, buckets: t1 - t0 + 1,
             label: dstamp(t0) + " - " + dstamp(t1) + (clamped ? " (clamped to the seeded week)" : ""),
             clamped: clamped, custom: false };
  }
  function rangeMinutes(r) { return (r.t1 - r.t0 + 1) * SP.STEP_MIN; }

  /* ======================================================================== *
   * CORE AGGREGATION over the canonical bucket
   * ======================================================================== */
  function blankAgg() {
    return { count: 0, ok: 0, biz: 0, tech: 0, withinT: 0, buckets: 0, covered: 0,
             unknownBuckets: 0, notDeployed: 0, p50: 0, p75: 0, p95: 0, p99: 0, w: 0 };
  }
  function addRoute(agg, key, t0, t1) {
    var s = SP.route(key);
    for (var t = t0; t <= t1; t++) {
      if (s.unknown[t] === 2) { agg.notDeployed++; continue; }
      agg.buckets++;
      if (s.unknown[t] === 1) { agg.unknownBuckets++; continue; }
      agg.covered++;
      var c = s.count[t];
      agg.count += c; agg.ok += s.ok[t]; agg.biz += s.biz_fail[t]; agg.tech += s.tech_fail[t];
      agg.withinT += s.within_T[t];
      agg.p50 += s.p50[t] * c; agg.p75 += s.p75[t] * c; agg.p95 += s.p95[t] * c; agg.p99 += s.p99[t] * c;
      agg.w += c;
    }
    return agg;
  }
  /* Percentiles over a window are volume-weighted means of the per-bucket
     percentile. Documented approximation - stated in SPEC-Site-v2.0.md.     */
  function finishAgg(a) {
    var w = a.w || 1;
    var cov = a.buckets ? a.covered / a.buckets : 1;
    var cs = covState(cov);
    var out = {
      requests: a.count, ok: a.ok, businessFail: a.biz, technicalFail: a.tech,
      errors: a.tech, withinT: a.withinT,
      successPct: a.count ? (a.count - a.tech) / a.count * 100 : null,
      strictPct: a.count ? a.ok / a.count * 100 : null,
      responsePct: a.count ? a.withinT / a.count * 100 : null,
      errorRatePct: a.count ? a.tech / a.count * 100 : null,
      businessRatePct: a.count ? a.biz / a.count * 100 : null,
      p50: a.w ? a.p50 / w : null, p75: a.w ? a.p75 / w : null,
      p95: a.w ? a.p95 / w : null, p99: a.w ? a.p99 / w : null,
      coverage: cov, provisional: cs.provisional, state: cs.state,
      unknownBuckets: a.unknownBuckets, buckets: a.buckets, notDeployed: a.notDeployed
    };
    if (cs.nodata) { out.successPct = null; out.responsePct = null; out.errorRatePct = null; out.strictPct = null; }
    return out;
  }
  /* Memoised: a page asks for the same (routes, window) several times over —
     the journey card, its by-stage row and its status breakdown all want the
     same aggregate. The result object is READ-ONLY for callers.             */
  var AGG_MEMO = {};
  function aggRoutes(keys, t0, t1) {
    var mk = t0 + ":" + t1 + ":" + keys.join("|");
    var hit = AGG_MEMO[mk];
    if (hit) return hit;
    var a = blankAgg();
    for (var i = 0; i < keys.length; i++) addRoute(a, keys[i], t0, t1);
    return (AGG_MEMO[mk] = finishAgg(a));
  }
  function routesOf(pred) {
    var out = [];
    for (var i = 0; i < REG.routes.length; i++) if (pred(REG.routes[i])) out.push(REG.routes[i].key);
    return out;
  }
  /* the three route indexes are built once — they are pure registry facts */
  var IDX = (function () {
    var byJ = {}, byS = {}, byG = {}, all = [];
    for (var i = 0; i < REG.routes.length; i++) {
      var r = REG.routes[i];
      (byJ[r.journey] || (byJ[r.journey] = [])).push(r.key);
      (byS[r.svc] || (byS[r.svc] = [])).push(r.key);
      (byG[r.group] || (byG[r.group] = [])).push(r.key);
      all.push(r.key);
    }
    return { j: byJ, s: byS, g: byG, all: all };
  }());
  function routesByJourney(j) { return IDX.j[j] || []; }
  function routesBySvc(s) { return IDX.s[s] || []; }
  function routesByGroup(g) { return IDX.g[g] || []; }
  function allRouteKeys() { return IDX.all; }
  /* business result codes per service, for the journey status breakdown */
  var BIZ_CODES = (function () {
    var m = {};
    for (var i = 0; i < REG.resultCodes.length; i++) {
      var c = REG.resultCodes[i];
      if (c.type !== "B" || c.http === 200) continue;
      (m[c.svc] || (m[c.svc] = [])).push(c.http);
    }
    return m;
  }());

  /* a service with no ingress route template (core-adapter) is measured on the
     EGRESS lane instead: requests = outbound calls, errors = upstream 5xx.   */
  function svcFromEdges(svcKey, t0, t1) {
    var calls = 0, s5 = 0, s4 = 0, lat = 0, w = 0, unknown = 0, buckets = 0;
    for (var i = 0; i < REG.downstreams.length; i++) {
      var d = REG.downstreams[i];
      if (d.callers.indexOf(svcKey) < 0) continue;
      var share = 1 / d.callers.length, s = SP.downstream(d.key);
      for (var t = t0; t <= t1; t++) {
        buckets++;
        if (s.unknown[t]) { unknown++; continue; }
        var c = s.calls[t] * share;
        calls += c; s5 += s.s5xx[t] * share; s4 += s.s4xx[t] * share;
        lat += s.latency[t] * c; w += c;
      }
    }
    var cov = buckets ? (buckets - unknown) / buckets : 1, cs = covState(cov);
    var avg = w ? lat / w : null;
    return {
      requests: Math.round(calls), errors: Math.round(s5), businessFail: Math.round(s4),
      technicalFail: Math.round(s5),
      successPct: calls ? (calls - s5) / calls * 100 : null,
      strictPct: calls ? (calls - s5 - s4) / calls * 100 : null,
      responsePct: null,
      errorRatePct: calls ? s5 / calls * 100 : null,
      businessRatePct: calls ? s4 / calls * 100 : null,
      p50: avg, p75: avg ? avg * 1.35 : null, p95: avg ? avg * 2.4 : null, p99: avg ? avg * 3.6 : null,
      coverage: cov, provisional: cs.provisional, state: cs.state,
      unknownBuckets: unknown, buckets: buckets, notDeployed: 0, derivedFrom: "egress edges (L3 proxy lane)"
    };
  }
  var EDGE_MEMO = {};
  function svcAgg(svcKey, t0, t1) {
    var keys = routesBySvc(svcKey);
    if (keys.length) return aggRoutes(keys, t0, t1);
    var mk = svcKey + ":" + t0 + ":" + t1;
    return EDGE_MEMO[mk] || (EDGE_MEMO[mk] = svcFromEdges(svcKey, t0, t1));
  }

  /* ---- probe availability (L1) ------------------------------------------- */
  function probeAvailability(t0, t1, svcFilter) {
    var pass = 0, total = 0, nodata = 0;
    for (var i = 0; i < REG.monitors.length; i++) {
      var m = REG.monitors[i];
      if (m.control) continue;                                   /* controls never enter a denominator */
      if (svcFilter && svcFilter.indexOf(m.svc) < 0) continue;
      var s = SP.monitor(m.id);
      for (var t = t0; t <= t1; t++) {
        if (s.ok[t] === 2) { nodata++; continue; }
        total++; if (s.ok[t] === 1) pass++;
      }
    }
    var cov = (total + nodata) ? total / (total + nodata) : 1;
    return { pct: total ? pass / total * 100 : null, checks: total, nodata: nodata,
             coverage: cov, provisional: covState(cov).provisional };
  }

  /* ======================================================================== *
   * 1 · weeklySLA(wk)
   * ======================================================================== */
  function weeklySLA(wk) {
    var key = wk || "WK34";
    return cached("weeklySLA", key, function () {
      var week = null, i, j;
      for (i = 0; i < REG.weeks.length; i++) if (REG.weeks[i].key === key) week = REG.weeks[i];
      if (!week) week = REG.weeks[REG.weeks.length - 1];
      var t0 = 0, t1 = N - 1;

      var all = aggRoutes(allRouteKeys(), t0, t1);
      var av = probeAvailability(t0, t1, null);

      function tile(v, cov, src, extra) {
        var cs = covState(cov);
        return { value: cs.nodata ? null : v, target: TH.slaTarget,
                 pass: cs.nodata ? null : (v != null && v >= TH.slaTarget),
                 band: cs.nodata ? "unk" : slaBand(v), coverage: cov,
                 provisional: cs.provisional, state: cs.state, source: src, note: extra || null };
      }
      var tiles = {
        availability: tile(av.pct, av.coverage, "L1 synthetic probes (assertion in the numerator; 3 control monitors excluded)"),
        success: tile(all.successPct, all.coverage, "L3 gateway rows: countIf(status<500)/count()"),
        responseTime: tile(all.responsePct, all.coverage, "L3 gateway rows: countIf(dur_ms<=T_ms)/count()")
      };

      var rows = [], sumPrev = 0, sumCur = 0, nCur = 0;
      for (i = 0; i < REG.journeys.length; i++) {
        var jn = REG.journeys[i];
        var a = aggRoutes(routesByJourney(jn.key), t0, t1);
        var prevAnchor = REG.weeks[2].success;                 /* WK33 anchor */
        var rr = SP.mulberry32(SP.keySeed("v2:wk:WK33:" + jn.key + ":success"));
        var prev = Math.min(99.999, prevAnchor + (rr() - 0.5) * 0.22);
        var cur = a.successPct;
        rows.push({
          key: jn.key, service: jn.name, node: jn.node, svc: jn.svc, target: TH.slaTarget,
          prevWeek: REG.weeks[2].key, prev: +prev.toFixed(3),
          curWeek: week.key, cur: cur == null ? null : +cur.toFixed(3),
          responseTime: a.responsePct == null ? null : +a.responsePct.toFixed(3),
          delta: cur == null ? null : +(cur - prev).toFixed(3),
          status: slaBand(cur), requests: a.requests, errors: a.technicalFail,
          coverage: a.coverage, provisional: a.provisional, state: a.state,
          unknownBuckets: a.unknownBuckets
        });
        if (cur != null) { sumPrev += prev; sumCur += cur; nCur++; }
      }
      var avgPrev = nCur ? sumPrev / nCur : null, avgCur = nCur ? sumCur / nCur : null;

      var trend = [];
      for (i = 0; i < REG.weeks.length; i++) {
        var w = REG.weeks[i];
        trend.push({
          week: w.key, label: w.label, range: w.range || null, current: !!w.current,
          availability: w.current ? (tiles.availability.value == null ? null : +tiles.availability.value.toFixed(3)) : w.availability,
          success: w.current ? (tiles.success.value == null ? null : +tiles.success.value.toFixed(3)) : w.success,
          responseTime: w.current ? (tiles.responseTime.value == null ? null : +tiles.responseTime.value.toFixed(3)) : w.responseTime
        });
      }
      /* per-service 4-week trend bars */
      for (i = 0; i < rows.length; i++) {
        var bars = [];
        for (j = 0; j < REG.weeks.length; j++) {
          var wk2 = REG.weeks[j];
          if (wk2.current) { bars.push({ week: wk2.key, value: rows[i].cur, current: true }); continue; }
          var r2 = SP.mulberry32(SP.keySeed("v2:wk:" + wk2.key + ":" + rows[i].key + ":success"));
          bars.push({ week: wk2.key, value: +Math.min(99.999, wk2.success + (r2() - 0.5) * 0.22).toFixed(3), current: false });
        }
        rows[i].trend = bars;
      }

      return {
        week: { key: week.key, label: week.label, range: week.range || null,
                t0: t0, t1: t1, current: !!week.current,
                label_range: "Aug 23 00:00 - Aug 29 23:55" },
        target: TH.slaTarget, criticalCount: rows.length,
        tiles: tiles, rows: rows,
        average: { prev: avgPrev == null ? null : +avgPrev.toFixed(3),
                   cur: avgCur == null ? null : +avgCur.toFixed(3),
                   delta: (avgPrev == null || avgCur == null) ? null : +(avgCur - avgPrev).toFixed(3),
                   status: slaBand(avgCur), label: "Average (EW)" },
        trend: trend,
        coverage: { ratio: all.coverage, provisional: covState(all.coverage).provisional,
                    unknownBuckets: all.unknownBuckets, gap: REG.gap },
        denominator: TH.denominator,
        csvColumns: ["service", "target", REG.weeks[2].key, week.key, "delta", "status", "coverage_pct", "provisional"],
        lineage: REG.lineage["sla-weekly"]
      };
    });
  }

  /* ======================================================================== *
   * 2 · drilldown(days)
   * ======================================================================== */
  function dayCell(keys, d) {
    var t0 = d * DAY, t1 = t0 + DAY - 1, a = blankAgg(), i;
    for (i = 0; i < keys.length; i++) addRoute(a, keys[i], t0, t1);
    var f = finishAgg(a);
    var lat = f.p95;
    return {
      day: d, label: dayLabel(d + 1),
      c: f.successPct == null ? null : +f.successPct.toFixed(2),
      t: f.responsePct == null ? null : +f.responsePct.toFixed(2),
      s5xx: f.technicalFail, n: f.requests,
      p95: lat == null ? null : Math.round(lat),
      cBand: slaBand(f.successPct), tBand: slaBand(f.responsePct),
      latBand: latBand(lat, keys.length === 1 ? REG.byRoute[keys[0]].T_ms : 4500),
      coverage: f.coverage, provisional: f.provisional, state: f.state,
      unknownBuckets: f.unknownBuckets, notDeployed: !!(f.notDeployed && f.buckets === 0)
    };
  }
  function drilldown(days) {
    var nd = Math.max(1, Math.min(7, days || 7));
    return cached("drilldown", String(nd), function () {
      var first = 7 - nd, dayCols = [], d, i, g, k;
      for (d = first; d < 7; d++) dayCols.push({ index: d, label: dayLabel(d + 1), t0: d * DAY, t1: d * DAY + DAY - 1 });

      var groups = [], txnTotal = 0, apiCount = 0;
      for (g = 0; g < REG.groups.length; g++) {
        var grp = REG.groups[g], gkeys = routesByGroup(grp.key);
        var gcells = [], apis = [];
        for (i = 0; i < dayCols.length; i++) gcells.push(dayCell(gkeys, dayCols[i].index));
        var gtot = aggRoutes(gkeys, dayCols[0].t0, dayCols[dayCols.length - 1].t1);
        for (k = 0; k < gkeys.length; k++) {
          var rt = REG.byRoute[gkeys[k]], acells = [];
          for (i = 0; i < dayCols.length; i++) acells.push(dayCell([rt.key], dayCols[i].index));
          var atot = aggRoutes([rt.key], dayCols[0].t0, dayCols[dayCols.length - 1].t1);
          apis.push({
            key: rt.key, method: rt.method, path: rt.path, svc: rt.svc, T_ms: rt.T_ms,
            newInD: !!rt.newInD,
            introducedAt: rt.introducedAt, introducedLabel: rt.introducedAt != null ? dstamp(rt.introducedAt) : null,
            cells: acells,
            totals: { c: atot.successPct, t: atot.responsePct, s5xx: atot.technicalFail, n: atot.requests,
                      cBand: slaBand(atot.successPct), tBand: slaBand(atot.responsePct),
                      coverage: atot.coverage, provisional: atot.provisional, state: atot.state }
          });
          apiCount++;
        }
        txnTotal += gtot.requests;
        groups.push({
          key: grp.key, name: grp.name, journey: grp.journey, T_ms: grp.T_ms,
          apiCount: gkeys.length, cells: gcells,
          totals: { c: gtot.successPct, t: gtot.responsePct, s5xx: gtot.technicalFail, n: gtot.requests,
                    cBand: slaBand(gtot.successPct), tBand: slaBand(gtot.responsePct),
                    coverage: gtot.coverage, provisional: gtot.provisional, state: gtot.state },
          apis: apis
        });
      }

      /* JOURNEY SUBTOTALS -----------------------------------------------------
         A journey can span several groups (Home = Home & Landing + Profile &
         Account + Notification & Receipts), so a group row is NOT the journey.
         Each journey subtotal is recomputed from the RAW buckets of ALL of its
         routes over the same window and with the same denominator rules as
         weeklySLA - never averaged from the group rows. Over 7 days this makes
         drilldown(7).journeys[k].totals.c === weeklySLA('WK34').rows[k].cur.   */
      var journeys = [], jrs, jn, jkeys, jcells, jtot, jgroups, gi;
      for (jrs = 0; jrs < REG.journeys.length; jrs++) {
        jn = REG.journeys[jrs];
        jkeys = routesByJourney(jn.key);
        jgroups = [];
        for (gi = 0; gi < REG.groups.length; gi++) if (REG.groups[gi].journey === jn.key) jgroups.push(REG.groups[gi].key);
        jcells = [];
        for (i = 0; i < dayCols.length; i++) jcells.push(dayCell(jkeys, dayCols[i].index));
        jtot = aggRoutes(jkeys, dayCols[0].t0, dayCols[dayCols.length - 1].t1);
        journeys.push({
          key: jn.key, name: jn.name, svc: jn.svc, node: jn.node, T_ms: jn.T_ms, sla: jn.sla,
          groups: jgroups, groupCount: jgroups.length, apiCount: jkeys.length, routes: jkeys,
          cells: jcells,
          totals: { c: jtot.successPct, t: jtot.responsePct, s5xx: jtot.technicalFail, n: jtot.requests,
                    cBand: slaBand(jtot.successPct), tBand: slaBand(jtot.responsePct),
                    coverage: jtot.coverage, provisional: jtot.provisional, state: jtot.state }
        });
      }

      return {
        days: dayCols, target: TH.slaTarget, groupCount: groups.length, apiCount: apiCount,
        journeyCount: journeys.length,
        txnTotal: txnTotal, groups: groups, journeys: journeys,
        legend: {
          c: [{ band: "ok", text: ">= 99.9%" }, { band: "warn", text: "99.0 - 99.9%" }, { band: "crit", text: "< 99.0%" }],
          t: [{ band: "ok", text: "< 1 s equivalent (<= 0.25 x T)" }, { band: "warn", text: "<= T" },
              { band: "crit", text: "> T" }, { band: "severe", text: "> 3.3 x T" }]
        },
        notes: {
          additive: true,
          text: "L1 transactions and L2 hits are both computed from the same unsampled gateway rows, so unlike the reference tool the two levels ARE additive here. Group rows are recomputed from raw buckets, never averaged from the API rows, and journey subtotals are recomputed the same way over ALL routes of the journey - a journey can span several groups, so a group row is not a journey."
        },
        coverage: { gap: REG.gap },
        lineage: REG.lineage["sla-drilldown"]
      };
    });
  }

  /* ======================================================================== *
   * 3 · kpiLive(journey, range, precision)
   * ======================================================================== */
  /* BUSINESS-DECLINE ANCHOR.
     An Incident-A style decline is a ROUTE-level event: the pay call declines with
     HTTP 200 while every other route in the journey keeps its baseline mix, so a
     journey-wide business rate dilutes the signal by roughly the anchor's share
     of journey volume (~3x instead of ~7.5x - see SPEC §6). declineRatio is
     therefore defined on the anchor route: the route the registry gives the
     largest incident business multiplier `bx`. Its 4-week baseline is the
     registry's declared steady-state business-decline fraction `e4` (the number
     the seed was built from and what a 4-week trailing average returns).
     Journeys with no declared bx have no anchor and report null.               */
  var DECLINE_ANCHOR = (function () {
    var m = {}, i, w;
    for (i = 0; i < REG.routes.length; i++) {
      var rt = REG.routes[i], bx = 0;
      if (rt.inc) for (w in rt.inc) { if (rt.inc[w] && rt.inc[w].bx > bx) bx = rt.inc[w].bx; }
      if (!bx) continue;
      var cur = m[rt.journey];
      if (!cur || bx > cur.bx) m[rt.journey] = { route: rt.key, bx: bx, baseline: rt.e4 * 100 };
    }
    return m;
  }());
  function declineOf(journeyKey, t0, t1) {
    var an = DECLINE_ANCHOR[journeyKey];
    if (!an) return null;
    var da = aggRoutes([an.route], t0, t1), br = da.businessRatePct;
    return {
      route: an.route,
      baseline: +an.baseline.toFixed(4),
      rate: br == null ? null : +br.toFixed(4),
      ratio: (br == null || !an.baseline) ? null : +(br / an.baseline).toFixed(2),
      basis: "route business rate in the window / the route's 4-week baseline (registry e4)"
    };
  }
  function kpiLive(journeyKey, rangeName, precision) {
    var jk = journeyKey || REG.journeys[0].key;
    var r = range(rangeName || "24h");
    var prec = precision || "1m";
    return cached("kpiLive", jk + "|" + r.key + "|" + r.t0 + "|" + r.t1 + "|" + prec, function () {
      var j = REG.byJourney[jk];
      if (!j) throw new Error("kpiLive: unknown journey " + jk);
      var keys = routesByJourney(jk);
      var a = aggRoutes(keys, r.t0, r.t1);
      var mins = rangeMinutes(r), secs = mins * 60;

      var sla = a.successPct;
      var budget = sla == null ? null : +(sla - j.sla).toFixed(4);
      var dec = declineOf(jk, r.t0, r.t1);

      /* series: 1-minute where the window is inside the last 24 h, else 5-min */
      var use1m = (prec !== "5m") && (r.t0 >= N - SP.MIN_WINDOW);
      var labels = [], errSeries = [], p75Series = [], p99Series = [], reqSeries = [], i, t;
      if (use1m) {
        var m0 = (r.t0 - (N - SP.MIN_WINDOW)) * 5, m1 = (r.t1 - (N - SP.MIN_WINDOW)) * 5 + 4;
        for (i = m0; i <= m1; i++) {
          var c = 0, x = 0, p75s = 0, p99s = 0, w = 0, unk = 0;
          for (var q = 0; q < keys.length; q++) {
            var s = SP.routeMinute(keys[q]);
            if (s.unknown[i]) { unk++; continue; }
            c += s.count[i]; x += s.tech_fail[i];
            p75s += s.p75[i] * s.count[i]; p99s += s.p99[i] * s.count[i]; w += s.count[i];
          }
          labels.push(mstamp(i));
          errSeries.push(c ? +(x / c * 100).toFixed(4) : (unk === keys.length ? null : 0));
          p75Series.push(w ? Math.round(p75s / w) : null);
          p99Series.push(w ? Math.round(p99s / w) : null);
          reqSeries.push(c);
        }
      } else {
        for (t = r.t0; t <= r.t1; t++) {
          var c2 = 0, x2 = 0, a75 = 0, a99 = 0, w2 = 0, unk2 = 0;
          for (var q2 = 0; q2 < keys.length; q2++) {
            var s2 = SP.route(keys[q2]);
            if (s2.unknown[t]) { unk2++; continue; }
            c2 += s2.count[t]; x2 += s2.tech_fail[t];
            a75 += s2.p75[t] * s2.count[t]; a99 += s2.p99[t] * s2.count[t]; w2 += s2.count[t];
          }
          labels.push(dstamp(t));
          errSeries.push(c2 ? +(x2 / c2 * 100).toFixed(4) : (unk2 === keys.length ? null : 0));
          p75Series.push(w2 ? Math.round(a75 / w2) : null);
          p99Series.push(w2 ? Math.round(a99 / w2) : null);
          reqSeries.push(c2);
        }
      }

      return {
        journey: { key: j.key, name: j.name, svc: j.svc, deploy: j.deploy, node: j.node,
                   T_ms: j.T_ms, sla: j.sla, critical: j.critical },
        range: r, precision: prec, effectivePrecision: use1m ? "1m" : "5m",
        tabs: REG.journeys.map(function (x) { return { key: x.key, name: x.name }; }),
        header: {
          sla: sla == null ? null : +sla.toFixed(2),
          threshold: j.sla, pass: sla != null && sla >= j.sla, band: slaBand(sla),
          errorBudget: budget, errorBudgetBreached: budget != null && budget < 0,
          requests: a.requests, errors: a.technicalFail,
          errorRate: a.errorRatePct == null ? null : +a.errorRatePct.toFixed(4),
          businessErrors: a.businessFail,
          businessRate: a.businessRatePct == null ? null : +a.businessRatePct.toFixed(4),
          /* route-level decline signal - the journey-wide businessRate above is
             diluted by the journey's other routes (SPEC §6) */
          declineRatio: dec ? dec.ratio : null, decline: dec,
          p75: a.p75 == null ? null : Math.round(a.p75),
          p95: a.p95 == null ? null : Math.round(a.p95),
          p99: a.p99 == null ? null : Math.round(a.p99),
          rps: +(a.requests / secs).toFixed(2),
          responseCompliance: a.responsePct == null ? null : +a.responsePct.toFixed(3),
          coverage: a.coverage, provisional: a.provisional, state: a.state
        },
        series: {
          points: labels.length, labels: labels,
          errorRate: errSeries, p75: p75Series, p99: p99Series, requests: reqSeries,
          slaLine: +(100 - j.sla).toFixed(4)
        },
        routes: keys,
        note: "10 s precision is enabled only on journey routes in production; in this seeded demo the finest tier rendered is 1 m and the chip is labelled accordingly.",
        lineage: REG.lineage["kpi-live"]
      };
    });
  }

  /* ======================================================================== *
   * 4 · serviceHealth(range)
   * ======================================================================== */
  function statusOf(agg) {
    if (agg.state === "unknown") return "unknown";
    var er = agg.errorRatePct;
    if (er == null) return "unknown";
    if (er >= 5) return "critical";
    if (er >= 1) return "warn";
    return "ok";
  }
  var RECENT_MEMO = {};
  function recentErrorsFor(svcKey, t0, t1, limit) {
    var mk = (svcKey || "*") + ":" + t0 + ":" + t1 + ":" + (limit || 20);
    if (RECENT_MEMO[mk]) return RECENT_MEMO[mk];
    var out = [], i, k;
    for (i = 0; i < REG.errorGroups.length; i++) {
      var g = REG.errorGroups[i];
      if (svcKey && g.svc !== svcKey) continue;
      var s = SP.errorGroup(g.id);
      for (k = 0; k < s.occurrences.length; k++) {
        var o = s.occurrences[k];
        if (o.t < t0 || o.t > t1) continue;
        out.push({ t: o.t, ts: o.ts, svc: g.svc, resource: o.endpoint, type: g.cls,
                   message: o.message, duration: o.duration, kind: g.kind });
      }
    }
    out.sort(function (a, b) { return b.t - a.t; });
    return (RECENT_MEMO[mk] = out.slice(0, limit || 20));
  }
  function serviceHealth(rangeName) {
    var r = range(rangeName || "24h");
    return cached("serviceHealth", r.key + "|" + r.t0 + "|" + r.t1, function () {
      var rows = [], totReq = 0, totErr = 0, egCalls = 0, egS5 = 0, crit = 0, i, k;
      for (i = 0; i < REG.services.length; i++) {
        var sv = REG.services[i];
        var a = svcAgg(sv.key, r.t0, r.t1);
        var st = statusOf(a);
        if (st === "critical") crit++;
        /* The estate tiles count INGRESS only. A service measured on the egress
           lane (derivedFrom set - core-adapter) would otherwise double-count the
           same customer transaction once as ingress and once as an outbound call,
           and its upstream 5xx would inflate the estate error count. Its row is
           kept as-is, and its two numbers are surfaced separately in the tiles so
           nothing is hidden.                                                    */
        if (a.derivedFrom) { egCalls += a.requests; egS5 += a.technicalFail; }
        else { totReq += a.requests; totErr += a.technicalFail; }

        var eps = [], keys = routesBySvc(sv.key);
        for (k = 0; k < keys.length; k++) {
          var ea = aggRoutes([keys[k]], r.t0, r.t1), rt = REG.byRoute[keys[k]];
          eps.push({
            route: keys[k], method: rt.method, path: rt.path, group: rt.groupName,
            requests: ea.requests, errors: ea.technicalFail,
            errorRate: ea.errorRatePct == null ? null : +ea.errorRatePct.toFixed(4),
            p75: ea.p75 == null ? null : Math.round(ea.p75),
            p95: ea.p95 == null ? null : Math.round(ea.p95),
            p99: ea.p99 == null ? null : Math.round(ea.p99),
            status: statusOf(ea), coverage: ea.coverage, provisional: ea.provisional, state: ea.state,
            newInD: !!rt.newInD
          });
        }
        eps.sort(function (x, y) { return y.requests - x.requests; });

        /* ERROR TYPES = the service's error groups ordered by last_seen */
        var types = [];
        for (k = 0; k < REG.errorGroups.length; k++) {
          var g = REG.errorGroups[k]; if (g.svc !== sv.key) continue;
          var gs = SP.errorGroup(g.id), cnt = 0, last = null, h;
          for (h = Math.floor(r.t0 / 12); h <= Math.floor(r.t1 / 12); h++) {
            if (h < 0 || h >= HOURS) continue;
            if (gs.unknown[h]) continue;
            cnt += gs.hourly[h]; if (gs.hourly[h] > 0) last = h;
          }
          if (!cnt) continue;
          var httpStatus = g.kind === "business" ? 400 : 500;
          types.push({ id: g.id, cls: g.cls, kind: g.kind, status: httpStatus,
                       endpoint: g.endpoints[0], count: cnt,
                       lastSeen: last == null ? null : dstamp(last * 12 + 11),
                       lastSeenT: last == null ? null : last * 12 + 11 });
        }
        types.sort(function (x, y) { return (y.lastSeenT || 0) - (x.lastSeenT || 0); });

        rows.push({
          key: sv.key, name: sv.name, deploy: sv.deploy, node: sv.node, zone: sv.zone,
          critical: sv.critical, lanes: sv.lanes,
          requests: a.requests, errors: a.technicalFail, businessFail: a.businessFail,
          errorRate: a.errorRatePct == null ? null : +a.errorRatePct.toFixed(4),
          p75: a.p75 == null ? null : Math.round(a.p75),
          p95: a.p95 == null ? null : Math.round(a.p95),
          p99: a.p99 == null ? null : Math.round(a.p99),
          status: st, band: errBand(a.errorRatePct),
          coverage: a.coverage, provisional: a.provisional, state: a.state,
          derivedFrom: a.derivedFrom || null, note: sv.note || null,
          endpoints: eps, errorTypes: types,
          recentErrors: recentErrorsFor(sv.key, r.t0, r.t1, 20),
          owner: REG.people[sv.node] || null
        });
      }
      rows.sort(function (x, y) { return y.requests - x.requests; });

      /* alerting monitors + open issues for the tiles */
      var alerting = 0, warnMon = 0;
      for (i = 0; i < REG.monitors.length; i++) {
        var s2 = SP.monitor(REG.monitors[i].id), fails = 0, tot = 0;
        for (var t = r.t0; t <= r.t1; t++) { if (s2.ok[t] === 2) continue; tot++; if (!s2.ok[t]) fails++; }
        if (!tot) continue;
        var up = (tot - fails) / tot;
        if (up < 0.8) alerting++; else if (up < 0.99) warnMon++;
      }
      var openIssues = 0;
      for (i = 0; i < REG.opsIssues.length; i++) {
        var st2 = REG.opsIssues[i].status;
        if (st2 !== "resolved" && st2 !== "won't fix") openIssues++;
      }

      return {
        range: r,
        tiles: {
          services: REG.services.length,
          /* INGRESS ONLY - equals drilldown(days).txnTotal and the sum of the
             non-derived service rows for the same window. */
          totalRequests: totReq, totalErrors: totErr,
          errorRate: totReq ? +(totErr / totReq * 100).toFixed(4) : null,
          /* the egress-derived rows (core-adapter), kept visible but out of the
             ingress denominator */
          egressCalls: egCalls, egress5xx: egS5,
          criticalServices: crit, alertingMonitors: alerting, warnMonitors: warnMon,
          openIssues: openIssues
        },
        rows: rows,
        recentErrors: recentErrorsFor(null, r.t0, r.t1, 20),
        lineage: REG.lineage["service-health"]
      };
    });
  }

  /* ======================================================================== *
   * 5 · synthetic(range)
   * ======================================================================== */
  function barsFor(s, t0, t1, maxBars) {
    var span = t1 - t0 + 1, nb = Math.min(maxBars || 96, span);
    var per = Math.ceil(span / nb), bars = [];
    for (var b = 0; b < nb; b++) {
      var a0 = t0 + b * per, a1 = Math.min(t1, a0 + per - 1);
      if (a0 > t1) break;
      var pass = 0, tot = 0, nd = 0;
      for (var t = a0; t <= a1; t++) { if (s.ok[t] === 2) { nd++; continue; } tot++; if (s.ok[t] === 1) pass++; }
      var state;
      if (!tot) state = "nodata";
      else { var u = pass / tot; state = u >= 1 ? "full" : u >= 0.8 ? "part" : "bad"; }
      bars.push({ state: state, t0: a0, t1: a1, uptime: tot ? +(pass / tot * 100).toFixed(2) : null,
                  label: dstamp(a0) });
    }
    return bars;
  }
  function synthetic(rangeName) {
    var r = range(rangeName || "24h");
    return cached("synthetic", r.key + "|" + r.t0 + "|" + r.t1, function () {
      var rows = [], up = 0, totalChecks = 0, passAll = 0, rtSum = 0, rtN = 0, i, t;
      var checksEx = 0, passEx = 0;
      var vantages = { dmz: { up: 0, total: 0 }, "app-zone": { up: 0, total: 0 }, telco: { up: 0, total: 0 } };
      for (i = 0; i < REG.monitors.length; i++) {
        var m = REG.monitors[i], s = SP.monitor(m.id);
        var pass = 0, fails = 0, tot = 0, nd = 0, rtA = 0, lastT = null, lastOk = null, lastStatus = null;
        for (t = r.t0; t <= r.t1; t++) {
          if (s.ok[t] === 2) { nd++; continue; }
          tot++; if (s.ok[t] === 1) { pass++; } else { fails++; }
          rtA += s.rt[t]; lastT = t; lastOk = s.ok[t] === 1; lastStatus = s.status[t];
        }
        var uptime = tot ? pass / tot * 100 : null;
        var isUp = lastOk === true;
        if (isUp) up++;
        totalChecks += tot; passAll += pass;
        if (!m.control) { checksEx += tot; passEx += pass; }
        if (tot) { rtSum += rtA; rtN += tot; }
        if (vantages[m.vantage]) { vantages[m.vantage].total++; if (isUp) vantages[m.vantage].up++; }
        var spark = [];
        var sb = barsFor(s, r.t0, r.t1, 40);
        for (var q = 0; q < sb.length; q++) spark.push(sb[q].uptime == null ? null : sb[q].uptime);
        rows.push({
          id: m.id, name: m.name, method: m.method, url: m.url, vantage: m.vantage,
          node: m.node, svc: m.svc, interval: m.interval, assertion: m.assertion, control: !!m.control,
          fails: fails, checks: tot, noData: nd,
          uptime: uptime == null ? null : +uptime.toFixed(2),
          avgRt: tot ? Math.round(rtA / tot) : null,
          lastCheck: lastT == null ? null : dstamp(lastT), lastCheckT: lastT,
          lastStatus: lastStatus, up: isUp,
          status: isUp ? "up" : "down",
          band: uptime == null ? "unk" : uptime >= 99.9 ? "ok" : uptime >= 95 ? "warn" : "crit",
          bars: barsFor(s, r.t0, r.t1, 96), spark: spark
        });
      }
      return {
        range: r,
        tiles: {
          monitorsUp: up, monitorsTotal: REG.monitors.length, down: REG.monitors.length - up,
          uptime: totalChecks ? +(passAll / totalChecks * 100).toFixed(2) : null,
          uptimeExControls: checksEx ? +(passEx / checksEx * 100).toFixed(2) : null,
          avgResponse: rtN ? +(rtSum / rtN / 1000).toFixed(2) : null,
          avgResponseMs: rtN ? Math.round(rtSum / rtN) : null,
          totalChecks: totalChecks,
          expectedChecks: REG.monitors.length * (r.t1 - r.t0 + 1)
        },
        rows: rows, vantages: vantages,
        sortKeys: ["status", "name", "uptime", "response"],
        notes: {
          controls: "Three httpbin-style control monitors are deliberately unsatisfiable. They prove the prober is alive and are excluded from every availability denominator - the standing '3 down' is not an outage.",
          nodata: "A probe that could not run is no-data, not a failed probe: those intervals are excluded from the uptime denominator and render as the fourth bar state.",
          assertion: "Uptime counts a check as successful only when the assertion also passed - an HTTP 200 carrying a business-error body is a failed check."
        },
        lineage: REG.lineage.synthetic
      };
    });
  }

  /* ======================================================================== *
   * 6 · downstream(range, showInternal)
   * ======================================================================== */
  function downstream(rangeName, showInternal) {
    var r = range(rangeName || "24h");
    var si = showInternal !== false;
    return cached("downstream", r.key + "|" + r.t0 + "|" + r.t1 + "|" + (si ? 1 : 0), function () {
      var tiles = [], eps = [], i, t, k;
      var totCalls = 0, tot5 = 0, tot4 = 0;
      var dist = {}; for (i = 0; i < SP.statusMix.length; i++) dist[SP.statusMix[i]] = 0;

      for (i = 0; i < REG.downstreams.length; i++) {
        var d = REG.downstreams[i];
        if (!si && d.type === "internal") continue;
        var s = SP.downstream(d.key);
        var calls = 0, s5 = 0, s4 = 0, latW = 0, unk = 0, buckets = 0;
        var seriesCalls = [], seriesLat = [], labels = [];
        for (t = r.t0; t <= r.t1; t++) {
          buckets++;
          if (s.unknown[t]) { unk++; seriesCalls.push(null); seriesLat.push(null); labels.push(dstamp(t)); continue; }
          calls += s.calls[t]; s5 += s.s5xx[t]; s4 += s.s4xx[t];
          latW += s.latency[t] * s.calls[t];
          seriesCalls.push(s.calls[t]); seriesLat.push(Math.round(s.latency[t])); labels.push(dstamp(t));
          for (k = 0; k < SP.statusMix.length; k++) dist[SP.statusMix[k]] += s.codes[SP.statusMix[k]][t];
        }
        var cov = buckets ? (buckets - unk) / buckets : 1, cs = covState(cov);
        totCalls += calls; tot5 += s5; tot4 += s4;
        tiles.push({
          key: d.key, name: d.name, host: d.host, port: d.port, type: d.type, node: d.node,
          callers: d.callers, calls: Math.round(calls), s5xx: Math.round(s5), s4xx: Math.round(s4),
          s5xxRate: calls ? +(s5 / calls * 100).toFixed(2) : null,
          s4xxRate: calls ? +(s4 / calls * 100).toFixed(2) : null,
          avgLatency: calls ? Math.round(latW / calls) : null,
          band: errBand(calls ? s5 / calls * 100 : null),
          coverage: cov, provisional: cs.provisional, state: cs.state,
          dlr: s.dlr ? +(function () { var a = 0, n = 0; for (var q = r.t0; q <= r.t1; q++) { if (s.unknown[q]) continue; a += s.dlr[q]; n++; } return n ? a / n * 100 : 0; }()).toFixed(2) : null,
          series: { labels: labels, calls: seriesCalls, latency: seriesLat }
        });

        for (k = 0; k < d.endpoints.length; k++) {
          var e = d.endpoints[k];
          var ecalls = calls * e.share, e5 = s5 * e.share * (0.7 + 0.6 * ((k + 1) / d.endpoints.length));
          var e4 = s4 * e.share;
          var elabels = [], ecs = [], els = [];
          for (t = r.t0; t <= r.t1; t++) {
            if (s.unknown[t]) { ecs.push(null); els.push(null); elabels.push(dstamp(t)); continue; }
            ecs.push(Math.round(s.calls[t] * e.share));
            els.push(Math.round(s.latency[t] * (0.85 + 0.3 * ((k + 1) / d.endpoints.length))));
            elabels.push(dstamp(t));
          }
          var estat = [];
          for (var q2 = 0; q2 < SP.statusMix.length; q2++) {
            var code = SP.statusMix[q2], cc = 0;
            for (t = r.t0; t <= r.t1; t++) { if (s.unknown[t]) continue; cc += s.codes[code][t] * e.share; }
            if (cc >= 1) estat.push({ code: code, count: Math.round(cc) });
          }
          var estot = estat.reduce(function (x, y) { return x + y.count; }, 0) || 1;
          for (q2 = 0; q2 < estat.length; q2++) estat[q2].share = +(estat[q2].count / estot * 100).toFixed(2);
          eps.push({
            endpoint: e.ep, caller: e.caller, downstream: d.key, downstreamName: d.name, type: d.type,
            calls: Math.round(ecalls), s5xx: Math.round(e5),
            errorRate: ecalls ? +(e5 / ecalls * 100).toFixed(3) : null,
            avgLatency: calls ? Math.round(latW / calls * (0.85 + 0.3 * ((k + 1) / d.endpoints.length))) : null,
            band: errBand(ecalls ? e5 / ecalls * 100 : null),
            statusBar: estat, series: { labels: elabels, calls: ecs, latency: els },
            coverage: cov, provisional: cs.provisional
          });
        }
      }
      eps.sort(function (a, b) { return b.calls - a.calls; });
      var distArr = [], distTot = 0;
      for (i = 0; i < SP.statusMix.length; i++) distTot += dist[SP.statusMix[i]];
      for (i = 0; i < SP.statusMix.length; i++) {
        if (dist[SP.statusMix[i]] < 1) continue;
        distArr.push({ code: SP.statusMix[i], count: Math.round(dist[SP.statusMix[i]]),
                       share: distTot ? +(dist[SP.statusMix[i]] / distTot * 100).toFixed(2) : 0 });
      }
      distArr.sort(function (a, b) { return b.count - a.count; });
      tiles.sort(function (a, b) { return b.calls - a.calls; });

      return {
        range: r, showInternal: si,
        tiles: tiles,
        totals: {
          calls: Math.round(totCalls), s5xx: Math.round(tot5), s4xx: Math.round(tot4),
          s5xxRate: totCalls ? +(tot5 / totCalls * 100).toFixed(2) : null,
          s4xxRate: totCalls ? +(tot4 / totCalls * 100).toFixed(2) : null
        },
        statusDistribution: distArr,
        topEndpoints: eps.slice(0, 30),
        note: "Avg latency is the callee's own time (upstream_ms), not the total request duration; retries are counted separately so a retried request cannot hide two upstream 503s.",
        lineage: REG.lineage.downstream
      };
    });
  }

  /* ======================================================================== *
   * 7 · dependencies(svc, range)
   * ======================================================================== */
  function dependencies(svcKey, rangeName) {
    var sk = svcKey || "payment", r = range(rangeName || "24h");
    return cached("dependencies", sk + "|" + r.key + "|" + r.t0 + "|" + r.t1, function () {
      var sv = REG.bySvc[sk];
      if (!sv) throw new Error("dependencies: unknown service " + sk);
      var rows = [], outbound = 0, out5 = 0, i, t;
      for (i = 0; i < REG.downstreams.length; i++) {
        var d = REG.downstreams[i];
        if (d.callers.indexOf(sk) < 0) continue;
        var share = 1 / d.callers.length, s = SP.downstream(d.key);
        var calls = 0, s5 = 0, latW = 0, unk = 0, buckets = 0;
        for (t = r.t0; t <= r.t1; t++) {
          buckets++;
          if (s.unknown[t]) { unk++; continue; }
          calls += s.calls[t] * share; s5 += s.s5xx[t] * share; latW += s.latency[t] * s.calls[t] * share;
        }
        outbound += calls; out5 += s5;
        var cov = buckets ? (buckets - unk) / buckets : 1;
        var technique = d.type === "internal" ? "L7" : "L7";
        rows.push({
          dependency: d.key, name: d.name, host: d.host, port: d.port, type: d.type === "internal" ? "Internal" : "External",
          node: d.node, calls: Math.round(calls), s5xx: Math.round(s5),
          errorRate: calls ? +(s5 / calls * 100).toFixed(3) : null,
          avgLatency: calls ? Math.round(latW / calls) : null,
          band: errBand(calls ? s5 / calls * 100 : null),
          technique: technique, confidence: technique === "L7" ? "application-layer" : "flow",
          navigable: true, coverage: cov, provisional: covState(cov).provisional
        });
      }
      rows.sort(function (a, b) { return b.calls - a.calls; });
      var a2 = svcAgg(sk, r.t0, r.t1);

      /* caller -> callee edges across the whole estate for the chain view */
      var nodes = [], edges = [];
      for (i = 0; i < REG.services.length; i++) nodes.push({ id: REG.services[i].key, label: REG.services[i].name, type: "service", node: REG.services[i].node });
      for (i = 0; i < REG.downstreams.length; i++) nodes.push({ id: REG.downstreams[i].key, label: REG.downstreams[i].name, type: REG.downstreams[i].type, node: REG.downstreams[i].node });
      for (i = 0; i < REG.downstreams.length; i++) {
        var dd = REG.downstreams[i], ss = SP.downstream(dd.key);
        var c2 = 0, e2 = 0;
        for (t = r.t0; t <= r.t1; t++) { if (ss.unknown[t]) continue; c2 += ss.calls[t]; e2 += ss.s5xx[t]; }
        for (var q = 0; q < dd.callers.length; q++) {
          edges.push({ from: dd.callers[q], to: dd.key,
                       calls: Math.round(c2 / dd.callers.length),
                       errorRate: c2 ? +(e2 / c2 * 100).toFixed(3) : null,
                       technique: "L7", confidence: "application-layer" });
        }
      }

      return {
        range: r,
        services: REG.services.map(function (x) { return { key: x.key, name: x.name, selected: x.key === sk }; }),
        card: {
          key: sv.key, name: sv.name, deploy: sv.deploy, node: sv.node, zone: sv.zone,
          s5xxRate: a2.errorRatePct == null ? null : +a2.errorRatePct.toFixed(3),
          outboundCalls: Math.round(outbound), outbound5xx: Math.round(out5),
          depCount: rows.length, requests: a2.requests,
          owner: REG.people[sv.node] || null
        },
        rows: rows,
        graph: { nodes: nodes, edges: edges },
        note: "Every edge carries source_technique and a confidence. An edge observed only by NetFlow would show an empty error rate, never 0.00% - the most dangerous false green on a dependency map.",
        lineage: REG.lineage.dependencies
      };
    });
  }

  /* ======================================================================== *
   * 8 · errorsExplorer(range, filters)
   * ======================================================================== */
  function errorsExplorer(rangeName, filters) {
    var r = range(rangeName || "24h");
    var f = filters || {};
    var fkey = [f.severity || "all", f.service || "", f.endpoint || "", (f.status || []).join(",")].join("~");
    return cached("errorsExplorer", r.key + "|" + r.t0 + "|" + r.t1 + "|" + fkey, function () {
      var h0 = Math.floor(r.t0 / 12), h1 = Math.floor(r.t1 / 12), i, k, h;
      var biz = 0, tech = 0;
      var svcMap = {};

      /* 4xx / 5xx population from the gateway rows */
      for (i = 0; i < REG.routes.length; i++) {
        var rt = REG.routes[i];
        if (f.service && rt.svc !== f.service) continue;
        if (f.endpoint && rt.path.indexOf(f.endpoint) < 0 && rt.key.indexOf(f.endpoint) < 0) continue;
        var a = aggRoutes([rt.key], r.t0, r.t1);
        var b = a.businessFail, x = a.technicalFail;
        if (f.severity === "business") x = 0;
        if (f.severity === "technical") b = 0;
        biz += b; tech += x;
        var e = svcMap[rt.svc] || (svcMap[rt.svc] = { key: rt.svc, business: 0, technical: 0, groups: [] });
        e.business += b; e.technical += x;
      }

      /* exception groups */
      for (i = 0; i < REG.errorGroups.length; i++) {
        var g = REG.errorGroups[i];
        if (f.service && g.svc !== f.service) continue;
        if (f.severity === "business" && g.kind !== "business") continue;
        if (f.severity === "technical" && g.kind !== "technical") continue;
        if (f.endpoint) {
          var match = false;
          for (k = 0; k < g.endpoints.length; k++) if (g.endpoints[k].indexOf(f.endpoint) >= 0) match = true;
          if (!match) continue;
        }
        var gs = SP.errorGroup(g.id), cnt = 0, unk = 0;
        for (h = h0; h <= h1; h++) { if (h < 0 || h >= HOURS) continue; if (gs.unknown[h]) { unk++; continue; } cnt += gs.hourly[h]; }
        if (!cnt) continue;
        var se = svcMap[g.svc] || (svcMap[g.svc] = { key: g.svc, business: 0, technical: 0, groups: [] });
        var occ = [];
        for (k = 0; k < gs.occurrences.length; k++) {
          var o = gs.occurrences[k];
          if (o.t < r.t0 || o.t > r.t1) continue;
          occ.push({ ts: o.ts, t: o.t, endpoint: o.endpoint, message: o.message, duration: o.duration,
                     age: fmtDur((NOW - o.t) * SP.STEP_MIN) + " ago" });
          if (occ.length >= 8) break;
        }
        se.groups.push({ id: g.id, cls: g.cls, kind: g.kind, count: cnt, occurrences: occ,
                        endpoints: g.endpoints, unknownHours: unk });
      }

      var services = [], totalAll = 0;
      for (var sk in svcMap) {
        if (!Object.prototype.hasOwnProperty.call(svcMap, sk)) continue;
        var e2 = svcMap[sk], cnt2 = e2.business + e2.technical;
        if (!cnt2 && !e2.groups.length) continue;
        totalAll += cnt2;
        e2.groups.sort(function (x, y) { return y.count - x.count; });
        var gtot = e2.groups.reduce(function (x, y) { return x + y.count; }, 0) || 1;
        for (k = 0; k < e2.groups.length; k++) e2.groups[k].share = +(e2.groups[k].count / gtot * 100).toFixed(2);
        /* per-service sparkline: hourly error totals, downsampled to <=48 */
        var spark = [], hs = [], hh;
        for (hh = h0; hh <= h1; hh++) {
          if (hh < 0 || hh >= HOURS) continue;
          var v = 0;
          for (k = 0; k < e2.groups.length; k++) v += SP.errorGroup(e2.groups[k].id).hourly[hh];
          hs.push(v);
        }
        var step = Math.max(1, Math.ceil(hs.length / 48));
        for (hh = 0; hh < hs.length; hh += step) {
          var acc = 0, n2 = 0;
          for (k = hh; k < Math.min(hs.length, hh + step); k++) { acc += hs[k]; n2++; }
          spark.push(n2 ? Math.round(acc / n2) : 0);
        }
        var svcDef = REG.bySvc[sk];
        services.push({
          key: sk, name: svcDef ? svcDef.name : sk, node: svcDef ? svcDef.node : null,
          count: cnt2, business: e2.business, technical: e2.technical,
          groups: e2.groups.slice(0, 10), groupCount: e2.groups.length, spark: spark
        });
      }
      services.sort(function (a, b) { return b.count - a.count; });
      for (i = 0; i < services.length; i++) services[i].share = totalAll ? +(services[i].count / totalAll * 100).toFixed(2) : 0;

      /* domain result-code table */
      var codes = [], codeTot = 0;
      for (i = 0; i < REG.resultCodes.length; i++) {
        var rc = REG.resultCodes[i];
        if (f.service && rc.svc !== f.service) continue;
        if (f.severity === "business" && rc.type !== "B") continue;
        if (f.severity === "technical" && rc.type !== "T") continue;
        if (f.status && f.status.length && f.status.indexOf(String(rc.http)) < 0) continue;
        var cs2 = SP.resultCode(rc.code), c3 = 0;
        for (h = h0; h <= h1; h++) { if (h < 0 || h >= HOURS) continue; c3 += cs2.hourly[h]; }
        if (!c3) continue;
        codeTot += c3;
        codes.push({ code: rc.code, type: rc.type === "B" ? "Business" : "Technical", svc: rc.svc,
                     message: rc.message, http: rc.http, count: c3 });
      }
      codes.sort(function (a, b) { return b.count - a.count; });
      for (i = 0; i < codes.length; i++) codes[i].share = codeTot ? +(codes[i].count / codeTot * 100).toFixed(2) : 0;

      return {
        range: r, filters: { severity: f.severity || "all", service: f.service || null,
                             endpoint: f.endpoint || null, status: f.status || [] },
        tiles: { total: biz + tech, business: biz, technical: tech, servicesAffected: services.length },
        topServices: services.slice(0, 10).map(function (s) { return { svc: s.key, name: s.name, count: s.count, share: s.share }; }),
        services: services,
        resultCodes: codes,
        statusChips: ["400", "401", "404", "429", "500", "502", "503", "504"],
        rule: "Display split stays 4xx = business, 5xx = technical. The taxonomy engine classifies on cause: 429 is technical, a service-principal 401/403 is technical, a route-404 is technical, and an HTTP 200 carrying a domain decline is a business error present in no status-code metric at all.",
        lineage: REG.lineage.errors
      };
    });
  }

  /* ======================================================================== *
   * 9 · journeys(range)
   * ======================================================================== */
  function statusBreakdownFor(routeKey, t0, t1) {
    var a = aggRoutes([routeKey], t0, t1), rt = REG.byRoute[routeKey];
    var out = {}, biz = a.businessFail, tech = a.technicalFail, i;
    out["200"] = a.ok;
    /* split the business population across the codes this route can emit */
    var codes = BIZ_CODES[rt.svc] || [400];
    var per = biz / codes.length;
    for (i = 0; i < codes.length; i++) out[String(codes[i])] = (out[String(codes[i])] || 0) + Math.round(per);
    out["500"] = Math.round(tech * 0.46);
    out["502"] = Math.round(tech * 0.24);
    out["503"] = Math.round(tech * 0.18);
    out["504"] = Math.max(0, tech - out["500"] - out["502"] - out["503"]);
    return out;
  }
  function journeys(rangeName) {
    var r = range(rangeName || "1h");
    return cached("journeys", r.key + "|" + r.t0 + "|" + r.t1, function () {
      var cards = [], i, k, h;
      var h0 = Math.floor(r.t0 / 12), h1 = Math.floor(r.t1 / 12);
      var activeUsers = 0;
      for (i = 0; i < REG.journeys.length; i++) {
        var j = REG.journeys[i];
        var keys = routesByJourney(j.key);
        var a = aggRoutes(keys, r.t0, r.t1);
        var fn = SP.journeyFunnel(j.key);

        /* UX lens: funnel completion over the hours the range touches */
        var s0 = 0, sN = 0, unkH = 0, hn = 0;
        for (h = h0; h <= h1; h++) {
          if (h < 0 || h >= HOURS) continue;
          hn++;
          if (fn.unknown[h]) unkH++;
          s0 += fn.sessions[0][h];
          sN += fn.sessions[fn.sessions.length - 1][h];
        }
        activeUsers += Math.round(s0 * (rangeMinutes(r) / 60 >= 1 ? 1 : rangeMinutes(r) / 60));
        var ux = s0 ? sN / s0 * 100 : null;
        var api = a.strictPct;                       /* strict 2xx ratio       */
        var app = null;                              /* no crash SDK collected */
        var lensVals = [api, ux].filter(function (v) { return v != null; });
        var cp = lensVals.length ? Math.min.apply(null, lensVals) : null;

        /* The reference screen compares against the same hour 7 days ago. The
           seeded spine IS one week, so the comparison window is the same clock
           hour on the PREVIOUS DAY and every page must label it that way -
           see `comparisonWindow` / `comparisonNote` on the payload.          */
        var prevT0 = Math.max(0, r.t0 - DAY), prevT1 = Math.max(0, r.t1 - DAY);
        var prev = (r.t0 >= DAY) ? aggRoutes(keys, prevT0, prevT1) : null;
        var delta = (prev && prev.strictPct != null && api != null) ? +(api - prev.strictPct).toFixed(2) : null;

        /* funnel steps for the range */
        var steps = [], prevSess = null;
        for (k = 0; k < fn.steps.length; k++) {
          var sess = 0;
          for (h = h0; h <= h1; h++) { if (h < 0 || h >= HOURS) continue; sess += fn.sessions[k][h]; }
          var drop = (prevSess != null && prevSess > 0) ? +((prevSess - sess) / prevSess * 100).toFixed(1) : 0;
          steps.push({
            index: k, label: fn.steps[k].label, kind: fn.steps[k].kind,
            screen: fn.steps[k].screen, api: fn.steps[k].api,
            sessions: Math.round(sess), dropPct: drop, reachedPct: prevSess ? +((sess / prevSess) * 100).toFixed(1) : 100,
            biggestDrop: false
          });
          prevSess = sess;
        }
        var bd = 0; for (k = 1; k < steps.length; k++) if (steps[k].dropPct > steps[bd].dropPct) bd = k;
        if (steps.length > 1) steps[bd].biggestDrop = true;

        /* by-stage detail for every api step */
        var byStage = [];
        for (k = 0; k < fn.steps.length; k++) {
          if (fn.steps[k].kind !== "api") continue;
          var rk = fn.steps[k].api, sa = aggRoutes([rk], r.t0, r.t1);
          var sprev = (r.t0 >= DAY) ? aggRoutes([rk], prevT0, prevT1) : null;
          var sb = statusBreakdownFor(rk, r.t0, r.t1);
          byStage.push({
            step: k, label: fn.steps[k].label, screen: fn.steps[k].screen, api: rk,
            statusBreakdown: sb,
            strict: sa.strictPct == null ? null : +sa.strictPct.toFixed(2),
            platform: sa.successPct == null ? null : +sa.successPct.toFixed(2),
            wow: (sprev && sprev.strictPct != null && sa.strictPct != null) ? +(sa.strictPct - sprev.strictPct).toFixed(2) : null,
            sameHourLastWeek: sprev ? (sprev.strictPct == null ? null : +sprev.strictPct.toFixed(2)) : null,
            p95: sa.p95 == null ? null : Math.round(sa.p95),
            p99: sa.p99 == null ? null : Math.round(sa.p99),
            failed: sa.businessFail + sa.technicalFail, total: sa.requests,
            prevLabel: (r.t0 >= DAY) ? (dstamp(prevT0) + " - " + dstamp(prevT1)) : null,
            severity: journeyBand(sa.strictPct, null),
            coverage: sa.coverage, provisional: sa.provisional, state: sa.state,
            whenItFails: whenItFails(rk)
          });
        }

        var uxCoverage = hn ? (hn - unkH) / hn : 1;
        var cov = Math.min(a.coverage, uxCoverage);
        var cs = covState(cov);
        if (cs.nodata) { cp = null; api = null; ux = null; delta = null; }   /* §07: NO DATA, never 0% */
        var incident = incidentAt(r.t0, r.t1);
        cards.push({
          key: j.key, name: j.name, svc: j.svc, deploy: j.deploy, node: j.node, T_ms: j.T_ms, sla: j.sla,
          customerPerceived: cp == null ? null : +cp.toFixed(1),
          delta: delta, status: cs.nodata ? "unk" : journeyBand(cp, delta),
          lenses: { api: api == null ? null : +api.toFixed(1), ux: ux == null ? null : +ux.toFixed(1), app: app },
          lensCount: 2, lensTotal: 3,
          lensNote: "Client stability needs a self-hosted crash SDK in the app build; it is not collected here, so this card is computed from 2 of 3 lenses.",
          p95: a.p95 == null ? null : Math.round(a.p95),
          p99: a.p99 == null ? null : Math.round(a.p99),
          requests: a.requests, failedRequests: a.businessFail + a.technicalFail,
          businessFail: a.businessFail, technicalFail: a.technicalFail,
          ack: incident ? true : false,
          incident: incident,
          funnel: { steps: steps, completion: ux == null ? null : +ux.toFixed(1),
                    biggestDrop: steps.length > 1 ? { step: steps[bd].label, pct: steps[bd].dropPct } : null },
          byStage: byStage,
          samples: fn.samples.filter(function (s) { return s.t >= r.t0 && s.t <= r.t1; }).slice(0, 12),
          coverage: cov, apiCoverage: a.coverage, uxCoverage: uxCoverage,
          provisional: cs.provisional, state: cs.state
        });
      }
      var pT0 = Math.max(0, r.t0 - DAY), pT1 = Math.max(0, r.t1 - DAY);
      return {
        range: r, activeUsers: activeUsers, cards: cards,
        comparisonWindow: (r.t0 >= DAY) ? { t0: pT0, t1: pT1, label: dstamp(pT0) + " - " + dstamp(pT1) } : null,
        comparisonNote: "The reference screen compares against the same hour 7 days ago. This spine IS one week, so the comparison is the same clock hour on the PREVIOUS DAY - label it that way on screen, never as 'last week'.",
        severityLegend: [{ band: "ok", text: ">= 95%" }, { band: "warn", text: "< 95% or delta < -5pp" },
                         { band: "crit", text: "< 80% or delta < -15pp" }],
        model: "THREE-LENS MODEL - customer-perceived = worst lens. Backend = strict 2xx ratio from gateway rows; user completion = synthetic journey funnel; client stability = crash-free sessions (not collected without an SDK).",
        lineage: REG.lineage.journey
      };
    });
  }
  function whenItFails(routeKey) {
    var map = {
      "POST /v1/otp/request": "The OTP never arrives - the customer sits on a code screen that times out.",
      "POST /v1/otp/verify": "The code is rejected or expires; the customer retries and is locked out.",
      "GET /v1/home": "The app opens to an empty or spinning home screen.",
      "GET /v1/accounts/balance": "The balance is stale or missing - and a funded customer can be declined.",
      "POST /v1/bills/inquire": "The bill amount never loads, so the payment cannot start.",
      "POST /v1/bills/pay": "The payment fails after confirm, or debits without crediting the biller.",
      "GET /v1/receipts/{id}": "The money moved but the customer sees no receipt.",
      "POST /v1/topup/purchase": "The top-up is charged but the airtime is not delivered.",
      "POST /v1/packages/subscribe": "The package is paid for but never activates.",
      "POST /v1/rewards/redeem": "Points are deducted with no reward issued."
    };
    return map[routeKey] || "The step returns an error and the journey stops there.";
  }
  function incidentAt(t0, t1) {
    var best = null;
    for (var k in D_.INC) {
      if (!Object.prototype.hasOwnProperty.call(D_.INC, k)) continue;
      var w = D_.INC[k], a = w[0], b = w[w.length - 1];
      if (b < t0 || a > t1) continue;
      var peak = w.length === 3 ? w[1] : w[1];
      var sev = SP.sevAt(k, Math.min(t1, Math.max(t0, peak)));
      if (!best || sev > best.sev) {
        best = { key: k, sev: sev, label: incName(k),
                 windowDisplay: incDisplay(k), windowShort: incShort(k),
                 severity: (D_.INCMETA[k] || [k, "warn"])[1], peak: peak, peakLabel: dstamp(peak),
                 ticket: (TICKETS.byWindow || {})[k] || null,
                 flowLink: "index.html#t=" + peak };
      }
    }
    return best;
  }

  /* ======================================================================== *
   * 10 · opsIssues() / issueDetail(id) / errorTracking()
   * ======================================================================== */
  function evidenceFor(issue) {
    /* last week = the seeded week we have; prior week = a seeded sibling.    */
    var metricKey = issue.route || null;
    var lastWeek, priorWeek, dailyAvg, impact, metric;
    if (metricKey && REG.byRoute[metricKey]) {
      var a = aggRoutes([metricKey], 0, N - 1);
      lastWeek = a.technicalFail;
      metric = "5xx on " + metricKey;
      if (lastWeek < 50) { lastWeek = a.businessFail; metric = "business declines on " + metricKey; }
    } else {
      var b = svcAgg(issue.svc, 0, N - 1);
      lastWeek = b.technicalFail; metric = "5xx on " + issue.svc;
    }
    var rr = SP.mulberry32(SP.keySeed("v2:ops:prior:" + issue.id));
    var ratio = 0.28 + rr() * 0.65;                 /* prior week was quieter */
    priorWeek = Math.max(1, Math.round(lastWeek * ratio));
    dailyAvg = Math.round(lastWeek / 7);
    impact = Math.round(lastWeek * (0.18 + rr() * 0.16));
    return {
      metric: metric,
      lastWeek: Math.round(lastWeek), priorWeek: priorWeek,
      wow: priorWeek ? +((lastWeek - priorWeek) / priorWeek * 100).toFixed(1) : null,
      dailyAvg: dailyAvg, customerImpact: impact,
      window: issue.incKey, windowLabel: issue.incKey ? incName(issue.incKey) : null,
      windowDisplay: issue.incKey ? incDisplay(issue.incKey) : null,
      windowShort: issue.incKey ? incShort(issue.incKey) : null
    };
  }
  function enrichIssue(o) {
    var pic = REG.people[o.pic] || null;
    var overdue = (o.eta != null && o.eta < NOW && o.status !== "resolved" && o.status !== "won't fix");
    var ticket = o.incKey ? (TICKETS.byWindow || {})[o.incKey] || null : null;
    var peak = o.incKey && D_.INC[o.incKey] ? D_.INC[o.incKey][1] : null;
    return {
      id: o.id, sev: o.sev, status: o.status, title: o.title, svc: o.svc, route: o.route,
      source: o.source, desc: o.desc, decision: o.decision, comments: o.comments,
      pic: pic, picKey: o.pic, cc: o.cc || [], node: o.node, incKey: o.incKey,
      windowDisplay: o.incKey ? incDisplay(o.incKey) : null,
      windowShort: o.incKey ? incShort(o.incKey) : null,
      created: o.created, createdLabel: dstamp(o.created),
      updated: o.updated, updatedLabel: dstamp(o.updated),
      eta: o.eta, etaLabel: o.eta == null ? null : dstamp(o.eta), overdue: overdue,
      evidence: evidenceFor(o),
      ticket: ticket,
      ticketLink: ticket ? "../incident-trace.html#" + ticket : null,
      flowLink: peak != null ? "../index.html#t=" + peak : null,
      severityLabel: (function () { for (var i = 0; i < TH.severity.length; i++) if (TH.severity[i].key === o.sev) return TH.severity[i].label; return o.sev; }())
    };
  }
  function opsIssues() {
    return cached("opsIssues", "all", function () {
      var rows = [], i, tiles = { total: 0, open: 0, resolved: 0, overdue: 0, noPic: 0, noEta: 0 };
      for (i = 0; i < REG.opsIssues.length; i++) {
        var e = enrichIssue(REG.opsIssues[i]);
        rows.push(e);
        tiles.total++;
        if (e.status === "resolved" || e.status === "won't fix") tiles.resolved++; else tiles.open++;
        if (e.overdue) tiles.overdue++;
        if (!e.pic) tiles.noPic++;
        if (e.eta == null) tiles.noEta++;
      }
      var groups = [];
      for (i = 0; i < TH.severity.length; i++) {
        var sv = TH.severity[i];
        var g = rows.filter(function (x) { return x.sev === sv.key; });
        groups.push({ sev: sv.key, label: sv.label, rule: sv.rule, count: g.length, rows: g });
      }
      return {
        tiles: tiles, rows: rows, groups: groups,
        sources: ["errors-explorer", "sla-report", "ops-review", "synthetic", "journey"],
        statuses: ["open", "discussing", "decided", "in progress", "resolved", "won't fix"],
        tabs: ["Open", "In progress", "Resolved", "Won't fix", "All"],
        note: "Each issue captures PIC, decision, ETA and follow-up. Evidence numbers are recomputed from the same spine the monitoring menus use, so an issue and a chart cannot disagree.",
        lineage: REG.lineage["ops-issues"]
      };
    });
  }
  function issueDetail(id) {
    return cached("issueDetail", id, function () {
      var src = null, i;
      for (i = 0; i < REG.opsIssues.length; i++) if (REG.opsIssues[i].id === id) src = REG.opsIssues[i];
      if (!src) return null;
      var e = enrichIssue(src);
      /* week-over-week daily bars for the evidence panel */
      var bars = [], rr = SP.mulberry32(SP.keySeed("v2:ops:wow:" + id));
      for (i = 0; i < 7; i++) {
        var t0 = i * DAY, t1 = t0 + DAY - 1;
        var cur = src.route && REG.byRoute[src.route]
          ? aggRoutes([src.route], t0, t1).technicalFail
          : svcAgg(src.svc, t0, t1).technicalFail;
        bars.push({ day: dayLabel(i + 1), cur: Math.round(cur),
                    prev: Math.round(cur * (0.25 + rr() * 0.6)) });
      }
      e.wowSeries = bars;
      e.severities = TH.severity.map(function (s) { return s.key; });
      e.statuses = ["open", "discussing", "decided", "in progress", "resolved", "won't fix"];
      e.related = [
        { label: "Errors Explorer - " + src.svc, href: "errors.html?service=" + encodeURIComponent(src.svc) },
        { label: "SLA weekly - critical services", href: "sla-weekly.html" },
        { label: "Service health - " + src.svc, href: "service-health.html?service=" + encodeURIComponent(src.svc) }
      ];
      if (e.ticketLink) e.related.push({ label: "Incident Trace - " + e.ticket, href: e.ticketLink });
      if (e.flowLink) e.related.push({ label: "Open on the flow map at this time", href: e.flowLink });
      e.rca = RCA.nodes && RCA.nodes[src.node] ? { desc: RCA.nodes[src.node].desc, page: RCA.nodes[src.node].page,
                                                   owner: RCA.nodes[src.node].owner } : null;
      e.storageKey = "adeptio_ops_" + id;
      e.lineage = REG.lineage["ops-issues"];
      return e;
    });
  }
  function errorTracking() {
    return cached("errorTracking", "all", function () {
      var rows = [], i, tiles = { total: 0, backlog: 0, todo: 0, inprog: 0, done: 0 };
      var totalCount = 0;
      var counts = [];
      for (i = 0; i < REG.errorTracking.length; i++) {
        var s = SP.resultCode(REG.errorTracking[i].code);
        counts.push(s.total); totalCount += s.total;
      }
      for (i = 0; i < REG.errorTracking.length; i++) {
        var e = REG.errorTracking[i], rc = null, k;
        for (k = 0; k < REG.resultCodes.length; k++) if (REG.resultCodes[k].code === e.code) rc = REG.resultCodes[k];
        var svcDef = REG.bySvc[e.svc];
        var overdue = (e.eta != null && e.eta < NOW && e.status !== "Done");
        /* SLA% = the share of this code's population that stayed inside the
           service's response-time objective for the week                     */
        var svcA = svcAgg(e.svc, 0, N - 1);
        rows.push({
          n: e.n, code: e.code, type: e.type, svc: e.svc,
          svcName: svcDef ? svcDef.name : e.svc,
          message: e.message, http: rc ? rc.http : null,
          count: counts[i], share: totalCount ? +(counts[i] / totalCount * 100).toFixed(2) : 0,
          status: e.status, priority: e.priority,
          progress: e.progress, progressPct: e.progress[1] ? Math.round(e.progress[0] / e.progress[1] * 100) : 0,
          eta: e.eta, etaLabel: e.eta == null ? null : dstamp(e.eta), overdue: overdue,
          sla: svcA.responsePct == null ? null : +svcA.responsePct.toFixed(2),
          slaBand: slaBand(svcA.responsePct),
          pic: REG.people[e.pic] || null, picKey: e.pic,
          link: e.link, linkHref: e.link ? "../incident-trace.html#" + e.link : null,
          cmt: e.cmt
        });
        tiles.total++;
        if (e.status === "Backlog") tiles.backlog++;
        else if (e.status === "To Do") tiles.todo++;
        else if (e.status === "In Progress") tiles.inprog++;
        else tiles.done++;
      }
      rows.sort(function (a, b) { return b.count - a.count; });
      for (i = 0; i < rows.length; i++) rows[i].rank = i + 1;
      var board = {};
      for (i = 0; i < REG.errorTrackingStatuses.length; i++) board[REG.errorTrackingStatuses[i]] = [];
      for (i = 0; i < rows.length; i++) (board[rows[i].status] || (board[rows[i].status] = [])).push(rows[i]);
      return {
        tiles: tiles, rows: rows, board: board, statuses: REG.errorTrackingStatuses,
        views: ["Table", "Board"],
        note: "http_status and error_code live in separate columns and are never merged: a filter on 'Business (4xx)' and a count of B- codes can legitimately differ, and each is reproducible.",
        lineage: REG.lineage["error-tracking"]
      };
    });
  }

  /* ======================================================================== *
   * 11 · lineage(pageKey)
   * ======================================================================== */
  function lineage(pageKey) {
    return REG.lineage[pageKey] || REG.lineage.front;
  }

  /* ======================================================================== *
   * 12 · collectorAdmin()
   * ======================================================================== */
  function collectorAdmin() {
    return cached("collectorAdmin", "all", function () {
      var STATE_ORDER = ["arrives", "parses", "computes", "live"], i, k;
      var sources = [];
      for (i = 0; i < REG.sources.length; i++) {
        var s = REG.sources[i];
        sources.push({
          node: s.node, name: s.name, archetype: s.archetype,
          lane: s.lane, laneLabel: REG.lanes[s.lane],
          secondary: s.secondary, secondaryLabels: s.secondary.map(function (l) { return REG.lanes[l]; }),
          method: s.method, state: s.state, stateIndex: STATE_ORDER.indexOf(s.state),
          statePct: Math.round((STATE_ORDER.indexOf(s.state) + 1) / STATE_ORDER.length * 100),
          cadence: s.cadence, prereq: s.prereq,
          owner: REG.people[s.node] || null
        });
      }

      var probes = [];
      for (i = 0; i < REG.monitors.length; i++) {
        var m = REG.monitors[i], ms = SP.monitor(m.id);
        var pass = 0, tot = 0, nd = 0;
        for (var t = 0; t < N; t++) { if (ms.ok[t] === 2) { nd++; continue; } tot++; if (ms.ok[t]) pass++; }
        probes.push({
          id: m.id, name: m.name, method: m.method, url: m.url, vantage: m.vantage,
          interval: m.interval, assertion: m.assertion, control: !!m.control, node: m.node,
          lastResult: ms.ok[NOW] === 2 ? "no-data" : (ms.ok[NOW] ? "pass" : "fail"),
          lastRt: Math.round(ms.rt[NOW]), lastStatus: ms.status[NOW],
          uptime7d: tot ? +(pass / tot * 100).toFixed(2) : null, noDataChecks: nd
        });
      }

      /* L3 seeded-account assertions */
      var assertions = [
        { id: "A1", name: "Balance equals the seeded value", target: "GET /v1/accounts/balance", node: "acct",
          expected: "body.balance == seeded_value", lastResult: "pass", lastRun: dstamp(NOW),
          note: "Failed 6 times inside WK34 · Incident A - the whole silent-decline signal lives here." },
        { id: "A2", name: "Bill inquiry returns a positive amount due", target: "POST /v1/bills/inquire", node: "bhub",
          expected: "body.amountDue > 0", lastResult: "pass", lastRun: dstamp(NOW),
          note: "No data for 90 minutes on Aug 26 - collector gap, not a failure." },
        { id: "A3", name: "Reversed payment posts and reverses", target: "POST /v1/bills/pay", node: "pay",
          expected: "body.result == 'POSTED' then reversal confirmed", lastResult: "pass", lastRun: dstamp(NOW),
          note: "The only assertion that proves money moved rather than that HTTP returned." },
        { id: "A4", name: "OTP verify succeeds for the seeded challenge", target: "POST /v1/otp/verify", node: "otp",
          expected: "body.verified == true within 45 s", lastResult: "pass", lastRun: dstamp(NOW),
          note: "Failed through WK34 · Incident C while the request call stayed 2xx." },
        { id: "A5", name: "Synthetic payment appears matched next morning", target: "recon three-way match", node: "recon",
          expected: "match_state == 'MATCHED'", lastResult: "pass", lastRun: dstamp(NOW - DAY),
          note: "Closure assertion: every synthetic payment must reconcile." }
      ];

      /* thresholds come from data/manifest.js, unchanged */
      var thresholds = [];
      for (i = 0; i < D_.NODES.length; i++) {
        var nd2 = D_.NODES[i];
        for (k = 0; k < nd2.objs.length; k++) {
          var o = nd2.objs[k];
          thresholds.push({ node: nd2.id, nodeName: nd2.name, objective: o.label || "Availability",
                            unit: o.unit, base: o.base, warn: o.warn, crit: o.crit, dir: o.dir,
                            pm: nd2.pm });
        }
      }

      var pipeline = SP.pipelineHealth();
      var live = 0;
      for (i = 0; i < sources.length; i++) if (sources[i].state === "live") live++;

      return {
        tiles: { sources: sources.length, live: live, lanes: Object.keys(REG.lanes).length,
                 probes: probes.length, assertions: assertions.length,
                 gapMinutes: REG.gap.mins, objectives: thresholds.length },
        states: STATE_ORDER,
        sources: sources, probes: probes,
        parsers: {
          name: "gateway access log (JSON, one line per HTTP hop)",
          fields: REG.parserFields,
          sample: '{"ts_utc_ms":1755300000000,"rid":"7f3a...","svc":"gateway","node_id":"gw","http_method":"POST","route_template":"/v1/bills/pay","status":200,"dur_ms":1642,"upstream_ms":1488,"upstream_addr":"10.42.8.21:8443","upstream_status":200,"retries":0,"bytes_out":812,"result_code":"B-PAY-30018","user_agent":"pulse-probe/1.0","vantage":null}'
        },
        assertions: assertions,
        thresholds: thresholds,
        pipeline: pipeline,
        gap: REG.gap,
        licence: {
          model: "On-premise. Everything in this demo is computed inside the estate.",
          tiers: [
            { name: "On-prem collection + synthesis", state: "ON", note: "included - the whole spine and every menu" },
            { name: "Cloud tier", state: "OFF", note: "no data leaves the estate in this deployment" },
            { name: "Metered AI credits", state: "0", note: "no credits consumed; the demo runs without any model call" }
          ],
          note: "Read-only by design: Pulse detects, traces, scores and tickets. The fix stays with the estate's own teams."
        },
        tabs: ["Sources", "Probes", "Parsers", "Assertions", "Thresholds", "Pipeline", "Licence"],
        lineage: REG.lineage.collectors
      };
    });
  }

  /* ======================================================================== *
   * Publish.
   * ======================================================================== */
  window.PULSE_SYNTH = {
    version: "2.0.2",
    /* page payloads */
    range: range, weeklySLA: weeklySLA, drilldown: drilldown, kpiLive: kpiLive,
    serviceHealth: serviceHealth, synthetic: synthetic, downstream: downstream,
    dependencies: dependencies, errorsExplorer: errorsExplorer, journeys: journeys,
    opsIssues: opsIssues, errorTracking: errorTracking, issueDetail: issueDetail,
    lineage: lineage, collectorAdmin: collectorAdmin,

    /* time + format helpers */
    dstamp: dstamp, dayOf: dayOf, hm: hm, mstamp: mstamp, dayLabel: dayLabel,

    /* incident-window display naming - print incDisplay(k) ON ITS OWN,
       never prefixed with the key; the key stays a bare letter. */
    week: WK_KEY, incName: incName, incDisplay: incDisplay, incShort: incShort,

    fmtNum: fmtNum, fmtCompact: fmtCompact, fmtPct: fmtPct, fmtRate: fmtRate,
    fmtMs: fmtMs, fmtDelta: fmtDelta, fmtSigned: fmtSigned, fmtBytes: fmtBytes, fmtDur: fmtDur,

    /* band helpers */
    slaBand: slaBand, latBand: latBand, errBand: errBand, journeyBand: journeyBand, covState: covState,

    /* low-level, exposed for the QA harness and for page-specific needs */
    aggRoutes: aggRoutes, svcAgg: svcAgg, routesByJourney: routesByJourney,
    routesBySvc: routesBySvc, routesByGroup: routesByGroup, allRouteKeys: allRouteKeys,
    probeAvailability: probeAvailability, incidentAt: incidentAt,

    freshness: "Updated " + dstamp(NOW) + " - seeded replay",
    disclaimer: "figures are a seeded replay of one week; not customer data",
    clearCache: clearCache,
    timings: function () { return CACHE.__timing || {}; }
  };
}());
