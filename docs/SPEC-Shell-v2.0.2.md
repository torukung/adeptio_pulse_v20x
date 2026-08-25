# SPEC — Platform Shell v2.0.2 ("one chrome")

v2.0.2 unifies every page of the Pulse demo site under ONE shell: the menus' `PulseShell`
upgraded, and adopted by the three hold-outs (front page, flow instrumentation, incident
trace). Research basis: benchmark study of Grafana / Datadog / Linear / Vercel / Honeycomb
(+ HN organic-sentiment corpus). Decisions confirmed by ToR 2026-08-23.

## 0. Locked decisions
1. **Brand-block + chevron** — the top-left lockup is one 56px unit: ECG mark + "adeptio·Pulse"
   wordmark (= home link) + a chevron button that collapses the sidebar. In rail state the mark
   itself is the expand control (Linear pattern). Logo never stops meaning home in expanded state.
2. **ECG motion** — trace draws once per page load (~1.6s), then a small status pip at the trace
   baseline beats every 2s (30bpm). Beating = seeded stream live. `prefers-reduced-motion` and
   `html[data-motion="reduce"]` show the completed trace + static pip.
3. **Full shell adoption** — index.html, flow-instrumentation.html, incident-trace.html render
   inside the shell. Their legacy chromes are hidden (not deleted) so the single-file build and
   protected markup survive.
4. **Extras** — ⌘K command palette (screens + actions, shortcut hints) and nav regroup into
   MAIN / HEALTH / RELIABILITY / INVESTIGATE / OPERATE. No kiosk mode, no PINNED group in v2.0.2.

## 1. Sidebar state machine
```
expanded  280px  mark+wordmark+chevron · group labels · icon+label links   default ≥1440px
rail       64px  mark(=expand btn) · icons only · tooltips · active bar    default 1024–1439px & front page
hidden      0px  opt-in (Shift+[) · reopen via floating ⟩ tab at left edge
<1024px         existing nav-off overlay drawer behavior preserved
```
- Exactly one of `nav-expanded | nav-rail | nav-hidden` on `#pshell`. CSS var `--pnavw` = 280px/64px/0.
- Persistence: `localStorage["pulse.nav.state"]`. Route seed: `mount({navDefault:'rail'})` applies
  ONLY when no stored value (front page passes it).
- Triggers: chevron click · `[` cycles expanded↔rail · `Shift+[` → hidden · click on the sidebar's
  right border (6px hit strip) toggles expanded↔rail · palette commands "Collapse/Expand Menu".
- Transitions: width 180ms cubic-bezier(.4,0,.2,1); labels fade 120ms (out before width, in after);
  all 0ms under reduced motion. After any state change: `setTimeout(()=>window.dispatchEvent(new Event('resize')),220)`.
- Rail: icons centered, `title` tooltips, 2px left accent bar marks the active item.

