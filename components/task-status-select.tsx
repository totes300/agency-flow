"use client"

import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { toast } from "sonner"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { useState } from "react"

const STATUS_OPTIONS = [
  { value: "inbox", label: "Inbox", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  { value: "today", label: "Today", color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  { value: "next_up", label: "Next Up", color: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300" },
  { value: "admin_review", label: "Review", color: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" },
  { value: "stuck", label: "Stuck", color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
  { value: "done", label: "Done", color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
] as const

type TaskStatus = (typeof STATUS_OPTIONS)[number]["value"]

export function getStatusConfig(status: string) {
  return STATUS_OPTIONS.find((s) => s.value === status) ?? STATUS_OPTIONS[0]
}

export function TaskStatusBadge({ status }: { status: string }) {
  const config = getStatusConfig(status)
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  )
}

export function TaskStatusSelect({
  taskId,
  currentStatus,
  isAdmin,
}: {
  taskId: Id<"tasks">
  currentStatus: string
  isAdmin: boolean
}) {
  const [open, setOpen] = useState(false)
  const updateStatus = useMutation(api.tasks.updateStatus)

  async function handleSelect(status: TaskStatus) {
    setOpen(false)
    try {
      await updateStatus({ id: taskId, status })
    } catch (err: unknown) {
      toast.error((err as Error).message)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="rounded-md transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={(e) => e.stopPropagation()}
        >
          <TaskStatusBadge status={currentStatus} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-40 p-1" align="start" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col gap-0.5">
          {STATUS_OPTIONS.map((opt) => {
            const disabled = opt.value === "done" && !isAdmin
            return (
              <button
                key={opt.value}
                type="button"
                disabled={disabled}
                onClick={() => handleSelect(opt.value)}
                className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 ${
                  currentStatus === opt.value ? "bg-accent" : ""
                }`}
              >
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${opt.color}`}>
                  {opt.label}
                </span>
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
