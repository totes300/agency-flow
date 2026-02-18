"use client"

import { useRef, useEffect, useMemo, useCallback } from "react"
import { Filter as FilterIcon, X } from "lucide-react"
import { StatusIcon } from "@/components/icons/status-icons"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import {
  STATUS_CONFIG,
  STATUS_ORDER,
  DATE_PRESETS,
  DATE_OPERATORS,
  FILTER_DEFS,
  type TaskStatusKey,
  type FilterProperty,
  type DateOperator,
} from "@/lib/task-config"
import type { Filter, FilterMode, ActiveTab, GroupByV2 } from "@/hooks/use-task-filters-v2"
import type { EnrichedTask } from "@/lib/types"

// ── Types ───────────────────────────────────────────────────────────────

interface FilterBarProps {
  filters: Filter[]
  filterMode: FilterMode
  activeTab: ActiveTab
  groupBy: GroupByV2
  filterMenuOpen: boolean
  filterEditId: string | null
  tasks: EnrichedTask[] // for dynamic values
  statusCounts: Record<string, number>
  totalCount: number
  activeCount: number
  onSetActiveTab: (tab: ActiveTab) => void
  onSetGroupBy: (g: GroupByV2) => void
  onSetFilterMenuOpen: (open: boolean) => void
  onSetFilterEditId: (id: string | null) => void
  onAddFilter: (property: FilterProperty) => void
  onUpdateFilter: (id: string, updates: Partial<Filter>) => void
  onRemoveFilter: (id: string) => void
  onClearFilters: () => void
  onToggleFilterValue: (id: string, val: string) => void
  onToggleFilterMode: () => void
}

// ── Grouping options ────────────────────────────────────────────────────

const GROUPING_OPTIONS: readonly { v: GroupByV2; l: string }[] = [
  { v: "none", l: "List" },
  { v: "client", l: "Client" },
  { v: "status", l: "Status" },
  { v: "category", l: "Type" },
] as const

// ── Component ───────────────────────────────────────────────────────────

