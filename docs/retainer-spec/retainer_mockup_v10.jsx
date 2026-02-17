import { useState } from "react";

const RATE = 80;
const BUDGET = 10;
const CYCLE = 3;
const POOL = BUDGET * CYCLE;

const tasksByMonth = [
  {
    period: "Jan 1 – 31, 2025", quarter: "Q1", monthInCycle: 1,
    tasks: [
      { date: "2025-01-02", cat: "Design", name: "Zoom Webinar Integration", desc: "Connect Zoom to HubSpot. Enable sync for newly scheduled webinars. Test with dummy webinar.", hours: 1 },
      { date: "2025-01-03", cat: "Design", name: "Cal.com → HubSpot Connection", desc: "Set up Zapier: Cal.com booking triggers → Update HubSpot contact + create task notification.", hours: 1 },
      { date: "2025-01-04", cat: "Design", name: "HubSpot Campaign Setup", desc: "Create 4 campaigns (one per webinar) to track all assets and attribute revenue.", hours: 2 },
    ],
  },
  {
    period: "Feb 1 – 28, 2025", quarter: "Q1", monthInCycle: 2,
    tasks: [
      { date: "2025-02-03", cat: "Copywriting", name: "Email Sequence Design", desc: "Design 5-email nurture sequence: welcome, reminder, last chance, replay, feedback request.", hours: 3 },
      { date: "2025-02-10", cat: "Design", name: "Social Media Graphics", desc: "Create 8 social cards (4 announcement + 4 reminder) for LinkedIn and Instagram.", hours: 2 },
      { date: "2025-02-18", cat: "Development", name: "UTM Tracking Dashboard", desc: "Build Google Looker Studio dashboard pulling UTM data from GA4. Filter by campaign and source.", hours: 2 },
    ],
  },
  {
    period: "Mar 1 – 31, 2025", quarter: "Q1", monthInCycle: 3,
    tasks: [
      { date: "2025-03-03", cat: "Development", name: "Landing Page Template", desc: "Design responsive registration page: hero section, headline/subhead, speaker bio + photo, bullet points, date/time with timezone, social proof section, form embed area.", hours: 6 },
      { date: "2025-03-10", cat: "Development", name: "Thank You Page", desc: "Post-submission page: confirmation message, calendar add buttons (.ics, Google Cal), what happens next copy.", hours: 2 },
      { date: "2025-03-12", cat: "Development", name: "HubSpot Tracking Code", desc: "Add HubSpot tracking script to Webflow site settings for analytics and contact tracking.", hours: 1 },
      { date: "2025-03-17", cat: "Development", name: "Recording Landing Pages", desc: "Create replay pages for each webinar with embedded Wistia player, chapters, and related resources section.", hours: 5 },
      { date: "2025-03-24", cat: "Copywriting", name: "Post-Webinar Email Flow", desc: "Set up automated emails: replay link (day 1), highlights + CTA (day 3), feedback survey (day 5).", hours: 3 },
    ],
  },
  {
    period: "Apr 1 – 30, 2025", quarter: "Q2", monthInCycle: 1,
    tasks: [
      { date: "2025-04-02", cat: "Copywriting", name: "Q2 Campaign Brief", desc: "Define target audience, messaging pillars, channel strategy, and KPIs for Q2 webinar series.", hours: 3 },
      { date: "2025-04-08", cat: "Copywriting", name: "Speaker Outreach Emails", desc: "Draft and send personalized outreach to 12 potential speakers. Include topic suggestions and logistics.", hours: 2 },
      { date: "2025-04-14", cat: "Development", name: "New Blog Template", desc: "Design Webflow blog template with featured image, reading time, author card, related posts, and newsletter CTA.", hours: 6 },
    ],
  },
  {
    period: "May 1 – 31, 2025", quarter: "Q2", monthInCycle: 2,
    tasks: [
      { date: "2025-05-05", cat: "Development", name: "API Integration Fix", desc: "Debug and fix broken Cal.com → HubSpot webhook. Update Zapier zap with new field mappings.", hours: 2 },
      { date: "2025-05-12", cat: "Development", name: "New Landing Page Variant", desc: "Create A/B test variant with shorter form (name + email only) and social proof above the fold.", hours: 5 },
      { date: "2025-05-19", cat: "Development", name: "CRM Workflow Automation", desc: "Build HubSpot workflow: auto-assign leads to sales reps based on company size and webinar attended.", hours: 4 },
    ],
  },
  {
    period: "Jun 1 – 30, 2025", quarter: "Q2", monthInCycle: 3,
    tasks: [
      { date: "2025-06-02", cat: "Design", name: "Brand Refresh Assets", desc: "Update all templates (email, social, landing page) with new brand colors, typography, and logo placement.", hours: 4 },
      { date: "2025-06-09", cat: "Design", name: "Webinar Slide Template", desc: "Design master slide deck: title, agenda, speaker intro, content, Q&A, and CTA slides with animations.", hours: 3 },
      { date: "2025-06-16", cat: "Development", name: "Landing Page V2", desc: "Redesign registration page based on Q1 data: larger CTA, countdown timer, testimonial carousel.", hours: 5 },
      { date: "2025-06-23", cat: "Development", name: "A/B Test Setup", desc: "Configure Google Optimize for landing page test. Set up goals in GA4 and statistical significance threshold.", hours: 2 },
    ],
  },
];

