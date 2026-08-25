# Adeptio Pulse — Demo Site v2.0 · Data contract

**Status:** binding for every page builder in this site.
**Scope:** `data/registry.js`, `data/spine.js`, `assets/synth.js`. The pages code against `window.PULSE_SYNTH` and nothing else.
**Base:** dashboard v1.2.1 — but see the addendum below: as of v2.0.1 `assets/engine.js` and `data/manifest.js` are **no longer byte-identical** to that base.

---

## v2.0.1 addendum — the label system

A **label-only re-mark**: display strings and the comments describing them, nothing else. No data values, no seeds, no logic, no layout, no shape changes to any payload except the additive fields listed at the end of this block.

* **The week is a calendar week.** The seeded 2016-step week is **WK34 of 2027, Mon Aug 23 – Sun Aug 29**. Timeline day 1..7 renders `Aug 23`..`Aug 29`; `dstamp(1394)` is now `"Aug 27 20:10"`.
* **No year in a stamp.** Stamps, axis ticks and column heads carry the date only. The year is stated **once per screen**, in a header or subtitle, as `Aug 23 – 29, 2027`, and only where day-level marks are actually shown.
* **Week keys unchanged.** `WK31`…`WK34` are still the keys. Anchor ranges: WK31 `Aug 2 – 8`, WK32 `Aug 9 – 15`, WK33 `Aug 16 – 22`, WK34 `Aug 23 – 29` (2027).
* **Incident windows are displayed in full**: `WK34 · Incident B — storage creep`. The compact `W34·B` form is for cells that cannot fit the full name. **Every key stays a bare letter** — `INC`, `INCMETA`, `byWindow`, `issue.incKey` and the `&w=` hashes are untouched, and `INC-10xx` values are ticket numbers, not window letters.
* **Live-synthesis frames** on the front page are **Timeframe A / B / C**, so a frame letter cannot be misread as a window letter.
* **Identifiers are not labels.** Anything that is a key, a hash or a generated id keeps its `D<n>` form — notably the funnel `session_key` (`"S-PAY-D7-167-6192"`), which is an id, not a stamp.

**Source of truth.** `data/manifest.js` publishes `ADEPTIO_DATA.WEEK`:

```js
WEEK = { wk:'WK34', year:2027,
         days:['Aug 23','Aug 24','Aug 25','Aug 26','Aug 27','Aug 28','Aug 29'],
         range:'Aug 23 – 29, 2027' }
```

Every consumer keeps its own literal fallback, so load order is unaffected.

**Additive API** (nothing removed, nothing renamed):

| new | on | is |
|---|---|---|
| `PULSE_SYNTH.dayLabel(d)` · `PULSE_SPINE.dayLabel(d)` | helpers | day index `1..7` → `"Aug 23"`… |
| `PULSE_SYNTH.week` | helper | the week key, `"WK34"` |
| `PULSE_SYNTH.incName(k)` `incDisplay(k)` `incShort(k)` | helpers | raw INCMETA name · `WK34 · Incident A — …` · `W34·A` |
| `windowDisplay` · `windowShort` | `incidentAt()`, `opsIssues()` rows, `issueDetail()`, `evidence` | the display forms beside the existing `window` / `windowLabel` / `incKey` |
| `range` | `weeklySLA().week` and the week chips | the week's anchor range, e.g. `"Aug 23 – 29"` |

Print `windowDisplay` **on its own** — it already carries the week, the word *Incident* and the letter, so never prefix it with the key again.

**Protection ring.** `assets/engine.js` and `index.html` are now **MODIFIED** relative to the v1.2.1 base, as are the other label-carrying files in that ring (`data/manifest.js`, `data/tickets.js`, `assets/portal.js`, `incident-trace.html`). `flow-instrumentation.html` and `assets/flow.css` were not touched and remain the originals.

---

## 1 · Load order

Every menu/admin page loads exactly this, in this order, as classic `<script src>` — no modules, no `fetch`, no CDN, works from `file://`:

```html
<script src="../data/manifest.js"></script>   <!-- window.ADEPTIO_DATA   (topology, INC, INCMETA) -->
<script src="../data/rcameta.js"></script>    <!-- window.ADEPTIO_RCA    (owners, checks, questions) -->
<script src="../data/tickets.js"></script>    <!-- window.ADEPTIO_TICKETS(INC-10xx, byWindow) -->
<script src="../data/registry.js"></script>   <!-- window.PULSE_REG      (the model) -->
<script src="../data/spine.js"></script>      <!-- window.PULSE_SPINE    (the seeded generator) -->
<script src="../assets/synth.js"></script>    <!-- window.PULSE_SYNTH    (the page payloads) -->
```

`admin/collectors.html` uses the same paths with `../`. `flow-instrumentation.html` (page 2) sits in the site root and loads the same six files with no prefix.

`index.html` (the front page) keeps its own v1.2.1 boot — `manifest.js` → `rcameta.js` → `tickets.js` → `engine.js` — and **must not gain any of the six**. Its only v2.0 addition is the Menus launcher: `assets/shell.css` and `assets/shell.js` inside the `SF-STRIP` span, so the single-file build drops both. `incident-trace.html` (page 3) keeps its own `portal.js`/`portal.css` boot and gains the nav strip from the same `shell.js`.

Each file throws a named error if its predecessor is missing, so a wrong order fails loudly rather than rendering zeros.

**Globals published**

| Global | From | What it is |
|---|---|---|
| `window.PULSE_REG` | registry.js | the account model — journeys, services, routes, downstreams, monitors, error groups, result codes, thresholds, people, ops issues, error-tracking rows, collector sources, lineage strings |
| `window.PULSE_SPINE` | spine.js | the seeded canonical-bucket generator (lazy, memoised, typed arrays) |
| `window.PULSE_SYNTH` | synth.js | the page payloads + format/band helpers |
| `window.PULSE_CACHE` | synth.js | the per-page payload cache (`PULSE_SYNTH.clearCache()` empties it and the spine) |

---

## 2 · Time base

Identical to the front page. **Never invent a wall clock.**

| | |
|---|---|
| `N` | 2016 steps |
| `STEP_MIN` | 5 minutes |
| `DAY` | 288 steps |
| week | Aug 23 00:00 … Aug 29 23:55 (**WK34 of 2027**, Mon–Sun) |
| `NOW` | `t = 2015` (= Aug 29 23:55) |
| finer tier | 1-minute sub-series for the last 24 h (`t` 1728…2015 → 1440 minutes) |
| hourly tier | 168 hours (error groups, result codes, journey funnels) |

`PULSE_SYNTH.dstamp(t)` → `"Aug 27 20:10"`. `PULSE_SYNTH.mstamp(minuteIndex)` → the same label at 1-minute resolution. `dayOf(t)`, `hm(t)` and `dayLabel(d)` (day index `1..7` → `"Aug 23"`…) are also exported. A stamp never carries the year; the page header states it once.

### Seeding

`data/spine.js` copies the three helpers **verbatim** from `assets/engine.js` (lines 35–37):

```js
const ADEPTIO_SEED = 20260815;
function mulberry32(a){ … }
function keySeed(key){ let h=ADEPTIO_SEED>>>0; … }
```

Every v2 series key is prefixed **`v2:`** (`v2:route:GET /v1/home`, `v2:mon:m07`, `v2:eg:eg-pa-01`, …) so no key collides with the front page's. The front-page week is bit-for-bit what it was.

Each series re-seeds from its own key, so generation order is irrelevant: a page that asks for three routes gets the same numbers as a page that asks for all thirty-six.

---

## 3 · The canonical bucket

The spine unit, per route, per 5 minutes, in typed arrays of length 2016:

| field | type | meaning |
|---|---|---|
| `count` | Float32Array | requests in the bucket |
| `ok` | Float32Array | 2xx/3xx **with no domain decline** |
| `biz_fail` | Float32Array | 4xx **plus** domain declines carried on HTTP 200 |
| `tech_fail` | Float32Array | 5xx plus timeouts and 429 (§07 rule) |
| `unknown` | Uint8Array | `0` observed · `1` collector gap · `2` route not deployed yet |
| `p50 p75 p95 p99` | Float32Array | milliseconds |
| `within_T` | Float32Array | requests under the route's `T_ms` |

Invariants the QA harness asserts: `ok + biz_fail + tech_fail === count`; `p50 ≤ p75 ≤ p95 ≤ p99`; `within_T ≤ count`.

**UNKNOWN is not zero.** A gap bucket carries `count = 0` *and* `unknown = 1`, and every aggregate excludes it from the denominator instead of averaging a zero into the result.

Latency is modelled log-normally: `sigma = ln(p95/p50)/1.6449`, and `within_T = count · Φ((ln T − ln p50)/sigma)`. During an incident the median is multiplied and `sigma` widens with it, so the tail blows out faster than the median — which is what a real degradation looks like.

### PULSE_SPINE API

```js
PULSE_SPINE.route(routeKey)        // canonical bucket, 2016 steps
PULSE_SPINE.routeMinute(routeKey)  // 1-min sub-series, 1440 steps, last 24 h
PULSE_SPINE.downstream(key)        // {calls,s5xx,s4xx,latency,unknown,dlr,codes{200,400,401,404,415,429,500,502,503}}
PULSE_SPINE.monitor(id)            // {ok:Uint8Array(0 fail|1 pass|2 no-data), rt, status}
PULSE_SPINE.errorGroup(id)         // {hourly:Float32Array(168), unknown, total, occurrences[24]}
PULSE_SPINE.resultCode(code)       // {hourly:Float32Array(168), total}
PULSE_SPINE.journeyFunnel(key)     // {steps[], sessions[step][168], unknown[168], samples[]}
PULSE_SPINE.coverage(routeKey,t0,t1)  // {covered,total,ratio}
PULSE_SPINE.pipelineHealth()       // per-source buffer_bytes / dropped_records / watermark
PULSE_SPINE.dstamp|dayOf|hm|mstamp|sevAt|diurnal|dow|shape|phi
PULSE_SPINE.mulberry32|keySeed|SEED|N|STEP_MIN|DAY|NOW|HOURS|gap|gapHours|inGap
PULSE_SPINE.stats()  PULSE_SPINE.clearCache()
```

