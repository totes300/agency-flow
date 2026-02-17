"use client"

import { useState, useCallback, useMemo } from "react"
import {
  STATUS_CONFIG,
  STATUS_ORDER,
  DATE_PRESETS,
  DATE_OPERATORS,
  FILTER_DEFS,
  type TaskStatusKey,
  type DateOperator,
} from "@/lib/task-config"
import type { EnrichedTask } from "@/lib/types"

// ── Types ───────────────────────────────────────────────────────────────

export type Filter = {
  id: string
  property: string
  operator: "is" | "is not" | "before" | "after"
  values: string[]
}

export type FilterMode = "all" | "any"

export type ActiveTab = "active" | "all" | TaskStatusKey

export type GroupByV2 = "none" | "client" | "status" | "category"

export type TaskFilterStateV2 = {
  filters: Filter[]
  filterMode: FilterMode
  activeTab: ActiveTab
  groupBy: GroupByV2
  searchQuery: string
}

// ── Hook ────────────────────────────────────────────────────────────────

export function useTaskFiltersV2() {
  const [filters, setFilters] = useState<Filter[]>([])
  const [filterMode, setFilterMode] = useState<FilterMode>("all")
  const [activeTab, setActiveTab] = useState<ActiveTab>("active")
  const [groupBy, setGroupBy] = useState<GroupByV2>("none")
  const [searchQuery, setSearchQuery] = useState("")
  const [filterMenuOpen, setFilterMenuOpen] = useState(false)
  const [filterEditId, setFilterEditId] = useState<string | null>(null)

  const addFilter = useCallback((property: string) => {
    const id = String(Date.now())
    setFilters((prev) => [...prev, { id, property, operator: "is", values: [] }])
    setFilterEditId(id)
  }, [])

  const updateFilter = useCallback((id: string, updates: Partial<Filter>) => {
    setFilters((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)))
  }, [])

  const removeFilter = useCallback((id: string) => {
    setFilters((prev) => {
      const next = prev.filter((f) => f.id !== id)
      return next
    })
    setFilterEditId(null)
  }, [])

  const clearFilters = useCallback(() => {
    setFilters([])
    setFilterEditId(null)
    setFilterMenuOpen(false)
  }, [])

  const toggleFilterValue = useCallback((id: string, val: string) => {
    setFilters((prev) =>
      prev.map((f) => {
        if (f.id !== id) return f
        const def = FILTER_DEFS.find((d) => d.property === f.property)
        if (def?.type === "date") {
          // Single-select for dates
          return { ...f, values: f.values[0] === val ? [] : [val] }
        }
        // Multi-select for regular filters
        const values = f.values.includes(val) ? f.values.filter((v) => v !== val) : [...f.values, val]
        return { ...f, values }
      }),
    )
  }, [])

  const toggleFilterMode = useCallback(() => {
    setFilterMode((m) => (m === "all" ? "any" : "all"))
  }, [])

  return {
    filters,
    filterMode,
    activeTab,
    groupBy,
    searchQuery,
    filterMenuOpen,
    filterEditId,
    setActiveTab,
    setGroupBy,
    setSearchQuery,
    setFilterMenuOpen,
    setFilterEditId,
    addFilter,
    updateFilter,
    removeFilter,
    clearFilters,
    toggleFilterValue,
    toggleFilterMode,
  }
}

// ── Client-side filtering logic ─────────────────────────────────────────

export function applyFiltersAndSort(
  tasks: EnrichedTask[],
  state: {
    activeTab: ActiveTab
    searchQuery: string
    filters: Filter[]
    filterMode: FilterMode
    groupBy: GroupByV2
  },
): EnrichedTask[] {
  let filtered = [...tasks]

  // Tab filter
  if (state.activeTab === "active") {
    filtered = filtered.filter((t) => t.status !== "done")
  } else if (state.activeTab !== "all") {
    filtered = filtered.filter((t) => t.status === state.activeTab)
  }

  // Search
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase()
    filtered = filtered.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.clientName?.toLowerCase().includes(q) ?? false) ||
        (t.projectName?.toLowerCase().includes(q) ?? false) ||
        (t.workCategoryName?.toLowerCase().includes(q) ?? false),
    )
  }

  // Apply combined filters
  const activeFilters = state.filters.filter((f) => f.values.length > 0)
  if (activeFilters.length > 0) {
    filtered = filtered.filter((task) => {
      const results = activeFilters.map((f) => {
        const def = FILTER_DEFS.find((d) => d.property === f.property)
        if (def?.type === "date") {
          const preset = DATE_PRESETS.find((p) => p.key === f.values[0])
          if (!preset) return true
          const taskDate = f.property === "dueDate"
            ? task.dueDate
            : f.property === "createdAt"
              ? (task.createdAt ?? task._creationTime)
              : task.lastEditedAt
          if (preset.key === "no_date") return taskDate == null
          if (taskDate == null) return false
          const range = preset.range()
          if (!range) return taskDate == null
          if (f.operator === "is") return taskDate >= range[0] && taskDate <= range[1]
          if (f.operator === "before") return taskDate < range[0]
          if (f.operator === "after") return taskDate > range[1]
          return true
        }
        // Select filters
        const taskVal =
          f.property === "status"
            ? task.status
            : f.property === "assignee"
              ? (task.assignees?.[0] && "name" in task.assignees[0] ? (task.assignees[0] as { name: string }).name : "")
              : f.property === "client"
                ? (task.clientName ?? "")
                : (task.workCategoryName ?? "")
        const match = f.values.includes(taskVal)
        return f.operator === "is" ? match : !match
      })
      return state.filterMode === "all" ? results.every(Boolean) : results.some(Boolean)
    })
  }

  // Sort by status order, then by _creationTime desc
  filtered.sort((a, b) => {
    const sa = STATUS_CONFIG[a.status as TaskStatusKey]?.sortOrder ?? 5
    const sb = STATUS_CONFIG[b.status as TaskStatusKey]?.sortOrder ?? 5
    if (sa !== sb) return sa - sb
    return b._creationTime - a._creationTime
  })

  return filtered
}

// ── Grouping ────────────────────────────────────────────────────────────

export type TaskGroup = {
  key: string
  rawKey?: string
  tasks: EnrichedTask[]
}

export function groupTasks(tasks: EnrichedTask[], groupBy: GroupByV2): TaskGroup[] {
  if (groupBy === "none") return [{ key: "", tasks }]

  if (groupBy === "status") {
    const map = new Map<string, { label: string; tasks: EnrichedTask[] }>()
    for (const t of tasks) {
      const cfg = STATUS_CONFIG[t.status as TaskStatusKey]
      if (!map.has(t.status)) map.set(t.status, { label: cfg?.label ?? t.status, tasks: [] })
      map.get(t.status)!.tasks.push(t)
    }
    // Maintain status order
    return STATUS_ORDER.filter((s) => map.has(s)).map((s) => ({
      key: map.get(s)!.label,
      rawKey: s,
      tasks: map.get(s)!.tasks,
    }))
  }

  const fn =
    groupBy === "client"
      ? (t: EnrichedTask) => t.clientName ?? "No Client"
      : (t: EnrichedTask) => t.workCategoryName ?? "Uncategorized"

  const map = new Map<string, EnrichedTask[]>()
  for (const t of tasks) {
    const k = fn(t)
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(t)
  }
  return Array.from(map.entries()).map(([k, v]) => ({ key: k, tasks: v }))
}
