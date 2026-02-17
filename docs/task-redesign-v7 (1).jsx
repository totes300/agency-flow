import React, { useState, useRef, useEffect, useCallback } from "react";

// ─── Data ──────────────────────────────────────────────
const now = Date.now();
const h = 3600000; const m = 60000; const d = 86400000;
const INITIAL_TASKS = [
  { id: 1, title: "Research charting libraries", project: "Dashboard App", client: "NovaTech", assignee: "Adam", status: "done", category: "Development", trackedMinutes: 2610, priority: "low", notes: "", dueDate: now - 2*d, createdAt: now - 96*h, comments: [{ user: "Adam", text: "Evaluated Chart.js, Recharts, and D3. Going with Recharts.", time: now - 2*h }, { user: "Lisa", text: "Good call. Recharts has better React integration.", time: now - 1*h }], lastEdited: now - 1*h, lastViewed: now, lastTimeEntry: now - 3*h, lastActivity: { user: "Lisa", action: "commented", time: now - 1*h }, activityLog: [{ user: "Lisa", action: "commented", time: now - 1*h }, { user: "Adam", action: "commented", time: now - 2*h }, { user: "Adam", action: "marked as done", time: now - 3*h }, { user: "Adam", action: "logged 2h 30m", time: now - 4*h }, { user: "Adam", action: "created task", time: now - 96*h }] },
  { id: 2, title: "Write API documentation", project: "Dashboard App", client: "NovaTech", assignee: "Adam", status: "today", category: "Copywriting", trackedMinutes: 450, priority: "high", notes: "Cover all REST endpoints, include example payloads. Use OpenAPI 3.0 spec format.", dueDate: now, createdAt: now - 5*d, comments: [{ user: "Adam", text: "Started with auth endpoints. About 40% done.", time: now - 30*m }, { user: "Mark", text: "Don't forget the rate limit headers!", time: now - 10*m }], lastEdited: now - 10*m, lastViewed: now - 2*h, lastTimeEntry: now - 25*m, lastActivity: { user: "Mark", action: "commented", time: now - 10*m }, activityLog: [{ user: "Mark", action: "commented", time: now - 10*m }, { user: "Adam", action: "logged 1h 15m", time: now - 25*m }, { user: "Adam", action: "commented", time: now - 30*m }, { user: "Adam", action: "moved to In Progress", time: now - 2*h }, { user: "Adam", action: "edited description", time: now - 5*h }] },
  { id: 3, title: "Build analytics API endpoints", project: "Dashboard App", client: "NovaTech", assignee: "Adam", status: "next", category: "Development", trackedMinutes: 1500, priority: "high", notes: "Need pageviews, sessions, bounce rate, and conversion endpoints.", dueDate: now + 3*d, createdAt: now - 120*h, comments: [{ user: "Adam", text: "Pageviews and sessions done. Starting bounce rate.", time: now - 4*h }], lastEdited: now - 4*h, lastViewed: now, lastTimeEntry: now - 26*h, lastActivity: { user: "Adam", action: "commented", time: now - 4*h }, activityLog: [{ user: "Adam", action: "commented", time: now - 4*h }, { user: "Adam", action: "logged 3h", time: now - 26*h }, { user: "Adam", action: "edited description", time: now - 48*h }, { user: "Adam", action: "created task", time: now - 120*h }] },
  { id: 4, title: "Dashboard wireframes and UI kit", project: "Dashboard App", client: "NovaTech", assignee: "Adam", status: "done", category: "Design", trackedMinutes: 840, priority: "medium", notes: "", dueDate: now - 3*d, createdAt: now - 10*d, comments: [{ user: "Lisa", text: "Wireframes approved by client.", time: now - 24*h }], lastEdited: now - 24*h, lastViewed: now, lastTimeEntry: now - 48*h, lastActivity: { user: "Lisa", action: "approved", time: now - 24*h }, activityLog: [{ user: "Lisa", action: "commented", time: now - 24*h }, { user: "Adam", action: "marked as done", time: now - 24*h }, { user: "Adam", action: "logged 4h", time: now - 48*h }] },
  { id: 5, title: "Weekly sync with Stellar team", project: "Monthly Retainer", client: "Stellar Agency", assignee: "Adam", status: "done", category: "Meeting", trackedMinutes: 120, priority: "low", notes: "", dueDate: null, createdAt: now - 7*d, comments: [], lastEdited: now - 48*h, lastViewed: now, lastTimeEntry: now - 48*h, lastActivity: { user: "Adam", action: "marked as done", time: now - 48*h }, activityLog: [{ user: "Adam", action: "marked as done", time: now - 48*h }, { user: "Adam", action: "logged 2h", time: now - 48*h }] },
  { id: 6, title: "Write January blog post", project: "Monthly Retainer", client: "Stellar Agency", assignee: "Adam", status: "done", category: "Copywriting", trackedMinutes: 360, priority: "medium", notes: "", dueDate: null, createdAt: now - 14*d, comments: [{ user: "Sarah", text: "Published! Great piece.", time: now - 72*h }], lastEdited: now - 72*h, lastViewed: now, lastTimeEntry: now - 96*h, lastActivity: { user: "Sarah", action: "commented", time: now - 72*h }, activityLog: [{ user: "Sarah", action: "commented", time: now - 72*h }, { user: "Adam", action: "marked as done", time: now - 72*h }, { user: "Adam", action: "logged 6h", time: now - 96*h }] },
  { id: 7, title: "Fix checkout flow bug", project: "Monthly Retainer", client: "Stellar Agency", assignee: "Adam", status: "done", category: "Development", trackedMinutes: 360, priority: "high", notes: "", dueDate: now - 1*d, createdAt: now - 3*d, comments: [], lastEdited: now - 36*h, lastViewed: now, lastTimeEntry: now - 36*h, lastActivity: { user: "Adam", action: "marked as done", time: now - 36*h }, activityLog: [{ user: "Adam", action: "marked as done", time: now - 36*h }, { user: "Adam", action: "logged 6h", time: now - 36*h }] },
  { id: 8, title: "Landing page redesign", project: "Monthly Retainer", client: "Stellar Agency", assignee: "Adam", status: "done", category: "Design", trackedMinutes: 630, priority: "medium", notes: "", dueDate: null, createdAt: now - 20*d, comments: [], lastEdited: now - 96*h, lastViewed: now, lastTimeEntry: now - 120*h, lastActivity: { user: "Adam", action: "marked as done", time: now - 96*h }, activityLog: [{ user: "Adam", action: "marked as done", time: now - 96*h }, { user: "Adam", action: "logged 2h 30m", time: now - 120*h }] },
  { id: 9, title: "Write API integration tests", project: "Brand Guide", client: "Acme Corp", assignee: "Adam", status: "next", category: "Development", trackedMinutes: 0, priority: "medium", notes: "Need test coverage for auth + CRUD operations. Target 80% coverage.", dueDate: now + 5*d, createdAt: now - 24*h, comments: [{ user: "Mark", text: "Use Jest + Supertest. Here's the boilerplate.", time: now - 5*h }, { user: "Adam", text: "Got it, will start tomorrow.", time: now - 3*h }, { user: "Mark", text: "Also add integration tests for the webhook handler.", time: now - 20*m }], lastEdited: now - 20*m, lastViewed: now - 6*h, lastTimeEntry: null, lastActivity: { user: "Mark", action: "commented", time: now - 20*m }, activityLog: [{ user: "Mark", action: "commented", time: now - 20*m }, { user: "Adam", action: "commented", time: now - 3*h }, { user: "Mark", action: "commented", time: now - 5*h }, { user: "Adam", action: "moved to Todo", time: now - 8*h }, { user: "Adam", action: "created task", time: now - 24*h }] },
  { id: 10, title: "Project kickoff meeting notes", project: "Mobile App", client: "BigCo Inc", assignee: "Adam", status: "review", category: "Development", trackedMinutes: 0, priority: "high", notes: "Summarize decisions from kickoff. Include timeline, tech stack choices, and risk assessment.", dueDate: now + 1*d, createdAt: now - 6*h, comments: [{ user: "Adam", text: "Draft uploaded. Need review from PM.", time: now - 2*h }, { user: "Lisa", text: "Reviewing now.", time: now - 45*m }], lastEdited: now - 45*m, lastViewed: now - 3*h, lastTimeEntry: null, lastActivity: { user: "Lisa", action: "started reviewing", time: now - 45*m }, activityLog: [{ user: "Lisa", action: "started reviewing", time: now - 45*m }, { user: "Lisa", action: "commented", time: now - 45*m }, { user: "Adam", action: "commented", time: now - 2*h }, { user: "Adam", action: "moved to In Review", time: now - 2*h }, { user: "Adam", action: "created task", time: now - 6*h }] },
  { id: 11, title: "Design app onboarding screens", project: "Mobile App", client: "BigCo Inc", assignee: "Adam", status: "review", category: "Design", trackedMinutes: 0, priority: "medium", notes: "3 onboarding screens: welcome, permissions, profile setup.", dueDate: now - 0.5*d, createdAt: now - 12*h, comments: [{ user: "Sarah", text: "Love the illustrations! One note: make CTA buttons bigger.", time: now - 15*m }], lastEdited: now - 15*m, lastViewed: now - 1*h, lastTimeEntry: null, lastActivity: { user: "Sarah", action: "commented", time: now - 15*m }, activityLog: [{ user: "Sarah", action: "commented", time: now - 15*m }, { user: "Adam", action: "moved to In Review", time: now - 1*h }, { user: "Adam", action: "edited description", time: now - 3*h }, { user: "Adam", action: "created task", time: now - 12*h }] },
  { id: 12, title: "Competitive analysis document", project: "Mobile App", client: "BigCo Inc", assignee: "Adam", status: "inbox", category: "Copywriting", trackedMinutes: 375, priority: "low", notes: "Compare features, pricing, UX of top 5 competitors.", dueDate: now + 14*d, createdAt: now - 240*h, comments: [], lastEdited: now - 120*h, lastViewed: now, lastTimeEntry: now - 168*h, lastActivity: { user: "Adam", action: "edited description", time: now - 120*h }, activityLog: [{ user: "Adam", action: "edited description", time: now - 120*h }, { user: "Adam", action: "logged 6h 15m", time: now - 168*h }, { user: "Adam", action: "created task", time: now - 240*h }] },
  { id: 13, title: "Client onboarding checklist", project: "Acme Monthly", client: "Acme Corp", assignee: null, status: "inbox", category: "Copywriting", trackedMinutes: 3900, priority: "low", notes: "", dueDate: now + 2*d, createdAt: now - 480*h, comments: [{ user: "Lisa", text: "Who is picking this up? We need it by Friday.", time: now - 30*m }], lastEdited: now - 30*m, lastViewed: now - 2*h, lastTimeEntry: now - 240*h, lastActivity: { user: "Lisa", action: "commented", time: now - 30*m }, activityLog: [{ user: "Lisa", action: "commented", time: now - 30*m }, { user: "Adam", action: "logged 65h", time: now - 240*h }, { user: "Adam", action: "created task", time: now - 480*h }] },
];