Interaction diagram — the three states and what moves between them:
```
  ┌───────────┐      ┌───────────┐    ┌───────────┐
  │ EXPANDED  │─────▶│   RAIL    │───▶│  HIDDEN   │
  │   280px   │◀─────│   64px    │    │    0px    │
  └───────────┘      └───────────┘    └───────────┘

  triggers
    expanded ↔ rail   chevron click · `[` · click the sidebar's own
                       right-hand border (6px hit strip) · palette
                       "Collapse/Expand Menu"
    → hidden          `Shift+[` — from EITHER expanded or rail
    hidden → expanded  the floating `⟩` reopen tab, or the palette's
                       "Expand Menu" — lands on EXPANDED (most
                       discoverable), as implemented and verified.

  <1024px: this whole machine is bypassed — the existing nav-off overlay
  drawer behavior (§0 "Extras") takes over regardless of the stored
  `pulse.nav.state`.
```

## 2. Brand block (both nav states)
```
EXPANDED                                RAIL
┌──────────────────────────────┐        ┌──────────┐
│ [ECG] adeptio·Pulse      [‹] │ 56px   │  [ECG]   │  mark = expand button
└──────────────────────────────┘        │   [›]    │  chevron under it (optional)
  └─ <a> home ─┘  └ toggle btn          └──────────┘
```
- `.pnav-brand` = `.pnb-home` (`<a href={home}>` mark+wordmark) + `.pnb-toggle`
  (`<button aria-expanded aria-controls="pnav" title="Collapse menu/Expand menu">`).
- Rail: wordmark hidden; the mark area acts as expand (S1 may implement as a second button
  shown only in rail). Chevron flips direction. Whole block animates as one unit.

## 3. ECG mark (in shell brand block; same SVG family as before)
- `.pulsemark .pm-trace` — on mount: `L=path.getTotalLength()`, dasharray/offset = L, animate
  offset→0, 1600ms cubic-bezier(0,0,.2,1), fill-mode both, run ONCE (no loop).
- `.pm-pip` — new tiny circle (r≈2.2) sitting at the trace's right end baseline; keyframes
  `scale 1→1.18→1, opacity 1→.7→1` over 600ms, every 2000ms, infinite; color = var(--ok).
- Reduced motion (either media query or `html[data-motion="reduce"]`): trace `stroke-dashoffset:0`,
  no animations, pip static.

## 4. Topbar v2 — one 56px global row (aligned with brand block → one continuous band)
```
[#pcrumb  Pulse › GROUP › Page] ····· [#pkbtn ⌘K] [#pstatus ●16 OK ·0 deg ·0 crit] [#pfresh] [#pthemebtn]
```
- Breadcrumb auto-derived from NAV (root "Pulse" links home). `mount({crumb:[...]})` may override.
  The front page reads `Pulse › MAIN › Front page` — consistent with every other page
  (as implemented and verified).
- `#pkbtn`: search-shaped button labeled "Search ⌘K" — opens palette.
- `#pstatus`: rendered by `PULSE_SHELL.status(ok,deg,crit)`; menus compute once from
  `ADEPTIO_DATA` (INC windows at t=N-1 → all clear → 16/0/0); the front page bridges live values.
- `#pfresh` freshness (exists). Theme toggle unchanged. Page-specific controls stay in each
  page's own header row (the existing in-content title/controls row = "page toolbar").

## 5. ⌘K command palette
- `PULSE_SHELL.palette.open()/close()`; Cmd/Ctrl+K toggles; Esc closes; focus trapped; restored on close.
- Sections: **Screens** (all NAV links, fuzzy-matched, icon + label + group hint) · **Actions**
  (Collapse/Expand menu · Toggle theme · Reduce motion on/off). Shortcut hints rendered right-aligned
  (`[`, `⌘K`…). ↑/↓/Enter; empty query shows all screens grouped. Recent-screens (localStorage
  `pulse.recent`, max 5) listed first. ES5-friendly, no dependencies, works over file://.

## 6. Nav regroup (final)
```
MAIN         Front page · Flow instrumentation
HEALTH       KPI Live · Service Health · Dependencies · Downstream Health
RELIABILITY  SLA Weekly · SLA Drill-down · Synthetic Insight
INVESTIGATE  Errors Explorer · Error Tracking · Customer Journey · Incident Trace
OPERATE      Ops Issues · Collectors & management
```
Paths/icons unchanged; only grouping/order changes. `isActive` logic untouched.

## 7. Page adoptions
### index.html (front page) — worker S2
- Mount shell with `{navDefault:'rail'}`. Legacy `.topbar` stays in markup but hidden by a
  page-local `<style>` rule (`.pshell-page .topbar{display:none}`) — the SF-STRIP single-file
  build (which strips shell) therefore still shows the original standalone topbar. assets/styles.css
  stays byte-identical.
- Bridge (inside SF-STRIP markers or guarded `if(window.PULSE_SHELL)`): engine's live status
  chips → `PULSE_SHELL.status(...)`; "as of / window ends" → `PULSE_SHELL.fresh(...)`. Engine keeps
  updating its hidden legacy elements too (don't remove engine logic).
- Map utility controls the hidden topbar loses (object search, zoom in/out, fullscreen, grid,
  theme) → a floating control cluster overlaid top-right of the map stage (Honeycomb pattern).
  Theme is in the shell; don't duplicate.
- Remove/hide the old SF-STRIP navchips + "Menus" launcher chip (sidebar replaces them) — but keep
  them RENDERED in the stripped single-file build (i.e. hide via the same `.pshell-page` scope).
- Engine must keep working at any `--pnavw`; verify map re-lays-out on sidebar toggle (shell fires resize).

### flow-instrumentation.html — worker S3 (frozen status ends, content untouched)
- Add tokens/shell css+js includes and mount the shell; the page's own `<header>` hidden via
  `.pshell-page` -scoped local style; its light "ledger" content lives inside `.pmain` as its own
  white sheet (keep the page's internal palette — document-in-platform look).
- Fix sticky offsets that assumed the old 54px header (chapnav etc.) with a page-local style when
  the shell is mounted. Chapter nav (chapnav) stays as in-page content nav.

### incident-trace.html + assets/portal.js — worker S3
- Mount shell; old `.p-top` hidden (markup kept). Its working controls move into a new page-toolbar
  row at the top of the content: search `#q`, `Create` `#createbtn`, board/list toggles, filters —
  KEEP the same element IDs so portal.js keeps binding; portal.js edits minimal (guard the now-hidden
  theme button `#themebtn` — shell owns theme).
- Breadcrumb shows Pulse › INVESTIGATE › Incident Trace. The week range line joins the page toolbar.

### menus/* + admin/collectors.html
- No per-file edits expected: they already mount the shell and inherit everything from S1.
  (If a page hardcodes group names in prose, leave prose as-is — only the nav itself regroups.)

## 8. Non-negotiables
- All pages work over `file://`, zero console errors, no fetch, no external assets, ES5-style script.
- `data/*` untouched. `assets/styles.css`, `assets/flow.css`, `assets/menus.css`, `assets/portal.css`
  byte-identical (page-local styles carry adoption CSS). tokens.css may gain shell vars only.
- Keyboard: `[`, `Shift+[`, `Cmd/Ctrl+K`, `Esc` — never trap other keys; don't steal keys while
  typing in inputs.
- Every animation honors `prefers-reduced-motion` AND `html[data-motion="reduce"]`.
- Public API back-compat: existing `PULSE_SHELL.mount/launcher/ready/getRange/setRange/…` keep working.

## 9. QA checklist

Reference — the shell's anatomy, one continuous frame regardless of page type:
```
┌────────────────────────────────────────────────────────────────────┐
│ pshell                                                             │
│ ┌────────┐ ┌────────────────────────────────────────────────────┐ │
│ │ pnav   │ │ ptop  [crumb]        [⌘K][status][fresh][theme]    │ │
│ │ brand  │ ├────────────────────────────────────────────────────┤ │
│ │ groups │ │ pmain   (page content · page toolbar · canvas)     │ │
│ │        │ ├────────────────────────────────────────────────────┤ │
│ │        │ │ pfoot                                              │ │
│ └────────┘ └────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
 nav-expanded 280px · nav-rail 64px · nav-hidden 0 (⟩ reopen tab)
```

Mirrors the assertions in `shell_checks.js` (worker S4's Playwright script, kept outside
this tree at `/home/claude/pulse/qa2/shell_checks.js`), run headless against all 17 built
pages — `index.html` · `flow-instrumentation.html` · `incident-trace.html` · the 11
`menus/*` pages · `admin/collectors.html` · `docs/dev/flow-lineage.html` ·
`docs/dev/_kit.html` — from `file://`, at 1728×1080:

1. **Zero console.** No console errors, no `pageerror` events, no failed requests.
2. **One shell.** Exactly one `.pnav-brand` and one `#pshell` per page — no double mount.
3. **Breadcrumb present.** `#pcrumb` renders non-empty text.
4. **ECG pip mounted.** `.pm-pip` exists in the DOM.
5. **Legacy chrome hidden, not gone.** On `index.html` / `flow-instrumentation.html` /
   `incident-trace.html`, the old `.topbar` / page `<header>` / `.p-top` is still present
   in the DOM but `offsetParent === null` (or computed `display:none`) — proof it was
   hidden, not deleted.
6. **Nav state persists.** Writing `localStorage["pulse.nav.state"] = "rail"` and reloading
   leaves `#pshell` carrying the `nav-rail` class — the stored state wins over any route
   default (e.g. the front page's `navDefault:'rail'` seed).
7. **Palette opens, closes, returns focus.** `Cmd/Ctrl+K` opens `#ppal`; `Esc` closes it and
   returns focus to whatever element held it before the palette opened.
8. **Reduced motion finishes the draw.** Under emulated `prefers-reduced-motion: reduce`,
   `.pm-trace`'s computed `stroke-dashoffset` reads `0` (or `none`) — the trace shows as
   already-drawn, never mid-animation. (Covers the media-query path only; the
   `html[data-motion="reduce"]` attribute override is not separately exercised by this
   check.)
9. **No horizontal overflow.** `document.documentElement.scrollWidth <= window.innerWidth`
   at 1728px, 1280px and 1024px wide.
10. **Status cluster is live.** On `index.html` only, `#pstatus` is non-empty roughly 2s
    after load — enough time for the engine bridge to have written a real reading.

Each check is independent and tolerant: a page failing one check fails that page in the
report, never the run. Read `shell_report.json` (one JSON object per page, all ten checks
plus pass/fail) and the `shots/` screenshots — `{index,flow,trace,sla-weekly}` ×
`{expanded,rail}` — for what a run actually found; this section is the checklist the
script mirrors, not a substitute for reading its output.
