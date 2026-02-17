"use client"

import { useState, useCallback, useRef, KeyboardEvent } from "react"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { toast } from "sonner"
import { UiIcon } from "@/components/icons/ui-icons"
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
  const inputRef = useRef<HTMLInputElement>(null)
  const createTask = useMutation(api.tasks.create)

  const submit = useCallback(async () => {
    if (!title.trim()) return
    try {
      const taskId = await createTask({
        title: title.trim(),
        status: defaultStatus ?? "inbox",
        projectId: defaultProjectId,
      })
      setTitle("")
      onCreated?.(taskId)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create task")
    }
  }, [title, defaultStatus, defaultProjectId, createTask, onCreated])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault()
        submit()
      }
    },
    [submit],
  )

  return (
    <div className="border-b border-[#f0f0f0] bg-white">
      <div className="flex items-center gap-2 py-[7px] px-4">
        <div className="w-[18px] h-[18px] rounded-full border-[1.5px] border-dashed border-[#d1d5db] flex items-center justify-center shrink-0">
          <UiIcon type="plus" size={9} color="#9ca3af" />
        </div>
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="border-none outline-none flex-1 py-1 px-0 text-[13px] font-inherit bg-transparent text-[#111827] placeholder:text-[#9ca3af]"
        />
        {title && (
          <button
            onClick={submit}
            className="py-[3px] px-3 rounded-[6px] border-none bg-[#111827] text-white text-[11.5px] font-semibold cursor-pointer font-inherit"
          >
            Add
          </button>
        )}
      </div>
    </div>
  )
}
