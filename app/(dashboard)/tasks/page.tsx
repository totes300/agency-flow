"use client"

import { useState, useCallback, useMemo, useEffect, useRef, Suspense } from "react"
import { useQuery, useMutation } from "convex/react"
import { useRouter, useSearchParams } from "next/navigation"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { Skeleton } from "@/components/ui/skeleton"
import { TaskDetailDialog } from "@/components/task-detail-dialog"
import { TaskFilterBarV2 } from "@/components/task-filter-bar-v2"
import { TaskGroupSection } from "@/components/task-group-section"
import { TaskBulkBar } from "@/components/task-bulk-bar"
import { RunningTimerIndicator } from "@/components/task-timer-pill"
import { UiIcon } from "@/components/icons/ui-icons"
import { StatusIcon } from "@/components/icons/status-icons"
import { STATUS_CONFIG, STATUS_ORDER, type TaskStatusKey } from "@/lib/task-config"
import {
  useTaskFiltersV2,
  applyFiltersAndSort,
  groupTasks,
} from "@/hooks/use-task-filters-v2"
import type { EnrichedTask } from "@/lib/types"

function TasksPageInner() {
  const me = useQuery(api.users.getMe)
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [allPages, setAllPages] = useState<any[][]>([])

  const router = useRouter()
  const searchParams = useSearchParams()
  const openTaskId = searchParams.get("task") as Id<"tasks"> | null
  const searchRef = useRef<HTMLInputElement>(null)

  const recordView = useMutation(api.tasks.recordView)

  const filterState = useTaskFiltersV2()
  const isAdmin = me?.role === "admin"

  // First page — no server-side filters, we filter client-side
  const firstPage = useQuery(api.tasks.list, me ? {} : "skip")

  // Additional pages (loaded on demand via cursor)
  const nextPage = useQuery(
    api.tasks.list,
    cursor ? { paginationOpts: { cursor } } : "skip",
  )

  // Merge all pages
  const allTasks = useMemo(() => {
    if (!firstPage) return undefined
    const tasks = [...firstPage.page] as EnrichedTask[]
    for (const page of allPages) {
      tasks.push(...page)
    }
    if (nextPage && cursor && !allPages.some((p) => p === nextPage.page)) {
      tasks.push(...(nextPage.page as EnrichedTask[]))
    }
    return tasks
  }, [firstPage, allPages, nextPage, cursor])

  const hasMore = nextPage ? !nextPage.isDone : firstPage ? !firstPage.isDone : false

  const handleLoadMore = useCallback(() => {
    if (!firstPage || firstPage.isDone) return
    if (nextPage) {
      setAllPages((prev) => [...prev, nextPage.page])
    }
    const continueCursor = nextPage?.continueCursor ?? firstPage.continueCursor
    setCursor(continueCursor || undefined)
  }, [firstPage, nextPage])

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const toggleSelect = useCallback((id: Id<"tasks">) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])

  // ⌘K keyboard shortcut
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        searchRef.current?.focus()
      }
      if (e.key === "Escape") {
        searchRef.current?.blur()
      }
    }
    document.addEventListener("keydown", fn)
    return () => document.removeEventListener("keydown", fn)
  }, [])

  // Open task detail
  const handleOpenTask = useCallback(
    (taskId: string) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set("task", taskId)
      router.push(`?${params.toString()}`, { scroll: false })
      // Record view
      recordView({ taskId: taskId as Id<"tasks"> }).catch(() => {})
    },
    [router, searchParams, recordView],
  )

  const handleCloseTask = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("task")
    const qs = params.toString()
    router.push(qs ? `?${qs}` : "/tasks", { scroll: false })
  }, [router, searchParams])

  // Filtered and sorted tasks
  const filteredTasks = useMemo(() => {
    if (!allTasks) return []
    return applyFiltersAndSort(allTasks, {
      activeTab: filterState.activeTab,
      searchQuery: filterState.searchQuery,
      filters: filterState.filters,
      filterMode: filterState.filterMode,
      groupBy: filterState.groupBy,
    })
  }, [allTasks, filterState.activeTab, filterState.searchQuery, filterState.filters, filterState.filterMode, filterState.groupBy])

  // Grouped tasks
  const grouped = useMemo(
    () => groupTasks(filteredTasks, filterState.groupBy),
    [filteredTasks, filterState.groupBy],
  )

  // Status counts (from all tasks, not filtered)
  const statusCounts = useMemo(() => {
    if (!allTasks) return {}
    const counts: Record<string, number> = {}
    for (const t of allTasks) {
      counts[t.status] = (counts[t.status] || 0) + 1
    }
    return counts
  }, [allTasks])

  const totalCount = allTasks?.length ?? 0
  const activeCount = allTasks?.filter((t) => t.status !== "done").length ?? 0

  const [searchFocused, setSearchFocused] = useState(false)

  // Loading state
  if (!me) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden -m-4 md:-m-6">
      {/* Header row */}
      <div className="px-3 md:px-5 pt-4 pb-3 bg-white flex items-center justify-between">
        <h1 className="text-[19px] font-bold text-[#111827] m-0 tracking-[-0.025em]">
          All Tasks
        </h1>
        <div className="flex items-center gap-2">
          <RunningTimerIndicator />
          {/* Search */}
          <div
            className="flex items-center rounded-[7px] px-2 gap-[5px] transition-all duration-150 min-w-[160px] max-w-[220px]"
            style={{
              background: searchFocused ? "#fff" : "#f3f4f6",
              border: "1px solid",
              borderColor: searchFocused ? "#6366f1" : "transparent",
              boxShadow: searchFocused ? "0 0 0 3px rgba(99,102,241,0.08)" : "none",
            }}
          >
            <UiIcon type="search" size={13} color="#9ca3af" />
            <input
              ref={searchRef}
              value={filterState.searchQuery}
              onChange={(e) => filterState.setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Search\u2026"
              className="border-none outline-none flex-1 py-[5px] px-0 text-[12.5px] font-inherit bg-transparent text-[#111827] w-[100px] placeholder:text-[#9ca3af]"
            />
            {!searchFocused && !filterState.searchQuery && (
              <span className="text-[10px] text-[#b0b5bd] bg-[#e5e7eb] rounded-[3px] px-1 font-semibold font-mono leading-[15px]">
                \u2318K
              </span>
            )}
            {filterState.searchQuery && (
              <button
                onClick={() => filterState.setSearchQuery("")}
                className="bg-none border-none cursor-pointer p-0.5 text-[#9ca3af] flex"
              >
                <UiIcon type="x" size={11} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs + Filter bar */}
      <TaskFilterBarV2
        filters={filterState.filters}
        filterMode={filterState.filterMode}
        activeTab={filterState.activeTab}
        groupBy={filterState.groupBy}
        filterMenuOpen={filterState.filterMenuOpen}
        filterEditId={filterState.filterEditId}
        tasks={allTasks ?? []}
        statusCounts={statusCounts}
        totalCount={totalCount}
        activeCount={activeCount}
        onSetActiveTab={filterState.setActiveTab}
        onSetGroupBy={filterState.setGroupBy}
        onSetFilterMenuOpen={filterState.setFilterMenuOpen}
        onSetFilterEditId={filterState.setFilterEditId}
        onAddFilter={filterState.addFilter}
        onUpdateFilter={filterState.updateFilter}
        onRemoveFilter={filterState.removeFilter}
        onClearFilters={filterState.clearFilters}
        onToggleFilterValue={filterState.toggleFilterValue}
        onToggleFilterMode={filterState.toggleFilterMode}
      />

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto min-w-0 task-list-scroll">
          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <div
              className="flex items-center gap-2 px-3.5 py-2 bg-[#f6f7f8] border-b border-[#e5e7eb] sticky top-0 z-20"
              style={{ animation: "popIn 0.12s ease" }}
            >
              <span className="text-[12.5px] font-semibold text-[#374151]">
                {selectedIds.size} selected
              </span>
              <span className="text-[#d1d5db]">|</span>
              {STATUS_ORDER.map((key) => {
                const cfg = STATUS_CONFIG[key]
                return (
                  <BulkStatusButton
                    key={key}
                    statusKey={key}
                    cfg={cfg}
                    selectedIds={selectedIds}
                    onClearSelection={clearSelection}
                  />
                )
              })}
              <span className="flex-1" />
              <button
                onClick={clearSelection}
                className="py-1 px-2.5 rounded-[5px] border-none bg-transparent text-[11.5px] font-medium text-[#6b7280] cursor-pointer font-inherit"
              >
                Clear
              </button>
            </div>
          )}

          {/* Task groups */}
          {firstPage === undefined ? (
            <div className="p-8 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : (
            <>
              {grouped.map(({ key: group, rawKey, tasks: gt }) => (
                <TaskGroupSection
                  key={group || "__all"}
                  groupKey={group}
                  rawKey={rawKey}
                  tasks={gt}
                  isAdmin={isAdmin}
                  selectedIds={selectedIds}
                  onToggleSelect={toggleSelect}
                  onOpenTask={handleOpenTask}
                  groupBy={filterState.groupBy}
                />
              ))}

              {filteredTasks.length === 0 && (
                <div className="py-16 px-5 text-center text-[#9ca3af]">
                  <div className="text-[28px] mb-2 opacity-60">&check;</div>
                  <div className="text-[15px] font-[550] text-[#6b7280]">All clear</div>
                  <div className="text-[13px] mt-1">No tasks match your current filters.</div>
                </div>
              )}

              {hasMore && (
                <div className="py-4 text-center">
                  <button
                    onClick={handleLoadMore}
                    className="text-sm text-[#6b7280] hover:text-[#374151] cursor-pointer bg-transparent border-none font-inherit"
                  >
                    Load more tasks...
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Task detail dialog */}
      <TaskDetailDialog
        taskId={openTaskId}
        open={!!openTaskId}
        onOpenChange={(open) => {
          if (!open) handleCloseTask()
        }}
      />
    </div>
  )
}

// ── Bulk Status Button ────────────────────────────────────────────────

function BulkStatusButton({
  statusKey,
  cfg,
  selectedIds,
  onClearSelection,
}: {
  statusKey: TaskStatusKey
  cfg: { color: string; bg: string; label: string }
  selectedIds: Set<string>
  onClearSelection: () => void
}) {
  const bulkUpdateStatus = useMutation(api.tasks.bulkUpdateStatus)

  const handleClick = useCallback(async () => {
    try {
      await bulkUpdateStatus({
        ids: Array.from(selectedIds) as Id<"tasks">[],
        status: statusKey,
      })
      onClearSelection()
    } catch (err: unknown) {
      // toast handled by mutation
    }
  }, [statusKey, selectedIds, bulkUpdateStatus, onClearSelection])

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-1 py-1 px-2 rounded-[5px] border-none bg-transparent text-[11.5px] font-medium text-[#374151] cursor-pointer font-inherit transition-colors"
      style={{ ["--hover-bg" as string]: cfg.bg }}
      onMouseEnter={(e) => { e.currentTarget.style.background = cfg.bg }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent" }}
    >
      <StatusIcon status={statusKey} size={12} />
      {cfg.label}
    </button>
  )
}

export default function TasksPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-2 p-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
      }
    >
      <TasksPageInner />
    </Suspense>
  )
}
