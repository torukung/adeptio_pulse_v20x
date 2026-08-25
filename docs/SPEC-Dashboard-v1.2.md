# Adeptio Live Status Dashboard — v1.2 Build Spec & Reuse Blueprint

A single‑file, dependency‑free **interactive live‑status topology dashboard** (mock data) for an end‑to‑end flow. This document is the reusable spec: hand it to the team (or a new session) together with a **new use‑case flow** and you get a matching dashboard by swapping only the clearly‑marked data blocks. Nothing here needs a build step, framework, or network — it is one `.html` file of vanilla HTML + CSS + inline SVG + JS.

> Source of truth: `Deliverables/Adeptio-Live-Status-Dashboard-v1.2.html` · v1.0 archived in `Deliverables/_versions/`.

---

## 1 · What it is (at a glance)

- A **vector node‑link map** of one flow (front‑end → back‑end), each object showing a **segmented status ring** (one arc per objective) and coloured links (worst‑of‑path).
- **Glance‑level colour**: OK / Degraded / Critical, colour‑blind‑safe, reserved strictly for status.
- **Interactions**: drag nodes (grid‑snap), zoom‑to‑cursor, pan, hover cards, click → stacked pinnable detail panes (resizable right dock), per‑object notes, light/dark.
- **6h→24h time‑lapse**: play/scrub a full day of mock data; a scripted incident propagates and recovers; hover any moment to read historical status.
- **Bottom live‑synthesis panel** (closable, resizable) with **3 tables** (A daily top errors, B recent‑errors log, C configurable) — each with a **time‑frame selector** (5m/15m/1h/3h/6h/12h/24h) and a **Refresh** button.

---

## 2 · Retarget to a NEW flow — the only 5 things to change

Everything else (rendering, interactions, tables, timeline, theming) is generic and stays as‑is. To point the dashboard at a different use‑case flow, edit these blocks in the `<script>`:

1. **`NODES`** — the objects in your flow (id, name, ip/subtitle, type→icon, x/y layout, and each object's `objs` = its objectives/indicators with thresholds).
2. **`LINKS`** — the edges `[fromId, toId, utilization]` describing the topology.
3. **`INC`** (+ objective `inc` tags) — the scripted incident windows across the day and which objectives they affect.
4. **`KPI`** — the single headline metric shown in the scenario banner (e.g. "Payment success %"); rename to your flow's north‑star.
5. **Copy/labels** — title, brand subtitle, scenario banner text, and (optionally) node `type` icons.

Node positions can be hand‑placed (as in v1.2) or dropped roughly — users can drag + the **Fit** button reframes. Keep 12–16 nodes for readability; group by tier left→right with branches for data/side systems.

---

## 3 · Data model reference

### 3.1 Objective factory

```js
// A(label, unit, base, warn, crit, dir, amp, noise, inc, extra)
//   dir : 'hi' = higher is worse (latency, errors, queue)   |  'lo' = lower is worse (availability, success%)
//   base: nominal value      warn/crit: thresholds           amp : incident amplitude (how far it moves under stress)
//   noise: random jitter range   inc : incident key 'A'|'B'|'C'|'D'|null   extra: {int:true, max, min}
const A  = (label,unit,base,warn,crit,dir,amp,noise,inc,extra)=>({label,unit,base,warn,crit,dir,amp,noise,inc:inc||null,...extra});
// AV(inc, amp) — availability shorthand: %, dir 'lo', warn 99.5 / crit 98.5
const AV = (inc,amp)=>A('Availability','%',99.98,99.5,98.5,'lo',amp||3.5,0.02,inc,{max:100,min:80});
```

Status of one objective at time `t` is derived from its value vs thresholds and `dir`. A node's status = **worst** of its objectives; a link's status = **worst of its two endpoints**.

### 3.2 Node shape

```js
{ id:'gw', name:'e-Payment API GW', ip:'integration', type:T.gw, x:900, y:260,
  objs:[ AV('A',3),
         A('API p95','ms',280,500,900,'hi',520,40,'A'),
         A('Circuit breaker','open/m',0,1,3,'hi',3.4,0.2,'A',{int:true}),
         A('Timeout to bank','%',0.2,0.5,2,'hi',3.2,0.15,'A') ] }
```

`type` maps to an inline‑SVG icon via the `T` map + `ICON` dictionary. Provided types (swap/extend freely):
`client, net(cloud), fw(shield), lb, web, app, gw, mq, db, stor, recon, link, bank, switch, core`.
Icons are neutral‑ink line glyphs (type by **shape**, not colour) so status colour stays unambiguous.

### 3.3 Links

```js
const LINKS = [ ['client','net',30], ['net','fw',40], /* … */ ['recon','app',36] ];
// [fromId, toId, utilization]  — utilization only tweaks OK-link thickness
```

### 3.4 Time base & series generation

```js
const N = 288, STEP_MIN = 5;          // 288 × 5-min = 24h. (v1.0 used N=72 = 6h.)
// series generated once at load: for each objective, gen() produces vals[] + stat[] over N steps,
// blending base + noise + incident amplitude, then classifying ok/warn/crit by thresholds.
```

Browser JS may use `Math.random()`/`Date` freely (unlike workflow scripts). Series are generated once at boot so a scenario stays consistent across replays; **Reset** replays from t=0 without regenerating.

### 3.5 Incident scripting

```js
const INC = {
  C:[34,42,54],     // triangular window [start, peak, end]  — morning blip
  A:[120,140,172],  // major mid-day incident (propagates across the payment path)
  D:[228,246,266],  // evening secondary
  B:[196,287]       // ramp [start,end] — slow capacity creep to end-of-day
};
// sevAt(inc,t): triangular for A/C/D, linear ramp for B → 0..1 severity multiplied by each objective's amp.
```

Tag an objective with `inc:'A'` (etc.) to make it participate in that incident. Distribute incidents across the day so the timeline shows multiple bands and the tables have material to rank. Aim for one **major** cascading incident (hits many linked objects) + 1–2 **local** ones.

### 3.6 Headline KPI

```js
const KPI = gen(A('','%',99.7,99.5,98.5,'lo',3.6,0.06,'A',{max:100})); // shown in scenario banner
```

---

## 4 · Layout

CSS grid, four rows: **top bar / stage (map) / bottom tables / timeline**.

- **Top bar**: brand + version chip · at‑a‑glance counters (OK/Degraded/Critical) · freshness "as of HH:MM" + live dot · search · tools (toggle tables, zoom −/+, fit, re‑tidy, theme).
- **Stage**: SVG canvas (`#viewport` = single `translate/scale` transform for pan/zoom) with `#links` under `#nodes`; overlays = hint, scenario banner, hover card, legend, and the **right dock** (absolute, resizable).
- **Bottom panel**: drag‑handle (resize height) + header (title, refresh, close) + 3 tables separated by draggable width dividers.
- **Timeline**: play/pause · scrub track with incident bands + hour ticks + hover ghost · speed cycle · Reset · Now.

Key CSS variables (theme‑swapped): `--dockW` (right dock width) and `--bh` (bottom panel height) are JS‑controlled for resizing.

---

## 5 · Design system

- **Dark‑first**, light optional (`html[data-theme]`). Neutral backgrounds; **saturated colour only for status**.
- **Status palette** (colour‑blind‑safe, Okabe‑Ito‑derived), separate hex per theme:
  - dark: `--ok #2dd4a7` · `--warn #f5a623` · `--crit #ff6b5a` · `--unk #8b94a3`
  - light: `--ok #0e8a5f` · `--warn #b45309` · `--crit #ce3b24` · `--unk #6b7280`
- **Status encoding is never colour‑alone**: reinforced by the ring shape, node glow, severity chips, and text labels.
- **Glass** (`backdrop-filter`) is used on **chrome only** (top bar, dock, bottom, cards) — not on data marks.
- **Type**: system UI stack; **tabular/mono numerals** for all metric values and table numbers.
- **Motion for signal**: link "flow" dashes + node glow on non‑OK; `prefers-reduced-motion` friendly; ~150–200 ms transitions.
- **Icons**: inline SVG line glyphs, `stroke: currentColor`, neutral ink.

---

## 6 · Interaction inventory (all generic — keep as‑is)

| Area | Behaviour |
|---|---|
| Nodes | Drag to move (**snaps to 20px grid**); click to open detail pane; hover → status card (delayed, flips to stay on‑screen, non‑stealing). |
| Canvas | Scroll = zoom‑to‑cursor (0.3–4×); drag empty space = pan; **Fit**, **zoom ±**, **re‑tidy**. |
| Selection | Selected node highlighted; non‑neighbours dimmed (blast‑radius focus); Esc clears. |
| Right dock | Stacked panes (objectives + sparklines + threshold + editable **note**); **pin** to keep; **close**; **drag left edge to resize** (300–720px). |
| Notes | Per‑object note; a ● badge appears on noted nodes (in‑memory for the session). |
| Bottom panel | **Closable** (✕ or top‑bar toggle) · **resize height** (top handle) · **resize table widths** (dividers) · **Refresh** button. |
| Timeline | **Play/Pause** (Space), **scrub**, hover ghost time, **speed** 1×→4→8→16→32 (default **1×**), incident bands, hour ticks, **Now**, **Reset**. |
| Theme | Light/dark toggle. |
| Search | Enter jumps to a node (opens pane + centres). |
| Reset | Restart the day from t=0 and clear all state (panes, notes, positions, sizes, table filters, speed→1×). |

---

## 7 · Live tables (bottom panel)

All three share a **time‑frame selector**: `5m · 15m · 1h · 3h · 6h · 12h · 24h` (`WSTEPS = {5m:1,15m:3,1h:12,3h:36,6h:72,12h:144,24h:288}`, window = last *X* ending at the current timeline position). A **Refresh** button re‑renders on demand. Tables update **in place** as the timeline moves; **calm empty state** ("✓ No errors …") when clear. Severity chips, right‑aligned tabular numbers, sticky headers, **row‑click focuses the node** on the map.

- **A · Top errors** *(default 24h)* — one aggregated row per object·objective over the window; rank by **Severity‑weighted** (default) / Downtime / Event count. Columns: Object · Indicator · Sev · Events · Downtime · Last · 24h sparkline.
- **B · Recent errors** *(default 5m)* — chronological **newest‑first** log of episodes intersecting the window, showing **Active** and **Recovered**. Columns: Since · Age (live) · Object · Indicator · Sev · **Trigger** (value vs limit, e.g. `766ms > 500`) · Value · State.
- **C · Custom** *(default 24h)* — configurable: **column chooser**, severity filter, node filter, window, click‑to‑sort headers.

Derivation helpers: `episodes(stat)` → contiguous non‑OK runs; `windowRows(t,W)` → aggregate over last W steps (used by A and C); `recentRows(t,W)` → episode log (used by B).

---

## 8 · Ready‑to‑use generation prompt (copy, fill the blanks, paste)

> Build a single‑file interactive live‑status dashboard identical in architecture, design system, and interactions to the **Adeptio Live Status Dashboard v1.2** (see spec), but for the **`<NEW FLOW NAME>`** flow. Keep everything generic; only change the 5 data blocks.
>
> **Flow objects (front‑end → back‑end):** `<list 12–16 objects: name, short subtitle/IP, type icon, tier>`.
> **Topology / links:** `<which object connects to which; note the main path + side branches>`.
> **Per‑object objectives (indicators):** for each object give 2–4 indicators as `label, unit, nominal, warn, crit, direction(hi/lo)` — include one Availability each.
> **Headline KPI:** `<the one north‑star metric + nominal/warn/crit>`.
> **Scenario for the day:** one major cascading incident on the critical path `<window + which objects>`, plus 1–2 local incidents `<windows + objects>`, and one slow capacity‑creep ramp `<object(s)>`.
> **Copy:** title = `<…>`, subtitle = `<…>`.
>
> Preserve verbatim: the dark/light palette and tokens, node ring/hover/dock/notes behaviour, grid‑snap drag, zoom/pan/fit, the 24h play/scrub timeline with incident bands, the 3 bottom tables with the 5m…24h time‑frame selector + Refresh, Reset, and the "colour = status only" rule. Verify headless: no console errors, tables populate at the incident, light+dark both clean, no text/frame overlap.

---

## 9 · Verification checklist (before shipping any variant)

- [ ] No console/page errors (headless load).
- [ ] Nodes render with icons + per‑objective rings; links coloured by worst‑of‑path.
- [ ] Scrub into the major incident → path turns red, counters update, KPI drops.
- [ ] All 3 tables populate; time‑frame selectors change row counts; Refresh works; empty state shows when clear.
- [ ] Right dock resizes; bottom panel resizes/closes/reopens; table width dividers work.
- [ ] Node drag snaps to grid; hover card flips on‑screen; row‑click focuses node.
- [ ] Light + dark both legible; no text/frame overlap at 1280 and mobile widths.
- [ ] Reset returns to t=0 and clears state; default speed is 1×.

---

## 10 · Notes & honest limits

- **Mock data.** Series are generated in‑browser to demonstrate behaviour. For production, replace `gen()`/series with a live feed (poll a JSON endpoint or subscribe via SSE/WebSocket) and keep the same `vals[]`/`stat[]` shape per objective; the whole UI then "just works".
- **In‑memory state.** Notes, positions, and layout live for the session only (artifact‑sandbox rule). A production build would persist per‑user (server or localStorage outside the sandbox).
- **Scale.** Tuned for ~12–16 nodes on one plane. For larger estates, add grouping/semantic‑zoom (collapse clusters when zoomed out) before exceeding ~25 nodes.
- **Accuracy.** Vendor/endpoint specifics in any flow are placeholders unless confirmed against the real system — validate before operational use.

---

*Companion to the Customs Revenue / e‑Payment health‑check blueprint. Same worker model: architect the flow → (optional) research → draw + code the dashboard → verify headless → deliver.*
