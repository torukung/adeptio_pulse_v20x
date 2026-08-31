# R1 — ZONE REGISTER, COLLECTION LEDGER & MAP GEOMETRY
**Adeptio Pulse · Spin 2.0.4 · front page map (index.html → `#viewport` > `#links` + `#nodes`)**
Source of truth read: `data/manifest.js` (16 NODES / 17 LINKS), `assets/engine.js` L100–180 + `fit()` L521, `docs/capture-map.html` (zone + 6-lane vocabulary).
Status: **decided**. One design, no options. Feeds SPEC-Zones-v2.0.4.

---

## §0 THE ONE IDEA

The v2.0.2 map groups by *tier* (OUTSIDE / DMZ / APP / DATA&PARTNERS — four zones, from `capture-map.html`). That vocabulary answers "where does it sit in the estate". It does **not** answer the question the bank actually asks at 02:00, which is **"who do I phone, and what do they type?"**

Spin 2.0.4 re-cuts the same 16 nodes into **6 zones along the user-session path**, and each zone carries exactly **one owner chip**. The chip is derived from the `pm` (collection method) strings already in `manifest.js` — nothing new is invented. The result reads left→right as a sentence:

> **DEV → NETWORK → DEV → DEV+DBA → NETWORK → PARTNER**

The network team owns **both ends of the wire** (Z2 the front-end network, Z5 the delivery network); dev owns the bank's own compute in the middle; the DBA joins where data is; the counterparty owns the far end. Two network zones bracketing the bank's own estate is the whole story of the map, and it is legible from three metres away.

---

## §1 ZONE REGISTER

| Zone | Display name (≤22 ch, caps) | Members | Owner chip | Collection command class (literal, from `pm`) | What this zone answers |
|---|---|---|---|---|---|
| **Z1** | `CUSTOMER FRONT-END` | `client` | **DEV TEAM** | `synthetic` · `store api` | Did the customer's journey complete on the handset at all? |
| **Z2** | `ACCESS NETWORK` | `telco`, `edge` | **NETWORK TEAM** | `curl -w` · `dns probe` · `http poll` (VIP) · `snmp` · packet loss · firewall/LB check | Can the handset *reach* the bank — DNS, TCP, TLS, perimeter, LB pool? |
| **Z3** | `API & APP SERVICES` | `gw`, `auth`, `otp`, `pay` | **DEV TEAM** | `http poll` · `logs` · `synthetic login` | Did the bank's own request path accept, authenticate and orchestrate the payment? |
| **Z4** | `DATA & CORE BACK-END` | `acct`, `dbr`, `core`, `mq` | **DEV + DBA** | `poll` · `logs` · `L3 assert` · `sql canary` · `repl api` · `heartbeat txn` · `file feed` · `broker api` · `queue metrics` | Did the money actually post, and is the data the app read the truth? |
| **Z5** | `PARTNER DELIVERY NET` | `smsgw`, `bhub` | **NETWORK TEAM** | `smpp ping` · `http poll` (hub VIP) · `dlr api` · `logs` | Is the transport out of the bank up — SMPP bind, aggregator reachability? |
| **Z6** | `BILLERS & SETTLEMENT` | `biller`, `bbatch`, `recon` | **PARTNER** | `curl echo` · `api` · `sftp file check` · `sftp · file check` | Did the counterparty confirm the credit, the file and the match? |

**Legend line for the map legend card** (one row, appended after the status keys):

> `Zones` ▸ **Z1** Customer front-end · **Z2** Access network · **Z3** API & app services · **Z4** Data & core back-end · **Z5** Partner delivery network · **Z6** Billers & settlement — *band tint = owning team; the chip is who runs the first command.*

### The three judgement calls (≤3 sentences each)

