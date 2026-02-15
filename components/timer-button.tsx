"use client"

import { useCallback } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Play, Square } from "lucide-react"
import { toast } from "sonner"
import { formatDuration } from "@/lib/format"

interface TimerButtonProps {
  taskId: Id<"tasks">
  taskTitle: string
  hasProject: boolean
}

export function TimerButton({ taskId, taskTitle, hasProject }: TimerButtonProps) {
  const timerStatus = useQuery(api.timer.getStatus)
  const startTimer = useMutation(api.timer.start)
  const stopTimer = useMutation(api.timer.stop)

  const isRunningOnThis = timerStatus?.isRunning && timerStatus.taskId === taskId

  const handleClick = useCallback(async () => {
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
                  await stopTimer({ saveIfUnderOneMinute: true })
                } catch {}
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
      toast.error((err as Error).message)
    }
  }, [isRunningOnThis, taskId, hasProject, startTimer, stopTimer])

  const button = (
    <Button
      variant="ghost"
      size="icon"
      className="size-7"
      onClick={handleClick}
      disabled={!hasProject}
      aria-label={isRunningOnThis ? "Stop timer" : "Start timer"}
    >
      {isRunningOnThis ? (
        <Square className="size-3.5 text-destructive" />
      ) : (
        <Play className="size-3.5" />
      )}
    </Button>
  )

  if (!hasProject) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent>Assign a project to start timer</TooltipContent>
      </Tooltip>
    )
  }

  return button
}
