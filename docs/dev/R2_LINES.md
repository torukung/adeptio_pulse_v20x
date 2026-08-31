# R2 · LINE CONDITION ENGINE — Adeptio Pulse "Spin 2.0.4"

**Status:** decisive model, implementable as-is. Feeds directly into the build SPEC.
**Scope:** the 17 monitored relationships on the map — their evidence bindings, condition
rules, per-step episode model, pop-on-change balloons, the Line Conditions reference
window, the new Timeframe D window, and replacement legend copy.

**Design law honoured throughout:** edges are MONITORED RELATIONSHIPS. No arrowheads,
no animation, no width-encodes-volume. A line's colour comes from evidence BOUND to that
adjacency. Four states: `ok` / `warn` / `crit` / `grey` (not-covered). Grey ≠ ok.

**Two v2.0.2 behaviours this model deletes** (both currently in `assets/engine.js`):

| line | current code | verdict |
|---|---|---|
| 151 | `linkStatus(L,t){ return worse(nodeStatus(a,t), nodeStatus(b,t)); }` | the worst-of-path lie. Replaced wholesale by §2. |
| 158 | `stroke-width', s==='ok' ? 2+L[2]/28 : …` | width encodes `LINKS[n][2]` (nominal weight = volume). **Banned.** Uniform 2.4px ok / 3.2px warn / 3.6px crit / 2px grey-dashed. |
| 158 | `L.el.classList.toggle('flow', s!=='ok')` | class name is a banned word on this surface. Rename `.flow` → `.lc-live`. |

`LINKS[n][2]` stays in the manifest (other modules read it) but the map must never
paint with it.

---

## §0 · EVIDENCE CLASS TAXONOMY

Three classes. Every bound objective belongs to exactly **one** class **per link**.

| chip | class | what it is | what it licenses |
|---|---|---|---|
| **CONN** | Connectivity | transport reachability **between A and B** — resolve/connect/handshake/loss, LB pool membership, connection-pool health toward the peer, timeout rate measured *toward* the peer, file-transport freshness | Evidence about the **relationship itself**. Sufficient alone to escalate the line. |
| **APP** | Application health | availability + latency/saturation objectives on **one endpoint** | Evidence about a **node**. Needs corroboration from the other end (or from CONN) to escalate past `warn`. |
| **LOG** | App-log error signal | error-rate, failure-count, decline/assert/DLQ/exception objectives on **one endpoint** | Same as APP. Needs corroboration. |

### The two binding laws

**BL-1 — No self-correlation.** An objective may serve **at most one class on a given
link**. Without this, `smsgw · Availability` could count as both CONN and APP-B and a
single metric would "corroborate itself" into a CRIT. (It is legal for one objective to
serve *different* links — `edge · TLS termination p95` is CONN on E02 and unbound on E03.)

**BL-2 — CONN is about the pair, APP/LOG are about a node.** This asymmetry is the whole
model. It is why a red node does not make a red line, and why a single critical CONN
objective *does*. Proof obligation T5 in the truth table enforces it.

---

## §1 · EVIDENCE BINDING TABLE — all 17 links

Node ids and objective labels below are **verbatim from `data/manifest.js`**. Nothing is
invented. Empty cells are load-bearing information and render as `—` in the UI.

`A` and `B` are the endpoints in `LINKS` order (`[from, to, weight]`).

| # | Link (A — B) | **CONN** | **APP-A** | **APP-B** | **LOG-A** | **LOG-B** |
|---|---|---|---|---|---|---|
| **E01** | client — telco | `telco·TCP connect p95`<br>`telco·Packet loss`<br>`telco·DNS resolve` | `client·Journey success`<br>`client·Crash-free sessions` | — | `client·Review error signal` | — |
| **E02** | telco — edge | `telco·TLS handshake p95`<br>`edge·TLS termination p95` | — | `edge·Availability` | — | — |
| **E03** | edge — gw | `edge·Pool members up` | `edge·Availability` | `gw·Availability`<br>`gw·Route p95` | — | `gw·5xx rate` |
| **E04** | gw — auth | — | `gw·Availability`<br>`gw·Route p95`<br>`gw·Worker saturation` | `auth·Availability`<br>`auth·Auth p95`<br>`auth·Login synthetic` | `gw·5xx rate` | `auth·Token refresh fail` |
| **E05** | auth — otp | — | `auth·Availability`<br>`auth·Auth p95`<br>`auth·Login synthetic` | `otp·Availability`<br>`otp·OTP issue p95` | `auth·Token refresh fail` | `otp·Challenge→verify success` |
| **E06** | otp — smsgw | `smsgw·Availability` (SMPP bind)<br>`smsgw·Time-to-deliver p90` | `otp·Availability`<br>`otp·OTP issue p95` | — | `otp·Challenge→verify success` | `smsgw·DLR rate (worst carrier)` |
| **E07** | gw — pay | — | `gw·Availability`<br>`gw·Route p95`<br>`gw·Worker saturation` | `pay·Availability`<br>`pay·Orchestration p95` | `gw·5xx rate` | `pay·Technical decline`<br>`pay·Decline anomaly (10m sust.)` |
| **E08** | pay — acct | — | `pay·Availability`<br>`pay·Orchestration p95` | `acct·Availability`<br>`acct·Read p95` | `pay·Decline anomaly (10m sust.)`<br>`pay·Technical decline` | `acct·Stale-read assert fails` |
| **E09** | acct — dbr | `acct·Conn pool` | `acct·Availability`<br>`acct·Read p95` | `dbr·Availability`<br>`dbr·Replication lag`<br>`dbr·Query p95` | `acct·Stale-read assert fails` | — |
| **E10** | pay — core | — | `pay·Availability`<br>`pay·Orchestration p95` | `core·Availability`<br>`core·Posting p95`<br>`core·Pending-age p95` | `pay·Technical decline`<br>`pay·Decline anomaly (10m sust.)` | `core·Batch overrun` |
| **E11** | pay — bhub | — | `pay·Availability`<br>`pay·Orchestration p95` | `bhub·Availability`<br>`bhub·Inquiry p95` | `pay·Technical decline` | `bhub·Adapter error` |
| **E12** | core — bhub | — | `core·Availability`<br>`core·Posting p95` | `bhub·Availability`<br>`bhub·Inquiry p95` | `core·Batch overrun` | `bhub·Adapter error` |
| **E13** | core — mq | — | `core·Availability`<br>`core·Pending-age p95` | `mq·Availability`<br>`mq·Oldest message age`<br>`mq·Notif delivery` | `core·Batch overrun` | `mq·DLQ depth` |
| **E14** | **core — recon** | **—** | **—** | **—** | **—** | **—** |
| **E15** | bhub — biller | `bhub·Biller timeout` | `bhub·Availability`<br>`bhub·Inquiry p95` | `biller·Availability`<br>`biller·Top-up value delivery` | `bhub·Adapter error` | `biller·Credit-leg success (worst biller)`<br>`biller·Debits awaiting credit` |
| **E16** | bhub — bbatch | `bbatch·Advice-file age` **[batch-fed]** | `bhub·Availability`<br>`bhub·Inquiry p95` | `bbatch·Cut-off buffer`<br>`bbatch·Confirmation lag` | `bhub·Adapter error` | `bbatch·Retry queue` |
| **E17** | bhub — recon | — | `bhub·Availability`<br>`bhub·Inquiry p95` | `recon·Availability`<br>`recon·Match rate` | `bhub·Adapter error` | `recon·Exceptions open`<br>`recon·Unmatched value` |

