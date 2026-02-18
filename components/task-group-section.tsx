"use client"

import { memo } from "react"
import { Id } from "@/convex/_generated/dataModel"
import { Badge } from "@/components/ui/badge"
import { TaskRow } from "@/components/task-row"
import { InlineAddTask } from "@/components/task-inline-add"
import { STATUS_CONFIG, type TaskStatusKey } from "@/lib/task-config"
import type { EnrichedTask } from "@/lib/types"

interface TaskGroupSectionProps {
  groupKey: string
  rawKey?: string
  tasks: EnrichedTask[]
  isAdmin: boolean
  selectedIds: Set<string>
  onToggleSelect: (id: Id<"tasks">) => void
  onOpenTask: (id: Id<"tasks">) => void
}

function isValidStatusKey(key?: string): key is TaskStatusKey {
  return key !== undefined && key in STATUS_CONFIG
}

export const TaskGroupSection = memo(function TaskGroupSection({
  groupKey,
  rawKey,
  tasks,
  isAdmin,
  selectedIds,
  onToggleSelect,
  onOpenTask,
}: TaskGroupSectionProps) {
  return (
    <section aria-label={groupKey || "Tasks"}>
      {groupKey && (
        <div className="py-2 px-4 bg-task-surface-subtle border-b border-task-border-light text-xs font-bold text-task-foreground-tertiary flex items-center gap-1.5 sticky top-0 z-10">
          {groupKey}
          <Badge
            variant="secondary"
            className="h-4 min-w-[18px] px-1.5 text-[10px] font-medium bg-task-border text-task-muted-light rounded-full"
          >
            {tasks.length}
          </Badge>
        </div>
      )}
      {tasks.map((task) => (
        <TaskRow
          key={task._id}
          task={task}
          isAdmin={isAdmin}
          isSelected={selectedIds.has(task._id)}
          onToggleSelect={onToggleSelect}
          onOpenTask={onOpenTask}
        />
      ))}
      <InlineAddTask
        placeholder={groupKey ? `Add task to ${groupKey}\u2026` : "Add a new task\u2026"}
        defaultStatus={isValidStatusKey(rawKey) ? rawKey : undefined}
      />
    </section>
  )
})