**`recon` → Z6, not Z4.** Its `pm` is `sftp · file check`, which is the PARTNER command class verbatim, and a broken 3-way match is settled by a file exchange with the biller, not by a DBA. Keeping it in Z4 would force a DEV+DBA chip onto a node whose evidence lives on someone else's SFTP landing directory. The Z4 exception is documented instead: when recon breaks *because* of an upstream replica-lag event (incident A), the ledger routes it back to Z4 for the root cause.

**`smsgw` → Z5, not Z3.** Its first command is `smpp ping` — a protocol bind test against a carrier, which is a network command, not an app poll. Putting it beside `otp` in Z3 would hang a network-only command off the DEV chip and misroute every OTP-delivery dip (incidents C and E) to the wrong team. Z5 also gives `otp → smsgw` a clean top corridor across the map, which is exactly the "one carrier, two symptoms" reading the Aug 25 scenario needs.

**Z5 chip = NETWORK TEAM, not PARTNER or DEV.** Both Z5 nodes are *transport handoffs* out of the bank, and the first command when either goes red is a transport check the network team alone can run (`smpp ping` on the bind; reachability/`curl -w` to the aggregator VIP) — nobody reads a log before confirming the pipe is up. `bhub` is the documented exception: once transport is proven, its `http poll · logs` hand straight to DEV. PARTNER stays reserved for Z6, where *every* node's evidence is physically held by the counterparty, so a duplicate PARTNER chip on Z5 would waste the map's only routing distinction.

---

## §2 PER-NODE COLLECTION LEDGER

`pm` strings are **verbatim** from `data/manifest.js`.

| # | Node | Zone | `pm` (verbatim) | Owner per method | Exception / cross-team note |
|---|---|---|---|---|---|
| 01 | `client` | Z1 | `synthetic · store api` | `synthetic` → **DEV** · `store api` → **DEV** | The synthetic runs on a real handset APN vantage — **NETWORK** supplies and keeps the vantage/APN alive; DEV owns the script and the store-API token. |
| 02 | `telco` | Z2 | `curl -w · dns probe` | `curl -w` → **NETWORK** · `dns probe` → **NETWORK** | Pure network node. Packet-loss reads come off the same `curl -w` run — no dev involvement at any point. |
| 03 | `edge` | Z2 | `http poll · snmp` | `http poll` → **NETWORK** · `snmp` → **NETWORK** | `http poll` here is a **public-VIP health probe**, not an app endpoint poll — same verb as Z3, different owner. Cert days-to-expiry and pool-members-up are firewall/LB checks, NETWORK. |
| 04 | `gw` | Z3 | `http poll · logs` | `http poll` → **DEV** · `logs` → **DEV** | Deploy regressions (incident D) are DEV-only. If `Route p95` moves *with* Z2's TLS p95, hand back to NETWORK before touching the gateway. |
| 05 | `auth` | Z3 | `http poll · synthetic login` | `http poll` → **DEV** · `synthetic login` → **DEV** | Seeded-account credentials are DEV-held; NETWORK is only involved if the session-cache node is unreachable. |
| 06 | `otp` | Z3 | `http poll · logs` | `http poll` → **DEV** · `logs` → **DEV** | **Exception:** when `Challenge→verify success` falls but `OTP issue p95` is flat, the evidence is not in Z3 — escalate to **Z5** (`smsgw` DLR). This is the Aug 23 / Aug 25 signature. |
| 07 | `smsgw` | Z5 | `smpp ping · dlr api` | `smpp ping` → **NETWORK** · `dlr api` → **PARTNER** | Split node, and the reason Z5's chip is NETWORK: the bind test comes first, the carrier's DLR receipts second. `dlr api` is a read-only pull against carrier-supplied credentials — **PARTNER coordination**. |
| 08 | `pay` | Z3 | `http poll · logs` | `http poll` → **DEV** · `logs` → **DEV** | **Exception:** the decline-anomaly indicator is a *symptom* node. A sustained `Decline anomaly` with clean Z3 logs means the cause is Z4 (`dbr` replica lag, incident A) — hand to **DEV + DBA**. |
| 09 | `acct` | Z4 | `poll · logs · L3 assert` | `poll` → **DEV** · `logs` → **DEV** · `L3 assert` → **DEV** (query set **DBA**-approved) | The L3 stale-read assertion is dev-authored but runs against the replica under the DBA-signed read-only query set (lane L6) — neither team can run it alone. |
| 10 | `dbr` | Z4 | `sql canary · repl api` | `sql canary` → **DBA** · `repl api` → **DBA** | The pure-DBA node, and the reason Z4's chip is DEV + DBA rather than DEV. NETWORK owns only the SAN path if `Disk IO latency` moves without `Replication lag`. |
| 11 | `core` | Z4 | `heartbeat txn · file feed` | `heartbeat txn` → **DEV** · `file feed` → **DBA** (read-only landing dir) | **Exception:** a failed failover behind a core outage (incident F) is **NETWORK + core vendor**, not DEV — Pulse reads the symptom, the cluster is somebody else's console. |
| 12 | `bhub` | Z5 | `http poll · logs` | `http poll` → **DEV** · `logs` → **DEV** | **The documented DEV node inside a NETWORK-chipped zone.** The chip routes the *first* command (reachability/transit to the hub VIP) to NETWORK; adapter-error and biller-timeout logs then go to DEV. |
| 13 | `biller` | Z6 | `curl echo · api` | `curl echo` → **PARTNER** · `api` → **PARTNER** | **Exception:** if the echo fails at TCP/TLS level rather than returning an error body, that is an outbound route/firewall problem — **NETWORK** first, partner second. |
| 14 | `bbatch` | Z6 | `sftp file check` | `sftp file check` → **PARTNER** | Landing directory on the partner's SFTP, read-only (lane L5). Cut-off buffer breaches are a scheduling conversation, not a command. |
| 15 | `mq` | Z4 | `broker api · queue metrics` | `broker api` → **DEV** · `queue metrics` → **DEV** | DLQ depth and oldest-message age are DEV-owned. Deliberately kept in Z4 rather than Z3: it drains what `core` posts, so it fails with the data tier, not the request tier. |
| 16 | `recon` | Z6 | `sftp · file check` | `sftp` → **PARTNER** · `file check` → **PARTNER** | **Exception:** a match-rate drop caused by upstream replica lag (incident A) or a core outage (F) is a **Z4 / DEV + DBA** root cause surfacing here — the ledger routes the *fix* to Z4 while the *evidence* stays in Z6. |

