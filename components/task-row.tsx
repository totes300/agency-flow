"use client"

import { useState, useCallback, memo } from "react"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { toast } from "sonner"
import { StatusIcon } from "@/components/icons/status-icons"
import { UiIcon } from "@/components/icons/ui-icons"
import { STATUS_CONFIG, STATUS_ORDER, formatDueDate, type TaskStatusKey } from "@/lib/task-config"
import { formatDistanceToNow } from "@/lib/format"
import { TaskTimerPill } from "@/components/task-timer-pill"
import { TaskHoverIcon, ActivityHover } from "@/components/task-hover-popup"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { EnrichedTask } from "@/lib/types"

interface TaskRowProps {
  task: EnrichedTask
  isAdmin: boolean
  isSelected: boolean
  onToggleSelect: (id: Id<"tasks">) => void
  onOpenTask: (id: string) => void
}

export const TaskRow = memo(function TaskRow({
  task,
  isAdmin,
  isSelected,
  onToggleSelect,
  onOpenTask,
}: TaskRowProps) {
  const [hovered, setHovered] = useState(false)
  const isDone = task.status === "done"
  const hasUnread = !!(task.lastEditedAt && task.lastViewedAt && task.lastEditedAt > task.lastViewedAt)
  const snippet = task.descriptionPreview
    ? task.descriptionPreview.length > 60
      ? task.descriptionPreview.slice(0, 60) + "\u2026"
      : task.descriptionPreview
    : ""

  const statusCfg = STATUS_CONFIG[task.status as TaskStatusKey] ?? STATUS_CONFIG.inbox
  const isToday = task.status === "today"

  // Assignee display
  const assignee = task.assignees?.[0]
  const assigneeName = assignee && "name" in assignee ? (assignee as { name: string }).name : null

  // Activity
  const latestActivity = task.latestActivityLog?.[0]

  const handleClick = useCallback(() => {
    onOpenTask(task._id)
  }, [onOpenTask, task._id])

  const handleCheckboxClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onToggleSelect(task._id)
    },
    [onToggleSelect, task._id],
  )

  // Row background
  let bgClass = "bg-white hover:bg-[#f8f9fb]"
  if (isSelected) bgClass = "bg-[#f3f4f6]"
  else if (isToday) bgClass = "bg-[#fbf7f6] hover:bg-[#f7f2f1]"

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
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="row"
      aria-selected={isSelected}
      className={`flex items-center gap-0 border-b border-[#f3f4f6] cursor-pointer transition-all duration-[80ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset ${bgClass} ${isDone ? "opacity-45" : ""} md:flex-row`}
    >
      {/* Left zone: checkbox + status */}
      <div className="flex items-center gap-1 py-0 px-1 pl-2.5 shrink-0">
        {/* Checkbox */}
        <div
          onClick={handleCheckboxClick}
          className={`w-4 h-4 rounded-[3px] shrink-0 flex items-center justify-center cursor-pointer transition-all duration-100 ${
            isSelected
              ? "bg-[#111827] border-none"
              : "border-[1.5px] border-[#d1d5db] bg-transparent"
          }`}
          role="checkbox"
          aria-checked={isSelected}
          aria-label={`Select task: ${task.title}`}
        >
          {isSelected && (
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
              <path d="M4 8.5L7 11.5L12 5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>

        {/* Status icon with popover */}
        <TaskStatusPopover taskId={task._id} currentStatus={task.status} isAdmin={isAdmin} />
      </div>

      {/* Middle: content */}
      <div className="flex-1 min-w-0 py-2.5 px-2">
        {/* Title line + hover icons + snippet */}
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span
            className={`text-[13.5px] leading-[1.35] tracking-[-0.01em] shrink-0 max-w-[50%] overflow-hidden text-ellipsis whitespace-nowrap ${
              isDone
                ? "font-normal text-[#9ca3af] line-through"
                : hasUnread
                  ? "font-[650] text-[#111827]"
                  : "font-medium text-[#111827]"
            }`}
          >
            {task.title}
          </span>

          {/* Hover icons inline */}
          <span className="inline-flex gap-0.5 shrink-0">
            <TaskHoverIcon type="description" task={task} isDone={isDone} />
            <TaskHoverIcon type="comments" task={task} isDone={isDone} />
          </span>

          {/* Description snippet */}
          {snippet && (
            <span className="text-[12.5px] font-normal text-[#9ca3af] overflow-hidden text-ellipsis whitespace-nowrap min-w-0 flex-1">
              {" \u2014 "}
              {snippet}
            </span>
          )}
        </div>

        {/* Meta line */}
        <div className="flex items-center gap-[5px] mt-1 text-xs text-[#9ca3af] leading-[1.3] flex-wrap">
          {task.clientName && (
            <>
              <span className="text-[#6b7280] font-[480]">{task.clientName}</span>
              <span className="text-[#d1d5db]">&rsaquo;</span>
            </>
          )}
          {task.projectName && <span>{task.projectName}</span>}
          {task.workCategoryName && (
            <>
              <span className="text-[#d1d5db]">&middot;</span>
              <span className="text-[#9ca3af] font-[450] text-[11.5px]">{task.workCategoryName}</span>
            </>
          )}
          {assigneeName ? (
            <>
              <span className="text-[#d1d5db]">&middot;</span>
              <span className="inline-flex items-center gap-[3px]">
                <UserAvatar name={assigneeName} size={14} />
                <span className="text-[#6b7280]">{assigneeName}</span>
              </span>
            </>
          ) : (
            <>
              <span className="text-[#d1d5db]">&middot;</span>
              <span className="text-[#d97706] italic text-[11.5px]">Unassigned</span>
            </>
          )}
          {latestActivity && (
            <>
              <span className="text-[#e5e7eb] mx-[1px]">&mdash;</span>
              <ActivityHover task={task} />
            </>
          )}
        </div>
      </div>

      {/* Right zone: due date + timer */}
      <div className="hidden md:flex items-center gap-2.5 shrink-0 py-2 pr-3.5 pl-2">
        {task.dueDate != null && !isDone && (() => {
          const due = formatDueDate(task.dueDate)
          if (!due) return null
          return (
            <span
              className="inline-flex items-center gap-[3px] text-[11px] whitespace-nowrap"
              style={{ color: due.color, fontWeight: due.urgent ? 550 : 450 }}
            >
              <UiIcon type="calendar" size={11} color={due.color} />
              {due.text}
            </span>
          )
        })()}
        <TaskTimerPill taskId={task._id} totalMinutes={task.totalMinutes} isDone={isDone} hasProject={!!task.projectId} />
      </div>
    </div>
  )
})

// ── Status Popover ────────────────────────────────────────────────────────

function TaskStatusPopover({
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
        >
          <StatusIcon status={currentStatus} size={18} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[146px] p-1 rounded-[10px] shadow-lg border border-[#e5e7eb]"
        align="start"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "popIn 0.12s ease" }}
      >
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
              className="flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-[12.5px] font-medium cursor-pointer transition-colors hover:bg-[#f6f8fa] disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                color: isCur ? cfg.color : "#374151",
                background: isCur ? cfg.bg : undefined,
              }}
            >
              <StatusIcon status={key} size={14} />
              {cfg.label}
            </button>
          )
        })}
      </PopoverContent>
    </Popover>
  )
}

// ── User Avatar ──────────────────────────────────────────────────────────

function UserAvatar({ name, size = 18 }: { name: string; size?: number }) {
  const hue = (name.charCodeAt(0) * 47 + (name.charCodeAt(1) || 0) * 31) % 360
  return (
    <span
      className="inline-flex items-center justify-center rounded-full shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.48,
        fontWeight: 600,
        background: `hsl(${hue}, 45%, 86%)`,
        color: `hsl(${hue}, 40%, 35%)`,
      }}
    >
      {name[0]}
    </span>
  )
}