The 1-minute sub-series is a seeded split of the 5-minute bucket into five shares: **the 5-minute totals are preserved exactly**, so the same window read at 1 m and at 5 m cannot disagree (asserted).

`downstream(key).codes` is an ordinary enumerable property but is **built on first access** (it is a pure function of `calls`, `s5xx`, `s4xx`): pages that never read the status distribution do not pay for nine extra arrays. Read it exactly as you would a plain field.

---

## 4 · Coverage, provisional and NO DATA (blueprint §07)

One rule, applied by every aggregate:

```
coverage = observed buckets / (observed + unknown)     [not-deployed buckets are out of scope]

coverage >= 0.98   -> state "ok"          no badge
coverage <  0.98   -> state "provisional" provisional badge, value still shown
coverage <  0.50   -> state "unknown"     NO DATA: the value is null, never 0%
```

`PULSE_SYNTH.covState(ratio)` → `{state, provisional, nodata, coverage}`.

Every payload that can be affected carries `coverage`, `provisional`, `state` (and `unknownBuckets`) on the tile, the row and the cell.

### The one deliberate hole

`PULSE_REG.gap`:

```js
{ node:"bhub", svc:"biller-adapter", t0:1002, t1:1019, mins:90,
  label:"Aug 26 11:30 - Aug 26 12:55",
  reason:"log shipper stopped after a disk-pressure eviction; buffer drained, watermark held" }
```

It affects the three biller-adapter routes (`GET /v1/billers`, `POST /v1/bills/inquire`, `GET /v1/topup/products`), the four biller downstream edges, the four biller-adapter monitors (bar state `nodata`), the biller-adapter error groups (unknown hours) and the Pay Bill / Top-up funnels. It shows up as:

* menu 1 — `weeklySLA().coverage.unknownBuckets = 54`, gap object attached
* menu 2 — the Aug 26 cell for `POST /v1/bills/inquire` has `coverage 0.9375, provisional true`; its group row inherits `coverage < 1`
* menu 9 — the Pay Bill card over the whole of Aug 26 is `provisional`; over a window *inside* the gap it is `state:"unknown"` with `customerPerceived: null`
* collector admin — `pipeline[bhub].gap` and a held watermark at `Aug 26 11:25`

---

## 5 · `PULSE_SYNTH` — exact signatures and return shapes

All range arguments accept **either** a name (`'1h' '4h' '12h' '24h' '48h' '7d' '14d' '30d' 'yesterday' 'wk'`) **or** an object `{t0, t1}` (used by the QA harness and by deep links). `'14d'`/`'30d'` clamp to the seeded week and set `clamped: true`.

Percentiles over a window are the **volume-weighted mean of the per-bucket percentile** — a documented approximation, stated here so no page quotes it as an exact quantile.

---

### 5.1 `range(name) -> Range`

```json
{ "key":"24h", "t0":1728, "t1":2015, "buckets":288,
  "label":"Aug 29 00:00 - Aug 29 23:55", "clamped":false, "custom":false }
```

---

### 5.2 `weeklySLA(wk) -> Weekly`   *(menu 1)*

`wk ∈ {'WK31','WK32','WK33','WK34'}`; `WK34` is the computed current week, the three others are seeded anchors.

```json
{ "week":{"key":"WK34","label":"WK34","range":"Aug 23 – 29","t0":0,"t1":2015,"current":true,
          "label_range":"Aug 23 00:00 - Aug 29 23:55"},
  "target":99.9, "criticalCount":6,
  "tiles":{
    "availability":{"value":98.46,"target":99.9,"pass":false,"band":"crit",
                    "coverage":0.999,"provisional":false,"state":"ok",
                    "source":"L1 synthetic probes (assertion in the numerator; 3 control monitors excluded)"},
    "success":{"value":99.202,"target":99.9,"pass":false,"band":"warn",
               "coverage":0.9992,"provisional":false,"state":"ok",
               "source":"L3 gateway rows: countIf(status<500)/count()"},
    "responseTime":{"value":99.624,"...":"same shape"}},
  "rows":[{ "key":"login","service":"Login","node":"auth","svc":"auth","target":99.9,
            "prevWeek":"WK33","prev":99.877,"curWeek":"WK34","cur":99.205,
            "responseTime":99.508,"delta":-0.672,"status":"warn",
            "requests":5956280,"errors":47353,
            "coverage":1,"provisional":false,"state":"ok","unknownBuckets":0,
            "trend":[{"week":"WK31","value":99.914,"current":false}, "…4 bars"] }],
  "average":{"prev":99.936,"cur":99.203,"delta":-0.733,"status":"warn","label":"Average (EW)"},
  "trend":[{"week":"WK31","label":"WK31","current":false,
            "availability":99.97,"success":99.94,"responseTime":99.71}, "…4"],
  "coverage":{"ratio":0.9992,"provisional":false,"unknownBuckets":54,"gap":{"…":"PULSE_REG.gap"}},
  "denominator":{"excludes499":true,"count429AsTechnical":true,"excludeSynthetic":true,"note":"…"},
  "csvColumns":["service","target","WK33","WK34","delta","status","coverage_pct","provisional"],
  "lineage":"L3 gateway access log: …" }
```

`rows` is **6 rows** — the six critical journeys, which is what menu 1 calls "critical services".

---

### 5.3 `drilldown(days) -> Drilldown`   *(menu 2)*

`days ∈ 1…7`, default 7.

```json
{ "days":[{"index":0,"label":"Aug 23","t0":0,"t1":287}, "…7"],
  "target":99.9, "groupCount":8, "apiCount":36, "journeyCount":6, "txnTotal":52469079,
  "groups":[{
    "key":"billpay","name":"Bill Payment","journey":"paybill","T_ms":4500,"apiCount":6,
    "cells":[{"day":3,"label":"Aug 26","c":99.94,"t":97.63,"s5xx":377,"n":586437,"p95":2174,
              "cBand":"ok","tBand":"crit","latBand":"warn",
              "coverage":0.975,"provisional":true,"state":"provisional",
              "unknownBuckets":36,"notDeployed":false}, "…one per day"],
    "totals":{"c":99.053,"t":97.389,"s5xx":40160,"n":4241018,
              "cBand":"warn","tBand":"crit","coverage":0.9965,"provisional":false,"state":"ok"},
    "apis":[{"key":"POST /v1/bills/inquire","method":"POST","path":"/v1/bills/inquire",
             "svc":"biller-adapter","T_ms":4500,"newInD":false,
             "introducedAt":null,"introducedLabel":null,
             "cells":["…same cell shape"],"totals":{"…":"same"}}]}],
  "journeys":[{
    "key":"home","name":"Home","svc":"home-bff","node":"gw","T_ms":2500,"sla":99.9,
    "groups":["home","profile","notify"],"groupCount":3,"apiCount":12,
    "routes":["GET /v1/home","…12"],
    "cells":[{"day":3,"label":"Aug 26","c":99.95,"t":100,"s5xx":2395,"n":5037611,"p95":375,
              "cBand":"ok","tBand":"ok","latBand":"ok",
              "coverage":1,"provisional":false,"state":"ok",
              "unknownBuckets":0,"notDeployed":false}, "…one per day"],
    "totals":{"c":99.204215,"t":99.970220,"s5xx":278924,"n":35050176,
              "cBand":"warn","tBand":"ok","coverage":1,"provisional":false,"state":"ok"}}],
  "legend":{"c":[…3 bands],"t":[…4 bands]},
  "notes":{"additive":true,"text":"L1 transactions and L2 hits are both computed from the same unsampled gateway rows, so unlike the reference tool the two levels ARE additive here. Group rows are recomputed from raw buckets, never averaged from the API rows, and journey subtotals are recomputed the same way over ALL routes of the journey - a journey can span several groups, so a group row is not a journey."},
  "coverage":{"gap":{…}}, "lineage":"…" }
```

`c` = success (non-5xx) %, `t` = response-time compliance %, `s5xx` = 5xx count, `n` = transactions. Group rows are recomputed from raw buckets — **never** averaged from the API rows.

#### `journeys[]` — the journey subtotal row

There are three levels in this return, not two: **journey → group → API**. A journey can span several groups — `home` covers *Home & Landing* + *Profile & Account* + *Notification & Receipts* — so a group row is **not** a journey, and picking the first group whose `journey` matches gives a number that is right for five of the six journeys and silently wrong for Home.

`journeys[]` carries one entry per `PULSE_REG.journeys` row, in registry order, with the same cell and `totals` shape as a group. Every subtotal is recomputed from the **RAW buckets of all `routes` of that journey**, with the same denominator and coverage rules as `weeklySLA` — never averaged from the group rows.

That makes the cross-menu identity exact:

```js
drilldown(7).journeys.find(j => j.key === k).totals.c
  === weeklySLA('WK34').rows[k].cur        // to within rounding, |Δ| ≤ 0.0003
```

| journey | groups | APIs | `totals.n` | `totals.c` | `weeklySLA.cur` |
|---|---|---|---|---|---|
| `login` | login | 5 | 5 956 280 | 99.204990 | 99.205 |
| `home` | home + profile + notify | 12 | 35 050 176 | 99.204215 | 99.204 |
| `paybill` | billpay | 6 | 4 241 018 | 99.053058 | 99.053 |
| `topup` | refill | 4 | 1 665 263 | 99.057987 | 99.058 |
| `package` | package | 5 | 3 317 013 | 99.319870 | 99.320 |
| `redeem` | redeem | 4 | 2 239 329 | 99.374991 | 99.375 |

