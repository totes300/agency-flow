"use client"

import { useQuery, useMutation, useConvexAuth } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useState, useEffect, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Square, Clock } from "lucide-react"
import { toast } from "sonner"
import { useIsMobile } from "@/hooks/use-mobile"

export function TimerIndicator() {
  const { isAuthenticated } = useConvexAuth()
  const status = useQuery(api.timer.getStatus, isAuthenticated ? {} : "skip")
  const stopTimer = useMutation(api.timer.stop)
  const router = useRouter()
  const searchParams = useSearchParams()
  const isMobile = useIsMobile()
  const [elapsed, setElapsed] = useState("")

  useEffect(() => {
    if (!status?.isRunning || !status.startedAt) {
      setElapsed("")
      return
    }

    const update = () => {
      const diff = Math.max(0, Date.now() - status.startedAt!)
      const totalSeconds = Math.floor(diff / 1000)
      const h = Math.floor(totalSeconds / 3600)
      const m = Math.floor((totalSeconds % 3600) / 60)
      const s = totalSeconds % 60
      if (h > 0) {
        setElapsed(`${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`)
      } else {
        setElapsed(`${m}:${String(s).padStart(2, "0")}`)
      }
    }

    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [status?.isRunning, status?.startedAt])

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
      toast.error((err as Error).message)
    }
  }, [stopTimer])

  const handleTaskClick = useCallback(() => {
    if (!status?.isRunning || !status.taskId) return
    const params = new URLSearchParams(searchParams.toString())
    params.set("task", status.taskId)
    router.push(`/tasks?${params.toString()}`)
  }, [status, router, searchParams])

  if (!status?.isRunning) return null

  // Mobile: fixed bottom bar
  if (isMobile) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 py-2">
        <div className="flex items-center gap-3">
          <Clock className="size-4 text-primary shrink-0 animate-pulse" />
          <button onClick={handleTaskClick} className="flex-1 min-w-0 text-left">
            <p className="text-sm font-medium truncate">{status.taskTitle}</p>
            {status.projectName && (
              <p className="text-xs text-muted-foreground truncate">{status.projectName}</p>
            )}
          </button>
          <span className="font-mono text-sm tabular-nums shrink-0">{elapsed}</span>
          <Button size="sm" variant="destructive" onClick={handleStop}>
            <Square className="size-3.5" />
          </Button>
        </div>
      </div>
    )
  }

  // Desktop: inline in header
  return (
    <div className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
      <Clock className="size-3.5 text-primary animate-pulse" />
      <button onClick={handleTaskClick} className="max-w-[160px] truncate text-left hover:underline">
        {status.taskTitle}
      </button>
      <span className="font-mono tabular-nums text-muted-foreground">{elapsed}</span>
      <Button size="icon" variant="ghost" className="size-6" onClick={handleStop}>
        <Square className="size-3" />
      </Button>
    </div>
  )
}