export function TaskFilterBarV2({
  filters,
  filterMode,
  activeTab,
  groupBy,
  filterMenuOpen,
  filterEditId,
  tasks,
  statusCounts,
  totalCount,
  activeCount,
  onSetActiveTab,
  onSetGroupBy,
  onSetFilterMenuOpen,
  onSetFilterEditId,
  onAddFilter,
  onUpdateFilter,
  onRemoveFilter,
  onClearFilters,
  onToggleFilterValue,
  onToggleFilterMode,
}: FilterBarProps) {
  const filterMenuRef = useRef<HTMLDivElement>(null)

  // Memoize dynamic filter values
  const allClients = useMemo(
    () => [...new Set(tasks.map((t) => t.clientName).filter(Boolean) as string[])],
    [tasks],
  )
  const allAssignees = useMemo(
    () => [...new Set(tasks.flatMap((t) => t.assignees?.map((a) => a.name).filter(Boolean) ?? []))],
    [tasks],
  )
  const allCategories = useMemo(
    () => [...new Set(tasks.map((t) => t.workCategoryName).filter(Boolean) as string[])],
    [tasks],
  )

  const getFilterValues = useCallback((property: FilterProperty) => {
    switch (property) {
      case "status":
        return STATUS_ORDER.map((s) => ({ key: s, label: STATUS_CONFIG[s].label }))
      case "assignee":
        return allAssignees.map((a) => ({ key: a, label: a }))
      case "client":
        return allClients.map((c) => ({ key: c, label: c }))
      case "category":
        return allCategories.map((c) => ({ key: c, label: c }))
      case "dueDate":
      case "createdAt":
      case "lastEditedAt":
        return DATE_PRESETS.map((p) => ({ key: p.key, label: p.label }))
      default:
        return []
    }
  }, [allAssignees, allClients, allCategories])

  // Close filter menus on outside click
  useEffect(() => {
    if (!filterMenuOpen && !filterEditId) return
    const fn = (e: MouseEvent) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) {
        onSetFilterEditId(null)
        if (filters.length === 0) onSetFilterMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", fn)
    return () => document.removeEventListener("mousedown", fn)
  }, [filterMenuOpen, filterEditId, filters.length, onSetFilterEditId, onSetFilterMenuOpen])

  // Tabs
  const tabs = useMemo<Array<{ key: ActiveTab; label: string; count: number }>>(
    () => [
      { key: "active", label: "Active", count: activeCount },
      { key: "all", label: "All", count: totalCount },
      ...STATUS_ORDER.map((s) => ({
        key: s as ActiveTab,
        label: STATUS_CONFIG[s].label,
        count: statusCounts[s] || 0,
      })),
    ],
    [activeCount, totalCount, statusCounts],
  )

  return (
    <>
      {/* Tabs row */}
      <div className="px-4 pt-2 pb-0 bg-background border-b border-task-border flex items-end justify-between gap-2">
        <Tabs value={activeTab} onValueChange={(v) => onSetActiveTab(v as ActiveTab)} className="flex-row gap-0">
          <TabsList variant="line" className="h-auto gap-0 overflow-x-auto scrollbar-none">
            {tabs.map((tab) => {
              const isAct = activeTab === tab.key
              return (
                <TabsTrigger
                  key={tab.key}
                  value={tab.key}
                  className="gap-1.5 px-3 py-2 text-xs rounded-none whitespace-nowrap"
                >
                  {tab.label}
                  <Badge
                    variant={isAct ? "default" : "secondary"}
                    className={cn(
                      "h-4 min-w-[18px] px-1.5 text-[10px] font-semibold rounded-full",
                      isAct
                        ? "bg-task-foreground text-white"
                        : "bg-task-border text-task-muted",
                    )}
                  >
                    {tab.count}
                  </Badge>
                </TabsTrigger>
              )
            })}
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2 mb-1.5 shrink-0">
          {/* Filter button */}
          <Button
            variant={filters.length > 0 ? "outline" : "ghost"}
            size="xs"
            onClick={() => {
              onSetFilterMenuOpen(!filterMenuOpen)
              onSetFilterEditId(null)
            }}
            className={cn(
              "text-xs font-medium",
              filters.length > 0
                ? "text-task-foreground-secondary border-task-muted-light bg-task-surface-subtle"
                : "text-task-muted-light border-dashed border-task-separator",
            )}
          >
            <FilterIcon size={11} />
            Filter{filters.length > 0 && ` \u00b7 ${filters.length}`}
          </Button>

          {/* Grouping */}
          <ToggleGroup
            type="single"
            value={groupBy}
            onValueChange={(v) => { if (v) onSetGroupBy(v as GroupByV2) }}
            className="hidden md:flex bg-task-surface rounded-md p-0.5"
          >
            {GROUPING_OPTIONS.map((g) => (
              <ToggleGroupItem
                key={g.v}
                value={g.v}
                className={cn(
                  "px-2.5 py-1 rounded text-xs font-medium h-auto",
                  groupBy === g.v
                    ? "bg-background text-task-foreground shadow-sm data-[state=on]:bg-background"
                    : "bg-transparent text-task-muted data-[state=off]:bg-transparent",
                )}
              >
                {g.l}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>

      {/* Filter bar */}
      {(filters.length > 0 || filterMenuOpen) && (
        <div
          ref={filterMenuRef}
          className="px-4 py-1.5 bg-task-surface-subtle border-b border-task-border flex items-center gap-1.5 flex-wrap min-h-9 animate-[filterSlideIn_0.15s_ease]"
        >
          {/* Active filter pills */}
          {filters.map((f, i) => {
            const def = FILTER_DEFS.find((d) => d.property === f.property)
            if (!def) return null
            const filterValues = getFilterValues(f.property)
            const valueLabels = f.values.map((v) => {
              const found = filterValues.find((dv) => dv.key === v)
              return found ? found.label : v
            })
            const isDate = def.type === "date"

            return (
              <span key={f.id} className="inline-flex items-center gap-1.5">
                {i > 0 && (
                  <button
                    type="button"
                    onClick={onToggleFilterMode}
                    aria-label={`Toggle filter combination mode. Currently matching ${filterMode === "all" ? "all" : "any"} filters`}
                    className="text-[11px] text-task-muted-light font-medium border-none bg-transparent cursor-pointer font-inherit px-0.5 hover:text-task-foreground-secondary"
                  >
                    {filterMode === "all" ? "and" : "or"}
                  </button>
                )}
                <div className="inline-flex items-center relative">
                  <div
                    className={cn(
                      "inline-flex items-center gap-0 text-xs rounded-md bg-background overflow-hidden transition-all duration-[120ms]",
                      filterEditId === f.id
                        ? "border border-task-muted-light shadow-[0_0_0_2px_rgba(156,163,175,0.1)]"
                        : "border border-task-border",
                    )}
                  >
                    <span className="py-[3px] px-1.5 pl-2 text-task-muted font-medium border-r border-task-border-light">
                      {def.label}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (isDate) {
                          const ops = DATE_OPERATORS
                          const idx = ops.indexOf(f.operator as DateOperator)
                          const nextIdx = idx === -1 ? 0 : (idx + 1) % ops.length
                          onUpdateFilter(f.id, { operator: ops[nextIdx] })
                        } else {
                          onUpdateFilter(f.id, { operator: f.operator === "is" ? "is not" : "is" })
                        }
                      }}
                      className="py-[3px] px-1.5 text-task-muted-light font-medium border-none bg-transparent cursor-pointer font-inherit text-xs"
                    >
                      {f.operator}
                    </button>

                    {/* Value selector popover */}
                    <Popover
                      open={filterEditId === f.id}
                      onOpenChange={(open) => onSetFilterEditId(open ? f.id : null)}
                    >
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className={cn(
                            "py-[3px] px-2 font-medium border-none bg-transparent cursor-pointer font-inherit text-xs",
                            f.values.length > 0 ? "text-task-foreground" : "text-task-muted-light",
                          )}
                        >
                          {f.values.length > 0 ? valueLabels.join(", ") : "select\u2026"}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="start"
                        className="p-1 min-w-[180px]"
                        onOpenAutoFocus={(e) => e.preventDefault()}
                      >
                        {isDate ? (
                          <div role="listbox" aria-label={`${def.label} options`}>
                            {filterValues.map((v) => {
                              const selected = f.values[0] === v.key
                              return (
                                <button
                                  key={v.key}
                                  type="button"
                                  role="option"
                                  aria-selected={selected}
                                  onClick={() => onToggleFilterValue(f.id, v.key)}
                                  className={cn(
                                    "flex w-full items-center gap-2 py-1.5 px-2.5 rounded-md cursor-pointer text-xs text-left",
                                    selected
                                      ? "font-semibold text-task-foreground bg-task-surface"
                                      : "font-normal text-task-foreground-tertiary hover:bg-task-surface-hover",
                                  )}
                                >
                                  <span
                                    className="w-3.5 h-3.5 rounded-full shrink-0 border-task-separator bg-background box-border"
                                    style={{
                                      border: selected ? "4px solid var(--task-foreground)" : "1.5px solid var(--task-separator)",
                                    }}
                                  />
                                  {v.label}
                                </button>
                              )
                            })}
                          </div>
                        ) : (
                          <div role="listbox" aria-label={`${def.label} options`}>
                            {filterValues.length === 0 && (
                              <div className="py-2 px-3 text-xs text-task-muted-light">No options available</div>
                            )}
                            {filterValues.map((v) => {
                              const selected = f.values.includes(v.key)
                              return (
                                <button
                                  key={v.key}
                                  type="button"
                                  role="option"
                                  aria-selected={selected}
                                  onClick={() => onToggleFilterValue(f.id, v.key)}
                                  className={cn(
                                    "flex w-full items-center gap-2 py-1.5 px-2.5 rounded-md cursor-pointer text-xs text-left hover:bg-task-surface-hover",
                                    selected
                                      ? "font-semibold text-task-foreground bg-task-surface"
                                      : "font-normal text-task-foreground-tertiary",
                                  )}
                                >
                                  <Checkbox
                                    checked={selected}
                                    className="size-3.5 rounded border-task-separator data-checked:bg-task-foreground data-checked:border-task-foreground pointer-events-none"
                                    tabIndex={-1}
                                  />
                                  {f.property === "status" && <StatusIcon status={v.key} size={14} />}
                                  {v.label}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </PopoverContent>
                    </Popover>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onRemoveFilter(f.id)
                      }}
                      aria-label={`Remove ${def.label} filter`}
                      className="py-[3px] px-1.5 text-task-muted-lightest border-none bg-transparent cursor-pointer flex items-center hover:text-task-muted"
                    >
                      <X size={10} />
                    </button>
                  </div>
                </div>
              </span>
            )
          })}

          {/* Quick-add chips for unused properties */}
          <div className="flex items-center gap-1">
            {FILTER_DEFS.filter((def) => !filters.some((f) => f.property === def.property)).map((def) => (
              <button
                key={def.property}
                type="button"
                onClick={() => onAddFilter(def.property)}
                aria-label={`Add ${def.label} filter`}
                className="text-xs font-medium text-task-muted-light border border-dashed border-task-separator rounded px-2 py-0.5 bg-transparent cursor-pointer font-inherit transition-all duration-100 hover:text-task-foreground-secondary hover:border-task-muted-light"
              >
                {def.label}
              </button>
            ))}
            {filters.length > 0 && (
              <Button
                variant="ghost"
                size="xs"
                onClick={onClearFilters}
                className="text-[11px] text-task-muted-lightest font-medium px-1.5 py-0.5 h-auto hover:text-task-muted"
              >
                Clear all
              </Button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