function compute(data, rollover) {
  let bal = 0;
  return data.map((m) => {
    const isCycleStart = m.monthInCycle === 1;
    const isCycleEnd = m.monthInCycle === CYCLE;
    const worked = m.tasks.reduce((s, t) => s + t.hours, 0);
    if (rollover) {
      if (isCycleStart) bal = 0;
      const startBal = bal;
      bal = startBal + BUDGET - worked;
      const available = startBal + BUDGET;
      return { ...m, startBal, available, worked, endBal: bal, isCycleStart, isCycleEnd, extra: isCycleEnd && bal < 0 ? Math.abs(bal) : 0, unused: isCycleEnd && bal > 0 ? bal : 0, settles: isCycleEnd };
    } else {
      return { ...m, startBal: 0, available: BUDGET, worked, endBal: BUDGET - worked, isCycleStart: false, isCycleEnd: false, extra: Math.max(0, worked - BUDGET), unused: Math.max(0, BUDGET - worked), settles: true };
    }
  });
}

/* Notion/Linear inspired palette — everything muted */
const C = {
  text: "#37352f",
  textSecondary: "#787774",
  textTertiary: "#b4b4b0",
  border: "#e9e9e7",
  borderSubtle: "#f1f1ef",
  bg: "#ffffff",
  bgHover: "#fafaf9",
  bgSubtle: "#f7f7f5",
  bgAccent: "#f4f4f2",

  /* Semantic — all muted, never shouty */
  positive: "#4b7a5b",
  positiveBg: "#f3f8f4",
  negative: "#9b6457",
  negativeBg: "#faf5f4",
  warn: "#9b8152",
  warnBg: "#faf8f3",
  accent: "#5b7a9b",
  accentBg: "#f3f6fa",
};