### What the empty cells say — declare these in the UI, do not hide them

- **10 of 17 relationships have NO connectivity evidence** (E04, E05, E07, E08, E10, E11,
  E12, E13, E14, E17). The manifest simply contains no network-class objective for those
  adjacencies. Consequence: those lines can **never** be escalated to CRIT by
  connectivity, only by both-ended endpoint corroboration (LC-06). The Line Conditions
  window states this; the balloon shows `CONN —` rather than a green CONN chip.
- **`telco` has no APP and no LOG evidence at all.** All four of its objectives are
  transport-class and are bound as CONN. E01's B-side and E02's A-side are therefore
  empty. This is correct: a DNS/TLS transit object has nothing to say about application
  health.
- **`edge` has no LOG evidence.** No error-rate objective exists on the perimeter node.
- **`dbr` has no LOG evidence.** `Disk IO latency` is infrastructure latency (APP), not
  an error signal.
- **`edge · Cert days-to-expiry`** (`amp:0`, `inc:null`) is a **declared-only static
  attribute** — it can never move and can never carry evidence of a live fault. It is
  deliberately **not bound to any link**, so a cert check can never paint a line green.

### The GREY exemplar: **E14 · core — recon**

`core` is collected by `heartbeat txn · file feed` and `recon` by `sftp · file check`, and
recon's whole purpose is a **T+1 three-way match** — so no objective on either side can be
honestly correlated with the other inside a single 5-minute step, and there is no shared
transport probe between them. Binding anything here would fabricate a same-step
relationship that the collectors cannot observe, so E14 is bound to nothing, paints GREY
for all 2016 steps, and becomes the one line on the map that proves grey means
"not covered" rather than "fine".

(E17 `bhub — recon` is *not* grey: `bhub·Adapter error` and `recon·Exceptions open` are
both live 5-minute pollers, so that adjacency is legitimately observable.)

---

## §2 · CONDITION RULES LC-01 … LC-10

Ordered. **First match wins.** LC-10 is unconditional, so the ruleset is total by
construction.

### Inputs, per link, per step `t`

```
conn , appA , appB , logA , logB   ∈ { ok, warn, crit, none }
```
Each is the **worst** `o.stat[t]` across the objectives bound to that cell in §1, or
`none` when the cell is empty. Plus one static per-link flag:
```
connBatch  ∈ { false, true }   true only where the CONN binding is file/batch-collected
                                (node.pm contains 'file' or 'sftp') — E16 only
```

Helpers:
```
bad(x)        ⇔ x === 'warn' || x === 'crit'          // 'none' is NOT bad
sideBad(X)    ⇔ bad(appX) || bad(logX)
sideCrit(X)   ⇔ appX === 'crit' || logX === 'crit'
anyBound      ⇔ any of the five ≠ 'none'
```

### The rules

| id | plain English (NOC copy — this is the exact string shown in §5) | boolean | → state |
|---|---|---|---|
| **LC-01** | No evidence is bound to this relationship. Pulse is not watching it. | `!anyBound` | **GREY** |
| **LC-02** | Connectivity here is collected from a batch file, so the two ends cannot be corroborated inside one 5-minute step. Capped at Degraded. | `connBatch && (bad(conn) \|\| sideBad(A) \|\| sideBad(B))` | **WARN** |
| **LC-03** | Connectivity between the two objects is critical AND both objects report errors in the same 5-minute step. | `conn==='crit' && sideBad(A) && sideBad(B)` | **CRIT** |
| **LC-04** | Connectivity between the two objects is critical. | `conn==='crit'` | **CRIT** |
| **LC-05** | Connectivity is degraded AND both objects report errors in the same 5-minute step. | `conn==='warn' && sideBad(A) && sideBad(B)` | **CRIT** |
| **LC-06** | Both objects report critical application health or app-log errors in the same 5-minute step. | `sideCrit(A) && sideCrit(B)` | **CRIT** |
| **LC-07** | Connectivity between the two objects is degraded. | `conn==='warn'` | **WARN** |
| **LC-08** | Both objects report degraded health or errors in the same 5-minute step; connectivity is clean or not bound. | `sideBad(A) && sideBad(B)` | **WARN** |
| **LC-09** | Only one object reports a problem. The other object and the connectivity between them are clean. Not escalated on one object's colour. | `sideBad(A) !== sideBad(B)` | **WARN** |
| **LC-10** | All bound evidence is clean at this step. | *(unconditional)* | **OK** |

### Reading the design into the rules

- **LC-01 is the honesty rule.** Grey is a first-class state, evaluated before everything.
- **LC-04 is the only single-class escalation to CRIT**, and it is legal *only* because
  CONN evidence is bound to the adjacency itself (BL-2). This is exactly what the truth
  table's T5 obligation encodes.
- **LC-09 is the anti-worst-of-path rule.** It is what stops `edge — gw` going red during
  the core outage just because the gateway is red. Note it caps at WARN **even when the
  reporting side is CRIT** — one red node is never a red line.
