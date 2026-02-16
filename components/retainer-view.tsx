"use client"

import { useState, useMemo } from "react"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { Skeleton } from "@/components/ui/skeleton"
import { RetainerCycleDashboard } from "@/components/retainer-cycle-dashboard"
import {
  RetainerFilterBar,
  type RetainerFilterState,
} from "@/components/retainer-filter-bar"
import { RetainerMonthRow } from "@/components/retainer-month-row"
import {
  minutesToHours,
  CYCLE_LENGTH,
  type ComputedMonth,
} from "@/convex/lib/retainerCompute"

interface RetainerViewProps {
  projectId: Id<"projects">
  currency: string
  isAdmin: boolean
}

/** Format a cycle range label like "Dec 1 – Feb 28, 2026" from an array of months. */
function getCycleRangeLabel(months: ComputedMonth[]): string {
  if (months.length === 0) return ""
  const first = months[0]
  const last = months[months.length - 1]
  const [fy, fm] = first.yearMonth.split("-").map(Number)
  const [ly, lm] = last.yearMonth.split("-").map(Number)

  const startDate = new Date(fy, fm - 1, 1)
  // Last day of the last month: day 0 of the next month
  const endDate = new Date(ly, lm, 0)

  const startMonth = startDate.toLocaleString("en-US", { month: "short" })
  const endMonth = endDate.toLocaleString("en-US", { month: "short" })

  if (months.length === 1) {
    return `${startMonth} ${startDate.getDate()} – ${endMonth} ${endDate.getDate()}, ${ly}`
  }

  // Cross-year: "Dec 1, 2025 – Feb 28, 2026"
  if (fy !== ly) {
    return `${startMonth} ${startDate.getDate()}, ${fy} – ${endMonth} ${endDate.getDate()}, ${ly}`
  }

  return `${startMonth} ${startDate.getDate()} – ${endMonth} ${endDate.getDate()}, ${ly}`
}

export function RetainerView({
  projectId,
  currency,
  isAdmin,
}: RetainerViewProps) {
  const [filters, setFilters] = useState<RetainerFilterState>({})

  const data = useQuery(api.retainerView.getComputedView, {
    projectId,
    dateRangeStart: filters.dateRangeStart,
    dateRangeEnd: filters.dateRangeEnd,
    categoryFilter: filters.categoryFilter,
  })

  // Fetch unfiltered data for CycleDashboard (dashboard always shows current cycle regardless of filters)
  const hasActiveFilters = !!(
    filters.dateRangeStart ||
    filters.dateRangeEnd ||
    filters.categoryFilter?.length
  )
  const unfilteredData = useQuery(
    api.retainerView.getComputedView,
    hasActiveFilters ? { projectId } : "skip",
  )

  // Use unfiltered data for dashboard when filters are active, otherwise use main data
  const dashboardSource = hasActiveFilters ? unfilteredData : data

  // Extract current cycle months for the dashboard
  const { currentCycleMonths, cycleRangeLabel } = useMemo(() => {
    if (!dashboardSource) return { currentCycleMonths: [], cycleRangeLabel: "" }

    const cycleIdx = dashboardSource.currentCycleIndex
    const monthsInCycle = dashboardSource.months.filter(
      (m: ComputedMonth) => m.cycleIndex === cycleIdx,
    )

    return {
      currentCycleMonths: monthsInCycle,
      cycleRangeLabel: getCycleRangeLabel(monthsInCycle),
    }
  }, [dashboardSource])

  // For each month row in the filtered list, compute cycle-level info for settlement blocks
  const cycleWorkedMap = useMemo(() => {
    if (!dashboardSource) return new Map<number, { worked: number; pool: number; label: string }>()

    const map = new Map<number, { worked: number; pool: number; label: string }>()
    const byCycle = new Map<number, ComputedMonth[]>()

    for (const m of dashboardSource.months) {
      const list = byCycle.get(m.cycleIndex) ?? []
      list.push(m)
      byCycle.set(m.cycleIndex, list)
    }

    for (const [idx, months] of byCycle) {
      const totalWorked = months.reduce((sum, m) => sum + m.workedMinutes, 0)
      const pool = (dashboardSource.config.includedMinutesPerMonth) * CYCLE_LENGTH
      map.set(idx, {
        worked: totalWorked,
        pool,
        label: getCycleRangeLabel(months),
      })
    }

    return map
  }, [dashboardSource])

  // Derive display values — all hooks must run before any early return
  const config = data?.config
  const filteredMonths = data?.months
  const displayMonths = useMemo(
    () => (filteredMonths ? [...filteredMonths].reverse() : []),
    [filteredMonths],
  )
  const budgetHours = config ? minutesToHours(config.includedMinutesPerMonth) : 0

  // Loading state
  if (!data || !config) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl space-y-5">
      {/* ─── Cycle dashboard (current cycle, always unfiltered) ─── */}
      {currentCycleMonths.length > 0 && (
        <RetainerCycleDashboard
          cycleMonths={currentCycleMonths}
          budgetMinutes={config.includedMinutesPerMonth}
          rolloverEnabled={config.rolloverEnabled}
          cycleRangeLabel={cycleRangeLabel}
          isAdmin={isAdmin}
          overageRate={config.overageRate}
          currency={config.currency}
          budgetHoursPerMonth={budgetHours}
        />
      )}

      {/* ─── Filter bar ─── */}
      <RetainerFilterBar
        categories={data.categories}
        startDate={config.startDate}
        rolloverEnabled={config.rolloverEnabled}
        filters={filters}
        onFiltersChange={setFilters}
      />

      {/* ─── Month list (newest first) ─── */}
      {displayMonths.length > 0 ? (
        <div className="rounded-lg border">
          {displayMonths.map((month, i) => {
            const cycleInfo = cycleWorkedMap.get(month.cycleIndex)
            // Show cycle divider when this month starts a new cycle vs the previous row
            const prevMonth = i > 0 ? displayMonths[i - 1] : null
            const showCycleDivider =
              config.rolloverEnabled && prevMonth && prevMonth.cycleIndex !== month.cycleIndex
            const prevCycleLabel = prevMonth
              ? cycleWorkedMap.get(prevMonth.cycleIndex)?.label
              : undefined

            return (
              <div key={month.yearMonth}>
                {showCycleDivider && prevCycleLabel && (
                  <div className="flex items-center gap-3 border-b bg-muted/30 px-4 py-1.5">
                    <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">
                      {prevCycleLabel}
                    </span>
                  </div>
                )}
                <RetainerMonthRow
                  month={month}
                  rolloverEnabled={config.rolloverEnabled}
                  budgetMinutes={config.includedMinutesPerMonth}
                  overageRate={config.overageRate}
                  currency={config.currency}
                  cycleWorkedMinutes={cycleInfo?.worked}
                  cyclePoolMinutes={cycleInfo?.pool}
                  cycleRangeLabel={cycleInfo?.label}
                  defaultOpen={i === 0}
                  isAdmin={isAdmin}
                />
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border py-12 text-center">
          <p className="text-muted-foreground text-sm">
            No time entries found for this period.
          </p>
        </div>
      )}
    </div>
  )
}
