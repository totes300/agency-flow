"use client"

import { Id } from "@/convex/_generated/dataModel"
import { RetainerView } from "@/components/retainer-view"

interface RetainerProjectDetailProps {
  projectId: Id<"projects">
  currency: string
  isAdmin: boolean
  onOpenTask?: (taskId: string) => void
}

export function RetainerProjectDetail({
  projectId,
  currency,
  isAdmin,
  onOpenTask,
}: RetainerProjectDetailProps) {
  return (
    <RetainerView
      projectId={projectId}
      currency={currency}
      isAdmin={isAdmin}
      onOpenTask={onOpenTask}
    />
  )
}