- **LC-05 is the product owner's stated case**: degraded connectivity + errors on both
  sides ⇒ CRIT. Escalation requires the conditions to be *in sync* — same step, both ends.
- **LC-02 is the declared-only / batch-fed guard.** The seeded week never drives E16 to
  CRIT on its own, so this rule changes no outcome in the demo; it exists so a
  once-per-cycle SFTP file-age check can never assert a 5-minute correlation its collector
  is incapable of making. Keep it, and say so in the window rather than pretending it fires.

### Totality proof — RUN, PASSING

Script: `/home/claude/pulse204/research/lc_truthtable.py` (enumerates all 4⁵ × 2 = 2048
input states).

```
LC RULESET TOTALITY PROOF  ·  Adeptio Pulse Spin 2.0.4
--------------------------------------------------------------
states enumerated : 2048   (4^5 sev combos x 2 connBatch)
states resolved   : 2048
rule coverage     :
   LC-01      2 states
   LC-02    992 states
   LC-03    144 states
   LC-04    112 states
   LC-05    144 states
   LC-06     98 states
   LC-07    112 states
   LC-08    190 states
   LC-09    192 states
   LC-10     62 states
unreachable rules : none — every rule is reachable
--------------------------------------------------------------
T1 exhaustive (every state resolves)                 PASS
T2 state domain {ok,warn,crit,grey}                  PASS
T3 anti worst-of-path (one-sided never CRIT)         PASS
T4 GREY iff nothing bound                            PASS
T5 CRIT = connectivity, or >=2 endpoint classes      PASS
--------------------------------------------------------------
RESULT: ruleset is TOTAL, DETERMINISTIC and HONEST.
```

The four invariants beyond totality are the ones worth keeping in CI:

- **T3** — if connectivity is clean-or-unbound and only one side is bad, the verdict is
  never CRIT. This is the regression test against reintroducing worst-of-path.
- **T4** — GREY appears if and only if nothing is bound. Grey can never leak in as a
  "we're not sure" colour.
- **T5** — a CRIT is either carried by adjacency-bound connectivity, or cites at least two
  independent endpoint evidence classes. (This check *failed* on the first draft and forced
  BL-2 to be stated explicitly; the failure is the reason LC-04 is defensible.)

---

## §3 · EPISODE MODEL

Lines get per-step state exactly like objectives do: `L.lineStat[t]` for `t = 0…2015`,
plus `L.eps[]` in the same shape the renderer already consumes for `o.eps`.

### Precompute pass — reuses `worse()` (engine.js:75) and mirrors `episodes()` (engine.js:121)

```js
/* run once at boot, right after the NODES.forEach hydration loop (engine.js:110) */
const EV_NONE = 'none';
function evWorst(refs, t){                       // refs = [[nodeId, objLabel], …]
  if(!refs.length) return EV_NONE;
  let s = 'ok';
  for(const [nid,lab] of refs){
    const o = byId(nid).objs.find(x => x.label === lab);
    s = worse(s, o.stat[t]);                     // reuse engine's rank table
  }
  return s;
}
LINKS.forEach(L => {
  const B = LINE_BIND[L.id];                     // §1 table, static
  L.lineStat = new Array(N);
  L.lineRule = new Array(N);                     // rule id per step, for the chip
  for(let t = 0; t < N; t++){
    const ev = { conn: evWorst(B.conn,t),
                 appA: evWorst(B.appA,t), appB: evWorst(B.appB,t),
                 logA: evWorst(B.logA,t), logB: evWorst(B.logB,t) };
    const r = lineRule(ev, B.connBatch);         // §2, first-match-wins
    L.lineStat[t] = r.state; L.lineRule[t] = r.id;
  }
  /* episode = maximal run of non-ok AND non-grey. Grey is a coverage fact,
     not an event: a grey line must never generate rows in Timeframe D. */
  L.eps = []; let s = null;
  for(let t = 0; t < N; t++){
    const st = L.lineStat[t];
    if(st === 'warn' || st === 'crit'){
      if(!s){ s = {start:t, end:t, worst:st, ruleId:L.lineRule[t]}; }
      else { s.end = t; if(worse(s.worst,st) === st && st !== s.worst){ s.worst = st; s.ruleId = L.lineRule[t]; } }
    } else if(s){ L.eps.push(seal(L,s)); s = null; }
  }
  if(s) L.eps.push(seal(L,s));
});
```

`seal()` attaches the **contributing evidence set** — the objectives that were non-ok at
the episode's worst step, which is what Timeframe D col-group 2/3 and the balloons render:

```js
function seal(L,s){
  const B = LINE_BIND[L.id], tw = argWorstStep(L,s);   // first step at s.worst
  s.contrib = [];                                      // [{side,nid,label,sev,val,cls}]
  for(const cls of ['conn','appA','appB','logA','logB'])
    for(const [nid,lab] of B[cls]){
      const o = byId(nid).objs.find(x=>x.label===lab);
      if(o.stat[tw] !== 'ok')
        s.contrib.push({cls, nid, label:lab, sev:o.stat[tw], val:o.vals[tw], peakStep:tw,
                        thr: o.stat[tw]==='crit'?o.crit:o.warn, dir:o.dir,
                        objEpStart:(o.eps.find(e=>e.start<=tw&&e.end>=tw)||{}).start,
                        inc: incKeyAt(o, tw)});         // reuse traceTicket()'s window pick
    }
  s.worstStep = tw; return s;
}
```

`incKeyAt()` is the existing window-selection logic already written inside `traceTicket()`
(engine.js:471–481) — lift it to a shared helper rather than duplicating it. It yields the
`"WK34 · Incident A — replica-lag false declines"` string via the existing `incName(k)`.

### Compute cost — trivial, confirmed

17 links × 2016 steps = **34 272 rule evaluations**, each reading at most 11 bound
objectives (max cell width 3, five cells). Worst case ≈ 3.8 × 10⁵ array lookups, one time,
at boot — comparable to a single `windowScan()` at the 7d window, which the existing code
already runs on every table render. Measured in the Python replication the whole pass is
sub-millisecond-class work in JS. **Precompute once at boot; never recompute in `paint()`.**
`paint()` reads `L.lineStat[cur]` — an O(17) array index, cheaper than today's
`linkStatus()` which calls `nodeStatus()` twice and loops every objective on both nodes.

