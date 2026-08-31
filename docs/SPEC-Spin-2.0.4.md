# SPEC — Adeptio Pulse Spin 2.0.4 (base v2.0.2 front page)

**Build tree:** `/home/claude/pulse204/build/` (a copy of the v2.0.2 site). ONLY the front page
is in scope: `index.html`, `data/manifest.js`, `assets/engine.js`, plus THREE NEW FILES
`assets/linelogic.js`, `assets/tframes.js`, `assets/spin204.css`. Every other page/asset stays
byte-identical. Seeds, objectives, INC windows, pm strings: UNCHANGED — the seeded replay must
produce the identical week.

**Normative annexes (read them — they are the detail):**
- `/home/claude/pulse204/research/R1_ZONES.md` — zones, coords, band rects, rendering, legend row.
- `/home/claude/pulse204/research/R2_LINES.md` — bindings E01–E17, rules LC-01…LC-10, episode
  model, balloons, Line Conditions window, Timeframe D, legend/scenario copy.
- Fixtures & proofs: `research/lc_truthtable.py`, `research/lc_fixtures.py`,
  `research/zone_geometry_check.py` (all pass; do not regress them).

**Design law (locked):** lines = monitored relationships. No arrowheads, no animation, no
width-encodes-volume. States ok/warn/crit/grey; grey ≠ ok. Banned words on the map surface and
all new UI copy: *flow, path, trace, request travels, transaction journey* — sole exception is
the mandated legend sentence in R2 §7. (`.flow` class is renamed `.lc-live`; dashed stroke is
used ONLY for the grey not-covered line — rationale: E14 is a declared-only relationship.)

**Version marks:** on-surface chip text `v2.0.2` → `v2.0.4` in the index.html hint card (add one
clause: "zones group nodes by owning team · line colour = correlated evidence"); legend footer
string → `v2.0.4 · Myanmar commercial-bank template · 7-day mock data`. Nothing else re-marked.

---

## File ownership — no worker touches another's files

| Worker | Files (exclusive) |
|---|---|
| **W1 data** | `data/manifest.js`, `assets/linelogic.js` (new) |
| **W2 map** | `assets/engine.js` |
| **W3 dock** | `index.html`, `assets/tframes.js` (new), `assets/spin204.css` (new) |

Load order (W3 wires it): `assets/spin204.css` linked AFTER `assets/styles.css`;
`assets/linelogic.js` script tag IMMEDIATELY AFTER `data/manifest.js`;
`assets/tframes.js` IMMEDIATELY AFTER `assets/engine.js`.
All cross-file calls are GUARDED (`window.X && X.y(...)`) so any load/failure order still boots.

## Shared registry — exact names (do not improvise)

- Data: `ADEPTIO_DATA.ZONES` (array: `{id:'Z1',name,chip,members:[ids],band:{x,y,w,h}}` per R1 §1+§3.1),
  `ADEPTIO_DATA.LINE_BIND` (array PARALLEL to `LINKS`:
  `{id:'E01', conn:[[nodeId,objLabel],…], appA:[…], appB:[…], logA:[…], logB:[…], connBatch:false}` —
  bindings VERBATIM from R2 §1; `connBatch:true` only E16), each NODES entry gains `zone:'Zn'`
  and the NEW x/y from R1 §3.2.
- Line logic API: `window.PULSE_LINELOGIC = { RULES, evalLine(ev, connBatch) -> {id,state},
  computeAll(deps) }` where `deps = {NODES, LINKS, LINE_BIND, N, worse, byId, incKeyAt}` and
  `computeAll` attaches to each link `L`: `L.bind`, `L.lineStat[N]`, `L.lineRule[N]`,
  `L.eps[] = {start,end,worst,ruleId,worstStep,contrib:[{cls,side,nid,label,sev,val,peakStep,thr,dir,objEpStart,inc}]}`
  per R2 §3. Grey produces NO episodes. Pure JS, no DOM, no engine globals.
- Engine API (W2 defines at end of engine.js):
  `window.PULSE_ENGINE = { NODES, LINKS, N, cur:()=>cur, seek(step) /*setCur+pause*/,
  openLineBalloons(linkIdx, sticky), focusLinkMid(linkIdx), openRCA, dstamp, fmtDur, fmtVal,
  chip, esc, statusColor, incName, worse, WIN /*window-name→steps map used by tables*/ }`.