const STATUS_ORDER = ["today", "review", "next", "inbox", "done"];
const STATUS_CONFIG = {
  done:   { color: "#5a9e6f", bg: "#f2f7f4", label: "Done",    sortOrder: 4 },
  today:  { color: "#c25852", bg: "#fbf7f6", label: "Today",   sortOrder: 0 },
  next:   { color: "#7a9ab8", bg: "#f3f6f9", label: "Next Up",    sortOrder: 2 },
  review: { color: "#9b8ab5", bg: "#f5f3f8", label: "In Review", sortOrder: 1 },
  inbox:  { color: "#c2c7ce", bg: "#f8f8f9", label: "Backlog",   sortOrder: 3 },
};

const CAT_COLOR = { Development: "#5a8abf", Design: "#b5628a", Copywriting: "#b89245", Meeting: "#4d9660" };

// ─── Date filter helpers ───────────────────────────────
function startOfDay(ts) { const d = new Date(ts); d.setHours(0,0,0,0); return d.getTime(); }
function endOfDay(ts) { const d = new Date(ts); d.setHours(23,59,59,999); return d.getTime(); }
function startOfWeek(ts) { const dt = new Date(ts); const day = dt.getDay(); const diff = day === 0 ? -6 : 1 - day; dt.setDate(dt.getDate() + diff); dt.setHours(0,0,0,0); return dt.getTime(); }
function startOfMonth(ts) { const dt = new Date(ts); dt.setDate(1); dt.setHours(0,0,0,0); return dt.getTime(); }
function endOfMonth(ts) { const dt = new Date(ts); dt.setMonth(dt.getMonth()+1, 0); dt.setHours(23,59,59,999); return dt.getTime(); }

const DATE_PRESETS = [
  { key: "today",       label: "Today",        range: () => [startOfDay(now), endOfDay(now)] },
  { key: "yesterday",   label: "Yesterday",    range: () => [startOfDay(now - 86400000), endOfDay(now - 86400000)] },
  { key: "tomorrow",    label: "Tomorrow",     range: () => [startOfDay(now + 86400000), endOfDay(now + 86400000)] },
  { key: "this_week",   label: "This week",    range: () => [startOfWeek(now), startOfWeek(now) + 7*86400000 - 1] },
  { key: "last_week",   label: "Last week",    range: () => [startOfWeek(now) - 7*86400000, startOfWeek(now) - 1] },
  { key: "next_week",   label: "Next week",    range: () => [startOfWeek(now) + 7*86400000, startOfWeek(now) + 14*86400000 - 1] },
  { key: "this_month",  label: "This month",   range: () => [startOfMonth(now), endOfMonth(now)] },
  { key: "last_7",      label: "Last 7 days",  range: () => [startOfDay(now - 7*86400000), endOfDay(now)] },
  { key: "last_30",     label: "Last 30 days", range: () => [startOfDay(now - 30*86400000), endOfDay(now)] },
  { key: "no_date",     label: "No date",      range: () => null },
];

const DATE_OPERATORS = ["is", "before", "after"];
const PRI = { high: { color: "#d1242f", icon: "▲" }, medium: { color: "#cf8700", icon: "─" }, low: { color: "#848d97", icon: "▽" } };



function formatDueDate(ts) {
  if (ts == null) return null;
  const todayStart = startOfDay(Date.now());
  const todayEnd = endOfDay(Date.now());
  const tomorrowEnd = endOfDay(Date.now() + 86400000);
  const yesterdayStart = startOfDay(Date.now() - 86400000);
  const weekEnd = endOfDay(Date.now() + 7 * 86400000);
  
  if (ts >= todayStart && ts <= todayEnd) return { text: "Today", color: "#c25852", urgent: true };
  if (ts < todayStart && ts >= yesterdayStart) return { text: "Yesterday", color: "#c25852", urgent: true };
  if (ts < yesterdayStart) {
    const days = Math.ceil((todayStart - ts) / 86400000);
    return { text: days + "d overdue", color: "#c25852", urgent: true };
  }
  if (ts > todayEnd && ts <= tomorrowEnd) return { text: "Tomorrow", color: "#b89245", urgent: false };
  if (ts <= weekEnd) {
    const days = Math.ceil((ts - todayEnd) / 86400000);
    return { text: "in " + days + "d", color: "#6b7280", urgent: false };
  }
  const dt = new Date(ts);
  return { text: dt.toLocaleDateString("en", { month: "short", day: "numeric" }), color: "#9ca3af", urgent: false };
}

function timeAgo(ts) {
  const d = now - ts; // Using now constant for demo consistency
  if (d < 60000) return "just now";
  if (d < 3600000) return `${Math.floor(d/60000)}m ago`;
  if (d < 86400000) return `${Math.floor(d/3600000)}h ago`;
  if (d < 172800000) return "yesterday";
  return `${Math.floor(d/86400000)}d ago`;
}

