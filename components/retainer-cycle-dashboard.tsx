"use client"

import { Badge } from "@/components/ui/badge"
import { T } from "@/lib/retainer-strings"
import {
  minutesToHours,
  getStatusTag,
  CYCLE_LENGTH,
  type ComputedMonth,
} from "@/convex/lib/retainerCompute"
import { cn } from "@/lib/utils"

interface RetainerCycleDashboardProps {
  /** Months belonging to the current cycle (ordered chronologically) */
  cycleMonths: ComputedMonth[]
  /** Monthly budget in minutes */
  budgetMinutes: number
  /** Whether rollover is enabled */
  rolloverEnabled: boolean
  /** Cycle date range label, e.g. "Apr – Jun 2025" */
  cycleRangeLabel: string
}

export function RetainerCycleDashboard({
  cycleMonths,
  budgetMinutes,
  rolloverEnabled,
  cycleRangeLabel,
}: RetainerCycleDashboardProps) {
  const budgetHours = minutesToHours(budgetMinutes)
  const cycleBudgetMinutes = rolloverEnabled
    ? budgetMinutes * CYCLE_LENGTH
    : budgetMinutes
  const cycleBudgetHours = minutesToHours(cycleBudgetMinutes)

  const totalWorkedMinutes = cycleMonths.reduce(
    (sum, m) => sum + m.workedMinutes,
    0,
  )
  const totalWorkedHours = minutesToHours(totalWorkedMinutes)
  const remainingMinutes = cycleBudgetMinutes - totalWorkedMinutes
  const remainingHours = minutesToHours(Math.abs(remainingMinutes))

  const isOver = remainingMinutes < 0
  const isFullyUsed = remainingMinutes === 0

  // Remaining badge styling
  const remainingBadgeClass = isOver
    ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
    : isFullyUsed
      ? "border-muted bg-muted text-muted-foreground"
      : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"

  const remainingLabel = isOver
    ? `–${remainingHours}h ${T.overBudget}`
    : isFullyUsed
      ? T.fullyUsed
      : `${remainingHours}h ${T.remaining}`

  const headerLabel = rolloverEnabled
    ? T.currentCycle(cycleRangeLabel)
    : T.thisMonth

  return (
    <div className="ring-foreground/10 overflow-hidden rounded-xl bg-card text-card-foreground shadow-xs ring-1">
      {/* ─── Top section ─── */}
      <div className="flex items-start justify-between px-6 py-5">
        <div>
          <div className="text-muted-foreground mb-1.5 text-[10px] font-semibold uppercase tracking-wider">
            {headerLabel}
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-semibold tabular-nums leading-none">
              {totalWorkedHours}
            </span>
            <span className="text-muted-foreground text-sm tabular-nums">
              / {cycleBudgetHours} {T.hoursUsedLabel}
            </span>
          </div>
        </div>
        <Badge
          variant="outline"
          className={cn("mt-1 text-xs", remainingBadgeClass)}
        >
          {remainingLabel}
        </Badge>
      </div>

      {/* ─── Bottom section: per-month mini-cards (rollover only) ─── */}
      {rolloverEnabled && cycleMonths.length > 0 && (
        <div className="border-t bg-muted/20 px-6 py-4">
          <div className="grid grid-cols-3 gap-4">
            {cycleMonths.map((month) => (
              <MiniMonthCard
                key={month.yearMonth}
                month={month}
                budgetMinutes={budgetMinutes}
                rolloverEnabled={rolloverEnabled}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Per-month mini-card ─────────────────────────────────────────────

function MiniMonthCard({
  month,
  budgetMinutes,
  rolloverEnabled,
}: {
  month: ComputedMonth
  budgetMinutes: number
  rolloverEnabled: boolean
}) {
  const budgetHours = minutesToHours(budgetMinutes)
  const workedHours = minutesToHours(month.workedMinutes)
  const availableHours = minutesToHours(month.availableMinutes)
  const tag = getStatusTag(month, rolloverEnabled)

  // Color the available number: red if less than budget, green if more (carryover bonus)
  const availableColor =
    month.availableMinutes < budgetMinutes
      ? "text-red-600 dark:text-red-400"
      : month.availableMinutes > budgetMinutes
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-foreground"

  // Badge variant mapping
  const badgeVariant =
    tag.variant === "success"
      ? "outline"
      : tag.variant === "destructive"
        ? "destructive"
        : tag.variant === "warning"
          ? "secondary"
          : "outline"

  const badgeClassName =
    tag.variant === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
      : tag.variant === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
        : ""

  // Month short name from yearMonth
  const [year, m] = month.yearMonth.split("-").map(Number)
  const monthName = new Date(year, m - 1, 1).toLocaleString("en-US", {
    month: "short",
  })

  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium">{monthName}</span>
        <Badge
          variant={badgeVariant}
          className={cn("h-4 px-1.5 text-[10px]", badgeClassName)}
        >
          {tag.label}
        </Badge>
      </div>
      <div className="text-lg font-semibold tabular-nums leading-none">
        {workedHours}
        <span className="text-muted-foreground ml-0.5 text-[11px] font-normal">
          {T.hLogged}
        </span>
      </div>
      <div className="text-muted-foreground mt-1 text-[11px] font-tabular-nums tabular-nums">
        of{" "}
        <span className={availableColor}>{availableHours}</span>
        {" / "}
        {budgetHours}{T.hAvailable}
      </div>
    </div>
  )
}