**Method-class summary across all 16 nodes** — 8 DEV-only, 2 NETWORK-only, 1 DEV+DBA-split, 1 DBA-only, 1 NETWORK/PARTNER-split, 3 PARTNER-only. Six documented cross-team exceptions (`client`, `otp`, `pay`, `core`, `bhub`, `biller`, `recon`).

---

## §3 LAYOUT GEOMETRY

SVG units are arbitrary and `fit()` (engine.js L521) auto-scales, so the map is re-pitched onto a **1925 × 1010 unit field** with a 180-unit vertical lane pitch — 40 % more air than the v2.0.2 coordinates, which is what makes six labelled bands survive at fit-to-screen.

### 3.1 Zone band rectangles

Bands are full-height vertical columns, in flow order, with a 10–20 unit gutter between each.

| Zone | Band `{x, y, w, h}` | x-range | Zone-name anchor | Owner-chip rect |
|---|---|---|---|---|
| Z1 | `{ x:40,   y:20, w:195,  h:1010 }` | 40 → 235 | `(54, 50)` | `(53, 60, w≈65, h:19, rx:9.5)` |
| Z2 | `{ x:245,  y:20, w:380,  h:1010 }` | 245 → 625 | `(259, 50)` | `(258, 60, w≈91, h:19, rx:9.5)` |
| Z3 | `{ x:635,  y:20, w:525,  h:1010 }` | 635 → 1160 | `(649, 50)` | `(648, 60, w≈65, h:19, rx:9.5)` |
| Z4 | `{ x:1170, y:20, w:370,  h:1010 }` | 1170 → 1540 | `(1184, 50)` | `(1183, 60, w≈71, h:19, rx:9.5)` |
| Z5 | `{ x:1550, y:20, w:200,  h:1010 }` | 1550 → 1750 | `(1564, 50)` | `(1563, 60, w≈91, h:19, rx:9.5)` |
| Z6 | `{ x:1760, y:20, w:205,  h:1010 }` | 1760 → 1965 | `(1774, 50)` | `(1773, 60, w≈58, h:19, rx:9.5)` |

