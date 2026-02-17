"use client"

import { Id } from "@/convex/_generated/dataModel"
import { TaskRow } from "@/components/task-row"
import { InlineAddTask } from "@/components/task-inline-add"
import type { EnrichedTask } from "@/lib/types"
import type { TaskStatusKey } from "@/lib/task-config"

interface TaskGroupSectionProps {
  groupKey: string
  rawKey?: string
  tasks: EnrichedTask[]
  isAdmin: boolean
  selectedIds: Set<string>
  onToggleSelect: (id: Id<"tasks">) => void
  onOpenTask: (id: string) => void
  groupBy: string
}

export function TaskGroupSection({
  groupKey,
  rawKey,
  tasks,
  isAdmin,
  selectedIds,
  onToggleSelect,
  onOpenTask,
  groupBy,
}: TaskGroupSectionProps) {
  return (
    <div>
      {groupKey && (
        <div className="py-2 px-4 bg-[#f9fafb] border-b border-[#f0f0f0] text-xs font-[650] text-[#4b5563] flex items-center gap-1.5 sticky top-0 z-10">
          {groupKey}
          <span className="text-[10.5px] text-[#9ca3af] font-medium bg-[#e5e7eb] rounded-[10px] px-1.5 leading-4">
            {tasks.length}
          </span>
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
        defaultStatus={(rawKey as TaskStatusKey) ?? undefined}
      />
    </div>
  )
}
