"use client"

import { useState, useCallback, useMemo, Suspense } from "react"
import { useQuery } from "convex/react"
import { useRouter, useSearchParams } from "next/navigation"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { Skeleton } from "@/components/ui/skeleton"
import { TaskListTable } from "@/components/task-list-table"
import { TaskFilterBar, useTaskFilters } from "@/components/task-filters"
import { TaskDetailDialog } from "@/components/task-detail-dialog"
import type { GroupByOption } from "@/components/task-filters"

function TasksPageInner() {
  const me = useQuery(api.users.getMe)
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [allPages, setAllPages] = useState<any[][]>([])
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const router = useRouter()
  const searchParams = useSearchParams()
  const openTaskId = searchParams.get("task") as Id<"tasks"> | null

  const { filters, groupBy, setFilter, setFilters, setGroupBy, clearAll, hasFilters } =
    useTaskFilters()

  const isAdmin = me?.role === "admin"

  // Build Convex filter args from URL params
  const convexFilters = useMemo(() => {
    const f: Record<string, any> = {}
    if (filters.clientId) f.clientId = filters.clientId as Id<"clients">
    if (filters.projectId) f.projectId = filters.projectId as Id<"projects">
    if (filters.assigneeId) f.assigneeId = filters.assigneeId as Id<"users">
    if (filters.status) f.status = filters.status
    if (filters.dateFrom) f.dateFrom = filters.dateFrom
    if (filters.dateTo) f.dateTo = filters.dateTo
    return Object.keys(f).length > 0 ? f : undefined
  }, [filters])

  // First page
  const firstPage = useQuery(
    api.tasks.list,
    me
      ? {
          filters: convexFilters,
          groupBy: groupBy !== "none" ? groupBy : undefined,
        }
      : "skip",
  )

  // Additional pages (loaded on demand via cursor)
  const nextPage = useQuery(
    api.tasks.list,
    cursor
      ? {
          paginationOpts: { cursor },
          filters: convexFilters,
          groupBy: groupBy !== "none" ? groupBy : undefined,
        }
      : "skip",
  )

  // Merge all pages
  const mergedData = (() => {
    if (!firstPage) return undefined

    const allTasks = [...firstPage.page]
    for (const page of allPages) {
      allTasks.push(...page)
    }

    // If there's a new next page, add it
    if (nextPage && cursor && !allPages.some((p) => p === nextPage.page)) {
      allTasks.push(...nextPage.page)
    }

    return {
      page: allTasks,
      continueCursor: nextPage?.continueCursor ?? firstPage.continueCursor,
      isDone: nextPage?.isDone ?? firstPage.isDone,
    }
  })()

  const handleLoadMore = useCallback(() => {
    if (!mergedData || mergedData.isDone) return
    setIsLoadingMore(true)

    // Store current page if we have one
    if (nextPage) {
      setAllPages((prev) => [...prev, nextPage.page])
    }

    setCursor(mergedData.continueCursor || undefined)
    setIsLoadingMore(false)
  }, [mergedData, nextPage])

  // Reset pagination when filters change
  const handleFilterChange = useCallback(
    (key: string, value: string | undefined) => {
      setCursor(undefined)
      setAllPages([])
      setFilter(key, value)
    },
    [setFilter],
  )

  const handleFiltersChange = useCallback(
    (updates: Record<string, string | undefined>) => {
      setCursor(undefined)
      setAllPages([])
      setFilters(updates)
    },
    [setFilters],
  )

  const handleGroupByChange = useCallback(
    (value: GroupByOption) => {
      setCursor(undefined)
      setAllPages([])
      setGroupBy(value)
    },
    [setGroupBy],
  )

  const handleClearAll = useCallback(() => {
    setCursor(undefined)
    setAllPages([])
    clearAll()
  }, [clearAll])

  const handleOpenTask = useCallback(
    (taskId: string) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set("task", taskId)
      router.push(`?${params.toString()}`, { scroll: false })
    },
    [router, searchParams],
  )

  const handleCloseTask = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("task")
    const qs = params.toString()
    router.push(qs ? `?${qs}` : "/tasks", { scroll: false })
  }, [router, searchParams])

  // Wait for authenticated user before rendering anything
  if (!me) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Tasks</h1>
        <p className="text-muted-foreground mt-1 text-sm md:text-base">
          Manage all tasks across projects.
        </p>
      </div>

      <TaskFilterBar
        filters={filters}
        groupBy={groupBy}
        onFilterChange={handleFilterChange}
        onFiltersChange={handleFiltersChange}
        onGroupByChange={handleGroupByChange}
        onClearAll={handleClearAll}
        hasFilters={hasFilters}
      />

      <TaskListTable
        data={mergedData}
        isLoading={firstPage === undefined}
        isAdmin={isAdmin}
        onLoadMore={handleLoadMore}
        isLoadingMore={isLoadingMore}
        groupBy={groupBy}
        onOpenTask={handleOpenTask}
      />

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

export default function TasksPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
      }
    >
      <TasksPageInner />
    </Suspense>
  )
}