`weeklySLA` rounds to 3 dp; `journeys[].totals.c` is unrounded. Both partitions of the 36 routes close on the same estate volume: `Σ journeys[].totals.n === Σ groups[].totals.n === txnTotal === 52 469 079`, which also equals `serviceHealth('7d').tiles.totalRequests`.

---

### 5.4 `kpiLive(journey, range, precision) -> Kpi`   *(menu 3)*

`journey ∈ {login,home,paybill,topup,package,redeem}` · `precision ∈ {'10s','1m','5m'}`.

```json
{ "journey":{"key":"paybill","name":"Pay Bill","svc":"payment",
             "deploy":"pulse-payment-deploy","node":"pay","T_ms":4500,"sla":99.9,"critical":true},
  "range":{…Range}, "precision":"1m", "effectivePrecision":"1m",
  "tabs":[{"key":"login","name":"Login"}, "…6"],
  "header":{"sla":99.01,"threshold":99.9,"pass":false,"band":"warn",
            "errorBudget":-0.8936,"errorBudgetBreached":true,
            "requests":565298,"errors":5617,"errorRate":0.9936,
            "businessErrors":6489,"businessRate":1.1479,
            "declineRatio":1,
            "decline":{"route":"POST /v1/bills/pay","baseline":2.1,"rate":2.1055,"ratio":1,
                       "basis":"route business rate in the window / the route's 4-week baseline (registry e4)"},
            "p75":1183,"p95":2355,"p99":3847,"rps":6.54,
            "responseCompliance":97.133,"coverage":1,"provisional":false,"state":"ok"},
  "series":{"points":1440,"labels":["Aug 29 00:00","…"],
            "errorRate":[0.0412,"…"],"p75":[…],"p99":[…],"requests":[…],
            "slaLine":0.1},
  "routes":["GET /v1/billers","…"],
  "note":"10 s precision is enabled only on journey routes in production; in this seeded demo the finest tier rendered is 1 m and the chip is labelled accordingly.",
  "lineage":"…" }
```

* `series.points` = 1440 for a 24 h window at 1 m, 288 at 5 m. `kpiLive(j,'24h','1m').header.requests === kpiLive(j,'24h','5m').header.requests` (asserted).
* 1-minute series are only available inside the last 24 h; outside it the function falls back to 5 m and says so in `effectivePrecision`.
* `errorBudget` is `sla − threshold` in percentage points; negative means BREACHED. It is computed from the **unrounded** success rate and rounded to 4 dp, while `header.sla` is rounded to 2 dp — so `errorBudget` and `sla − threshold` agree only to within ~0.005 pp. Any assertion on that identity needs a rounding tolerance (`qa/audit_gate_A.js` uses 0.011).

#### `declineRatio` — the business-decline signal, at route level

`header.businessRate` is the **journey-wide** HTTP-200 decline rate. A decline event is almost always a *route* event: in Incident A only `POST /v1/bills/pay` declines, while the other five Pay Bill routes keep their baseline mix, so the journey-wide rate is diluted by the anchor route's share of journey volume (≈ 3× where the route itself moves ≈ 7.5×; §6 has the numbers). Reading a threshold off `businessRate` therefore under-reads the incident.

`declineRatio` states the route-level figure directly:

```
declineRatio = business rate of the journey's ANCHOR route over the window
               ÷ that route's 4-week baseline business-decline rate
```

* **Anchor route** — the route the registry gives the largest incident business multiplier `bx`. `paybill → POST /v1/bills/pay` (`bx 8.5`), `topup → POST /v1/topup/purchase` (`bx 5`). A journey with no declared `bx` has no anchor: `declineRatio` and `decline` are both `null` (login, home, package, redeem).
* **4-week baseline** — the route's declared steady-state business-decline fraction `e4` in `PULSE_REG.routes` (`2.1 %` for the pay route, `1.6 %` for topup purchase). This is the trailing 4-week rate the seed was built from, so it is stable and window-independent — unlike a "previous window" baseline, which drifts with whatever else was happening before the incident.
* **Numerator** — recomputed from the same raw buckets and the same unknown-exclusion rules as everything else in this layer, so a window inside the Aug 26 gap shrinks the coverage rather than reading as 0.

`decline` carries the components — `{route, baseline, rate, ratio, basis}` — so a page can render "15.72 % vs 2.10 % baseline" rather than a bare multiplier. Sanity check: over a quiet `24h` window `kpiLive('paybill','24h').header.declineRatio === 1`.

---

### 5.5 `serviceHealth(range) -> Health`   *(menu 4)*

```json
{ "range":{…},
  "tiles":{"services":12,"totalRequests":6874424,"totalErrors":11521,"errorRate":0.1676,
           "egressCalls":523444,"egress5xx":629,
           "criticalServices":1,"alertingMonitors":3,"warnMonitors":4,"openIssues":22},
  "rows":[{ "key":"home-bff","name":"Home BFF","deploy":"pulse-home-bff-deploy",
            "node":"gw","zone":"app-zone","critical":true,"lanes":["L3","L2"],
            "requests":2625548,"errors":1426,"businessFail":12225,"errorRate":0.0543,
            "p75":213,"p95":352,"p99":501,"status":"ok","band":"ok",
            "coverage":1,"provisional":false,"state":"ok",
            "derivedFrom":null,"note":null,
            "endpoints":[{"route":"GET /v1/home","method":"GET","path":"/v1/home","group":"Home & Landing",
                          "requests":1483529,"errors":897,"errorRate":0.0605,
                          "p75":302,"p95":506,"p99":728,"status":"ok",
                          "coverage":1,"provisional":false,"state":"ok","newInD":false}],
            "errorTypes":[{"id":"eg-hb-01","cls":"redis.clients.jedis.exceptions.JedisDataException",
                           "kind":"technical","status":500,"endpoint":"GET /v1/home",
                           "count":44,"lastSeen":"Aug 29 23:55","lastSeenT":2015}],
            "recentErrors":[{"t":2013,"ts":"Aug 29 23:45","svc":"home-bff","resource":"GET /v1/home",
                             "type":"java.util.concurrent.TimeoutException",
                             "message":"Composite home tile fan-out exceeded 2500 ms budget",
                             "duration":11842,"kind":"technical"}],
            "owner":{"name":"Daw Ei Ei Khaing","team":"Platform Engineering","…":"PULSE_REG.people"} }],
  "recentErrors":[ "…20 across the whole estate, newest first" ],
  "lineage":"…" }
```

`rows.length === 12`. Two rows carry a `note` explaining their own denominator:

* **gateway** — every request crosses the deploy; the row counts only the two `/v2/` routes the gateway serves directly. Estate-wide ingress is the Total Requests tile.
* **core-adapter** — has no ingress route template, so it is measured on the **egress lane**: `requests` are outbound calls, `errors` are upstream 5xx (`derivedFrom` is set).

**The tiles are INGRESS ONLY.** `totalRequests` / `totalErrors` / `errorRate` sum only the rows with `derivedFrom === null`. An egress-derived row measures the *same* customer transaction a second time as an outbound call, so counting it in the estate tile would double-count volume and inflate the error count with upstream 5xx that ingress already recorded as one failed request. The derived row is still returned in full, and its two numbers are surfaced separately so nothing is hidden:

| tile | meaning |
|---|---|
| `totalRequests` | ingress transactions — equals `drilldown(days).txnTotal` and `Σ rows[!derivedFrom].requests` for the same window |
| `totalErrors` | ingress 5xx — equals `errorsExplorer(range).tiles.technical` and `Σ drilldown groups s5xx` |
| `errorRate` | `totalErrors / totalRequests × 100` (ingress) |
| `egressCalls` | outbound calls on the derived rows (core-adapter) |
| `egress5xx` | upstream 5xx on the derived rows |

Over `7d`: `totalRequests` **52 469 079**, `totalErrors` **418 680**, `egressCalls` **4 032 002**, `egress5xx` **32 381**.

---

### 5.6 `synthetic(range) -> Synthetic`   *(menu 5)*

```json
{ "range":{…},
  "tiles":{"monitorsUp":20,"monitorsTotal":23,"down":3,
           "uptime":86.17,"uptimeExControls":99.10,
           "avgResponse":0.67,"avgResponseMs":669,
           "totalChecks":6624,"expectedChecks":6624},
  "rows":[{ "id":"m11","name":"Bill inquiry (seeded)","method":"POST",
            "url":"https://api.example-bank.mm/v1/bills/inquire",
            "vantage":"app-zone","node":"bhub","svc":"biller-adapter","interval":5,
            "assertion":"status==200 and body.amountDue>0","control":false,
            "fails":14,"checks":288,"noData":0,"uptime":95.14,"avgRt":2070,
            "lastCheck":"Aug 29 23:55","lastCheckT":2015,"lastStatus":200,"up":true,
            "status":"up","band":"warn",
            "bars":[{"state":"full","t0":1728,"t1":1730,"uptime":100,"label":"Aug 29 00:00"}, "…96"],
            "spark":[100,100,"…36 points"] }],
  "vantages":{"dmz":{"up":5,"total":6},"app-zone":{"up":12,"total":13},"telco":{"up":3,"total":4}},
  "sortKeys":["status","name","uptime","response"],
  "notes":{"controls":"…","nodata":"…","assertion":"…"},
  "lineage":"…" }
```

* Bar states are exactly four: `full` (100 %), `part` (≥ 80 %), `bad` (< 80 %), `nodata`. Bars are downsampled to ≤ 96 per row, sparkline to ≤ 40 points.
* `tiles.uptime` **includes** the three control monitors (this is the honest all-monitor figure the reference screen shows); `tiles.uptimeExControls` is the same figure with the controls removed. The availability tile on menu 1 uses the ex-controls denominator — the two numbers are deliberately different and each page states which it is showing.
* A probe that could not run is `nodata`, excluded from the uptime denominator — never a failure.