### Week census (computed — `lc_fixtures.py`)

```
TOTAL line episodes across 17 links x 2016 steps : 61   (12 crit, 49 warn)
episode duration: min 1 step (5m) · median 35 steps (175m) · max 385 steps (32h05m)
rule-at-worst distribution:
   LC-09 43 · LC-06 7 · LC-05 3 · LC-02 3 · LC-07 2 · LC-03 1 · LC-04 1 · LC-08 1
E14 core—recon: 0 episodes, GREY for all 2016 steps
```

That LC-09 carries 43 of 61 episodes is the model working: most of the time only one end
of a relationship has anything to say, and the line stays amber instead of going red.

---

### QA FIXTURES — expected line state at three seeded moments

Computed by `/home/claude/pulse204/research/lc_fixtures.py`, which replicates
`mulberry32`/`keySeed`/`gen()` bit-for-bit (`data/` ships no `log_day*.js`, so
`DATA_MODE === 'seeded replay'` and this replication *is* the canonical week).
**Freeze these as the build's line-engine test fixtures.**

#### Step 428 · Aug 24 11:40 · Incident A — replica lag, peak

| link | glyph | state | rule | conn/appA/appB/logA/logB | headline evidence |
|---|---|---|---|---|---|
| E01 | CLI—TEL | WARN | LC-09 | ok/warn/–/ok/– | `client·Journey success 97.42%` |
| E02 | TEL—EDG | OK | LC-10 | ok/–/ok/–/– | — |
| E03 | EDG—GW | OK | LC-10 | ok/ok/ok/–/ok | — |
| **E04** | **GW—AUT** | **OK** | **LC-10** | –/ok/ok/ok/ok | — |
| E05 | AUT—OTP | OK | LC-10 | –/ok/ok/ok/ok | — |
| E06 | OTP—SMS | OK | LC-10 | ok/ok/–/ok/ok | — |
| E07 | GW—PAY | WARN | LC-09 | –/ok/ok/ok/**crit** | `pay·Decline anomaly 7.44×base` |
| E08 | PAY—ACC | **CRIT** | LC-06 | –/ok/warn/**crit**/**crit** | `pay·Decline anomaly 7.44` + `acct·Stale-read assert fails 6` |
| **E09** | **ACC—DBR** | **CRIT** | **LC-06** | ok/warn/**crit**/**crit**/– | `dbr·Replication lag 256.59s` + `acct·Stale-read assert fails 6` |
| E10 | PAY—COR | WARN | LC-09 | –/ok/ok/**crit**/ok | `pay·Decline anomaly 7.44` |
| E11 | PAY—BHB | OK | LC-10 | –/ok/ok/ok/ok | — |
| E12 | COR—BHB | OK | LC-10 | –/ok/ok/ok/ok | — |
| E13 | COR—MQ | OK | LC-10 | –/ok/ok/ok/ok | — |
| **E14** | **COR—RCN** | **GREY** | **LC-01** | –/–/–/–/– | not covered |
| E15 | BHB—BIL | WARN | LC-09 | ok/ok/ok/ok/warn | `biller·Debits awaiting credit 8` |
| E16 | BHB—BBT | OK | LC-10 | ok/ok/ok/ok/ok | — |
| E17 | BHB—RCN | WARN | LC-09 | –/ok/warn/ok/warn | `recon·Match rate 98.8%`, `recon·Exceptions open 98` |

✅ **Brief's expectation met:** `acct—dbr` CRIT, `gw—auth` OK. The L3 replica-lag
signature lights `PAY—ACC` and `ACC—DBR` red and leaves the whole front end untouched —
which is exactly the "silent false declines" story.

#### Step 1394 · Aug 27 20:10 · Incident F — core outage, peak

| link | glyph | state | rule | conn/appA/appB/logA/logB | headline evidence |
|---|---|---|---|---|---|
| E01 | CLI—TEL | WARN | LC-09 | ok/**crit**/–/warn/– | `client·Journey success 96.19%` |
| **E02** | **TEL—EDG** | **OK** | **LC-10** | ok/–/ok/–/– | — |
| **E03** | **EDG—GW** | **WARN** | **LC-09** | ok/ok/**crit**/–/**crit** | `gw·Availability 97.18%`, `gw·5xx rate 2.45%` |
| E04 | GW—AUT | **CRIT** | LC-06 | –/crit/crit/crit/warn | `gw·Availability 97.18%` + `auth·Availability 97.78%` |
| E05 | AUT—OTP | WARN | LC-08 | –/crit/warn/warn/warn | `auth·Login synthetic 96.99%` |
| E06 | OTP—SMS | WARN | LC-09 | ok/warn/–/warn/ok | `otp·OTP issue p95 1217.6ms` |
| E07 | GW—PAY | **CRIT** | LC-06 | –/crit/crit/crit/crit | `gw·Worker saturation 92.51%` + `pay·Availability 96.97%` |
| E08 | PAY—ACC | **CRIT** | LC-06 | –/crit/crit/crit/ok | `pay·Availability 96.97%` + `acct·Availability 97.37%` |
| E09 | ACC—DBR | **CRIT** | **LC-05** | **warn**/crit/warn/ok/– | `acct·Conn pool 91.68%` + `acct·Availability 97.37%` |
| **E10** | **PAY—COR** | **CRIT** | LC-06 | –/crit/crit/crit/warn | `pay·Availability 96.97%` + `core·Availability 96.77%` |
| E11 | PAY—BHB | WARN | LC-08 | –/crit/warn/crit/ok | `pay·Technical decline 4.11%` |
| E12 | COR—BHB | WARN | LC-08 | –/crit/warn/warn/ok | `core·Posting p95 3.08s` |
| E13 | COR—MQ | **CRIT** | LC-06 | –/crit/crit/warn/crit | `core·Pending-age p95 400.17s` + `mq·DLQ depth` |
| **E14** | **COR—RCN** | **GREY** | **LC-01** | –/–/–/–/– | not covered |
| E15 | BHB—BIL | **CRIT** | **LC-03** | **crit**/warn/ok/ok/crit | `bhub·Biller timeout 2.23%` + `biller·Debits awaiting credit 11` |
| E16 | BHB—BBT | WARN | **LC-02** | ok/warn/ok/ok/ok | batch-fed cap · `bhub·Inquiry p95 2139.76ms` |
| E17 | BHB—RCN | WARN | LC-08 | –/warn/warn/ok/crit | `recon·Exceptions open 132` |

