"use client"

import { useState, useCallback, useEffect, KeyboardEvent } from "react"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { toast } from "sonner"
import { formatDuration } from "@/lib/format"
import { parseDuration } from "@/lib/parse-duration"
import { Switch } from "@/components/ui/switch"
import { TaskStatusSelect } from "@/components/task-status-select"
import { TaskAssigneePicker } from "@/components/task-assignee-picker"
import { TaskCategorySelect } from "@/components/task-category-select"
import type { EnrichedTask } from "@/lib/types"

/**
 * Single horizontal strip of controls separated by thin vertical dividers.
 * Project is in the header. This contains: status, category, assignees,
 * billable toggle, and estimate.
 */
export function TaskDetailMetadata({
  task,
  isAdmin,
}: {
  task: EnrichedTask
  isAdmin: boolean
}) {
  const updateTask = useMutation(api.tasks.update)
  const [estimateText, setEstimateText] = useState(
    task.estimate ? formatDuration(task.estimate) : "",
  )

  // Resync estimate text when task changes (e.g. switching tasks in dialog)
  useEffect(() => {
    setEstimateText(task.estimate ? formatDuration(task.estimate) : "")
  }, [task.estimate])

  const handleBillableChange = useCallback(
    async (checked: boolean) => {
      try {
        await updateTask({ id: task._id as Id<"tasks">, billable: checked })
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Something went wrong")
      }
    },
    [updateTask, task._id],
  )

  const handleEstimateSave = useCallback(async () => {
    const trimmed = estimateText.trim()
    if (!trimmed) {
      try {
        await updateTask({ id: task._id as Id<"tasks">, estimate: null })
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Something went wrong")
      }
      return
    }
    const minutes = parseDuration(trimmed)
    if (minutes === null) {
      toast.error("Invalid duration. Try: 1h 30m, 90m, 1.5h, 1:30")
      setEstimateText(task.estimate ? formatDuration(task.estimate) : "")
      return
    }
    try {
      await updateTask({ id: task._id as Id<"tasks">, estimate: minutes })
      setEstimateText(formatDuration(minutes))
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    }
  }, [estimateText, updateTask, task._id, task.estimate])

  const handleEstimateKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault()
        handleEstimateSave()
      }
    },
    [handleEstimateSave],
  )

  return (
    <div className="flex items-center flex-wrap py-0.5">
      {/* Status */}
      <TaskStatusSelect
        taskId={task._id as Id<"tasks">}
        currentStatus={task.status}
        isAdmin={isAdmin}
      />

      <div className="mx-3 w-px h-5 bg-border" aria-hidden="true" />

      {/* Category */}
      <TaskCategorySelect
        taskId={task._id as Id<"tasks">}
        projectId={task.projectId}
        currentCategoryId={task.workCategoryId}
        currentCategoryName={task.workCategoryName}
      />

      <div className="mx-3 w-px h-5 bg-border" aria-hidden="true" />

      {/* Assignees with names */}
      <TaskAssigneePicker
        taskId={task._id as Id<"tasks">}
        currentAssigneeIds={task.assigneeIds}
        currentAssignees={task.assignees.filter((a): a is NonNullable<typeof a> => a !== null)}
        showNames
      />

      <div className="mx-3 w-px h-5 bg-border" aria-hidden="true" />

      {/* Estimate */}
      <input
        value={estimateText}
        onChange={(e) => setEstimateText(e.target.value)}
        onBlur={handleEstimateSave}
        onKeyDown={handleEstimateKeyDown}
        placeholder="Estimate…"
        aria-label="Estimate"
        spellCheck={false}
        className="w-24 text-sm tabular-nums bg-transparent outline-none border-b border-transparent hover:border-muted-foreground/30 focus:border-muted-foreground/50 transition-colors placeholder:text-muted-foreground pb-0.5"
      />

      <div className="mx-3 w-px h-5 bg-border" aria-hidden="true" />

      {/* Billable */}
      <div className="flex items-center gap-1.5">
        <Switch
          checked={task.billable ?? true}
          onCheckedChange={handleBillableChange}
          aria-label="Toggle billable"
          className="scale-[0.8]"
        />
        <span className="text-xs text-muted-foreground">
          {task.billable !== false ? "Billable" : "Non-billable"}
        </span>
      </div>
    </div>
  )
}
