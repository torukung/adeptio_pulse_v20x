/* ============================================================================
 * Adeptio Incident Trace · PORTAL SEED DATA  (page 3)
 * window.ADEPTIO_TICKETS = { project, now, tickets[], byWindow{} }
 *
 * MOCK DATA. Keys are INC-10xx. Every date field is a TIMELINE INDEX into the
 * same 2016-step mock week the dashboard replays (5 min per step, 288/day), so
 * a ticket and the incident band that produced it always agree. The portal
 * renders them through dstamp() -> "Aug 27 19:30". "now" = 2015 (= the dashboard's
 * live edge). Owners are reused verbatim from data/rcameta.js.
 *
 * v2.0.1 label system: the mock week is WK34 of 2027, Mon Aug 23 -> Sun Aug 29, so
 * day 1..7 reads Aug 23..Aug 29. Stamps carry no year; the year is stated once in
 * the page header. Indices, keys and ticket ids are unchanged.
 *
 * Nine incident tickets are mapped 1:1 onto the scenario windows in
 * data/manifest.js (INC / INCMETA); byWindow is that mapping, and it is what
 * the dashboard's RCA pop-up uses to find the case behind a red indicator.
 * The remaining rows are ordinary operational work, so the board reads lived-in
 * rather than staged.
 * ==========================================================================*/
