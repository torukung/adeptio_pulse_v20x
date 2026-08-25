/* ============================================================================
 * ADEPTIO Pulse — CHARTS  ·  window.PULSE_CHARTS
 *
 * Tiny dependency-free inline-SVG helpers. No library, no canvas, no fetch —
 * every helper returns a self-contained SVG (or, for the two bar strips, the
 * menus.css component markup) so a page can drop it straight into innerHTML.
 *
 * Rules kept by every helper:
 *   · sized by viewBox -> responsive (.pchart{width:100%;height:auto}). Use
 *     PULSE_CHARTS.render() to build at the container's exact width, which is
 *     what keeps label text at its true size instead of scaling with the box
 *   · colours come from CSS classes over tokens (see "CHARTS" in menus.css);
 *     the status tokens are used for STATUS series only, chrome tokens (c1..c4)
 *     for everything else. A caller may still pass an explicit `color`.
 *   · label text is >= 11px at the intended render width (base 12 user units)
 *   · hover text lives in <title> so it works without any script
 *   · null in a value array = collector gap: the line breaks and the interval
 *     is shaded as "no data" rather than interpolated
 *
 * PUBLIC API
 *   PULSE_CHARTS.render(target,opt)  -> {draw,node}  fit-to-container + resize
 *                                       opt.type: line|bars|spark|status|uptime
 *   PULSE_CHARTS.lineSeries(opt)     -> svg string   (line / area, SLA line)
 *   PULSE_CHARTS.barsGrouped(opt)    -> svg string   (grouped bars)
 *   PULSE_CHARTS.sparkline(vals,opt) -> svg string
 *   PULSE_CHARTS.statusBar(counts,opt)-> html string (opt.svg:true -> svg)
 *   PULSE_CHARTS.uptimeBars(states,opt)->html string (opt.svg:true -> svg)
 *   PULSE_CHARTS.el(markup)          -> Element
 *   PULSE_CHARTS.fmt                 -> {num,pct,pct2,ms,int,compact}
 *   PULSE_CHARTS.niceScale(min,max,n)-> {min,max,step,ticks[]}
 *   PULSE_CHARTS.resample(vals,n,how)-> array
 * Axis units are chosen once per chart: yFmt:'ms' prints a whole axis in ms or
 * a whole axis in s, never "0 ms … 10 s".
 * Every builder accepts opt.as === 'el' to get an Element instead of a string.
 * ==========================================================================*/