Zone name and owner chip **stack** (name on line 1, chip on line 2) — Z1 (195 u) and Z5 (200 u) are too narrow for an inline pair. Chip width = `12 + 6.6 × len(text)`. The whole label block occupies `y = 20 → 80`; the highest node's top extent is `y = 124`, giving **44 units of headroom** (validator §D).

### 3.2 Node coordinates — the 16 new `x` / `y`

| Node | Zone | new `x` | new `y` | (was, v2.0.2) | Lane |
|---|---|---|---|---|---|
| `client` | Z1 | **140** | **520** | 80, 330 | spine |
| `telco` | Z2 | **340** | **520** | 230, 330 | spine |
| `edge` | Z2 | **530** | **520** | 380, 330 | spine |
| `gw` | Z3 | **730** | **520** | 535, 330 | spine |
| `auth` | Z3 | **900** | **340** | 515, 205 | upper |
| `otp` | Z3 | **1070** | **160** | 640, 184 | top corridor |
| `pay` | Z3 | **900** | **520** | 665, 430 | spine |
| `core` | Z4 | **1270** | **340** | 1070, 466 | upper |
| `mq` | Z4 | **1450** | **340** | 1200, 590 | upper |
| `acct` | Z4 | **1270** | **700** | 850, 590 | lower |
| `dbr` | Z4 | **1450** | **700** | 1010, 590 | lower |
| `smsgw` | Z5 | **1650** | **160** | 665, 305 | top corridor |
| `bhub` | Z5 | **1650** | **600** | 1360, 390 | spine+80 |
| `biller` | Z6 | **1850** | **420** | 1550, 350 | upper |
| `bbatch` | Z6 | **1850** | **740** | 1640, 550 | lower |
| `recon` | Z6 | **1850** | **940** | 1360, 590 | floor |

**Reading of the layout.** One horizontal **spine at y = 520** carries the money — `client → telco → edge → gw → pay` and, straight across, `pay → bhub`. Everything the customer *waits on* is above the spine (auth at 340, OTP/SMS at the 160 corridor); everything the money *lands in* is below or at the far right (accounts/replica at 700, settlement floor at 940). The `pay → bhub` "partner shortcut" (the phrase `capture-map.html` already uses) runs dead level with the spine through the empty middle of Z4, which is why Z4's four nodes are split 340 / 700 — 180 units clear either side of it.

### 3.3 Cross-band link routing

Three of the 17 links legitimately traverse a band they do not belong to. All three are clean as **straight lines** at these coordinates — no dogleg is required by the ≥60 rule.

| Link | Crosses | Straight-line clearance | Verdict |
|---|---|---|---|
| `otp → smsgw` | Z4 band | 180.0 from `core`, 180.0 from `mq` | **straight — the top corridor at y = 160 is deliberately kept empty across Z4** |
| `pay → bhub` | Z4 band | 120.6 from `dbr`, 120.6 from `acct`, 238 from `core`/`mq` | **straight — the mid corridor y 520→600 is the partner shortcut** |
| `core → recon` | Z5 band | 92.5 from `bhub` centre | **straight (passes the rule) — one advisory below** |