(function(){
"use strict";

/* owner shorthand — mirrors data/rcameta.js exactly */
const O = {
  client: {name:"U Kyaw Zin Htun",   team:"Digital Channels"},
  telco:  {name:"Daw Thiri Aung",    team:"Network Ops - Carrier Liaison"},
  edge:   {name:"U Myo Min Latt",    team:"Network Ops"},
  gw:     {name:"Daw Ei Ei Khaing",  team:"Platform Engineering"},
  auth:   {name:"U Zaw Lin Naing",   team:"Identity & Access"},
  otp:    {name:"Daw Nwe Nwe Win",   team:"Identity & Access - Notify"},
  smsgw:  {name:"U Aung Ko Ko",      team:"Vendor Mgmt - SMS Aggregator Liaison"},
  pay:    {name:"Daw Su Myat Noe",   team:"Payments Squad"},
  acct:   {name:"U Thant Zin Oo",    team:"Core Ops - Account Services"},
  dbr:    {name:"Daw Hnin Wai Phyo", team:"Data Platform - DBA"},
  core:   {name:"U Soe Naing Win",   team:"Core Ops"},
  bhub:   {name:"Daw Yamin Htay",    team:"Payments Squad - Biller Integrations"},
  biller: {name:"U Htet Aung Kyaw",  team:"Vendor Mgmt - Biller Partnerships"},
  bbatch: {name:"Daw Khin Mar Cho",  team:"Payments Ops - Settlement Files"},
  mq:     {name:"U Pyae Phyo Han",   team:"Platform Engineering - Messaging"},
  recon:  {name:"Daw Moe Moe Aye",   team:"Recon & Settlement Ops"}
};
const MON = "Adeptio Synthetic Monitor";
const CC  = "Contact Centre Duty Desk";
const NOC = "NOC Monitoring";

const TICKETS = [

/* ------------------------------------------------------------ Aug 23 ----- */
{ key:"INC-1009", type:"task", major:false, status:"todo", priority:"medium",
  summary:"Renew public VIP certificate before the 15-day warning band",
  desc:"edge.Cert days-to-expiry counts down against a warn band of 15 days and a crit band of 7. The current certificate on the public VIP clears the band comfortably this week, but the renewal is a scheduled change and needs a window booked with Network Ops before it enters warn.\n\nRead-only note: Adeptio detects and tickets the countdown; the renewal itself is the bank's change to make.",
  assignee:O.edge, reporter:MON, labels:["certificates","edge","planned-change"],
  incKey:null, node:"edge", created:30, updated:1880,
  comments:[
    {who:O.edge.name, at:36,   text:"Booked provisionally for the next monthly change window. CSR is ready; waiting on the CA order to be raised by Procurement."},
    {who:O.gw.name,   at:1878, text:"Reminder from the platform side - the gateway pins nothing, so this is an edge-only swap. No coordinated restart needed."}
  ],
  history:[
    {at:30,   what:"Adeptio Synthetic Monitor created the work item"},
    {at:1880, what:"U Myo Min Latt updated the description"}
  ],
  links:[] },

{ key:"INC-1012", type:"incident", major:false, status:"done", priority:"high",
  summary:"OTP delivery dip on one carrier - DLR rate fell to 73% for ~2.5h",
  desc:"Aug 23 dawn. smsgw.DLR rate (worst carrier) dropped from a 98.6% baseline to roughly 73% while every other carrier stayed nominal, and otp.Challenge-to-verify success followed it down. Time-to-deliver p90 stretched past 45s.\n\nSingle-carrier, vendor-side. The bank's OTP service issued challenges normally throughout - the codes simply did not arrive. Customer-visible symptom was an OTP screen that times out.",
  assignee:O.smsgw, reporter:MON, labels:["otp","sms","carrier","vendor"],
  incKey:"C", node:"smsgw", created:58, updated:96,
  comments:[
    {who:O.otp.name,   at:60, text:"Confirmed issue rate is flat on our side - challenges are being generated and stored. The gap is between submit and DLR, so this is the route, not the service."},
    {who:O.smsgw.name, at:64, text:"P1 raised with the aggregator NOC quoting per-carrier DLR and the affected-customer count. Acknowledged inside the 15-minute window."},
    {who:O.smsgw.name, at:88, text:"Aggregator confirmed an SMSC bind flap on that carrier and moved us to the alternate route. DLR back above 97% and climbing."},
    {who:O.otp.name,   at:94, text:"Verify success recovered to baseline. Closing - no bank-side change required."}
  ],
  history:[
    {at:58, what:"Adeptio Synthetic Monitor raised the incident from smsgw.DLR rate (worst carrier)"},
    {at:59, what:"Priority set to High"},
    {at:60, what:"Assigned to U Aung Ko Ko"},
    {at:62, what:"Status changed To Do to In Progress"},
    {at:96, what:"Status changed In Progress to Done"}
  ],
  links:[] },

{ key:"INC-1014", type:"task", major:false, status:"inprog", priority:"low",
  summary:"Broker capacity review - headroom check before the festival peak",
  desc:"Routine capacity review of the message broker estate: partition counts, consumer-group parallelism and disk headroom against the projected festival-period transaction volume. Driven by mq.Oldest message age and mq.DLQ depth trending slightly warmer week on week rather than by any single event.",
  assignee:O.mq, reporter:O.gw.name, labels:["messaging","capacity","planned-change"],
  incKey:null, node:"mq", created:120, updated:1930,
  comments:[
    {who:O.mq.name, at:400,  text:"Baseline pulled. History consumer group is the only one that ever builds a backlog; everything else drains inside a step."},
    {who:O.mq.name, at:1928, text:"Draft sizing note out for review. Recommendation is +2 partitions on the history topic and a consumer-count bump, both non-breaking."}
  ],
  history:[
    {at:120, what:"Daw Ei Ei Khaing created the work item"},
    {at:130, what:"Status changed To Do to In Progress"},
    {at:1930,what:"U Pyae Phyo Han added a comment"}
  ],
  links:[] },

{ key:"INC-1016", type:"task", major:false, status:"done", priority:"low",
  summary:"Rotate synthetic test MSISDNs across all three carriers",
  desc:"The OTP synthetic probe fires against a fixed set of test MSISDNs. Rotate them on the standing quarterly schedule so no single number accumulates enough traffic to be filtered as bulk, and confirm coverage stays at one active number per carrier.",
  assignee:O.otp, reporter:O.smsgw.name, labels:["otp","synthetic","hygiene"],
  incKey:null, node:"smsgw", created:300, updated:640,
  comments:[
    {who:O.otp.name, at:636, text:"New numbers provisioned and probes repointed. One probe per carrier confirmed green over a full hour before closing."}
  ],
  history:[
    {at:300, what:"U Aung Ko Ko created the work item"},
    {at:610, what:"Status changed To Do to In Progress"},
    {at:640, what:"Status changed In Progress to Done"}
  ],
  links:[] },

/* ------------------------------------------------------------ Aug 24 ----- */
{ key:"INC-1018", type:"incident", major:false, status:"done", priority:"highest",
  summary:"Silent false declines - funded customers declined on stale replica reads",
  desc:"Aug 24 midday. The signature incident: the whole front of the path stayed green - gateway 5xx flat, orchestrator availability nominal, journey success only mildly soft - while dbr.Replication lag climbed and acct.Stale-read assert fails went from zero to six per five minutes.\n\nBalance reads were served from a replica far enough behind the primary that funded customers were told they had insufficient funds. Nothing errored. The payment simply declined, correctly, on incorrect data.\n\nThis is the case that ordinary uptime monitoring cannot see: availability was never the problem.",
  assignee:O.dbr, reporter:MON, labels:["replication","false-decline","balance","sev2"],
  incKey:"A", node:"dbr", created:412, updated:470,
  comments:[
    {who:O.dbr.name,  at:416, text:"Apply lag on the balance replica is well past band. Primary write throughput is normal, so this is the apply path or storage latency underneath it, not load."},
    {who:O.acct.name, at:420, text:"Stale-read assertions firing against the same minutes. Correlating the declined references now - if the assertion window matches the decline window, these are false declines and we treat it P1."},
    {who:O.pay.name,  at:426, text:"Confirmed. Sampled declined payments where the account was funded at the time of the read. Head of Payments briefed, evidence bundle attached."},
    {who:O.dbr.name,  at:444, text:"Reads failed back to the primary while the replica caught up. Lag inside band, assertions clear."},
    {who:O.acct.name, at:466, text:"Reconciled the affected references with Payments Ops; customer impact list handed to the contact centre. Closing the incident, the guard change follows in its own item."}
  ],
  history:[
    {at:412, what:"Adeptio Synthetic Monitor raised the incident from dbr.Replication lag"},
    {at:413, what:"Priority set to Highest"},
    {at:414, what:"Assigned to Daw Hnin Wai Phyo"},
    {at:415, what:"Status changed To Do to In Progress"},
    {at:426, what:"Label sev2 added"},
    {at:470, what:"Status changed In Progress to Done"}
  ],
  links:[{rel:"causes", key:"INC-1019"}] },

{ key:"INC-1019", type:"task", major:false, status:"done", priority:"high",
  summary:"Post-incident review INC-1018: stale-read guard added to the balance path",
  desc:"Follow-up from the Aug 24 false-decline incident. The review found the balance read had no freshness assertion of its own - the replica was trusted unconditionally.\n\nChange delivered: the accounts service now checks replica apply lag before serving a balance for a payment decision and fails over to the primary above threshold, and the decline path records which source answered so a false decline is provable after the fact rather than inferred.",
  assignee:O.acct, reporter:O.dbr.name, labels:["pir","balance","guardrail"],
  incKey:null, node:"acct", created:470, updated:902,
  comments:[
    {who:O.acct.name, at:600, text:"Guard implemented behind a flag. Threshold set from the Aug 24 lag profile with margin, so a normal replica never trips it."},
    {who:O.pay.name,  at:890, text:"Soak looks clean - no spurious failovers across a full day of normal traffic. Happy to call this done."},
    {who:O.acct.name, at:900, text:"Flag defaulted on in production. Stale-read guard live on the balance path."}
  ],
  history:[
    {at:470, what:"Daw Hnin Wai Phyo created the work item"},
    {at:472, what:"Linked to INC-1018 (is caused by)"},
    {at:520, what:"Status changed To Do to In Progress"},
    {at:902, what:"Status changed In Progress to Done"}
  ],
  links:[{rel:"is caused by", key:"INC-1018"}] },

{ key:"INC-1021", type:"task", major:false, status:"todo", priority:"medium",
  summary:"Schedule the half-yearly core failover drill",
  desc:"Standing operational commitment: exercise the core banking failover in a controlled window, with Payments and Channels on the bridge, and time the observed cutover against the documented target. Booking only - the drill itself is a change-managed activity.",
  assignee:O.core, reporter:O.pay.name, labels:["dr","core","planned-change"],
  incKey:null, node:"core", created:500, updated:1700,
  comments:[
    {who:O.core.name, at:1698, text:"Deferring the booking until the outage follow-ups are closed - drilling a failover path that is mid-change would not test anything we can trust."}
  ],
  history:[
    {at:500,  what:"Daw Su Myat Noe created the work item"},
    {at:1700, what:"U Soe Naing Win added a comment"}
  ],
  links:[] },

/* ------------------------------------------------------------ Aug 25 ----- */
{ key:"INC-1023", type:"incident", major:false, status:"done", priority:"high",
  summary:"Carrier multi-path degradation - one carrier degraded app ingress AND SMS at once",
  desc:"Aug 25 morning. Two symptoms that look like two incidents: customers on one carrier saw slow or failing app traffic (telco.TCP connect p95 and TLS handshake p95 both stretched, packet loss up) while OTP delivery on the same carrier degraded.\n\nOne root cause. The carrier's transit and its SMSC path share infrastructure, so a single upstream fault surfaced on both legs of the journey. Splitting by carrier is what collapses it from two tickets into one.",
  assignee:O.telco, reporter:MON, labels:["carrier","ingress","sms","vendor","multi-path"],
  incKey:"E", node:"telco", created:666, updated:742,
  comments:[
    {who:O.telco.name, at:670, text:"2-of-3 vantages agree, and both failing vantages are on the same carrier. Confirmed before paging - a single vantage would not have been enough."},
    {who:O.smsgw.name, at:676, text:"Worth noting our DLR dip is on that same carrier. Suggest we run these as one incident rather than two - same upstream."},
    {who:O.telco.name, at:680, text:"Agreed, folding the SMS symptom in here. Raised with the carrier NOC under the data-transit SLA."},
    {who:O.telco.name, at:736, text:"Carrier confirmed a transit path fault and rerouted. Connect and handshake back to baseline, DLR recovered with it - which is the proof the two symptoms shared a root."}
  ],
  history:[
    {at:666, what:"Adeptio Synthetic Monitor raised the incident from telco.TCP connect p95"},
    {at:668, what:"Priority set to High"},
    {at:670, what:"Status changed To Do to In Progress"},
    {at:680, what:"Label multi-path added"},
    {at:742, what:"Status changed In Progress to Done"}
  ],
  links:[] },

{ key:"INC-1025", type:"bug", major:false, status:"done", priority:"medium",
  summary:"DLR-split monitor reports the aggregate, not the worst carrier",
  desc:"The per-carrier DLR panel was averaging across carriers before comparing to the band, so a single carrier collapsing to 70% barely moved the number while two healthy carriers held the average up. The Aug 23 dip was caught by the time-to-deliver probe rather than by the DLR band it should have tripped.\n\nFix: the monitor now evaluates the WORST carrier against the band, and the objective is labelled as such.",
  assignee:O.smsgw, reporter:O.otp.name, labels:["monitoring","sms","bug"],
  incKey:null, node:"smsgw", created:880, updated:1120,
  comments:[
    {who:O.smsgw.name, at:900,  text:"Reproduced against the Aug 23 window - the aggregate never left green while one carrier sat at 73%."},
    {who:O.smsgw.name, at:1116, text:"Objective renamed to DLR rate (worst carrier) and the band re-evaluated per carrier. Replayed Aug 23 and it trips correctly now."}
  ],
  history:[
    {at:880,  what:"Daw Nwe Nwe Win created the work item"},
    {at:890,  what:"Status changed To Do to In Progress"},
    {at:1120, what:"Status changed In Progress to Done"}
  ],
  links:[] },

/* ----------------------------------------------------- Aug 26 - Aug 27 --- */
{ key:"INC-1027", type:"incident", major:false, status:"done", priority:"high",
  summary:"Storage latency creep on the core DB estate - slow ramp over 36h",
  desc:"Aug 26 06:00 onward. Not an outage: a ramp. Storage service time on the core database estate drifted upward over a day and a half with no single step change, dragging core write latency and gateway route p95 along behind it.\n\nThis is the boiling-frog shape - every individual five-minute sample looks acceptable and the trend is unmistakable. It was raised at Low, escalated twice as the slope held, and it is the precondition that made the Aug 27 failover fail.",
  assignee:O.core, reporter:MON, labels:["storage","latency","creep","precursor"],
  incKey:"B", node:"core", created:944, updated:1508,
  comments:[
    {who:O.core.name, at:960,  text:"Array-side service time is up but still inside band. Watching - nothing here justifies a change window yet."},
    {who:O.dbr.name,  at:1150, text:"Slope has not flattened in eighteen hours. Raising priority: this is a trend, not a blip, and the trend does not have a floor we know about."},
    {who:O.core.name, at:1300, text:"Vendor TAC case opened against the array. IOPS and latency are array-side only, so we cannot instrument further from the host."},
    {who:O.core.name, at:1372, text:"Overtaken by events - see the core outage. Failover attempted into an estate that was already latency-bound."},
    {who:O.core.name, at:1502, text:"Array firmware and cache policy corrected under the outage change. Service time back to baseline and holding; the creep decays out from here."}
  ],
  history:[
    {at:944,  what:"Adeptio Synthetic Monitor raised the incident from core.Storage service time"},
    {at:945,  what:"Priority set to Low"},
    {at:1150, what:"Priority raised Low to Medium"},
    {at:1300, what:"Priority raised Medium to High"},
    {at:1372, what:"Linked to INC-1030 (causes)"},
    {at:1508, what:"Status changed In Progress to Done"}
  ],
  links:[{rel:"causes", key:"INC-1030"}] },

{ key:"INC-1029", type:"task", major:false, status:"inprog", priority:"low",
  summary:"Rewrite the Pay Bill decline-triage runbook around the fingerprint table",
  desc:"The current runbook triages declines by symptom, which is why the Aug 24 false-decline case took twenty minutes to name. Rewrite it around the fault-fingerprint matrix on the flow-instrumentation page: which objectives go red together, and what that combination rules out.\n\nDeliverable is one page per fingerprint with the first three checks and the question that separates it from its nearest neighbour.",
  assignee:O.pay, reporter:O.acct.name, labels:["runbook","documentation","payments"],
  incKey:null, node:"pay", created:1290, updated:1995,
  comments:[
    {who:O.pay.name,  at:1400, text:"Paused during the outage. Picking it back up - the outage itself gives us a clean cascade fingerprint to document."},
    {who:O.pay.name,  at:1992, text:"Five of nine fingerprints drafted. The two vendor-side ones need Vendor Mgmt to confirm the escalation wording before they go in."}
  ],
  history:[
    {at:1290, what:"U Thant Zin Oo created the work item"},
    {at:1310, what:"Status changed To Do to In Progress"},
    {at:1995, what:"Daw Su Myat Noe added a comment"}
  ],
  links:[] },

{ key:"INC-1030", type:"incident", major:true, status:"done", priority:"highest",
  summary:"CORE OUTAGE - failed failover took the whole payment path down",
  desc:"Aug 27 19:00 to Aug 28 02:00. The major incident of the week. A core banking node failed and the failover into the standby did not complete cleanly: the standby estate was already latency-bound from the storage creep tracked in INC-1027, so the cutover stalled part-way.\n\nEverything downstream of the core went red together - orchestrator, gateway, accounts, broker, biller hub. Telco, edge, SMS gateway and the read replica stayed green throughout, and that contrast is what isolated the root to the core rather than to the customer path.\n\nCustomer impact: Pay Bill unavailable for the duration, with a tail of pending items to reconcile afterwards.",
  assignee:O.core, reporter:NOC, labels:["core","outage","cascade","sev1","major"],
  incKey:"F", node:"core", created:1382, updated:1446,
  comments:[
    {who:O.core.name, at:1384, text:"Core node down. Failover initiated. Head of Operations notified, core-vendor support case open in parallel."},
    {who:O.pay.name,  at:1388, text:"Orchestrator is failing every saga at the posting step. Holding retries so we do not build a backlog we then have to unwind."},
    {who:O.core.name, at:1396, text:"Failover has not completed - the standby is not accepting the workload at the rate the primary was carrying. This looks like the storage creep from INC-1027, not a failover-config fault."},
    {who:O.mq.name,   at:1404, text:"Broker is holding. Nothing is being lost, history will simply lag once posting resumes."},
    {who:O.core.name, at:1430, text:"Cutover completed after the array cache policy was corrected. Posting resumed; watching the pending queue drain."},
    {who:O.recon.name,at:1442, text:"Settlement side: the pending items reconcile cleanly against the biller advice file. No orphaned debits. Confirming that in the review."}
  ],
  history:[
    {at:1382, what:"NOC Monitoring raised the incident from core.Availability"},
    {at:1383, what:"Priority set to Highest"},
    {at:1383, what:"Flagged MAJOR"},
    {at:1384, what:"Status changed To Do to In Progress"},
    {at:1396, what:"Linked to INC-1027 (is caused by)"},
    {at:1446, what:"Status changed In Progress to Done"}
  ],
  links:[{rel:"is caused by", key:"INC-1027"}, {rel:"relates to", key:"INC-1031"}] },

{ key:"INC-1031", type:"task", major:false, status:"inprog", priority:"high",
  summary:"Post-incident review INC-1030: failover readiness gate on the core estate",
  desc:"Follow-up from the core outage. The failover was tested and the storage estate was monitored, but nothing checked that the standby could actually absorb the primary's load BEFORE the cutover was attempted.\n\nProposed change: a readiness gate that evaluates standby storage service time and apply headroom, refuses an automatic cutover when the standby is outside band, and escalates to a human decision instead of failing over into a wall. Draft is written; the change-advisory review has not happened yet.",
  assignee:O.core, reporter:O.pay.name, labels:["pir","core","failover","guardrail"],
  incKey:null, node:"core", created:1450, updated:1990,
  comments:[
    {who:O.core.name, at:1520, text:"Draft gate written. The hard part is the refusal path - an automatic cutover that declines to run needs a very loud, very unambiguous escalation or we have simply traded one outage for a slower one."},
    {who:O.dbr.name,  at:1800, text:"Data Platform can supply the apply-headroom signal from the same source the replica lag objective uses, so the gate does not need new instrumentation."},
    {who:O.core.name, at:1988, text:"Going to the change advisory board this cycle. Staying In Progress until it has a decision."}
  ],
  history:[
    {at:1450, what:"Daw Su Myat Noe created the work item"},
    {at:1452, what:"Linked to INC-1030 (relates to)"},
    {at:1455, what:"Status changed To Do to In Progress"},
    {at:1990, what:"U Soe Naing Win added a comment"}
  ],
  links:[{rel:"relates to", key:"INC-1030"}] },

/* ------------------------------------------------------------ Aug 28 ----- */
{ key:"INC-1034", type:"incident", major:false, status:"done", priority:"high",
  summary:"Edge LB pool lost 2 of 4 members - capacity halved at the perimeter",
  desc:"Aug 28 afternoon. Two of the four load-balancer pool members dropped out of rotation, halving perimeter capacity. edge.Pool members up fell to 2, TLS termination p95 rose on the survivors, and the gateway saw the queueing behind it.\n\nNo customer-visible outage: the remaining pair carried the load at degraded latency. This is the case for watching pool membership as its own objective rather than inferring it from response time.",
  assignee:O.edge, reporter:NOC, labels:["edge","load-balancer","capacity"],
  incKey:"G", node:"edge", created:1604, updated:1650,
  comments:[
    {who:O.edge.name, at:1608, text:"Both members failed the same health check. Check definition was changed in last week's ruleset push and is stricter than the backend actually is under load."},
    {who:O.gw.name,   at:1616, text:"Gateway side confirms - the nodes behind those members were healthy the whole time. This was the check, not the backend."},
    {who:O.edge.name, at:1644, text:"Health-check threshold reverted to the previous definition, members back in rotation, pool at 4. Raising the ruleset review separately."}
  ],
  history:[
    {at:1604, what:"NOC Monitoring raised the incident from edge.Pool members up"},
    {at:1606, what:"Priority set to High"},
    {at:1608, what:"Status changed To Do to In Progress"},
    {at:1650, what:"Status changed In Progress to Done"}
  ],
  links:[] },

{ key:"INC-1036", type:"incident", major:false, status:"done", priority:"medium",
  summary:"EOD batch overrun - advice-file cut-off buffer down to 12 minutes",
  desc:"Aug 28 night. The end-of-day batch ran long and pushed the biller advice file close to its cut-off: bbatch.Cut-off buffer fell from 90 minutes to 12, advice-file age rose, and the retry queue built.\n\nThe file made the window. Flagged as a known window rather than a fault - the batch has been trending longer as volume grows, and the fix is a capacity conversation, not an incident response.",
  assignee:O.bbatch, reporter:MON, labels:["batch","settlement","known-window"],
  incKey:"I", node:"bbatch", created:1702, updated:1738,
  comments:[
    {who:O.bbatch.name,at:1706, text:"Batch is running long again. Buffer is thin but the file will make the cut-off - not escalating unless it drops under 10 minutes."},
    {who:O.core.name,  at:1712, text:"Core side: EOD is contending with the post-outage catch-up posting. Expect this one to be worse than a normal night."},
    {who:O.bbatch.name,at:1734, text:"File delivered inside the window and confirmed by the biller. Closing as a known window; the volume trend goes to the capacity review."}
  ],
  history:[
    {at:1702, what:"Adeptio Synthetic Monitor raised the incident from bbatch.Cut-off buffer"},
    {at:1704, what:"Priority set to Medium"},
    {at:1706, what:"Status changed To Do to In Progress"},
    {at:1734, what:"Label known-window added"},
    {at:1738, what:"Status changed In Progress to Done"}
  ],
  links:[] },

{ key:"INC-1037", type:"task", major:false, status:"todo", priority:"medium",
  summary:"Review per-biller timeout budgets against observed adapter latency",
  desc:"Every biller adapter currently shares one timeout budget, which is generous for the fast billers and tight for the slow ones. Pull the observed inquiry p95 per adapter over the week and propose a per-biller budget, so a single slow biller stops consuming orchestrator retry capacity that the others need.",
  assignee:O.bhub, reporter:O.pay.name, labels:["billers","timeouts","tuning"],
  incKey:null, node:"bhub", created:1720, updated:1860,
  comments:[
    {who:O.bhub.name, at:1856, text:"Data pulled. Spread between fastest and slowest biller inquiry p95 is roughly 6x, so one shared budget is definitely wrong. Proposal to follow after the brownout is closed."}
  ],
  history:[
    {at:1720, what:"Daw Su Myat Noe created the work item"},
    {at:1860, what:"Daw Yamin Htay added a comment"}
  ],
  links:[] },

/* ------------------------------------------------------------ Aug 29 ----- */
{ key:"INC-1039", type:"incident", major:false, status:"inprog", priority:"high",
  summary:"Biller hub brownout - adapter errors and timeouts across multiple billers",
  desc:"Aug 29 morning. bhub.Adapter error and bhub.Biller timeout rose together across more than one biller, with inquiry p95 stretching past band. Partial, not total: most payments completed, a minority failed at the credit leg and a smaller number left a debit awaiting credit.\n\nAggregator-side. The bank's hub was healthy; the fault was upstream of the adapters. Still open pending the vendor's root-cause statement - the symptom cleared on its own, which is exactly why we are not closing it.",
  assignee:O.bhub, reporter:MON, labels:["billers","aggregator","vendor","brownout"],
  incKey:"H", node:"bhub", created:1792, updated:2006,
  comments:[
    {who:O.bhub.name,  at:1796, text:"More than one adapter affected, so this is hub-wide or aggregator-side rather than a single bad biller. Per-adapter evidence attached."},
    {who:O.pay.name,   at:1804, text:"Orchestrator is holding the affected legs as debits awaiting credit rather than reversing them blindly. Count is small and bounded."},
    {who:O.biller.name,at:1812, text:"P1 with the aggregator NOC through Vendor Mgmt. Acknowledged; they are looking at their routing tier."},
    {who:O.recon.name, at:1870, text:"Settlement view: everything that was awaiting credit has since confirmed on the advice file. No customer is out of pocket."},
    {who:O.bhub.name,  at:2004, text:"Symptom cleared but the aggregator has not issued a root cause yet. Holding this open - a brownout that fixes itself without explanation is a brownout that recurs."}
  ],
  history:[
    {at:1792, what:"Adeptio Synthetic Monitor raised the incident from bhub.Adapter error"},
    {at:1794, what:"Priority set to High"},
    {at:1796, what:"Status changed To Do to In Progress"},
    {at:2006, what:"Daw Yamin Htay added a comment"}
  ],
  links:[] },

{ key:"INC-1041", type:"task", major:false, status:"done", priority:"low",
  summary:"Audit SNMP OIDs on the edge appliance pair after the firmware bump",
  desc:"The appliance pair took a firmware update; interface counter OIDs occasionally move between major versions. Walk the tree and confirm the OIDs the edge objectives poll - interface errors, discards and octet counters - still resolve to the same physical interfaces they did before.",
  assignee:O.edge, reporter:O.telco.name, labels:["edge","monitoring","hygiene"],
  incKey:null, node:"edge", created:1900, updated:1958,
  comments:[
    {who:O.edge.name, at:1954, text:"Walked both appliances. Interface indices are unchanged and the counters line up with the pre-upgrade baseline. Nothing to repoint."}
  ],
  history:[
    {at:1900, what:"Daw Thiri Aung created the work item"},
    {at:1930, what:"Status changed To Do to In Progress"},
    {at:1958, what:"Status changed In Progress to Done"}
  ],
  links:[] },

{ key:"INC-1042", type:"incident", major:false, status:"done", priority:"high",
  summary:"Gateway deploy regression - route p95 and 5xx up after a route-config push",
  desc:"Aug 29 evening, the most recent incident on the board. A gateway route-config deployment pushed a rule ordering that sent Pay Bill traffic through an extra authorisation hop. gw.Route p95 roughly doubled, gw.5xx rate crossed band, and pay.Technical decline followed.\n\nSharp onset, clear correlation with the deploy, rolled back inside half an hour. The corrected config still needs to go out - that is a separate item so this one can close.",
  assignee:O.gw, reporter:MON, labels:["gateway","deploy","regression"],
  incKey:"D", node:"gw", created:1934, updated:1972,
  comments:[
    {who:O.gw.name,  at:1938, text:"Onset lines up with the route-config push to the minute. Rolling back rather than debugging forward - the release manager has the call and Payments are informed."},
    {who:O.pay.name, at:1946, text:"Technical declines tracking the gateway 5xx exactly. Nothing wrong on the orchestrator side."},
    {who:O.gw.name,  at:1968, text:"Rollback complete, route p95 and 5xx back to baseline. Corrected config raised as its own item so this closes clean."}
  ],
  history:[
    {at:1934, what:"Adeptio Synthetic Monitor raised the incident from gw.Route p95"},
    {at:1936, what:"Priority set to High"},
    {at:1938, what:"Status changed To Do to In Progress"},
    {at:1968, what:"Linked to INC-1043 (causes)"},
    {at:1972, what:"Status changed In Progress to Done"}
  ],
  links:[{rel:"causes", key:"INC-1043"}] },

{ key:"INC-1043", type:"task", major:false, status:"todo", priority:"high",
  summary:"Re-deploy the gateway route config with the ordering fix",
  desc:"The Aug 29 evening deploy was rolled back, so the change it carried is still outstanding. Re-cut the route configuration with the rule ordering corrected - Pay Bill must not traverse the extra authorisation hop - and re-deploy under the normal release process with a route p95 watch on the bridge.\n\nBlocked on nothing; waiting for the next release window.",
  assignee:O.gw, reporter:O.gw.name, labels:["gateway","deploy","follow-up"],
  incKey:null, node:"gw", created:1972, updated:1972,
  comments:[
    {who:O.gw.name, at:1972, text:"Raised at rollback. Config diff is small - the ordering fix is one stanza - but it goes out with a watch, not silently."}
  ],
  history:[
    {at:1972, what:"Daw Ei Ei Khaing created the work item"},
    {at:1972, what:"Linked to INC-1042 (is caused by)"}
  ],
  links:[{rel:"is caused by", key:"INC-1042"}] }

];

/* incident window key -> the ticket that carries it. The dashboard RCA pop-up
   resolves a red indicator to a case through this map. */
const byWindow = { A:"INC-1018", B:"INC-1027", C:"INC-1012", D:"INC-1042", E:"INC-1023",
                   F:"INC-1030", G:"INC-1034", H:"INC-1039", I:"INC-1036" };

window.ADEPTIO_TICKETS = { project:"INC", name:"Pay Bill Incidents", now:2015,
                           tickets:TICKETS, byWindow:byWindow };
})();
