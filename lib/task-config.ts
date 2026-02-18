// ── Status Configuration ────────────────────────────────────────────────

/** Canonical task status keys — single source of truth. */
export const TASK_STATUSES = ["today", "admin_review", "next_up", "stuck", "inbox", "done"] as const
export type TaskStatusKey = (typeof TASK_STATUSES)[number]

export type StatusConfigEntry = {
  readonly color: string
  readonly bg: string
  readonly label: string
  readonly sortOrder: number
}

export const STATUS_CONFIG: Readonly<Record<TaskStatusKey, StatusConfigEntry>> = {
  today:        { color: "#c25852", bg: "#fbf7f6", label: "Today",   sortOrder: 0 },
  admin_review: { color: "#9b8ab5", bg: "#f5f3f8", label: "Review",  sortOrder: 1 },
  next_up:      { color: "#7a9ab8", bg: "#f3f6f9", label: "Next Up", sortOrder: 2 },
  stuck:        { color: "#d97706", bg: "#fefce8", label: "Stuck",   sortOrder: 3 },
  inbox:        { color: "#c2c7ce", bg: "#f8f8f9", label: "Backlog", sortOrder: 4 },
  done:         { color: "#5a9e6f", bg: "#f2f7f4", label: "Done",    sortOrder: 5 },
} as const

/** Status order derived from STATUS_CONFIG.sortOrder — no manual sync needed. */
export const STATUS_ORDER: readonly TaskStatusKey[] = [...TASK_STATUSES].sort(
  (a, b) => STATUS_CONFIG[a].sortOrder - STATUS_CONFIG[b].sortOrder,
)

// ── Priority ────────────────────────────────────────────────────────────

export type TaskPriorityKey = "high" | "medium" | "low"

export const PRIORITY_CONFIG: Readonly<Record<TaskPriorityKey, { readonly color: string; readonly icon: string }>> = {
  high:   { color: "#d1242f", icon: "▲" },
  medium: { color: "#cf8700", icon: "─" },
  low:    { color: "#848d97", icon: "▽" },
} as const

// ── Category Colors ─────────────────────────────────────────────────────

const DEFAULT_CATEGORY_COLOR = "#6b7280"

/** Default colors for known categories. Admin-managed categories may not be listed here. */
const CATEGORY_COLOR_MAP: Readonly<Record<string, string>> = {
  Development: "#5a8abf",
  Design:      "#b5628a",
  Copywriting: "#b89245",
  Meeting:     "#4d9660",
  PM:          "#8b7ec8",
  Testing:     "#6b9e7a",
} as const

export function getCategoryColor(name: string): string {
  return CATEGORY_COLOR_MAP[name] ?? DEFAULT_CATEGORY_COLOR
}

// ── Date Helpers ────────────────────────────────────────────────────────

const MS_PER_DAY = 86_400_000

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

// ── Due Date Formatting ─────────────────────────────────────────────────

export type DueDateInfo = { text: string; color: string; urgent: boolean }

export function formatDueDate(ts: number | null | undefined): DueDateInfo | null {
  if (ts == null) return null
  const now = Date.now()
  const todayStart = startOfDay(now)
  const todayEnd = endOfDay(now)
  const tomorrowEnd = endOfDay(now + MS_PER_DAY)
  const yesterdayStart = startOfDay(now - MS_PER_DAY)
  const weekEnd = endOfDay(now + 7 * MS_PER_DAY)

  if (ts >= todayStart && ts <= todayEnd) return { text: "Today", color: "var(--task-timer)", urgent: true }
  if (ts < todayStart && ts >= yesterdayStart) return { text: "Yesterday", color: "var(--task-timer)", urgent: true }
  if (ts < yesterdayStart) {
    const days = Math.ceil((todayStart - ts) / MS_PER_DAY)
    return { text: `${days}d overdue`, color: "var(--task-timer)", urgent: true }
  }
  if (ts > todayEnd && ts <= tomorrowEnd) return { text: "Tomorrow", color: "var(--task-warning)", urgent: false }
  if (ts <= weekEnd) {
    const days = Math.ceil((ts - todayEnd) / MS_PER_DAY)
    return { text: `in ${days}d`, color: "var(--task-muted)", urgent: false }
  }
  const dt = new Date(ts)
  return { text: dt.toLocaleDateString("en", { month: "short", day: "numeric" }), color: "var(--task-muted-light)", urgent: false }
}