**Optional dogleg — `core → recon`, waypoint `(1650, 820)`.** The straight line clears `bhub`'s *centre* by 92.5 u but grazes the left 28 units of `bhub`'s three-line label box (validator §E). Labels render after links with a `paint-order:stroke` background halo, so the link is cleanly masked rather than overlapping text — cosmetically acceptable. If the SPEC wants zero grazes, route the link as `M1270 340 L1650 820 L1850 940`: validated at **82.3 u** minimum centre clearance and **0** label-box grazes (validator §G). Mark this **COULD**, not SHOULD — it is the only link in the map that would need a non-straight `d` attribute, and `paintLinksOnly()` / `paint()` currently build every path as `M{a.x} {a.y} L{b.x} {b.y}` (engine.js L152, L156).

### 3.4 `fit()` change required

`fit()` (engine.js L521) computes its bbox from **node centres only**, `pad = 90`. The band union is `x[40, 1965] y[20, 1030]`, which exceeds the padded node bbox by **L10 / R25 / T50 / B0** units — so at maximum zoom-to-fit the outer edge of the Z1 and Z6 bands and the top 50 units of every band (i.e. the whole zone-label row) clip off-canvas. **Fix: union the band rects into `minx/miny/maxx/maxy` before computing `k`.** Four lines, no behaviour change when bands are hidden.

### 3.5 ASCII sketch

```
         Z1           Z2              Z3               Z4          Z5           Z6
     CUSTOMER    ACCESS NET    API & APP SVCS    DATA & CORE    PARTNER     BILLERS &
     FRONT-END                                   BACK-END       DELIV NET   SETTLEMENT
    [DEV TEAM]  [NETWORK TEAM]   [DEV TEAM]      [DEV + DBA]   [NETWORK TM] [PARTNER]
    +---------+--------------+-----------------+-------------+-----------+------------+
160 |         |              |          otp ---+-------------+--> smsgw  |            |
340 |         |              |   auth          | core -> mq  |           |            |
420 |         |              |    ^            |   |         |           |   biller   |
520 | client -+-> telco->edge+-> gw -> pay ----+---+---------+-->  \      |     ^      |
600 |         |              |         \       |   |          |    bhub -+-----+      |
700 |         |              |          \------+-> acct-> dbr |     | \  |     |      |
740 |         |              |                 |   |          |     |  \-+--> bbatch  |
940 |         |              |                 |   \----------+-----+----+--> recon   |
    +---------+--------------+-----------------+-------------+-----------+------------+
     x 40-235    x 245-625      x 635-1160      x 1170-1540   1550-1750   1760-1965
       DEV        NETWORK          DEV           DEV + DBA     NETWORK      PARTNER
```

Read the chip row left to right: **DEV · NETWORK · DEV · DEV+DBA · NETWORK · PARTNER.**

### 3.6 Validator

Script: `/home/claude/pulse204/research/zone_geometry_check.py` — run with `python3 zone_geometry_check.py`. It asserts (A) the 150/120 footprint rule over all 120 node pairs, (A2) no two rendered label boxes overlap, (B) every link segment ≥ 60 units from every non-endpoint node centre, (C) every node's rendered box inside its own band, (D) top-node headroom under the zone-label block, (E) advisory link-vs-label-box grazes, (F) the `fit()` envelope, (G) the optional dogleg.

**Final output (exit 0):**

