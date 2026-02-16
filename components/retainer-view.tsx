"use client"

import { useState, useMemo } from "react"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
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
import { formatCurrency } from "@/lib/format"
import { SettingsIcon } from "lucide-react"

interface RetainerViewProps {
  projectId: Id<"projects">
  currency: string
  isAdmin: boolean
}

/** Format a cycle range label like "Apr – Jun 2025" from an array of months. */
function getCycleRangeLabel(months: ComputedMonth[]): string {
  if (months.length === 0) return ""
  const first = months[0]
  const last = months[months.length - 1]
  const [fy, fm] = first.yearMonth.split("-").map(Number)
  const [ly, lm] = last.yearMonth.split("-").map(Number)
  const firstName = new Date(fy, fm - 1, 1).toLocaleString("en-US", {
    month: "short",
  })
  const lastName = new Date(ly, lm - 1, 1).toLocaleString("en-US", {
    month: "short",
  })
  const year = ly
  return months.length === 1
    ? `${firstName} ${year}`
    : `${firstName} – ${lastName} ${year}`
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

  // Loading state
  if (!data) {
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

  const {
    config,
    months: filteredMonths,
  } = data

  const budgetHours = minutesToHours(config.includedMinutesPerMonth)
  const displayMonths = [...filteredMonths].reverse() // newest first

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* ─── Header: config summary + rollover mode ─── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm tabular-nums">
            {budgetHours}h/month
            {isAdmin && config.overageRate ? (
              <>
                {" · "}
                {formatCurrency(config.overageRate, config.currency)}/h
              </>
            ) : null}
            {config.rolloverEnabled ? " · 3-month cycles" : ""}
          </span>
        </div>
        <Badge
          variant="outline"
          className="gap-1 text-xs"
        >
          <SettingsIcon className="size-3" />
          {config.rolloverEnabled ? "Rollover enabled" : "Monthly settlement"}
        </Badge>
      </div>

      {/* ─── Filter bar ─── */}
      <RetainerFilterBar
        categories={data.categories}
        startDate={config.startDate}
        rolloverEnabled={config.rolloverEnabled}
        filters={filters}
        onFiltersChange={setFilters}
      />

      {/* ─── Cycle dashboard (current cycle, always unfiltered) ─── */}
      {currentCycleMonths.length > 0 && (
        <RetainerCycleDashboard
          cycleMonths={currentCycleMonths}
          budgetMinutes={config.includedMinutesPerMonth}
          rolloverEnabled={config.rolloverEnabled}
          cycleRangeLabel={cycleRangeLabel}
        />
      )}

      {/* ─── Month list (newest first) ─── */}
      {displayMonths.length > 0 ? (
        <div className="rounded-lg border">
          {displayMonths.map((month, i) => {
            const cycleInfo = cycleWorkedMap.get(month.cycleIndex)
            return (
              <RetainerMonthRow
                key={month.yearMonth}
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

      {/* ─── Footer: config summary ─── */}
      <div className="text-muted-foreground border-t pt-3 text-center text-xs">
        <span className="tabular-nums">
          {budgetHours}h included per month
          {config.rolloverEnabled
            ? ` · Unused hours roll over within ${CYCLE_LENGTH}-month cycles`
            : " · Each month settles independently"}
          {isAdmin && config.overageRate
            ? ` · Overage rate: ${formatCurrency(config.overageRate, config.currency)}/h`
            : ""}
        </span>
      </div>
    </div>
  )
}
