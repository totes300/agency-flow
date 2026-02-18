"use client"

import { useState, useCallback, memo } from "react"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { toast } from "sonner"
import { Calendar } from "lucide-react"
import { StatusIcon } from "@/components/icons/status-icons"
import { STATUS_CONFIG, STATUS_ORDER, formatDueDate, type TaskStatusKey } from "@/lib/task-config"
import { TaskTimerPill } from "@/components/task-timer-pill"
import { TaskHoverIcon, ActivityHover } from "@/components/task-hover-popup"
import { UserAvatar } from "@/components/user-avatar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import type { EnrichedTask } from "@/lib/types"

const SNIPPET_MAX_LENGTH = 60

interface TaskRowProps {
  task: EnrichedTask
  isAdmin: boolean
  isSelected: boolean
  onToggleSelect: (id: Id<"tasks">) => void
  onOpenTask: (id: Id<"tasks">) => void
}

export const TaskRow = memo(function TaskRow({
  task,
  isAdmin,
  isSelected,
  onToggleSelect,
  onOpenTask,
}: TaskRowProps) {
  const isDone = task.status === "done"
  const hasUnread = !!task.lastEditedAt && (!task.lastViewedAt || task.lastEditedAt > task.lastViewedAt)
  const snippet = task.descriptionPreview
    ? task.descriptionPreview.length > SNIPPET_MAX_LENGTH
      ? task.descriptionPreview.slice(0, SNIPPET_MAX_LENGTH) + "\u2026"
      : task.descriptionPreview
    : ""

  const isToday = task.status === "today"

  // Assignee display
  const assignee = task.assignees?.[0]
  const assigneeName = assignee?.name ?? null

  // Activity
  const latestActivity = task.latestActivityLog?.[0]

  const handleClick = useCallback(() => {
    onOpenTask(task._id)
  }, [onOpenTask, task._id])

  const handleCheckboxClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
    },
    [],
  )

  const handleCheckedChange = useCallback(() => {
    onToggleSelect(task._id)
  }, [onToggleSelect, task._id])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        handleClick()
      }
    },
    [handleClick],
  )

  return (
    <div
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="listitem"
      aria-label={task.title}
      aria-selected={isSelected}
      className={cn(
        "flex items-center gap-0 border-b border-task-border-lighter cursor-pointer transition-all duration-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset md:flex-row",
        isSelected
          ? "bg-task-surface"
          : isToday
            ? "bg-task-surface-warm hover:bg-task-surface-warm-hover"
            : "bg-background hover:bg-task-surface-hover",
        isDone && "opacity-45",
      )}
    >
      {/* Left zone: checkbox + status */}
      <div className="flex items-center gap-1 py-0 pl-3 pr-1 shrink-0" onClick={handleCheckboxClick}>
        <Checkbox
          checked={isSelected}
          onCheckedChange={handleCheckedChange}
          aria-label={`Select task: ${task.title}`}
          className="size-4 rounded border-task-separator data-checked:bg-task-foreground data-checked:border-task-foreground"
        />

        {/* Status icon with popover */}
        <TaskStatusPopover taskId={task._id} currentStatus={task.status} isAdmin={isAdmin} />
      </div>

      {/* Middle: content */}
      <div className="flex-1 min-w-0 py-2.5 px-2">
        {/* Title line + hover icons + snippet */}
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span
            className={cn(
              "text-sm leading-snug tracking-tight shrink-0 max-w-[50%] overflow-hidden text-ellipsis whitespace-nowrap",
              isDone
                ? "font-normal text-task-muted-light line-through"
                : hasUnread
                  ? "font-bold text-task-foreground"
                  : "font-medium text-task-foreground",
            )}
          >
            {task.title}
          </span>

          {/* Hover icons inline */}
          <span className="inline-flex gap-0.5 shrink-0">
            <TaskHoverIcon type="description" task={task} />
            <TaskHoverIcon type="comments" task={task} />
          </span>

          {/* Description snippet */}
          {snippet && (
            <span className="text-xs font-normal text-task-muted-light overflow-hidden text-ellipsis whitespace-nowrap min-w-0 flex-1">
              {" \u2014 "}
              {snippet}
            </span>
          )}
        </div>

        {/* Meta line */}
        <div className="flex items-center gap-1 mt-1 text-xs text-task-muted-light leading-snug flex-wrap">
          {task.clientName && (
            <>
              <span className="text-task-muted font-medium">{task.clientName}</span>
              <span className="text-task-separator">&rsaquo;</span>
            </>
          )}
          {task.projectName && <span>{task.projectName}</span>}
          {task.workCategoryName && (
            <>
              <span className="text-task-separator">&middot;</span>
              <span className="text-task-muted-light text-xs">{task.workCategoryName}</span>
            </>
          )}
          {assigneeName ? (
            <>
              <span className="text-task-separator">&middot;</span>
              <span className="inline-flex items-center gap-[3px]">
                <UserAvatar name={assigneeName} size={14} />
                <span className="text-task-muted">{assigneeName}</span>
              </span>
            </>
          ) : (
            <>
              <span className="text-task-separator">&middot;</span>
              <span className="text-task-warning italic text-xs">Unassigned</span>
            </>
          )}
          {latestActivity && (
            <>
              <span className="text-task-border mx-px">&mdash;</span>
              <ActivityHover task={task} />
            </>
          )}
        </div>
      </div>

      {/* Right zone: due date + timer */}
      <div className="hidden md:flex items-center gap-2.5 shrink-0 py-2 pr-3.5 pl-2">
        <DueDateBadge dueDate={task.dueDate} isDone={isDone} />
        <TaskTimerPill taskId={task._id} totalMinutes={task.totalMinutes} isDone={isDone} hasProject={!!task.projectId} />
      </div>
    </div>
  )
})