```
A. NODE-PAIR FOOTPRINT  (need |dx|>=150 OR |dy|>=120)
       gw-pay    dx=170   dy=0     OK
     core-mq     dx=180   dy=0     OK
     acct-dbr    dx=180   dy=0     OK
    telco-edge   dx=190   dy=0     OK
   client-telco  dx=200   dy=0     OK
     edge-gw     dx=200   dy=0     OK
   -> 120 pairs checked, 0 failures

A2. RENDERED LABEL BOXES (advisory: text boxes must not overlap)
   -> 0 overlapping label boxes

B. LINK CLEARANCE  (every segment >= 60 from every non-endpoint centre)
     core -> recon   nearest non-endpoint: bhub       92.5  OK
     bhub -> recon   nearest non-endpoint: bbatch    101.4  OK
     core -> bhub    nearest non-endpoint: mq        101.6  OK
      pay -> bhub    nearest non-endpoint: dbr       120.6  OK
       gw -> auth    nearest non-endpoint: pay       123.6  OK
      pay -> core    nearest non-endpoint: auth      161.9  OK
     edge -> gw      nearest non-endpoint: pay       170.0  OK
      pay -> acct    nearest non-endpoint: gw        170.0  OK
     auth -> otp     nearest non-endpoint: pay       180.0  OK
       gw -> pay     nearest non-endpoint: auth      180.0  OK
      otp -> smsgw   nearest non-endpoint: core      180.0  OK
   client -> telco   nearest non-endpoint: edge      190.0  OK
     bhub -> bbatch  nearest non-endpoint: recon     200.0  OK
    telco -> edge    nearest non-endpoint: client    200.0  OK
     acct -> dbr     nearest non-endpoint: bhub      223.6  OK
     bhub -> biller  nearest non-endpoint: dbr       223.6  OK
     core -> mq      nearest non-endpoint: otp       269.1  OK
   -> 17 links checked, 0 failures

C. BAND CONTAINMENT  (label box inside own band)
   client Z1  x[   70.7,  209.3] in [40,235]   OK
    telco Z2  x[  269.8,  410.2] in [245,625]   OK
     edge Z2  x[  464.0,  596.0] in [245,625]   OK
       gw Z3  x[  683.2,  776.8] in [635,1160]   OK
     auth Z3  x[  827.1,  972.9] in [635,1160]   OK
      otp Z3  x[  999.8, 1140.2] in [635,1160]   OK
      pay Z3  x[  827.2,  972.8] in [635,1160]   OK
     core Z4  x[ 1202.5, 1337.5] in [1170,1540]   OK
       mq Z4  x[ 1379.8, 1520.2] in [1170,1540]   OK
     acct Z4  x[ 1207.9, 1332.1] in [1170,1540]   OK
      dbr Z4  x[ 1384.0, 1516.0] in [1170,1540]   OK
    smsgw Z5  x[ 1587.6, 1712.4] in [1550,1750]   OK
     bhub Z5  x[ 1572.0, 1728.0] in [1550,1750]   OK
   biller Z6  x[ 1766.8, 1933.2] in [1760,1965]   OK
   bbatch Z6  x[ 1782.4, 1917.6] in [1760,1965]   OK
    recon Z6  x[ 1790.6, 1909.4] in [1760,1965]   OK
   -> 0 failures

D. ZONE-LABEL HEADROOM  (node top extent must clear y=80 label block)
   highest node = otp at y=160; top extent y=124; clearance under label block = 44 units  OK

E. ADVISORY — link grazing a non-endpoint LABEL box (masked by bg stroke)
   E  core->recon grazes bhub's label box

F. fit() ENVELOPE
   node bbox      x[140,1850] y[160,940]  (+/-90 pad -> x[50,1940] y[70,1030])
   band union     x[40,1965] y[20,1030]
   -> bands exceed the padded node bbox by L10 R25 T50 B0 units: fit() MUST union BANDS into its bbox

G. DOGLEG CHECK — core->recon routed via waypoint (1650, 820)
   nearest non-endpoint centre: dbr at 82.3 (>= 60: OK)
   label-box grazes on the dogleg: 0  -> dogleg CLEARS the straight-line advisory

==================================================================
RESULT: PASS — 120 node pairs, 17 links, 16 containments, 0 hard violations.
        1 advisory label-box graze(s).
```

Tightest numbers in the design: **170 u** minimum horizontal node pitch (`gw`↔`pay`), **180 u** minimum vertical pitch on a shared column (`auth`↔`pay`), **92.5 u** worst link-to-node clearance (`core → recon` vs `bhub`) against a 60 u floor.

---

## §4 ZONE RENDERING SPEC