// ── Time Ago ────────────────────────────────────────────────────────────

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return "just now"
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < MS_PER_DAY) return `${Math.floor(diff / 3_600_000)}h ago`
  if (diff < 2 * MS_PER_DAY) return "yesterday"
  return `${Math.floor(diff / MS_PER_DAY)}d ago`
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

export const DATE_PRESET_KEYS = [
  "today", "yesterday", "tomorrow", "this_week", "last_week", "next_week", "this_month", "last_7", "last_30", "no_date",
] as const
export type DatePresetKey = (typeof DATE_PRESET_KEYS)[number]

export type DatePreset = {
  readonly key: DatePresetKey
  readonly label: string
  readonly range: () => [number, number] | null
}

export const DATE_PRESETS: readonly DatePreset[] = [
  { key: "today",      label: "Today",        range: () => [startOfDay(Date.now()), endOfDay(Date.now())] },
  { key: "yesterday",  label: "Yesterday",    range: () => [startOfDay(Date.now() - MS_PER_DAY), endOfDay(Date.now() - MS_PER_DAY)] },
  { key: "tomorrow",   label: "Tomorrow",     range: () => [startOfDay(Date.now() + MS_PER_DAY), endOfDay(Date.now() + MS_PER_DAY)] },
  { key: "this_week",  label: "This week",    range: () => [startOfWeek(Date.now()), startOfWeek(Date.now()) + 7 * MS_PER_DAY - 1] },
  { key: "last_week",  label: "Last week",    range: () => [startOfWeek(Date.now()) - 7 * MS_PER_DAY, startOfWeek(Date.now()) - 1] },
  { key: "next_week",  label: "Next week",    range: () => [startOfWeek(Date.now()) + 7 * MS_PER_DAY, startOfWeek(Date.now()) + 14 * MS_PER_DAY - 1] },
  { key: "this_month", label: "This month",   range: () => [startOfMonth(Date.now()), endOfMonth(Date.now())] },
  { key: "last_7",     label: "Last 7 days",  range: () => [startOfDay(Date.now() - 7 * MS_PER_DAY), endOfDay(Date.now())] },
  { key: "last_30",    label: "Last 30 days", range: () => [startOfDay(Date.now() - 30 * MS_PER_DAY), endOfDay(Date.now())] },
  { key: "no_date",    label: "No date",      range: () => null },
] as const

export const DATE_OPERATORS = ["is", "before", "after"] as const

export type DateOperator = (typeof DATE_OPERATORS)[number]
export type SelectOperator = "is" | "is not"

// ── Filter Definitions ─────────────────────────────────────────────────

export const FILTER_PROPERTIES = ["status", "assignee", "client", "category", "dueDate", "createdAt", "lastEditedAt"] as const
export type FilterProperty = (typeof FILTER_PROPERTIES)[number]

export type FilterDef = {
  readonly label: string
  readonly type: "select" | "date"
  readonly property: FilterProperty
}

export const FILTER_DEFS: readonly FilterDef[] = [
  { label: "Status",   type: "select", property: "status" },
  { label: "Assignee", type: "select", property: "assignee" },
  { label: "Client",   type: "select", property: "client" },
  { label: "Category", type: "select", property: "category" },
  { label: "Due date", type: "date",   property: "dueDate" },
  { label: "Created",  type: "date",   property: "createdAt" },
  { label: "Updated",  type: "date",   property: "lastEditedAt" },
] as const
