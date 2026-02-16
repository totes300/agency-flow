"use client"

import { useCallback, useState } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { Play, Square, ChevronDown } from "lucide-react"
import { toast } from "sonner"
import { formatDuration, formatElapsed } from "@/lib/format"
import { useTimerTick } from "@/hooks/use-timer-tick"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { AddTimeSection } from "@/components/add-time-section"
import { TimeEntryList } from "@/components/time-entry-list"

// Timer status shape from the query
export type TimerStatus =
  | { isRunning: false }
  | { isRunning: true; taskId: string; taskTitle: string; projectName: string | null; startedAt: number }

interface TimerCapsuleProps {
  taskId: Id<"tasks">
  taskTitle: string
  hasProject: boolean
  totalMinutes?: number
}

/**
 * Compact timer capsule: play/stop + time + chevron dropdown.
 * Self-subscribes to timer status (Convex deduplicates the subscription).
 * Only the active capsule calls useTimerTick — other capsules are static.
 */
export function TimerCapsule({ taskId, taskTitle, hasProject, totalMinutes = 0 }: TimerCapsuleProps) {
  const timerStatus = useQuery(api.timer.getStatus) ?? null
  const startTimer = useMutation(api.timer.start)
  const stopTimer = useMutation(api.timer.stop)
  const createTimeEntry = useMutation(api.timeEntries.create)
  const [popoverOpen, setPopoverOpen] = useState(false)

  const isRunningOnThis = timerStatus?.isRunning === true && "taskId" in timerStatus && timerStatus.taskId === taskId
  const startedAt = isRunningOnThis && "startedAt" in timerStatus ? timerStatus.startedAt : null

  const handleToggle = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()
      if (!hasProject) return
      try {
        if (isRunningOnThis) {
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
        } else {
          const result = await startTimer({ taskId })
          if (result.previousTaskTitle) {
            toast.info(
              `Stopped timer on "${result.previousTaskTitle}" (${formatDuration(result.previousElapsedMinutes ?? 0)})`,
            )
          }
        }
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Something went wrong")
      }
    },
    [isRunningOnThis, taskId, hasProject, startTimer, stopTimer],
  )

  const handleChevronClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (!hasProject) return
    setPopoverOpen((prev) => !prev)
  }, [hasProject])

  const timeDisplay = totalMinutes > 0 ? formatDuration(totalMinutes) : "—"

  // ── Active: running capsule ──
  if (isRunningOnThis && startedAt) {
    return (
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <div
          className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 h-7 pl-0.5 pr-1 text-xs transition-colors hover:bg-emerald-100 dark:hover:bg-emerald-950/50 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={handleToggle}
            className="flex items-center justify-center size-6 rounded-full bg-emerald-100 dark:bg-emerald-900/50 hover:bg-emerald-200 dark:hover:bg-emerald-800/50 transition-colors"
            aria-label="Stop timer"
          >
            <Square className="size-3 text-emerald-600 dark:text-emerald-400" />
          </button>
          <ActiveElapsed startedAt={startedAt} />
          <PopoverTrigger asChild>
            <button
              type="button"
              onClick={handleChevronClick}
              className="flex items-center justify-center size-5 rounded-full hover:bg-emerald-200/50 dark:hover:bg-emerald-800/30 transition-colors"
              aria-label="Timer options"
            >
              <ChevronDown className="size-3 text-emerald-600/70 dark:text-emerald-400/70" />
            </button>
          </PopoverTrigger>
        </div>
        <PopoverContent align="end" className="w-80 p-0" onClick={(e) => e.stopPropagation()}>
          <TimerDropdownContent taskId={taskId} totalMinutes={totalMinutes} />
        </PopoverContent>
      </Popover>
    )
  }

  // ── Disabled: no project ──
  if (!hasProject) {
    return (
      <div
        className="inline-flex items-center gap-1 rounded-full bg-muted/40 h-7 pl-0.5 pr-1 text-xs opacity-40 cursor-not-allowed shrink-0"
        title="Assign a project to track time"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="flex items-center justify-center size-6 rounded-full bg-muted">
          <Play className="size-3 text-muted-foreground ml-0.5" />
        </span>
        <span className="text-muted-foreground font-medium">—</span>
        <span className="flex items-center justify-center size-5">
          <ChevronDown className="size-3 text-muted-foreground/50" />
        </span>
      </div>
    )
  }

  // ── Idle: has project ──
  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <div
        className="inline-flex items-center gap-1 rounded-full bg-muted/40 hover:bg-muted h-7 pl-0.5 pr-1 text-xs transition-colors shrink-0 group/capsule"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleToggle}
          className="flex items-center justify-center size-6 rounded-full bg-emerald-50 dark:bg-emerald-950/40 group-hover/capsule:bg-emerald-100 dark:group-hover/capsule:bg-emerald-900/50 transition-colors"
          aria-label="Start timer"
        >
          <Play className="size-3 text-emerald-600 dark:text-emerald-400 ml-0.5" />
        </button>
        <span className="font-medium tabular-nums text-foreground/70">{timeDisplay}</span>
        <PopoverTrigger asChild>
          <button
            type="button"
            onClick={handleChevronClick}
            className="flex items-center justify-center size-5 rounded-full hover:bg-muted-foreground/10 transition-colors"
            aria-label="Timer options"
          >
            <ChevronDown className="size-3 text-muted-foreground/50" />
          </button>
        </PopoverTrigger>
      </div>
      <PopoverContent align="end" className="w-80 p-0" onClick={(e) => e.stopPropagation()}>
        <TimerDropdownContent taskId={taskId} totalMinutes={totalMinutes} />
      </PopoverContent>
    </Popover>
  )
}

// ── Active elapsed display (subscribes to tick) ─────────────────────────

function ActiveElapsed({ startedAt }: { startedAt: number }) {
  const now = useTimerTick()
  return (
    <span className="font-mono font-medium tabular-nums text-emerald-700 dark:text-emerald-300 px-1">
      {formatElapsed(startedAt, now)}
    </span>
  )
}

// ── Dropdown Popover Content ────────────────────────────────────────────

function TimerDropdownContent({
  taskId,
  totalMinutes,
}: {
  taskId: Id<"tasks">
  totalMinutes: number
}) {
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <span className="text-sm text-muted-foreground">Total Time</span>
        <span className="text-sm font-semibold tabular-nums">
          {totalMinutes > 0 ? formatDuration(totalMinutes) : "\u2014"}
        </span>
      </div>

      {/* Quick Add (shared) */}
      <div className="px-4 py-3">
        <AddTimeSection taskId={taskId} hasProject compact />
      </div>

      {/* Time Entries (shared, collapsible) */}
      <TimeEntryList taskId={taskId} collapsible initialCount={3} />
    </div>
  )
}