### 4.1 Where the bands live in the DOM

Insert **one new group as the first child of `#viewport`**, before `#links`:

```html
<g id="viewport"><g id="zones"></g><g id="links"></g><g id="nodes"></g></g>
```

`#zones` is inside `#viewport`, so it pans and zooms with everything else at zero extra cost — `applyView()` already transforms the group. Being first child puts bands **behind** links and nodes with no `z-index` gymnastics. `pointer-events:none` on `#zones` by default so bands never steal a drag from the canvas pan handler; re-enable only on the label group (§4.4).

Build it from a single `ZONES` array published on `window.ADEPTIO_DATA` (id, name, chip, members, band rect) so the SPEC, the dock and the docs all read one source.

### 4.2 Band styling — dark theme first

Six hues are **not** wanted: status colour is `--ok` / `--warn` / `--crit` and nothing else on this map may compete with it. Bands are therefore rendered in **one neutral ink at very low alpha**, differentiated by *label*, not by hue.

```css
/* zone bands — chrome, never status. One ink, alternating alpha. */
.zband      { fill: var(--zband-a); stroke: var(--zband-line); stroke-width: 1;
              vector-effect: non-scaling-stroke; rx: 14; }
.zband.alt  { fill: var(--zband-b); }
html[data-theme="dark"]  { --zband-a: rgba(174,182,194,.030);   /* --ink2 @ 3%  */
                           --zband-b: rgba(174,182,194,.055);   /* --ink2 @ 5.5%*/
                           --zband-line: rgba(174,182,194,.10); }
html[data-theme="light"] { --zband-a: rgba(59,68,82,.022);
                           --zband-b: rgba(59,68,82,.042);
                           --zband-line: rgba(59,68,82,.09); }
```

`Z1 / Z3 / Z5` take `.zband`, `Z2 / Z4 / Z6` take `.zband.alt` — the alternation alone separates six columns without a single new hue. `stroke-width:1` + `vector-effect:non-scaling-stroke` keeps the inner border a true hairline at every zoom level, matching how `.link` already behaves. `rx:14` echoes the 11–14 px radii used by `.legend` / `.hint` / `.dock`.

The bands sit on the existing `.grid-bg` 40 px lattice and the stage's radial `--panel2` wash; at 3 % alpha they read as a faint column tint, not a panel.

### 4.3 Zone label + owner chip

```css
.zlabel { fill: var(--muted); font-size: 10px; font-weight: 700;
          letter-spacing: .14em; text-transform: uppercase;
          font-family: var(--font); }
.zchip  { fill: var(--chipbg); stroke: var(--chipline); stroke-width: 1;
          vector-effect: non-scaling-stroke; }
.zchipt { fill: var(--chipink); font-size: 9.5px; font-weight: 700;
          letter-spacing: .06em; font-family: var(--mono); }
```

Reusing `--chipbg` / `--chipline` / `--chipink` means the owner pill is visibly the same object family as the existing `.navchip` and the pulse-mark badge, and it re-tints correctly in light theme for free. All four chips share one ink — **the chip's job is to name a team, not to grade a severity**, so a per-team colour would read as a fifth status. Differentiate by text only: `DEV TEAM`, `NETWORK TEAM`, `DEV + DBA`, `PARTNER`.

Geometry per zone: name text at `(band.x + 14, band.y + 30)`, chip rect at `(band.x + 13, band.y + 40)` sized `h = 19`, `rx = 9.5`, `w = 12 + 6.6 × len(chipText)`, chip text baseline at `(band.x + 22, band.y + 53.5)`. With `band.y = 20` that is name baseline `y = 50`, chip box `y = 60 → 79` — exactly the `y ≤ 80` block the validator reserves.

### 4.4 Interaction

