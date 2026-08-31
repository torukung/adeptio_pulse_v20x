# ADEPTIO Pulse — Demo Site v2.0.2

**One seeded week of a mobile-payment estate, collected without an APM, told fifteen ways.**

> **© Adeptio Pulse — public demonstration template.** All data is mock — regenerated
> in-browser from a fixed seed; every figure is illustrative. Not affiliated with, and not
> describing, any named institution.

A live status map, the instrumentation behind it, eleven monitoring / management screens,
a small ticketing portal and a collector control plane — fifteen pages that all read the
**same 2016-step week**. Nothing is fetched, nothing is measured by an agent inside an
application, and no page recomputes a number another page shows.

Vanilla HTML + CSS + SVG + JS. No framework, no build step, no dependencies, no network
calls at runtime.

---

## v2.0.2 (2026-08-23) — one platform shell

**One shell, everywhere.** The menus' `PulseShell` is upgraded and adopted by the three
pages that still wore their own chrome — the front page, flow instrumentation and the
Incident Trace portal — so all fifteen delivered pages (plus the three `docs/dev/`
scaffolding pages, which already wore it) now read from one nav model, one theme and
one status readout.

* **Legacy chrome hidden, not deleted.** Each adopted page's old top strip (`.topbar`
  on the front page, the page's own `<header>` on flow instrumentation, `.p-top` on
  Incident Trace) stays in the markup behind a page-local style rule, so
  `build_singlefile.py` still inlines `index.html` into the same standalone,
  shell-free one-file dashboard it always has.
* **Brand-block + chevron collapse.** The top-left lockup (ECG mark · `adeptio·Pulse`
  wordmark · chevron) now drives a three-state sidebar: **expanded** (280px) →
  **rail** (64px, icons + tooltips) → **hidden** (0px, opt-in, reopened from a
  floating tab at the left edge). Toggle it with the chevron, `[` (expanded↔rail),
  `Shift+[` (→ hidden), or a click on the sidebar's own right-hand border.
* **Animated ECG.** The trace draws once per page load (~1.6s) instead of looping,
  then a small pip at its baseline beats every 2s (30bpm) to read as a live stream.
  Both stages honour `prefers-reduced-motion` and `html[data-motion="reduce"]` — the
  reduced-motion view shows the completed trace and a static pip, no animation.
* **Topbar v2.** One continuous 56px band with the brand block: an auto-derived
  breadcrumb, a `⌘K` search button, a status cluster (`16 OK · 0 deg · 0 crit`),
  freshness, and the theme toggle.
* **⌘K command palette.** `Cmd/Ctrl+K` opens a fuzzy-matched jump list — every screen
  in the nav, plus a few actions (collapse/expand menu, toggle theme, reduce motion)
  — with shortcut hints and up to 5 recent screens listed first. `Esc` closes it and
  returns focus to wherever it was.
* **Nav regroup.** The left nav's groups are now **MAIN · HEALTH · RELIABILITY ·
  INVESTIGATE · OPERATE** — same links, same paths, regrouped for how the pages
  actually get used; icons and the active-page logic are unchanged.
* docs/ additions: capture-map.html (node+dataflow capture infographic) + datasource-confirmation.html v1.1 (demo-status chips) — cross-linked.

Research basis: a benchmark study of Grafana, Datadog, Linear, Vercel and Honeycomb, cross-checked against an organic-sentiment corpus of how people actually describe dashboard chrome — the logo stays a home link throughout, per that convention. Full contract: [`docs/SPEC-Shell-v2.0.2.md`](docs/SPEC-Shell-v2.0.2.md).

---

## v2.0.1 (2026-08-23)

A **label-only re-mark**. No data values, no seeds, no logic and no layout changed — only
the strings the pages print.

* **Dates instead of day indices.** The mock week is now stated as **WK34 of 2027,
  Mon 23 – Sun 29 August**, and the `D1`…`D7` marks read as real dates:

  | | D1 | D2 | D3 | D4 | D5 | D6 | D7 |
  |---|---|---|---|---|---|---|---|
  | **v2.0.1** | Aug 23 | Aug 24 | Aug 25 | Aug 26 | Aug 27 | Aug 28 | Aug 29 |

  Stamps, ticks and column heads carry **no year** — `D3 14:05` is now `Aug 25 14:05`. The
  year is stated **once per screen**, in a header or subtitle, as `Aug 23 – 29, 2027`, and
  only on screens that actually show day-level marks.