- Hooks: engine calls `window.PULSE_TFD && PULSE_TFD.init(window.PULSE_ENGINE)` once after boot
  precompute, and `window.PULSE_TFD && PULSE_TFD.refresh()` inside `renderTables()` (after its
  closed-gate) and after `setCur`-driven repaints that refresh tables.
- DOM/CSS names: `#zones .zband .zband.alt .zlabel .zchip .zchipt .zdim .zhot` ·
  `#lcballoons .lcballoon .lcb-row .lcb-rule .lcb-conn .lcb-badge [data-flip]` ·
  `#lcConditions .lcwin .evchip .sevchip.grey` ·
  `#tblD .tfd .tfd-tag #dWin #dSev #dNode #dWrap .oo-glyph` ·
  CSS vars `--tfd --zband-a --zband-b --zband-line` (values R1 §4.2 + R2 §6, dark AND light).
- W2 CREATES `<g id="zones">` (first child of `#viewport`) and `<div id="lcballoons">`
  (appended to `#stage`) from JS — index.html gets no map-side markup changes.

## W1 — data layer

1. `data/manifest.js`: add `zone` to each node; REPLACE the 16 x/y with R1 §3.2; append `ZONES`
   and `LINE_BIND`; export both on `ADEPTIO_DATA`. Objective labels in LINE_BIND must match
   `objs[].label` EXACTLY (⚠ `otp·Challenge→verify success` contains `→` U+2192; copy from file).
   Nothing else changes.
2. `assets/linelogic.js`: implement R2 §2 rules (first-match-wins, exact predicate table) and
   R2 §3 precompute incl. `seal()` contrib extraction. `evWorst` returns `'none'` for empty
   cells. Include the rule plain-English copy strings in `RULES` (used by UI titles).
   Self-check at load (dev): if `location.hash === '#lcselftest'` run the three fixture spot
   checks (R2 §3: step 428 E09=crit/LC-06 & E04=ok; step 1394 E02=ok & E03=warn; step 66
   E06=crit/LC-03) and `console.error` any mismatch — otherwise silent.

## W2 — map layer (engine.js)

1. Boot: after the NODES hydration loop, add `incKeyAt` helper (lift window-pick logic from
   `traceTicket`), then guarded `PULSE_LINELOGIC.computeAll({...})`; then `PULSE_TFD.init` call.
2. Replace `linkStatus()` → `L.lineStat[t]` (fallback: grey when linelogic absent). `paint()`
   link pass: uniform `stroke-width` 2.4 ok / 3.2 warn / 3.6 crit / 2 grey; grey = `--unk` +
   `stroke-dasharray:4 5`; rename `.flow` → `.lc-live`; never read `L[2]` for width.
3. `buildZones()` per R1 §4: bands (alt alpha), label + owner chip, `pointer-events:none` except
   label group; hover label → `.zdim`/`.zhot`; click label → Timeframe C filter (add six
   `zone:Zn` options to `#cNode`; extend `renderTableC` filter: `zone:` prefix matches node.zone).
4. `fit()`: union ZONES band rects into the bbox (R1 §3.4).
5. Legend (`buildLegend`): remove worst-of-path line; add R2 §7 two `.li` lines + grey swatch
   (dashed sample), add R1 §4.5 zones row, add mandated claim line above provenance; provenance
   → `v2.0.4 · …`.
6. Scenario card copy (~line 192): replace the Incident-F clause per R2 §7
   (`CORE OUTAGE — six relationships critical behind the gateway, perimeter clean`). Audit the
   whole scenario string for banned words.
7. Dock pane header: on the line showing `pm`, append ` · Zn NAME` + owner chip text (plain
   span, `.zchipt`-like styling via inline class `zchip-inline` W3 provides).