✅ **Brief's expectation met:** 6 CRIT lines clustered on core/pay (E04, E07, E08, E09,
E10, E13) plus E15 at the biller edge.
🎯 **The money shot for the demo:** `TEL—EDG` stays **OK** and `EDG—GW` is only **WARN**.
Under v2.0.2's worst-of-path both were solid red and the scenario copy could honestly say
"full path red". Under the condition engine the perimeter is amber-at-worst because
`edge·Pool members up` says the edge still reaches its backends and the edge's own
availability is clean — the outage is *behind* the gateway, and the map now says so. Update
the scenario-card copy at `engine.js:192` accordingly (see §7).

#### Step 66 · Aug 23 05:30 · Incident C — OTP delivery dip, peak

| link | glyph | state | rule | conn/appA/appB/logA/logB | headline evidence |
|---|---|---|---|---|---|
| **E01** | **CLI—TEL** | **OK** | **LC-10** | ok/ok/–/ok/– | — |
| E02 | TEL—EDG | OK | LC-10 | ok/–/ok/–/– | — |
| E03 | EDG—GW | OK | LC-10 | ok/ok/ok/–/ok | — |
| E04 | GW—AUT | WARN | LC-09 | –/ok/warn/ok/ok | `auth·Login synthetic 98.69%` |
| E05 | AUT—OTP | WARN | LC-08 | –/warn/ok/ok/**crit** | `otp·Challenge→verify success 88.48%` |
| **E06** | **OTP—SMS** | **CRIT** | **LC-03** | **crit**/ok/–/**crit**/**crit** | `smsgw·Availability 97.49%`, `smsgw·Time-to-deliver p90 68.27s` |
| E07–E13, E15–E17 | | OK | LC-10 | all clean | — |
| **E14** | **COR—RCN** | **GREY** | **LC-01** | –/–/–/–/– | not covered |

✅ **Brief's expectation met:** `otp—smsgw` CRIT (via the strongest rule in the set — SMPP
bind critical *and* both ends confirming), `client—telco` OK. A single carrier's DLR
problem stays confined to the one relationship that has evidence about it.

---

## §4 · BALLOON SPEC — pop-on-change, then fade

### Trigger
A balloon set fires when, at the live cursor `cur`, a link's state **changes into** `warn`
or `crit`:
```
L.lineStat[cur] ∈ {warn,crit}  AND  L.lineStat[cur] !== L.lineStat[cur-1]
```
Escalation `warn → crit` re-fires (the story changed). Recovery to `ok`/`grey` never fires
a balloon — the line simply repaints. Balloons fire during playback and on manual seek;
they do **not** fire on the initial boot paint.

### What a balloon set is (three pieces per link)

1. **Endpoint balloon × 2** — one near A, one near B. Each shows **≤ 3 rows**, taken from
   that side's contributing evidence at `cur`, sorted crit-before-warn then by class order
   CONN → APP → LOG. Row = `[sev dot] objective label · current value` using
   `fmtVal(o, o.vals[cur])` and `statusColor(o.stat[cur])` — identical grammar to the
   existing `.hc-row` in the hover card, so it reads as one family.
   An endpoint whose cells are all empty renders a single muted row: **"No evidence bound
   at this end."** — never an empty balloon, never a silently omitted one.
2. **Line chip** — at the segment midpoint: the fired rule id (`LC-03`), tinted in the new
   state's colour, with the rule's short name on hover (`title` attribute).
3. **CONN chip** — inside the chip cluster when connectivity is bound: `CONN crit` /
   `CONN ok` / `CONN —`. This is what makes the "in sync" judgement visible.

### Anchor geometry

Node geometry in model space (engine.js:137–148): `NR = 24`, `RING = 30`, selection ring
`r = 36`, and the three label lines sit at `y = 46 / 59 / 70`. The rendered node box is
therefore roughly `y ∈ [−36, +76]`.

**Balloons anchor ABOVE the node.** Balloon bottom edge (the tail tip) at model-space
`(n.x, n.y − 40)`, i.e. 4px clear of the selection ring, tail pointing down at the disc.
Balloon box is bottom-anchored and grows upward. This never covers the three label lines,
which is the whole reason for going up rather than down.

Two collision adjustments, in this order:
- **Sibling nudge** — if two balloons in one set would overlap horizontally, shift each
  along the link's own axis by ±(half overlap + 8px), away from the midpoint. Never
  vertically; a balloon must stay visually attached to its node.
- **Stage clamp** — if the anchor is within 150px of the stage top, flip that one balloon
  to *below* the node with its tail tip at `(n.x, n.y + 82)` — clear of the `pm` label
  line — and set `data-flip="1"` so the tail renders on the top edge.

Anchors are recomputed on `applyView()` (pan, zoom, fit) and on node drag, via one
`requestAnimationFrame`-coalesced `positionBalloons()`.

### Concurrency cap and collapse

Computed from the seeded week (`lc_fixtures.py`): across all 2015 transitions there are
**47 steps with at least one escalation**, **3 steps with 4+**, and **a maximum of 5
simultaneous escalations** (step 1793, Aug 29 05:25, when the aggregator brownout takes
E11, E12, E15, E16, E17 together; Incident F's onset produces 4 at step 1387 and 4 at
step 1381).

**Cap: 3 line-sets concurrently.** Rank candidates by `crit` before `warn`, then by the
count of contributing evidence rows, then by link id for stability. The remainder collapse
into a single **count badge** pinned to the map's top-right corner of the stage:

> **`+2 more lines changed`**  · click to open Timeframe D filtered to this step

Clicking the badge opens Timeframe D scrolled to the newest episodes and applies the
severity filter. The badge uses `--tfd` (§6) so it reads as "there is a table for this",
not as a fourth status colour. At 5 concurrent escalations the user sees 3 balloon sets
plus `+2 more lines changed` — never a screen of overlapping cards.

### Fade timing

- Appear: 140ms ease-out, opacity 0→1 with a 4px upward translate (mirrors `.hovercard.on`
  at styles.css:98–99, so it feels native).