// ─── SVG Icon component ────────────────────────────────
function I({ type, size = 16, color = "currentColor" }) {
  const s = { width: size, height: size, flexShrink: 0, display: "block" };
  const p = { strokeLinecap: "round", strokeLinejoin: "round" };
  switch (type) {
    case "list": return <svg style={s} viewBox="0 0 16 16" fill="none"><path d="M2 4h12M2 8h12M2 12h8" stroke={color} strokeWidth="1.5" {...p}/></svg>;
    case "sun": return <svg style={s} viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="3" stroke={color} strokeWidth="1.5"/><path d="M8 2v1.5M8 12.5V14M2 8h1.5M12.5 8H14M3.75 3.75l1.06 1.06M11.19 11.19l1.06 1.06M12.25 3.75l-1.06 1.06M4.81 11.19l-1.06 1.06" stroke={color} strokeWidth="1.5" {...p}/></svg>;
    case "folder": return <svg style={s} viewBox="0 0 16 16" fill="none"><path d="M1.5 3.5a1 1 0 011-1h3.59a1 1 0 01.7.29l1.42 1.42a1 1 0 00.7.29h4.59a1 1 0 011 1v7a1 1 0 01-1 1h-11a1 1 0 01-1-1z" stroke={color} strokeWidth="1.3"/></svg>;
    case "users": return <svg style={s} viewBox="0 0 16 16" fill="none"><circle cx="6" cy="5.5" r="2.5" stroke={color} strokeWidth="1.3"/><path d="M1.5 14c0-2.5 2-4.5 4.5-4.5s4.5 2 4.5 4.5" stroke={color} strokeWidth="1.3" {...p}/><circle cx="11.5" cy="5.5" r="1.8" stroke={color} strokeWidth="1.1"/><path d="M14.5 14c0-1.8-1.1-3.2-2.8-3.5" stroke={color} strokeWidth="1.1" {...p}/></svg>;
    case "clock": return <svg style={s} viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke={color} strokeWidth="1.3"/><path d="M8 4.5V8.5L10.5 10" stroke={color} strokeWidth="1.3" {...p}/></svg>;
    case "chart": return <svg style={s} viewBox="0 0 16 16" fill="none"><rect x="1.5" y="9" width="3" height="5" rx=".5" stroke={color} strokeWidth="1.2"/><rect x="6.5" y="5" width="3" height="9" rx=".5" stroke={color} strokeWidth="1.2"/><rect x="11.5" y="2" width="3" height="12" rx=".5" stroke={color} strokeWidth="1.2"/></svg>;
    case "file": return <svg style={s} viewBox="0 0 16 16" fill="none"><path d="M4 1.5h5.5L13 5v9a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 013 14V3a1.5 1.5 0 011-1.42z" stroke={color} strokeWidth="1.2"/><path d="M9 1.5V5.5h4" stroke={color} strokeWidth="1.2"/></svg>;
    case "people": return <svg style={s} viewBox="0 0 16 16" fill="none"><circle cx="5.5" cy="5" r="2.5" stroke={color} strokeWidth="1.2"/><circle cx="10.5" cy="5" r="2.5" stroke={color} strokeWidth="1.2"/><path d="M1 14c0-2.5 2-4.5 4.5-4.5.8 0 1.6.2 2.2.6M15 14c0-2.5-2-4.5-4.5-4.5-.8 0-1.6.2-2.2.6" stroke={color} strokeWidth="1.2" {...p}/></svg>;
    case "gear": return <svg style={s} viewBox="0 0 16 16" fill="none"><path d="M6.86 1.5h2.28l.35 1.76a5.5 5.5 0 011.32.77l1.7-.57.98 1.7-1.35 1.18c.06.3.1.6.1.91s-.04.62-.1.91l1.35 1.18-.98 1.7-1.7-.57c-.4.32-.84.58-1.32.77l-.35 1.76H6.86l-.35-1.76a5.5 5.5 0 01-1.32-.77l-1.7.57-.98-1.7 1.35-1.18A5.5 5.5 0 013.76 8c0-.31.04-.62.1-.91L2.51 5.91l.98-1.7 1.7.57c.4-.32.84-.58 1.32-.77z" stroke={color} strokeWidth="1.1"/><circle cx="8" cy="8" r="2" stroke={color} strokeWidth="1.2"/></svg>;
    case "plus": return <svg style={s} viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke={color} strokeWidth="1.8" {...p}/></svg>;
    case "search": return <svg style={s} viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="4.5" stroke={color} strokeWidth="1.5"/><path d="M10.5 10.5L14 14" stroke={color} strokeWidth="1.5" {...p}/></svg>;
    case "x": return <svg style={s} viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke={color} strokeWidth="1.5" {...p}/></svg>;
    case "chevron": return <svg style={s} viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke={color} strokeWidth="1.5" {...p}/></svg>;
    case "comment": return <svg style={s} viewBox="0 0 16 16" fill="none"><path d="M2 2.5h12a1 1 0 011 1v7a1 1 0 01-1 1H5l-3 3v-3a1 1 0 01-1-1v-7a1 1 0 011-1z" stroke={color} strokeWidth="1.3"/></svg>;
    case "desc": return <svg style={s} viewBox="0 0 16 16" fill="none"><path d="M3 4h10M3 7h10M3 10h7M3 13h4" stroke={color} strokeWidth="1.4" strokeLinecap="round"/></svg>;
    case "activity": return <svg style={s} viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke={color} strokeWidth="1.3"/><path d="M8 4.5V8.5L10.5 10" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/><circle cx="8" cy="8" r="1" fill={color}/></svg>;
    case "play": return <svg style={s} viewBox="0 0 16 16" fill="none"><path d="M5 3.5v9l7-4.5z" fill={color}/></svg>;
    case "pause": return <svg style={s} viewBox="0 0 16 16" fill="none"><rect x="4" y="3" width="3" height="10" rx=".5" fill={color}/><rect x="9" y="3" width="3" height="10" rx=".5" fill={color}/></svg>;
    case "stop": return <svg style={s} viewBox="0 0 16 16" fill="none"><rect x="3.5" y="3.5" width="9" height="9" rx="1" fill={color}/></svg>;
    case "calendar": return <svg style={s} viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="11" rx="1.5" stroke={color} strokeWidth="1.3"/><path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" stroke={color} strokeWidth="1.3" {...p}/></svg>;
    case "filter": return <svg style={s} viewBox="0 0 16 16" fill="none"><path d="M2 3h12L9.5 8.5V12l-3 1.5V8.5z" stroke={color} strokeWidth="1.3" {...p}/></svg>;
    default: return null;
  }
}

function StatusIcon({ status, size = 18 }) {
  if (status === "done") {
    return <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="9" fill="#5a9e6f"/>
      <path d="M6 10.5L8.8 13.2L14 7.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>;
  }
  if (status === "review") {
    return <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="8" stroke="#9b8ab5" strokeWidth="1.8"/>
      <path d="M6.5 10.5L8.8 12.8L13.5 7.5" stroke="#9b8ab5" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>;
  }
  if (status === "today") {
    return <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="8" stroke="#c25852" strokeWidth="1.5" strokeDasharray="3.5 3"/>
      <circle cx="10" cy="10" r="4.5" fill="#c25852"/>
    </svg>;
  }
  if (status === "next") {
    return <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="8" stroke="#7a9ab8" strokeWidth="1.5" strokeDasharray="3.5 3"/>
      <path d="M10 5.5A4.5 4.5 0 0 1 10 14.5Z" fill="#7a9ab8"/>
    </svg>;
  }
  return <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
    <circle cx="10" cy="10" r="8" stroke="#c2c7ce" strokeWidth="1.5" strokeDasharray="3.5 3"/>
  </svg>;
}

function Avatar({ name, size = 18 }) {
  if (!name) return null;
  const hu = (name.charCodeAt(0)*47+(name.charCodeAt(1)||0)*31)%360;
  return <span style={{width:size,height:size,borderRadius:"50%",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:size*.48,fontWeight:600,background:`hsl(${hu},45%,86%)`,color:`hsl(${hu},40%,35%)`,flexShrink:0}}>{name[0]}</span>;
}

function CatDot({ c }) { return <span style={{width:7,height:7,borderRadius:"50%",background:CAT_COLOR[c]||"#848d97",flexShrink:0,display:"inline-block"}}/>; }