* **Week keys are unchanged.** `WK31`…`WK34` stay as they are; their anchor ranges are
  WK31 `Aug 2 – 8`, WK32 `Aug 9 – 15`, WK33 `Aug 16 – 22`, WK34 `Aug 23 – 29` (2027).
* **Live-synthesis frames renamed.** The three synthesis tables are now **Timeframe A / B /
  C** with muted descriptors, so a frame letter can no longer be misread as an incident
  window letter.
* **Incident windows are displayed in full.** A window now prints as
  `WK34 · Incident B — storage creep`, not as a bare `B`. The compact `W34·B` form is used
  only where a cell is genuinely tight. **Keys are untouched**: `INC` / `INCMETA` /
  `byWindow` are still keyed `A`…`I`, and `#j=paybill&w=F`-style hashes still carry the
  bare letter.
* **Ticket ids are not window letters.** `INC-1018` and the `#INC-1018` deep-link hashes are
  ticket numbers and were left exactly as they were.
* **The protection ring changed.** `assets/engine.js` and `index.html` are now **MODIFIED**
  relative to the v1.2.1 base — the byte-identical-to-base rule no longer holds for them, or
  for the other label-carrying files in that ring. `flow-instrumentation.html` and
  `assets/flow.css` remain untouched originals. See [Protected files](#protected-files).

---

## Start here

There are exactly **two entry points**, and they reach every page:

1. **`index.html` → the "Menus" chip in the top bar.** The launcher drops down a list of
   all fifteen pages, grouped the way the left nav is grouped. This is the way in from the
   front page and from `flow-instrumentation.html`.
2. **The left nav on any menu / admin page.** Every page below the front page wears the
   same shell: the nav is built by `assets/shell.js` from one model
   (`PULSE_SHELL.NAV`), so it is identical everywhere and always current. It collapses to
   icons under 1100px and hides behind a button under 760px.

There is deliberately **no `menus/index.html`**. A directory landing page would be a third
list of the same links, drifting away from the other two the first time a page is added.
The launcher and the nav come from one model in one file; adding a page there adds it to
both at once.

Everything else is a cross-link: an incident-coloured row anywhere in the site offers
*Open on the flow map at this time* (`index.html#t=<step>`) and, where a case exists,
*Open case* (`incident-trace.html#INC-10xx`).

## Quickstart

**Just open `index.html`** — double-click it. Everything loads through plain `<link>` /
`<script src>` tags, so it runs straight off disk over `file://`. There is deliberately no
`fetch()` / `XHR` / ES-module / CDN reference anywhere: browsers block those for local
files, and avoiding them is what makes the folder portable.

If you would rather serve it:

```sh
python3 -m http.server 8000     # then open http://localhost:8000/
```

Only needed if you want a real origin (dev-tools throttling, a device on the LAN).
Nothing in the site requires it. It also works as-is on GitHub Pages — every path is
relative.

## The site at a glance

| | Page | What it is |
|---|---|---|
| 1 | [`index.html`](index.html) | **Live status dashboard.** 16 objects, 17 links, a deterministic 7-day mock week (2016 steps × 5 min) with nine incident windows, three live synthesis tables, a scrubbable timeline and the RCA panel. |
| 2 | [`flow-instrumentation.html`](flow-instrumentation.html) | **The use case, fully instrumented.** Every journey step and the lane that sees it, the objects it crosses, the register of all 61 health checks with their first-check copy, and the nine fault fingerprints — each routed to a case. |
| 3 | [`incident-trace.html`](incident-trace.html) | **Incident Trace portal.** Board / list / detail ticketing over the same nine windows — 20 seeded cases, drag-to-transition, comments, linked issues, create. Edits persist to `localStorage` in your browser only. |
| 4 | [`menus/sla-weekly.html`](menus/sla-weekly.html) | Weekly SLA for the critical services — availability / success / response-time tiles, per-service table, 4-week trend. |
| 5 | [`menus/sla-drilldown.html`](menus/sla-drilldown.html) | The same week broken to group → API → day, success % over response-time % per cell. |
| 6 | [`menus/kpi-live.html`](menus/kpi-live.html) | Per-journey SLO with the error budget, at 1-minute precision. |
| 7 | [`menus/service-health.html`](menus/service-health.html) | RED metrics per service, expandable to endpoints, error types and the last 20 errors. |
| 8 | [`menus/synthetic.html`](menus/synthetic.html) | 23 synthetic monitors, uptime bars per interval, three vantages. |
| 9 | [`menus/downstream.html`](menus/downstream.html) | The 12 downstreams as callers see them: calls, 5xx, status mix, top endpoints. |
| 10 | [`menus/dependencies.html`](menus/dependencies.html) | Per-service dependency table with the technique and confidence behind every edge. |
| 11 | [`menus/errors.html`](menus/errors.html) | Errors explorer: business vs technical, exception groups, occurrences, B-/T- result codes. |
| 12 | [`menus/journey.html`](menus/journey.html) | Six customer journeys, three lenses (two collected), funnel and by-stage breakdown. |
| 13 | [`menus/ops-issues.html`](menus/ops-issues.html) | The issue register with severity, PIC, ETA, decision and week-over-week evidence. |
| 14 | [`menus/error-tracking.html`](menus/error-tracking.html) | Error-code tracking as a table or a board, with status persisted locally. |
| 15 | [`admin/collectors.html`](admin/collectors.html) | The collector control plane: 16 sources × lane × method × state, probes, parsers, assertions, thresholds, pipeline health, licence. |

## Folder tree

```
site/
├─ index.html                     page 1 — markup + boot only
├─ flow-instrumentation.html      page 2 — the instrument itself
├─ incident-trace.html            page 3 — the ticket portal
├─ build_singlefile.py            re-inlines page 1 into one portable file
├─ menus/                         the eleven monitoring / management screens
│   ├─ sla-weekly.html · sla-drilldown.html · kpi-live.html · service-health.html
│   ├─ synthetic.html · downstream.html · dependencies.html · errors.html
│   └─ journey.html · ops-issues.html · error-tracking.html
├─ admin/collectors.html          the collector control plane
├─ assets/
│   ├─ styles.css engine.js       page 1 (base ring — v2.0.1 label re-mark only)
│   ├─ portal.css portal.js       page 3 (base ring — v2.0.1 label re-mark only)
│   ├─ tokens.css                 the :root dark + light token blocks
│   ├─ shell.css shell.js         left nav (expanded/rail/hidden), top bar, ⌘K palette,
│   │                             theme, range chips, footer, launcher
│   ├─ menus.css                  tiles, tables, chips, pills, cards, bars, overlay
│   ├─ charts.js                  inline-SVG line / bars / sparkline / status / uptime
│   └─ synth.js                   the page payloads (window.PULSE_SYNTH)
├─ data/
│   ├─ manifest.js                topology + objectives + INC + INCMETA  (base ring)
│   ├─ rcameta.js                 RCA copy: checks, questions, owners     (base ring)
│   ├─ tickets.js                 the 20 seeded cases + byWindow          (base ring)
│   ├─ registry.js                the account model — journeys, routes, downstreams …
│   ├─ spine.js                   the seeded canonical-bucket generator
│   └─ README.md                  the two data modes and the live-feed contract
└─ docs/
    ├─ SPEC-Dashboard-v1.2.md            engine spec (base)
    ├─ SPEC-Dashboard-v1.2.1-Addendum.md the Pay Bill week + site structure
    ├─ SPEC-Site-v2.0.md                 v2.0 data contract · §12 page map · §13 story walkthrough
    ├─ SPEC-Shell-v2.0.2.md              the shell contract · nav states · palette · §9 QA checklist
    └─ dev/                              scaffolding, not part of the delivery
        ├─ _kit.html                     every shared component with dummy data
        ├─ _template.html                the skeleton a menu page is copied from
        └─ flow-lineage.html             the flow content in a plain shell page, for QA
```

The three files in `docs/dev/` carry `<base href="../../">` so they keep working from there —
relative paths and the shell's nav both resolve against the site root. Shipped pages carry
no `<base>`.

## Load order

Three different boots, on purpose.

**Front page (`index.html`)** — unchanged from v1.2.1 apart from the launcher:

```html
<script src="data/manifest.js"></script>   <!-- window.ADEPTIO_DATA    topology + INC -->
<script src="data/rcameta.js"></script>    <!-- window.ADEPTIO_RCA     optional -->
<script src="data/tickets.js"></script>    <!-- window.ADEPTIO_TICKETS optional -->
<!--ADEPTIO-LOGS-START … day logs, commented out … ADEPTIO-LOGS-END-->
<script src="assets/engine.js"></script>   <!-- hydrate → render → interact -->
```

**Menu / admin / page-2 pages** — six files, in this order, then the page's own script:

```html
<script src="../data/manifest.js"></script>   <!-- window.ADEPTIO_DATA -->
<script src="../data/rcameta.js"></script>    <!-- window.ADEPTIO_RCA -->
<script src="../data/tickets.js"></script>    <!-- window.ADEPTIO_TICKETS -->
<script src="../data/registry.js"></script>   <!-- window.PULSE_REG    the model -->
<script src="../data/spine.js"></script>      <!-- window.PULSE_SPINE  the seeded week -->
<script src="../assets/synth.js"></script>    <!-- window.PULSE_SYNTH  the page payloads -->
<script src="../assets/charts.js"></script>   <!-- window.PULSE_CHARTS -->
<script src="../assets/shell.js"></script>    <!-- window.PULSE_SHELL  builds the frame -->
```

(`flow-instrumentation.html` sits in the root, so the same eight lines without `../`.)
Each file throws a named error if its predecessor is missing, so a wrong order fails loudly
instead of rendering zeros. A page never talks to `spine.js` directly — it reads one
`PULSE_SYNTH` payload and formats it.

**Portal (`incident-trace.html`)** — `tickets.js` → `portal.js`, plus `shell.js` for the
top nav strip.

## Data: two modes, one week

`data/manifest.js` is always required. The **series** behind it arrive one of two ways, both
byte-identical — verified step for step:

* **Seeded replay (what this folder ships).** No day-log files. The engine rebuilds all
  2016 steps from `ADEPTIO_SEED = 20260815` (mulberry32, re-seeded per series key, so output
  never depends on generation order). Every load is identical.
  `window.ADEPTIO_MODE === 'seeded replay'`, and the top-bar banner says so.
* **Materialised day logs (`data/log_day1..7.js`).** Seven files, one per mock day, each
  setting `window.ADEPTIO_LOGS.dK = { "<nodeId>.<objIndex>": {vals:[288], stat:[288]}, … }`.
  `window.ADEPTIO_MODE === 'frozen-logs'`. **This is also the live-feed contract**: publish
  that shape from a real collector and nothing else in the engine changes.

The switch is the one `ADEPTIO-LOGS-START` / `ADEPTIO-LOGS-END` marker pair near the bottom
of `index.html`. In seeded mode the seven `<script src>` tags sit **inside** that comment
(inert, and nothing 404s over `file://`); to switch modes, drop the day files into `data/`
and re-cut the comment in two so the tags fall outside it. Details in
[`data/README.md`](data/README.md).

The menus never read day logs at all: they read `data/spine.js`, which generates the same
week from the same seed as typed arrays, lazily and memoised.

## Retargeting

**Two files, and never an engine.**

| To change | Edit | Notes |
|---|---|---|
| the **front page** — topology, objectives, thresholds, incident windows | `data/manifest.js` | 16 objects × their `objs[]`, `INC`, `INCMETA`, `KPI`. Re-key `data/rcameta.js` to match if you rename anything. |
| the **menus** — journeys, services, routes, downstreams, monitors, error groups, result codes, issues, collector sources | `data/registry.js` | This is the account model. `spine.js` and `synth.js` read it and nothing else; no page hardcodes a name, a route or a count. |

`data/registry.js` is the one file a new engagement really edits: rename the journeys, swap
the 36 routes for the customer's own, point the 12 downstreams at their real partners,
re-key the monitors, and every one of the fifteen pages follows — tiles, tables, funnels,
fingerprints and lineage strings included. Keep the incident-window **keys** (`A`…`I`) or
re-point them consistently in both `manifest.js` and `registry.js`: they are the join
between the front page and the menus. The keys stay bare letters; only the way a window is
*displayed* carries the week — `WK34 · Incident B — storage creep`.

`docs/SPEC-Site-v2.0.md` §9 has the full retarget checklist, §12 the page map and §13 the
story walkthrough (where to click to see each of the nine windows, with the `#t=` deep links
and the ticket keys).

## Protected files

Two rings, both enforced by review:

**Base ring — normally byte-identical to the v1.2.1 base, never edited on a retarget:**
`assets/engine.js` · `assets/styles.css` · `assets/portal.js` · `assets/portal.css` ·
`data/manifest.js` · `data/rcameta.js` · `data/tickets.js`.
A retarget that touches `engine.js` is a retarget that has gone wrong; the divergence costs
you at the next upgrade. `index.html` and `incident-trace.html` are held to the same rule
with one exception each: the Menus launcher (inside the `SF-STRIP` span) and the nav strip
— broadened, as of v2.0.2, to the shell mount itself. `flow-instrumentation.html` picks up
that same exception in v2.0.2; see the amendment below.

> **v2.0.1 amendment.** The label-only re-mark edits display strings wherever they appear,
> including inside this ring, so **`assets/engine.js` and `index.html` are now MODIFIED
> relative to the v1.2.1 base** and the byte-identical claim no longer holds for them or for
> the other label-carrying files listed above. Nothing but printed strings and the comments
> describing them changed — no values, no seeds, no logic, no layout. `flow-instrumentation.html`
> and `assets/flow.css` were **not** touched and remain the untouched originals. Diff against
> v1.2.1 before an upgrade rather than assuming a clean base.

> **v2.0.2 amendment.** Shell adoption gives `index.html`, `flow-instrumentation.html` and
> `incident-trace.html` a mounted `PulseShell` frame; each page's legacy chrome stays in the
> markup, hidden by a page-local `<style>` rule, not deleted. `flow-instrumentation.html` —
> called out above as an untouched original — is therefore now **chrome-adopted**: its own
> `<header>` is hidden and the shell wraps it, but the ledger content inside is byte-for-byte
> what v2.0 shipped. `assets/styles.css`, `assets/flow.css`, `assets/menus.css` and
> `assets/portal.css` all remain byte-identical in v2.0.2 — every rule the adoption needed
> lives in a page-local `<style>` block instead. `index.html`'s SF-STRIP markup (what
> `build_singlefile.py` reads) and `incident-trace.html`'s portal-control ids (`#q`,
> `#createbtn`, `#themebtn`, …) are unchanged, so the single-file build and `assets/portal.js`
> both keep working exactly as before.

