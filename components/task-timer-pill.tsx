"use client"

import { useState, useCallback, memo } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { toast } from "sonner"
import { Pause, Play, Clock } from "lucide-react"
import { formatDuration, formatElapsed } from "@/lib/format"
import { useTimerTick } from "@/hooks/use-timer-tick"
import { cn } from "@/lib/utils"

interface TaskTimerPillProps {
  taskId: Id<"tasks">
  totalMinutes: number
  isDone: boolean
  hasProject: boolean
}

export const TaskTimerPill = memo(function TaskTimerPill({
  taskId,
  totalMinutes,
  isDone,
  hasProject,
}: TaskTimerPillProps) {
  const timerStatus = useQuery(api.timer.getStatus) ?? null

  const isRunningOnThis =
    timerStatus !== null &&
    timerStatus.isRunning === true &&
    "taskId" in timerStatus &&
    timerStatus.taskId === taskId

  if (isRunningOnThis && timerStatus !== null && "startedAt" in timerStatus) {
    return (
      <ActiveTimerPill
        taskId={taskId}
        startedAt={timerStatus.startedAt}
      />
    )
  }

  return (
    <IdleTimerPill
      taskId={taskId}
      totalMinutes={totalMinutes}
      isDone={isDone}
      hasProject={hasProject}
    />
  )
})

// ── Active Timer (subscribes to tick) ─────────────────────────────────

const ActiveTimerPill = memo(function ActiveTimerPill({
  taskId,
  startedAt,
}: {
  taskId: Id<"tasks">
  startedAt: number
}) {
  const now = useTimerTick()
  const stopTimer = useMutation(api.timer.stop)
  const createTimeEntry = useMutation(api.timeEntries.create)

  const elapsed = formatElapsed(startedAt, now)

  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()
      try {
        const result = await stopTimer({})
        if (result.durationMinutes === 0) {
          toast("Timer was under 1 minute", {
            action: {
              label: "Save as 1m",
              onClick: async () => {
                try {
                  const today = new Date()
                  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
                  await createTimeEntry({ taskId, durationMinutes: 1, date: dateStr })
                } catch (err: unknown) {
                  toast.error(err instanceof Error ? err.message : "Failed to save time entry")
                }
              },
            },
          })
        }
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Something went wrong")
      }
    },
    [taskId, stopTimer, createTimeEntry],
  )

  return (
    <button
      onClick={handleClick}
      aria-label="Stop timer"
      className="inline-flex items-center gap-[5px] py-[3px] px-2 pl-1.5 rounded-lg border border-task-timer bg-task-timer-bg text-task-timer text-[12.5px] font-[650] cursor-pointer transition-all duration-150 whitespace-nowrap tabular-nums animate-[timerPulse_2s_ease-in-out_infinite]"
    >
      <Pause size={12} className="text-task-timer" />
      <span aria-live="polite" aria-atomic="true">{elapsed}</span>
    </button>
  )
})

// ── Idle Timer ────────────────────────────────────────────────────────

function IdleTimerPill({
  taskId,
  totalMinutes,
  isDone,
  hasProject,
}: {
  taskId: Id<"tasks">
  totalMinutes: number
  isDone: boolean
  hasProject: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const startTimer = useMutation(api.timer.start)

  const hasTime = totalMinutes > 0
  const display = formatDuration(totalMinutes)

  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()
      if (isDone || !hasProject) return
      try {
        const result = await startTimer({ taskId })
        if (result.previousTaskTitle) {
          toast.info(
            `Stopped timer on "${result.previousTaskTitle}" (${formatDuration(result.previousElapsedMinutes ?? 0)})`,
          )
        }
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Something went wrong")
      }
    },
    [taskId, isDone, hasProject, startTimer],
  )

  return (
    <button
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "inline-flex items-center gap-[5px] py-[3px] px-2 pl-1.5 rounded-lg border transition-all duration-150 whitespace-nowrap text-[12.5px] tabular-nums",
        isDone
          ? "border-task-border bg-task-surface-subtle text-task-muted-lighter cursor-default font-[450]"
          : hovered
            ? "border-task-muted-lighter bg-task-surface-subtle text-task-foreground-secondary font-[550] cursor-pointer"
            : hasTime
              ? "border-task-border bg-background text-task-foreground-secondary font-[550] cursor-pointer"
              : "border-task-border bg-background text-task-muted-lightest font-[450] cursor-pointer",
        !hasProject && !isDone && "cursor-not-allowed",
      )}
      disabled={isDone || !hasProject}
      title={!hasProject ? "Assign a project to track time" : undefined}
      aria-label={isDone ? `Tracked time: ${display}` : "Start timer"}
    >
      {!isDone && (
        <Play
          size={12}
          className={cn(
            hovered
              ? "text-task-foreground-secondary"
              : hasTime
                ? "text-task-muted"
                : "text-task-muted-lightest",
          )}
        />
      )}
      {isDone && <Clock size={11} className="text-task-muted-lighter" />}
      <span>{display}</span>
    </button>
  )
}

// ── Running Timer Header Indicator ────────────────────────────────────

export function RunningTimerIndicator() {
  const timerStatus = useQuery(api.timer.getStatus)

  if (!timerStatus?.isRunning || !("startedAt" in timerStatus)) return null

  return <RunningTimerDisplay startedAt={timerStatus.startedAt} />
}

function RunningTimerDisplay({ startedAt }: { startedAt: number }) {
  const now = useTimerTick()
  const elapsed = formatElapsed(startedAt, now)

  return (
    <div
      className="flex items-center gap-1.5 py-1 px-3 bg-task-timer-bg rounded-lg border border-task-timer-border text-xs font-semibold text-task-timer animate-[timerPulse_2s_ease-in-out_infinite]"
      role="status"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-task-timer animate-[unreadPulse_1s_ease_infinite]" />
      {elapsed}
    </div>
  )
}
