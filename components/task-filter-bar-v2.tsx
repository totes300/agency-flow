"use client"

import { useRef, useEffect } from "react"
import { StatusIcon } from "@/components/icons/status-icons"
import { UiIcon } from "@/components/icons/ui-icons"
import {
  STATUS_CONFIG,
  STATUS_ORDER,
  DATE_PRESETS,
  DATE_OPERATORS,
  FILTER_DEFS,
  type TaskStatusKey,
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
  onAddFilter: (property: string) => void
  onUpdateFilter: (id: string, updates: Partial<Filter>) => void
  onRemoveFilter: (id: string) => void
  onClearFilters: () => void
  onToggleFilterValue: (id: string, val: string) => void
  onToggleFilterMode: () => void
}

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

  // Dynamic values for filters
  const allClients = [...new Set(tasks.map((t) => t.clientName).filter(Boolean) as string[])]
  const allAssignees = [...new Set(tasks.flatMap((t) => t.assignees?.map((a: any) => a?.name).filter(Boolean) ?? []))]
  const allCategories = [...new Set(tasks.map((t) => t.workCategoryName).filter(Boolean) as string[])]

  const getFilterValues = (property: string) => {
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
  }

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
  const tabs: Array<{ key: ActiveTab; label: string; count: number }> = [
    { key: "active", label: "Active", count: activeCount },
    { key: "all", label: "All", count: totalCount },
    ...STATUS_ORDER.map((s) => ({
      key: s as ActiveTab,
      label: STATUS_CONFIG[s].label,
      count: statusCounts[s] || 0,
    })),
  ]

  return (
    <>
      {/* Tabs row */}
      <div className="px-3 md:px-5 pt-2 pb-0 bg-white border-b border-[#e5e7eb] flex items-end justify-between gap-2">
        <div className="flex items-end gap-0 overflow-x-auto scrollbar-none">
          {tabs.map((tab) => {
            const isAct = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => onSetActiveTab(tab.key)}
                className="flex items-center gap-[5px] px-3 py-2 border-b-2 text-[12.5px] cursor-pointer bg-transparent border-none font-inherit whitespace-nowrap"
                style={{
                  borderBottomColor: isAct ? "#111827" : "transparent",
                  color: isAct ? "#111827" : "#6b7280",
                  fontWeight: isAct ? 600 : 450,
                }}
              >
                {tab.label}
                <span
                  className="text-[10.5px] font-semibold rounded-[10px] px-1.5 leading-4 min-w-[18px] text-center"
                  style={{
                    background: isAct ? "#111827" : "#e5e7eb",
                    color: isAct ? "#fff" : "#6b7280",
                  }}
                >
                  {tab.count}
                </span>
              </button>
            )
          })}
          {/* Filter button */}
          <button
            onClick={() => {
              onSetFilterMenuOpen(!filterMenuOpen)
              onSetFilterEditId(null)
            }}
            className="inline-flex items-center gap-1 text-[11.5px] font-medium rounded-[5px] px-[9px] py-[3px] ml-1.5 mb-[7px] cursor-pointer font-inherit transition-all duration-[120ms]"
            style={{
              color: filters.length > 0 ? "#374151" : "#9ca3af",
              border: filters.length > 0 ? "1px solid #9ca3af" : "1px dashed #d1d5db",
              background: filters.length > 0 ? "#f6f7f8" : "transparent",
            }}
          >
            <UiIcon type="filter" size={11} />
            Filter{filters.length > 0 && ` \u00b7 ${filters.length}`}
          </button>
        </div>

        {/* Grouping */}
        <div className="hidden md:flex items-center gap-[1px] bg-[#f3f4f6] rounded-[7px] p-0.5 mb-1.5 shrink-0">
          {([
            { v: "none" as GroupByV2, l: "List" },
            { v: "client" as GroupByV2, l: "Client" },
            { v: "status" as GroupByV2, l: "Status" },
            { v: "category" as GroupByV2, l: "Type" },
          ]).map((g) => (
            <button
              key={g.v}
              onClick={() => onSetGroupBy(g.v)}
              className="px-2.5 py-1 rounded-[5px] border-none text-xs font-[550] cursor-pointer font-inherit"
              style={{
                background: groupBy === g.v ? "#fff" : "transparent",
                boxShadow: groupBy === g.v ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                color: groupBy === g.v ? "#111827" : "#6b7280",
              }}
            >
              {g.l}
            </button>
          ))}
        </div>
      </div>

      {/* Filter bar */}
      {(filters.length > 0 || filterMenuOpen) && (
        <div
          ref={filterMenuRef}
          className="px-5 py-1.5 bg-[#fafbfc] border-b border-[#e5e7eb] flex items-center gap-1.5 flex-wrap min-h-9"
          style={{ animation: "filterSlideIn 0.15s ease" }}
        >
          {/* Active filter pills */}
          {filters.map((f, i) => {
            const def = FILTER_DEFS.find((d) => d.property === f.property)
            if (!def) return null
            const isEditing = filterEditId === f.id
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
                    onClick={onToggleFilterMode}
                    className="text-[11px] text-[#9ca3af] font-medium border-none bg-transparent cursor-pointer font-inherit px-0.5 hover:text-[#374151]"
                  >
                    {filterMode === "all" ? "and" : "or"}
                  </button>
                )}
                <div className="inline-flex items-center relative">
                  <div
                    className="inline-flex items-center gap-0 text-xs rounded-[6px] bg-white overflow-hidden transition-all duration-[120ms]"
                    style={{
                      border: isEditing ? "1px solid #9ca3af" : "1px solid #e0e2e5",
                      boxShadow: isEditing ? "0 0 0 2px rgba(156,163,175,0.1)" : "none",
                    }}
                  >
                    <span className="py-[3px] px-1.5 pl-2 text-[#6b7280] font-medium border-r border-[#f0f0f0]">
                      {def.label}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (isDate) {
                          const ops = DATE_OPERATORS
                          const idx = ops.indexOf(f.operator as any)
                          onUpdateFilter(f.id, { operator: ops[(idx + 1) % ops.length] })
                        } else {
                          onUpdateFilter(f.id, { operator: f.operator === "is" ? "is not" : "is" })
                        }
                      }}
                      className="py-[3px] px-1.5 text-[#9ca3af] font-medium border-none bg-transparent cursor-pointer font-inherit text-xs border-r border-[#f0f0f0]"
                      style={{ borderRight: "1px solid #f0f0f0" }}
                    >
                      {f.operator}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onSetFilterEditId(isEditing ? null : f.id)
                      }}
                      className="py-[3px] px-2 font-[550] border-none bg-transparent cursor-pointer font-inherit text-xs"
                      style={{ color: f.values.length > 0 ? "#111827" : "#9ca3af" }}
                    >
                      {f.values.length > 0 ? valueLabels.join(", ") : "select\u2026"}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onRemoveFilter(f.id)
                      }}
                      className="py-[3px] px-1.5 text-[#c2c7ce] border-none bg-transparent cursor-pointer flex items-center hover:text-[#6b7280]"
                    >
                      <UiIcon type="x" size={10} />
                    </button>
                  </div>

                  {/* Dropdown */}
                  {isEditing && (
                    <div
                      className="absolute top-full left-0 mt-1 z-[300] bg-white border border-[#e5e7eb] rounded-[10px] shadow-[0_8px_24px_rgba(0,0,0,0.12)] p-1 min-w-[180px]"
                      style={{ animation: "popIn 0.12s ease" }}
                    >
                      {isDate
                        ? filterValues.map((v) => {
                            const selected = f.values[0] === v.key
                            return (
                              <div
                                key={v.key}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onToggleFilterValue(f.id, v.key)
                                }}
                                className="flex items-center gap-2 py-1.5 px-2.5 rounded-[6px] cursor-pointer text-[12.5px]"
                                style={{
                                  fontWeight: selected ? 600 : 450,
                                  color: selected ? "#111827" : "#4b5563",
                                  background: selected ? "#f3f4f6" : "transparent",
                                }}
                              >
                                <span
                                  className="w-3.5 h-3.5 rounded-full shrink-0"
                                  style={{
                                    border: selected ? "4px solid #111827" : "1.5px solid #d1d5db",
                                    background: "#fff",
                                    boxSizing: "border-box",
                                  }}
                                />
                                {v.label}
                              </div>
                            )
                          })
                        : filterValues.map((v) => {
                            const selected = f.values.includes(v.key)
                            return (
                              <div
                                key={v.key}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onToggleFilterValue(f.id, v.key)
                                }}
                                className="flex items-center gap-2 py-1.5 px-2.5 rounded-[6px] cursor-pointer text-[12.5px] hover:bg-[#f8f9fb]"
                                style={{
                                  fontWeight: selected ? 600 : 450,
                                  color: selected ? "#111827" : "#4b5563",
                                  background: selected ? "#f3f4f6" : undefined,
                                }}
                              >
                                <span
                                  className="w-3.5 h-3.5 rounded-[3px] shrink-0 flex items-center justify-center"
                                  style={{
                                    border: selected ? "none" : "1.5px solid #d1d5db",
                                    background: selected ? "#111827" : "transparent",
                                  }}
                                >
                                  {selected && (
                                    <svg width="9" height="9" viewBox="0 0 16 16" fill="none">
                                      <path d="M4 8.5L7 11.5L12 5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  )}
                                </span>
                                {f.property === "status" && <StatusIcon status={v.key} size={14} />}
                                {v.label}
                              </div>
                            )
                          })}
                    </div>
                  )}
                </div>
              </span>
            )
          })}

          {/* Quick-add chips for unused properties */}
          <div className="flex items-center gap-1">
            {FILTER_DEFS.filter((def) => !filters.some((f) => f.property === def.property)).map((def) => (
              <button
                key={def.property}
                onClick={() => onAddFilter(def.property)}
                className="text-[11.5px] font-medium text-[#9ca3af] border border-dashed border-[#d9dce0] rounded-[5px] px-2 py-[2px] bg-transparent cursor-pointer font-inherit transition-all duration-100 hover:text-[#374151] hover:border-[#9ca3af]"
              >
                {def.label}
              </button>
            ))}
            {filters.length > 0 && (
              <button
                onClick={onClearFilters}
                className="text-[11px] text-[#c2c7ce] border-none bg-transparent cursor-pointer font-inherit font-medium px-1.5 py-[2px] hover:text-[#6b7280]"
              >
                Clear all
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