8. Balloons per R2 §4 EXACTLY: trigger on state-change into warn/crit at live cursor (playback
   or manual seek; not boot); 2 endpoint balloons (≤3 evidence rows, `hc-row` grammar, "No
   evidence bound at this end." when empty) + midpoint rule chip `LC-xx` + CONN chip; anchors
   above nodes at `(n.x, n.y−40)` model space with sibling-nudge + top-clamp flip; cap 3 sets +
   `+N more lines changed` badge (top-right, `--tfd`, click → opens/focuses Timeframe D);
   fade 140ms/6000ms/500ms, hover pauses set, pause freezes, seek clears; sticky via line click
   (✕/Esc/elsewhere/seek dismisses; Esc precedes existing chain); reduced-motion per R2;
   HTML overlay `#lcballoons` z-22, `positionBalloons()` rAF-coalesced from `applyView()` and
   node drag. `openLineBalloons(idx,sticky)` + `focusLinkMid(idx)` exported.

## W3 — dock layer

1. `index.html`: inside `#bottom`, AFTER `#btables`: insert `#lcConditions` (R2 §5 markup,
   collapsed by default, `.rtoggle` caret, exact copy strings) then `.btables-d > #tblD`
   (R2 §6 markup: header, `#dWin` (default **1h**) `#dSev` `#dNode`, `#dWrap`). Make `#bottom`
   content a column that keeps `.btables{flex:1;min-height:0}` working with the existing
   height-resize handle: `#lcConditions` natural height; `.btables-d` `flex:0 0 auto` with
   `#dWrap{max-height:220px;overflow:auto}`. Wire the 3 tags per load order above. Hint-card
   version text → v2.0.4 (+ the one added clause). NO other markup edits.
2. `assets/spin204.css`: zone styles (R1 §4.2/4.3 verbatim incl. light theme + `.zdim/.zhot` +
   `zchip-inline`), balloon styles (glass panel like `.hovercard`, sev dots, rule/CONN chips,
   tail `::after` + `[data-flip]`, badge), `--tfd` (R2 §6 values dark+light), `.sevchip.grey`,
   `.tfd` section styling (2px `--tfd` top border, `.tfd-tag`, col-group header rules,
   `#tblD` cell wrap overrides + `vertical-align:top` + `--line` row borders), `.oo-glyph`
   sizing, `.evchip`, LC window tweaks (CONDITION cell wraps), reduced-motion guards.
3. `assets/tframes.js`: `window.PULSE_TFD = { init(api), refresh() }`.
   - LC window: render R2 §5 table ONCE (static), vocabulary strip + footer copy verbatim,
     collapse persistence for session, hook into engine `resetAll` via listening for the
     existing Reset button click (guarded) to re-collapse.
   - Timeframe D: per R2 §6 — columns D1–D11 in three col-groups (two-row thead), o—o glyph
     inline SVG (node short-names CLI TEL EDG GW AUT OTP SMS PAY ACC DBR COR BHB BIL BBT MQ RCN),
     window filter over `L.eps` (episode intersects window ending at `api.cur()`), newest-first,
     sortable WHEN/FOR/SEV, sev+node filters, 40-row cap, ≤4 contrib rows + `+N more` (opens
     sticky balloons via api), clipped-start `⋯` marker, empty states + permanent grey-notice
     line (exact strings R2 §6), row click → `api.seek(worstStep)` + `focusLinkMid` +
     `openLineBalloons(idx,true)`; CASE cell click additionally `api.openRCA(nid,label,'1h')`.
     LC-chip click scrolls/expands the LC window to that rule.

## Gates (Fable runs after merge — workers self-check what they can)

G1 zero console errors on file:// boot (seeded replay banner intact). G2 fixtures: steps
428/1394/66 line states match R2 §3 tables exactly (17 links each). G3 E14 grey dashed all
week, absent from D, grey-notice present. G4 no text/frame overlap at 1280/1440/1680/1920 —
zones labels, balloons, D rows. G5 banned-word audit on rendered front page text (allowed:
the mandated claim sentence ×3, existing menu/nav names). G6 balloons never cover the 3 node
label lines; cap honoured at step 1793 (5 escalations → 3 sets + "+2 more"). G7 uniform
stroke widths (no L[2] width term); no arrowheads/animation. G8 reduced-motion path works.
G9 Timeframe A/B/C behaviour unchanged; dock resize + ⌘K + shell untouched.