// ─── Timer Pill ────────────────────────────────────────
function TimerPill({ taskId, trackedMinutes, isRunning, elapsedSec, onToggle, isDone }) {
  const [hovered, setHovered] = useState(false);
  const totalSec = trackedMinutes * 60 + (isRunning ? elapsedSec : 0);
  const hasTime = trackedMinutes > 0 || isRunning;

  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const display = isRunning
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${h}:${String(m).padStart(2, "0")}`;

  return (
    <button
      onClick={e => { e.stopPropagation(); if (!isDone) onToggle(taskId); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "3px 8px 3px 6px",
        borderRadius: 8, border: "1px solid",
        borderColor: isRunning ? "#c25852" : isDone ? "#e5e7eb" : hovered ? "#b0b5bd" : "#e0e2e5",
        background: isRunning ? "#fdf5f4" : isDone ? "#f9fafb" : hovered ? "#f6f7f8" : "#fff",
        color: isRunning ? "#c25852" : isDone ? "#b0b5bd" : hasTime ? "#374151" : "#c2c7ce",
        fontSize: 12.5, fontWeight: isRunning ? 650 : hasTime ? 550 : 450,
        fontVariantNumeric: "tabular-nums", fontFamily: "inherit",
        cursor: isDone ? "default" : "pointer",
        transition: "all 0.15s", whiteSpace: "nowrap",
        animation: isRunning ? "timerPulse 2s ease-in-out infinite" : "none",
      }}
    >
      {!isDone && (
        <span style={{ display: "flex", width: 12, height: 12 }}>
          {isRunning
            ? <I type="pause" size={12} color="#c25852"/>
            : <I type="play" size={12} color={hovered ? "#374151" : hasTime ? "#6b7280" : "#c2c7ce"}/>
          }
        </span>
      )}
      {isDone && <I type="clock" size={11} color="#b0b5bd"/>}
      <span>{display}</span>
    </button>
  );
}

// ─── HoverIcon with popup ──────────────────────────────
function HoverIcon({ type, task, isDone }) {
  const [show, setShow] = useState(false);
  const [rect, setRect] = useState(null);
  const ref = useRef(null);
  const timeout = useRef(null);

  const hasContent = type === "description" ? !!task.notes
    : type === "comments" ? task.comments.length > 0
    : (task.activityLog && task.activityLog.length > 0);

  const hasUnread = task.lastEdited > task.lastViewed;
  const newComments = type === "comments" ? task.comments.filter(c => c.time > task.lastViewed).length : 0;
  const newActivity = type === "activity" && task.activityLog ? task.activityLog.filter(a => a.time > task.lastViewed).length : 0;
  const hasNew = type === "comments" ? newComments > 0 : type === "activity" ? newActivity > 0 : false;

  const handleEnter = () => {
    timeout.current = setTimeout(() => {
      if (ref.current) {
        setRect(ref.current.getBoundingClientRect());
        setShow(true);
      }
    }, 300);
  };
  const handleLeave = () => { clearTimeout(timeout.current); setShow(false); };

  const iconType = type === "description" ? "desc" : type === "comments" ? "comment" : "activity";
  const count = type === "comments" ? task.comments.length : type === "activity" ? (task.activityLog?.length || 0) : 0;

  return (
    <span ref={ref} style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
      onMouseEnter={handleEnter} onMouseLeave={handleLeave}
    >
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 3,
        padding: "1px 2px", borderRadius: 4, cursor: "default",
        color: !hasContent ? "#d1d5db" : hasNew ? "#374151" : "#9ca3af",
        fontSize: 11.5, fontWeight: hasNew ? 600 : 450,
        fontVariantNumeric: "tabular-nums",
        transition: "all 0.12s",
        background: show && hasContent ? "#f3f4f6" : "transparent",
        lineHeight: "16px",
      }}>
        {hasNew && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#e8385d", flexShrink: 0 }}/>}
        <I type={iconType} size={12} color={!hasContent ? "#d1d5db" : hasNew ? "#374151" : "#b0b5bd"}/>
        {count > 0 && <span style={{ fontSize: 11, fontWeight: 600 }}>{count}</span>}
      </span>

      {/* Popup */}
      {show && hasContent && rect && (
        <div style={{
          position: "fixed",
          top: rect.bottom + 6,
          left: Math.min(rect.left, window.innerWidth - 320),
          zIndex: 500, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10,
          boxShadow: "0 8px 30px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.04)",
          width: 300, maxHeight: 280, overflow: "hidden",
          animation: "popIn 0.12s ease",
        }} onClick={e => e.stopPropagation()}>

          {/* Description popup */}
          {type === "description" && (
            <div style={{ padding: "12px 14px" }}>
              <div style={{ fontSize: 10.5, fontWeight: 650, color: "#9ca3af", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 6 }}>Description</div>
              <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.55, margin: 0, whiteSpace: "pre-wrap" }}>{task.notes}</p>
            </div>
          )}

          {/* Comments popup */}
          {type === "comments" && (
            <div style={{ padding: "12px 14px", overflowY: "auto", maxHeight: 270 }}>
              <div style={{ fontSize: 10.5, fontWeight: 650, color: "#9ca3af", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 8 }}>
                Comments ({task.comments.length})
              </div>
              {task.comments.map((c, i) => {
                const isNew = c.time > task.lastViewed;
                return (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: i < task.comments.length - 1 ? 10 : 0, alignItems: "flex-start" }}>
                    <Avatar name={c.user} size={22}/>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}>{c.user}</span>
                        <span style={{ fontSize: 11, color: "#9ca3af" }}>{timeAgo(c.time)}</span>
                        {isNew && <span style={{ fontSize: 9.5, fontWeight: 650, color: "#e8385d", textTransform: "uppercase", letterSpacing: "0.03em" }}>new</span>}
                      </div>
                      <p style={{ fontSize: 12.5, color: "#4b5563", lineHeight: 1.45, margin: "2px 0 0" }}>{c.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Activity popup */}
          {type === "activity" && task.activityLog && (
            <div style={{ padding: "12px 14px" }}>
              <div style={{ fontSize: 10.5, fontWeight: 650, color: "#9ca3af", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 8 }}>
                Recent Activity
              </div>
              {task.activityLog.slice(0, 5).map((a, i) => {
                const isNew = a.time > task.lastViewed;
                return (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "6px 0",
                    borderBottom: i < Math.min(task.activityLog.length, 5) - 1 ? "1px solid #f5f5f5" : "none",
                  }}>
                    <Avatar name={a.user} size={20}/>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 12, color: "#111827" }}>
                        <span style={{ fontWeight: 600 }}>{a.user}</span>
                        {" "}<span style={{ color: "#6b7280" }}>{a.action}</span>
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                      {isNew && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#e8385d" }}/>}
                      <span style={{ fontSize: 11, color: "#b0b5bd", whiteSpace: "nowrap" }}>{timeAgo(a.time)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </span>
  );
}

// ─── Activity text with hover popup ────────────────────
function ActivityHover({ task }) {
  const [show, setShow] = useState(false);
  const [rect, setRect] = useState(null);
  const ref = useRef(null);
  const timeout = useRef(null);

  const handleEnter = () => {
    timeout.current = setTimeout(() => {
      if (ref.current) { setRect(ref.current.getBoundingClientRect()); setShow(true); }
    }, 300);
  };
  const handleLeave = () => { clearTimeout(timeout.current); setShow(false); };

  const hasNew = task.activityLog ? task.activityLog.some(a => a.time > task.lastViewed) : false;

  return (
    <span ref={ref} style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
      onMouseEnter={handleEnter} onMouseLeave={handleLeave}
    >
      <span style={{
        fontSize: 11.5, color: hasNew ? "#6b7280" : "#b0b5bd", fontStyle: "italic",
        cursor: "default", transition: "color 0.12s",
        borderBottom: show ? "1px dotted #d1d5db" : "1px dotted transparent",
      }}>
        {task.lastActivity.user} {task.lastActivity.action} {timeAgo(task.lastActivity.time)}
      </span>

      {show && task.activityLog && task.activityLog.length > 0 && rect && (
        <div style={{
          position: "fixed", top: rect.bottom + 6,
          left: Math.min(rect.left, window.innerWidth - 310),
          zIndex: 500, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10,
          boxShadow: "0 8px 30px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.04)",
          width: 290, maxHeight: 260, overflow: "hidden",
          animation: "popIn 0.12s ease",
        }} onClick={e => e.stopPropagation()}>
          <div style={{ padding: "12px 14px" }}>
            <div style={{ fontSize: 10.5, fontWeight: 650, color: "#9ca3af", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 8 }}>
              Recent Activity
            </div>
            {task.activityLog.slice(0, 5).map((a, i) => {
              const isNew = a.time > task.lastViewed;
              return (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "6px 0",
                  borderBottom: i < Math.min(task.activityLog.length, 5) - 1 ? "1px solid #f5f5f5" : "none",
                }}>
                  <Avatar name={a.user} size={20}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 12, color: "#111827" }}>
                      <span style={{ fontWeight: 600 }}>{a.user}</span>
                      {" "}<span style={{ color: "#6b7280" }}>{a.action}</span>
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                    {isNew && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#e8385d" }}/>}
                    <span style={{ fontSize: 11, color: "#b0b5bd", whiteSpace: "nowrap" }}>{timeAgo(a.time)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </span>
  );
}

// ─── Task Row ──────────────────────────────────────────
function TaskRow({ task, isActive, onSelect, onStatusChange, runningTimerId, timerElapsed, onTimerToggle, isSelected, onToggleSelect }) {
  const [hovered, setHovered] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const menuRef = useRef(null);
  const isDone = task.status === "done";
  const isTimerRunning = runningTimerId === task.id;
  const hasUnread = task.lastEdited > task.lastViewed;
  const commentCount = task.comments.length;
  const snippet = task.notes ? (task.notes.length > 60 ? task.notes.slice(0, 60) + "…" : task.notes) : "";

  useEffect(() => {
    if (!statusOpen) return;
    const fn = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setStatusOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [statusOpen]);

  return (
    <div
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => { setHovered(false); setStatusOpen(false); }}
      onClick={() => onSelect(task.id)}
      style={{
        display: "flex", alignItems: "center", gap: 0,
        padding: 0, borderBottom: "1px solid #f3f4f6",
        background: isSelected ? "#f3f4f6" : isActive ? "#f8f9fb" : isTimerRunning ? "#fffbeb08" : task.status === "today" ? (hovered ? "#f7f2f1" : "#fbf7f6") : hovered ? "#f8f9fb" : "#fff",
        cursor: "pointer", transition: "all 0.08s",
        opacity: isDone ? 0.45 : 1, position: "relative",
      }}
    >
      {/* Left zone: checkbox + status */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "0 4px 0 10px", flexShrink: 0 }}>
        {/* Checkbox */}
        <div onClick={e => { e.stopPropagation(); onToggleSelect(task.id); }}
          style={{
            width: 16, height: 16, borderRadius: 3, flexShrink: 0,
            border: isSelected ? "none" : "1.5px solid #d1d5db",
            background: isSelected ? "#111827" : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", transition: "all 0.1s",
          }}>
          {isSelected && <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M4 8.5L7 11.5L12 5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        </div>

        {/* Status icon */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div onClick={e => { e.stopPropagation(); setStatusOpen(!statusOpen); }}
            style={{ cursor: "pointer", padding: 2, borderRadius: 4 }}>
            <StatusIcon status={task.status} size={18}/>
          </div>
          {statusOpen && (
            <div ref={menuRef} style={{ position: "absolute", top: 28, left: -4, zIndex: 200, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", padding: 4, width: 146, animation: "popIn 0.12s ease" }}>
              {STATUS_ORDER.map(key => {
                const cfg = STATUS_CONFIG[key]; const isCur = task.status === key;
                return <div key={key} onClick={e => { e.stopPropagation(); onStatusChange(task.id, key); setStatusOpen(false); }}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 6, cursor: "pointer", fontSize: 12.5, fontWeight: 500, color: isCur ? cfg.color : "#374151", background: isCur ? cfg.bg : "transparent" }}
                  onMouseEnter={e => { if (!isCur) e.currentTarget.style.background = "#f6f8fa"; }}
                  onMouseLeave={e => { if (!isCur) e.currentTarget.style.background = isCur ? cfg.bg : "transparent"; }}
                ><StatusIcon status={key} size={14}/>{cfg.label}</div>;
              })}
            </div>
          )}
        </div>
      </div>

      {/* Middle: content */}
      <div style={{ flex: 1, minWidth: 0, padding: "10px 8px" }}>
        {/* Single line: title + snippet */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, minWidth: 0 }}>
          <span style={{
            fontSize: 13.5, fontWeight: isDone ? 400 : hasUnread ? 650 : 500, color: isDone ? "#9ca3af" : "#111827",
            textDecoration: isDone ? "line-through" : "none", lineHeight: 1.35,
            letterSpacing: "-0.01em", flexShrink: 0, maxWidth: "50%",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{task.title}</span>
          {/* Hover icons inline */}
          <span style={{ display: "inline-flex", gap: 2, flexShrink: 0 }}>
            <HoverIcon type="description" task={task} isDone={isDone}/>
            <HoverIcon type="comments" task={task} isDone={isDone}/>
          </span>
          {/* Description snippet — Gmail style preview */}
          {snippet && <span style={{
            fontSize: 12.5, color: "#9ca3af", fontWeight: 400,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            minWidth: 0, flex: 1,
          }}> — {snippet}</span>}
        </div>

        {/* Meta line with label chip */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4, fontSize: 12, color: "#9ca3af", lineHeight: 1.3 }}>
          <span style={{ color: "#6b7280", fontWeight: 480 }}>{task.client}</span>
          <span style={{ color: "#d1d5db" }}>›</span>
          <span>{task.project}</span>
          <span style={{ color: "#d1d5db" }}>·</span>
          <span style={{ color: "#9ca3af", fontWeight: 450, fontSize: 11.5 }}>{task.category}</span>
          {task.assignee ? <>
            <span style={{ color: "#d1d5db" }}>·</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><Avatar name={task.assignee} size={14}/><span style={{ color: "#6b7280" }}>{task.assignee}</span></span>
          </> : <>
            <span style={{ color: "#d1d5db" }}>·</span>
            <span style={{ color: "#d97706", fontStyle: "italic", fontSize: 11.5 }}>Unassigned</span>
          </>}
          {task.lastActivity && <>
            <span style={{ color: "#e5e7eb", margin: "0 1px" }}>—</span>
            <ActivityHover task={task}/>
          </>}
        </div>
      </div>

      {/* Right zone: due date + timer */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, padding: "8px 14px 8px 8px" }}>
        {/* Due date - only if set */}
        {task.dueDate != null && !isDone && (() => {
          const due = formatDueDate(task.dueDate);
          if (!due) return null;
          return <span style={{
            display: "inline-flex", alignItems: "center", gap: 3,
            fontSize: 11, fontWeight: due.urgent ? 550 : 450, color: due.color,
            whiteSpace: "nowrap",
          }}>
            <I type="calendar" size={11} color={due.color}/>
            {due.text}
          </span>;
        })()}
        <TimerPill
          taskId={task.id} trackedMinutes={task.trackedMinutes}
          isRunning={isTimerRunning} elapsedSec={isTimerRunning ? timerElapsed : 0}
          onToggle={onTimerToggle} isDone={isDone}
        />
      </div>
    </div>
  );
}

// ─── Detail Panel ──────────────────────────────────────
function DetailPanel({ task, onClose, onStatusChange, runningTimerId, timerElapsed, onTimerToggle }) {
  if (!task) return null;
  const cfg = STATUS_CONFIG[task.status];
  const isTimerRunning = runningTimerId === task.id;

  const Field = ({ label, children }) => (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "9px 0", borderBottom: "1px solid #f8f8f8" }}>
      <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 500, width: 76, flexShrink: 0, paddingTop: 2 }}>{label}</span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );

  return (
    <div style={{ width: 340, flexShrink: 0, background: "#fff", borderLeft: "1px solid #e5e7eb", display: "flex", flexDirection: "column", animation: "slideIn 0.18s ease", overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #f0f0f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, fontWeight: 650, color: "#9ca3af", letterSpacing: "0.05em", textTransform: "uppercase" }}>Details</span>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, color: "#9ca3af", display: "flex" }}
          onMouseEnter={e => e.currentTarget.style.background = "#f3f4f6"}
          onMouseLeave={e => e.currentTarget.style.background = "none"}
        ><I type="x" size={14}/></button>
      </div>

      <div style={{ padding: 16, flex: 1, overflowY: "auto" }}>
        <h3 style={{ fontSize: 15.5, fontWeight: 650, color: "#111827", margin: "0 0 4px", lineHeight: 1.4, letterSpacing: "-0.015em" }}>{task.title}</h3>
        <span style={{ fontSize: 11.5, color: "#9ca3af" }}>Last edited {timeAgo(task.lastEdited)}</span>

        <div style={{ marginTop: 14 }}>
          <Field label="Status">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 550, color: cfg.color, background: cfg.bg, borderRadius: 6, padding: "3px 10px" }}>
              <StatusIcon status={task.status} size={13}/>{cfg.label}
            </span>
          </Field>
          <Field label="Priority">
            <span style={{ fontSize: 12.5, fontWeight: 550, color: PRI[task.priority].color, display: "inline-flex", alignItems: "center", gap: 4 }}>
              {PRI[task.priority].icon} {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
            </span>
          </Field>
          <Field label="Time">
            <TimerPill taskId={task.id} trackedMinutes={task.trackedMinutes}
              isRunning={isTimerRunning} elapsedSec={isTimerRunning ? timerElapsed : 0}
              onToggle={onTimerToggle} isDone={task.status === "done"}
            />
          </Field>
          <Field label="Client"><span style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>{task.client}</span></Field>
          <Field label="Project"><span style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>{task.project}</span></Field>
          <Field label="Category"><span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 500, color: "#374151" }}><CatDot c={task.category}/>{task.category}</span></Field>
          <Field label="Due date">{(() => {
            const due = formatDueDate(task.dueDate);
            if (!due) return <span style={{ fontSize: 13, color: "#c2c7ce", fontStyle: "italic" }}>No due date</span>;
            return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, fontWeight: 500, color: due.color }}>
              <I type="calendar" size={13} color={due.color}/>{due.text}
            </span>;
          })()}</Field>
          <Field label="Assignee">
            {task.assignee ? <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#374151", fontWeight: 500 }}><Avatar name={task.assignee} size={20}/>{task.assignee}</span>
            : <span style={{ fontSize: 13, color: "#d97706", fontStyle: "italic" }}>Unassigned</span>}
          </Field>
        </div>

        {task.notes && (
          <div style={{ marginTop: 14 }}>
            <span style={{ fontSize: 11, fontWeight: 650, color: "#b0b5bd", letterSpacing: "0.04em", textTransform: "uppercase" }}>Description</span>
            <p style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.55, marginTop: 6, background: "#f9fafb", borderRadius: 8, padding: "10px 12px", border: "1px solid #f0f0f0" }}>{task.notes}</p>
          </div>
        )}

        {/* Comments */}
        {task.comments.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <span style={{ fontSize: 11, fontWeight: 650, color: "#b0b5bd", letterSpacing: "0.04em", textTransform: "uppercase" }}>
              Activity ({task.comments.length})
            </span>
            <div style={{ marginTop: 8 }}>
              {task.comments.map((c, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "flex-start" }}>
                  <Avatar name={c.user} size={22}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}>{c.user}</span>
                      <span style={{ fontSize: 11, color: "#9ca3af" }}>{timeAgo(c.time)}</span>
                    </div>
                    <p style={{ fontSize: 12.5, color: "#4b5563", lineHeight: 1.45, margin: "2px 0 0" }}>{c.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginTop: 18 }}>
          <span style={{ fontSize: 11, fontWeight: 650, color: "#b0b5bd", letterSpacing: "0.04em", textTransform: "uppercase" }}>Move to</span>
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            {STATUS_ORDER.filter(s => s !== task.status).map(key => {
              const c = STATUS_CONFIG[key];
              return <button key={key} onClick={() => onStatusChange(task.id, key)} style={{
                display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff", fontSize: 12, fontWeight: 500, color: "#374151", cursor: "pointer", fontFamily: "inherit", transition: "all 0.1s",
              }} onMouseEnter={e => { e.currentTarget.style.background = c.bg; e.currentTarget.style.borderColor = c.color+"40"; e.currentTarget.style.color = c.color; }}
                 onMouseLeave={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.color = "#374151"; }}
              ><StatusIcon status={key} size={12}/> {c.label}</button>;
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Inline Add Task ───────────────────────────────────
function InlineAddTask({ onAdd, groupContext, placeholder, clients, groupBy }) {
  const [title, setTitle] = useState("");
  const [client, setClient] = useState("—");
  const [category, setCategory] = useState("Development");
  const [status, setStatus] = useState("inbox");
  const cats = ["Development", "Design", "Copywriting", "Meeting"];

  const submit = () => {
    if (!title.trim()) return;
    onAdd(title, groupContext, { client, category, status });
    setTitle(""); setClient("—"); setCategory("Development"); setStatus("inbox");
  };

  const selectStyle = {
    border: "none", outline: "none", background: "transparent",
    fontSize: 11.5, color: "#6b7280", fontFamily: "inherit",
    cursor: "pointer", padding: "2px 0",
  };

  return (
    <div style={{ borderBottom: "1px solid #f0f0f0", background: "#fff" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 16px" }}>
        <div style={{ width: 18, height: 18, borderRadius: "50%", border: "1.5px dashed #d1d5db", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><I type="plus" size={9} color="#9ca3af"/></div>
        <input value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => { if (e.key === "Enter") submit(); }}
          placeholder={placeholder || "Add a new task…"}
          style={{ border: "none", outline: "none", flex: 1, padding: "4px 0", fontSize: 13, fontFamily: "inherit", background: "transparent", color: "#111827" }}
        />
        {title && <button onClick={submit} style={{ padding: "3px 12px", borderRadius: 6, border: "none", background: "#111827", color: "#fff", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Add</button>}
      </div>
      {title && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 16px 7px 42px", fontSize: 11.5, color: "#9ca3af" }}>
          {groupBy !== "client" && (
            <select value={client} onChange={e => setClient(e.target.value)} style={selectStyle}>
              <option value="—">Client…</option>
              {clients.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          {groupBy !== "category" && (
            <select value={category} onChange={e => setCategory(e.target.value)} style={selectStyle}>
              {cats.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          {groupBy !== "status" && (
            <select value={status} onChange={e => setStatus(e.target.value)} style={selectStyle}>
              {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
            </select>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────
export default function AgencyFlow() {
  const [tasks, setTasks] = useState(INITIAL_TASKS);
  const [activeFilter, setActiveFilter] = useState("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [groupBy, setGroupBy] = useState("none");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [filters, setFilters] = useState([]);
  const [filterMode, setFilterMode] = useState("all"); // "all" or "any"
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [filterEditId, setFilterEditId] = useState(null);
  const filterMenuRef = useRef(null);
  const [runningTimerId, setRunningTimerId] = useState(null);
  const [timerElapsed, setTimerElapsed] = useState(0);
  const timerRef = useRef(null);
  const searchRef = useRef(null);

  // Timer tick
  useEffect(() => {
    if (runningTimerId) {
      timerRef.current = setInterval(() => setTimerElapsed(e => e + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [runningTimerId]);

  const handleTimerToggle = useCallback((taskId) => {
    if (runningTimerId === taskId) {
      const nowTs = Date.now();
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, trackedMinutes: t.trackedMinutes + Math.floor(timerElapsed / 60), lastTimeEntry: nowTs } : t));
      setRunningTimerId(null);
      setTimerElapsed(0);
    } else {
      if (runningTimerId) {
        const nowTs = Date.now();
        setTasks(prev => prev.map(t => t.id === runningTimerId ? { ...t, trackedMinutes: t.trackedMinutes + Math.floor(timerElapsed / 60), lastTimeEntry: nowTs } : t));
      }
      setRunningTimerId(taskId);
      setTimerElapsed(0);
    }
  }, [runningTimerId, timerElapsed]);

  useEffect(() => {
    const fn = e => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "Escape") { setSelectedTaskId(null); searchRef.current?.blur(); }
    };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, []);

  const handleStatusChange = (id, s) => setTasks(prev => prev.map(t => t.id === id ? { ...t, status: s, lastEdited: Date.now(), lastActivity: { user: "Adam", action: s === "done" ? "marked as done" : `moved to ${STATUS_CONFIG[s].label}`, time: Date.now() } } : t));
  const handleSelect = (id) => {
    setSelectedTaskId(id);
    setTasks(prev => prev.map(t => t.id === id ? { ...t, lastViewed: Date.now() } : t));
  };
  const handleToggleSelect = (id) => {
    setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };
  const handleBulkStatus = (status) => {
    selectedIds.forEach(id => handleStatusChange(id, status));
    setSelectedIds(new Set());
  };

  const handleAddTask = (title, groupContext, fields = {}) => {
    if (!title.trim()) return;
    const base = { id: Date.now(), title: title.trim(), project: "—", client: fields.client || "—", assignee: "Adam", status: fields.status || "inbox", category: fields.category || "Development", trackedMinutes: 0, priority: "medium", notes: "", dueDate: null, createdAt: Date.now(), comments: [], lastEdited: Date.now(), lastViewed: Date.now(), lastTimeEntry: null, lastActivity: { user: "Adam", action: "created task", time: Date.now() }, activityLog: [{ user: "Adam", action: "created task", time: Date.now() }] };
    if (groupContext) {
      if (groupBy === "client") base.client = groupContext;
      else if (groupBy === "status") base.status = groupContext;
      else if (groupBy === "category") base.category = groupContext;
    }
    setTasks(prev => [...prev, base]);
  };

  // ─── Filter system ─────────────────────────────────────
  const allClients = [...new Set(tasks.map(t => t.client).filter(c => c !== "—"))];
  const allAssignees = [...new Set(tasks.map(t => t.assignee).filter(Boolean))];
  const allCategories = [...new Set(tasks.map(t => t.category))];
  const FILTER_DEFS = {
    status:    { label: "Status",    type: "select", values: STATUS_ORDER.map(s => ({ key: s, label: STATUS_CONFIG[s].label })) },
    assignee:  { label: "Assignee",  type: "select", values: allAssignees.map(a => ({ key: a, label: a })) },
    client:    { label: "Client",    type: "select", values: allClients.map(c => ({ key: c, label: c })) },
    category:  { label: "Category",  type: "select", values: allCategories.map(c => ({ key: c, label: c })) },
    dueDate:   { label: "Due date",  type: "date",   values: DATE_PRESETS },
    createdAt: { label: "Created",   type: "date",   values: DATE_PRESETS },
    lastEdited:{ label: "Updated",   type: "date",   values: DATE_PRESETS },
  };
  const addFilter = (property) => {
    const id = Date.now();
    const def = FILTER_DEFS[property];
    const isDate = def?.type === "date";
    setFilters(prev => [...prev, { id, property, operator: isDate ? "is" : "is", values: [] }]);
    setFilterEditId(id);
  };
  const updateFilter = (id, updates) => setFilters(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  const removeFilter = (id) => { setFilters(prev => { const next = prev.filter(f => f.id !== id); if (next.length === 0) setFilterMenuOpen(false); return next; }); setFilterEditId(null); };
  const clearFilters = () => { setFilters([]); setFilterEditId(null); setFilterMenuOpen(false); };
  const toggleFilterValue = (id, val) => {
    setFilters(prev => prev.map(f => {
      if (f.id !== id) return f;
      const def = FILTER_DEFS[f.property];
      if (def?.type === "date") {
        // Single-select for dates: toggle off if same, otherwise set
        return { ...f, values: f.values[0] === val ? [] : [val] };
      }
      const values = f.values.includes(val) ? f.values.filter(v => v !== val) : [...f.values, val];
      return { ...f, values };
    }));
  };

  // Close filter menus on outside click
  useEffect(() => {
    if (!filterMenuOpen && !filterEditId) return;
    const fn = e => { if (filterMenuRef.current && !filterMenuRef.current.contains(e.target)) { setFilterEditId(null); if (filters.length === 0) setFilterMenuOpen(false); } };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [filterMenuOpen, filterEditId, filters.length]);

  let filtered = tasks;
  if (activeFilter === "active") filtered = filtered.filter(t => t.status !== "done");
  else if (activeFilter !== "all") filtered = filtered.filter(t => t.status === activeFilter);
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(t => t.title.toLowerCase().includes(q) || t.client.toLowerCase().includes(q) || t.project.toLowerCase().includes(q) || t.category.toLowerCase().includes(q));
  }

  // Apply combined filters
  const activeFilters = filters.filter(f => f.values.length > 0);
  if (activeFilters.length > 0) {
    filtered = filtered.filter(task => {
      const results = activeFilters.map(f => {
        const def = FILTER_DEFS[f.property];
        if (def?.type === "date") {
          const preset = DATE_PRESETS.find(p => p.key === f.values[0]);
          if (!preset) return true;
          const taskDate = task[f.property];
          // "No date" special case
          if (preset.key === "no_date") return taskDate == null;
          if (taskDate == null) return false;
          const range = preset.range();
          if (f.operator === "is") return taskDate >= range[0] && taskDate <= range[1];
          if (f.operator === "before") return taskDate < range[0];
          if (f.operator === "after") return taskDate > range[1];
          return true;
        }
        const taskVal = f.property === "status" ? task.status : task[f.property];
        const match = f.values.includes(taskVal);
        return f.operator === "is" ? match : !match;
      });
      return filterMode === "all" ? results.every(Boolean) : results.some(Boolean);
    });
  }

  const pw = { high: 0, medium: 1, low: 2 };
  filtered = [...filtered].sort((a, b) => {
    const sa = STATUS_CONFIG[a.status]?.sortOrder ?? 5;
    const sb = STATUS_CONFIG[b.status]?.sortOrder ?? 5;
    return sa !== sb ? sa - sb : (pw[a.priority] ?? 1) - (pw[b.priority] ?? 1);
  });

  let grouped;
  if (groupBy === "none") grouped = [{ key: "", tasks: filtered }];
  else if (groupBy === "status") {
    const map = {}; filtered.forEach(t => { const k = t.status; const label = STATUS_CONFIG[k].label; (map[k] = map[k] || { label, tasks: [] }).tasks.push(t); });
    grouped = Object.entries(map).map(([k, v]) => ({ key: v.label, rawKey: k, tasks: v.tasks }));
  } else {
    const fn = groupBy === "client" ? t => t.client : t => t.category;
    const map = {}; filtered.forEach(t => { const k = fn(t); (map[k] = map[k] || []).push(t); });
    grouped = Object.entries(map).map(([k, v]) => ({ key: k, tasks: v }));
  }

  const selectedTask = tasks.find(t => t.id === selectedTaskId);
  const statusCounts = {}; tasks.forEach(t => statusCounts[t.status] = (statusCounts[t.status] || 0) + 1);

  return (
    <div style={{ fontFamily: "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',sans-serif", display: "flex", height: "100vh", background: "#f9fafb", color: "#111827", fontSize: 14, overflow: "hidden" }}>
      <style>{`
        @keyframes filterSlideIn { from { opacity:0; max-height:0; padding-top:0; padding-bottom:0; } to { opacity:1; max-height:50px; } }
        @keyframes popIn { from { opacity:0; transform: scale(0.95) translateY(-4px); } to { opacity:1; transform: none; } }
        @keyframes slideIn { from { opacity:0; transform: translateX(12px); } to { opacity:1; transform: none; } }
        @keyframes timerPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(194,88,82,0); } 50% { box-shadow: 0 0 0 3px rgba(194,88,82,0.08); } }
        @keyframes unreadPulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
        input::placeholder { color: #9ca3af; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }
        * { box-sizing: border-box; }
      `}</style>


      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
        {/* Header row: title + search */}
        <div style={{ padding: "16px 20px 12px", background: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h1 style={{ fontSize: 19, fontWeight: 700, color: "#111827", margin: 0, letterSpacing: "-0.025em" }}>
            All Tasks
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Running timer indicator */}
            {runningTimerId && (
              <div style={{
                display: "flex", alignItems: "center", gap: 6, padding: "4px 12px",
                background: "#fdf5f4", borderRadius: 8, border: "1px solid #e8c8c5",
                fontSize: 12, fontWeight: 600, color: "#c25852",
                animation: "timerPulse 2s ease-in-out infinite",
              }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#c25852", animation: "unreadPulse 1s ease infinite" }}/>
                {Math.floor(timerElapsed/3600)}:{String(Math.floor((timerElapsed%3600)/60)).padStart(2,"0")}:{String(timerElapsed%60).padStart(2,"0")}
              </div>
            )}
            {/* Search */}
            <div style={{
              display: "flex", alignItems: "center",
              background: searchFocused ? "#fff" : "#f3f4f6", border: "1px solid",
              borderColor: searchFocused ? "#6366f1" : "transparent",
              borderRadius: 7, padding: "0 8px", gap: 5, transition: "all 0.15s",
              boxShadow: searchFocused ? "0 0 0 3px rgba(99,102,241,0.08)" : "none",
              minWidth: 160, maxWidth: 220,
            }}>
              <I type="search" size={13} color="#9ca3af"/>
              <input ref={searchRef} value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)}
                placeholder="Search…"
                style={{ border: "none", outline: "none", flex: 1, padding: "5px 0", fontSize: 12.5, fontFamily: "inherit", background: "transparent", color: "#111827", width: 100 }}
              />
              {!searchFocused && !searchQuery && <span style={{ fontSize: 10, color: "#b0b5bd", background: "#e5e7eb", borderRadius: 3, padding: "0px 4px", fontWeight: 600, fontFamily: "monospace", lineHeight: "15px" }}>⌘K</span>}
              {searchQuery && <button onClick={() => setSearchQuery("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "#9ca3af", display: "flex" }}><I type="x" size={11}/></button>}
            </div>
          </div>
        </div>

        {/* Tabs row: filters + grouping */}
        <div style={{ padding: "8px 20px 0", background: "#fff", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 0 }}>
            {[
              { key: "active", label: "Active", count: tasks.filter(t => t.status !== "done").length },
              { key: "all", label: "All", count: tasks.length },
              ...STATUS_ORDER.map(s => ({ key: s, label: STATUS_CONFIG[s].label, count: statusCounts[s] || 0 })),
            ].map(tab => {
              const isAct = activeFilter === tab.key;
              return <button key={tab.key} onClick={() => setActiveFilter(tab.key)} style={{
                padding: "8px 12px", border: "none", background: "none",
                borderBottom: isAct ? "2px solid #111827" : "2px solid transparent",
                color: isAct ? "#111827" : "#6b7280", fontSize: 12.5, fontWeight: isAct ? 600 : 450,
                cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5,
              }}>
                {tab.label}
                <span style={{ fontSize: 10.5, fontWeight: 600, borderRadius: 10, padding: "0 6px", lineHeight: "16px", minWidth: 18, textAlign: "center", background: isAct ? "#111827" : "#e5e7eb", color: isAct ? "#fff" : "#6b7280" }}>{tab.count}</span>
              </button>;
            })}
            {/* Filter button - inline with tabs */}
            <button onClick={() => { setFilterMenuOpen(o => !o); setFilterEditId(null); }}
              style={{
                display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 500,
                color: filters.length > 0 ? "#374151" : "#9ca3af",
                border: filters.length > 0 ? "1px solid #9ca3af" : "1px dashed #d1d5db",
                borderRadius: 5, padding: "3px 9px", marginLeft: 6, marginBottom: 7,
                background: filters.length > 0 ? "#f6f7f8" : "transparent", cursor: "pointer", fontFamily: "inherit",
                transition: "all 0.12s",
              }}
              onMouseEnter={e => { e.currentTarget.style.color = "#374151"; e.currentTarget.style.borderColor = "#9ca3af"; }}
              onMouseLeave={e => { e.currentTarget.style.color = filters.length > 0 ? "#374151" : "#9ca3af"; e.currentTarget.style.borderColor = filters.length > 0 ? "#9ca3af" : "#d1d5db"; }}
            >
              <I type="filter" size={11}/> Filter{filters.length > 0 && ` · ${filters.length}`}
            </button>
          </div>
          {/* Grouping */}
          <div style={{ display: "flex", alignItems: "center", gap: 1, background: "#f3f4f6", borderRadius: 7, padding: 2, marginBottom: 6 }}>
            {[{ v: "none", l: "List" }, { v: "client", l: "Client" }, { v: "status", l: "Status" }, { v: "category", l: "Type" }].map(g => (
              <button key={g.v} onClick={() => setGroupBy(g.v)} style={{
                padding: "4px 10px", borderRadius: 5, border: "none",
                background: groupBy === g.v ? "#fff" : "transparent",
                boxShadow: groupBy === g.v ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                color: groupBy === g.v ? "#111827" : "#6b7280",
                fontSize: 12, fontWeight: 550, cursor: "pointer", fontFamily: "inherit",
              }}>{g.l}</button>
            ))}
          </div>
        </div>

        {/* Filter bar - slides in when toggled or has filters */}
        {(filters.length > 0 || filterMenuOpen) && (
        <div ref={filterMenuRef} style={{ 
          padding: "6px 20px", background: "#fafbfc", borderBottom: "1px solid #e5e7eb", 
          display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", minHeight: 36,
          animation: "filterSlideIn 0.15s ease",
        }}>
          {/* Active filter pills with connectors */}
          {filters.map((f, i) => {
            const def = FILTER_DEFS[f.property];
            const isEditing = filterEditId === f.id;
            const valueLabels = f.values.map(v => {
              const found = def.values.find(dv => dv.key === v);
              return found ? found.label : v;
            });
            return (
              <React.Fragment key={f.id}>
                {i > 0 && (
                  <button onClick={() => setFilterMode(m => m === "all" ? "any" : "all")}
                    style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500, border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", padding: "0 2px" }}
                    onMouseEnter={e => e.currentTarget.style.color = "#374151"}
                    onMouseLeave={e => e.currentTarget.style.color = "#9ca3af"}
                  >{filterMode === "all" ? "and" : "or"}</button>
                )}
                <div style={{ display: "inline-flex", alignItems: "center", position: "relative" }}>
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 0, fontSize: 12, borderRadius: 6,
                    border: isEditing ? "1px solid #9ca3af" : "1px solid #e0e2e5", background: "#fff", overflow: "hidden",
                    boxShadow: isEditing ? "0 0 0 2px rgba(156,163,175,0.1)" : "none", transition: "all 0.12s",
                  }}>
                    <span style={{ padding: "3px 6px 3px 8px", color: "#6b7280", fontWeight: 500, borderRight: "1px solid #f0f0f0" }}>{def.label}</span>
                    <button onClick={e => { e.stopPropagation();
                      if (def.type === "date") {
                        const ops = DATE_OPERATORS;
                        const idx = ops.indexOf(f.operator);
                        updateFilter(f.id, { operator: ops[(idx + 1) % ops.length] });
                      } else {
                        updateFilter(f.id, { operator: f.operator === "is" ? "is not" : "is" });
                      }
                    }}
                      style={{ padding: "3px 6px", color: "#9ca3af", fontWeight: 500, border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 12, borderRight: "1px solid #f0f0f0" }}
                    >{f.operator}</button>
                    <button onClick={e => { e.stopPropagation(); setFilterEditId(isEditing ? null : f.id); }}
                      style={{ padding: "3px 8px", color: f.values.length > 0 ? "#111827" : "#9ca3af", fontWeight: 550, border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}
                    >{f.values.length > 0 ? valueLabels.join(", ") : "select…"}</button>
                    <button onClick={e => { e.stopPropagation(); removeFilter(f.id); }}
                      style={{ padding: "3px 6px", color: "#c2c7ce", border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center" }}
                      onMouseEnter={e => e.currentTarget.style.color = "#6b7280"}
                      onMouseLeave={e => e.currentTarget.style.color = "#c2c7ce"}
                    ><I type="x" size={10}/></button>
                  </div>
                  {isEditing && (
                    <div style={{
                      position: "absolute", top: "100%", left: 0, marginTop: 4, zIndex: 300,
                      background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10,
                      boxShadow: "0 8px 24px rgba(0,0,0,0.12)", padding: 4, minWidth: 180,
                      animation: "popIn 0.12s ease",
                    }}>
                      {def.type === "date" ? (
                        /* Date preset single-select with radio dots */
                        def.values.map(v => {
                          const selected = f.values[0] === v.key;
                          return <div key={v.key} onClick={e => { e.stopPropagation(); toggleFilterValue(f.id, v.key); }}
                            style={{
                              display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 6,
                              cursor: "pointer", fontSize: 12.5, fontWeight: selected ? 600 : 450,
                              color: selected ? "#111827" : "#4b5563", background: selected ? "#f3f4f6" : "transparent",
                            }}
                            onMouseEnter={e => { if (!selected) e.currentTarget.style.background = "#f8f9fb"; }}
                            onMouseLeave={e => { if (!selected) e.currentTarget.style.background = "transparent"; }}
                          >
                            <span style={{
                              width: 14, height: 14, borderRadius: "50%", flexShrink: 0,
                              border: selected ? "4px solid #111827" : "1.5px solid #d1d5db",
                              background: "#fff", boxSizing: "border-box",
                            }}/>
                            {v.label}
                          </div>;
                        })
                      ) : (
                        /* Multi-select checkboxes for regular filters */
                        def.values.map(v => {
                          const selected = f.values.includes(v.key);
                          return <div key={v.key} onClick={e => { e.stopPropagation(); toggleFilterValue(f.id, v.key); }}
                            style={{
                              display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 6,
                              cursor: "pointer", fontSize: 12.5, fontWeight: selected ? 600 : 450,
                              color: selected ? "#111827" : "#4b5563", background: selected ? "#f3f4f6" : "transparent",
                            }}
                            onMouseEnter={e => { if (!selected) e.currentTarget.style.background = "#f8f9fb"; }}
                            onMouseLeave={e => { if (!selected) e.currentTarget.style.background = "transparent"; }}
                          >
                            <span style={{
                              width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                              border: selected ? "none" : "1.5px solid #d1d5db",
                              background: selected ? "#111827" : "transparent",
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}>
                              {selected && <svg width="9" height="9" viewBox="0 0 16 16" fill="none"><path d="M4 8.5L7 11.5L12 5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                            </span>
                            {f.property === "status" && <StatusIcon status={v.key} size={14}/>}
                            {v.label}
                          </div>;
                        })
                      )}
                    </div>
                  )}
                </div>
              </React.Fragment>
            );
          })}


          {/* Inline property quick-add chips */}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {Object.entries(FILTER_DEFS)
              .filter(([key]) => !filters.some(f => f.property === key))
              .map(([key, def]) => (
              <button key={key} onClick={() => addFilter(key)}
                style={{
                  fontSize: 11.5, fontWeight: 500, color: "#9ca3af", border: "1px dashed #d9dce0",
                  borderRadius: 5, padding: "2px 8px", background: "transparent", cursor: "pointer", fontFamily: "inherit",
                  transition: "all 0.1s",
                }}
                onMouseEnter={e => { e.currentTarget.style.color = "#374151"; e.currentTarget.style.borderColor = "#9ca3af"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "#9ca3af"; e.currentTarget.style.borderColor = "#d9dce0"; }}
              >{def.label}</button>
            ))}
            {/* Clear all - after last chip */}
            {filters.length > 0 && (
              <button onClick={clearFilters}
                style={{ fontSize: 11, color: "#c2c7ce", border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", fontWeight: 500, padding: "2px 6px" }}
                onMouseEnter={e => e.currentTarget.style.color = "#6b7280"}
                onMouseLeave={e => e.currentTarget.style.color = "#c2c7ce"}
              >Clear all</button>
            )}
          </div>
        </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <div style={{ flex: 1, overflowY: "auto", minWidth: 0 }}>
            {/* Gmail-style bulk action bar */}
            {selectedIds.size > 0 && (
              <div style={{
                display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
                background: "#f6f7f8", borderBottom: "1px solid #e5e7eb",
                animation: "popIn 0.12s ease", position: "sticky", top: 0, zIndex: 20,
              }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "#374151" }}>
                  {selectedIds.size} selected
                </span>
                <span style={{ color: "#d1d5db" }}>|</span>
                {STATUS_ORDER.map(key => {
                  const cfg = STATUS_CONFIG[key];
                  return <button key={key} onClick={() => handleBulkStatus(key)} style={{
                    display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 5,
                    border: "none", background: "transparent", fontSize: 11.5, fontWeight: 500,
                    color: "#374151", cursor: "pointer", fontFamily: "inherit",
                  }} onMouseEnter={e => { e.currentTarget.style.background = cfg.bg; }}
                     onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                  ><StatusIcon status={key} size={12}/>{cfg.label}</button>;
                })}
                <span style={{ flex: 1 }}/>
                <button onClick={() => setSelectedIds(new Set())} style={{
                  padding: "4px 10px", borderRadius: 5, border: "none",
                  background: "transparent", fontSize: 11.5, fontWeight: 500,
                  color: "#6b7280", cursor: "pointer", fontFamily: "inherit",
                }}>Clear</button>
              </div>
            )}
            {grouped.map(({ key: group, tasks: gt, rawKey }) => (
              <div key={group || "__all"}>
                {group && <div style={{ padding: "8px 16px", background: "#f9fafb", borderBottom: "1px solid #f0f0f0", fontSize: 12, fontWeight: 650, color: "#4b5563", display: "flex", alignItems: "center", gap: 6, position: "sticky", top: 0, zIndex: 10 }}>
                  {group}<span style={{ fontSize: 10.5, color: "#9ca3af", fontWeight: 500, background: "#e5e7eb", borderRadius: 10, padding: "0 6px", lineHeight: "16px" }}>{gt.length}</span>
                </div>}
                {gt.map(task => <TaskRow key={task.id} task={task} isActive={selectedTaskId === task.id} isSelected={selectedIds.has(task.id)} onSelect={handleSelect} onToggleSelect={handleToggleSelect} onStatusChange={handleStatusChange} runningTimerId={runningTimerId} timerElapsed={timerElapsed} onTimerToggle={handleTimerToggle}/>)}
                {group ? <InlineAddTask onAdd={handleAddTask} groupContext={rawKey || group} placeholder={`Add task to ${group}…`} clients={allClients} groupBy={groupBy}/> : <InlineAddTask onAdd={handleAddTask} placeholder="Add a new task…" clients={allClients} groupBy={groupBy}/>}
              </div>
            ))}

            {filtered.length === 0 && (
              <div style={{ padding: "64px 20px", textAlign: "center", color: "#9ca3af" }}>
                <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.6 }}>✓</div>
                <div style={{ fontSize: 15, fontWeight: 550, color: "#6b7280" }}>All clear</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>No tasks match your current filters.</div>
              </div>
            )}
          </div>

          {selectedTask && <DetailPanel task={selectedTask} onClose={() => setSelectedTaskId(null)} onStatusChange={handleStatusChange} runningTimerId={runningTimerId} timerElapsed={timerElapsed} onTimerToggle={handleTimerToggle}/>}
        </div>
      </div>
    </div>
  );
}
