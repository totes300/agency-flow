"use client"

import { useState, useRef, useCallback, KeyboardEvent } from "react"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { toast } from "sonner"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowUpIcon, ArrowDownIcon, PlusIcon, LoaderIcon } from "lucide-react"

type Subtask = {
  _id: string
  title: string
  status: string
  sortOrder?: number
  _creationTime: number
}

export function TaskDetailSubtasks({
  taskId,
  subtasks,
  isAdmin,
}: {
  taskId: Id<"tasks">
  subtasks: Subtask[]
  isAdmin: boolean
}) {
  const [newTitle, setNewTitle] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const createTask = useMutation(api.tasks.create)
  const updateStatus = useMutation(api.tasks.updateStatus)
  const swapOrder = useMutation(api.tasks.swapSubtaskOrder)

  const doneCount = subtasks.filter((s) => s.status === "done").length
  const totalCount = subtasks.length

  const handleCreate = useCallback(async () => {
    const trimmed = newTitle.trim()
    if (!trimmed) return
    setIsCreating(true)
    try {
      await createTask({ title: trimmed, parentTaskId: taskId })
      setNewTitle("")
      inputRef.current?.focus()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setIsCreating(false)
    }
  }, [newTitle, createTask, taskId])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleCreate()
      }
    },
    [handleCreate],
  )

  const handleToggle = useCallback(
    async (subtask: Subtask) => {
      const newStatus = subtask.status === "done" ? "inbox" : "done"
      try {
        await updateStatus({
          id: subtask._id as Id<"tasks">,
          status: newStatus as "inbox" | "done",
        })
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Something went wrong")
      }
    },
    [updateStatus],
  )

  const handleMove = useCallback(
    async (subtaskId: string, direction: "up" | "down") => {
      try {
        await swapOrder({
          taskId: subtaskId as Id<"tasks">,
          direction,
        })
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Something went wrong")
      }
    },
    [swapOrder],
  )

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">
        Subtasks{" "}
        {totalCount > 0 && (
          <span className="text-muted-foreground">
            ({doneCount}/{totalCount} done)
          </span>
        )}
      </h3>

      {subtasks.length > 0 && (
        <div className="space-y-1">
          {subtasks.map((subtask, idx) => (
            <div
              key={subtask._id}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 group"
            >
              <Checkbox
                checked={subtask.status === "done"}
                onCheckedChange={() => handleToggle(subtask)}
                aria-label={`Mark "${subtask.title}" as ${subtask.status === "done" ? "incomplete" : "complete"}`}
              />
              <span
                className={`flex-1 text-sm ${subtask.status === "done" ? "line-through text-muted-foreground" : ""}`}
              >
                {subtask.title}
              </span>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  onClick={() => handleMove(subtask._id, "up")}
                  disabled={idx === 0}
                  aria-label="Move up"
                >
                  <ArrowUpIcon className="size-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  onClick={() => handleMove(subtask._id, "down")}
                  disabled={idx === subtasks.length - 1}
                  aria-label="Move down"
                >
                  <ArrowDownIcon className="size-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <PlusIcon className="size-4 shrink-0 text-muted-foreground" />
        <Input
          ref={inputRef}
          placeholder="Add subtask..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isCreating}
          className="h-8 border-none bg-transparent shadow-none focus-visible:ring-0"
        />
        {isCreating && (
          <LoaderIcon className="size-4 shrink-0 animate-spin text-muted-foreground" />
        )}
      </div>
    </div>
  )
}