- **SHOULD — hover a zone label → highlight members.** Pointer events on the label group only (name + chip, ~150 × 40 u), never the band body. On enter, add `.zdim` to every `.node` and `.link` whose endpoints are outside the zone (`opacity:.28; transition:opacity .18s`), and `.zhot` to members (`.body` stroke → `var(--chipink)`). On leave, clear. Honour `@media (prefers-reduced-motion: reduce)` and `html[data-motion="reduce"]` by dropping the transition, as `.mapctrl` already does.
- **SHOULD — click a zone label → filter the bottom Timeframe C table** to that zone's member nodes (`#cNode` currently takes one node id; extend it with six `zone:Zn` options). This is the single highest-value tie between the map and the dock, and it is what makes the zone chip actionable rather than decorative.
- **COULD — a `Zones` toggle button** beside `#tabtoggle` in the relocated `.mapctrl` cluster, persisting to `localStorage`. Default **on**.
- **COULD — zone name + owner chip echoed in the dock pane header**, on the line that already shows `pm`.
- **MUST NOT** — bands must never change colour with status. If a zone contains a crit node, the *nodes and links* already say so; tinting the band would double-count and would collide with the `--crit` drop-shadow `paint()` puts on the node body.

### 4.5 Legend card

Append one row to `buildLegend()` (engine.js L697), above the existing `.lgfoot` provenance line, in the same `.li` idiom:

```
Zones  ▸ Z1 Customer front-end · Z2 Access network · Z3 API & app services ·
         Z4 Data & core back-end · Z5 Partner delivery network · Z6 Billers & settlement
         — band tint = owning team; the chip is who runs the first command.
```

Render it as a `flex:0 0 100%` row with the same `border-top` treatment `.lgfoot` uses, so the legend card grows by exactly one wrapped line. `buildLegend()` is already re-invoked on theme toggle, so the row re-tints for free.

---

## §5 TEAM HANDOFF NARRATIVE (for docs)

> An operator watching the Pay Bill map at 02:40 need not know what a replica is. She needs to know who to wake.
>
> The line between `client` and `telco` goes red. She does not open a pane or guess. She reads the band the red line sits in, **Z2 ACCESS NETWORK**, and the chip under its name: **NETWORK TEAM**. That is the whole diagnosis step. She raises the network duty engineer with the zone's commands already written on the node: `curl -w`, `dns probe`, packet loss. Nobody phones a developer to ask whether DNS resolves.
>
> Twenty minutes later `otp` turns amber while every gateway indicator stays green. The red hop is `otp → smsgw`, and it lands in **Z5 PARTNER DELIVERY NET — NETWORK TEAM**: `smpp ping` first, is the carrier bind up. The DLR receipts behind it are flagged **PARTNER**, so the carrier ticket opens in parallel, not an hour later.
>
> Six zones, six chips, four teams. The map stopped being a picture of the estate and became a routing table: *where is it red → who owns that band → what do they type.* No agent, no APM, no guessing at ownership.

*(190 words)*

---

## §6 HANDOFF TO THE SPEC

Everything the orchestrator needs is numeric and above. Concretely, Spin 2.0.4 requires:

1. `data/manifest.js` — add a `zone` key to each of the 16 NODES; add a `ZONES` array (id, name, chip, members, band `{x,y,w,h}`); replace the 16 `x`/`y` pairs with §3.2. **No objective, INC, seed or `pm` string changes** — the seeded replay stays byte-identical.
2. `index.html` — one added group: `<g id="zones"></g>` as first child of `#viewport`.
3. `assets/engine.js` — a `buildZones()` beside `buildNodes()`/`buildLinks()`; union the band rects into `fit()`'s bbox (L521); one extra `.li` row in `buildLegend()` (L697).
4. `assets/styles.css` — the ~14 lines in §4.2 / §4.3 plus `.zdim` / `.zhot`.
5. `docs/capture-map.html` — its four-zone `OUTSIDE / DMZ / APP / DATA&PARTNERS` vocabulary is **retained as the estate view** and cross-referenced; the six session zones are the *operations* view. Both are true; they answer different questions, and the register in §1 maps every node to both.