- Hold: **6000ms**.
- Fade: 500ms ease-in to opacity 0, then removed from the DOM.
- **Pause on hover** — `mouseenter` on any balloon in a set clears the hold timer for the
  whole set (both endpoints + chip); `mouseleave` restarts it at 2500ms, not the full 6s.
- **Pause on playback pause** — if the user hits pause/space, freeze all hold timers.
  Balloons are evidence, and a paused NOC operator is reading them.
- **Seek cancels** — dragging the timeline head clears all live balloons immediately;
  they belong to a moment, not to a session.

### Re-open affordances

Balloons are transient but never lost:
- **Click a line** → re-opens that link's balloon set at the current cursor, with **no**
  auto-fade (sticky until dismissed by ✕, Esc, clicking elsewhere, or seeking).
- **Click a Timeframe D row** → seeks the cursor to that episode's `worstStep`, then opens
  that link's balloon set sticky, and focuses the map on the segment midpoint (reuse
  `focusNode()`'s viewport maths against the midpoint).
- **Esc** → dismisses sticky balloons first, then falls through to the existing
  RCA-close / deselect chain at engine.js:710.

### Reduced motion

`html[data-motion="reduce"]` (and `@media (prefers-reduced-motion: reduce)` as the
implicit source that sets it):
- no appear transition, no fade transition — `display` toggled instantly;
- hold extends to **10 000ms** to compensate for the loss of the fade's "about to go" cue;
- the `+N more` badge does not animate in;
- the existing `.flash` row animation on Timeframe D rows is suppressed (it already is a
  1.4s keyframe at styles.css:308 — gate it the same way).

### Z-order

Existing stack (styles.css): `leftstack`/`hint` 15, `bottom` 18, `topbar`/`timeline` 20,
`dock` 25, `rcapanel` 26, `hovercard` 30, `colmenu` 40.

**Balloon overlay: `z-index: 22`.** Above the canvas, the scenario card and the bottom
tables; **below** the dock (25), the RCA panel (26) and the hover card (30). Rationale: a
balloon is ambient evidence, so it must never occlude a panel the user deliberately opened,
and the hover card — which the user is actively pointing at — always wins. The line chip
sits at `z-index: 23` within the overlay so it is never hidden by an endpoint balloon.
`pointer-events: none` on the overlay container, `pointer-events: auto` on each balloon and
chip, so panning the map through the gaps still works.

### TECH CHOICE: **HTML overlay above the SVG**, positioned with transform maths

