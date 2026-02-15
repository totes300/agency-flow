"use client"

import { useState, useRef, useCallback, useMemo, KeyboardEvent } from "react"
import { useMutation } from "convex/react"
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { PlusIcon, LoaderIcon, ChevronRightIcon } from "lucide-react"
import { TaskStatusSelect, TaskStatusBadge } from "@/components/task-status-select"
import { TaskProjectSelector } from "@/components/task-project-selector"
import { TaskAssigneePicker } from "@/components/task-assignee-picker"
import { TaskCategorySelect } from "@/components/task-category-select"
import { TaskActionsMenu } from "@/components/task-actions-menu"
import type { GroupByOption } from "@/components/task-filters"

// Use permissive types to avoid mismatches with Convex generated types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EnrichedTask = Record<string, any>

type TaskListResult = {
  page: EnrichedTask[]
  continueCursor: string
  isDone: boolean
}

type TaskGroup = {
  key: string
  label: string
  tasks: EnrichedTask[]
}

function groupTasks(
  tasks: EnrichedTask[],
  groupBy: GroupByOption,
): TaskGroup[] {
  if (groupBy === "none") return [{ key: "all", label: "", tasks }]

  const groups = new Map<string, TaskGroup>()

  for (const task of tasks) {
    let key: string
    let label: string

    switch (groupBy) {
      case "client":
        key = task.clientId ?? "no-client"
        label = task.clientName ?? "No Client"
        break
      case "project":
        key = task.projectId ?? "no-project"
        label = task.projectName
          ? `${task.clientName ?? "?"} → ${task.projectName}`
          : "No Project"
        break
      case "assignee":
        // Use first assignee for grouping (tasks can have multiple)
        if (task.assignees?.length > 0) {
          key = task.assignees[0]._id
          label = task.assignees[0].name
        } else {
          key = "unassigned"
          label = "Unassigned"
        }
        break
      case "status":
        key = task.status
        label = STATUS_LABELS[task.status] ?? task.status
        break
      default:
        key = "all"
        label = ""
    }

    if (!groups.has(key)) {
      groups.set(key, { key, label, tasks: [] })
    }
    groups.get(key)!.tasks.push(task)
  }

  return [...groups.values()]
}

const STATUS_LABELS: Record<string, string> = {
  inbox: "Inbox",
  today: "Today",
  next_up: "Next Up",
  admin_review: "Review",
  stuck: "Stuck",
  done: "Done",
}

const COL_COUNT = 7

