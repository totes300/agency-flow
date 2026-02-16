"use client"

import { useState, useMemo, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { T } from "@/lib/retainer-strings"
import {
  getCycleInfo,
  CYCLE_LENGTH,
  getCurrentYearMonth,
} from "@/convex/lib/retainerCompute"
import { CalendarIcon, XIcon, FilterIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { DateRange } from "react-day-picker"

// ── Types ─────────────────────────────────────────────────────────────

export type DateRangePreset =
  | "all"
  | "this-cycle"
  | "last-cycle"
  | "last-6-months"
  | "this-year"
  | "custom"

export interface FilterCategory {
  _id: string
  name: string
}

export interface RetainerFilterState {
  dateRangeStart?: string // YYYY-MM
  dateRangeEnd?: string // YYYY-MM
  categoryFilter?: string[] // workCategoryId[]
}

interface RetainerFilterBarProps {
  /** Available categories for the multi-select */
  categories: FilterCategory[]
  /** Project start date (YYYY-MM-DD) for cycle calculations */
  startDate: string
  /** Whether rollover is enabled (affects cycle-based presets) */
  rolloverEnabled: boolean
  /** Current filter state */
  filters: RetainerFilterState
  /** Callback when filters change */
  onFiltersChange: (filters: RetainerFilterState) => void
}

// ── Preset date range computation ─────────────────────────────────────

function computePresetRange(
  preset: DateRangePreset,
  startDate: string,
  rolloverEnabled: boolean,
): { start?: string; end?: string } {
  if (preset === "all") return {}

  const currentYm = getCurrentYearMonth()
  const [cy, cm] = currentYm.split("-").map(Number)

  if (preset === "this-year") {
    return { start: `${cy}-01`, end: `${cy}-12` }
  }

  if (preset === "last-6-months") {
    let startMonth = cm - 5
    let startYear = cy
    if (startMonth <= 0) {
      startMonth += 12
      startYear--
    }
    return {
      start: `${startYear}-${String(startMonth).padStart(2, "0")}`,
      end: currentYm,
    }
  }

  if (preset === "this-cycle" || preset === "last-cycle") {
    if (!rolloverEnabled) {
      // No rollover → "this cycle" = this month, "last cycle" = last month
      if (preset === "this-cycle") {
        return { start: currentYm, end: currentYm }
      }
      let lm = cm - 1
      let ly = cy
      if (lm <= 0) {
        lm = 12
        ly--
      }
      const lastYm = `${ly}-${String(lm).padStart(2, "0")}`
      return { start: lastYm, end: lastYm }
    }

    // Rollover enabled → compute cycle boundaries
    const cycleInfo = getCycleInfo(currentYm, startDate)
    const cycleStartOffset = -(cycleInfo.monthInCycle - 1)

    if (preset === "this-cycle") {
      // Find first month of current cycle
      let sm = cm + cycleStartOffset
      let sy = cy
      while (sm <= 0) {
        sm += 12
        sy--
      }
      const cycleStartYm = `${sy}-${String(sm).padStart(2, "0")}`
      // Extend to full cycle end
      let em = sm + CYCLE_LENGTH - 1
      let ey = sy
      while (em > 12) {
        em -= 12
        ey++
      }
      const cycleEndYm = `${ey}-${String(em).padStart(2, "0")}`
      return { start: cycleStartYm, end: cycleEndYm }
    }

    // last-cycle: go back one full cycle
    let prevCycleEndMonth = cm + cycleStartOffset - 1
    let prevCycleEndYear = cy
    while (prevCycleEndMonth <= 0) {
      prevCycleEndMonth += 12
      prevCycleEndYear--
    }
    let prevCycleStartMonth = prevCycleEndMonth - CYCLE_LENGTH + 1
    let prevCycleStartYear = prevCycleEndYear
    while (prevCycleStartMonth <= 0) {
      prevCycleStartMonth += 12
      prevCycleStartYear--
    }
    return {
      start: `${prevCycleStartYear}-${String(prevCycleStartMonth).padStart(2, "0")}`,
      end: `${prevCycleEndYear}-${String(prevCycleEndMonth).padStart(2, "0")}`,
    }
  }

  return {}
}

// ── Component ─────────────────────────────────────────────────────────

export function RetainerFilterBar({
  categories,
  startDate,
  rolloverEnabled,
  filters,
  onFiltersChange,
}: RetainerFilterBarProps) {
  const [preset, setPreset] = useState<DateRangePreset>("all")
  const [customRange, setCustomRange] = useState<DateRange | undefined>()
  const [customOpen, setCustomOpen] = useState(false)
  const [categoryOpen, setCategoryOpen] = useState(false)

  // Stable ref for filters — avoids recreating callbacks on every filter change
  const filtersRef = useRef(filters)
  filtersRef.current = filters

  // Active filter count
  const activeCount = useMemo(() => {
    let count = 0
    if (filters.dateRangeStart || filters.dateRangeEnd) count++
    if (filters.categoryFilter?.length) count++
    return count
  }, [filters])

  // ── Date range preset handler ──

  const handlePresetChange = useCallback(
    (value: string) => {
      const p = value as DateRangePreset
      setPreset(p)

      if (p === "custom") {
        setCustomOpen(true)
        return
      }

      const { start, end } = computePresetRange(p, startDate, rolloverEnabled)
      onFiltersChange({
        ...filtersRef.current,
        dateRangeStart: start,
        dateRangeEnd: end,
      })
    },
    [startDate, rolloverEnabled, onFiltersChange],
  )

  // ── Custom date range handler ──

  const handleCustomRangeSelect = useCallback(
    (range: DateRange | undefined) => {
      setCustomRange(range)
      if (range?.from) {
        const fromYm = `${range.from.getFullYear()}-${String(range.from.getMonth() + 1).padStart(2, "0")}`
        const toYm = range.to
          ? `${range.to.getFullYear()}-${String(range.to.getMonth() + 1).padStart(2, "0")}`
          : fromYm

        onFiltersChange({
          ...filtersRef.current,
          dateRangeStart: fromYm,
          dateRangeEnd: toYm,
        })
      }
    },
    [onFiltersChange],
  )

  // ── Category toggle handler ──

  const handleCategoryToggle = useCallback(
    (categoryId: string, checked: boolean) => {
      const current = filtersRef.current.categoryFilter ?? []
      const next = checked
        ? [...current, categoryId]
        : current.filter((id) => id !== categoryId)

      onFiltersChange({
        ...filtersRef.current,
        categoryFilter: next.length > 0 ? next : undefined,
      })
    },
    [onFiltersChange],
  )

  // ── Clear all ──

  const handleClear = useCallback(() => {
    setPreset("all")
    setCustomRange(undefined)
    onFiltersChange({})
  }, [onFiltersChange])

  // Preset label map
  const presetLabels: Record<DateRangePreset, string> = {
    all: T.allTime,
    "this-cycle": rolloverEnabled ? T.thisCycle : T.thisMonth,
    "last-cycle": rolloverEnabled ? T.lastCycle : T.lastMonth,
    "last-6-months": T.last6Months,
    "this-year": T.thisYear,
    custom: T.custom,
  }

  // Selected category count label
  const categoryLabel = filters.categoryFilter?.length
    ? `${filters.categoryFilter.length} categor${filters.categoryFilter.length === 1 ? "y" : "ies"}`
    : T.allCategories

  return (
    <div className="flex items-center gap-2">
      <FilterIcon className="text-muted-foreground size-3.5" />

      {/* ─── Date range select ─── */}
      <Select value={preset} onValueChange={handlePresetChange}>
        <SelectTrigger className="h-8 w-auto min-w-[140px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{presetLabels.all}</SelectItem>
          <SelectItem value="this-cycle">
            {presetLabels["this-cycle"]}
          </SelectItem>
          <SelectItem value="last-cycle">
            {presetLabels["last-cycle"]}
          </SelectItem>
          <SelectItem value="last-6-months">
            {presetLabels["last-6-months"]}
          </SelectItem>
          <SelectItem value="this-year">{presetLabels["this-year"]}</SelectItem>
          <SelectItem value="custom">{presetLabels.custom}</SelectItem>
        </SelectContent>
      </Select>

      {/* Custom date range popover */}
      {preset === "custom" && (
        <Popover open={customOpen} onOpenChange={setCustomOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
            >
              <CalendarIcon className="size-3.5" />
              {customRange?.from
                ? `${customRange.from.toLocaleDateString("en-US", { month: "short", year: "numeric" })}${customRange.to ? ` – ${customRange.to.toLocaleDateString("en-US", { month: "short", year: "numeric" })}` : ""}`
                : T.pickDates}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={customRange}
              onSelect={handleCustomRangeSelect}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      )}

      {/* ─── Category multi-select ─── */}
      {categories.length > 0 && (
        <Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-8 gap-1.5 text-xs",
                filters.categoryFilter?.length && "border-primary/30",
              )}
            >
              {categoryLabel}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-52 p-2" align="start">
            <div className="flex flex-col gap-1">
              {categories.map((cat) => {
                const checked =
                  filters.categoryFilter?.includes(cat._id) ?? false
                return (
                  <label
                    key={cat._id}
                    className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) =>
                        handleCategoryToggle(cat._id, v === true)
                      }
                    />
                    <span className="flex-1 truncate">{cat.name}</span>
                  </label>
                )
              })}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* ─── Active filter count + clear ─── */}
      {activeCount > 0 && (
        <div className="flex items-center gap-1.5">
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
            {activeCount} active
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={handleClear}
            aria-label="Clear filters"
          >
            <XIcon className="size-3" />
          </Button>
        </div>
      )}
    </div>
  )
}