const labelStyle = {
  fontSize: 10,
  fontWeight: 600,
  color: C.textTertiary,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const qRange = {Q1:"Jan – Mar",Q2:"Apr – Jun",Q3:"Jul – Sep",Q4:"Oct – Dec"};

/*
 * ── TEXT DICTIONARY ──
 * Every user-facing string lives here.
 * In NextJS: export this from lib/retainer-strings.ts
 * Swap this object for i18n or per-client overrides.
 *
 * Tokens: {n} = number, {budget} = monthly budget
 */
const T = {
  // Three-box labels (fixed, never change)
  startedWith:    "Started with",
  hoursUsed:      "Hours used",
  endingBalance:  "Ending balance",

  // Started-with subtitles
  startBudgetOnly:     (b) => `${b}h budget`,
  startCycleStart:     (b) => `${b}h budget · cycle start`,
  startWithCarry:      (b, n) => `${b}h budget + ${n}h from last month`,
  startWithDeduction:  (b, n) => `${b}h budget – ${n}h from last month`,
  startNoRollover:     (b) => `${b}h monthly budget`,

  // Hours-used subtitle
  tasksCompleted: (n) => `${n} task${n !== 1 ? "s" : ""} completed`,

  // Ending-balance subtitles
  carriesOver:     "Carries over",
  deductedNext:    "Deducted next month",
  allUsed:         "All hours used",
  paymentDue:      "Payment due",
  notCarriedOver:  "Not carried over",
  notUsed:         "Not used",
  noExtraCharges:  "No extra charges",

  // Row tags (collapsed view, right side)
  tagCarries:      (n) => `${n}h carries`,
  tagOver:         (n) => `${n}h over`,
  tagUnused:       (n) => `${n}h unused`,
  tagOnBudget:     "on budget",
  tagCycleClosed:  "cycle closed",
  tagPaymentDue:   (n) => `+${n}h · payment due`,

  // Settlement block
  extraHoursLabel: (range) => `${range} · Extra hours`,
  extraExplainCycle:  (used, extra, pool) => `${used}h used this cycle — ${extra}h more than the ${pool}h included.`,
  extraExplainMonth:  (used, extra, budget) => `${used}h used — ${extra}h more than the ${budget}h included.`,
  extraInvoice:    "Extra hours invoice",
  extraCalc:       (n, rate) => `${n} hours × $${rate}/h`,
  unusedCycle:     (n) => `${n}h not used this cycle. Balance resets for the next cycle.`,
  unusedMonth:     (n) => `${n}h not used. Next month starts fresh.`,

  // Dashboard
  currentCycle:    (range) => `Current cycle · ${range}`,
  thisMonth:       "This month",
  hoursUsedLabel:  "hours used",
  remaining:       "remaining",
  overBudget:      "over budget",
  fullyUsed:       "fully used",
  ofAvailable:     (n) => `of ${n}h available`,
};

function Month({ m, isFirst, rollover, allMonths }) {
  const [open, setOpen] = useState(isFirst);
  const over = m.endBal < 0;
  const cycleMonths = rollover ? allMonths.filter(x => x.quarter === m.quarter) : [];
  const cycleWorkedSoFar = rollover ? cycleMonths.filter(x => x.monthInCycle <= m.monthInCycle).reduce((s, x) => s + x.worked, 0) : 0;

  const startedSub = () => {
    if (!rollover) return T.startNoRollover(BUDGET);
    if (m.isCycleStart) return T.startCycleStart(BUDGET);
    if (m.startBal > 0) return T.startWithCarry(BUDGET, m.startBal);
    if (m.startBal < 0) return T.startWithDeduction(BUDGET, Math.abs(m.startBal));
    return T.startBudgetOnly(BUDGET);
  };

  const endingSub = () => {
    if (rollover && !m.isCycleEnd) {
      if (m.endBal > 0) return T.carriesOver;
      if (m.endBal < 0) return T.deductedNext;
      return T.allUsed;
    }
    if (m.settles) {
      if (m.extra > 0) return T.paymentDue;
      if (m.unused > 0) return rollover ? T.notCarriedOver : T.notUsed;
      return T.noExtraCharges;
    }
    return "";
  };

  // End-of-row tag
  let endTag;
  if (rollover && m.settles && m.extra > 0) {
    endTag = { label: `+${m.extra}h · payment due`, color: C.negative, bg: C.negativeBg, cycleEnd: true };
  } else if (rollover && m.settles && m.unused > 0) {
    endTag = { label: `${m.unused}h unused`, color: C.warn, bg: C.warnBg, cycleEnd: true };
  } else if (rollover && m.settles) {
    endTag = { label: "on budget", color: C.positive, bg: C.positiveBg, cycleEnd: true };
  } else if (m.endBal > 0) {
    endTag = { label: rollover ? `+${m.endBal}h carries` : T.tagUnused(m.endBal), color: rollover ? C.positive : C.warn, bg: rollover ? C.positiveBg : C.warnBg };
  } else if (m.endBal < 0) {
    endTag = { label: rollover ? `–${Math.abs(m.endBal)}h carries` : T.tagOver(Math.abs(m.endBal)), color: C.negative, bg: C.negativeBg };
  } else {
    endTag = { label: T.tagOnBudget, color: C.textTertiary, bg: C.bgSubtle };
  }

  return (
    <div style={{ borderBottom: `1px solid ${C.border}` }}>
      <div
        onClick={() => setOpen(!open)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", cursor: "pointer", userSelect: "none" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <svg width="14" height="14" viewBox="0 0 14 14" style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s", flexShrink: 0 }}>
            <path d="M5 3.5l3.5 3.5L5 10.5" fill="none" stroke={C.textTertiary} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{m.period}</span>
          {rollover && (
            <span style={{ fontSize: 10, fontWeight: 500, color: C.accent, backgroundColor: C.accentBg, padding: "1px 6px", borderRadius: 3 }}>{qRange[m.quarter]}</span>
          )}
          <span style={{ fontSize: 12, fontWeight: 500, color: C.textTertiary, fontVariantNumeric: "tabular-nums" }}>{m.worked}h logged</span>
        </div>
        <span style={{ fontSize: 11, fontWeight: 500, color: endTag.color, backgroundColor: endTag.bg, padding: "2px 8px", borderRadius: 3 }}>
          {endTag.label}
        </span>
      </div>

      {open && (
        <div style={{ paddingBottom: 24, paddingLeft: 22 }}>

          {/* ─── Three boxes ─── */}
          <div style={{
            display: "flex", borderRadius: 6, overflow: "hidden",
            border: `1px solid ${C.border}`, marginBottom: 16,
          }}>
            {/* Started with */}
            <div style={{ flex: 1, padding: "14px 16px", borderRight: `1px solid ${C.border}`, backgroundColor: C.bgSubtle }}>
              <div style={{ ...labelStyle, marginBottom: 8 }}>{T.startedWith}</div>
              <div style={{ fontSize: 24, fontWeight: 600, color: C.text, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                {m.available}<span style={{ fontSize: 13, fontWeight: 400, color: C.textSecondary, marginLeft: 1 }}>h</span>
              </div>
              <div style={{ fontSize: 11, color: C.textTertiary, marginTop: 6, lineHeight: 1.4 }}>{startedSub()}</div>
            </div>

            {/* Hours used */}
            <div style={{ flex: 1, padding: "14px 16px", borderRight: `1px solid ${C.border}` }}>
              <div style={{ ...labelStyle, marginBottom: 8 }}>{T.hoursUsed}</div>
              <div style={{ fontSize: 24, fontWeight: 600, color: C.text, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                {m.worked}<span style={{ fontSize: 13, fontWeight: 400, color: C.textSecondary, marginLeft: 1 }}>h</span>
              </div>
              <div style={{ fontSize: 11, color: C.textTertiary, marginTop: 6 }}>{T.tasksCompleted(m.tasks.length)}</div>
            </div>

            {/* Ending balance */}
            <div style={{
              flex: 1, padding: "14px 16px",
              backgroundColor: over ? C.negativeBg : m.endBal > 0 ? C.positiveBg : C.bgSubtle,
            }}>
              <div style={{ ...labelStyle, marginBottom: 8 }}>{T.endingBalance}</div>
              <div style={{
                fontSize: 24, fontWeight: 600, fontVariantNumeric: "tabular-nums", lineHeight: 1,
                color: over ? C.negative : m.endBal > 0 ? C.positive : C.textTertiary,
              }}>
                {over ? "–" : m.endBal > 0 ? "+" : ""}{Math.abs(m.endBal)}<span style={{ fontSize: 13, fontWeight: 400, marginLeft: 1 }}>h</span>
              </div>
              <div style={{ fontSize: 11, color: over ? C.negative : m.endBal > 0 ? C.positive : C.textTertiary, marginTop: 6 }}>{endingSub()}</div>
            </div>
          </div>

          {/* Task list grouped by category */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ ...labelStyle, marginBottom: 8 }}>Work completed</div>
            {(() => {
              // Group tasks by category
              const groups = {};
              m.tasks.forEach(t => {
                const cat = t.cat || "Other";
                if (!groups[cat]) groups[cat] = [];
                groups[cat].push(t);
              });
              return Object.entries(groups).map(([cat, tasks], gi) => {
                const catHours = tasks.reduce((s, t) => s + t.hours, 0);
                return (
                  <div key={cat} style={{ marginBottom: gi < Object.keys(groups).length - 1 ? 12 : 0 }}>
                    {/* Category header */}
                    <div style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "6px 0", marginBottom: 2,
                      borderBottom: `1px solid ${C.border}`,
                    }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: C.textSecondary }}>{cat}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: C.textSecondary, fontVariantNumeric: "tabular-nums" }}>{catHours}h</span>
                    </div>
                    {/* Tasks */}
                    {tasks.map((t, i) => {
                      const shortDate = t.date.slice(5);
                      return (
                        <div key={i} style={{
                          display: "flex", alignItems: "flex-start", gap: 0,
                          padding: "7px 0",
                          borderBottom: `1px solid ${i < tasks.length - 1 ? C.borderSubtle : "transparent"}`,
                        }}>
                          <span style={{ fontSize: 11, fontWeight: 500, color: C.textTertiary, fontVariantNumeric: "tabular-nums", flexShrink: 0, width: 42, paddingTop: 1 }}>{shortDate}</span>
                          <span style={{ fontSize: 13, fontWeight: 500, color: C.text, flexShrink: 0, width: 200 }}>{t.name}</span>
                          <span style={{ fontSize: 12, color: C.textTertiary, flex: 1, lineHeight: 1.4, paddingRight: 12, paddingTop: 1 }}>{t.desc || ""}</span>
                          <span style={{ fontSize: 13, fontWeight: 500, color: C.textSecondary, fontVariantNumeric: "tabular-nums", flexShrink: 0, textAlign: "right", width: 30, paddingTop: 1 }}>{t.hours}h</span>
                        </div>
                      );
                    })}
                  </div>
                );
              });
            })()}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 0", marginTop: 8, borderTop: `1.5px solid ${C.border}` }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Total</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.text, fontVariantNumeric: "tabular-nums" }}>{m.worked}h</span>
            </div>
          </div>

          {/* Settlement — calm, not alarming */}
          {m.settles && m.extra > 0 && (
            <div style={{
              borderRadius: 6, border: `1px solid ${C.border}`, overflow: "hidden",
            }}>
              <div style={{
                padding: "10px 16px",
                backgroundColor: C.negativeBg,
                borderBottom: `1px solid ${C.border}`,
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.textTertiary, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                  {T.extraHoursLabel(rollover ? qRange[m.quarter] : m.period)}
                </div>
                <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.5 }}>
                  {rollover
                    ? T.extraExplainCycle(cycleWorkedSoFar, m.extra, POOL)
                    : T.extraExplainMonth(m.worked, m.extra, BUDGET)
                  }
                </div>
              </div>
              <div style={{
                padding: "14px 16px", backgroundColor: C.bg,
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{T.extraInvoice}</div>
                  <div style={{ fontSize: 12, color: C.textTertiary, marginTop: 2 }}>{T.extraCalc(m.extra, RATE)}</div>
                </div>
                <div style={{ fontSize: 22, fontWeight: 600, color: C.text, fontVariantNumeric: "tabular-nums" }}>
                  ${m.extra * RATE}
                </div>
              </div>
            </div>
          )}

          {m.settles && m.unused > 0 && (
            <div style={{ padding: "10px 16px", borderRadius: 6, backgroundColor: C.warnBg, border: `1px solid ${C.border}`, fontSize: 13, color: C.warn, lineHeight: 1.5 }}>
              {rollover ? T.unusedCycle(m.unused) : T.unusedMonth(m.unused)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Toggle({ value, onChange }) {
  return (
    <button onClick={() => onChange(!value)} style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      padding: "4px 10px", borderRadius: 6, border: `1px solid ${C.border}`,
      backgroundColor: C.bg, cursor: "pointer",
      fontSize: 13, fontWeight: 400, color: C.textSecondary, transition: "all 0.1s",
    }}>
      <div style={{
        width: 28, height: 16, borderRadius: 8,
        backgroundColor: value ? C.positive : C.textTertiary,
        position: "relative", transition: "background 0.15s",
      }}>
        <div style={{
          width: 12, height: 12, borderRadius: 6, backgroundColor: "#fff",
          position: "absolute", top: 2, left: value ? 14 : 2, transition: "left 0.15s",
          boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
        }} />
      </div>
      <span style={{ color: C.text, fontWeight: 500 }}>Rollover</span>
      <span>{value ? "On" : "Off"}</span>
    </button>
  );
}

export default function App() {
  const [rollover, setRollover] = useState(true);
  const allMonths = compute(tasksByMonth, rollover);
  const reversed = [...allMonths].reverse();
  const current = reversed[0];
  const cycleMonths = rollover ? allMonths.filter(x => x.quarter === current.quarter) : [current];
  const cycleWorked = cycleMonths.reduce((s, x) => s + x.worked, 0);
  const cycleBudget = rollover ? POOL : BUDGET;
  const cycleRemaining = cycleBudget - cycleWorked;

  return (
    <div style={{
      maxWidth: 660, margin: "0 auto", padding: "40px 24px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      backgroundColor: "#fff", minHeight: "100vh",
      color: C.text,
    }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: C.text, letterSpacing: "-0.02em" }}>Arlow</h1>
        <div style={{ fontSize: 13, color: C.textSecondary, marginTop: 2 }}>
          {BUDGET}h/month · ${RATE}/h{rollover && <> · {CYCLE}-month cycles</>}
        </div>
      </div>

      {/* Controls */}
      <div style={{ marginBottom: 24 }}>
        <Toggle value={rollover} onChange={setRollover} />
      </div>

      {/* ── Cycle Dashboard ── */}
      <div style={{
        borderRadius: 8, marginBottom: 16,
        border: `1px solid ${C.border}`,
        overflow: "hidden",
      }}>
        {/* Top row: cycle label + big numbers */}
        <div style={{
          padding: "20px 24px",
          backgroundColor: C.bgSubtle,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ ...labelStyle, marginBottom: 6 }}>
              {rollover ? T.currentCycle(`${qRange[current.quarter]} 2025`) : T.thisMonth}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <span style={{
                fontSize: 32, fontWeight: 600, fontVariantNumeric: "tabular-nums", lineHeight: 1,
                color: cycleWorked > cycleBudget ? C.negative : C.text,
                letterSpacing: "-0.03em",
              }}>
                {cycleWorked}
              </span>
              <span style={{ fontSize: 18, fontWeight: 300, color: C.textTertiary }}>/</span>
              <span style={{ fontSize: 32, fontWeight: 600, fontVariantNumeric: "tabular-nums", lineHeight: 1, color: C.textSecondary, letterSpacing: "-0.03em" }}>
                {cycleBudget}
              </span>
              <span style={{ fontSize: 14, fontWeight: 400, color: C.textTertiary, marginLeft: 2 }}>hours used</span>
            </div>
          </div>
          <div style={{
            textAlign: "center", padding: "8px 16px", borderRadius: 6,
            backgroundColor: cycleRemaining >= 0 ? C.positiveBg : C.negativeBg,
          }}>
            <div style={{
              fontSize: 28, fontWeight: 600, fontVariantNumeric: "tabular-nums", lineHeight: 1,
              color: cycleRemaining >= 0 ? C.positive : C.negative,
            }}>
              {cycleRemaining < 0 && "–"}{Math.abs(cycleRemaining)}h
            </div>
            <div style={{ fontSize: 11, color: cycleRemaining >= 0 ? C.positive : C.negative, marginTop: 4, fontWeight: 500 }}>
              {cycleRemaining > 0 ? "remaining" : cycleRemaining < 0 ? "over budget" : "fully used"}
            </div>
          </div>
        </div>

        {/* Month-by-month breakdown */}
        {rollover && (
          <div style={{
            display: "flex",
            borderTop: `1px solid ${C.border}`,
          }}>
            {cycleMonths.map((cm, i) => {
              const isLast = i === cycleMonths.length - 1;
              const isFuture = cm.worked === undefined;
              const carried = !cm.isCycleStart && cm.startBal > 0 ? cm.startBal : 0;
              const debt = !cm.isCycleStart && cm.startBal < 0 ? Math.abs(cm.startBal) : 0;

              // Status tag
              let tag = null;
              if (cm.isCycleEnd && cm.extra > 0) tag = { label: T.tagPaymentDue(cm.extra), color: C.negative };
              else if (cm.isCycleEnd && cm.unused > 0) tag = { label: T.tagUnused(cm.unused), color: C.warn };
              else if (!cm.isCycleEnd && cm.endBal > 0) tag = { label: `+${cm.endBal}h carries`, color: C.positive };
              else if (!cm.isCycleEnd && cm.endBal < 0) tag = { label: `–${Math.abs(cm.endBal)}h carries`, color: C.negative };

              const shortMonth = cm.period.split(" ")[0]; // "Jan", "Feb", etc.

              return (
                <div key={i} style={{
                  flex: 1,
                  padding: "14px 16px",
                  borderRight: !isLast ? `1px solid ${C.border}` : "none",
                  backgroundColor: C.bg,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.textTertiary, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
                    {shortMonth}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 600, color: C.text, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                    {cm.worked}<span style={{ fontSize: 12, fontWeight: 400, color: C.textTertiary, marginLeft: 1 }}>h</span>
                  </div>
                  <div style={{ fontSize: 11, color: C.textTertiary, marginTop: 4 }}>
                    of <span style={{ fontWeight: 500, color: cm.available < BUDGET ? C.negative : cm.available > BUDGET ? C.positive : C.textSecondary }}>{cm.available}</span> / {BUDGET}h available
                  </div>
                  {tag && (
                    <div style={{ marginTop: 6 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 500, color: tag.color,
                        backgroundColor: tag.color + "10",
                        padding: "2px 6px", borderRadius: 3,
                      }}>
                        {tag.label}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Months */}
      <div style={{ borderTop: `1px solid ${C.border}` }}>
        {reversed.map((m, i) => (
          <Month key={m.period + rollover} m={m} isFirst={i === 0} rollover={rollover} allMonths={allMonths} />
        ))}
      </div>

      <div style={{ marginTop: 24, fontSize: 11, color: C.textTertiary, textAlign: "center" }}>
        {BUDGET}h/month · ${RATE}/h · {rollover ? `${CYCLE}-month cycles` : "no rollover"}
      </div>
    </div>
  );
}