**Foundation — shared by every page, change only for a genuine shared defect, and say so:**
`assets/tokens.css` · `assets/shell.css` · `assets/shell.js` · `assets/menus.css` ·
`assets/charts.js` · `assets/synth.js` · `data/spine.js` · `data/registry.js`.
A page that needs a component tweak adds a small page-local `<style>` block instead — every
page that has one says why at the top of the block.

## QA

The scripts live in [`../qa`](../qa) (beside this folder) and run headless over `file://`
against Playwright + chromium already vendored in the repo:

```sh
node ../qa/linkcheck.js        # loads every page; every relative href/src must resolve
node ../qa/console_all.js      # zero console errors on every page, dark + light
node ../qa/test_synth.js       # 344 assertions on registry / spine / synth (no browser)
node ../qa/audit_gate_A.js     # cross-menu agreement: every page vs the same payloads
node ../qa/audit_gate_B.js     # per-page DOM audit + screenshots
```

`linkcheck.js` loads each page in a browser rather than parsing it, so the shell's
runtime-built nav and the launcher dropdown are checked like any other link; it also
resolves the nav model (`PULSE_SHELL.PAGES`) against the filesystem, and it understands the
`<base>` on the two scaffolding pages. Exit code is 0 on green for all five.

Per-page QA scripts (`b_*_qa.js`) and the browser binaries live one level further out, in
the repo-level `qa/` folder.

