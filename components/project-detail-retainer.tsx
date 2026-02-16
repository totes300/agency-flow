"use client"

import { Id } from "@/convex/_generated/dataModel"
import { RetainerView } from "@/components/retainer-view"

interface RetainerProjectDetailProps {
  projectId: Id<"projects">
  currency: string
  isAdmin: boolean
}

export function RetainerProjectDetail({
  projectId,
  currency,
  isAdmin,
}: RetainerProjectDetailProps) {
  return (
    <RetainerView
      projectId={projectId}
      currency={currency}
      isAdmin={isAdmin}
    />
  )
}
