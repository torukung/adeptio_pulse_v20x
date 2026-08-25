/* ============================================================================
 * ADEPTIO Pulse — Flow Inspection : Mobile Payment Module · DATA MANIFEST
 * Topology + objective DEFINITIONS only. No time series here: the 7-day series
 * live in data/log_day1.js … log_day7.js and are stitched by assets/engine.js.
 * Loaded as a classic <script src> so the site works from file:// (no fetch).
 * ==========================================================================*/
(function(){
"use strict";

/* timeline geometry — 2016 steps * 5 min = 7 days, 288 steps per day */
const N = 2016, STEP_MIN = 5, DAY = 288;

/* ---- the demo week's calendar labels (v2.0.1) ------------------------------
   WK34 of 2027, Mon Aug 23 → Sun Aug 29. Day index 1..7 renders as a date;
   stamps carry NO year (the year appears only in per-screen header ranges).
   Published on ADEPTIO_DATA so every module can share one source of day marks;
   consumers keep their own literal fallback, so load order is unaffected.
   DISPLAY ONLY — step indices, seeds, INC keys and lookup strings are unchanged. */
const WEEK = { wk:'WK34', year:2027,
  days:['Aug 23','Aug 24','Aug 25','Aug 26','Aug 27','Aug 28','Aug 29'],
  range:'Aug 23 – 29, 2027' };

// incident windows across the week (indices). 3 values = triangular rise/peak/fall, 2 values = ramp that holds.
const INC = {
  C:[54,66,84],        // Aug 23 dawn — OTP/SMS DLR dip (single carrier, vendor-side)
  A:[408,428,460],     // Aug 24 midday — MAJOR silent false-declines from replica lag (the L3 signature)
  E:[660,684,720],     // Aug 25 morning — MULTI-PATH: one carrier degrades customer ingress AND SMS delivery
  B:[936,1368,1500],   // Aug 26 06:00 → Aug 27 18:00 peak → Aug 27 21:00 clear — storage creep on the core DB estate, decays after the Aug 27 outage response (post-incident fix)
  F:[1380,1394,1428],  // Aug 27 19:00 → Aug 28 02:00 — BACK-END DOWN: core outage after failed failover; full path red
  G:[1602,1614,1638],  // Aug 28 13:30–16:30 — edge/LB pool loss (2 of 4 members)
  I:[1700,1710,1726],  // Aug 28 night — EOD batch overrun
  H:[1788,1812,1848],  // Aug 29 05:00–10:00 — biller hub / aggregator brownout
  D:[1932,1944,1962]   // Aug 29 17:00–19:30 — gateway deploy regression (sharp, recent)
};
const INCMETA = { A:['replica-lag false declines','crit'], B:['storage creep','warn'], C:['OTP delivery dip','warn'],
  D:['gateway deploy regression','warn'], E:['carrier multi-path','warn'], F:['CORE OUTAGE — cascade','crit'],
  G:['LB pool loss','warn'], H:['aggregator brownout','warn'], I:['EOD overrun','warn'] };

/* objective factories — A() one indicator, AV() the standard availability one.
   inc: null | {incidentKey: amplitude} — amplitude is the peak displacement. */
const T={client:'client',net:'cloud',fw:'shield',lb:'lb',web:'web',app:'app',gw:'gw',mq:'mq',db:'db',stor:'stor',recon:'recon',link:'link',bank:'bank',switch:'switch',core:'core'};
const A=(label,unit,base,warn,crit,dir,amp,noise,inc,extra)=>Object.assign({label,unit,base,warn,crit,dir,amp,noise,inc:inc||null},extra||{});
const AV=(inc,amp)=>A('Availability','%',99.98,99.5,98.5,'lo',amp||3.5,0.02,inc,{max:100,min:80});

/* ---- topology: nodes, their objectives, and map coordinates ----
   pm = how this object is actually polled/collected (rendered as the third
   label line under the map node, and in the dock pane header). ---- */
const NODES=[
 {id:'client',name:'Customer · Mobile App',ip:'handset · release vX.Y',pm:'synthetic · store api',type:T.client,x:80,y:330,objs:[
   A('Journey success','%',99.8,99.0,97.0,'lo',2.4,0.08,{A:2.4,E:1.3,F:3.6,D:0.9},{max:100}),
   A('Crash-free sessions','%',99.72,99.5,99.0,'lo',1.1,0.04,null,{max:100}),
   A('Review error signal','/h',0.3,1.5,4,'hi',1.2,0.15,{F:2.5})]},
 {id:'telco',name:'Telco Data · DNS/TLS',ip:'4G APN · resolver · transit',pm:'curl -w · dns probe',type:T.net,x:230,y:330,objs:[
   A('DNS resolve','%',99.95,99.0,97.0,'lo',2.0,0.05,{E:1.2},{max:100}),
   A('TCP connect p95','ms',95,250,600,'hi',60,12,{E:420}),
   A('TLS handshake p95','ms',180,400,900,'hi',90,20,{E:600}),
   A('Packet loss','%',0.15,0.5,2,'hi',0.6,0.08,{E:1.6})]},
 {id:'edge',name:'Edge — FW · WAF · LB',ip:'perimeter · public VIP',pm:'http poll · snmp',type:T.fw,x:380,y:330,objs:[
   AV({G:2.2},1.5),
   A('TLS termination p95','ms',38,90,200,'hi',30,5,{G:120}),
   A('Cert days-to-expiry','d',58,15,7,'lo',0,0.1,null,{int:true,min:0}),
   A('Pool members up','n',4,3,2,'lo',0,0.2,{G:2.2},{int:true,max:4,min:0})]},
 {id:'gw',name:'API Gateway',ip:'POST /v1/bills/pay',pm:'http poll · logs',type:T.gw,x:535,y:330,objs:[
   AV({F:2.8},2),
   A('Route p95','ms',280,500,900,'hi',260,40,{D:520,F:480,B:90}),
   A('5xx rate','%',0.05,0.1,1,'hi',0.12,0.02,{D:1.6,F:2.4}),
   A('Worker saturation','%',55,80,92,'hi',30,3,{F:38,D:28,B:14})]},
 {id:'auth',name:'Auth & Session',ip:'JWT · session cache',pm:'http poll · synthetic login',type:T.app,x:515,y:205,objs:[
   A('Login synthetic','%',99.9,99.5,98.5,'lo',1.2,0.05,{C:1.2,E:0.9,F:2.9},{max:100}),
   AV({F:2.2},2),
   A('Auth p95','ms',210,400,800,'hi',90,25,{F:420}),
   A('Token refresh fail','%',0.15,0.5,2,'hi',0.4,0.05,{F:1.4})]},
 {id:'otp',name:'OTP & Notify Svc',ip:'challenge · verify · expiry',pm:'http poll · logs',type:T.app,x:640,y:184,objs:[
   A('Challenge→verify success','%',97.5,94,90,'lo',9,0.4,{C:9,F:7},{max:100}),
   AV(null,2),
   A('OTP issue p95','ms',300,800,2000,'hi',350,60,{C:350,F:900})]},
 {id:'smsgw',name:'Telco SMS / OTP GW',ip:'SMPP bind · DLR receipts',pm:'smpp ping · dlr api',type:T.link,x:665,y:305,objs:[
   AV({C:2.5},2.5),
   A('DLR rate (worst carrier)','%',98.6,97,90,'lo',26,0.3,{C:26,E:9},{max:100}),
   A('Time-to-deliver p90','s',8,15,45,'hi',60,1.5,{C:60,E:25})]},
 {id:'pay',name:'Payment Orchestrator',ip:'saga · retries · idempotency',pm:'http poll · logs',type:T.app,x:665,y:430,objs:[
   A('Decline anomaly (10m sust.)','×base',1,1.5,3,'hi',6.5,0.15,{A:6.5,H:2.2}),
   AV({F:3},2),
   A('Orchestration p95','ms',450,1200,2500,'hi',300,70,{A:300,F:1900,H:600}),
   A('Technical decline','%',0.3,1,2,'hi',1.4,0.08,{F:3.8,H:1.1,D:0.8})]},
 {id:'acct',name:'Accounts & Balance',ip:'reads · statements',pm:'poll · logs · L3 assert',type:T.app,x:850,y:590,objs:[
   A('Read p95','ms',140,300,700,'hi',260,25,{A:260,F:520}),
   A('Stale-read assert fails','/5m',0,1,3,'hi',6,0.15,{A:6},{int:true}),
   AV({F:2.6},2),
   A('Conn pool','%',54,80,95,'hi',18,4,{A:18,F:36})]},
 {id:'dbr',name:'DB Replica (balance)',ip:'read replica · SAN',pm:'sql canary · repl api',type:T.db,x:1010,y:590,objs:[
   AV(null,1.2),
   A('Replication lag','s',1.2,5,30,'hi',255,0.8,{A:255,B:12}),
   A('Query p95','ms',48,120,300,'hi',90,10,{A:90,B:140}),
   A('Disk IO latency','ms',4.5,10,25,'hi',6,0.8,{B:19})]},
 {id:'core',name:'Core Banking',ip:'posting · journal · GL',pm:'heartbeat txn · file feed',type:T.core,x:1070,y:466,objs:[
   AV({F:3.2},1.5),
   A('Posting p95','s',0.62,1.5,3,'hi',2.6,0.12,{B:1.9,F:2.4}),
   A('Pending-age p95','s',18,60,300,'hi',420,6,{F:380,I:230}),
   A('Batch overrun','min',0,1,30,'hi',55,0.4,{I:48,F:20},{int:true})]},
 {id:'bhub',name:'Biller Hub · Aggregator',ip:'routing · adapters · N billers',pm:'http poll · logs',type:T.switch,x:1360,y:390,objs:[
   AV({H:2.4},2),
   A('Inquiry p95','ms',900,2000,5000,'hi',600,120,{H:2400,F:1200}),
   A('Adapter error','%',0.2,1,3,'hi',0.6,0.08,{H:2.6}),
   A('Biller timeout','%',0.3,1,2,'hi',0.5,0.06,{H:1.6,F:1.9})]},
 {id:'biller',name:'Biller · Online',ip:'YESC · MESC · ESE · telco top-up',pm:'curl echo · api',type:T.bank,x:1550,y:350,objs:[
   A('Credit-leg success (worst biller)','%',99.5,98,95,'lo',1.6,0.08,{H:3.4,F:2.2},{max:100}),
   AV(null,2),
   A('Debits awaiting credit','n',0,3,10,'hi',8,0.3,{A:8,F:11,H:6},{int:true}),
   A('Top-up value delivery','%',99.7,99,97,'lo',0.8,0.06,{H:1.4},{max:100})]},
 {id:'bbatch',name:'Biller · Advice File',ip:'batch post · confirm cycle',pm:'sftp file check',type:T.stor,x:1640,y:550,objs:[
   A('Advice-file age','h',2,6,12,'hi',9,0.3,{H:7,I:6}),
   A('Cut-off buffer','min',90,30,10,'lo',75,4,{I:75,H:40}),
   A('Retry queue','n',0,20,80,'hi',60,3,{H:55,I:35},{int:true}),
   A('Confirmation lag','h',6,18,30,'hi',10,0.8,{H:9})]},
 {id:'mq',name:'Queue & History',ip:'events · statement sync',pm:'broker api · queue metrics',type:T.mq,x:1200,y:590,objs:[
   AV(null,1.5),
   A('DLQ depth','n',0,5,25,'hi',30,0.6,{F:32},{int:true}),
   A('Oldest message age','s',6,60,300,'hi',340,8,{F:340}),
   A('Notif delivery','%',99.2,98,95,'lo',1.0,0.1,{F:1.6},{max:100})]},
 {id:'recon',name:'Recon & Settlement',ip:'T+1 · 3-way match',pm:'sftp · file check',type:T.recon,x:1360,y:590,objs:[
   AV(null,1.2),
   A('Match rate','%',99.7,99.5,98.0,'lo',0.9,0.05,{A:0.9,F:1.4,H:1.1},{max:100}),
   A('Exceptions open','n',12,40,120,'hi',85,4,{A:85,F:120,H:60},{int:true}),
   A('Unmatched value','MMK M',2,8,25,'hi',16,0.8,{A:16,F:22,H:12})]}
];

/* ---- edges: [from, to, nominal weight] ---- */
const LINKS=[
 ['client','telco',34],['telco','edge',44],['edge','gw',56],
 ['gw','auth',48],['auth','otp',40],['otp','smsgw',36],
 ['gw','pay',62],['pay','acct',52],['acct','dbr',46],
 ['pay','core',58],['pay','bhub',44],['core','bhub',52],
 ['core','mq',40],['core','recon',30],
 ['bhub','biller',50],['bhub','bbatch',34],['bhub','recon',30]
];

/* ---- headline KPI ---- */
const KPI_DEF=A('','%',99.6,99.0,97.5,'lo',4.8,0.07,{A:4.8,F:6.0,E:1.5,D:1.2,H:1.5},{max:100}); // Payment success % — definition only, series live in data/log_day*.js

/* ---- bottom-table defaults ---- */
const TABLE_DEFAULTS = { cNode:'pay', cWin:'1h', cSev:'all', aWin:'7d', bWin:'5m' };

window.ADEPTIO_DATA = { N, STEP_MIN, DAY, WEEK, INC, INCMETA, NODES, LINKS, KPI:KPI_DEF, TABLE_DEFAULTS };
})();
