"use client"

import { useState, useCallback, useRef, KeyboardEvent } from "react"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { toast } from "sonner"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { TaskStatusKey } from "@/lib/task-config"

interface InlineAddTaskProps {
  placeholder?: string
  defaultStatus?: TaskStatusKey
  defaultProjectId?: Id<"projects">
  onCreated?: (taskId: Id<"tasks">) => void
}

export function InlineAddTask({
  placeholder = "Add a new task\u2026",
  defaultStatus,
  defaultProjectId,
  onCreated,
}: InlineAddTaskProps) {
  const [title, setTitle] = useState("")
  const [isPending, setIsPending] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const createTask = useMutation(api.tasks.create)

  const submit = useCallback(async () => {
    if (!title.trim() || isPending) return
    setIsPending(true)
    try {
      const taskId = await createTask({
        title: title.trim(),
        status: defaultStatus ?? "inbox",
        projectId: defaultProjectId,
      })
      setTitle("")
      inputRef.current?.focus()
      onCreated?.(taskId)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create task")
    } finally {
      setIsPending(false)
    }
  }, [title, isPending, defaultStatus, defaultProjectId, createTask, onCreated])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault()
        submit()
      } else if (e.key === "Escape") {
        setTitle("")
        inputRef.current?.blur()
      }
    },
    [submit],
  )

  return (
    <div className="border-b border-task-border-light bg-background">
      <div className="flex items-center gap-2 py-1.5 px-4">
        <div className="w-[18px] h-[18px] rounded-full border-[1.5px] border-dashed border-task-separator flex items-center justify-center shrink-0">
          <Plus size={9} className="text-task-muted-light" />
        </div>
        <Input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label={placeholder}
          className="border-none shadow-none outline-none flex-1 py-1 px-0 text-sm font-inherit bg-transparent text-task-foreground h-auto rounded-none focus-visible:ring-0 placeholder:text-task-muted-light"
        />
        {title && (
          <Button
            type="button"
            onClick={submit}
            size="xs"
            disabled={isPending}
            className="text-xs font-semibold"
          >
            {isPending ? "Adding\u2026" : "Add"}
          </Button>
        )}
      </div>
    </div>
  )
}
