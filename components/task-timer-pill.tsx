"use client"

import { useState, useCallback, memo } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { toast } from "sonner"
import { UiIcon } from "@/components/icons/ui-icons"
import { formatDuration, formatElapsed } from "@/lib/format"
import { useTimerTick } from "@/hooks/use-timer-tick"

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
    timerStatus?.isRunning === true && "taskId" in timerStatus && timerStatus.taskId === taskId

  if (isRunningOnThis && "startedAt" in timerStatus!) {
    return (
      <ActiveTimerPill
        taskId={taskId}
        totalMinutes={totalMinutes}
        startedAt={timerStatus.startedAt}
        hasProject={hasProject}
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

function ActiveTimerPill({
  taskId,
  totalMinutes,
  startedAt,
  hasProject,
}: {
  taskId: Id<"tasks">
  totalMinutes: number
  startedAt: number
  hasProject: boolean
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
      className="inline-flex items-center gap-[5px] py-[3px] px-2 pl-1.5 rounded-lg border border-[#c25852] bg-[#fdf5f4] text-[#c25852] text-[12.5px] font-[650] cursor-pointer transition-all duration-150 whitespace-nowrap"
      style={{
        fontVariantNumeric: "tabular-nums",
        animation: "timerPulse 2s ease-in-out infinite",
      }}
    >
      <span className="flex w-3 h-3">
        <UiIcon type="pause" size={12} color="#c25852" />
      </span>
      <span>{elapsed}</span>
    </button>
  )
}

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
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  const display = `${h}:${String(m).padStart(2, "0")}`

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
      className="inline-flex items-center gap-[5px] py-[3px] px-2 pl-1.5 rounded-lg border transition-all duration-150 whitespace-nowrap"
      style={{
        borderColor: isDone ? "#e5e7eb" : hovered ? "#b0b5bd" : "#e0e2e5",
        background: isDone ? "#f9fafb" : hovered ? "#f6f7f8" : "#fff",
        color: isDone ? "#b0b5bd" : hasTime ? "#374151" : "#c2c7ce",
        fontSize: 12.5,
        fontWeight: hasTime ? 550 : 450,
        fontVariantNumeric: "tabular-nums",
        cursor: isDone ? "default" : hasProject ? "pointer" : "not-allowed",
      }}
      disabled={isDone || !hasProject}
      title={!hasProject ? "Assign a project to track time" : undefined}
      aria-label={isDone ? `Tracked time: ${h}h ${m}m` : "Start timer"}
    >
      {!isDone && (
        <span className="flex w-3 h-3">
          <UiIcon type="play" size={12} color={hovered ? "#374151" : hasTime ? "#6b7280" : "#c2c7ce"} />
        </span>
      )}
      {isDone && <UiIcon type="clock" size={11} color="#b0b5bd" />}
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
      className="flex items-center gap-1.5 py-1 px-3 bg-[#fdf5f4] rounded-lg border border-[#e8c8c5] text-xs font-semibold text-[#c25852]"
      style={{ animation: "timerPulse 2s ease-in-out infinite" }}
      role="status"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-[#c25852]" style={{ animation: "unreadPulse 1s ease infinite" }} />
      {elapsed}
    </div>
  )
}