---

### 5.7 `downstream(range, showInternal) -> Downstream`   *(menu 6)*

```json
{ "range":{…}, "showInternal":true,
  "tiles":[{ "key":"biller-hub","name":"biller-hub","host":"hub.example-biller.mm","port":443,
             "type":"external","node":"bhub","callers":["biller-adapter","payment"],
             "calls":336761,"s5xx":7608,"s4xx":3042,"s5xxRate":2.26,"s4xxRate":0.9,
             "avgLatency":1049,"band":"crit","coverage":1,"provisional":false,"state":"ok",
             "dlr":null,
             "series":{"labels":["Aug 29 05:00","…"],"calls":[…],"latency":[…]} }],
  "totals":{"calls":11635330,"s5xx":21714,"s4xx":13404,"s5xxRate":0.19,"s4xxRate":0.12},
  "statusDistribution":[{"code":"200","count":11600212,"share":99.7},
                        {"code":"500","count":8101,"share":0.07},
                        {"code":"503","count":7510,"share":0.06}, "…9 codes"],
  "topEndpoints":[{ "endpoint":"POST /hub/v2/inquire","caller":"biller-adapter",
                    "downstream":"biller-hub","downstreamName":"biller-hub","type":"external",
                    "calls":127969,"s5xx":2457,"errorRate":1.92,"avgLatency":970,"band":"crit",
                    "statusBar":[{"code":"200","count":123922,"share":96.84}],
                    "series":{"labels":[…],"calls":[…],"latency":[…]},
                    "coverage":1,"provisional":false }],
  "note":"Avg latency is the callee's own time (upstream_ms), not the total request duration; retries are counted separately …",
  "lineage":"…" }
```

`showInternal:false` removes the six internal downstreams. `topEndpoints` is capped at 30 (31 defined).

---

### 5.8 `dependencies(svc, range) -> Deps`   *(menu 7)*

```json
{ "range":{…},
  "services":[{"key":"payment","name":"Payment Orchestrator","selected":true}, "…12"],
  "card":{"key":"payment","name":"Payment Orchestrator","deploy":"pulse-payment-deploy",
          "node":"pay","zone":"app-zone","s5xxRate":0.641,
          "outboundCalls":1055056,"outbound5xx":4651,"depCount":4,"requests":416325,
          "owner":{"name":"Daw Su Myat Noe","team":"Payments Squad"}},
  "rows":[{"dependency":"db-primary","name":"db-primary","host":"pg-primary.internal.mm","port":5432,
           "type":"Internal","node":"core","calls":363232,"s5xx":217,"errorRate":0.06,
           "avgLatency":34,"band":"ok","technique":"L7","confidence":"application-layer",
           "navigable":true,"coverage":1,"provisional":false}],
  "graph":{"nodes":[ "…24: 12 services + 12 downstreams" ],
           "edges":[{"from":"notification","to":"sms-gateway","calls":271906,"errorRate":0.2,
                     "technique":"L7","confidence":"application-layer"}, "…27"]},
  "note":"Every edge carries source_technique and a confidence…",
  "lineage":"…" }
```

Row click navigates: call `dependencies(row.dependency, range)` when the dependency is itself a service key, otherwise open its downstream tile on menu 6.

---

### 5.9 `errorsExplorer(range, filters) -> Errors`   *(menu 8)*

`filters = { severity:'all'|'business'|'technical', service:<svcKey>|null, endpoint:<substring>|null, status:[ '400','500', … ] }`

```json
{ "range":{…},
  "filters":{"severity":"all","service":null,"endpoint":null,"status":[]},
  "tiles":{"total":56824,"business":45303,"technical":11521,"servicesAffected":12},
  "topServices":[{"svc":"home-bff","name":"Home BFF","count":13651,"share":24.02}, "…10"],
  "services":[{ "key":"payment","name":"Payment Orchestrator","node":"pay",
                "count":7353,"business":4685,"technical":2668,"share":12.94,
                "spark":[41,38,"…<=48 points"],
                "groupCount":9,
                "groups":[{"id":"eg-pa-02","cls":"com.adeptio.pay.InsufficientFundsException",
                           "kind":"business","count":896,"share":56.32,
                           "endpoints":["POST /v1/bills/pay"],"unknownHours":0,
                           "occurrences":[{"ts":"Aug 29 11:45","t":1869,"endpoint":"POST /v1/bills/pay",
                                           "message":"Declined B-PAY-30018: available 20977 < amount 83453",
                                           "duration":17002,"age":"12 h 10 m ago"}]}] }],
  "resultCodes":[{"code":"B-PAY-30018","type":"Business","svc":"payment",
                  "message":"Insufficient funds","http":200,"count":792,"share":14.91}],
  "statusChips":["400","401","404","429","500","502","503","504"],
  "rule":"Display split stays 4xx = business, 5xx = technical. The taxonomy engine classifies on cause: 429 is technical, a service-principal 401/403 is technical, a route-404 is technical, and an HTTP 200 carrying a domain decline is a business error present in no status-code metric at all.",
  "lineage":"…" }
```

`severity:'business'` forces `tiles.technical = 0` and drops technical groups; `service:'payment'` narrows `services` to one entry (both asserted).

---

### 5.10 `journeys(range) -> Journeys`   *(menus 9 + 10 of the spec, one screen)*

```json
{ "range":{…}, "activeUsers":23697,
  "cards":[{
    "key":"paybill","name":"Pay Bill","svc":"payment","deploy":"pulse-payment-deploy",
    "node":"pay","T_ms":4500,"sla":99.9,
    "customerPerceived":87.4,"delta":-0.04,"status":"warn",
    "lenses":{"api":98.8,"ux":87.4,"app":null},
    "lensCount":2,"lensTotal":3,
    "lensNote":"Client stability needs a self-hosted crash SDK in the app build; it is not collected here, so this card is computed from 2 of 3 lenses.",
    "p95":1978,"p99":3113,
    "requests":18743,"failedRequests":217,"businessFail":217,"technicalFail":0,
    "ack":false,"incident":null,
    "funnel":{"steps":[{"index":0,"label":"Open Pay Bill","kind":"screen","screen":"Biller list",
                        "api":null,"sessions":2202,"dropPct":0,"reachedPct":100,"biggestDrop":false},
                       {"index":3,"label":"Confirm","kind":"screen","screen":"Confirm","api":null,
                        "sessions":1981,"dropPct":6.2,"reachedPct":93.8,"biggestDrop":true}],
              "completion":87.4,"biggestDrop":{"step":"Confirm","pct":6.2}},
    "byStage":[{ "step":4,"label":"Payment posted","screen":"Processing","api":"POST /v1/bills/pay",
                 "statusBreakdown":{"200":3093,"400":51,"409":17,"500":0,"502":0,"503":0,"504":0},
                 "strict":97.91,"platform":100,"wow":-0.1,"sameHourLastWeek":98.01,
                 "prevLabel":"Aug 28 23:00 - Aug 28 23:55",
                 "p95":5222,"p99":8456,"failed":66,"total":3159,"severity":"ok",
                 "coverage":1,"provisional":false,"state":"ok",
                 "whenItFails":"The payment fails after confirm, or debits without crediting the biller." }],
    "samples":[{"hour":167,"t":2010,"session_key":"S-PAY-D7-167-6192",
                "lastStep":5,"lastStepLabel":"Receipt","ts":"Aug 29 23:30"}],
    "coverage":1,"apiCoverage":1,"uxCoverage":1,"provisional":false,"state":"ok" }],
  "comparisonWindow":{"t0":1716,"t1":1727,"label":"Aug 28 23:00 - Aug 28 23:55"},
  "comparisonNote":"The reference screen compares against the same hour 7 days ago. This spine IS one week, so the comparison is the same clock hour on the PREVIOUS DAY - label it that way on screen, never as 'last week'.",
  "severityLegend":[{"band":"ok","text":">= 95%"},
                    {"band":"warn","text":"< 95% or delta < -5pp"},
                    {"band":"crit","text":"< 80% or delta < -15pp"}],
  "model":"THREE-LENS MODEL - customer-perceived = worst lens…",
  "lineage":"…" }
```

* `cards.length === 6`, `lenses.app` is **always null** and `lensCount` is **always 2** — the "2 of 3 lenses" badge is a data fact, not a UI choice.
* `delta` and `wow` are against the same window **one day earlier**. The seeded spine is exactly one week, so a true "same hour last week" comparison has no data behind it; the payload therefore carries `comparisonWindow`, `comparisonNote` and a per-row `prevLabel`, and the page must print the real window rather than the words "last week". `sameHourLastWeek` keeps the reference screen's field name so a builder working from the screenshot finds it.
* Exactly one funnel step per card carries `biggestDrop: true`.
* When `state === "unknown"` the card returns `customerPerceived: null`, `lenses.api/ux: null`, `status: "unk"` — NO DATA, never 0 %.

---

### 5.11 `opsIssues() -> Ops` · `issueDetail(id) -> Issue`   *(menu 10)*

