"use client"

import { useState, useCallback, useMemo, useEffect, useRef, Suspense, memo } from "react"
import { useQuery, useMutation } from "convex/react"
import { useRouter, useSearchParams } from "next/navigation"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { Search, X } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TaskDetailDialog } from "@/components/task-detail-dialog"
import { TaskFilterBarV2 } from "@/components/task-filter-bar-v2"
import { TaskGroupSection } from "@/components/task-group-section"
import { RunningTimerIndicator } from "@/components/task-timer-pill"
import { StatusIcon } from "@/components/icons/status-icons"
import { STATUS_CONFIG, STATUS_ORDER, type TaskStatusKey } from "@/lib/task-config"
import { cn } from "@/lib/utils"
import {
  useTaskFiltersV2,
  applyFiltersAndSort,
  groupTasks,
} from "@/hooks/use-task-filters-v2"
import type { EnrichedTask } from "@/lib/types"

function TasksPageInner() {
  const me = useQuery(api.users.getMe)
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [allPages, setAllPages] = useState<EnrichedTask[][]>([])

  const router = useRouter()
  const searchParams = useSearchParams()
  const openTaskId = searchParams.get("task") as Id<"tasks"> | null
  const searchRef = useRef<HTMLInputElement>(null)

  const recordView = useMutation(api.tasks.recordView)

  const filterState = useTaskFiltersV2()
  const isAdmin = me?.role === "admin"

  // First page
  const firstPage = useQuery(api.tasks.list, me ? {} : "skip")

  // Additional pages (loaded on demand via cursor)
  const nextPage = useQuery(
    api.tasks.list,
    cursor ? { paginationOpts: { cursor } } : "skip",
  )

  // Merge all pages — deduplicate by _id
  const allTasks = useMemo(() => {
    if (!firstPage) return undefined
    const seen = new Set<string>()
    const tasks: EnrichedTask[] = []
    const addUnique = (page: EnrichedTask[]) => {
      for (const t of page) {
        if (!seen.has(t._id)) {
          seen.add(t._id)
          tasks.push(t)
        }
      }
    }
    addUnique(firstPage.page as EnrichedTask[])
    for (const page of allPages) addUnique(page)
    if (nextPage && cursor && !allPages.some((p) => p === nextPage.page)) {
      addUnique(nextPage.page as EnrichedTask[])
    }
    return tasks
  }, [firstPage, allPages, nextPage, cursor])

  const hasMore = nextPage ? !nextPage.isDone : firstPage ? !firstPage.isDone : false

  const handleLoadMore = useCallback(() => {
    if (!hasMore) return
    if (nextPage) {
      setAllPages((prev) => [...prev, nextPage.page as EnrichedTask[]])
    }
    const continueCursor = nextPage?.continueCursor ?? firstPage?.continueCursor
    setCursor(continueCursor || undefined)
  }, [hasMore, firstPage, nextPage])

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
    (taskId: Id<"tasks">) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set("task", taskId)
      router.push(`?${params.toString()}`, { scroll: false })
      recordView({ taskId }).catch(() => {})
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
    })
  }, [allTasks, filterState.activeTab, filterState.searchQuery, filterState.filters, filterState.filterMode])

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
  const activeCount = useMemo(
    () => allTasks?.filter((t) => t.status !== "done").length ?? 0,
    [allTasks],
  )

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
    <div className="flex flex-col h-full overflow-hidden -m-4">
      {/* Header row */}
      <div className="px-4 pt-4 pb-3 bg-background flex items-center justify-between">
        <h1 className="text-lg font-bold text-task-foreground m-0 tracking-tight">
          All Tasks
        </h1>
        <div className="flex items-center gap-2">
          <RunningTimerIndicator />
          {/* Search */}
          <div
            className={cn(
              "flex items-center rounded-md px-2 gap-1.5 transition-all duration-150 min-w-[160px] max-w-[220px] border",
              searchFocused
                ? "bg-background border-ring shadow-[0_0_0_3px_rgba(99,102,241,0.08)]"
                : "bg-task-surface border-transparent",
            )}
          >
            <Search size={13} className="text-task-muted-light shrink-0" />
            <Input
              ref={searchRef}
              value={filterState.searchQuery}
              onChange={(e) => filterState.setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Search\u2026"
              aria-label="Search tasks"
              className="border-none shadow-none outline-none flex-1 py-1.5 px-0 text-xs font-inherit bg-transparent text-task-foreground h-auto rounded-none focus-visible:ring-0 placeholder:text-task-muted-light"
            />
            {!searchFocused && !filterState.searchQuery && (
              <span className="text-[10px] text-task-muted-lighter bg-task-border rounded px-1 font-semibold font-mono leading-4">
                \u2318K
              </span>
            )}
            {filterState.searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => filterState.setSearchQuery("")}
                aria-label="Clear search"
                className="h-5 w-5 text-task-muted-light"
              >
                <X size={11} />
              </Button>
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
        <div className="flex-1 overflow-y-auto min-w-0 task-list-scroll" role="list">
          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-task-surface-subtle border-b border-task-border sticky top-0 z-20 animate-in fade-in-0 zoom-in-95 duration-100" role="listitem">
              <span className="text-xs font-semibold text-task-foreground-secondary">
                {selectedIds.size} selected
              </span>
              <span className="text-task-separator">|</span>
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
              <Button
                variant="ghost"
                size="xs"
                onClick={clearSelection}
                className="text-xs font-medium text-task-muted"
              >
                Clear
              </Button>
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
                />
              ))}

              {filteredTasks.length === 0 && (
                <div className="py-16 px-5 text-center text-task-muted-light">
                  <div className="text-3xl mb-2 opacity-60">&check;</div>
                  <div className="text-sm font-semibold text-task-muted">All clear</div>
                  <div className="text-xs mt-1">
                    {hasMore
                      ? "No matching tasks in loaded results. Load more to find additional matches."
                      : "No tasks match your current filters."}
                  </div>
                </div>
              )}

              {hasMore && (
                <div className="py-4 text-center">
                  <Button
                    variant="link"
                    onClick={handleLoadMore}
                    className="text-sm text-task-muted hover:text-task-foreground-secondary"
                  >
                    Load more tasks...
                  </Button>
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

const BulkStatusButton = memo(function BulkStatusButton({
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
    } catch {
      // toast handled by mutation
    }
  }, [statusKey, selectedIds, bulkUpdateStatus, onClearSelection])

  return (
    <Button
      variant="ghost"
      size="xs"
      onClick={handleClick}
      className="text-xs font-medium text-task-foreground-secondary gap-1 hover:bg-[var(--hover-bg)]"
      style={{ "--hover-bg": cfg.bg } as React.CSSProperties}
    >
      <StatusIcon status={statusKey} size={12} />
      {cfg.label}
    </Button>
  )
})

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
