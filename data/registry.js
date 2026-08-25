/* ============================================================================
 * ADEPTIO Pulse — DEMO SITE v2.0 · REGISTRY  (window.PULSE_REG)
 *
 * The account-agnostic reference model for a mobile-payment estate: journeys,
 * internal services, routes, downstreams, synthetic monitors, error groups,
 * domain result codes, thresholds, people, seeded ops issues and error-tracking
 * rows, collector sources and per-page data lineage.
 *
 * THIS IS THE ONLY FILE YOU EDIT TO RETARGET THE DEMO. Nothing here is a time
 * series: every number below is a DEFINITION (baseline, amplitude, threshold).
 * The series themselves are generated deterministically by data/spine.js and
 * shaped into page payloads by assets/synth.js.
 *
 * Load order:  data/manifest.js -> data/rcameta.js -> data/tickets.js ->
 *              data/registry.js -> data/spine.js -> assets/synth.js
 *
 * Classic script, no modules, no fetch: works from file://.
 * Timeline: 2016 steps x 5 min = 7 days (Aug 23..Aug 29), now = 2015. Every "date" in
 * this file is a TIMELINE INDEX into that week, never a wall clock — exactly
 * like data/tickets.js.
 * ==========================================================================*/
(function () {
  "use strict";

  var N = 2016, STEP_MIN = 5, DAY = 288, NOW = 2015;

  /* --------------------------------------------------------------------------
   * 1 · PEOPLE — reused verbatim from data/rcameta.js owners (MOCK names).
   * Keyed by the front-page node id so a PIC and a map node never drift apart.
   * ------------------------------------------------------------------------*/
  function P(name, team, ext) {
    return { name: name, team: team, ext: ext, mock: true,
             initials: name.replace(/^(U|Daw)\s+/, "").split(/\s+/).slice(0, 2)
                           .map(function (w) { return w[0]; }).join("").toUpperCase(),
             email: name.toLowerCase().replace(/^(u|daw)\s+/, "").replace(/\s+/g, ".") + "@example-bank.mm" };
  }
  var PEOPLE = {
    client: P("U Kyaw Zin Htun",   "Digital Channels",                        "411"),
    telco:  P("Daw Thiri Aung",    "Network Ops - Carrier Liaison",           "421"),
    edge:   P("U Myo Min Latt",    "Network Ops",                             "422"),
    gw:     P("Daw Ei Ei Khaing",  "Platform Engineering",                    "431"),
    auth:   P("U Zaw Lin Naing",   "Identity & Access",                       "441"),
    otp:    P("Daw Nwe Nwe Win",   "Identity & Access - Notify",              "442"),
    smsgw:  P("U Aung Ko Ko",      "Vendor Mgmt - SMS Aggregator Liaison",    "471"),
    pay:    P("Daw Su Myat Noe",   "Payments Squad",                          "451"),
    acct:   P("U Thant Zin Oo",    "Core Ops - Account Services",             "452"),
    dbr:    P("Daw Hnin Wai Phyo", "Data Platform - DBA",                     "461"),
    core:   P("U Soe Naing Win",   "Core Ops",                                "462"),
    bhub:   P("Daw Yamin Htay",    "Payments Squad - Biller Integrations",    "453"),
    biller: P("U Htet Aung Kyaw",  "Vendor Mgmt - Biller Partnerships",       "472"),
    bbatch: P("Daw Khin Mar Cho",  "Payments Ops - Settlement Files",         "473"),
    mq:     P("U Pyae Phyo Han",   "Platform Engineering - Messaging",        "432"),
    recon:  P("Daw Moe Moe Aye",   "Recon & Settlement Ops",                  "481")
  };

  /* --------------------------------------------------------------------------
   * 2 · THRESHOLDS — the objectives every menu scores against.
   * ------------------------------------------------------------------------*/
  var THRESHOLDS = {
    slaTarget: 99.90,          /* success = non-5xx ratio                     */
    responseTarget: 99.90,     /* response-time compliance = within T_ms      */
    availabilityTarget: 99.90, /* probe ratio, assertion in the numerator     */
    errorBudgetWindowDays: 7,
    /* colour bands, shared by every page ------------------------------------*/
    slaBands:  { ok: 99.90, warn: 99.00 },              /* >=ok green, >=warn amber, else red */
    latBands:  { ok: 0.25, warn: 1.00, severe: 3.33 },  /* multiples of T_ms  */
    errBands:  { ok: 0.10, warn: 1.00 },                /* error-rate %       */
    /* coverage / completeness rules (blueprint §07) -------------------------*/
    coverage:  { provisional: 0.98, nodata: 0.50 },
    /* auto-raised issue severity (blueprint §09) ----------------------------*/
    severity: [
      { key: "P1", label: "P1 CRITICAL - FIX THIS WEEK",     rule: "customer money at risk, or a critical journey below 80% for 15 min" },
      { key: "P2", label: "P2 HIGH - INVESTIGATE / TRACK",   rule: "SLO breached for the week, or 5xx up >100% week-over-week" },
      { key: "P3", label: "P3 MEDIUM - PLAN",                rule: "latency or error trend outside band but inside budget" },
      { key: "P4", label: "P4 LOW - BACKLOG",                rule: "hygiene, config drift, deprecated-client noise" }
    ],
    /* denominator decisions, printed on menu 1 so a % is never unqualified   */
    denominator: {
      excludes499: true, count429AsTechnical: true, excludeSynthetic: true,
      note: "499 client aborts excluded from the SLA denominator and counted as abandoned; 429 counts as a technical failure; probe traffic is tagged at source and excluded."
    }
  };

  /* --------------------------------------------------------------------------
   * 3 · JOURNEYS (6) — the KPI-live tabs and the customer-journey cards.
   * driver kinds on funnel steps: screen (UX only) | api (a route) | sms (DLR)
   * ------------------------------------------------------------------------*/
  var JOURNEYS = [
    { key: "login", name: "Login", svc: "auth", node: "auth", critical: true,
      sla: 99.90, T_ms: 1500, deploy: "pulse-auth-deploy",
      sessionsPerHour: 5200, appLens: null,
      steps: [
        { label: "Enter phone",  kind: "screen", screen: "Login",        pass: 0.985 },
        { label: "OTP sent",     kind: "api",    screen: "Login",        api: "POST /v1/otp/request" },
        { label: "Enter OTP",    kind: "sms",    screen: "OTP entry",    pass: 0.930, biggestDrop: true },
        { label: "Verify",       kind: "api",    screen: "OTP entry",    api: "POST /v1/otp/verify" },
        { label: "Logged in",    kind: "api",    screen: "Home",         api: "GET /v1/home" }
      ] },
    { key: "home", name: "Home", svc: "home-bff", node: "gw", critical: true,
      sla: 99.90, T_ms: 2500, deploy: "pulse-home-bff-deploy",
      sessionsPerHour: 18400, appLens: null,
      steps: [
        { label: "Open app",      kind: "screen", screen: "Splash",  pass: 0.994 },
        { label: "Session check", kind: "api",    screen: "Splash",  api: "POST /v1/auth/token/refresh" },
        { label: "Home loaded",   kind: "api",    screen: "Home",    api: "GET /v1/home" },
        { label: "Balance shown", kind: "api",    screen: "Home",    api: "GET /v1/accounts/balance" }
      ] },
    { key: "paybill", name: "Pay Bill", svc: "payment", node: "pay", critical: true,
      sla: 99.90, T_ms: 4500, deploy: "pulse-payment-deploy",
      sessionsPerHour: 3100, appLens: null,
      steps: [
        { label: "Open Pay Bill", kind: "screen", screen: "Biller list", pass: 0.972 },
        { label: "Biller list",   kind: "api",    screen: "Biller list", api: "GET /v1/billers" },
        { label: "Bill inquiry",  kind: "api",    screen: "Bill detail", api: "POST /v1/bills/inquire" },
        { label: "Confirm",       kind: "screen", screen: "Confirm",     pass: 0.945, biggestDrop: true },
        { label: "Payment posted",kind: "api",    screen: "Processing",  api: "POST /v1/bills/pay" },
        { label: "Receipt",       kind: "api",    screen: "Receipt",     api: "GET /v1/receipts/{id}" }
      ] },
    { key: "topup", name: "Top-up (Refill)", svc: "payment", node: "pay", critical: true,
      sla: 99.90, T_ms: 4500, deploy: "pulse-payment-deploy",
      sessionsPerHour: 2450, appLens: null,
      steps: [
        { label: "Open Refill",    kind: "screen", screen: "Refill",     pass: 0.978 },
        { label: "Products",       kind: "api",    screen: "Refill",     api: "GET /v1/topup/products" },
        { label: "Confirm amount", kind: "screen", screen: "Confirm",    pass: 0.950, biggestDrop: true },
        { label: "Purchase",       kind: "api",    screen: "Processing", api: "POST /v1/topup/purchase" },
        { label: "Delivered",      kind: "api",    screen: "Receipt",    api: "GET /v1/topup/{id}/status" }
      ] },
    { key: "package", name: "Package", svc: "package", node: "pay", critical: true,
      sla: 99.90, T_ms: 2500, deploy: "pulse-package-deploy",
      sessionsPerHour: 4300, appLens: null,
      steps: [
        { label: "Open Packages",  kind: "screen", screen: "Packages",  pass: 0.981 },
        { label: "Catalogue",      kind: "api",    screen: "Packages",  api: "GET /v1/packages" },
        { label: "Package detail", kind: "api",    screen: "Detail",    api: "GET /v1/packages/{id}" },
        { label: "Subscribe",      kind: "api",    screen: "Confirm",   api: "POST /v1/packages/subscribe" },
        { label: "Active",         kind: "api",    screen: "My packs",  api: "GET /v1/packages/mine" }
      ] },
    { key: "redeem", name: "Redeem", svc: "reward", node: "mq", critical: true,
      sla: 99.90, T_ms: 2500, deploy: "pulse-reward-deploy",
      sessionsPerHour: 1650, appLens: null,
      steps: [
        { label: "Open Rewards", kind: "screen", screen: "Rewards",   pass: 0.976 },
        { label: "Points",       kind: "api",    screen: "Rewards",   api: "GET /v1/rewards/points" },
        { label: "Catalogue",    kind: "api",    screen: "Catalogue", api: "GET /v1/rewards/catalog" },
        { label: "Redeem",       kind: "api",    screen: "Confirm",   api: "POST /v1/rewards/redeem" },
        { label: "Confirmed",    kind: "api",    screen: "History",   api: "GET /v1/rewards/history" }
      ] }
  ];

  /* --------------------------------------------------------------------------
   * 4 · INTERNAL SERVICES (12) — node_id is the join to the front-page map.
   * An archetype fans out: two services may share a node (blueprint §04).
   * ------------------------------------------------------------------------*/
  var SERVICES = [
    { key: "gateway",        name: "API Gateway",         deploy: "pulse-gateway-deploy",        zone: "dmz",      node: "gw",   critical: true,  lanes: ["L3", "L2", "L1"],
      note: "Every request in the estate crosses this deploy; the scorecard row counts only the routes the gateway serves DIRECTLY (the two /v2/ aggregation routes). Estate-wide ingress volume is the Total Requests tile." },
    { key: "auth",           name: "Auth & Session",      deploy: "pulse-auth-deploy",           zone: "app-zone", node: "auth", critical: true,  lanes: ["L3", "L1"] },
    { key: "otp",            name: "OTP Service",         deploy: "pulse-otp-deploy",            zone: "app-zone", node: "otp",  critical: true,  lanes: ["L3", "L1"] },
    { key: "profile",        name: "Customer Profile",    deploy: "pulse-profile-deploy",        zone: "app-zone", node: "acct", critical: false, lanes: ["L3"] },
    { key: "home-bff",       name: "Home BFF",            deploy: "pulse-home-bff-deploy",       zone: "app-zone", node: "gw",   critical: true,  lanes: ["L3", "L2"] },
    { key: "payment",        name: "Payment Orchestrator",deploy: "pulse-payment-deploy",        zone: "app-zone", node: "pay",  critical: true,  lanes: ["L3", "L6", "L1"] },
    { key: "accounts",       name: "Accounts & Balance",  deploy: "pulse-accounts-deploy",       zone: "app-zone", node: "acct", critical: true,  lanes: ["L3", "L6"] },
    { key: "biller-adapter", name: "Biller Adapter",      deploy: "pulse-biller-adapter-deploy", zone: "app-zone", node: "bhub", critical: true,  lanes: ["L3", "L1"] },
    { key: "package",        name: "Package Service",     deploy: "pulse-package-deploy",        zone: "app-zone", node: "pay",  critical: true,  lanes: ["L3"] },
    { key: "reward",         name: "Reward & Points",     deploy: "pulse-reward-deploy",         zone: "app-zone", node: "mq",   critical: true,  lanes: ["L3"] },
    { key: "notification",   name: "Notification Service",deploy: "pulse-notification-deploy",   zone: "app-zone", node: "otp",  critical: false, lanes: ["L3", "L2"] },
    { key: "core-adapter",   name: "Core Adapter",        deploy: "pulse-core-adapter-deploy",   zone: "app-zone", node: "core", critical: true,  lanes: ["L3", "L5", "L6"],
      note: "No ingress route template of its own: this service is measured on the EGRESS lane instead - requests are outbound calls, errors are upstream 5xx." }
  ];

  /* --------------------------------------------------------------------------
   * 5 · ROUTE GROUPS (8) and ROUTES (36) — menu 2's "8 groups · 36 APIs".
   *
   * inc = per-incident-window effect at PEAK severity (severity itself comes
   * from data/manifest.js INC through sevAt()):
   *    l  latency multiplier on p50 (the tail widens more than the median)
   *    t  ADDITIVE technical-failure rate (5xx + timeout + 499 per §07)
   *    b  ADDITIVE business-failure rate (4xx + domain declines on HTTP 200)
   *    bx business-failure MULTIPLIER on the baseline rate  (Incident A uses it)
   *    v  volume multiplier (traffic that never arrives during an outage)
   * ------------------------------------------------------------------------*/
  var GROUPS = [
    { key: "login",    name: "Login & Session",       journey: "login",    T_ms: 1500 },
    { key: "home",     name: "Home & Landing",        journey: "home",     T_ms: 2500 },
    { key: "billpay",  name: "Bill Payment",          journey: "paybill",  T_ms: 4500 },
    { key: "refill",   name: "Customer Refill",       journey: "topup",    T_ms: 4500 },
    { key: "package",  name: "Package Subscription",  journey: "package",  T_ms: 2500 },
    { key: "redeem",   name: "Redemption",            journey: "redeem",   T_ms: 2500 },
    { key: "profile",  name: "Profile & Account",     journey: "home",     T_ms: 2500 },
    { key: "notify",   name: "Notification & Receipts", journey: "home",   T_ms: 2500 }
  ];

  function R(group, svc, method, path, rps, p50, spread, e4, e5, T, inc, extra) {
    var g = null, i;
    for (i = 0; i < GROUPS.length; i++) { if (GROUPS[i].key === group) { g = GROUPS[i]; break; } }
    var o = { key: method + " " + path, method: method, path: path, group: group,
              groupName: g ? g.name : group, journey: g ? g.journey : null, svc: svc,
              rps: rps, p50: p50, spread: spread, e4: e4, e5: e5,
              T_ms: T || (g ? g.T_ms : 2500), inc: inc || {}, introducedAt: null, newInD: false };
    if (extra) { for (var k in extra) { if (Object.prototype.hasOwnProperty.call(extra, k)) o[k] = extra[k]; } }
    return o;
  }

  var ROUTES = [
    /* --- Login & Session (5) ------------------------------------------------*/
    R("login", "otp",  "POST", "/v1/otp/request",       1.60,  380, 2.8, 0.0090, 0.0006, 1500,
      { C: { l: 1.15 }, E: { l: 1.9, t: 0.012 }, F: { t: 0.58, l: 3.0, v: 0.62 } }),
    R("login", "otp",  "POST", "/v1/otp/verify",        1.45,  240, 2.5, 0.0350, 0.0005, 1500,
      { C: { b: 0.225 }, E: { l: 1.8, t: 0.010 }, F: { t: 0.55, l: 2.8, v: 0.62 } }),
    R("login", "auth", "POST", "/v1/auth/login",        1.30,  300, 2.6, 0.0280, 0.0007, 1500,
      { E: { l: 2.0, t: 0.014 }, F: { t: 0.60, l: 3.1, v: 0.60 }, G: { t: 0.060 } }),
    R("login", "auth", "POST", "/v1/auth/token/refresh",5.00,   60, 2.0, 0.0060, 0.0004, 1500,
      { E: { l: 1.7, t: 0.009 }, F: { t: 0.52, l: 2.6, v: 0.66 }, G: { t: 0.055 } }),
    R("login", "auth", "POST", "/v1/auth/logout",       0.65,   55, 1.8, 0.0030, 0.0003, 1500,
      { F: { t: 0.40, l: 2.2, v: 0.70 } }),

    /* --- Home & Landing (5) -------------------------------------------------*/
    R("home", "home-bff",     "GET", "/v1/home",                19.00, 210, 2.4, 0.0050, 0.0006, 2500,
      { B: { l: 1.55 }, E: { l: 1.9, t: 0.013 }, F: { t: 0.62, l: 3.2, v: 0.58 }, G: { t: 0.062 } }),
    R("home", "home-bff",     "GET", "/v1/home/banners",         8.50,  90, 2.2, 0.0040, 0.0005, 2500,
      { B: { l: 1.45 }, E: { l: 1.7, t: 0.010 }, F: { t: 0.55, l: 2.7, v: 0.58 }, G: { t: 0.055 } }),
    R("home", "accounts",     "GET", "/v1/accounts/balance",     10.50, 140, 2.6, 0.0055, 0.0007, 2500,
      { A: { l: 2.4, b: 0.010 }, B: { l: 1.60 }, E: { l: 1.6, t: 0.008 }, F: { t: 0.60, l: 3.0, v: 0.58 } }),
    R("home", "notification", "GET", "/v1/notifications/unread",  5.60,  70, 2.1, 0.0035, 0.0004, 2500,
      { E: { l: 1.5, t: 0.007 }, F: { t: 0.48, l: 2.4, v: 0.60 } }),
    R("home", "home-bff",     "GET", "/v1/config/features",       6.20,  45, 1.9, 0.0045, 0.0004, 2500,
      { B: { l: 1.35 }, F: { t: 0.45, l: 2.2, v: 0.60 } }),

    /* --- Bill Payment (6) ---------------------------------------------------*/
    R("billpay", "biller-adapter", "GET",  "/v1/billers",          1.85, 180, 2.3, 0.0060, 0.0008, 4500,
      { H: { t: 0.100, l: 1.8 }, F: { t: 0.58, l: 2.8, v: 0.60 } }),
    R("billpay", "biller-adapter", "POST", "/v1/bills/inquire",    1.60, 1150, 3.0, 0.0180, 0.0011, 4500,
      { H: { t: 0.180, l: 2.4 }, F: { t: 0.64, l: 3.0, v: 0.58 }, B: { l: 1.25 } }),
    R("billpay", "payment",        "POST", "/v1/bills/pay",        1.25, 1650, 3.2, 0.0210, 0.0012, 4500,
      { A: { bx: 8.5, l: 1.5 }, H: { t: 0.120, l: 2.0 }, I: { l: 2.2 },
        F: { t: 0.68, l: 3.4, v: 0.55 }, B: { l: 1.30 } }),
    R("billpay", "payment",        "GET",  "/v1/bills/{id}/status",1.45, 210, 2.4, 0.0070, 0.0006, 4500,
      { I: { l: 2.1 }, F: { t: 0.55, l: 2.6, v: 0.60 } }),
    R("billpay", "payment",        "GET",  "/v1/bills/history",    1.00, 260, 2.5, 0.0050, 0.0006, 4500,
      { B: { l: 1.70 }, F: { t: 0.50, l: 2.5, v: 0.62 } }),
    /* the two /v2/ routes are GATEWAY route-config additions: the Aug 29 deploy
       that introduced them is the same push that carried the ordering fault. */
    R("billpay", "gateway",        "POST", "/v2/bills/pay/confirm",0.26, 820, 2.9, 0.0150, 0.0009, 4500,
      { D: { t: 0.560, l: 1.9 } }, { introducedAt: 1908, newInD: true }),

    /* --- Customer Refill (4) ------------------------------------------------*/
    R("refill", "biller-adapter", "GET",  "/v1/topup/products",   1.15, 200, 2.3, 0.0055, 0.0007, 4500,
      { H: { t: 0.140, l: 2.0 }, F: { t: 0.56, l: 2.7, v: 0.60 } }),
    R("refill", "payment",        "POST", "/v1/topup/purchase",   0.85, 1400, 3.1, 0.0160, 0.0011, 4500,
      { A: { bx: 5.0 }, H: { t: 0.160, l: 2.2 }, F: { t: 0.66, l: 3.2, v: 0.56 } }),
    R("refill", "payment",        "GET",  "/v1/topup/{id}/status",0.80, 190, 2.3, 0.0060, 0.0006, 4500,
      { H: { t: 0.090, l: 1.6 }, F: { t: 0.52, l: 2.5, v: 0.60 } }),
    R("refill", "gateway",        "POST", "/v2/topup/quote",      0.20, 640, 2.7, 0.0130, 0.0008, 4500,
      { D: { t: 0.480, l: 1.8 } }, { introducedAt: 1908, newInD: true }),

    /* --- Package Subscription (5) -------------------------------------------*/
    R("package", "package", "GET",  "/v1/packages",           2.15, 175, 2.2, 0.0045, 0.0005, 2500,
      { B: { l: 1.62 }, F: { t: 0.54, l: 2.6, v: 0.60 } }),
    R("package", "package", "GET",  "/v1/packages/{id}",      1.50, 130, 2.1, 0.0090, 0.0005, 2500,
      { B: { l: 1.50 }, F: { t: 0.50, l: 2.5, v: 0.60 } }),
    R("package", "package", "POST", "/v1/packages/subscribe", 0.50, 780, 2.8, 0.0190, 0.0010, 2500,
      { F: { t: 0.62, l: 3.0, v: 0.58 }, B: { l: 1.35 } }),
    R("package", "package", "GET",  "/v1/packages/mine",      1.30, 150, 2.2, 0.0040, 0.0005, 2500,
      { B: { l: 1.48 }, F: { t: 0.48, l: 2.4, v: 0.60 } }),
    R("package", "package", "POST", "/v1/packages/cancel",    0.12, 420, 2.5, 0.0110, 0.0008, 2500,
      { F: { t: 0.52, l: 2.5, v: 0.60 } }),

    /* --- Redemption (4) -----------------------------------------------------*/
    R("redeem", "reward", "GET",  "/v1/rewards/catalog", 1.05, 165, 2.2, 0.0050, 0.0005, 2500,
      { B: { l: 1.40 }, F: { t: 0.50, l: 2.4, v: 0.60 } }),
    R("redeem", "reward", "GET",  "/v1/rewards/points",  1.70, 110, 2.0, 0.0035, 0.0004, 2500,
      { F: { t: 0.46, l: 2.2, v: 0.62 } }),
    R("redeem", "reward", "POST", "/v1/rewards/redeem",  0.36, 690, 2.7, 0.0300, 0.0009, 2500,
      { F: { t: 0.58, l: 2.8, v: 0.58 } }),
    R("redeem", "reward", "GET",  "/v1/rewards/history", 0.65, 145, 2.1, 0.0040, 0.0004, 2500,
      { F: { t: 0.44, l: 2.2, v: 0.62 } }),

    /* --- Profile & Account (4) ----------------------------------------------*/
    R("profile", "profile",  "GET", "/v1/profile",             2.00, 120, 2.0, 0.0040, 0.0004, 2500,
      { F: { t: 0.46, l: 2.3, v: 0.62 } }),
    R("profile", "profile",  "PUT", "/v1/profile",             0.22, 260, 2.4, 0.0220, 0.0008, 2500,
      { F: { t: 0.52, l: 2.5, v: 0.60 } }),
    R("profile", "accounts", "GET", "/v1/accounts/statement",  0.85, 340, 2.6, 0.0060, 0.0007, 2500,
      { A: { l: 1.9 }, B: { l: 1.75 }, F: { t: 0.54, l: 2.7, v: 0.60 } }),
    R("profile", "accounts", "GET", "/v1/accounts/list",       1.85, 130, 2.1, 0.0040, 0.0005, 2500,
      { A: { l: 1.7 }, B: { l: 1.45 }, F: { t: 0.50, l: 2.4, v: 0.60 } }),

    /* --- Notification & Receipts (3) ----------------------------------------*/
    R("notify", "notification", "GET",  "/v1/notifications",     2.40, 105, 2.0, 0.0035, 0.0004, 2500,
      { F: { t: 0.46, l: 2.2, v: 0.62 } }),
    R("notify", "notification", "POST", "/v1/notifications/ack", 1.15,  60, 1.8, 0.0030, 0.0003, 2500,
      { F: { t: 0.42, l: 2.0, v: 0.64 } }),
    R("notify", "notification", "GET",  "/v1/receipts/{id}",     0.58, 150, 2.2, 0.0080, 0.0006, 2500,
      { F: { t: 0.56, l: 2.6, v: 0.58 }, H: { t: 0.070 } })
  ];

  /* --------------------------------------------------------------------------
   * 6 · DOWNSTREAMS (12) — menus 6 and 7. One canonical edge fact per call.
   * inc effects: s5 additive 5xx rate · s4 additive 4xx rate · lat multiplier ·
   *              dlr additive delivery-receipt shortfall (sms-gateway only)
   * ------------------------------------------------------------------------*/
  var DOWNSTREAMS = [
    { key: "sms-gateway", name: "sms-gateway", host: "smpp.aggregator-a.mm", port: 2775, type: "external",
      callers: ["notification", "otp"], node: "smsgw", cpm: 420, s5: 0.0020, s4: 0.0040, lat: 480, dlr: 0.986,
      inc: { C: { s5: 0.050, lat: 2.2, dlr: 0.260 }, E: { lat: 1.6, dlr: 0.090 }, F: { s5: 0.250, lat: 2.0 } },
      endpoints: [
        { ep: "POST /submit_sm", caller: "otp",          share: 0.55 },
        { ep: "GET /dlr/poll",   caller: "notification", share: 0.30 },
        { ep: "POST /submit_sm/receipt", caller: "notification", share: 0.15 }
      ] },
    { key: "biller-hub", name: "biller-hub", host: "hub.example-biller.mm", port: 443, type: "external",
      callers: ["biller-adapter", "payment"], node: "bhub", cpm: 260, s5: 0.0025, s4: 0.0090, lat: 910,
      inc: { H: { s5: 0.220, lat: 2.6 }, F: { s5: 0.300, lat: 1.8 } },
      endpoints: [
        { ep: "POST /hub/v2/inquire", caller: "biller-adapter", share: 0.38 },
        { ep: "POST /hub/v2/credit",  caller: "payment",        share: 0.27 },
        { ep: "GET /hub/v2/billers",  caller: "biller-adapter", share: 0.22 },
        { ep: "GET /hub/v2/status",   caller: "payment",        share: 0.13 }
      ] },
    { key: "biller-YESC", name: "biller-YESC", host: "api.yesc-utility.mm", port: 443, type: "external",
      callers: ["biller-adapter"], node: "biller", cpm: 90, s5: 0.0030, s4: 0.0110, lat: 1240,
      inc: { H: { s5: 0.300, lat: 2.4 }, F: { s5: 0.120, lat: 1.4 } },
      endpoints: [
        { ep: "POST /yesc/bill/query", caller: "biller-adapter", share: 0.62 },
        { ep: "POST /yesc/bill/pay",   caller: "biller-adapter", share: 0.38 }
      ] },
    { key: "biller-MESC", name: "biller-MESC", host: "api.mesc-utility.mm", port: 443, type: "external",
      callers: ["biller-adapter"], node: "biller", cpm: 70, s5: 0.0028, s4: 0.0100, lat: 1080,
      inc: { H: { s5: 0.180, lat: 2.0 }, F: { s5: 0.100, lat: 1.4 } },
      endpoints: [
        { ep: "POST /mesc/bill/query", caller: "biller-adapter", share: 0.60 },
        { ep: "POST /mesc/bill/pay",   caller: "biller-adapter", share: 0.40 }
      ] },
    { key: "biller-ESE", name: "biller-ESE", host: "api.ese-telco.mm", port: 443, type: "external",
      callers: ["biller-adapter"], node: "biller", cpm: 55, s5: 0.0022, s4: 0.0085, lat: 760,
      inc: { H: { s5: 0.120, lat: 1.8 }, F: { s5: 0.090, lat: 1.3 } },
      endpoints: [
        { ep: "POST /ese/topup/quote",   caller: "biller-adapter", share: 0.54 },
        { ep: "POST /ese/topup/deliver", caller: "biller-adapter", share: 0.46 }
      ] },
    { key: "core-banking", name: "core-banking", host: "core-if.internal.mm", port: 8443, type: "internal",
      callers: ["core-adapter", "payment"], node: "core", cpm: 380, s5: 0.0015, s4: 0.0035, lat: 620,
      inc: { F: { s5: 0.620, lat: 3.4 }, I: { lat: 2.4 }, B: { lat: 1.5 } },
      endpoints: [
        { ep: "POST /core/posting",  caller: "payment",      share: 0.34 },
        { ep: "GET /core/balance",   caller: "core-adapter", share: 0.30 },
        { ep: "POST /core/journal",  caller: "core-adapter", share: 0.21 },
        { ep: "GET /core/heartbeat", caller: "core-adapter", share: 0.15 }
      ] },
    { key: "db-primary", name: "db-primary", host: "pg-primary.internal.mm", port: 5432, type: "internal",
      callers: ["payment", "accounts", "package", "reward", "profile"], node: "core", cpm: 1400, s5: 0.0006, s4: 0.0000, lat: 34,
      inc: { B: { lat: 1.9 }, F: { s5: 0.100, lat: 2.2 } },
      endpoints: [
        { ep: "SQL insert payment_saga", caller: "payment",  share: 0.42 },
        { ep: "SQL update balance_hold", caller: "accounts", share: 0.33 },
        { ep: "SQL insert audit_event",  caller: "package",  share: 0.25 }
      ] },
    { key: "db-replica", name: "db-replica", host: "pg-replica.internal.mm", port: 5432, type: "internal",
      callers: ["accounts", "home-bff", "profile"], node: "dbr", cpm: 2100, s5: 0.0005, s4: 0.0000, lat: 48,
      inc: { A: { lat: 2.8 }, B: { lat: 2.1 }, F: { lat: 1.8 } },
      endpoints: [
        { ep: "SQL select balance",   caller: "accounts", share: 0.46 },
        { ep: "SQL select home_tile", caller: "home-bff", share: 0.31 },
        { ep: "SQL select profile",   caller: "profile",  share: 0.23 }
      ] },
    { key: "redis-cache", name: "redis-cache", host: "redis.internal.mm", port: 6379, type: "internal",
      callers: ["auth", "home-bff", "gateway", "package"], node: "gw", cpm: 3200, s5: 0.0004, s4: 0.0000, lat: 3,
      inc: { F: { s5: 0.080, lat: 1.6 } },
      endpoints: [
        { ep: "GET session:*",  caller: "auth",     share: 0.58 },
        { ep: "GET homecache:*",caller: "home-bff", share: 0.42 }
      ] },
    { key: "mq-broker", name: "mq-broker", host: "mq.internal.mm", port: 5672, type: "internal",
      callers: ["notification", "payment", "core-adapter"], node: "mq", cpm: 640, s5: 0.0009, s4: 0.0000, lat: 26,
      inc: { F: { s5: 0.180, lat: 2.6 } },
      endpoints: [
        { ep: "PUBLISH payment.posted", caller: "payment",      share: 0.55 },
        { ep: "PUBLISH notify.receipt", caller: "notification", share: 0.45 }
      ] },
    { key: "kyc-service", name: "kyc-service", host: "kyc.example-partner.mm", port: 443, type: "external",
      callers: ["profile", "auth"], node: "bhub", cpm: 45, s5: 0.0035, s4: 0.0150, lat: 1450,
      inc: { F: { s5: 0.120, lat: 1.5 } },
      endpoints: [
        { ep: "POST /kyc/v1/verify", caller: "profile", share: 0.64 },
        { ep: "GET /kyc/v1/status",  caller: "auth",    share: 0.36 }
      ] },
    { key: "push-notify", name: "push-notify", host: "push.example-partner.mm", port: 443, type: "external",
      callers: ["notification"], node: "mq", cpm: 310, s5: 0.0026, s4: 0.0070, lat: 340,
      inc: { F: { s5: 0.200, lat: 1.7 } },
      endpoints: [
        { ep: "POST /push/v1/send",   caller: "notification", share: 0.72 },
        { ep: "GET /push/v1/receipt", caller: "notification", share: 0.28 }
      ] }
  ];

  /* --------------------------------------------------------------------------
   * 7 · SYNTHETIC MONITORS (23) — menu 5. L1 only, 5-minute interval.
   * Three httpbin-style control monitors always fail: they prove the prober is
   * alive and give the screen its permanent "3 down". Vantages cover all three.
   * inc value = additive probe-failure probability at peak severity.
   * ------------------------------------------------------------------------*/
  function M(id, name, method, url, vantage, node, svc, rt, assertion, inc, control) {
    return { id: id, name: name, method: method, url: url, interval: 5, vantage: vantage,
             node: node, svc: svc, rt: rt, assertion: assertion, inc: inc || {}, control: !!control };
  }
  var MONITORS = [
    M("m01", "Public API health",        "GET",  "https://api.example-bank.mm/health",              "dmz",      "gw",    "gateway",        180,  "status==200 and body.status=='UP'",        { F: 0.98, G: 0.55 }),
    M("m02", "Public API TLS + cert",    "GET",  "https://api.example-bank.mm/",                    "telco",    "edge",  "gateway",        420,  "tls_ok and cert_days_left>14",             { E: 0.35, F: 0.90, G: 0.50 }),
    M("m03", "DNS api.example-bank.mm",  "GET",  "dns://resolver-1.telco-a.mm/api.example-bank.mm", "telco",    "telco", "gateway",         38,  "answer in expected_vip_set",               { E: 0.30 }),
    M("m04", "Login (seeded account)",   "POST", "https://api.example-bank.mm/v1/auth/login",       "app-zone", "auth",  "auth",           640,  "status==200 and body.token != null",       { C: 0.15, E: 0.25, F: 0.97 }),
    M("m05", "OTP request",              "POST", "https://api.example-bank.mm/v1/otp/request",      "app-zone", "otp",   "otp",            720,  "status==200 and body.challengeId != null", { F: 0.95 }),
    M("m06", "OTP verify (seeded)",      "POST", "https://api.example-bank.mm/v1/otp/verify",       "app-zone", "otp",   "otp",            520,  "status==200 and body.verified==true",      { C: 0.55, F: 0.95 }),
    M("m07", "SMS delivery receipt",     "GET",  "https://api.example-bank.mm/v1/otp/dlr-probe",    "telco",    "smsgw", "notification",  2400,  "dlr.stat=='DELIVRD' within 45s",           { C: 0.62, E: 0.30, F: 0.50 }),
    M("m08", "Home landing",             "GET",  "https://api.example-bank.mm/v1/home",             "app-zone", "gw",    "home-bff",       380,  "status==200 and body.tiles.length>0",      { B: 0.05, E: 0.20, F: 0.97 }),
    M("m09", "Balance read (seeded)",    "GET",  "https://api.example-bank.mm/v1/accounts/balance", "app-zone", "acct",  "accounts",       300,  "status==200 and body.balance==seeded_value",{ A: 0.25, F: 0.96 }),
    M("m10", "Biller list",              "GET",  "https://api.example-bank.mm/v1/billers",          "app-zone", "bhub",  "biller-adapter", 340,  "status==200 and body.billers.length>=12",  { H: 0.35, F: 0.95 }),
    M("m11", "Bill inquiry (seeded)",    "POST", "https://api.example-bank.mm/v1/bills/inquire",    "app-zone", "bhub",  "biller-adapter",1650,  "status==200 and body.amountDue>0",         { H: 0.55, F: 0.95 }),
    M("m12", "Bill payment (reversed)",  "POST", "https://api.example-bank.mm/v1/bills/pay",        "app-zone", "pay",   "payment",       2350,  "status==200 and body.result=='POSTED'",    { A: 0.30, F: 0.98, I: 0.10 }),
    M("m13", "Top-up products",          "GET",  "https://api.example-bank.mm/v1/topup/products",   "app-zone", "bhub",  "biller-adapter", 320,  "status==200 and body.products.length>=6",  { H: 0.40, F: 0.95 }),
    M("m14", "Package catalogue",        "GET",  "https://api.example-bank.mm/v1/packages",         "app-zone", "pay",   "package",        290,  "status==200 and body.packages.length>=8",  { B: 0.05, F: 0.95 }),
    M("m15", "Rewards points",           "GET",  "https://api.example-bank.mm/v1/rewards/points",   "app-zone", "mq",    "reward",         210,  "status==200 and body.points>=0",           { F: 0.90 }),
    M("m16", "Edge VIP TCP 443",         "TCP",  "tcp://api.example-bank.mm:443",                   "dmz",      "edge",  "gateway",         42,  "connect_ms<250",                           { G: 0.50, F: 0.75 }),
    M("m17", "Core heartbeat txn",       "POST", "https://core-if.internal.mm/internal/heartbeat",  "app-zone", "core",  "core-adapter",   870,  "status==200 and body.posted==true",        { F: 0.99, I: 0.20, B: 0.05 }),
    M("m18", "Biller hub echo",          "GET",  "https://hub.example-biller.mm/echo",              "dmz",      "bhub",  "biller-adapter", 780,  "status==200 and body.echo=='pulse'",       { H: 0.45, F: 0.30 }),
    M("m19", "KYC service ping",         "GET",  "https://kyc.example-partner.mm/v1/ping",          "dmz",      "bhub",  "profile",       1180,  "status==200",                              { F: 0.25 }),
    M("m20", "Push notify partner",      "GET",  "https://push.example-partner.mm/health",          "dmz",      "mq",    "notification",   410,  "status==200 and body.state=='ok'",         { F: 0.35 }),
    M("m21", "Control - always 500",     "GET",  "https://httpbin.example-bank.mm/status/500",      "dmz",      "gw",    "gateway",        160,  "status==200 (deliberately unsatisfiable)", {}, true),
    M("m22", "Control - always 503",     "GET",  "https://httpbin.example-bank.mm/status/503",      "app-zone", "gw",    "gateway",        150,  "status==200 (deliberately unsatisfiable)", {}, true),
    M("m23", "Control - basic-auth 401", "GET",  "https://httpbin.example-bank.mm/basic-auth/pulse/probe", "telco", "telco", "gateway",    260,  "status==200 (no credential supplied)",     {}, true)
  ];

  /* --------------------------------------------------------------------------
   * 8 · ERROR GROUPS (52) — menu 8's EXCEPTIONS THROWN panels.
   * base = occurrences per hour at baseline; inc = multiplier at peak severity.
   * ------------------------------------------------------------------------*/
  function EG(id, svc, cls, msg, eps, base, inc, kind) {
    return { id: id, svc: svc, cls: cls, msg: msg, endpoints: eps, base: base,
             inc: inc || {}, kind: kind || "technical" };
  }
  var ERROR_GROUPS = [
    /* gateway (5) */
    EG("eg-gw-01", "gateway", "org.springframework.web.client.HttpServerErrorException$ServiceUnavailable", "503 Service Unavailable from upstream cluster {cluster}", ["POST /v1/bills/pay", "GET /v1/home"], 3.2, { F: 120, G: 24, D: 18 }),
    EG("eg-gw-02", "gateway", "java.net.SocketTimeoutException", "Read timed out after 30000 ms on upstream {upstream}", ["GET /v1/home", "POST /v1/bills/inquire"], 4.8, { F: 150, B: 3.5, H: 9 }),
    EG("eg-gw-03", "gateway", "org.springframework.web.bind.MissingRequestHeaderException", "Required request header 'X-Pulse-Trace' is not present", ["POST /v2/bills/pay/confirm", "POST /v2/topup/quote"], 0.6, { D: 88 }),
    EG("eg-gw-04", "gateway", "io.netty.handler.timeout.ReadTimeoutException", "ReadTimeoutException on route {route}", ["GET /v1/packages", "GET /v1/rewards/catalog"], 2.1, { F: 90, B: 2.8 }),
    EG("eg-gw-05", "gateway", "java.net.ConnectException", "Connection refused: no healthy pool member for {vip}", ["GET /v1/home", "POST /v1/auth/login"], 0.9, { G: 62, F: 70 }),
    EG("eg-gw-06", "gateway", "java.lang.IllegalStateException", "Route v2 rule ordering: no handler for {route} after the auth filter", ["POST /v2/bills/pay/confirm", "POST /v2/topup/quote"], 0.2, { D: 140 }),

    /* auth (4) */
    EG("eg-au-01", "auth", "redis.clients.jedis.exceptions.JedisConnectionException", "Could not get a resource from the pool", ["POST /v1/auth/token/refresh"], 1.4, { F: 95 }),
    EG("eg-au-02", "auth", "io.jsonwebtoken.ExpiredJwtException", "JWT expired at {exp}; clock skew {skew} ms", ["POST /v1/auth/token/refresh", "POST /v1/auth/logout"], 5.6, { F: 12, E: 2.4 }, "business"),
    EG("eg-au-03", "auth", "javax.net.ssl.SSLHandshakeException", "PKIX path validation failed on {host}", ["POST /v1/auth/login"], 0.4, { E: 22, F: 14 }),
    EG("eg-au-04", "auth", "org.springframework.dao.QueryTimeoutException", "Redis command timed out after 2000 ms", ["POST /v1/auth/login"], 1.0, { F: 70, B: 2.2 }),

    /* otp (4) */
    EG("eg-ot-01", "otp", "com.adeptio.otp.OtpDeliveryTimeoutException", "No DLR for challenge {cid} within 45 s on carrier {carrier}", ["POST /v1/otp/request"], 2.2, { C: 68, E: 14, F: 26 }),
    EG("eg-ot-02", "otp", "com.adeptio.otp.OtpExpiredException", "Challenge {cid} expired ({age} s > 180 s)", ["POST /v1/otp/verify"], 9.4, { C: 22, E: 3.1 }, "business"),
    EG("eg-ot-03", "otp", "java.net.SocketTimeoutException", "SMPP submit_sm timed out on bind {bind}", ["POST /v1/otp/request"], 1.1, { C: 34, F: 60, E: 6 }),
    EG("eg-ot-04", "otp", "java.lang.IllegalStateException", "Challenge store returned null for msisdn hash {h}", ["POST /v1/otp/verify"], 0.5, { F: 40 }),

    /* profile (3) */
    EG("eg-pr-01", "profile", "org.postgresql.util.PSQLException", "ERROR: canceling statement due to statement timeout", ["GET /v1/profile", "GET /v1/accounts/statement"], 0.8, { B: 5.5, F: 46 }),
    EG("eg-pr-02", "profile", "com.fasterxml.jackson.databind.exc.MismatchedInputException", "Cannot deserialize value of type `LocalDate` from String {v}", ["PUT /v1/profile"], 1.6, { }, "business"),
    EG("eg-pr-03", "profile", "org.apache.http.conn.HttpHostConnectException", "Connect to kyc.example-partner.mm:443 failed", ["GET /v1/profile"], 0.3, { F: 34 }),

    /* home-bff (3) */
    EG("eg-hb-01", "home-bff", "redis.clients.jedis.exceptions.JedisDataException", "WRONGTYPE Operation against a key holding the wrong kind of value", ["GET /v1/home"], 1.9, { F: 52 }),
    EG("eg-hb-02", "home-bff", "java.util.concurrent.TimeoutException", "Composite home tile fan-out exceeded 2500 ms budget", ["GET /v1/home", "GET /v1/home/banners"], 3.4, { B: 6.2, F: 88, E: 2.6 }),
    EG("eg-hb-03", "home-bff", "org.springframework.web.context.request.async.AsyncRequestNotUsableException", "ServletOutputStream failed to flush: client abort", ["GET /v1/home"], 6.1, { E: 9.5, F: 44 }),

    /* payment (10 - the biggest) */
    EG("eg-pa-01", "payment", "java.net.SocketTimeoutException", "Read timed out calling core-banking /core/posting", ["POST /v1/bills/pay", "POST /v1/topup/purchase"], 5.2, { F: 210, I: 6.5, B: 2.4 }),
    EG("eg-pa-02", "payment", "com.adeptio.pay.InsufficientFundsException", "Declined B-PAY-30018: available {avail} < amount {amt}", ["POST /v1/bills/pay"], 42.0, { A: 8.5 }, "business"),
    EG("eg-pa-03", "payment", "com.adeptio.pay.StaleBalanceAssertionError", "L3 assertion failed: replica balance {r} != primary {p} (lag {lag}s)", ["POST /v1/bills/pay", "GET /v1/accounts/balance"], 0.2, { A: 96 }),
    EG("eg-pa-04", "payment", "org.springframework.transaction.CannotCreateTransactionException", "Could not open JDBC Connection for transaction", ["POST /v1/bills/pay"], 1.1, { F: 130, B: 3.2 }),
    EG("eg-pa-05", "payment", "feign.RetryableException", "Connection reset executing POST http://biller-adapter/hub/v2/credit", ["POST /v1/bills/pay", "POST /v1/topup/purchase"], 2.4, { H: 42, F: 96 }),
    EG("eg-pa-06", "payment", "java.util.concurrent.TimeoutException", "Saga step CREDIT_LEG did not complete within 20000 ms", ["POST /v1/bills/pay"], 1.8, { H: 34, F: 88, I: 5.5 }),
    EG("eg-pa-07", "payment", "com.adeptio.pay.DuplicateIdempotencyKeyException", "Idempotency key {k} already consumed", ["POST /v1/bills/pay", "POST /v1/topup/purchase"], 3.6, { F: 12, D: 8 }, "business"),
    EG("eg-pa-08", "payment", "java.lang.NullPointerException", "Cannot invoke \"BillerRef.getCode()\" because \"ref\" is null", ["POST /v1/bills/pay"], 0.3, { D: 40 }),
    EG("eg-pa-09", "payment", "org.apache.kafka.common.errors.TimeoutException", "Expiring 3 record(s) for payment.posted-0: 30000 ms has passed", ["POST /v1/bills/pay"], 0.7, { F: 74 }),
    EG("eg-pa-10", "payment", "java.lang.ArithmeticException", "Rounding mode required for MMK minor-unit conversion", ["POST /v1/topup/purchase"], 0.4, { }, "business"),

    /* accounts (4) */
    EG("eg-ac-01", "accounts", "org.postgresql.util.PSQLException", "FATAL: remaining connection slots are reserved", ["GET /v1/accounts/balance"], 0.9, { A: 24, F: 78 }),
    EG("eg-ac-02", "accounts", "com.zaxxer.hikari.pool.HikariPool$PoolInitializationException", "Failed to initialize pool: connection timed out", ["GET /v1/accounts/balance", "GET /v1/accounts/list"], 0.5, { A: 30, F: 92 }),
    EG("eg-ac-03", "accounts", "org.springframework.dao.QueryTimeoutException", "Statement cancelled after 3000 ms on replica read", ["GET /v1/accounts/statement"], 1.6, { A: 18, B: 6.4, F: 56 }),
    EG("eg-ac-04", "accounts", "com.adeptio.acct.AccountNotFoundException", "Account {acc} not found for msisdn hash {h}", ["GET /v1/accounts/list"], 4.2, { }, "business"),

    /* biller-adapter (6) */
    EG("eg-bi-01", "biller-adapter", "java.net.SocketTimeoutException", "Read timed out calling hub.example-biller.mm/hub/v2/inquire", ["POST /v1/bills/inquire"], 3.1, { H: 62, F: 92 }),
    EG("eg-bi-02", "biller-adapter", "org.apache.http.conn.HttpHostConnectException", "Connect to api.yesc-utility.mm:443 timed out", ["POST /v1/bills/inquire", "GET /v1/billers"], 1.2, { H: 74, F: 40 }),
    EG("eg-bi-03", "biller-adapter", "com.adeptio.biller.BillerCutoffException", "Biller YESC closed for cut-off until {t}", ["POST /v1/bills/inquire"], 5.8, { I: 3.4 }, "business"),
    EG("eg-bi-04", "biller-adapter", "javax.net.ssl.SSLHandshakeException", "Received fatal alert: handshake_failure from api.mesc-utility.mm", ["GET /v1/billers"], 0.4, { H: 26 }),
    EG("eg-bi-05", "biller-adapter", "java.net.SocketException", "Connection reset by peer on hub keep-alive pool", ["GET /v1/topup/products"], 1.5, { H: 38, F: 52 }),
    EG("eg-bi-06", "biller-adapter", "java.lang.IllegalStateException", "Quote template missing denomination table for {carrier}", ["GET /v1/topup/products"], 0.2, { H: 30 }),

    /* package (3) */
    EG("eg-pk-01", "package", "java.util.concurrent.TimeoutException", "Catalogue cache refresh exceeded 1500 ms", ["GET /v1/packages"], 2.3, { B: 5.8, F: 60 }),
    EG("eg-pk-02", "package", "com.adeptio.pkg.PackageNotEligibleException", "B-PCK-30052: subscriber tier {tier} not eligible", ["POST /v1/packages/subscribe"], 7.5, { }, "business"),
    EG("eg-pk-03", "package", "org.postgresql.util.PSQLException", "deadlock detected on package_subscription", ["POST /v1/packages/subscribe"], 0.4, { F: 44 }),

    /* reward (3) */
    EG("eg-rw-01", "reward", "com.adeptio.rwd.InsufficientPointsException", "B-RWD-30071: points {have} < required {need}", ["POST /v1/rewards/redeem"], 8.9, { }, "business"),
    EG("eg-rw-02", "reward", "java.io.IOException", "Broken pipe writing redemption event to broker", ["POST /v1/rewards/redeem"], 0.6, { F: 68 }),
    EG("eg-rw-03", "reward", "java.lang.NullPointerException", "Cannot read field \"stock\" because \"item\" is null", ["GET /v1/rewards/catalog"], 0.9, { F: 20 }),

    /* notification (3) */
    EG("eg-nt-01", "notification", "java.net.SocketTimeoutException", "push.example-partner.mm did not respond within 5000 ms", ["GET /v1/notifications", "POST /v1/notifications/ack"], 2.7, { F: 86 }),
    EG("eg-nt-02", "notification", "org.apache.kafka.common.errors.TimeoutException", "Topic notify.receipt not present in metadata after 60000 ms", ["GET /v1/receipts/{id}"], 0.8, { F: 92 }),
    EG("eg-nt-03", "notification", "com.adeptio.notify.DlrMissingException", "No delivery receipt for message {mid} after 300 s", ["GET /v1/notifications"], 3.3, { C: 40, E: 8.5, F: 18 }),

    /* core-adapter (4) */
    EG("eg-co-01", "core-adapter", "java.net.SocketTimeoutException", "core-if.internal.mm:8443 read timeout on /core/posting", ["POST /v1/bills/pay"], 4.4, { F: 180, I: 7.2, B: 2.6 }),
    EG("eg-co-02", "core-adapter", "com.adeptio.core.CoreSessionUnavailableException", "T-COR-27109: no core session available (pool 0/24)", ["POST /v1/bills/pay", "GET /v1/bills/{id}/status"], 1.3, { F: 165 }),
    EG("eg-co-03", "core-adapter", "java.io.IOException", "Advice file /out/advice_{dfile}.psv rejected: unexpected trailer", ["GET /v1/bills/history"], 0.5, { I: 22, H: 9 }),
    EG("eg-co-04", "core-adapter", "org.springframework.web.util.NestedServletException", "Request processing failed; nested exception is java.net.SocketTimeoutException", ["POST /v1/bills/pay"], 2.0, { F: 120, I: 4.5 })
  ];

  /* --------------------------------------------------------------------------
   * 9 · DOMAIN RESULT CODES (43) — the B-/T- taxonomy. `http` is the status the
   * customer's client actually saw: a B- code on HTTP 200 is the decline that
   * appears in no status-code metric at all.
   * ------------------------------------------------------------------------*/
  function RC(code, svc, type, msg, http, base, inc) {
    return { code: code, svc: svc, type: type, message: msg, http: http, base: base, inc: inc || {} };
  }
  var RESULT_CODES = [
    RC("B-PAY-30018", "payment",        "B", "Insufficient funds",                       200, 38.0, { A: 8.5 }),
    RC("B-PAY-30021", "payment",        "B", "Daily transaction limit exceeded",         200,  9.2, { }),
    RC("B-PAY-30024", "payment",        "B", "Duplicate payment reference",              409,  3.4, { D: 4.0 }),
    RC("B-PAY-30031", "payment",        "B", "Account frozen or restricted",             200,  2.1, { }),
    RC("B-PAY-30044", "payment",        "B", "Bill already paid for this period",        200,  6.8, { }),
    RC("B-PAY-30052", "payment",        "B", "Amount below biller minimum",              400,  4.5, { }),
    RC("B-BIL-31007", "biller-adapter", "B", "Biller reference not found",               404,  5.6, { H: 2.2 }),
    RC("B-BIL-31012", "biller-adapter", "B", "Biller closed for cut-off",                200,  4.9, { I: 3.4 }),
    RC("B-BIL-31019", "biller-adapter", "B", "Invalid customer account for this biller", 400,  7.1, { }),
    RC("B-OTP-41002", "otp",            "B", "OTP expired",                              400,  9.4, { C: 22 }),
    RC("B-OTP-41005", "otp",            "B", "OTP attempt limit reached",                403,  2.8, { C: 14 }),
    RC("B-OTP-41008", "otp",            "B", "OTP code mismatch",                        400, 12.6, { C: 6.5 }),
    RC("B-AUT-42001", "auth",           "B", "Credentials rejected",                     401, 15.2, { }),
    RC("B-AUT-42006", "auth",           "B", "Account locked after repeated failures",   403,  3.1, { }),
    RC("B-AUT-42011", "auth",           "B", "MSISDN not registered",                    404,  4.7, { }),
    RC("B-PCK-30052", "package",        "B", "Package not eligible for this tier",       200,  7.5, { }),
    RC("B-PCK-30058", "package",        "B", "Package already active",                   409,  3.9, { }),
    RC("B-PCK-30061", "package",        "B", "Insufficient balance for package",         200,  5.2, { A: 3.1 }),
    RC("B-RWD-30071", "reward",         "B", "Not enough points",                        200,  8.9, { }),
    RC("B-RWD-30074", "reward",         "B", "Reward out of stock",                      200,  2.6, { }),
    RC("B-RWD-30079", "reward",         "B", "Redemption window closed",                 200,  1.4, { }),
    RC("B-TOP-32004", "payment",        "B", "Top-up denomination unavailable",          400,  3.3, { H: 2.6 }),
    RC("B-TOP-32009", "payment",        "B", "Recipient MSISDN invalid",                 400,  6.0, { }),
    RC("B-ACC-33002", "accounts",       "B", "Account not found",                        404,  4.2, { }),
    RC("B-ACC-33006", "accounts",       "B", "Statement period out of range",            400,  1.9, { }),
    RC("B-PRF-34003", "profile",        "B", "Profile field validation failed",          400,  5.4, { }),
    RC("T-COR-27101", "core-adapter",   "T", "Core timeout",                             504,  4.4, { F: 180, I: 7.2 }),
    RC("T-COR-27104", "core-adapter",   "T", "Core posting rejected",                    502,  1.1, { F: 95 }),
    RC("T-COR-27109", "core-adapter",   "T", "Core session unavailable",                 503,  1.3, { F: 165 }),
    RC("T-GWY-27201", "gateway",        "T", "Upstream connect failure",                 502,  0.9, { G: 62, F: 70 }),
    RC("T-GWY-27204", "gateway",        "T", "Rate limit exceeded",                      429,  6.4, { F: 8.5, E: 2.2 }),
    RC("T-GWY-27208", "gateway",        "T", "Route not found (config drift)",           404,  0.6, { D: 88 }),
    RC("T-GWY-27212", "gateway",        "T", "Upstream read timeout",                    504,  4.8, { F: 150, H: 9 }),
    RC("T-DBR-27301", "accounts",       "T", "Read replica timeout",                     500,  1.6, { A: 18, B: 6.4, F: 56 }),
    RC("T-DBR-27305", "accounts",       "T", "Connection pool exhausted",                503,  0.5, { A: 30, F: 92 }),
    RC("T-BHB-27401", "biller-adapter", "T", "Biller hub timeout",                       504,  3.1, { H: 62, F: 92 }),
    RC("T-BHB-27405", "biller-adapter", "T", "Biller adapter unavailable",               503,  1.2, { H: 74, F: 40 }),
    RC("T-SMS-27501", "notification",   "T", "SMS submit failed",                        502,  1.1, { C: 34, F: 60 }),
    RC("T-SMS-27504", "notification",   "T", "Delivery receipt not received in window",  200,  3.3, { C: 40, E: 8.5 }),
    RC("T-MQB-27601", "notification",   "T", "Broker publish timeout",                   500,  0.8, { F: 92 }),
    RC("T-CCH-27701", "home-bff",       "T", "Cache read failure",                       500,  1.9, { F: 52 }),
    RC("T-AUT-77002", "auth",           "T", "Token signing key unavailable",            503,  0.4, { F: 46 }),
    RC("T-PRF-27801", "profile",        "T", "Profile store write conflict",             500,  0.8, { B: 5.5, F: 46 })
  ];

  /* --------------------------------------------------------------------------
   * 10 · OPS ISSUES (25) — menu 10. Every row states where it came from.
   * source is one of: errors-explorer | sla-report | ops-review | synthetic |
   * journey.  eta / created / updated are TIMELINE INDICES.
   * ------------------------------------------------------------------------*/
  function OI(id, sev, status, title, svc, route, source, pic, created, eta, incKey, node, desc, decision, cmt) {
    return { id: id, sev: sev, status: status, title: title, svc: svc, route: route || null,
             source: source, pic: pic, created: created, updated: created + 6, eta: eta,
             incKey: incKey || null, node: node, desc: desc, decision: decision || "",
             comments: cmt || 0, cc: [] };
  }
  var OPS_ISSUES = [
    OI("OPS-001", "P1", "in progress", "payment - POST /v1/bills/pay: HTTP 200 declines 7x baseline while 5xx stays flat", "payment", "POST /v1/bills/pay", "errors-explorer", "dbr", 430, 1980, "A", "dbr",
       "Replication lag on the balance replica pushed the available balance behind the primary. The payment path answered HTTP 200 throughout and declined funded customers with B-PAY-30018. Nothing in a status-code metric moved: the whole signal is in the domain result code.\n\nThis is the L3 signature - front of the path green, data layer red.",
       "Balance reads move to the primary above a 30 s lag watermark; the L3 stale-read assertion becomes a paging objective.", 6),
    OI("OPS-002", "P1", "resolved", "core-adapter - core outage cascade: 5xx storm across every journey", "core-adapter", null, "ops-review", "core", 1386, 1500, "F", "core",
       "Failed core failover took the posting path down for roughly seven hours from Aug 27 19:00. Every journey went red, exceptions were dominated by java.net.SocketTimeoutException, and all synthetic monitors failed except external DNS.\n\nThe storage-latency ramp (WK34 · Incident B) peaked exactly as the failover was attempted - the creep is the reason the failover did not take.",
       "Failover rehearsal added to the quarterly calendar with the storage latency objective as a go/no-go gate.", 11),
    OI("OPS-003", "P2", "open", "gateway - POST /v2/bills/pay/confirm: 5xx +127% WoW after the Aug 29 route push", "gateway", "POST /v2/bills/pay/confirm", "errors-explorer", "gw", 1936, 2100, "D", "gw",
       "The Aug 29 evening route-config push introduced two /v2/ routes and a rule-ordering fault. Both new routes returned 5xx sharply for about 30 minutes and recovered on rollback. The WoW figure is dominated by a population that did not exist last week - read it with the introduced-at date, not on its own.",
       "", 4),
    OI("OPS-004", "P2", "in progress", "biller-adapter - POST /v1/bills/inquire: biller-hub timeouts and 504s", "biller-adapter", "POST /v1/bills/inquire", "sla-report", "bhub", 1792, 2040, "H", "bhub",
       "Aggregator brownout on Aug 29 morning. Inquire and top-up product reads carried the load; hub 5xx reached 22% at peak and YESC was the worst single biller.\n\nPer-adapter evidence attached to the vendor case.",
       "", 5),
    OI("OPS-005", "P1", "decided", "accounts - GET /v1/accounts/balance: seeded-account assertion failed 6 times in 5 min", "accounts", "GET /v1/accounts/balance", "journey", "acct", 424, 1900, "A", "acct",
       "The L3 seeded-account assertion compares the balance the API returns against the known seeded value. Six consecutive failures inside WK34 · Incident A, with HTTP 200 on every one of them.",
       "Assertion promoted from report-only to alerting; the balance probe now runs at 1-minute precision.", 3),
    OI("OPS-006", "P2", "discussing", "home-bff - GET /v1/home: p95 up 55% over 36 hours with no error movement", "home-bff", "GET /v1/home", "sla-report", "dbr", 1000, 1860, "B", "dbr",
       "A slow ramp on read-heavy routes with a completely flat error rate - the boiling-frog precursor. Storage IO latency on the replica estate is the driver; the response-time SLI degrades long before any availability number does.",
       "", 4),
    OI("OPS-007", "P3", "open", "otp - POST /v1/otp/verify: verify success 73% on one carrier for 2.5 hours", "otp", "POST /v1/otp/verify", "synthetic", "smsgw", 60, 1780, "C", "smsgw",
       "OTP request returned 2xx throughout; the codes simply did not arrive. The customer-visible symptom is an OTP screen that times out, and the funnel shows the loss at 'Enter OTP', not at the verify call.",
       "", 4),
    OI("OPS-008", "P2", "open", "gateway - 502s at the public VIP while 2 of 4 LB pool members were down", "gateway", "GET /v1/home", "synthetic", "edge", 1606, 1990, "G", "edge",
       "Brief availability dips on Aug 28 afternoon. The dmz-vantage probes saw it; the app-zone probes did not, which is exactly the split that proves the fault was in front of the gateway.",
       "", 3),
    OI("OPS-009", "P3", "open", "core-adapter - EOD batch overrun 48 min: pending-age p95 breached", "core-adapter", "GET /v1/bills/{id}/status", "ops-review", "core", 1704, 1960, "I", "core",
       "Planned-window context: the batch ran long on Aug 28 night. No 5xx at all - the symptom is completion lag and pending age, which only the outcome objective sees.",
       "", 2),
    OI("OPS-010", "P2", "open", "payment - GET /v1/bills/history issues 14 replica queries per request (N+1)", "payment", "GET /v1/bills/history", "ops-review", "dbr", 1120, 2120, null, "dbr",
       "Engineering finding from the weekly review: the history endpoint fans out one query per row instead of a single batched read. It is invisible at baseline and becomes the dominant cost the moment replica latency moves.",
       "", 3),
    OI("OPS-011", "P3", "open", "package - GET /v1/packages: catalogue cache miss ratio 41%", "package", "GET /v1/packages", "errors-explorer", "pay", 940, 2160, null, "pay",
       "Cache refresh timeouts push the catalogue read to the primary. Correlates with the storage ramp but is a configuration problem in its own right.",
       "", 2),
    OI("OPS-012", "P4", "won't fix", "profile - PUT /v1/profile: 400s from a deprecated client build", "profile", "PUT /v1/profile", "errors-explorer", "acct", 300, null, null, "acct",
       "MismatchedInputException on a date field from builds older than the last two releases. Volume is small and falling with adoption.",
       "Closed as won't fix - the affected build is below the support floor.", 1),
    OI("OPS-013", "P2", "open", "notification - receipts delayed 41 min during the core outage", "notification", "GET /v1/receipts/{id}", "journey", "mq", 1400, 2040, "F", "mq",
       "Broker publish timeouts during WK34 · Incident F left the receipt fan-out behind. The money was correct; the customer could not see it. That distinction belongs in the incident note, not in the availability number.",
       "", 3),
    OI("OPS-014", "P3", "in progress", "reward - B-RWD-30071 spike after the catalogue change", "reward", "POST /v1/rewards/redeem", "errors-explorer", "mq", 820, 2080, null, "mq",
       "Points thresholds changed with the new catalogue and the client still shows the old requirement, so customers reach the confirm screen and are declined. A business error with no technical symptom whatsoever.",
       "", 2),
    OI("OPS-015", "P1", "open", "payment - 11 debits awaiting credit at the WK34 · Incident F peak", "payment", "POST /v1/bills/pay", "ops-review", "biller", 1400, 1990, "F", "biller",
       "Money-movement exposure: debits posted at core with no confirmed credit leg. Every one is a customer-visible failure that no HTTP status describes.",
       "", 7),
    OI("OPS-016", "P3", "open", "auth - token refresh 401 storm traced to clock skew on two nodes", "auth", "POST /v1/auth/token/refresh", "errors-explorer", "auth", 640, 2100, null, "auth",
       "ExpiredJwtException with a negative skew on two ingress nodes. Chrony was not running after the last rebuild.",
       "", 2),
    OI("OPS-017", "P4", "open", "synthetic - three control monitors fail permanently by design", "gateway", null, "synthetic", "gw", 120, null, null, "gw",
       "The httpbin-style control monitors (500, 503, basic-auth 401) are deliberately unsatisfiable: they prove the prober itself is alive and that a failure renders as a failure. They must stay out of the availability tile and be documented so the standing '3 down' is never mistaken for an outage.",
       "Documented; excluded from the availability denominator.", 1),
    OI("OPS-018", "P3", "open", "biller-adapter - 90-minute collector gap on Aug 26 leaves coverage at 0.94", "biller-adapter", null, "ops-review", "bhub", 1030, 2000, null, "bhub",
       "The biller-adapter log shipper stopped for 90 minutes on Aug 26. Those buckets are UNKNOWN, not zero: menus 1, 2 and 9 render them grey and mark the affected cells provisional rather than quietly averaging over them.",
       "", 2),
    OI("OPS-019", "P2", "open", "accounts - connection pool saturation 72% at the WK34 · Incident F peak", "accounts", "GET /v1/accounts/balance", "sla-report", "acct", 1396, 2060, "F", "acct",
       "HikariPool initialisation failures under the retry storm. Pool sizing and the retry budget need to be settled together, not separately.",
       "", 3),
    OI("OPS-020", "P4", "resolved", "home-bff - GET /v1/config/features 404s after a config push", "home-bff", "GET /v1/config/features", "errors-explorer", "gw", 520, 900, null, "gw",
       "Route drift, not a resource 404 - the blueprint's rule puts this in the technical class. Corrected in the following push.",
       "Fixed in the next config release.", 2),
    OI("OPS-021", "P3", "open", "otp - SMS time-to-deliver p90 above 45 s on carrier A", "otp", "POST /v1/otp/request", "synthetic", "smsgw", 66, 2120, "C", "smsgw",
       "Vendor-side. The telco-vantage probe is the only lane that sees this at all - no log in the estate can.",
       "", 2),
    OI("OPS-022", "P2", "open", "payment - 6 top-up credit legs unconfirmed after the aggregator brownout", "payment", "POST /v1/topup/purchase", "journey", "biller", 1820, 2040, "H", "biller",
       "Purchases accepted, deliveries unconfirmed. The advice-file cycle will either resolve them or turn them into settlement exceptions.",
       "", 4),
    OI("OPS-023", "P3", "open", "gateway - 429 rejections at 0.18% against a 0.10% band", "gateway", "GET /v1/home", "sla-report", "gw", 1240, 2140, null, "gw",
       "Rate-limit rejections count as technical failures under the standing rule, so they land in the SLA denominator. The band is the question, not the code.",
       "", 1),
    OI("OPS-024", "P4", "open", "gateway - untemplated path variants pushing 2.4% of volume into 'other'", "gateway", "GET /v1/packages/{id}", "ops-review", "gw", 700, 2180, null, "gw",
       "Route templating drift. Above 2% the drill-down starts lying about which API is failing, so this is a data-quality issue rather than a performance one.",
       "", 2),
    OI("OPS-025", "P2", "open", "core-adapter - posting p95 1.9 s during the storage ramp", "core-adapter", "POST /v1/bills/pay", "sla-report", "core", 1180, 2100, "B", "core",
       "Posting latency tracks the storage creep one-for-one. It is the same root cause as OPS-006 seen from the money side.",
       "", 3)
  ];

  /* --------------------------------------------------------------------------
   * 11 · ERROR-TRACKING SEED (43 rows, one per result code) — menu 11.
   * Counts, SLA% and progress denominators are computed from the spine.
   * ------------------------------------------------------------------------*/
  var ET_STATUS = ["Backlog", "To Do", "In Progress", "Done"];
  var ERROR_TRACKING = (function () {
    var rows = [], statusPlan = {
      "B-PAY-30018": ["In Progress", "P1", 2, 3, 1980, "INC-1018"],
      "T-COR-27101": ["Done",        "P1", 3, 3, 1500, "INC-1030"],
      "T-COR-27109": ["Done",        "P1", 3, 3, 1500, "INC-1030"],
      "T-GWY-27208": ["To Do",       "P2", 0, 2, 2100, "INC-1042"],
      "T-BHB-27401": ["In Progress", "P2", 1, 2, 2040, "INC-1039"],
      "T-BHB-27405": ["In Progress", "P2", 1, 2, 2040, "INC-1039"],
      "B-OTP-41002": ["Done",        "P3", 2, 2,   96, "INC-1012"],
      "T-SMS-27504": ["Done",        "P3", 2, 2,   96, "INC-1012"],
      "T-DBR-27301": ["In Progress", "P2", 1, 3, 1900, "INC-1027"],
      "T-DBR-27305": ["To Do",       "P2", 0, 2, 2060, "INC-1030"],
      "T-GWY-27201": ["To Do",       "P3", 0, 2, 1990, "INC-1034"],
      "T-GWY-27212": ["In Progress", "P2", 1, 2, 2040, null],
      "B-RWD-30071": ["In Progress", "P3", 1, 2, 2080, null],
      "B-PCK-30052": ["Backlog",     "P4", 0, 1, null, null],
      "T-CCH-27701": ["To Do",       "P3", 0, 2, 2120, null],
      "T-AUT-77002": ["Backlog",     "P4", 0, 1, null, null],
      "T-MQB-27601": ["To Do",       "P3", 0, 2, 2040, "INC-1030"],
      "T-PRF-27801": ["Backlog",     "P4", 0, 1, null, null],
      "T-SMS-27501": ["Done",        "P3", 2, 2,   96, "INC-1012"],
      "T-GWY-27204": ["Backlog",     "P3", 0, 2, 2140, null],
      "T-COR-27104": ["Done",        "P2", 2, 2, 1500, "INC-1030"]
    };
    var pics = ["pay", "core", "gw", "bhub", "acct", "otp", "auth", "mq", "dbr", "smsgw"];
    for (var i = 0; i < RESULT_CODES.length; i++) {
      var rc = RESULT_CODES[i], plan = statusPlan[rc.code];
      rows.push({
        n: i + 1, code: rc.code, type: rc.type === "B" ? "Biz" : "Tech", svc: rc.svc,
        message: rc.message,
        status: plan ? plan[0] : (rc.type === "B" ? "Backlog" : "To Do"),
        priority: plan ? plan[1] : (rc.type === "B" ? "P4" : "P3"),
        progress: plan ? [plan[2], plan[3]] : [0, rc.type === "B" ? 1 : 2],
        eta: plan ? plan[4] : null,
        pic: pics[i % pics.length],
        link: plan ? plan[5] : null,
        cmt: (i * 7) % 5
      });
    }
    return rows;
  }());

  /* --------------------------------------------------------------------------
   * 12 · COLLECTOR SOURCES (16 archetypes) — admin/collectors.html.
   * state pipeline: arrives -> parses -> computes -> live.
   * ------------------------------------------------------------------------*/
  function SRC(node, name, archetype, lane, secondary, method, state, cadence, prereq) {
    return { node: node, name: name, archetype: archetype, lane: lane, secondary: secondary || [],
             method: method, state: state, cadence: cadence, prereq: prereq };
  }
  var SOURCES = [
    SRC("client", "Customer - Mobile App",   "Consumer edge",            "L1", ["L4"], "Synthetic journey on a seeded account; store-review pull", "computes", "journey 5 min - store pull 6 h", "Test login + seeded account (zero-touch)"),
    SRC("telco",  "Telco Data - DNS/TLS",    "Carrier transit path",     "L1", ["L3"], "blackbox_exporter dns/tcp/icmp from a domestic telco line", "live", "1 min", "One probe host on a consumer circuit, no VPN (zero-touch)"),
    SRC("edge",   "Edge - FW / WAF / LB",    "Perimeter appliance tier", "L2", ["L1"], "SNMP interface + pool-member OIDs; HTTP poll on the VIP",  "live", "1 min", "Read-only SNMP community, probe IPs allow-listed (medium)"),
    SRC("gw",     "API Gateway",             "Ingress API gateway",      "L3", ["L2", "L1"], "JSON access log, 16 fields, one line per HTTP hop",  "live", "streamed - 1 min rollup", "Access-log format change + a log shipper (medium)"),
    SRC("auth",   "Auth & Session",          "Identity service",         "L3", ["L1"], "Application log with multiline reassembly at the first hop","live", "streamed", "Log path + JSON layout (zero-touch)"),
    SRC("otp",    "OTP & Notify Svc",        "Step-up challenge service","L3", ["L1"], "Application log + challenge-store counters",               "live", "streamed", "Log path (zero-touch)"),
    SRC("smsgw",  "Telco SMS / OTP GW",      "Partner protocol gateway", "L1", ["L4"], "Synthetic ESME bind_transceiver + DLR API pull",           "live", "5 min", "Aggregator test short code + API credential (medium)"),
    SRC("pay",    "Payment Orchestrator",    "Business orchestrator",    "L3", ["L6", "L1"], "Application log + saga-store read-only query",        "live", "streamed - SQL 1 min", "Read-only DB role on the saga store (medium)"),
    SRC("acct",   "Accounts & Balance",      "Domain read service",      "L3", ["L6"], "Application log + L3 seeded-account balance assertion",    "live", "streamed", "Seeded funded account (medium)"),
    SRC("dbr",    "DB Replica (balance)",    "Read replica",             "L2", ["L6"], "pg_stat_replication + storage latency counters",           "live", "1 min", "Read-only monitoring role (zero-touch)"),
    SRC("core",   "Core Banking",            "System of record",         "L1", ["L5", "L2"], "Heartbeat transaction + advice-file arrival check",   "live", "5 min - file 15 min", "Heartbeat account + SFTP read path (medium)"),
    SRC("bhub",   "Biller Hub - Aggregator", "Partner routing layer",    "L3", ["L1"], "Adapter access log + per-biller echo probe",               "parses", "streamed", "Adapter log format agreed with the vendor (medium)"),
    SRC("biller", "Biller - Online",         "External partner endpoint","L1", ["L4"], "cURL echo against each biller sandbox endpoint",            "arrives", "5 min", "Biller sandbox endpoints (medium - historically slips)"),
    SRC("bbatch", "Biller - Advice File",    "File exchange",            "L5", [],     "SFTP listing: file age, size, trailer check",               "live", "15 min", "SFTP read-only account (medium)"),
    SRC("mq",     "Queue & History",         "Message broker",           "L2", ["L3"], "Broker management API: queue depth, oldest message age",    "live", "1 min", "Read-only broker API user (zero-touch)"),
    SRC("recon",  "Recon & Settlement",      "Reconciliation process",   "L5", ["L6"], "Settlement file check + three-way match query",             "computes", "per cycle", "Settlement file path + read-only match view (medium)")
  ];

  /* the 16-field access-log parser contract (admin page, Parsers tab) --------*/
  var PARSER_FIELDS = [
    { f: "ts_utc_ms",       t: "int64",  note: "epoch millis, UTC, from the gateway clock" },
    { f: "rid",             t: "string", note: "correlation id echoed on every hop" },
    { f: "svc",             t: "string", note: "emitting service key" },
    { f: "node_id",         t: "string", note: "instance, joins to the front-page map" },
    { f: "http_method",     t: "string", note: "GET / POST / PUT" },
    { f: "route_template",  t: "string", note: "templated path - never the raw URI" },
    { f: "status",          t: "int",    note: "HTTP status the client saw" },
    { f: "dur_ms",          t: "int",    note: "total request duration" },
    { f: "upstream_ms",     t: "int",    note: "the callee's own time, not the total" },
    { f: "upstream_addr",   t: "string", note: "resolved host:port of the callee" },
    { f: "upstream_status", t: "int",    note: "status the callee returned" },
    { f: "retries",         t: "int",    note: "attempt count minus one" },
    { f: "bytes_out",       t: "int",    note: "response size" },
    { f: "result_code",     t: "string", note: "B-/T- domain code where the app emits one" },
    { f: "user_agent",      t: "string", note: "carries the probe tag so synthetic is excluded" },
    { f: "vantage",         t: "string", note: "probe rows only: dmz | app-zone | telco" }
  ];

  /* --------------------------------------------------------------------------
   * 13 · LANES (blueprint §03) and per-page DATA LINEAGE strings (§05).
   * ------------------------------------------------------------------------*/
  var LANES = {
    L1: "L1 synthetic probes",
    L2: "L2 protocol polling",
    L3: "L3 log streams",
    L4: "L4 API pulls",
    L5: "L5 file feeds",
    L6: "L6 read-only DB queries",
    L7: "L7 manual import",
    L8: "L8 optional deep lanes (eBPF, self-hosted SDK)"
  };

  var LINEAGE = {
    "front":        "L3 gateway access log (ts_utc_ms, svc, route_template, status, dur_ms) - L1 synthetic probes (probe_success, probe_duration_seconds, vantage) - L2 protocol polling (pool members, replication lag, queue depth). No APM agent, no application code change.",
    "sla-weekly":   "L3 gateway access log: ts_utc_ms, svc, route_template, status, dur_ms, T_ms - L1 probe_success at hops no log can see - mapping tables service->critical, route->service. Success = countIf(status<500)/count(); response time = countIf(dur_ms<=T_ms)/count(); availability = probe ratio with the assertion in the numerator.",
    "sla-drilldown":"L3 gateway access log only: ts_utc_ms, api_group, route_template, status, dur_ms, per-group T_ms. Per (day, group, route): c = countIf(status<500)/count(), t = countIf(dur_ms<=T_ms)/count(), 5xx = countIf(status>=500), n = count(). Group rows are recomputed from raw rows, never averaged from the API rows.",
    "kpi-live":     "L3 streaming aggregation at the ingress gateway plus the identity and step-up services: ts_utc_ms, svc, route_template, status, dur_ms - mapping route->journey - a written SLO per journey. Error rate = countIf(status>=500)/count(); req/s = count()/window_seconds; percentiles computed from raw rows at query time.",
    "service-health":"L3 gateway rows for RED (rate, errors, duration) + L3 application logs with multiline reassembly for ERROR TYPES and RECENT ERRORS, joined on rid. Fields: ts_utc_ms, svc, route_template, status, dur_ms, exception.type, exception.message.",
    "synthetic":    "L1 only: monitor_id, ts_utc_ms, probe_success, probe_duration_seconds, probe_http_status_code, assertion_result, dns_ms/connect_ms/tls_ms/ttfb_ms, vantage in {dmz, app-zone, telco}. Uptime = countIf(probe_success AND assertion_ok)/count(); a probe that could not run is no-data, not a failure.",
    "downstream":   "L3 egress forward-proxy and gateway access logs: caller_service, callee_host, callee_port, callee_type, endpoint, status, upstream_status, upstream_ms, retries, err_transport - L2 Envoy cluster counters where a proxy is in path. Avg latency is the callee's own time, not the total request duration.",
    "dependencies": "L3 choke-point logs for HTTP edges + the node registry (node_id, display name, zone, owning team, CIDR claim) + callee_actual_host from conntrack. Every edge carries source_technique in {L7, TCP, flow, probe} and a confidence; a flow-only edge shows an empty error rate, never 0.00%.",
    "errors":       "L3 application logs with multiline reassembly at the first hop: exception.type, exception.root_cause_type, exception.message, error.fingerprint, culprit, top_frames, error_code (B-/T-), first_seen, last_seen, times_seen - plus L3 gateway rows for the 4xx/5xx population. Counts ship as counters when stack traces cannot.",
    "journey":      "L3 gateway rows tagged route->journey for the backend lens, plus the L1 synthetic journey (per-step probe_success) for the completion lens. The client-stability lens needs a self-hosted crash SDK and is not collected here - the card shows 2 of 3 lenses and says so.",
    "ops-issues":   "No collection lane: this screen reads the P4 registers (SLA engine, error taxonomy, dependency aggregator) and the P5 ticket service. Evidence numbers are recomputed from the same spine the monitoring menus use, so an issue and a chart can never disagree.",
    "error-tracking":"L3 result_code from the gateway access log and the application log (B-/T- taxonomy), joined to the P5 ticket service. http_status and error_code stay in separate columns and are never merged.",
    "incident-trace":"P5 ticket service, keyed to the incident windows in data/manifest.js through tickets.js byWindow. Every date is a timeline index into the same week, so a ticket and the band that produced it cannot drift.",
    "collectors":   "The collector control plane itself: per-node lane, method and state (arrives -> parses -> computes -> live), probe registry, parser schema, L3 assertions, thresholds from data/manifest.js, and pipeline health (buffer_bytes, dropped_records, watermark)."
  };

  /* --------------------------------------------------------------------------
   * 14 · WEEKS — three seeded prior weeks plus the current computed one.
   * ------------------------------------------------------------------------*/
  var WEEKS = [
    { key: "WK31", label: "WK31", range: "Aug 2 – 8",   current: false, availability: 99.97, success: 99.94, responseTime: 99.71 },
    { key: "WK32", label: "WK32", range: "Aug 9 – 15",  current: false, availability: 99.99, success: 99.92, responseTime: 99.58 },
    { key: "WK33", label: "WK33", range: "Aug 16 – 22", current: false, availability: 99.95, success: 99.89, responseTime: 99.34 },
    { key: "WK34", label: "WK34", range: "Aug 23 – 29", current: true,  availability: null,  success: null,  responseTime: null }
  ];

  /* --------------------------------------------------------------------------
   * 15 · THE COLLECTOR GAP — one deliberate 90-minute hole on Aug 26.
   * Buckets inside it are UNKNOWN, never zero.
   * ------------------------------------------------------------------------*/
  var GAP = {
    node: "bhub", svc: "biller-adapter", t0: 1002, t1: 1019, mins: 90,
    reason: "log shipper stopped after a disk-pressure eviction; buffer drained, watermark held",
    label: "Aug 26 11:30 - Aug 26 12:55"
  };

  /* --------------------------------------------------------------------------
   * 16 · Publish.
   * ------------------------------------------------------------------------*/
  window.PULSE_REG = {
    version: "2.0.2",
    N: N, STEP_MIN: STEP_MIN, DAY: DAY, NOW: NOW,
    account: { name: "Reference mobile-payment estate", host: "api.example-bank.mm",
               note: "Account-agnostic. Retarget by editing this file only." },
    thresholds: THRESHOLDS,
    people: PEOPLE,
    journeys: JOURNEYS,
    services: SERVICES,
    groups: GROUPS,
    routes: ROUTES,
    downstreams: DOWNSTREAMS,
    monitors: MONITORS,
    errorGroups: ERROR_GROUPS,
    resultCodes: RESULT_CODES,
    opsIssues: OPS_ISSUES,
    errorTracking: ERROR_TRACKING,
    errorTrackingStatuses: ET_STATUS,
    sources: SOURCES,
    parserFields: PARSER_FIELDS,
    lanes: LANES,
    lineage: LINEAGE,
    weeks: WEEKS,
    gap: GAP,
    /* small lookups the page builders would otherwise rebuild every time */
    byRoute: (function () { var m = {}; for (var i = 0; i < ROUTES.length; i++) m[ROUTES[i].key] = ROUTES[i]; return m; }()),
    bySvc: (function () { var m = {}; for (var i = 0; i < SERVICES.length; i++) m[SERVICES[i].key] = SERVICES[i]; return m; }()),
    byJourney: (function () { var m = {}; for (var i = 0; i < JOURNEYS.length; i++) m[JOURNEYS[i].key] = JOURNEYS[i]; return m; }()),
    byGroup: (function () { var m = {}; for (var i = 0; i < GROUPS.length; i++) m[GROUPS[i].key] = GROUPS[i]; return m; }()),
    byDownstream: (function () { var m = {}; for (var i = 0; i < DOWNSTREAMS.length; i++) m[DOWNSTREAMS[i].key] = DOWNSTREAMS[i]; return m; }()),
    byMonitor: (function () { var m = {}; for (var i = 0; i < MONITORS.length; i++) m[MONITORS[i].id] = MONITORS[i]; return m; }())
  };
}());