```json
{ "tiles":{"total":25,"open":22,"resolved":3,"overdue":8,"noPic":0,"noEta":2},
  "rows":[{ "id":"OPS-002","sev":"P1","severityLabel":"P1 CRITICAL - FIX THIS WEEK",
            "status":"resolved","title":"core-adapter - core outage cascade: 5xx storm across every journey",
            "svc":"core-adapter","route":null,"source":"ops-review","node":"core","incKey":"F",
            "windowDisplay":"WK34 · Incident F — CORE OUTAGE — cascade","windowShort":"W34·F",
            "desc":"…markdown…","decision":"…","comments":11,
            "pic":{"name":"U Soe Naing Win","team":"Core Ops","email":"soe.naing.win@example-bank.mm",
                   "initials":"SN","ext":"462","mock":true},
            "picKey":"core","cc":[],
            "created":1386,"createdLabel":"Aug 27 19:30","updated":1392,"updatedLabel":"Aug 27 20:00",
            "eta":1500,"etaLabel":"Aug 28 05:00","overdue":false,
            "evidence":{"metric":"5xx on core-adapter","lastWeek":32381,"priorWeek":21403,
                        "wow":51.3,"dailyAvg":4626,"customerImpact":8845,
                        "window":"F","windowLabel":"CORE OUTAGE — cascade",
                        "windowDisplay":"WK34 · Incident F — CORE OUTAGE — cascade","windowShort":"W34·F"},
            "ticket":"INC-1030","ticketLink":"../incident-trace.html#INC-1030",
            "flowLink":"../index.html#t=1394" }],
  "groups":[{"sev":"P1","label":"P1 CRITICAL - FIX THIS WEEK","rule":"…","count":4,"rows":[…]},
            "…P2:9, P3:8, P4:4"],
  "sources":["errors-explorer","sla-report","ops-review","synthetic","journey"],
  "statuses":["open","discussing","decided","in progress","resolved","won't fix"],
  "tabs":["Open","In progress","Resolved","Won't fix","All"],
  "note":"…", "lineage":"…" }
```

`issueDetail(id)` returns the same row plus:

```json
{ "wowSeries":[{"day":"Aug 23","cur":681,"prev":410},{"day":"Aug 24","cur":715,"prev":498}, "…7"],
  "severities":["P1","P2","P3","P4"],
  "statuses":["open","discussing","decided","in progress","resolved","won't fix"],
  "related":[{"label":"Errors Explorer - payment","href":"errors.html?service=payment"},
             {"label":"Incident Trace - INC-1030","href":"../incident-trace.html#INC-1030"},
             {"label":"Open on the flow map at this time","href":"../index.html#t=1394"}],
  "rca":{"desc":"…from data/rcameta.js…","page":"…","owner":{…}},
  "storageKey":"adeptio_ops_OPS-002",
  "lineage":"…" }
```

`issueDetail('OPS-999')` returns `null`. `storageKey` is what the page's "Save changes" must write to `localStorage`, wrapped in `try/catch`.

The `source` column never contains a vendor name — only the five values listed.

---

### 5.12 `errorTracking() -> Tracking`   *(menu 11)*

```json
{ "tiles":{"total":43,"backlog":26,"todo":5,"inprog":6,"done":6},
  "rows":[{ "rank":1,"n":1,"code":"B-PAY-30018","type":"Biz","svc":"payment",
            "svcName":"Payment Orchestrator","message":"Insufficient funds","http":200,
            "count":7203,"share":15.63,"status":"In Progress","priority":"P1",
            "progress":[2,3],"progressPct":67,
            "eta":1980,"etaLabel":"Aug 29 21:00","overdue":true,
            "sla":96.64,"slaBand":"crit",
            "pic":{"name":"Daw Su Myat Noe","…":"roster entry"},"picKey":"pay",
            "link":"INC-1018","linkHref":"../incident-trace.html#INC-1018","cmt":0 }],
  "board":{"Backlog":[…],"To Do":[…],"In Progress":[…],"Done":[…]},
  "statuses":["Backlog","To Do","In Progress","Done"],
  "views":["Table","Board"],
  "note":"http_status and error_code live in separate columns and are never merged…",
  "lineage":"…" }
```

Board columns and table rows always contain the same population (asserted). Every row has a non-zero weekly `count`.

---

### 5.13 `lineage(pageKey) -> string`

`pageKey ∈ { front, sla-weekly, sla-drilldown, kpi-live, service-health, synthetic, downstream, dependencies, errors, journey, ops-issues, error-tracking, incident-trace, collectors }`. Unknown keys fall back to `front`. Full strings in §7.

---

### 5.14 `collectorAdmin() -> Admin`   *(admin/collectors.html)*

```json
{ "tiles":{"sources":16,"live":12,"lanes":8,"probes":23,"assertions":5,
           "gapMinutes":90,"objectives":61},
  "states":["arrives","parses","computes","live"],
  "sources":[{ "node":"gw","name":"API Gateway","archetype":"Ingress API gateway",
               "lane":"L3","laneLabel":"L3 log streams",
               "secondary":["L2","L1"],"secondaryLabels":["L2 protocol polling","L1 synthetic probes"],
               "method":"JSON access log, 16 fields, one line per HTTP hop",
               "state":"live","stateIndex":3,"statePct":100,
               "cadence":"streamed - 1 min rollup",
               "prereq":"Access-log format change + a log shipper (medium)",
               "owner":{…} }],
  "probes":[{"id":"m03","name":"DNS api.example-bank.mm","method":"GET","url":"dns://…",
             "vantage":"telco","interval":5,"assertion":"answer in expected_vip_set",
             "control":false,"node":"telco","lastResult":"pass","lastRt":36,"lastStatus":200,
             "uptime7d":99.31,"noDataChecks":0}],
  "parsers":{"name":"gateway access log (JSON, one line per HTTP hop)",
             "fields":[{"f":"ts_utc_ms","t":"int64","note":"epoch millis, UTC, from the gateway clock"}, "…16"],
             "sample":"{\"ts_utc_ms\":…}"},
  "assertions":[{"id":"A1","name":"Balance equals the seeded value",
                 "target":"GET /v1/accounts/balance","node":"acct",
                 "expected":"body.balance == seeded_value","lastResult":"pass",
                 "lastRun":"Aug 29 23:55","note":"Failed 6 times inside WK34 · Incident A …"}],
  "thresholds":[{"node":"gw","nodeName":"API Gateway","objective":"Route p95","unit":"ms",
                 "base":280,"warn":500,"crit":900,"dir":"hi","pm":"http poll · logs"}],
  "pipeline":[{"node":"bhub","name":"Biller Hub - Aggregator","lane":"L3","state":"parses",
               "buffer_bytes":41000000,"dropped_records":0,
               "watermark":1001,"watermarkLabel":"Aug 26 11:25",
               "gap":{"t0":1002,"t1":1019,"mins":90,"label":"Aug 26 11:30 - Aug 26 12:55","reason":"…"}}],
  "gap":{…PULSE_REG.gap},
  "licence":{"model":"On-premise…","tiers":[{"name":"On-prem collection + synthesis","state":"ON","note":"…"},
                                            {"name":"Cloud tier","state":"OFF","note":"no data leaves the estate…"},
                                            {"name":"Metered AI credits","state":"0","note":"…"}],
             "note":"Read-only by design…"},
  "tabs":["Sources","Probes","Parsers","Assertions","Thresholds","Pipeline","Licence"],
  "lineage":"…" }
```

`thresholds` are read straight out of `data/manifest.js` (61 objectives across the 16 nodes) — the admin page proves the front page and the menus share one objective register.

---

### 5.15 Helpers

| helper | example |
|---|---|
| `dstamp(t)` `dayOf(t)` `hm(t)` `mstamp(mi)` `dayLabel(d)` | `dstamp(1394) === "Aug 27 20:10"` · `dayLabel(5) === "Aug 27"` |
| `week` `incName(k)` `incDisplay(k)` `incShort(k)` | `"WK34"` · `"storage creep"` · `"WK34 · Incident B — storage creep"` · `"W34·B"` |
| `fmtNum(n)` | `1234567 -> "1,234,567"` |
| `fmtCompact(n)` | `475700 -> "476K"`, `53500000 -> "54M"` |
| `fmtPct(x,dp=2)` | `99.8123 -> "99.81%"` |
| `fmtRate(x)` | `0.1263 -> "0.1263%"` |
| `fmtMs(ms)` | `241 -> "241ms"`, `1310 -> "1.31s"`, `92000 -> "1.5m"` |
| `fmtDelta(pp,dp=2)` | `-4.23 -> "-4.23pp"` |
| `fmtSigned(x,dp=1)` | `127.3 -> "+127.3%"` |
| `fmtBytes(b)` | `41000000 -> "41.0 MB"` |
| `fmtDur(mins)` | `90 -> "1 h 30 m"` |
| `slaBand(pct)` | `>=99.9 ok` · `>=99.0 warn` · else `crit` · `null -> unk` |
| `latBand(ms,T)` | `<=0.25T ok` · `<=T warn` · `>T crit` · `>3.33T severe` |
| `errBand(pct)` | `<0.1 ok` · `<1.0 warn` · else `crit` |
| `journeyBand(pct,deltaPP)` | `>=95 ok` · `<95 or Δ<-5pp warn` · `<80 or Δ<-15pp crit` |
| `covState(ratio)` | `{state, provisional, nodata, coverage}` |
| `PULSE_SYNTH.freshness` | `"Updated Aug 29 23:55 - seeded replay"` |
| `PULSE_SYNTH.disclaimer` | `"figures are a seeded replay of one week; not customer data"` |

Low-level escapes, exported for page-specific needs: `aggRoutes(keys,t0,t1)`, `svcAgg(svc,t0,t1)`, `routesByJourney/BySvc/ByGroup`, `allRouteKeys()`, `probeAvailability(t0,t1,svcFilter)`, `incidentAt(t0,t1)`, `clearCache()`, `timings()`.

---

## 6 · The story — expected numbers at key `t`

The nine windows are `data/manifest.js` `INC`, unchanged — this table is keyed by the bare letter, which is what `INC` / `INCMETA` / `byWindow` use; the rendered name is `WK34 · Incident <letter> — <name>`. The spine encodes each window's effect with the **same indices**, so the front page and every menu describe one week. Values below are the exact seeded output and are asserted by `qa/test_synth.js`.

