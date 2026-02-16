"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ChevronRightIcon } from "lucide-react"
import { T } from "@/lib/retainer-strings"
import {
  minutesToHours,
  groupTasksByCategory,
  getStatusTag,
  getStartedWithSubtitle,
  getEndingBalanceSubtitle,
  type ComputedMonth,
} from "@/convex/lib/retainerCompute"
import { formatCurrency, getCurrencySymbol } from "@/lib/format"
import { cn } from "@/lib/utils"

interface RetainerMonthRowProps {
  month: ComputedMonth
  rolloverEnabled: boolean
  budgetMinutes: number
  overageRate?: number
  currency: string
  /** Total worked minutes in the cycle up to and including this month (for settlement explanation) */
  cycleWorkedMinutes?: number
  /** Cycle pool in minutes (budget * CYCLE_LENGTH) */
  cyclePoolMinutes?: number
  /** Cycle date range label, e.g. "Jan – Mar 2025" */
  cycleRangeLabel?: string
  defaultOpen?: boolean
  isAdmin?: boolean
}

export function RetainerMonthRow({
  month,
  rolloverEnabled,
  budgetMinutes,
  overageRate = 0,
  currency,
  cycleWorkedMinutes = 0,
  cyclePoolMinutes = 0,
  cycleRangeLabel = "",
  defaultOpen = false,
  isAdmin = false,
}: RetainerMonthRowProps) {
  const [open, setOpen] = useState(defaultOpen)

  const budgetHours = minutesToHours(budgetMinutes)
  const workedHours = minutesToHours(month.workedMinutes)
  const availableHours = minutesToHours(month.availableMinutes)
  const endBalanceHours = minutesToHours(Math.abs(month.endBalance))
  const tag = getStatusTag(month, rolloverEnabled)
  const categoryGroups = groupTasksByCategory(month.tasks)

  // Badge variant mapping
  const badgeVariant =
    tag.variant === "success"
      ? "outline"
      : tag.variant === "destructive"
        ? "destructive"
        : tag.variant === "warning"
          ? "secondary"
          : "outline"

  // Badge color classes for success/warning since shadcn badge doesn't have those variants built-in
  const badgeClassName =
    tag.variant === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
      : tag.variant === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
        : ""

  // Ending balance color
  const endBalanceColor =
    month.endBalance < 0
      ? "text-red-700 dark:text-red-400"
      : month.endBalance > 0
        ? "text-emerald-700 dark:text-emerald-400"
        : "text-muted-foreground"

  // Ending balance background tint
  const endBalanceBg =
    month.endBalance < 0
      ? "bg-red-50/50 dark:bg-red-950/30"
      : month.endBalance > 0
        ? "bg-emerald-50/50 dark:bg-emerald-950/30"
        : "bg-muted/30"

  // Cycle badge label (date range like "Jan – Mar")
  const cycleBadgeLabel = rolloverEnabled && cycleRangeLabel
    ? cycleRangeLabel
    : null

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="border-b">
        {/* ─── Collapsed trigger ─── */}
        <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3.5 text-left hover:bg-muted/30 transition-colors cursor-pointer">
          <div className="flex items-center gap-2.5">
            <ChevronRightIcon
              className={cn(
                "text-muted-foreground size-3.5 shrink-0 transition-transform duration-150",
                open && "rotate-90",
              )}
            />
            <span className="text-sm font-medium">{month.period}</span>
            {cycleBadgeLabel && (
              <span className="text-[10px] font-medium text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950 px-1.5 py-0.5 rounded">
                {cycleBadgeLabel}
              </span>
            )}
            <span className="text-muted-foreground text-xs tabular-nums">
              {workedHours}{T.hLogged}
            </span>
          </div>
          <Badge variant={badgeVariant} className={cn("text-[11px]", badgeClassName)}>
            {tag.label}
          </Badge>
        </CollapsibleTrigger>

        {/* ─── Expanded content ─── */}
        <CollapsibleContent>
          <div className="px-4 pb-6 pt-2">
            {/* Three-box summary */}
            <ThreeBoxSummary
              month={month}
              budgetHours={budgetHours}
              availableHours={availableHours}
              workedHours={workedHours}
              endBalanceHours={endBalanceHours}
              endBalanceColor={endBalanceColor}
              endBalanceBg={endBalanceBg}
              rolloverEnabled={rolloverEnabled}
            />

            {/* Task list grouped by category */}
            {month.tasks.length > 0 && (
              <div className="mb-5">
                <div className="text-muted-foreground mb-3 text-[10px] font-semibold uppercase tracking-wider">
                  {T.workCompleted}
                </div>
                {categoryGroups.map((group, gi) => (
                  <div key={group.categoryName} className={cn(gi < categoryGroups.length - 1 && "mb-4")}>
                    {/* Category header */}
                    <div className="flex items-center justify-between border-b py-1.5">
                      <span className="text-muted-foreground text-xs font-semibold">
                        {group.categoryName}
                      </span>
                      <span className="text-muted-foreground text-xs font-semibold tabular-nums">
                        {minutesToHours(group.totalMinutes)}h
                      </span>
                    </div>
                    {/* Task rows — 4-column table-like layout */}
                    {group.tasks.map((task, ti) => (
                      <div
                        key={`${task.taskId}-${task.date}-${ti}`}
                        className={cn(
                          "flex items-start gap-3 py-1.5",
                          ti < group.tasks.length - 1 && "border-b border-dashed border-muted/60",
                        )}
                      >
                        <span className="text-muted-foreground w-11 shrink-0 pt-px text-[11px] font-medium tabular-nums">
                          {task.date.slice(5)}
                        </span>
                        <span className="w-52 shrink-0 text-[13px] font-medium">
                          {task.title}
                        </span>
                        <span className="text-muted-foreground flex-1 pr-3 pt-px text-xs leading-relaxed">
                          {task.description ?? task.note ?? ""}
                        </span>
                        <span className="text-muted-foreground w-12 shrink-0 pt-px text-right text-[13px] font-medium tabular-nums">
                          {minutesToHours(task.durationMinutes)}h
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
                {/* Total row */}
                <div className="mt-3 flex items-center justify-between border-t pt-3">
                  <span className="text-sm font-semibold">{T.total}</span>
                  <span className="text-sm font-semibold tabular-nums">{workedHours}h</span>
                </div>
              </div>
            )}

            {/* Settlement block */}
            {month.settles && month.extraMinutes > 0 && (
              <SettlementExtra
                month={month}
                rolloverEnabled={rolloverEnabled}
                overageRate={overageRate}
                currency={currency}
                cycleWorkedMinutes={cycleWorkedMinutes}
                cyclePoolMinutes={cyclePoolMinutes}
                cycleRangeLabel={cycleRangeLabel}
                budgetMinutes={budgetMinutes}
                isAdmin={isAdmin}
              />
            )}

            {month.settles && month.unusedMinutes > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50/50 px-5 py-3.5 text-[13px] leading-relaxed text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                {rolloverEnabled
                  ? T.unusedCycle(minutesToHours(month.unusedMinutes))
                  : T.unusedMonth(minutesToHours(month.unusedMinutes))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

// ── Three-box summary ────────────────────────────────────────────

function ThreeBoxSummary({
  month,
  budgetHours,
  availableHours,
  workedHours,
  endBalanceHours,
  endBalanceColor,
  endBalanceBg,
  rolloverEnabled,
}: {
  month: ComputedMonth
  budgetHours: number
  availableHours: number
  workedHours: number
  endBalanceHours: number
  endBalanceColor: string
  endBalanceBg: string
  rolloverEnabled: boolean
}) {
  const startedSubtitle = getStartedWithSubtitle(month, budgetHours, rolloverEnabled)
  const endingSubtitle = getEndingBalanceSubtitle(month, rolloverEnabled)

  const endSign =
    month.endBalance > 0 ? "+" : month.endBalance < 0 ? "–" : ""

  return (
    <div className="mb-5 flex overflow-hidden rounded-md border">
      {/* Started with */}
      <div className="flex-1 border-r bg-muted/30 px-5 py-4">
        <div className="text-muted-foreground mb-2 text-[10px] font-semibold uppercase tracking-wider">
          {T.startedWith}
        </div>
        <div className="text-2xl font-semibold tabular-nums leading-none">
          {availableHours}
          <span className="text-muted-foreground ml-0.5 text-[13px] font-normal">h</span>
        </div>
        <div className="text-muted-foreground mt-1.5 text-[11px] leading-snug">
          {startedSubtitle}
        </div>
      </div>

      {/* Hours used */}
      <div className="flex-1 border-r px-5 py-4">
        <div className="text-muted-foreground mb-2 text-[10px] font-semibold uppercase tracking-wider">
          {T.hoursUsed}
        </div>
        <div className="text-2xl font-semibold tabular-nums leading-none">
          {workedHours}
          <span className="text-muted-foreground ml-0.5 text-[13px] font-normal">h</span>
        </div>
        <div className="text-muted-foreground mt-1.5 text-[11px]">
          {T.tasksCompleted(month.tasks.length)}
        </div>
      </div>

      {/* Ending balance */}
      <div className={cn("flex-1 px-5 py-4", endBalanceBg)}>
        <div className="text-muted-foreground mb-2 text-[10px] font-semibold uppercase tracking-wider">
          {T.endingBalance}
        </div>
        <div className={cn("text-2xl font-semibold tabular-nums leading-none", endBalanceColor)}>
          {endSign}{endBalanceHours}
          <span className="ml-0.5 text-[13px] font-normal">h</span>
        </div>
        <div className={cn("mt-1.5 text-[11px]", endBalanceColor)}>
          {endingSubtitle}
        </div>
      </div>
    </div>
  )
}

// ── Settlement: Extra hours ──────────────────────────────────────

function SettlementExtra({
  month,
  rolloverEnabled,
  overageRate,
  currency,
  cycleWorkedMinutes,
  cyclePoolMinutes,
  cycleRangeLabel,
  budgetMinutes,
  isAdmin,
}: {
  month: ComputedMonth
  rolloverEnabled: boolean
  overageRate: number
  currency: string
  cycleWorkedMinutes: number
  cyclePoolMinutes: number
  cycleRangeLabel: string
  budgetMinutes: number
  isAdmin: boolean
}) {
  const extraHours = minutesToHours(month.extraMinutes)
  const workedHours = minutesToHours(month.workedMinutes)
  const cycleWorkedHours = minutesToHours(cycleWorkedMinutes)
  const cyclePoolHours = minutesToHours(cyclePoolMinutes)
  const budgetHours = minutesToHours(budgetMinutes)
  const totalAmount = (month.extraMinutes / 60) * overageRate

  return (
    <div className="mb-5 overflow-hidden rounded-md border">
      {/* Explanation header */}
      <div className="border-b bg-red-50/50 px-5 py-3.5 dark:bg-red-950/20">
        <div className="text-muted-foreground mb-1.5 text-[11px] font-semibold uppercase tracking-wide">
          {T.extraHoursLabel(rolloverEnabled ? cycleRangeLabel : month.period)}
        </div>
        <div className="text-muted-foreground text-[13px] leading-relaxed">
          {rolloverEnabled
            ? T.extraExplainCycle(cycleWorkedHours, extraHours, cyclePoolHours)
            : T.extraExplainMonth(workedHours, extraHours, budgetHours)}
        </div>
      </div>
      {/* Invoice card (admin only) */}
      {isAdmin && overageRate > 0 && (
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <div className="text-[13px] font-semibold">{T.extraInvoice}</div>
            <div className="text-muted-foreground mt-0.5 text-xs">
              {T.extraCalc(extraHours, overageRate, getCurrencySymbol(currency))}
            </div>
          </div>
          <div className="text-[22px] font-semibold tabular-nums">
            {formatCurrency(totalAmount, currency)}
          </div>
        </div>
      )}
    </div>
  )
}