// ── Due Date Badge ──────────────────────────────────────────────────────

function DueDateBadge({ dueDate, isDone }: { dueDate?: number; isDone: boolean }) {
  if (dueDate == null || isDone) return null
  const due = formatDueDate(dueDate)
  if (!due) return null

  return (
    <span
      className="inline-flex items-center gap-[3px] text-[11px] whitespace-nowrap"
      style={{ color: due.color, fontWeight: due.urgent ? 600 : 400 }}
    >
      <Calendar size={11} style={{ color: due.color }} />
      {due.text}
    </span>
  )
}

// ── Status Popover ────────────────────────────────────────────────────────

const TaskStatusPopover = memo(function TaskStatusPopover({
  taskId,
  currentStatus,
  isAdmin,
}: {
  taskId: Id<"tasks">
  currentStatus: string
  isAdmin: boolean
}) {
  const [open, setOpen] = useState(false)
  const updateStatus = useMutation(api.tasks.updateStatus)

  async function handleSelect(status: TaskStatusKey) {
    setOpen(false)
    try {
      await updateStatus({ id: taskId, status })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="p-0.5 rounded cursor-pointer"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`Task status: ${STATUS_CONFIG[currentStatus as TaskStatusKey]?.label ?? currentStatus}`}
        >
          <StatusIcon status={currentStatus} size={18} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-36 p-1 rounded-lg shadow-lg border border-task-border animate-in fade-in-0 zoom-in-95 duration-100"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <div role="listbox" aria-label="Task status">
          {STATUS_ORDER.map((key) => {
            const cfg = STATUS_CONFIG[key]
            const isCur = currentStatus === key
            const disabled = key === "done" && !isAdmin
            return (
              <button
                key={key}
                type="button"
                role="option"
                aria-selected={isCur}
                disabled={disabled}
                onClick={() => handleSelect(key)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium cursor-pointer transition-colors hover:bg-task-surface-subtle disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  color: isCur ? cfg.color : undefined,
                  background: isCur ? cfg.bg : undefined,
                }}
              >
                <StatusIcon status={key} size={14} />
                {cfg.label}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
})
