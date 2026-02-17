// ── Status Configuration ────────────────────────────────────────────────
export type TaskStatusKey = "today" | "admin_review" | "next_up" | "stuck" | "inbox" | "done"

export type StatusConfigEntry = {
  color: string
  bg: string
  label: string
  sortOrder: number
}

export const STATUS_CONFIG: Record<TaskStatusKey, StatusConfigEntry> = {
  today:        { color: "#c25852", bg: "#fbf7f6", label: "Today",   sortOrder: 0 },
  admin_review: { color: "#9b8ab5", bg: "#f5f3f8", label: "Review",  sortOrder: 1 },
  next_up:      { color: "#7a9ab8", bg: "#f3f6f9", label: "Next Up", sortOrder: 2 },
  stuck:        { color: "#d97706", bg: "#fefce8", label: "Stuck",   sortOrder: 3 },
  inbox:        { color: "#c2c7ce", bg: "#f8f8f9", label: "Backlog", sortOrder: 4 },
  done:         { color: "#5a9e6f", bg: "#f2f7f4", label: "Done",    sortOrder: 5 },
}

export const STATUS_ORDER: TaskStatusKey[] = ["today", "admin_review", "next_up", "stuck", "inbox", "done"]

// ── Priority ────────────────────────────────────────────────────────────
export const PRIORITY_CONFIG: Record<string, { color: string; icon: string }> = {
  high:   { color: "#d1242f", icon: "▲" },
  medium: { color: "#cf8700", icon: "─" },
  low:    { color: "#848d97", icon: "▽" },
}

// ── Category Colors ─────────────────────────────────────────────────────
export const CATEGORY_COLORS: Record<string, string> = {
  Development: "#5a8abf",
  Design:      "#b5628a",
  Copywriting: "#b89245",
  Meeting:     "#4d9660",
  PM:          "#8b7ec8",
  Testing:     "#6b9e7a",
}

// ── Due Date Formatting ─────────────────────────────────────────────────
type DueDateInfo = { text: string; color: string; urgent: boolean }

function startOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function endOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(23, 59, 59, 999)
  return d.getTime()
}

export function formatDueDate(ts: number | null | undefined): DueDateInfo | null {
  if (ts == null) return null
  const now = Date.now()
  const todayStart = startOfDay(now)
  const todayEnd = endOfDay(now)
  const tomorrowEnd = endOfDay(now + 86400000)
  const yesterdayStart = startOfDay(now - 86400000)
  const weekEnd = endOfDay(now + 7 * 86400000)

  if (ts >= todayStart && ts <= todayEnd) return { text: "Today", color: "#c25852", urgent: true }
  if (ts < todayStart && ts >= yesterdayStart) return { text: "Yesterday", color: "#c25852", urgent: true }
  if (ts < yesterdayStart) {
    const days = Math.ceil((todayStart - ts) / 86400000)
    return { text: `${days}d overdue`, color: "#c25852", urgent: true }
  }
  if (ts > todayEnd && ts <= tomorrowEnd) return { text: "Tomorrow", color: "#b89245", urgent: false }
  if (ts <= weekEnd) {
    const days = Math.ceil((ts - todayEnd) / 86400000)
    return { text: `in ${days}d`, color: "#6b7280", urgent: false }
  }
  const dt = new Date(ts)
  return { text: dt.toLocaleDateString("en", { month: "short", day: "numeric" }), color: "#9ca3af", urgent: false }
}

// ── Time Ago ────────────────────────────────────────────────────────────
export function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60000) return "just now"
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  if (diff < 172800000) return "yesterday"
  return `${Math.floor(diff / 86400000)}d ago`
}

// ── Date Filter Presets ─────────────────────────────────────────────────
function startOfWeek(ts: number): number {
  const dt = new Date(ts)
  const day = dt.getDay()
  const diff = day === 0 ? -6 : 1 - day
  dt.setDate(dt.getDate() + diff)
  dt.setHours(0, 0, 0, 0)
  return dt.getTime()
}

function startOfMonth(ts: number): number {
  const dt = new Date(ts)
  dt.setDate(1)
  dt.setHours(0, 0, 0, 0)
  return dt.getTime()
}

function endOfMonth(ts: number): number {
  const dt = new Date(ts)
  dt.setMonth(dt.getMonth() + 1, 0)
  dt.setHours(23, 59, 59, 999)
  return dt.getTime()
}

export type DatePreset = {
  key: string
  label: string
  range: () => [number, number] | null
}

export const DATE_PRESETS: DatePreset[] = [
  { key: "today",      label: "Today",        range: () => [startOfDay(Date.now()), endOfDay(Date.now())] },
  { key: "yesterday",  label: "Yesterday",    range: () => [startOfDay(Date.now() - 86400000), endOfDay(Date.now() - 86400000)] },
  { key: "tomorrow",   label: "Tomorrow",     range: () => [startOfDay(Date.now() + 86400000), endOfDay(Date.now() + 86400000)] },
  { key: "this_week",  label: "This week",    range: () => [startOfWeek(Date.now()), startOfWeek(Date.now()) + 7 * 86400000 - 1] },
  { key: "last_week",  label: "Last week",    range: () => [startOfWeek(Date.now()) - 7 * 86400000, startOfWeek(Date.now()) - 1] },
  { key: "next_week",  label: "Next week",    range: () => [startOfWeek(Date.now()) + 7 * 86400000, startOfWeek(Date.now()) + 14 * 86400000 - 1] },
  { key: "this_month", label: "This month",   range: () => [startOfMonth(Date.now()), endOfMonth(Date.now())] },
  { key: "last_7",     label: "Last 7 days",  range: () => [startOfDay(Date.now() - 7 * 86400000), endOfDay(Date.now())] },
  { key: "last_30",    label: "Last 30 days", range: () => [startOfDay(Date.now() - 30 * 86400000), endOfDay(Date.now())] },
  { key: "no_date",    label: "No date",      range: () => null },
]

export const DATE_OPERATORS = ["is", "before", "after"] as const

export type DateOperator = (typeof DATE_OPERATORS)[number]
export type SelectOperator = "is" | "is not"

export type FilterDef = {
  label: string
  type: "select" | "date"
  property: string
}

export const FILTER_DEFS: FilterDef[] = [
  { label: "Status",   type: "select", property: "status" },
  { label: "Assignee", type: "select", property: "assignee" },
  { label: "Client",   type: "select", property: "client" },
  { label: "Category", type: "select", property: "category" },
  { label: "Due date", type: "date",   property: "dueDate" },
  { label: "Created",  type: "date",   property: "createdAt" },
  { label: "Updated",  type: "date",   property: "lastEditedAt" },
]