(function (global) {
  "use strict";

  /* ------------------------------------------------------------ utilities */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function r2(n) { return Math.round(n * 100) / 100; }

  var fmt = {
    int:     function (v) { return isNum(v) ? String(Math.round(v)) : '—'; },
    num:     function (v) { return isNum(v) ? String(r2(v)) : '—'; },
    pct:     function (v) { return isNum(v) ? r2(v) + '%' : '—'; },
    pct2:    function (v) { return isNum(v) ? v.toFixed(2) + '%' : '—'; },
    ms:      function (v) { return isNum(v) ? (v >= 1000 ? r2(v / 1000) + ' s' : Math.round(v) + ' ms') : '—'; },
    compact: function (v) {
      if (!isNum(v)) return '—';
      var a = Math.abs(v);
      if (a >= 1e9) return r2(v / 1e9) + 'B';
      if (a >= 1e6) return r2(v / 1e6) + 'M';
      if (a >= 1e3) return r2(v / 1e3) + 'k';
      return String(r2(v));
    }
  };
  function fmtOf(f) {
    if (typeof f === 'function') return f;
    if (typeof f === 'string' && fmt[f]) return fmt[f];
    return fmt.compact;
  }

  /* nice axis bounds — at most `n` steps, ending on a 1/2/2.5/5 multiple */
  function niceScale(min, max, n) {
    n = n || 4;
    if (!isNum(min) || !isNum(max)) { min = 0; max = 1; }
    if (min === max) { if (min === 0) { max = 1; } else { min = min - Math.abs(min) * .1; max = max + Math.abs(max) * .1; } }
    var raw = (max - min) / n;
    var mag = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10));
    var norm = raw / mag, step;
    if (norm <= 1) step = 1 * mag;
    else if (norm <= 2) step = 2 * mag;
    else if (norm <= 2.5) step = 2.5 * mag;
    else if (norm <= 5) step = 5 * mag;
    else step = 10 * mag;
    var lo = Math.floor(min / step) * step;
    var hi = Math.ceil(max / step) * step;
    var ticks = [], v = lo, guard = 0;
    while (v <= hi + step * 1e-6 && guard++ < 40) { ticks.push(r2(v)); v += step; }
    return { min: lo, max: hi, step: step, ticks: ticks };
  }

  /* peak-preserving downsample (default 'max' so incident spikes survive) */
  function resample(vals, n, how) {
    if (!vals || vals.length <= n) return vals ? vals.slice() : [];
    how = how || 'max';
    var out = [], size = vals.length / n, i, j, lo, hi, bucket, acc, cnt, has;
    for (i = 0; i < n; i++) {
      lo = Math.floor(i * size); hi = Math.min(vals.length, Math.max(lo + 1, Math.floor((i + 1) * size)));
      bucket = null; acc = 0; cnt = 0; has = false;
      for (j = lo; j < hi; j++) {
        var v = vals[j];
        if (!isNum(v)) continue;
        has = true; acc += v; cnt++;
        if (how === 'max') { if (bucket === null || v > bucket) bucket = v; }
        else if (how === 'min') { if (bucket === null || v < bucket) bucket = v; }
        else if (how === 'first') { if (bucket === null) bucket = v; }
      }
      if (!has) out.push(null);
      else if (how === 'mean') out.push(acc / cnt);
      else out.push(bucket);
    }
    return out;
  }

  function extent(seriesList, extra) {
    var mn = Infinity, mx = -Infinity, i, j, v;
    for (i = 0; i < seriesList.length; i++) {
      var vals = seriesList[i].values || [];
      for (j = 0; j < vals.length; j++) {
        v = vals[j];
        if (!isNum(v)) continue;
        if (v < mn) mn = v; if (v > mx) mx = v;
      }
    }
    if (isNum(extra)) { if (extra < mn) mn = extra; if (extra > mx) mx = extra; }
    if (mn === Infinity) { mn = 0; mx = 1; }
    return [mn, mx];
  }

  function serCls(i, s) {
    if (s && s.cls) return s.cls;
    return 's' + ((i % 4) + 1);
  }
  function fillCls(i, s) {
    if (s && s.cls) return s.cls.replace(/^s/, 'f');
    return 'f' + ((i % 4) + 1);
  }
  function styleAttr(color, prop) { return color ? ' style="' + prop + ':' + esc(color) + '"' : ''; }

  /* build a poly path, splitting on null; returns {d, segs:[[x,y]…], gaps:[[x0,x1]…]} */
  function buildPath(vals, X, Y) {
    var d = '', gaps = [], open = false, i, gs = null;
    for (i = 0; i < vals.length; i++) {
      var v = vals[i];
      if (!isNum(v)) {
        if (open) { open = false; }
        if (gs === null) gs = i;
        continue;
      }
      if (gs !== null) { gaps.push([gs, i - 1]); gs = null; }
      var x = X(i), y = Y(v);
      d += (open ? 'L' : 'M') + r2(x) + ' ' + r2(y);
      open = true;
    }
    if (gs !== null) gaps.push([gs, vals.length - 1]);
    return { d: d, gaps: gaps };
  }
  function buildArea(vals, X, Y, y0) {
    var out = '', run = [], i;
    function flush() {
      if (run.length < 2) { run = []; return; }
      var s = 'M' + r2(run[0][0]) + ' ' + r2(y0);
      for (var k = 0; k < run.length; k++) s += 'L' + r2(run[k][0]) + ' ' + r2(run[k][1]);
      s += 'L' + r2(run[run.length - 1][0]) + ' ' + r2(y0) + 'Z';
      out += s; run = [];
    }
    for (i = 0; i < vals.length; i++) {
      var v = vals[i];
      if (!isNum(v)) { flush(); continue; }
      run.push([X(i), Y(v)]);
    }
    flush();
    return out;
  }

  function svgOpen(cls, w, h, label) {
    return '<svg class="' + cls + '" viewBox="0 0 ' + w + ' ' + h + '" role="img" ' +
           'preserveAspectRatio="xMidYMid meet" aria-label="' + esc(label || 'chart') + '">';
  }
  /* fixed-size variant: a sparkline is furniture inside a cell, so it carries
     width/height attributes and keeps them (.psparkline does not stretch). */
  function svgOpenFixed(cls, w, h, label) {
    return '<svg class="' + cls + '" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h +
           '" role="img" preserveAspectRatio="xMidYMid meet" aria-label="' + esc(label || 'sparkline') + '">';
  }

  /* one unit for the whole axis: 'ms' ticks must not read "0 ms … 10 s" */
  function axisFmt(yFmt, max) {
    if (yFmt === 'ms') {
      return (isNum(max) && max >= 1000)
        ? function (v) { return isNum(v) ? r2(v / 1000) + ' s' : '—'; }
        : function (v) { return isNum(v) ? Math.round(v) + ' ms' : '—'; };
    }
    return fmtOf(yFmt);
  }
  function out(markup, opt) {
    if (opt && opt.as === 'el') return el(markup);
    return markup;
  }
  function el(markup) {
    if (!global.document) return null;
    var box = global.document.createElement('div');
    box.innerHTML = markup;
    return box.firstElementChild || box.firstChild;
  }

  /* y-axis gutter wide enough for the widest tick label, so a long label such
     as "100.00%" can never paint outside the viewBox. ~6.9 user units per
     character at font-size 12, plus the 7-unit tick gap and a little air. */
  function gutter(labels, given) {
    if (isNum(given)) return given;
    var w = 0, i;
    for (i = 0; i < labels.length; i++) w = Math.max(w, String(labels[i] == null ? '' : labels[i]).length);
    return Math.max(34, Math.ceil(w * 6.9) + 13);
  }

  /* x labels: array of strings (spread evenly) or [{at,label}] */
  function xTicks(xLabels, n, maxTicks) {
    var ticks = [], i;
    if (!xLabels || !xLabels.length || n < 2) return ticks;
    if (typeof xLabels[0] === 'object' && xLabels[0] !== null) {
      for (i = 0; i < xLabels.length; i++) ticks.push({ at: xLabels[i].at, label: xLabels[i].label });
      return ticks;
    }
    var cnt = Math.min(xLabels.length, maxTicks || 7);
    for (i = 0; i < cnt; i++) {
      var f = (cnt === 1) ? 0 : i / (cnt - 1);
      ticks.push({ at: Math.round(f * (n - 1)), label: xLabels[Math.round(f * (xLabels.length - 1))] });
    }
    return ticks;
  }

  /* ============================================================ LINE / AREA
   * lineSeries({
   *   series:[{name, values:[…|null], color?, cls?, area?, dash?}],
   *   threshold?: number, thresholdLabel?: string,
   *   yFmt?: fn|'pct'|'ms'|'compact', xLabels?: [string]|[{at,label}],
   *   area?: bool, w?, h?, yMin?, yMax?, legend?: bool, label?: string,
   *   maxPoints?: number, resample?: 'max'|'mean'|'min'|'first', as?:'el'
   * })
   * ======================================================================= */
  function lineSeries(opt) {
    opt = opt || {};
    var W = opt.w || 720, H = opt.h || 200;
    var series = (opt.series || []).filter(function (s) { return s && s.values; });
    var named = series.filter(function (s) { return s.name; });
    var showLeg = (opt.legend != null) ? !!opt.legend : (named.length > 1);
    var padT = 12 + (showLeg ? 17 : 0), padB = 27, padL = 52, padR = opt.padR || 12;
    var yf = fmtOf(opt.yFmt);

    /* downsample so every point gets at least ~1px */
    var target = opt.maxPoints || Math.max(24, Math.round((W - padL - padR) * 1.5));
    var sers = series.map(function (s) {
      return { name: s.name, color: s.color, cls: s.cls, area: s.area, dash: s.dash,
               values: resample(s.values || [], target, opt.resample) };
    });
    var n = 0, i, j;
    for (i = 0; i < sers.length; i++) n = Math.max(n, sers[i].values.length);
    if (!n) {
      return out(svgOpen('pchart', W, H, opt.label) +
        '<text class="cx-tx" x="' + (W / 2) + '" y="' + (H / 2) + '" font-size="12" ' +
        'text-anchor="middle">no data</text></svg>', opt);
    }

    var ex = extent(sers, opt.threshold);
    var lo = isNum(opt.yMin) ? opt.yMin : ex[0];
    var hi = isNum(opt.yMax) ? opt.yMax : ex[1];
    var sc = niceScale(lo, hi, opt.yTicks || 4);
    if (isNum(opt.yMin)) sc.min = opt.yMin;
    if (isNum(opt.yMax)) sc.max = opt.yMax;
    var span = (sc.max - sc.min) || 1;
    var ya = axisFmt(opt.yFmt, sc.max);      /* one unit across the whole axis */
    var yLabels = sc.ticks.map(ya);
    padL = gutter(yLabels, opt.padL);
    var plotW = W - padL - padR, plotH = H - padT - padB, y0 = padT + plotH;
    function X(i2) { return padL + (n === 1 ? plotW / 2 : (i2 / (n - 1)) * plotW); }
    function Y(v) { return padT + plotH - ((v - sc.min) / span) * plotH; }

    var s = svgOpen('pchart', W, H, opt.label || 'line chart');

    /* y grid + labels */
    for (i = 0; i < sc.ticks.length; i++) {
      var tv = sc.ticks[i];
      if (tv < sc.min - 1e-9 || tv > sc.max + 1e-9) continue;
      var yy = r2(Y(tv));
      s += '<line class="cx-gr" x1="' + padL + '" y1="' + yy + '" x2="' + (W - padR) + '" y2="' + yy + '"/>';
      s += '<text class="cx-tx" x="' + (padL - 7) + '" y="' + r2(yy + 4) + '" font-size="12" ' +
           'text-anchor="end">' + esc(ya(tv)) + '</text>';
    }
    s += '<line class="cx-ax" x1="' + padL + '" y1="' + r2(y0) + '" x2="' + (W - padR) + '" y2="' + r2(y0) + '"/>';

    /* x labels */
    var xt = xTicks(opt.xLabels, n, opt.maxXTicks);
    for (i = 0; i < xt.length; i++) {
      var xx = r2(X(Math.max(0, Math.min(n - 1, xt[i].at))));
      var anch = i === 0 ? 'start' : (i === xt.length - 1 ? 'end' : 'middle');
      s += '<text class="cx-tx" x="' + xx + '" y="' + (H - 9) + '" font-size="12" ' +
           'text-anchor="' + anch + '">' + esc(xt[i].label) + '</text>';
    }

    /* collector gaps (null runs of the first series) shaded as "no data" */
    if (opt.gaps !== false && sers.length) {
      var gp = buildPath(sers[0].values, X, Y).gaps;
      for (i = 0; i < gp.length; i++) {
        var gx0 = X(gp[i][0]), gx1 = X(gp[i][1]);
        if (gx1 - gx0 < 1) gx1 = gx0 + 1;
        s += '<rect class="f-unk" x="' + r2(gx0) + '" y="' + padT + '" width="' + r2(gx1 - gx0) +
             '" height="' + r2(plotH) + '" opacity=".16"><title>no data — collector gap</title></rect>';
      }
    }

    /* areas first, then lines */
    for (i = 0; i < sers.length; i++) {
      if (!(opt.area || sers[i].area)) continue;
      var ad = buildArea(sers[i].values, X, Y, y0);
      if (ad) s += '<path class="cx-ar ' + fillCls(i, sers[i]) + '" d="' + ad + '"' +
                   styleAttr(sers[i].color, 'fill') + '/>';
    }
    for (i = 0; i < sers.length; i++) {
      var pd = buildPath(sers[i].values, X, Y).d;
      if (!pd) continue;
      s += '<path class="cx-ln ' + serCls(i, sers[i]) + '" d="' + pd + '"' +
           (sers[i].dash ? ' stroke-dasharray="' + esc(sers[i].dash) + '"' : '') +
           styleAttr(sers[i].color, 'stroke') + '>' +
           (sers[i].name ? '<title>' + esc(sers[i].name) + '</title>' : '') + '</path>';
    }

    /* threshold / SLA line */
    if (isNum(opt.threshold)) {
      var ty = r2(Y(opt.threshold));
      s += '<line class="cx-thr" x1="' + padL + '" y1="' + ty + '" x2="' + (W - padR) + '" y2="' + ty + '">' +
           '<title>' + esc((opt.thresholdLabel || 'threshold') + ' · ' + yf(opt.threshold)) + '</title></line>';
      s += '<text class="cx-thrtx" x="' + (W - padR) + '" y="' + r2(ty - 5) + '" font-size="11" ' +
           'text-anchor="end">' + esc(opt.thresholdLabel || ('target ' + yf(opt.threshold))) + '</text>';
    }

    /* hover bands: one <title> per band, capped so the DOM stays small */
    var bands = Math.min(n, opt.bands || 48);
    var xls = xTicks(opt.xLabels, n, bands);
    for (i = 0; i < bands; i++) {
      var i0 = Math.floor(i * n / bands), i1 = Math.max(i0, Math.floor((i + 1) * n / bands) - 1);
      var bx = X(i0), bw = Math.max(1, X(i1) - bx + (plotW / bands));
      if (bx + bw > W - padR) bw = (W - padR) - bx;
      var tip = (xls[i] && xls[i].label) ? (xls[i].label + '\n') : '';
      for (j = 0; j < sers.length; j++) {
        var vv = sers[j].values[i0];
        tip += (sers[j].name || ('series ' + (j + 1))) + ': ' + yf(isNum(vv) ? vv : null) + (j < sers.length - 1 ? '\n' : '');
      }
      s += '<rect class="cx-hit" x="' + r2(bx) + '" y="' + padT + '" width="' + r2(Math.max(1, bw)) +
           '" height="' + r2(plotH) + '"><title>' + esc(tip) + '</title></rect>';
    }

    /* legend */
    if (showLeg) {
      var lx = padL;
      for (i = 0; i < sers.length; i++) {
        if (!sers[i].name) continue;
        s += '<rect class="cx-bar ' + fillCls(i, sers[i]) + '" x="' + r2(lx) + '" y="4" width="9" height="9" rx="2"' +
             styleAttr(sers[i].color, 'fill') + '/>';
        s += '<text class="cx-tx hi" x="' + r2(lx + 13) + '" y="12.5" font-size="12">' + esc(sers[i].name) + '</text>';
        lx += 13 + 7 * String(sers[i].name).length + 16;
      }
    }

    s += '</svg>';
    return out(s, opt);
  }

  /* ========================================================= GROUPED BARS
   * barsGrouped({groups:['Aug 23',…], series:[{name, values:[…], color?, cls?}],
   *              yFmt?, w?, h?, threshold?, legend?, stacked?})
   * ======================================================================= */
  function barsGrouped(opt) {
    opt = opt || {};
    var W = opt.w || 720, H = opt.h || 200;
    var groups = opt.groups || [];
    var series = (opt.series || []).filter(function (s) { return s && s.values; });
    var showLeg = (opt.legend != null) ? !!opt.legend : (series.length > 1);
    var padT = 12 + (showLeg ? 17 : 0), padB = 27, padL = 52, padR = opt.padR || 12;
    var yf = fmtOf(opt.yFmt);
    var i, j;

    if (!groups.length || !series.length) {
      return out(svgOpen('pchart', W, H, opt.label) +
        '<text class="cx-tx" x="' + (W / 2) + '" y="' + (H / 2) + '" font-size="12" ' +
        'text-anchor="middle">no data</text></svg>', opt);
    }

    var maxV = 0;
    for (i = 0; i < groups.length; i++) {
      var stackSum = 0;
      for (j = 0; j < series.length; j++) {
        var v = series[j].values[i];
        if (!isNum(v)) continue;
        stackSum += v;
        if (!opt.stacked && v > maxV) maxV = v;
      }
      if (opt.stacked && stackSum > maxV) maxV = stackSum;
    }
    var sc = niceScale(0, isNum(opt.threshold) ? Math.max(maxV, opt.threshold) : maxV, opt.yTicks || 4);
    sc.min = 0;
    var span = (sc.max - sc.min) || 1;
    var ya = axisFmt(opt.yFmt, sc.max);      /* one unit across the whole axis */
    padL = gutter(sc.ticks.map(ya), opt.padL);
    var plotW = W - padL - padR, plotH = H - padT - padB, y0 = padT + plotH;
    function Y(v) { return padT + plotH - ((v - sc.min) / span) * plotH; }

    var gw = plotW / groups.length;
    var inner = Math.min(gw * .74, 46);
    var bw = opt.stacked ? inner : inner / series.length;

    var s = svgOpen('pchart', W, H, opt.label || 'bar chart');
    for (i = 0; i < sc.ticks.length; i++) {
      var tv = sc.ticks[i];
      if (tv > sc.max + 1e-9) continue;
      var yy = r2(Y(tv));
      s += '<line class="cx-gr" x1="' + padL + '" y1="' + yy + '" x2="' + (W - padR) + '" y2="' + yy + '"/>';
      s += '<text class="cx-tx" x="' + (padL - 7) + '" y="' + r2(yy + 4) + '" font-size="12" ' +
           'text-anchor="end">' + esc(ya(tv)) + '</text>';
    }
    s += '<line class="cx-ax" x1="' + padL + '" y1="' + r2(y0) + '" x2="' + (W - padR) + '" y2="' + r2(y0) + '"/>';

    var step = Math.ceil(groups.length / Math.max(1, Math.min(groups.length, opt.maxXTicks || 12)));
    for (i = 0; i < groups.length; i++) {
      var cx = padL + gw * i + gw / 2;
      if (i % step === 0) {
        s += '<text class="cx-tx" x="' + r2(cx) + '" y="' + (H - 9) + '" font-size="12" ' +
             'text-anchor="middle">' + esc(groups[i]) + '</text>';
      }
      var acc = 0;
      for (j = 0; j < series.length; j++) {
        var val = series[j].values[i];
        if (!isNum(val)) continue;
        var bx, by, bh;
        if (opt.stacked) {
          bx = cx - inner / 2; by = Y(acc + val); bh = Math.max(0, Y(acc) - Y(acc + val)); acc += val;
        } else {
          bx = cx - inner / 2 + j * bw; by = Y(val); bh = Math.max(0, y0 - Y(val));
        }
        s += '<rect class="cx-bar ' + fillCls(j, series[j]) + '" x="' + r2(bx) + '" y="' + r2(by) +
             '" width="' + r2(Math.max(1, bw - (opt.stacked ? 0 : 1.5))) + '" height="' + r2(bh) + '" rx="2"' +
             styleAttr(series[j].color, 'fill') + '>' +
             '<title>' + esc(groups[i] + ' · ' + (series[j].name || ('series ' + (j + 1))) + ': ' + yf(val)) +
             '</title></rect>';
      }
    }

    if (isNum(opt.threshold)) {
      var ty = r2(Y(opt.threshold));
      s += '<line class="cx-thr" x1="' + padL + '" y1="' + ty + '" x2="' + (W - padR) + '" y2="' + ty + '">' +
           '<title>' + esc((opt.thresholdLabel || 'threshold') + ' · ' + yf(opt.threshold)) + '</title></line>';
      s += '<text class="cx-thrtx" x="' + (W - padR) + '" y="' + r2(ty - 5) + '" font-size="11" ' +
           'text-anchor="end">' + esc(opt.thresholdLabel || ('target ' + yf(opt.threshold))) + '</text>';
    }
    if (showLeg) {
      var lx = padL;
      for (j = 0; j < series.length; j++) {
        if (!series[j].name) continue;
        s += '<rect class="cx-bar ' + fillCls(j, series[j]) + '" x="' + r2(lx) + '" y="4" width="9" height="9" rx="2"' +
             styleAttr(series[j].color, 'fill') + '/>';
        s += '<text class="cx-tx hi" x="' + r2(lx + 13) + '" y="12.5" font-size="12">' + esc(series[j].name) + '</text>';
        lx += 13 + 7 * String(series[j].name).length + 16;
      }
    }
    s += '</svg>';
    return out(s, opt);
  }

  /* ============================================================= SPARKLINE
   * sparkline(values, {w,h,area,state:'ok|warn|crit|unk',dot,fmt,label})
   * ======================================================================= */
  function sparkline(values, opt) {
    opt = opt || {};
    var W = opt.w || 110, H = opt.h || 26, pad = 2;
    var vals = resample(values || [], opt.maxPoints || Math.max(24, W * 2), opt.resample || 'max');
    var cls = 'psparkline' + (opt.state ? ' ' + opt.state : '') + (opt.cls ? ' ' + opt.cls : '');
    var yf = fmtOf(opt.fmt);
    var n = vals.length;
    if (!n) return out(svgOpenFixed(cls, W, H, opt.label || 'sparkline') + '</svg>', opt);
    var ex = extent([{ values: vals }]);
    var lo = isNum(opt.yMin) ? opt.yMin : ex[0], hi = isNum(opt.yMax) ? opt.yMax : ex[1];
    if (hi === lo) { hi = lo + 1; lo = lo - 1; }
    var span = hi - lo;
    function X(i) { return pad + (n === 1 ? (W - pad * 2) / 2 : (i / (n - 1)) * (W - pad * 2)); }
    function Y(v) { return pad + (H - pad * 2) - ((v - lo) / span) * (H - pad * 2); }

    var s = svgOpenFixed(cls, W, H, opt.label || 'sparkline');
    if (opt.area !== false) {
      var ad = buildArea(vals, X, Y, H - pad);
      if (ad) s += '<path class="sp-ar" d="' + ad + '"' + styleAttr(opt.color, 'fill') + '/>';
    }
    var pd = buildPath(vals, X, Y).d;
    if (pd) s += '<path class="sp-ln" d="' + pd + '"' + styleAttr(opt.color, 'stroke') + '/>';
    if (opt.dot !== false) {
      for (var i = n - 1; i >= 0; i--) {
        if (!isNum(vals[i])) continue;
        s += '<circle class="sp-ln" fill="currentColor" cx="' + r2(X(i)) + '" cy="' + r2(Y(vals[i])) +
             '" r="1.7"' + styleAttr(opt.color, 'stroke') + '/>';
        break;
      }
    }
    var last = null;
    for (var k = n - 1; k >= 0; k--) { if (isNum(vals[k])) { last = vals[k]; break; } }
    s += '<title>' + esc((opt.label ? opt.label + ' · ' : '') +
         'min ' + yf(ex[0]) + ' · max ' + yf(ex[1]) + ' · last ' + yf(last)) + '</title>';
    s += '</svg>';
    return out(s, opt);
  }

  /* ============================================================ STATUS BAR
   * statusBar({ok:812,warn:41,crit:9,unk:6}) or [{key,label,value}]
   * Returns the menus.css `.statusbar` component (CSS boxes stay crisp at 1px
   * and reflow with the container). opt.svg:true returns an SVG instead.
   * ======================================================================= */
  var ST_ORDER = ['ok', 'warn', 'crit', 'maint', 'unk'];
  var ST_LABEL = { ok: 'OK', warn: 'Warn', crit: 'Critical', maint: 'Maintenance', unk: 'No data' };

  function normCounts(counts) {
    var rows = [], i, k;
    if (Array.isArray(counts)) {
      for (i = 0; i < counts.length; i++) {
        if (!counts[i]) continue;
        rows.push({ key: counts[i].key || 'unk', label: counts[i].label || ST_LABEL[counts[i].key] || counts[i].key,
                    value: +counts[i].value || 0 });
      }
    } else if (counts && typeof counts === 'object') {
      for (i = 0; i < ST_ORDER.length; i++) {
        k = ST_ORDER[i];
        if (counts[k] == null) continue;
        rows.push({ key: k, label: ST_LABEL[k], value: +counts[k] || 0 });
      }
      for (k in counts) {
        if (!Object.prototype.hasOwnProperty.call(counts, k)) continue;
        if (ST_ORDER.indexOf(k) > -1) continue;
        rows.push({ key: 'unk', label: k, value: +counts[k] || 0 });
      }
    }
    var tot = 0;
    for (i = 0; i < rows.length; i++) tot += rows[i].value;
    return { rows: rows, total: tot };
  }

  function statusBar(counts, opt) {
    opt = opt || {};
    var d = normCounts(counts), rows = d.rows, tot = d.total, i, pc, s;
    var yf = fmtOf(opt.fmt || 'compact');
    if (opt.svg) {
      var W = opt.w || 320, H = opt.h || 12, x = 0;
      s = svgOpen('pchart', W, H, opt.label || 'status distribution');
      for (i = 0; i < rows.length; i++) {
        pc = tot ? rows[i].value / tot : 0;
        var w = r2(pc * W);
        if (w <= 0) continue;
        s += '<rect class="f-' + esc(rows[i].key) + '" x="' + r2(x) + '" y="0" width="' + w +
             '" height="' + H + '"><title>' + esc(rows[i].label + ': ' + yf(rows[i].value) +
             ' (' + (tot ? (pc * 100).toFixed(1) : '0.0') + '%)') + '</title></rect>';
        x += pc * W;
      }
      return out(s + '</svg>', opt);
    }
    s = '<div class="statusbar' + (opt.tall ? ' tall' : '') + (opt.thin ? ' thin' : '') + '" role="img" aria-label="' +
        esc(opt.label || 'status distribution') + '">';
    for (i = 0; i < rows.length; i++) {
      pc = tot ? (rows[i].value / tot) * 100 : 0;
      if (pc <= 0) continue;
      s += '<i class="s-' + esc(rows[i].key) + '" style="width:' + r2(pc) + '%" title="' +
           esc(rows[i].label + ': ' + yf(rows[i].value) + ' (' + pc.toFixed(1) + '%)') + '"></i>';
    }
    s += '</div>';
    if (opt.legend) {
      s += '<div class="sb-legend">';
      for (i = 0; i < rows.length; i++) {
        pc = tot ? (rows[i].value / tot) * 100 : 0;
        s += '<span><i class="sdot ' + esc(rows[i].key) + '"></i>' + esc(rows[i].label) +
             ' <b>' + esc(yf(rows[i].value)) + '</b> <span class="muted">' + pc.toFixed(1) + '%</span></span>';
      }
      s += '</div>';
    }
    return out(s, opt);
  }

  /* =========================================================== UPTIME BARS
   * uptimeBars(states) — one bar per interval.
   * states: 'up'|'part'|'down'|'nodata', or a number (percent 0..100), or
   *         null (no data). Buckets: 100 / >=80 / <80 / no data.
   * ======================================================================= */
  function upClass(v) {
    if (v == null) return 'u-nd';
    if (typeof v === 'string') {
      if (v === 'up' || v === '100') return 'u-100';
      if (v === 'part' || v === 'warn') return 'u-80';
      if (v === 'down' || v === 'crit') return 'u-lo';
      return 'u-nd';
    }
    if (!isNum(v)) return 'u-nd';
    if (v >= 99.999) return 'u-100';
    if (v >= 80) return 'u-80';
    return 'u-lo';
  }
  var UP_TXT = { 'u-100': '100% up', 'u-80': 'degraded (>=80%)', 'u-lo': 'down (<80%)', 'u-nd': 'no data' };

  function uptimeBars(states, opt) {
    opt = opt || {};
    var arr = states || [], i, c, s;
    var max = opt.max || 96;
    if (arr.length > max) {
      /* keep the worst state in each bucket so an outage cannot be averaged away */
      var rank = { 'u-100': 0, 'u-nd': 1, 'u-80': 2, 'u-lo': 3 }, packed = [], size = arr.length / max;
      for (i = 0; i < max; i++) {
        var lo = Math.floor(i * size), hi = Math.min(arr.length, Math.max(lo + 1, Math.floor((i + 1) * size)));
        var worst = 'u-100';
        for (var j = lo; j < hi; j++) { var cc = upClass(arr[j]); if (rank[cc] > rank[worst]) worst = cc; }
        packed.push(worst);
      }
      arr = packed;
    }
    var labels = opt.labels || null;
    if (opt.svg) {
      var W = opt.w || 240, H = opt.h || 24, n = arr.length || 1;
      var bw = W / n, gap = bw > 3 ? 1 : 0;
      var hByCls = { 'u-100': 1, 'u-80': .74, 'u-lo': .48, 'u-nd': .26 };
      s = svgOpen('pchart', W, H, opt.label || 'uptime');
      for (i = 0; i < arr.length; i++) {
        c = (typeof arr[i] === 'string' && arr[i].indexOf('u-') === 0) ? arr[i] : upClass(arr[i]);
        var bh = H * hByCls[c];
        s += '<rect class="f-' + (c === 'u-100' ? 'ok' : c === 'u-80' ? 'warn' : c === 'u-lo' ? 'crit' : 'unk') +
             '" x="' + r2(i * bw) + '" y="' + r2(H - bh) + '" width="' + r2(Math.max(1, bw - gap)) +
             '" height="' + r2(bh) + '" rx="1"' + (c === 'u-nd' ? ' opacity=".55"' : '') + '><title>' +
             esc((labels && labels[i] ? labels[i] + ' · ' : '') + UP_TXT[c]) + '</title></rect>';
      }
      return out(s + '</svg>', opt);
    }
    s = '<div class="uptime-bars' + (opt.sm ? ' sm' : '') + (arr.length > 60 ? ' dense' : '') +
        '" role="img" aria-label="' + esc(opt.label || 'uptime per interval') + '">';
    for (i = 0; i < arr.length; i++) {
      c = (typeof arr[i] === 'string' && arr[i].indexOf('u-') === 0) ? arr[i] : upClass(arr[i]);
      s += '<i class="' + c + '" title="' + esc((labels && labels[i] ? labels[i] + ' · ' : '') + UP_TXT[c]) + '"></i>';
    }
    s += '</div>';
    return out(s, opt);
  }

  /* ================================================================ RENDER
   * An SVG sized by viewBox scales its text with the container: a 720-wide
   * viewBox drawn into a 560-wide card renders 12px labels at 9.3px. render()
   * removes that entirely by measuring the container first and building the
   * chart at exactly that width, so label text is always its true size.
   *
   *   PULSE_CHARTS.render('#chart', {type:'line', series:[…], yFmt:'pct2'})
   *   type: 'line' | 'bars' | 'spark' | 'status' | 'uptime'
   *   ratio: height / width for the auto height (default .30, min 150, max 300)
   *   responsive: false to skip the debounced redraw on resize
   * Returns {draw, node} — call draw() after the container changes size.
   * ===================================================================== */
  function render(target, opt) {
    opt = opt || {};
    var node = (typeof target === 'string' && global.document)
      ? global.document.querySelector(target) : target;
    if (!node) return null;
    var type = opt.type || 'line';

    function draw() {
      var w = Math.round(node.clientWidth || 0);
      if (!w) w = opt.w || 640;
      var o = {}, k;
      for (k in opt) if (Object.prototype.hasOwnProperty.call(opt, k)) o[k] = opt[k];
      o.w = w;
      if (!isNum(opt.h)) {
        var h = Math.round(w * (opt.ratio || 0.30));
        o.h = Math.max(opt.minH || 150, Math.min(opt.maxH || 300, h));
      }
      o.as = null;
      var m;
      if (type === 'bars')        m = barsGrouped(o);
      else if (type === 'spark')  m = sparkline(o.values, o);
      else if (type === 'status') m = statusBar(o.counts, o);
      else if (type === 'uptime') m = uptimeBars(o.states, o);
      else                        m = lineSeries(o);
      node.innerHTML = m;
      return m;
    }

    draw();
    if (opt.responsive !== false && global.addEventListener) {
      var tid = null, last = node.clientWidth;
      global.addEventListener('resize', function () {
        if (tid) global.clearTimeout(tid);
        tid = global.setTimeout(function () {
          if (Math.abs(node.clientWidth - last) < 8) return;
          last = node.clientWidth; draw();
        }, 140);
      });
    }
    return { draw: draw, node: node };
  }

  /* --------------------------------------------------------------- export */
  global.PULSE_CHARTS = {
    render: render,
    lineSeries: lineSeries,
    barsGrouped: barsGrouped,
    sparkline: sparkline,
    statusBar: statusBar,
    uptimeBars: uptimeBars,
    el: el,
    fmt: fmt,
    esc: esc,
    niceScale: niceScale,
    resample: resample,
    upClass: upClass
  };

})(typeof window !== 'undefined' ? window : this);