| Win (key) | Indices | Peak | What the menus must show | Verified numbers |
|---|---|---|---|---|
| **C** | 54, 66, 84 | Aug 23 05:30 | OTP request stays 2xx; **verify** business-fail spikes; funnel loses users at "Enter OTP"; SMS DLR dips; `OtpDeliveryTimeout` group floods | `t=66`: `POST /v1/otp/verify` biz **26.32 %** vs **3.53 %** baseline (7.5×); `POST /v1/otp/request` tech **0.00 %**; sms-gateway DLR **72.6 %**; `eg-ot-01` hourly **29×** baseline; login funnel biggest drop = **"Enter OTP"** |
| **A** | 408, 428, 460 | Aug 24 11:40 | **HTTP 200 business declines** spike 6–8× while 5xx is flat; SLA success barely moves; menu 8 business population dominates | `t=428`: `POST /v1/bills/pay` biz **15.72 %** vs **2.105 %** baseline = **7.47×** (`header.declineRatio` **7.49×** against the registry's 2.100 % 4-week baseline — see the route-vs-journey note below the table); tech **0.19 %** vs **0.111 %** = 1.7×; window 408–460 averages **4.67×** business, **1.2×** technical; `journeys()` Pay Bill biz **1 820** vs tech **46**; errors explorer business:technical **19:1**; card **74.1 % crit** |
| **E** | 660, 684, 720 | Aug 25 09:00 | ingress latency up, some 499/408; **telco vantage degrades, app-zone/dmz stay green** | `t=684`: `GET /v1/home` p95 **1 234 ms** vs **474 ms**; probe uptime over 660–720: telco **79.2 %**, app-zone **97.5 %**, dmz **99.7 %** |
| **B** | 936, 1368, 1500 | Aug 27 18:00 | slow p95 ramp on read-heavy routes, **no errors** | `t=1368`: `GET /v1/home` p95 **998 ms** (t=936 ≈ 500 ms) with tech **0.06 %** |
| **F** | 1380, 1394, 1428 | Aug 27 20:10 | 5xx storm, every journey red, `SocketTimeoutException` flood, synthetics down except external DNS, P1 auto-raised, `INC-1030` exists | `t=1394`: journeys **Login 28.1 · Home 29.0 · Pay Bill 18.0 · Top-up 27.0 · Package 24.7 · Redeem 27.7** (all `crit`); `eg-pa-01` **212×** baseline; monitors up **5/23**, DNS (`m03`) **100 %**; service health `criticalServices` **11**; `OPS-002` → `INC-1030` → `index.html#t=1394` |
| **G** | 1602, 1614, 1638 | Aug 28 14:30 | brief availability dips, 502s at the gateway | `t=1614`: `GET /v1/home` tech **6.27 %**; dmz probes dip while app-zone holds |
| **I** | 1700, 1710, 1726 | Aug 28 22:30 | pending-age + posting p95 up, completion lag, **no 5xx** | `t=1710`: `POST /v1/bills/pay` p95 **17 653 ms** (3.5× the pre-window value) with tech **0.00 %** |
| **H** | 1788, 1812, 1848 | Aug 29 06:00 | biller-hub 5xx + timeouts on `/bills/inquire` and `/topup`, biller downstream error rate up | `t=1812`: inquire tech **18.23 %**, topup/products tech **14.11 %**; `biller-hub` 5xx rate over the window **10.9 %** |
| **D** | 1932, 1944, 1962 | Aug 29 17:00 | sharp 5xx on **two `/v2/` routes**, then "recovered"; WoW spike on the Ops Issues evidence | `t=1944`: `POST /v2/bills/pay/confirm` tech **56.44 %**, `POST /v2/topup/quote` tech **47.50 %**; at `t=2015` both **0.00 %**; legacy `POST /v1/bills/pay` **0.21 %** (unaffected); both routes `introducedAt 1908` = **Aug 29 15:00**, so day cells before Aug 29 read `notDeployed` |

**Incident A (`WK34 · Incident A`) is a ROUTE-level ratio.** The "6–8× business declines" headline is measured on `POST /v1/bills/pay`, not on the Pay Bill journey. Only that one route declines; the journey's other five routes (`GET /v1/billers`, `POST /v1/bills/inquire`, `GET /v1/bills/{id}/status`, `GET /v1/bills/history`, `POST /v2/bills/pay/confirm`) keep their baseline mix and dilute the journey-wide rate by the anchor's share of journey volume. Both figures are correct; they answer different questions, and a threshold set on the wrong one under-reads the incident by more than half.

| level | quantity | at the Incident A peak | baseline | ratio |
|---|---|---|---|---|
| **route** | `POST /v1/bills/pay` business rate, `t=428` | **15.72 %** | **2.10 %** (registry `e4`, 4-week) | **7.49×** |
| **route** | same, over `t 424–432` (the ±4 peak window the gate reads) | **16.15 %** | **2.10 %** | **7.69×** = `kpiLive('paybill',{t0:424,t1:432}).header.declineRatio` |
| **journey** | `kpiLive('paybill').header.businessRate` over `t 424–432` | **3.5986 %** | **1.1552 %** (`t 348–398`) | **3.12×** — the diluted reading |
| **route** | `POST /v1/topup/purchase` (the second anchor, `bx 5`) over `t 424–432` | **7.25 %** | **1.60 %** | **4.53×** |

Measured against the *seeded week outside the Incident A window* (**2.105 %**) rather than the registry's declared **2.100 %**, the `t=428` route figure reads **7.47×** — the number in the Incident A row above. `declineRatio` uses the registry baseline, so it reports **7.49×** for the same bucket; the 0.3 % difference is the noise the seed adds on top of `e4`. `qa/audit_gate_A.js` asserts `header.declineRatio >= 5` at the Incident A peak, which is the route-level fact; the old journey-level `>= 6×` assertion was testing the diluted number and could never hold.

**The gap.** 90 minutes on the biller-adapter node, `t 1002–1019` = **Aug 26 11:30 – Aug 26 12:55**. Menu 2's Aug 26 cell for `POST /v1/bills/inquire`: `coverage 0.9375, provisional true`. Menu 1: `coverage.unknownBuckets = 54`. Menu 9 over the whole of Aug 26: Pay Bill `provisional`; over a window inside the gap: `state "unknown"`, `customerPerceived null`.

**Week headline (WK34):** availability **98.46 %**, success **99.20 %**, response time **99.62 %** — all three FAIL against 99.90 %, which is the honest reading of a week containing a seven-hour core outage. The three prior weeks pass. Estate volume for the week is **52.5 M transactions** across 8 groups and 36 APIs.

**Now (`t = 2015`) is clean:** `GET /v1/home` technical-fail **0.05 %**, 20 of 23 monitors up (the 3 down are the permanent controls), no incident window open.

---

## 7 · Data lineage per page

Rendered verbatim in each page's footer strip by `PULSE_SYNTH.lineage(pageKey)`. No string contains a vendor product name.

| pageKey | string |
|---|---|
| `front` | L3 gateway access log (ts_utc_ms, svc, route_template, status, dur_ms) - L1 synthetic probes (probe_success, probe_duration_seconds, vantage) - L2 protocol polling (pool members, replication lag, queue depth). No APM agent, no application code change. |
| `sla-weekly` | L3 gateway access log: ts_utc_ms, svc, route_template, status, dur_ms, T_ms - L1 probe_success at hops no log can see - mapping tables service→critical, route→service. Success = countIf(status<500)/count(); response time = countIf(dur_ms<=T_ms)/count(); availability = probe ratio with the assertion in the numerator. |
| `sla-drilldown` | L3 gateway access log only: ts_utc_ms, api_group, route_template, status, dur_ms, per-group T_ms. Per (day, group, route): c = countIf(status<500)/count(), t = countIf(dur_ms<=T_ms)/count(), 5xx = countIf(status>=500), n = count(). Group rows are recomputed from raw rows, never averaged from the API rows. |
| `kpi-live` | L3 streaming aggregation at the ingress gateway plus the identity and step-up services: ts_utc_ms, svc, route_template, status, dur_ms - mapping route→journey - a written SLO per journey. Error rate = countIf(status>=500)/count(); req/s = count()/window_seconds; percentiles computed from raw rows at query time. |
| `service-health` | L3 gateway rows for RED (rate, errors, duration) + L3 application logs with multiline reassembly for ERROR TYPES and RECENT ERRORS, joined on rid. Fields: ts_utc_ms, svc, route_template, status, dur_ms, exception.type, exception.message. |
| `synthetic` | L1 only: monitor_id, ts_utc_ms, probe_success, probe_duration_seconds, probe_http_status_code, assertion_result, dns_ms/connect_ms/tls_ms/ttfb_ms, vantage in {dmz, app-zone, telco}. Uptime = countIf(probe_success AND assertion_ok)/count(); a probe that could not run is no-data, not a failure. |
| `downstream` | L3 egress forward-proxy and gateway access logs: caller_service, callee_host, callee_port, callee_type, endpoint, status, upstream_status, upstream_ms, retries, err_transport - L2 Envoy cluster counters where a proxy is in path. Avg latency is the callee's own time, not the total request duration. |
| `dependencies` | L3 choke-point logs for HTTP edges + the node registry (node_id, display name, zone, owning team, CIDR claim) + callee_actual_host from conntrack. Every edge carries source_technique in {L7, TCP, flow, probe} and a confidence; a flow-only edge shows an empty error rate, never 0.00%. |
| `errors` | L3 application logs with multiline reassembly at the first hop: exception.type, exception.root_cause_type, exception.message, error.fingerprint, culprit, top_frames, error_code (B-/T-), first_seen, last_seen, times_seen - plus L3 gateway rows for the 4xx/5xx population. Counts ship as counters when stack traces cannot. |
| `journey` | L3 gateway rows tagged route→journey for the backend lens, plus the L1 synthetic journey (per-step probe_success) for the completion lens. The client-stability lens needs a self-hosted crash SDK and is not collected here - the card shows 2 of 3 lenses and says so. |
| `ops-issues` | No collection lane: this screen reads the P4 registers (SLA engine, error taxonomy, dependency aggregator) and the P5 ticket service. Evidence numbers are recomputed from the same spine the monitoring menus use, so an issue and a chart can never disagree. |
| `error-tracking` | L3 result_code from the gateway access log and the application log (B-/T- taxonomy), joined to the P5 ticket service. http_status and error_code stay in separate columns and are never merged. |
| `incident-trace` | P5 ticket service, keyed to the incident windows in data/manifest.js through tickets.js byWindow. Every date is a timeline index into the same week, so a ticket and the band that produced it cannot drift. |
| `collectors` | The collector control plane itself: per-node lane, method and state (arrives → parses → computes → live), probe registry, parser schema, L3 assertions, thresholds from data/manifest.js, and pipeline health (buffer_bytes, dropped_records, watermark). |

---

## 8 · The model in `PULSE_REG`

| collection | count | key fields |
|---|---|---|
| `journeys` | 6 | `key, name, svc, node, critical, sla, T_ms, deploy, sessionsPerHour, steps[]` |
| `services` | 12 | `key, name, deploy, zone, node, critical, lanes[], note?` |
| `groups` | 8 | `key, name, journey, T_ms` |
| `routes` | 36 | `key, method, path, group, journey, svc, rps, p50, spread, e4, e5, T_ms, inc{}, introducedAt, newInD` |
| `downstreams` | 12 | `key, name, host, port, type, callers[], node, cpm, s5, s4, lat, dlr?, inc{}, endpoints[]` |
| `monitors` | 23 | `id, name, method, url, interval, vantage, node, svc, rt, assertion, inc{}, control` |
| `errorGroups` | 53 | `id, svc, cls, msg, endpoints[], base, inc{}, kind` |
| `resultCodes` | 43 | `code, svc, type(B/T), message, http, base, inc{}` |
| `opsIssues` | 25 | `id, sev, status, title, svc, route, source, pic, created, eta, incKey, node, desc, decision, comments` |
| `errorTracking` | 43 | `n, code, type, svc, message, status, priority, progress, eta, pic, link, cmt` |
| `sources` | 16 | `node, name, archetype, lane, secondary[], method, state, cadence, prereq` |
| `parserFields` | 16 | `f, t, note` |
| `people` | 16 | `name, team, ext, email, initials, mock:true` (verbatim from `rcameta.js` owners) |
| `weeks` | 4 | `key, label, current, availability, success, responseTime` |

`byRoute`, `bySvc`, `byJourney`, `byGroup`, `byDownstream`, `byMonitor` are pre-built lookups.

### Incident amplitudes

A route's `inc` maps an incident key from `manifest.js` `INC` to a peak effect:

```js
inc: { A:{ bx:8.5, l:1.5 },        // bx = business-fail MULTIPLIER on the baseline rate
       H:{ t:0.120, l:2.0 },       // t  = ADDITIVE technical-fail rate
       F:{ t:0.68, l:3.4, v:0.55 } // l  = latency multiplier · v = volume multiplier
     }
```

`b` (additive business rate) is also accepted. Downstreams use `s5`, `s4`, `lat`, `dlr`; monitors use a bare number (probe-failure probability at peak); error groups and result codes use a bare number (count multiplier at peak). Severity itself always comes from `sevAt(key, t)` — the same 2-element ramp / 3-element triangle inference as `engine.js`, never a per-key special case. Additive effects add; multipliers take the MAX; volume takes the MIN.

---

## 9 · How to retarget

**Edit `data/registry.js`. Nothing else.** In order:

1. **Names.** `account`, the 6 journeys, the 12 services (`name`, `deploy`, `zone`), the 12 downstreams (`name`, `host`), the 23 monitor names and URLs. Keep the `key` values or update every reference in the same file.
2. **The map join.** Each service's `node` must be a node id in `data/manifest.js`. If the customer's topology differs, retarget `manifest.js` first (its own rule: *edit the manifest, never the engine*), then repoint `node` here. Journeys and collector sources carry a `node` too.
3. **Routes.** Replace the 36 rows: `method`, `path`, `group`, `svc`, and the four baseline numbers `rps`, `p50`, `spread` (= p95/p50), `e4`/`e5` (baseline business/technical rates). Group count and API count flow through to menu 2's header automatically.
4. **Thresholds.** `thresholds.slaTarget / responseTarget / availabilityTarget`, per-journey `T_ms`, `latBands`, `errBands`, `coverage`, `severity`, `denominator`.
5. **The story.** Amplitudes live in each route's/downstream's/monitor's `inc`. To move an incident, edit `INC` in `manifest.js` — every menu follows, because nothing in the spine hardcodes an index. To add a window, add the key to `INC` + `INCMETA` and give it amplitudes here.
6. **People.** `PEOPLE` mirrors `rcameta.js` owners; keep the two in step or the PIC on an issue will disagree with the owner on the flow map.
7. **Copy.** `lineage` (the footer strings) and the seeded `opsIssues` / `errorTracking` narrative rows.
8. **The gap.** `gap.t0/t1/svc/node` — or delete it and every provisional badge disappears on its own.

Then run `node qa/test_synth.js`. Structural checks (counts, shapes, invariants, coverage rules, timing) stay valid for any account; the story assertions in section 4 of the harness are the ones that encode *this* week and are the ones to rewrite alongside a new `INC`.

**Never edit:** `assets/engine.js`, `assets/styles.css`, `assets/flow.css`, `data/manifest.js` (beyond the documented retarget), `data/rcameta.js`.

---

## 10 · Performance and memory

Two measurements, because they bracket what a browser will actually do.

**A · module context** (V8 fully optimising) — the realistic figure once the page is running:

| | |
|---|---|
| script load (6 files) | 11–12 ms |
| spine generation | 179 series in 24–30 ms |
| slowest single page, cold | 42 ms |
| all 12 pages off one cold spine | 45–80 ms |
| any page, warm (`PULSE_CACHE` hit) | < 1 ms |

**B · fresh `vm` context per page** (every global access crosses a context boundary, nothing is warmed up) — a deliberately pessimistic stand-in for a cold `file://` load, and the number the harness asserts against:

| page | cold, worst case |
|---|---|
| service-health | 291–303 ms |
| sla-weekly | 283 ms |
| journey | 268 ms |
| errors | 246 ms |
| error-tracking | 244 ms |
| sla-drilldown | 229 ms |
| ops-issues | 137 ms |
| downstream | 130 ms |
| dependencies | 118 ms |
| kpi-live | 64 ms |
| synthetic | 62 ms |
| collectors | 47 ms |

**Worst single page: ~300 ms against a 400 ms budget**, with the spine generated from scratch for that one page. A real browser sits between A and B.

Memory: typed arrays only — 36 routes × 10 arrays × 2016 floats ≈ 2.9 MB, plus ≈ 1.7 MB of 1-minute series and < 1 MB for downstreams, monitors, error groups and funnels. Well inside the 60 MB budget.

What keeps it there (each of these is load-bearing, do not undo them when editing the spine):

* generation is **lazy** — a page that touches three routes generates three route series;
* each route's incident map is **compiled once** into a flat array, and a bucket with no window open short-circuits to a shared identity object instead of allocating;
* the week's volume `SHAPE`, the three quantile multipliers and `ln(T_ms)` are **precomputed per series**, and every registry field the loop reads is hoisted into a local;
* a downstream's nine status-code arrays are built **on first access** — menus 4 and 7 never read them;
* `aggRoutes`, `svcAgg` and `recentErrorsFor` are **memoised** inside `synth.js`, and every page payload is memoised in `window.PULSE_CACHE`.

`PULSE_SYNTH.timings()` returns per-payload millisecond costs; `PULSE_SPINE.stats()` returns `{series, ms}`.

## 11 · QA

`qa/test_synth.js` loads the six scripts under a minimal `window` shim and runs **344 assertions** in eight sections: load order · registry counts and referential integrity · spine shapes, typed arrays, determinism and the gap · the story table above · every synth signature and return shape · coverage/provisional/NO-DATA · the timing budget · a browser-like worst case, in which the six scripts are executed in a fresh `vm` context with **only a `window` global** (no `require`, `module`, `process` or `Buffer`) and each page is timed with the spine generated from scratch.

```
node qa/test_synth.js            # ALL GREEN - 344 checks passed
node qa/test_synth.js --verbose  # prints every check with its measured value
```

Exit code is 0 on green, 1 on any failure. It also asserts that no string anywhere in `PULSE_REG` or in any lineage string names a monitoring vendor.

---

## 12 · Page map

Harvested from the pages themselves (`qa/linkcheck.js` walks the same list). Every page is markup + boot only: it renders one synth payload, adds nothing to it, and wears the shell from `assets/shell.js`.

| file | pageKey | synth calls | interactions | implements |
|---|---|---|---|---|
| `index.html` | `front` | *none* — its own v1.2.1 engine off `manifest.js` | map pan/zoom, node panes, RCA panel, timeline scrub + replay, `#t=` deep link, Menus launcher | dashboard v1.2.1 page 1 |
| `flow-instrumentation.html` | `front` (lineage) | `journeys('7d')` | journey chips, object filter chips, register search, expandable check rows, expandable fingerprint rows, flow-map + ticket links | dashboard v1.2.1 page 2 — the instrument itself (blueprint §05 lanes, §07 spine) |
| `incident-trace.html` | `incident-trace` | *none* — `portal.js` off `tickets.js` | board / list toggle, drag-to-transition, quick-filter chips, search, detail overlay, create, `#INC-10xx` deep link, `localStorage` | dashboard v1.2.1 page 3 |
| `menus/sla-weekly.html` | `sla-weekly` | `weeklySLA(wk)` · `drilldown(7)` · `probeAvailability` · `incidentAt` | week chips WK31–WK34, metric tabs (success / response time / availability), expandable service rows, Copy + CSV, flow-map + ticket links | `sources/04_rId9.jpg` |
| `menus/sla-drilldown.html` | `sla-drilldown` | `drilldown(days)` · `range` · `aggRoutes` · `allRouteKeys` | 7d/14d/30d chips, expand all / collapse all, per-group expand, search, flow-map + ticket links | `sources/05_rId10.jpg` |
| `menus/kpi-live.html` | `kpi-live` | `kpiLive(journey, range, precision)` · `aggRoutes` · `incidentAt` | journey tabs, range chips, precision chips (10s/1m/5m), sortable route table, `#hash` state, flow-map + ticket links | `sources/06_rId11.jpg` |
| `menus/service-health.html` | `service-health` | `serviceHealth(range)` · `incidentAt` | range chips incl. Yesterday, scorecard search, sort, expandable service → endpoints / error types / recent errors, flow-map + ticket links | `sources/07_rId12.jpg` + `08_rId13.jpg` |
| `menus/synthetic.html` | `synthetic` | `synthetic(range)` | 24h/48h/7/14/30d chips, sort chips (status / name / uptime / response), filter box, expandable monitor rows, uptime bars + sparklines, vantage strip | `sources/09_rId14.jpg` |
| `menus/downstream.html` | `downstream` | `downstream(range, showInternal)` | range chips, "show internal services" toggle, endpoint search + sort, expandable endpoint → status bar + calls/latency chart | `sources/10_rId15.jpg` |
| `menus/dependencies.html` | `dependencies` | `dependencies(svc, range)` · `incidentAt` | 12 service chips, range chips, expandable dependency rows, caller→callee graph strip, `#hash` state, flow-map + ticket links | `sources/11_rId16.jpg` |
| `menus/errors.html` | `errors` | `errorsExplorer(range, filters)` | range chips, severity / service / endpoint / status filters, top-service bars, expandable service → exception group → occurrences, result-code table | `sources/12_rId17.jpg` |
| `menus/journey.html` | `journey` | `journeys(range)` | range chips, six journey cards (click to inspect), funnel, by-stage breakdown, `#hash` state, flow-map + ticket links | `sources/13_rId18.jpg` + `14_rId19.jpg` |
| `menus/ops-issues.html` | `ops-issues` | `opsIssues()` · `issueDetail(id)` | status tabs, severity / source / raised filters, search, sort, "+ New Issue", detail overlay with Save to `localStorage` (`pulse_ops_v1`), ticket links | `sources/15_rId20.jpg` + `17_rId22.jpg` |
| `menus/error-tracking.html` | `error-tracking` | `errorTracking()` · `range` | Table / Board toggle, status selects persisted to `localStorage` (`pulse_tracking_v1`), search, sort, Export CSV, flow-map links | `sources/16_rId21.jpg` |
| `admin/collectors.html` | `collectors` | `collectorAdmin()` · `serviceHealth` · `synthetic` | tabs (sources / probes / parsers / assertions / thresholds / pipeline / licence), expandable source rows, search, editable thresholds (in memory), flow-map + ticket links | no spec screen — built from the blueprint §13 sources register |
| `docs/dev/_kit.html` | — | *none* (dummy data) | every shared component, for layout QA | scaffolding, not shipped |
| `docs/dev/_template.html` | — | *none* | the skeleton a page is copied from | scaffolding, not shipped |

Two pages take their footer lineage from the payload (`k.lineage`, `d.lineage`) rather than calling `PULSE_SYNTH.lineage(key)` directly; the string is the same one, out of the §7 table.

`flow-instrumentation.html` is the only page whose figures are *definitions* rather than measurements: the 16 objects, 61 objectives, thresholds and the nine window shapes come from `data/manifest.js`, the first checks and owners from `data/rcameta.js`, the lanes from `PULSE_REG.sources`. Its only measured numbers — customer-perceived %, p95, failed requests, sessions per step — are read from `PULSE_SYNTH.journeys('7d')`, the same payload `menus/journey.html` renders, so the two pages cannot disagree.

---

## 13 · Story walkthrough

One seeded week, nine windows, thirteen screens. Every window below is reachable in three clicks or fewer, and every row that mentions one carries the same two links: **the flow map at the peak** (`index.html#t=<peak>`) and **the case** (`incident-trace.html#<KEY>`).

**Read the range chips first.** "Now" is `t = 2015` (Aug 29 23:55) and every menu range is measured backwards from it: `1h` reaches t 2004, `4h` 1968, `12h` 1872, `24h` 1728, `Yesterday` is Aug 28 (1440–1727), and only `7d` / `WK34` covers the whole week. A window earlier than Aug 28 is visible **only** on the 7-day ranges — that is not a bug, it is the range doing its job.

| # | Window | Peak | `#t=` | Case | Front page | Where it is legible in the menus |
|---|---|---|---|---|---|---|
| 1 | **WK34 · Incident C** — OTP delivery dip (warn) | Aug 23 05:30 | `index.html#t=66` | `INC-1012` | at Aug 23 05:30: `otp` + `smsgw` red, `auth` amber, the other 13 green | **Customer Journey** (7d) Login card → funnel drop at *Enter OTP* · **Downstream Health** (—) sms-gateway DLR rate · **Errors Explorer** (7d) `OtpDeliveryTimeout` |
| 2 | **WK34 · Incident A** — replica-lag false declines (crit) | Aug 24 11:40 | `index.html#t=428` | `INC-1018` | `pay` + `acct` + `dbr` red while `gw`, `edge` and `telco` stay green — the silent-failure signature | **Errors Explorer** (7d) business (4xx/decline) tile rises ~6–8×, technical flat · **Customer Journey** Pay Bill business-fail · **SLA Weekly** WK34 success barely moves while the outcome assertion fails |
| 3 | **WK34 · Incident E** — carrier multi-path (warn) | Aug 25 09:00 | `index.html#t=684` | `INC-1023` | `smsgw` red with `telco`, `client` and `auth` amber — two symptoms, one root | **Synthetic Insight** (7d) telco-vantage monitors degrade, dmz stays green · **KPI Live** Login p95 rises · **Downstream Health** sms-gateway latency |
| 4 | **WK34 · Incident B** — storage creep (warn, ramp) | Aug 27 18:00 | `index.html#t=1368` | `INC-1027` | no red at all: `dbr` and `core` amber only, the ramp climbing since Aug 26 06:00 | **Service Health** (7d) read-heavy routes' p95 ramp with no errors · **SLA Drill-down** the `t` line falling day by day · **Dependencies** db-replica latency |
| 5 | **WK34 · Incident F** — CORE OUTAGE — cascade (crit) | Aug 27 20:10 | `index.html#t=1394` | `INC-1030` | 10 critical / 2 degraded / 4 OK at the peak; `telco`, `edge` and `smsgw` stay green — and `dbr`'s amber is the Incident B ramp, not Incident F. That is the isolation | **Service Health** 5xx storm · **Errors Explorer** `SocketTimeoutException` flood · **Synthetic Insight** everything down except the external DNS control · **Ops Issues** the P1 · **Customer Journey** every journey red |
| 6 | **WK34 · Incident G** — LB pool loss (warn) | Aug 28 14:30 | `index.html#t=1614` | `INC-1034` | `edge` red alone, all 15 other objects green — 2 of 4 pool members | **Synthetic Insight** (Yesterday) availability dips · **Service Health** gateway 502s |
| 7 | **WK34 · Incident I** — EOD batch overrun (warn) | Aug 28 22:30 | `index.html#t=1710` | `INC-1036` | `core` red on the batch-overrun objective, `bbatch` amber, no 5xx anywhere | **KPI Live** (Yesterday) Pay Bill posting p95 · **Customer Journey** completion lag with a clean error rate |
| 8 | **WK34 · Incident H** — aggregator brownout (warn) | Aug 29 07:00 | `index.html#t=1812` | `INC-1039` | `pay` + `bhub` red, `biller`, `bbatch`, `recon` amber — the money-movement tail | **Downstream Health** (24h) biller-hub 5xx + timeouts on `/bills/inquire` · **Dependencies** biller-adapter → biller-hub · **Error Tracking** the `T-COR` / `B-PAY` rows |
| 9 | **WK34 · Incident D** — gateway deploy regression (warn) | Aug 29 18:00 | `index.html#t=1944` | `INC-1042` | `gw` red with `client` + `pay` amber, sharp and recent — reads as *Recovered* at now | **Errors Explorer** (12h) the two `/v2/` routes, then recovered · **Ops Issues** the WoW evidence on the P2 · **SLA Drill-down** the `/v2/` rows on Aug 29 |

**The two-minute tour.** Front page (`index.html`) → *Menus ▸* → **Customer Journey**, set `7d`, click Pay Bill → the card names `WK34 · Incident A` and links to `INC-1018` → *Open on the flow map at Aug 24 11:40* lands back on the front page at `#t=428` with playback paused → the node pane's **Incident Trace ▸** row opens the same case → *view on dashboard* returns. That loop is the argument the site makes: one spine, one week, one story, no APM.

**Where the collectors are.** `admin/collectors.html` is the other half: the same 16 objects seen from the pipeline side (lane, method, state `arrives → parses → computes → live`, buffer bytes, watermark). The deliberate 90-minute gap on Aug 26 for the `bhub` node shows there as a watermark hole and on menus 1 / 2 / 9 as a `provisional` badge and a NO DATA cell — never as 0 %.

**Page 2 is the legend for all of it.** `flow-instrumentation.html` §04 lists the nine fingerprints in week order with, for each, the checks that go red together, the objects that stay quiet at the same minutes (the isolation that names the layer), the case it is routed to, and both deep links.
