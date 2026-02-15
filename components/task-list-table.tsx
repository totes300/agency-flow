"use client"

import { useState, useRef, useCallback, KeyboardEvent } from "react"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { toast } from "sonner"
import { formatDuration } from "@/lib/format"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PlusIcon, LoaderIcon } from "lucide-react"
import { TaskStatusSelect, TaskStatusBadge } from "@/components/task-status-select"
import { TaskProjectSelector } from "@/components/task-project-selector"
import { TaskAssigneePicker, TaskAssigneeAvatars } from "@/components/task-assignee-picker"
import { TaskCategorySelect } from "@/components/task-category-select"

// Use permissive types to avoid mismatches with Convex generated types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EnrichedTask = Record<string, any>

type TaskListResult = {
  page: EnrichedTask[]
  continueCursor: string
  isDone: boolean
}

export function TaskListTable({
  data,
  isLoading,
  isAdmin,
  onLoadMore,
  isLoadingMore,
}: {
  data: TaskListResult | undefined
  isLoading: boolean
  isAdmin: boolean
  onLoadMore: () => void
  isLoadingMore: boolean
}) {
  const [creatingTitle, setCreatingTitle] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [showCreateRow, setShowCreateRow] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const createTask = useMutation(api.tasks.create)

  const handleCreate = useCallback(async () => {
    const trimmed = creatingTitle.trim()
    if (!trimmed) return

    setIsCreating(true)
    try {
      await createTask({ title: trimmed })
      setCreatingTitle("")
      // Keep the input focused for rapid entry
      inputRef.current?.focus()
    } catch (err: unknown) {
      toast.error((err as Error).message)
    } finally {
      setIsCreating(false)
    }
  }, [creatingTitle, createTask])

  const handleCreateKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleCreate()
      } else if (e.key === "Escape") {
        setCreatingTitle("")
        setShowCreateRow(false)
      }
    },
    [handleCreate],
  )

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  }

  const tasks = data?.page ?? []
  const isEmpty = tasks.length === 0

  // Empty state
  if (isEmpty && !showCreateRow) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <h3 className="text-lg font-medium">No tasks yet</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          Create your first task to get started.
        </p>
        <Button
          className="mt-4"
          onClick={() => {
            setShowCreateRow(true)
            setTimeout(() => inputRef.current?.focus(), 50)
          }}
        >
          <PlusIcon className="mr-2 size-4" />
          Create Your First Task
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%]">Task</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Assignees</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => (
              <TaskRow key={task._id} task={task} isAdmin={isAdmin} />
            ))}

            {/* Inline creation row */}
            {showCreateRow && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6}>
                  <div className="flex items-center gap-2">
                    <PlusIcon className="size-4 shrink-0 text-muted-foreground" />
                    <Input
                      ref={inputRef}
                      placeholder="Type a task name, press Enter to create..."
                      value={creatingTitle}
                      onChange={(e) => setCreatingTitle(e.target.value)}
                      onKeyDown={handleCreateKeyDown}
                      onBlur={() => {
                        if (!creatingTitle.trim()) {
                          setShowCreateRow(false)
                        }
                      }}
                      disabled={isCreating}
                      className="h-8 border-none bg-transparent shadow-none focus-visible:ring-0"
                      autoFocus
                    />
                    {isCreating && (
                      <LoaderIcon className="size-4 shrink-0 animate-spin text-muted-foreground" />
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Bottom area: add button + load more */}
      <div className="flex items-center justify-between">
        {!showCreateRow ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowCreateRow(true)
              setTimeout(() => inputRef.current?.focus(), 50)
            }}
          >
            <PlusIcon className="mr-2 size-4" />
            New Task
          </Button>
        ) : (
          <div />
        )}

        {data && !data.isDone && (
          <Button
            variant="outline"
            size="sm"
            onClick={onLoadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? (
              <>
                <LoaderIcon className="mr-2 size-4 animate-spin" />
                Loading...
              </>
            ) : (
              "Load More"
            )}
          </Button>
        )}
      </div>
    </div>
  )
}

function TaskRow({ task, isAdmin }: { task: EnrichedTask; isAdmin: boolean }) {
  return (
    <TableRow className="group">
      {/* Title */}
      <TableCell className="font-medium">
        <span className="line-clamp-1">{task.title}</span>
      </TableCell>

      {/* Project */}
      <TableCell>
        <TaskProjectSelector
          taskId={task._id as Id<"tasks">}
          currentProjectId={task.projectId}
          currentProjectName={task.projectName}
          currentClientName={task.clientName}
        />
      </TableCell>

      {/* Assignees */}
      <TableCell>
        <TaskAssigneePicker
          taskId={task._id as Id<"tasks">}
          currentAssigneeIds={task.assigneeIds}
          currentAssignees={task.assignees}
        />
      </TableCell>

      {/* Status */}
      <TableCell>
        <TaskStatusSelect
          taskId={task._id as Id<"tasks">}
          currentStatus={task.status}
          isAdmin={isAdmin}
        />
      </TableCell>

      {/* Category */}
      <TableCell>
        <TaskCategorySelect
          taskId={task._id as Id<"tasks">}
          projectId={task.projectId}
          currentCategoryId={task.workCategoryId}
          currentCategoryName={task.workCategoryName}
        />
      </TableCell>

      {/* Time */}
      <TableCell className="text-right">
        <span className="text-muted-foreground text-sm">
          {task.totalMinutes > 0 ? formatDuration(task.totalMinutes) : "—"}
        </span>
      </TableCell>
    </TableRow>
  )
}
