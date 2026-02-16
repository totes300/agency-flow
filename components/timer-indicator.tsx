"use client"

import { useQuery, useMutation, useConvexAuth } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Square, ClipboardList } from "lucide-react"
import { toast } from "sonner"
import { formatElapsed } from "@/lib/format"
import { useTimerTick } from "@/hooks/use-timer-tick"

/**
 * Floating timer widget — bottom-right corner, only visible when timer is running.
 * Replaces the old header-based TimerIndicator.
 */
export function FloatingTimerWidget() {
  const { isAuthenticated } = useConvexAuth()
  const status = useQuery(api.timer.getStatus, isAuthenticated ? {} : "skip")
  const stopTimer = useMutation(api.timer.stop)
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleStop = useCallback(async () => {
    try {
      const result = await stopTimer({})
      if (result.durationMinutes === 0) {
        toast("Timer was under 1 minute", {
          action: {
            label: "Save as 1m",
            onClick: async () => {
              try { await stopTimer({ saveIfUnderOneMinute: true }) } catch {}
            },
          },
        })
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    }
  }, [stopTimer])

  const handleTaskClick = useCallback(() => {
    if (!status?.isRunning || !status.taskId) return
    const params = new URLSearchParams(searchParams.toString())
    params.set("task", status.taskId)
    router.push(`/tasks?${params.toString()}`)
  }, [status, router, searchParams])

  if (!status?.isRunning) return null

  return (
    <div role="status" aria-label="Active timer" className="fixed bottom-6 right-6 z-50 w-72 rounded-lg border bg-background/95 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80 md:bottom-6 md:right-6 max-md:bottom-20 max-md:right-4">
      <div className="p-3 space-y-2">
        {/* Task title + project info */}
        <button
          type="button"
          onClick={handleTaskClick}
          className="flex items-start gap-2 w-full text-left hover:opacity-80 transition-opacity"
        >
          <ClipboardList className="size-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{status.taskTitle}</p>
            {status.projectName && (
              <p className="text-xs text-muted-foreground truncate">{status.projectName}</p>
            )}
          </div>
        </button>

        {/* Elapsed + stop button */}
        <div className="flex items-center justify-between">
          <FloatingElapsed startedAt={status.startedAt!} />
          <Button size="sm" variant="outline" onClick={handleStop} className="h-7 gap-1.5 text-xs">
            <Square className="size-3" />
            Stop
          </Button>
        </div>
      </div>
    </div>
  )
}

function FloatingElapsed({ startedAt }: { startedAt: number }) {
  const now = useTimerTick()
  return (
    <span className="font-mono text-sm font-medium tabular-nums text-foreground">
      {formatElapsed(startedAt, now)}
    </span>
  )
}
