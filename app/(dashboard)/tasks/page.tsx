"use client"

import { useState, useCallback } from "react"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Skeleton } from "@/components/ui/skeleton"
import { TaskListTable } from "@/components/task-list-table"

export default function TasksPage() {
  const me = useQuery(api.users.getMe)
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [allPages, setAllPages] = useState<any[][]>([])
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const isAdmin = me?.role === "admin"

  // First page
  const firstPage = useQuery(api.tasks.list, me ? {} : "skip")

  // Additional pages (loaded on demand via cursor)
  const nextPage = useQuery(
    api.tasks.list,
    cursor ? { paginationOpts: { cursor } } : "skip",
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

  // Loading state for user
  if (me === undefined) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
        <p className="text-muted-foreground mt-1">
          Manage all tasks across projects.
        </p>
      </div>

      <TaskListTable
        data={mergedData}
        isLoading={firstPage === undefined && me !== undefined}
        isAdmin={isAdmin}
        onLoadMore={handleLoadMore}
        isLoadingMore={isLoadingMore}
      />
    </div>
  )
}