A `<div class="lcballoons" id="lcballoons">` inside `.stage`, sibling to `#canvas` and
`#hovercard`, each balloon absolutely positioned at
`left = view.x + n.x*view.k`, `top = view.y + n.y*view.k` (the exact inverse of
`applyView()`'s `translate(view.x,view.y) scale(view.k)` at engine.js:519).

Three reasons. **First, constant legibility:** an SVG `<g>` inside `#viewport` inherits
`scale(view.k)`, and the zoom range is clamped to `0.3…4` (engine.js:543) — an 11px label
would render at 3.3px zoomed out and 44px zoomed in, so every balloon would need
counter-scaling anyway, at which point the SVG buys nothing. **Second, text:** SVG has no
text wrapping, and these balloons carry variable-length manifest labels like
`Credit-leg success (worst biller)` and `Decline anomaly (10m sust.)` — in HTML that is
free, in SVG it is manual line-breaking against measured glyph widths. **Third, reuse:**
the hover card is already an HTML overlay tracking pointer position inside `.stage`
(engine.js:238), so the CSS tokens, `.hc-row`/`.sd`/`.sevchip` grammar, `--glass` +
`backdrop-filter` treatment and the clamp-to-stage helper all transfer directly, and the
balloons inherit theme switching for free.

The only cost is that pan/zoom must repaint balloon positions in JS rather than riding the
SVG transform — one `positionBalloons()` call appended to `applyView()`, coalesced through
`requestAnimationFrame`, over at most 3 sets × 3 elements = 9 nodes. Negligible.

The **connecting tail** is drawn as a CSS triangle on the balloon (`::after`, 7px), not as
SVG — it only ever points at the node the balloon is anchored to, so it needs no geometry
beyond a flip flag.

---

## §5 · LINE CONDITIONS WINDOW

A collapsible reference window that sits **below the Timeframe A/B/C row and above
Timeframe D**, full width. It is documentation, not live data: it does not re-render on
cursor moves.

- **Element:** `<section class="btbl lcwin" id="lcConditions">` — reuses `.btbl` +
  `.btbl-h` + `.tblwrap` + `table.dt` so it inherits the sticky header, zebra rows and type
  scale with zero new table CSS.
- **Default state:** collapsed. Expanded state persists for the session; `Reset` returns it
  to collapsed (add to `resetAll()`, engine.js:711).
- **Collapse control:** the existing `.rtoggle` caret pattern from the Incident Trace row
  (engine.js:497) — `▶ / ▼` with `aria-expanded` and `aria-controls`.

### Header copy (exact strings)

```
Line Conditions        how a line gets its colour        REFERENCE
Lines are monitored relationships — Pulse correlates evidence at each end. It does not trace transactions.
```
(first line is `.tt` + `.bsub` + `.tag`; second is a full-width `.bsub` sub-row.)

### Evidence-class vocabulary strip (above the table)

Three chips, each `.evchip` with the class letter and definition inline:

```
CONN   Connectivity — reachability between the two objects. Bound to the pair.
APP    Application health — availability and response time at one object.
LOG    App-log errors — error, decline and failure counts at one object.
```
Plus one closing line in `--muted`:
```
An objective serves one class per line. Escalation needs evidence from two ends in the same 5-minute step — connectivity alone can escalate, because it is measured across the pair.
```

### Table columns

| col | header | width | content |
|---|---|---|---|
| 1 | `RULE` | 62px | rule id in `--mono`, e.g. `LC-03`. Copy-selectable — NOC pastes it into tickets. |
| 2 | `CONDITION` | flex | the plain-English string from §2, verbatim. Wraps (override `.dt td { white-space: nowrap }` to `normal` for this window only). |
| 3 | `EVIDENCE` | 150px | class chips involved: `CONN` `APP` `LOG`, dimmed when the rule does not read that class. |
| 4 | `LINE` | 78px | `chip(state)` — reuses `.sevchip`; grey uses a new `.sevchip.grey` on `--unk`. |

### Rows — exact copy, in precedence order

| RULE | CONDITION | EVIDENCE | LINE |
|---|---|---|---|
| LC-01 | No evidence is bound to this relationship. Pulse is not watching it. | — | `NOT COVERED` |
| LC-02 | Connectivity here is collected from a batch file, so the two ends cannot be corroborated inside one 5-minute step. Capped at Degraded. | CONN | `DEGRADED` |
| LC-03 | Connectivity between the two objects is critical AND both objects report errors in the same 5-minute step. | CONN APP LOG | `CRITICAL` |
| LC-04 | Connectivity between the two objects is critical. | CONN | `CRITICAL` |
| LC-05 | Connectivity is degraded AND both objects report errors in the same 5-minute step. | CONN APP LOG | `CRITICAL` |
| LC-06 | Both objects report critical application health or app-log errors in the same 5-minute step. | APP LOG | `CRITICAL` |
| LC-07 | Connectivity between the two objects is degraded. | CONN | `DEGRADED` |
| LC-08 | Both objects report degraded health or errors in the same 5-minute step; connectivity is clean or not bound. | APP LOG | `DEGRADED` |
| LC-09 | Only one object reports a problem. The other object and the connectivity between them are clean. Not escalated on one object's colour. | APP LOG | `DEGRADED` |
| LC-10 | All bound evidence is clean at this step. | CONN APP LOG | `OK` |

### Footer copy (exact strings, `--muted`, below the table)

```
Rules are read top to bottom. The first rule that matches sets the colour.
10 of the 17 relationships on this map have no connectivity evidence bound. Those lines can only reach Critical when both objects report critical evidence in the same step — never on one object's colour alone.
Grey is not OK. A grey line means nothing is bound to that relationship.
```

Banned-word audit on this section: contains no *flow*, *path*, *trace*, *request travels*,
*transaction journey*. "objects" and "relationship" carry the whole vocabulary.

---

## §6 · TIMEFRAME D SPEC

A **new full-width** window below A/B/C and below the Line Conditions window. Same visual
grammar as A/B/C (`section.btbl`, `.btbl-h`, `.tblwrap`, `table.dt`, `.mini` selects,
`.sevchip`) so it reads as native, differentiated only by an accent.

### Structure

```html
<div class="btables btables-d">
  <section class="btbl tfd" id="tblD">
    <div class="btbl-h">
      <span class="tt">Timeframe D <span class="bsub">line episodes · newest first</span>
        <span class="tag tfd-tag" id="dTag">7 days</span></span>
      <div class="ctrls">
        <select class="mini" id="dWin">…same 5m…7d option set as A/B/C…</select>
        <select class="mini" id="dSev"><option value="all">All sev</option>
          <option value="crit">Critical</option><option value="warn">Warn+</option></select>
        <select class="mini" id="dNode">…All objects + one option per node…</select>
      </div>
    </div>
    <div class="tblwrap" id="dWrap"></div>
  </section>
</div>
```

`#dNode` is built from `NODES` exactly like `#cNode` (engine.js:728) but filters links
whose **either endpoint** matches. `#dWin`, `#dSev`, `#dNode` are appended to the existing
change-listener array at engine.js:662 so D refreshes with the rest.

### Accent colour

```css
:root{ --tfd:#a78bfa; }                     /* dark  — violet, clear of --maint #7aa2ff */
html[data-theme="light"]{ --tfd:#6d28d9; }  /* light — 8.0:1 on --panel2, AA at 9.5px */
```
Chosen because it collides with nothing that carries meaning: it is not `--ok` (#2dd4a7),
`--warn` (#f5a623), `--crit` (#ff6b5a), `--unk` (#8b94a3), the maintenance blue `--maint`
(#7aa2ff) or the brand `--coral` (#dd6b55). Applied to: the `.tfd-tag` border+text, the
section's 2px top border, the `LC-xx` rule chip, the col-group header rules, and the
`+N more lines changed` map badge. **Never** to a status indicator — every severity mark in
D still uses `--ok/--warn/--crit/--unk`.

### Columns — three col-groups, left→right as an incident-explanation tree

`<colgroup>` + a two-row `<thead>`: group headers on row 1, column headers on row 2, with a
1px `--tfd` rule under each group header.

**Col-group 1 · LINE** *(what changed)*

| col | header | content |
|---|---|---|
| D1 | *(none)* | **the o—o glyph.** Inline SVG, 96 × 22: two `r=6` circles at x=8 and x=88 stroked `--nodeStroke` filled `--node`, connecting stroke 2.4px painted in `statusColor(ep.worst)`; the two node short-names (`CLI`, `TEL`, `GW`, `AUT`, `OTP`, `SMS`, `EDG`, `PAY`, `ACC`, `DBR`, `COR`, `BHB`, `BIL`, `BBT`, `MQ`, `RCN`) in 8.5px `--mono` beneath each circle. `title` gives the full node names. |
| D2 | `WHEN` | `dstamp(ep.start) → dstamp(ep.end)`, with `⋯ ` prefix when clipped by the window (reuse table B's `truncStart` convention, engine.js:367). |
| D3 | `FOR` | `fmtDur(ep.end - ep.start + 1)` |
| D4 | `RULE` | `LC-xx` chip in `--tfd`; `title` = the rule's condition string from §5. Click → opens the Line Conditions window scrolled to that rule. |
| D5 | `SEV` | `chip(ep.worst)` — existing `.sevchip`. |

**Col-group 2 · RELATED ERRORS BY NODE** *(where the evidence is)*

| col | header | content |
|---|---|---|
| D6 | `OBJECT` | Two stacked sub-blocks, one per endpoint, each headed by the node's full `n.name` in `.objcell` style. Under each: one line per contributing evidence row from `ep.contrib` — `[class chip] objective label`. An endpoint with no contributing rows prints `— no evidence bound at this end` in `--muted`. |
| D7 | `CLASS` | `CONN` / `APP` / `LOG` chip per evidence row, aligned to D6's rows. |

**Col-group 3 · LOG DETAIL** *(how deep the seeded data goes)*

| col | header | content |
|---|---|---|
| D8 | `AT PEAK` | `fmtVal(o, o.vals[ep.worstStep])` — the value at the episode's worst step. |
| D9 | `THRESHOLD` | `{'hi':'>','lo':'<'}[o.dir] + ' ' + (sev==='crit' ? o.crit : o.warn)` — identical grammar to table B's Trigger cell. |
| D10 | `OBJECTIVE SINCE` | `dstamp(o.eps[…].start)` — when *that objective's* own episode began, which is usually earlier than the line's. This is the column that shows a NOC "the replica was already lagging 20 minutes before the line changed". |
| D11 | `CASE` | `incName(k)` when the episode overlaps an INC window → `WK34 · Incident A — replica-lag false declines`, else `—`. Uses the existing window-pick logic lifted from `traceTicket()` (engine.js:471). Click → the existing `openRCA(nid, label, W)` for that objective, so D lands the user in the RCA panel already built. |

### Row expansion: **ALWAYS EXPANDED**

Density supports it. Computed from the seeded week: **61 line episodes across all 7 days**
(12 critical, 49 degraded), median duration 175 minutes. That means:

| window | typical rows |
|---|---|
| 5m / 15m | 0–3 |
| 1h (default, matching table C) | 0–6 |
| 24h | 8–14 |
| 7d | 61 (cap at 40, as table C does) |

At the default 1-hour window a NOC sees roughly **two to six** rows. The tree *is* the
content — collapsing it behind a disclosure would hide the one thing D exists to show. So
rows render fully expanded, with two density guards: **cap the table at 40 rows** (matching
`renderTableC`, engine.js:381), and **cap col-groups 2/3 at the top 4 contributing evidence
rows** per episode, sorted crit-first, with a `+N more` link in `--tfd` that opens the
balloon set at that episode's `worstStep`.

Row height is therefore variable (2–5 evidence lines). Override `.dt tbody td
{ white-space: nowrap }` → `normal; vertical-align: top` for `#tblD` only, and add
`border-bottom: 1px solid var(--line)` (not `--line2`) so episode boundaries read clearly
when rows are tall.

### Sort / filter

- Default sort: **newest first** by `ep.start` descending, ties broken by severity then
  link id. Matches table B's mental model.
- Clicking `WHEN`, `FOR` or `SEV` re-sorts (reuse the `cSortBy` pattern, engine.js:395,
  with the `.ar` arrow marker).
- `#dSev` — `All sev` / `Critical` / `Warn+`, filtering on `ep.worst`. Same option strings
  as `#cSev` so the two selects are learnable as one control.
- `#dNode` — `All objects` plus one option per node, matching **either** endpoint.
- Grey links (E14) never produce rows and are **not** filtered out silently — see the
  empty-state copy.

### Empty-state copy (exact strings, via the existing `tableEmpty()` helper)

| situation | string | class |
|---|---|---|
| no episodes in window, no filter | `✓ No line changed state in this window` | `.tbl-empty` (green) |
| no episodes after a severity filter | `✓ No critical lines in this window` / `✓ No degraded or critical lines in this window` | `.tbl-empty.warnc` (muted) |
| no episodes after a node filter | `✓ No line episodes for this object in this window` | `.tbl-empty.warnc` |
| always appended, below any of the above | `1 relationship on this map is not covered (core — recon). Not-covered lines are grey and never appear here.` | `.tbl-empty.warnc`, 10.5px |

That last line is the point of the whole exercise: the empty state itself declares its own
blind spot, so "no rows" can never be read as "everything is fine everywhere".

### Row click behaviour

Reuse the existing delegated handler shape at engine.js:513. A D row carries
`data-link="E09" data-step="1394"`. Click →
1. `setCur(ep.worstStep)` and pause playback;
2. `focusNode()`-style viewport centring on the segment midpoint;
3. open that link's balloon set **sticky** (§4);
4. if the clicked cell is `CASE`, additionally `openRCA(nid, label, W)` for that objective.

---

## §7 · HONESTY LEGEND COPY

### Replace, in `buildLegend()` (engine.js:699)

Delete: `<div class="li">— link = worst-of-path</div>`

Insert (two `.li` items, replacing the one):

```
— line = evidence bound to the pair · CONN + APP + LOG, correlated   (66 chars)
grey line = not covered — nothing bound. Grey is not OK.             (56 chars)
```

The grey item gets a `.sw` swatch on `--unk` plus a 2px dashed line sample so the state is
learnable from the legend alone. Both strings are under the 90-char budget.

### Add, as the legend's closing line

The mandated sentence goes in the legend footer, immediately above the existing build
provenance line at engine.js:701, in the `.lgfoot` treatment:

```html
h += '<div class="li lgfoot lgclaim">Lines are monitored relationships — Pulse correlates '
   + 'evidence at each end. It does not trace transactions.</div>';
h += '<div class="li lgfoot">v2.0.4 · Myanmar commercial-bank template · 7-day mock data</div>';
```

It appears in **three** places total, deliberately — legend footer, the Line Conditions
window sub-header (§5), and the Line Conditions `title` tooltip on the map's line-chip.
This is the product's central claim; a NOC operator should not be able to use the surface
for five minutes without meeting it.

### One consequential copy change elsewhere

`engine.js:192` currently ends the scenario card with
`"…Aug 27 19:00 CORE OUTAGE, full path red…"`. Two problems: *path* is a banned word, and
under the condition engine it is now factually wrong — at step 1394 the perimeter
relationships `telco—edge` and `edge—gw` are OK and WARN respectively (§3 fixtures).
Replace that clause with:

```
Aug 27 19:00 CORE OUTAGE — six relationships critical behind the gateway, perimeter clean
```

---

## APPENDIX · FILES DELIVERED

| file | what it is |
|---|---|
| `/home/claude/pulse204/research/R2_LINES.md` | this document |
| `/home/claude/pulse204/research/lc_truthtable.py` | totality + honesty proof over all 2048 input states. Runs standalone, exits non-zero on violation — wire into CI. |
| `/home/claude/pulse204/research/lc_fixtures.py` | bit-for-bit Python replication of `mulberry32`/`keySeed`/`gen()` + the §1 bindings + the §2 engine. Emits the three QA fixture tables and the week-long episode census. Imports the ruleset from `lc_truthtable.py`, so the proof and the fixtures can never drift apart. |

Both scripts run with no dependencies: `python3 lc_truthtable.py && python3 lc_fixtures.py`.
