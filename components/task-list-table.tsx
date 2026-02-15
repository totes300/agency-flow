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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { PlusIcon, LoaderIcon, ChevronRightIcon } from "lucide-react"
import { TaskStatusSelect, TaskStatusBadge } from "@/components/task-status-select"
import { TaskProjectSelector } from "@/components/task-project-selector"
import { TaskAssigneePicker, TaskAssigneeAvatars } from "@/components/task-assignee-picker"
import { TaskCategorySelect } from "@/components/task-category-select"
import { TaskActionsMenu } from "@/components/task-actions-menu"
import { TaskIndicators } from "@/components/task-indicators"
import { TaskBulkBar } from "@/components/task-bulk-bar"
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

const MAX_BULK_SELECT = 50
const COL_COUNT = 8

export function TaskListTable({
  data,
  isLoading,
  isAdmin,
  onLoadMore,
  isLoadingMore,
  groupBy = "none",
  onOpenTask,
}: {
  data: TaskListResult | undefined
  isLoading: boolean
  isAdmin: boolean
  onLoadMore: () => void
  isLoadingMore: boolean
  groupBy?: GroupByOption
  onOpenTask?: (taskId: string) => void
}) {
  const [creatingTitle, setCreatingTitle] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [showCreateRow, setShowCreateRow] = useState(false)
  const [showMobileCreateDialog, setShowMobileCreateDialog] = useState(false)
  const [createGroupKey, setCreateGroupKey] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const inputRef = useRef<HTMLInputElement>(null)
  const mobileInputRef = useRef<HTMLInputElement>(null)
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
      setShowMobileCreateDialog(false)
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
        setShowMobileCreateDialog(false)
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

  const openMobileCreate = useCallback(() => {
    setCreatingTitle("")
    setShowMobileCreateDialog(true)
    setTimeout(() => mobileInputRef.current?.focus(), 100)
  }, [])

  const tasks = data?.page ?? []
  const groups = useMemo(() => groupTasks(tasks, groupBy), [tasks, groupBy])
  const isGrouped = groupBy !== "none"
  const isEmpty = tasks.length === 0

  // Selection handlers
  const toggleSelect = useCallback((taskId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) {
        next.delete(taskId)
      } else if (next.size < MAX_BULK_SELECT) {
        next.add(taskId)
      }
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const taskIds = tasks.map((t) => t._id as string)
      const allSelected = taskIds.length > 0 && taskIds.every((id) => prev.has(id))
      if (allSelected) {
        return new Set()
      }
      // Select all up to MAX_BULK_SELECT
      return new Set(taskIds.slice(0, MAX_BULK_SELECT))
    })
  }, [tasks])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const allTaskIds = tasks.map((t) => t._id as string)
  const allSelected = allTaskIds.length > 0 && allTaskIds.every((id) => selectedIds.has(id))
  const someSelected = allTaskIds.some((id) => selectedIds.has(id))

  const hasSelection = selectedIds.size > 0

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-2">
        {/* Desktop skeleton */}
        <div className="hidden md:block space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
        {/* Mobile skeleton */}
        <div className="md:hidden space-y-2">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      </div>
    )
  }

  // Empty state
  if (isEmpty && !showCreateRow) {
    return (
      <>
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <h3 className="text-lg font-medium">No tasks yet</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            Create your first task to get started.
          </p>
          {/* Desktop: inline button */}
          <Button className="mt-4 hidden md:inline-flex" onClick={() => openCreateRow()}>
            <PlusIcon className="mr-2 size-4" />
            Create Your First Task
          </Button>
          {/* Mobile: button that opens dialog */}
          <Button className="mt-4 md:hidden" onClick={openMobileCreate}>
            <PlusIcon className="mr-2 size-4" />
            Create Your First Task
          </Button>
        </div>
        <MobileCreateDialog
          open={showMobileCreateDialog}
          onOpenChange={setShowMobileCreateDialog}
          title={creatingTitle}
          onTitleChange={setCreatingTitle}
          onKeyDown={handleCreateKeyDown}
          onCreate={handleCreate}
          isCreating={isCreating}
          inputRef={mobileInputRef}
        />
      </>
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

  const tableHeaders = (showSelectAll: boolean) => (
    <TableHeader>
      <TableRow>
        <TableHead className="w-10">
          {showSelectAll && (
            <Checkbox
              checked={allSelected ? true : someSelected ? "indeterminate" : false}
              onCheckedChange={toggleSelectAll}
              aria-label="Select all tasks"
            />
          )}
        </TableHead>
        <TableHead className="w-[35%]">Task</TableHead>
        <TableHead>Project</TableHead>
        <TableHead>Assignees</TableHead>
        <TableHead>Status</TableHead>
        <TableHead>Category</TableHead>
        <TableHead className="text-right">Time</TableHead>
        <TableHead className="w-10" />
      </TableRow>
    </TableHeader>
  )

  return (
    <div className="space-y-4">
      {/* ── Desktop: Table layout ── */}
      <div className="hidden md:block">
        {isGrouped ? (
          <div className="space-y-3">
            {groups.map((group) => (
              <GroupSection
                key={group.key}
                group={group}
                isAdmin={isAdmin}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onCreateInGroup={() => openCreateRow(group.key)}
                onOpenTask={onOpenTask}
                creationRow={
                  showCreateRow && createGroupKey === group.key
                    ? inlineCreationRow
                    : null
                }
              />
            ))}
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
              {tableHeaders(true)}
              <TableBody>
                {tasks.map((task) => (
                  <TaskRow
                    key={task._id}
                    task={task}
                    isAdmin={isAdmin}
                    isSelected={selectedIds.has(task._id)}
                    onToggleSelect={toggleSelect}
                    onOpenTask={onOpenTask}
                  />
                ))}
                {inlineCreationRow}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* ── Mobile: Card layout ── */}
      <div className="md:hidden">
        {isGrouped ? (
          <div className="space-y-3">
            {groups.map((group) => (
              <MobileGroupSection
                key={group.key}
                group={group}
                isAdmin={isAdmin}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onOpenTask={onOpenTask}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => (
              <TaskCard
                key={task._id}
                task={task}
                isAdmin={isAdmin}
                isSelected={selectedIds.has(task._id)}
                onToggleSelect={toggleSelect}
                onOpenTask={onOpenTask}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bottom area: add button + load more */}
      <div className="flex items-center justify-between">
        {/* Desktop: inline "New Task" button */}
        <div className="hidden md:block">
          {!showCreateRow ? (
            <Button variant="ghost" size="sm" onClick={() => openCreateRow()}>
              <PlusIcon className="mr-2 size-4" />
              New Task
            </Button>
          ) : (
            <div />
          )}
        </div>
        {/* Mobile: spacer (FAB handles creation) */}
        <div className="md:hidden" />

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

      {/* Mobile FAB for task creation */}
      <Button
        className="fixed bottom-6 right-6 z-40 size-14 rounded-full shadow-lg md:hidden"
        onClick={openMobileCreate}
        aria-label="Create new task"
        style={{ marginBottom: hasSelection ? "4rem" : 0 }}
      >
        <PlusIcon className="size-6" />
      </Button>

      {/* Mobile create dialog */}
      <MobileCreateDialog
        open={showMobileCreateDialog}
        onOpenChange={setShowMobileCreateDialog}
        title={creatingTitle}
        onTitleChange={setCreatingTitle}
        onKeyDown={handleCreateKeyDown}
        onCreate={handleCreate}
        isCreating={isCreating}
        inputRef={mobileInputRef}
      />

      {/* Bulk actions floating bar */}
      <TaskBulkBar
        selectedIds={[...selectedIds] as Id<"tasks">[]}
        isAdmin={isAdmin}
        onClearSelection={clearSelection}
      />
    </div>
  )
}

// ── Mobile Create Dialog ────────────────────────────────────────────────

function MobileCreateDialog({
  open,
  onOpenChange,
  title,
  onTitleChange,
  onKeyDown,
  onCreate,
  isCreating,
  inputRef,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  onTitleChange: (v: string) => void
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void
  onCreate: () => void
  isCreating: boolean
  inputRef: React.RefObject<HTMLInputElement | null>
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Task</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 pt-2">
          <Input
            ref={inputRef}
            placeholder="Task name..."
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={isCreating}
            autoFocus
          />
          <Button onClick={onCreate} disabled={isCreating || !title.trim()}>
            {isCreating ? (
              <>
                <LoaderIcon className="mr-2 size-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Task"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Desktop: Group Section ──────────────────────────────────────────────

function GroupSection({
  group,
  isAdmin,
  selectedIds,
  onToggleSelect,
  onCreateInGroup,
  onOpenTask,
  creationRow,
}: {
  group: TaskGroup
  isAdmin: boolean
  selectedIds: Set<string>
  onToggleSelect: (taskId: string) => void
  onCreateInGroup: () => void
  onOpenTask?: (taskId: string) => void
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
                <TableHead className="w-10" />
                <TableHead className="w-[35%]">Task</TableHead>
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
                <TaskRow
                  key={task._id}
                  task={task}
                  isAdmin={isAdmin}
                  isSelected={selectedIds.has(task._id)}
                  onToggleSelect={onToggleSelect}
                  onOpenTask={onOpenTask}
                />
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

// ── Mobile: Group Section ───────────────────────────────────────────────

function MobileGroupSection({
  group,
  isAdmin,
  selectedIds,
  onToggleSelect,
  onOpenTask,
}: {
  group: TaskGroup
  isAdmin: boolean
  selectedIds: Set<string>
  onToggleSelect: (taskId: string) => void
  onOpenTask?: (taskId: string) => void
}) {
  const [isOpen, setIsOpen] = useState(true)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="rounded-lg border">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
          >
            <ChevronRightIcon
              className={`size-4 shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`}
            />
            <span className="font-medium text-sm">{group.label}</span>
            <span className="text-muted-foreground text-xs">
              {group.tasks.length}
            </span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-2 px-2 pb-2">
            {group.tasks.map((task) => (
              <TaskCard
                key={task._id}
                task={task}
                isAdmin={isAdmin}
                isSelected={selectedIds.has(task._id)}
                onToggleSelect={onToggleSelect}
                onOpenTask={onOpenTask}
              />
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

// ── Desktop: Table Row ──────────────────────────────────────────────────

function TaskRow({
  task,
  isAdmin,
  isSelected,
  onToggleSelect,
  onOpenTask,
}: {
  task: EnrichedTask
  isAdmin: boolean
  isSelected: boolean
  onToggleSelect: (taskId: string) => void
  onOpenTask?: (taskId: string) => void
}) {
  return (
    <TableRow
      className="group cursor-pointer"
      data-selected={isSelected || undefined}
      onClick={() => onOpenTask?.(task._id)}
    >
      {/* Checkbox */}
      <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-center opacity-0 group-hover:opacity-100 group-data-[selected]:opacity-100 transition-opacity">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelect(task._id)}
            aria-label={`Select "${task.title}"`}
          />
        </div>
      </TableCell>

      {/* Title + indicators */}
      <TableCell className="font-medium max-w-[400px]">
        <div className="flex items-center min-w-0">
          <span className="truncate shrink">{task.title}</span>
          <TaskIndicators task={task} />
        </div>
      </TableCell>

      {/* Project */}
      <TableCell onClick={(e) => e.stopPropagation()}>
        <TaskProjectSelector
          taskId={task._id as Id<"tasks">}
          currentProjectId={task.projectId}
          currentProjectName={task.projectName}
          currentClientName={task.clientName}
        />
      </TableCell>

      {/* Assignees */}
      <TableCell onClick={(e) => e.stopPropagation()}>
        <TaskAssigneePicker
          taskId={task._id as Id<"tasks">}
          currentAssigneeIds={task.assigneeIds}
          currentAssignees={task.assignees}
        />
      </TableCell>

      {/* Status */}
      <TableCell onClick={(e) => e.stopPropagation()}>
        <TaskStatusSelect
          taskId={task._id as Id<"tasks">}
          currentStatus={task.status}
          isAdmin={isAdmin}
        />
      </TableCell>

      {/* Category */}
      <TableCell onClick={(e) => e.stopPropagation()}>
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
      <TableCell onClick={(e) => e.stopPropagation()}>
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

// ── Mobile: Task Card ───────────────────────────────────────────────────

function TaskCard({
  task,
  isAdmin,
  isSelected,
  onToggleSelect,
  onOpenTask,
}: {
  task: EnrichedTask
  isAdmin: boolean
  isSelected: boolean
  onToggleSelect: (taskId: string) => void
  onOpenTask?: (taskId: string) => void
}) {
  return (
    <div
      className="rounded-lg border bg-card p-3 space-y-2 cursor-pointer"
      data-selected={isSelected || undefined}
      onClick={() => onOpenTask?.(task._id)}
    >
      {/* Row 1: Checkbox + Title + Indicators */}
      <div className="flex items-start gap-2">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelect(task._id)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select "${task.title}"`}
          className="mt-0.5 shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 min-w-0">
            <span className="font-medium text-sm line-clamp-2 break-words">
              {task.title}
            </span>
            <TaskIndicators task={task} />
          </div>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <TaskActionsMenu
            taskId={task._id as Id<"tasks">}
            taskTitle={task.title}
            isAdmin={isAdmin}
            hasTimeEntries={task.totalMinutes > 0}
            alwaysVisible
          />
        </div>
      </div>

      {/* Row 2: Project / Client */}
      {(task.clientName || task.projectName) && (
        <p className="text-xs text-muted-foreground truncate pl-6">
          {task.clientName}{task.clientName && task.projectName ? " → " : ""}{task.projectName}
        </p>
      )}

      {/* Row 3: Status + Assignees + Category + Time */}
      <div className="flex flex-wrap items-center gap-2 pl-6">
        <TaskStatusBadge status={task.status} />

        {task.assignees?.length > 0 && (
          <TaskAssigneeAvatars assignees={task.assignees} />
        )}

        {task.workCategoryName && (
          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {task.workCategoryName}
          </span>
        )}

        {task.totalMinutes > 0 && (
          <span className="text-xs text-muted-foreground ml-auto">
            {formatDuration(task.totalMinutes)}
          </span>
        )}
      </div>
    </div>
  )
}