## Rebuilding the single-file variant

This folder is the source of truth; the one-file dashboard is a build product.

```sh
python3 build_singlefile.py                      # -> ../adeptio_paybill_live_dashboard.html
python3 build_singlefile.py somewhere.html       # explicit path
python3 build_singlefile.py --check out.html     # build, then verify the result
```

It inlines every `<link rel=stylesheet>` and `<script src>` verbatim, in the same order, and
leaves out two things: anything wrapped in `<!--SF-STRIP-START--> … <!--SF-STRIP-END-->`
(the cross-page chips and the Menus launcher, which would dangle in a file shipped on its
own) and the day logs (seeded replay rebuilds them). Result: **one ~192 KB file, page 1
only**, zero console errors, zero external requests.

**The menus are multi-file by design and are not bundled.** They are a site, not a widget:
fifteen pages that cross-link by relative path, share one shell and one synthesis layer, and
would have to be rewritten as a router — with every deep link changed — to live in one file.
The single-file build exists for chat / artifact / gallery contexts that can carry exactly
one file, and page 1 is the page that tells the story alone.

One known edge: `assets/engine.js` carries a single unmarked anchor to page 2 (the RCA
panel's *flow map →*). It is a protected file, so that link rides along in the bundle and
resolves only when the bundle sits beside the site. `--check` prints a note when it sees it.

Edit the site sources, never the built file, then re-run the build.

## Deep links, themes and storage

`index.html#t=<step>` seeks the timeline, clamps to `[0, 2015]`, leaves playback paused and
refreshes the tables. Step index is minutes-since-start ÷ 5, i.e.
`step = (day - 1) * 288 + (hh * 60 + mm) / 5`, where day 1 is **Mon Aug 23, 2027** and day 7
is **Sun Aug 29**. An out-of-range or malformed `#t=` is ignored.

```
index.html#t=66      Aug 23 05:30   WK34 · Incident C — OTP / SMS delivery dip             INC-1012
index.html#t=428     Aug 24 11:40   WK34 · Incident A — replica lag → false declines       INC-1018
index.html#t=684     Aug 25 09:00   WK34 · Incident E — carrier multi-path                 INC-1023
index.html#t=1368    Aug 27 18:00   WK34 · Incident B — storage-latency creep (ramp)       INC-1027
index.html#t=1394    Aug 27 20:10   WK34 · Incident F — core outage after failed failover  INC-1030
index.html#t=1614    Aug 28 14:30   WK34 · Incident G — LB pool loss (2 of 4 members)      INC-1034
index.html#t=1710    Aug 28 22:30   WK34 · Incident I — EOD batch overrun                  INC-1036
index.html#t=1812    Aug 29 07:00   WK34 · Incident H — biller-hub brownout                INC-1039
index.html#t=1944    Aug 29 18:00   WK34 · Incident D — gateway deploy regression          INC-1042
```

The window letter in the third column is the **display** form. The underlying keys are still
the bare letters `A`…`I` — that is what `INC`, `INCMETA`, `byWindow` and the
`menus/journey.html#j=paybill&w=F` hash carry. The `INC-10xx` values are ticket numbers, not
window letters.

`incident-trace.html#INC-1030` opens that case's detail overlay directly. Several menus keep
their own state in the hash too — `menus/kpi-live.html#j=paybill&p=1m&r=4h`,
`menus/journey.html#j=paybill&w=F`, `menus/dependencies.html#svc=payment`.

Theme is `html[data-theme="dark"|"light"]`, toggled in the top bar and remembered in
`localStorage`. Every storage access in the site is wrapped in `try/catch`, so private mode
or a blocked origin degrades to session-only state instead of throwing:

| key | written by |
|---|---|
| `adeptio_theme` | the theme toggle (all pages) |
| `adeptio_nav` | the left-nav collapse preference |
| `adeptio_tickets_v1` | the Incident Trace portal (guarded by a seed fingerprint) |
| `pulse_ops_v1` | Ops Issues — issue edits and new issues |
| `pulse_tracking_v1` | Error Tracking — status changes |

## All data is mock

The week is a hand-authored scenario written to demonstrate the instrument, not a
measurement of any real bank. `{BANK}` is a placeholder, every person named is fictional and
tagged `(mock)`, and every threshold is illustrative. Treat cadences and thresholds as
calibration seeds for a real engagement, not as recommendations. The footer of every page
says so, in those words.

---

## v2.0.4 — Spin: team zones + line-condition engine (front page)

Base: v2.0.2 (all other pages byte-identical; seeded week unchanged).

* **Six session zones** on the map — Z1 CUSTOMER FRONT-END · Z2 ACCESS NETWORK · Z3 API & APP SERVICES ·
  Z4 DATA & CORE BACK-END · Z5 PARTNER DELIVERY NET · Z6 BILLERS & SETTLEMENT — each banded with an
  owner chip (DEV TEAM / NETWORK TEAM / DEV + DBA / PARTNER). The chip routes the first collection
  command; hover a zone label to highlight members, click to filter Timeframe C. Registers in
  `docs/dev/R1_ZONES.md`.
* **Line-condition engine** replaces worst-of-path: each line's colour comes from evidence bound to that
  adjacency (CONN / APP / LOG classes, rules LC-01…LC-10, first match wins; grey = not covered — see
  `assets/linelogic.js`, bindings in `data/manifest.js` LINE_BIND, model in `docs/dev/R2_LINES.md`).
  One deliberately grey line: core — recon.
* **Balloons**: when a line changes into warn/crit at the cursor, evidence balloons pop at both endpoints
  with the fired rule chip; fade after 6 s; click a line for a sticky set; capped at 3 sets + "+N more".
* **Line Conditions window** (collapsible reference) and **full-width Timeframe D** (line episodes,
  newest first: o—o glyph → related errors by node → log detail → case) sit under Timeframe A/B/C.
* New files: `assets/linelogic.js`, `assets/tframes.js`, `assets/spin204.css`. Contract:
  `docs/SPEC-Spin-2.0.4.md`.
