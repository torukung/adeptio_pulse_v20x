# `data/` — two ways to get the same week

`manifest.js` is always required: topology, objectives, incident windows. The
**series** behind them arrive one of two ways, both byte-identical — verified
step for step across the whole week.

> **v2.0.1 label system.** Nothing in this folder changed shape — only the strings
> the pages print. The mock week is now stated as **WK34 of 2027, Mon Aug 23 – Sun
> Aug 29**, so timeline day 1..7 renders `Aug 23`..`Aug 29` and a stamp reads
> `Aug 25 14:05` rather than `D3 14:05`. Stamps carry **no year**; the year is
> stated once per screen in a header, as `Aug 23 – 29, 2027`. Incident windows are
> *displayed* as `WK34 · Incident B — storage creep`, but every **key** is
> untouched: `INC`, `INCMETA`, `byWindow` and the `&w=` hashes are still `A`..`I`,
> and `INC-10xx` values are ticket numbers, not window letters.

## 1 · Seeded replay (what this folder ships)

No day-log files, and no *live* `<script>` tags for them in `index.html` — the
seven tags sit **inside** the `ADEPTIO-LOGS-START` / `-END` comment, so the
browser never requests them and nothing 404s over `file://`. On boot the engine
rebuilds all 2016 steps from `ADEPTIO_SEED = 20260815` (mulberry32, re-seeded per
series key, so output never depends on generation order). Every load — and every
visitor of a hosted copy — sees the identical canonical week. Banner tag:
`· seeded replay`; `window.ADEPTIO_MODE === 'seeded replay'`.

## 2 · Materialised day logs (`log_day1..7.js`)

Seven files, one per mock day, ~183 KB each, each setting

```js
window.ADEPTIO_LOGS.dK = { "<nodeId>.<objIndex>": {vals:[288], stat:[288]}, …, "KPI": {…} }
```

which the engine stitches into the 2016-step arrays (`ADEPTIO_MODE ===
'frozen-logs'`). **This is also the live-feed contract**: publish that shape from
a real collector and nothing else in the engine changes.

Not shipped in this folder (it runs seeded) but included in the release zip. To
enable: drop the seven files in here and **re-cut the `ADEPTIO-LOGS` comment in
two** so the tags fall outside it — close the comment on the blank line after the
explanatory paragraph and re-open it on the blank line before `ADEPTIO-LOGS-END`.
That is the whole switch: one comment becomes two, the seven tags become live,
`ADEPTIO_MODE` flips to `frozen-logs`. They were dumped from the seeded
generator, so the switch changes nothing on screen. `build_singlefile.py` strips
the whole marked block in either mode.

`build_singlefile.py` never embeds them; the standalone build regenerates the week
from the seed instead (~178 KB, most of which is `rcameta.js` + `tickets.js`).

## 3 · `rcameta.js` — RCA copy, not series

Loaded right after `manifest.js`. `window.ADEPTIO_RCA` has `nodes[<id>]`
(`desc` / `page` / `systems` / `owner`) for all 16 objects and
`indicators["<nodeId>.<objective label>"]` (`checks` / `questions`) for all 61
objectives — the content of the incident panel, and the seed text for each pane's
editable "About this object". Keys mirror `manifest.js` exactly; if you retarget
the topology, re-key this file too. It is optional: without it the engine still
runs and the panel simply renders blank copy.

## 4 · `tickets.js` — Incident Trace seed, not series

`window.ADEPTIO_TICKETS` = 20 mock tickets keyed `INC-10xx` plus a `byWindow` map
from each incident window to the case that carries it. The map is keyed by the
bare letters `A`..`I` (unchanged); the portal *displays* a window as
`WK34 · Incident A`. Every date is a **timeline index**, rendered through the same
`dstamp()` as the dashboard — so `at:944` prints as `Aug 26 06:40` and a ticket can
never drift from the band that produced it; owners are reused verbatim
from `rcameta.js`. Page 3 (`incident-trace.html`) is the whole surface; page 1
reads only `byWindow` and the matched ticket's header fields, for the incident
panel's Incident Trace card. Optional on page 1 — without it that row reports no
linked case. User edits live in `localStorage["adeptio_tickets_v1"]`, never here.

## 5 · `registry.js` — the account model, not series

`window.PULSE_REG`: the account-agnostic reference model every menu page reads —
6 journeys (with their funnel steps), 12 services, 8 API groups, 36 routes, 12
downstreams, 23 synthetic monitors, 53 error groups, 43 B-/T- result codes, 25
seeded ops issues, 43 error-tracking rows, the 16 collector sources, the parser
field list, the lane names and the per-page lineage strings. It carries **no time
series at all** — only definitions, baselines and per-incident amplitudes.

This is the file a retarget edits. Rename the journeys, swap the routes, point
the downstreams at the customer's real partners: every menu follows, because no
page hardcodes a name or a count. Keep the incident-window **keys** (`A`…`I`) in
step with `manifest.js` — they are the join between the front page and the menus.
The keys stay bare letters whatever the display form is.

## 6 · `spine.js` — the seeded week for the menus

`window.PULSE_SPINE` generates the canonical 5-minute bucket per route
(`count, ok, biz_fail, tech_fail, unknown, p50/p75/p95/p99, within_T`) plus
per-downstream, per-monitor, per-error-group and per-journey series, from the
same `ADEPTIO_SEED` and the same window shapes the front-page engine uses — so
the menus and the map cannot disagree. Typed arrays, generated lazily per route
and memoised; `assets/synth.js` is the only consumer, and pages read `synth`,
never the spine.

The one deliberate hole is here too: a 90-minute collector gap on **Aug 26** (day
4 of the week) for the `bhub` node, which every page must render as `provisional` / NO DATA — never as
0 %. See `docs/SPEC-Site-v2.0.md` §4.