export function TaskListTable({
  data,
  isLoading,
  isAdmin,
  onLoadMore,
  isLoadingMore,
  groupBy = "none",
}: {
  data: TaskListResult | undefined
  isLoading: boolean
  isAdmin: boolean
  onLoadMore: () => void
  isLoadingMore: boolean
  groupBy?: GroupByOption
}) {
  const [creatingTitle, setCreatingTitle] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [showCreateRow, setShowCreateRow] = useState(false)
  const [createGroupKey, setCreateGroupKey] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const createTask = useMutation(api.tasks.create)

  // Use ref to read title at call time
  const titleRef = useRef(creatingTitle)
  titleRef.current = creatingTitle

  // Store group context for inline creation
  const createGroupRef = useRef<string | null>(null)
  createGroupRef.current = createGroupKey

  const handleCreate = useCallback(async () => {
    const trimmed = titleRef.current.trim()
    if (!trimmed) return

    setIsCreating(true)
    try {
      const args: { title: string; projectId?: Id<"projects">; status?: any } = {
        title: trimmed,
      }
      // Inherit group context when creating inside a group
      const gKey = createGroupRef.current
      if (gKey && groupBy === "project" && gKey !== "no-project") {
        args.projectId = gKey as Id<"projects">
      }
      if (gKey && groupBy === "status" && gKey !== "all") {
        args.status = gKey
      }

      await createTask(args)
      setCreatingTitle("")
      inputRef.current?.focus()
    } catch (err: unknown) {
      toast.error((err as Error).message)
    } finally {
      setIsCreating(false)
    }
  }, [createTask, groupBy])

  const handleCreateKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleCreate()
      } else if (e.key === "Escape") {
        setCreatingTitle("")
        setShowCreateRow(false)
        setCreateGroupKey(null)
      }
    },
    [handleCreate],
  )

  const openCreateRow = useCallback(
    (groupKey?: string) => {
      setShowCreateRow(true)
      setCreateGroupKey(groupKey ?? null)
      setTimeout(() => inputRef.current?.focus(), 50)
    },
    [],
  )

  const tasks = data?.page ?? []
  const groups = useMemo(() => groupTasks(tasks, groupBy), [tasks, groupBy])
  const isGrouped = groupBy !== "none"
  const isEmpty = tasks.length === 0

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

  // Empty state
  if (isEmpty && !showCreateRow) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <h3 className="text-lg font-medium">No tasks yet</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          Create your first task to get started.
        </p>
        <Button className="mt-4" onClick={() => openCreateRow()}>
          <PlusIcon className="mr-2 size-4" />
          Create Your First Task
        </Button>
      </div>
    )
  }

  const inlineCreationRow = showCreateRow && (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={COL_COUNT}>
        <div className="flex items-center gap-2">
          <PlusIcon className="size-4 shrink-0 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder="Type a task name, press Enter to create..."
            value={creatingTitle}
            onChange={(e) => setCreatingTitle(e.target.value)}
            onKeyDown={handleCreateKeyDown}
            onBlur={() => {
              if (!titleRef.current.trim()) {
                setShowCreateRow(false)
                setCreateGroupKey(null)
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
  )

  return (
    <div className="space-y-4">
      {isGrouped ? (
        <div className="space-y-3">
          {groups.map((group) => (
            <GroupSection
              key={group.key}
              group={group}
              isAdmin={isAdmin}
              onCreateInGroup={() => openCreateRow(group.key)}
              creationRow={
                showCreateRow && createGroupKey === group.key
                  ? inlineCreationRow
                  : null
              }
            />
          ))}
          {/* Global create if not inside a group */}
          {showCreateRow && !createGroupKey && (
            <div className="rounded-md border">
              <Table>
                <TableBody>{inlineCreationRow}</TableBody>
              </Table>
            </div>
          )}
        </div>
      ) : (
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
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => (
                <TaskRow key={task._id} task={task} isAdmin={isAdmin} />
              ))}
              {inlineCreationRow}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Bottom area: add button + load more */}
      <div className="flex items-center justify-between">
        {!showCreateRow ? (
          <Button variant="ghost" size="sm" onClick={() => openCreateRow()}>
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

function GroupSection({
  group,
  isAdmin,
  onCreateInGroup,
  creationRow,
}: {
  group: TaskGroup
  isAdmin: boolean
  onCreateInGroup: () => void
  creationRow: React.ReactNode
}) {
  const [isOpen, setIsOpen] = useState(true)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="rounded-md border">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-muted/50"
          >
            <ChevronRightIcon
              className={`size-4 shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`}
            />
            <span className="font-medium">{group.label}</span>
            <span className="text-muted-foreground text-sm">
              {group.tasks.length} {group.tasks.length === 1 ? "task" : "tasks"}
            </span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">Task</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Assignees</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Time</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {group.tasks.map((task) => (
                <TaskRow key={task._id} task={task} isAdmin={isAdmin} />
              ))}
              {creationRow}
            </TableBody>
          </Table>
          <div className="border-t px-4 py-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={onCreateInGroup}
            >
              <PlusIcon className="mr-1.5 size-3" />
              Add task
            </Button>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
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

      {/* Actions */}
      <TableCell>
        <TaskActionsMenu
          taskId={task._id as Id<"tasks">}
          taskTitle={task.title}
          isAdmin={isAdmin}
          hasTimeEntries={task.totalMinutes > 0}
        />
      </TableCell>
    </TableRow>
  )
}
