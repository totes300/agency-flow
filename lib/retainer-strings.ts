/**
 * Text dictionary for retainer hours tracker.
 * All user-facing strings in one place for consistency and future i18n/export reuse.
 * Hour values are pre-formatted numbers (e.g. 1.5, 10).
 */
export const T = {
  // Fixed labels (never change across months)
  startedWith: "Started with",
  hoursUsed: "Hours used",
  endingBalance: "Ending balance",

  // Started-with subtitles
  startBudgetOnly: (b: number) => `${b}h budget`,
  startCycleStart: (b: number) => `${b}h budget · cycle start`,
  startWithCarry: (b: number, n: number) => `${b}h budget + ${n}h from last month`,
  startWithDeduction: (b: number, n: number) =>
    `${b}h budget – ${n}h from last month`,
  startNoRollover: (b: number) => `${b}h monthly budget`,

  // Hours-used subtitle
  tasksCompleted: (n: number) => `${n} task${n !== 1 ? "s" : ""} completed`,

  // Ending-balance subtitles
  carriesOver: "Carries over",
  deductedNext: "Deducted next month",
  allUsed: "All hours used",
  paymentDue: "Payment due",
  notCarriedOver: "Not carried over",
  notUsed: "Not used",
  noExtraCharges: "No extra charges",

  // Row tags (collapsed month rows)
  tagCarries: (n: number) => `${n}h carries`,
  tagOver: (n: number) => `${n}h over`,
  tagUnused: (n: number) => `${n}h unused`,
  tagOnBudget: "on budget" as const,
  tagPaymentDue: (n: number) => `+${n}h · payment due`,

  // Settlement block
  extraHoursLabel: (range: string) => `${range} · Extra hours`,
  extraExplainCycle: (used: number, extra: number, pool: number) =>
    `${used}h used this cycle — ${extra}h more than the ${pool}h included.`,
  extraExplainMonth: (used: number, extra: number, budget: number) =>
    `${used}h used — ${extra}h more than the ${budget}h included.`,
  extraInvoice: "Extra hours invoice",
  extraCalc: (n: number, rate: number, currencySymbol: string) =>
    `${n} hours × ${currencySymbol}${rate}/h`,
  unusedCycle: (n: number) =>
    `${n}h not used this cycle. Balance resets for the next cycle.`,
  unusedMonth: (n: number) => `${n}h not used. Next month starts fresh.`,

  // Dashboard
  currentCycle: (range: string) => `Current cycle · ${range}`,
  thisMonth: "This month",
  hoursUsedLabel: "hours used",
  remaining: "remaining",
  overBudget: "over budget",
  fullyUsed: "fully used",

  // Mini-card / collapsed row strings
  hLogged: "h logged",
  hAvailable: "h available",

  // Task list
  workCompleted: "Work completed",
  total: "Total",

  // Filters
  allTime: "All time",
  thisCycle: "This cycle",
  lastCycle: "Last cycle",
  lastMonth: "Last month",
  last6Months: "Last 6 months",
  thisYear: "This year",
  allCategories: "All categories",
  custom: "Custom",
  pickDates: "Pick dates",
} as const;

// ── Shared badge styling for status tags ────────────────────────────

type StatusVariant = "default" | "success" | "destructive" | "warning" | "secondary";

export function getStatusBadgeProps(variant: StatusVariant): {
  variant: "outline" | "destructive" | "secondary"
  className: string
} {
  if (variant === "success") {
    return {
      variant: "outline",
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    }
  }
  if (variant === "destructive") {
    return { variant: "destructive", className: "" }
  }
  if (variant === "warning") {
    return {
      variant: "secondary",
      className:
        "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
    }
  }
  if (variant === "secondary") {
    return { variant: "secondary", className: "" }
  }
  return { variant: "outline", className: "" }
}
