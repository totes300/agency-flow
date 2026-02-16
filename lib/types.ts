import type { Id } from "@/convex/_generated/dataModel"

/**
 * Enriched task shape returned from tasks.list and tasks.get queries.
 * Used throughout the frontend for type-safe task rendering.
 */
export type EnrichedTask = {
  _id: Id<"tasks">
  _creationTime: number
  title: string
  status: "inbox" | "today" | "next_up" | "admin_review" | "stuck" | "done"
  projectId?: Id<"projects">
  assigneeIds: Id<"users">[]
  workCategoryId?: Id<"workCategories">
  estimate?: number
  billable: boolean
  isArchived: boolean
  parentTaskId?: Id<"tasks">
  description?: unknown
  sortOrder?: number
  clientUpdateText?: string
  // Enriched fields from list query
  projectName: string | null
  clientName: string | null
  clientId: string | null
  projectBillingType: string | null
  assignees: Array<{ _id: Id<"users">; name: string; avatarUrl?: string } | null>
  workCategoryName: string | null
  totalMinutes: number
  // Fields only on list query (not get)
  subtaskCount?: number
  completedSubtaskCount?: number
  commentCount?: number
  hasDescription?: boolean
  latestComment?: {
    userName: string
    avatarUrl?: string
    content: string
    _creationTime: number
  }
  subtaskPreview?: Array<{ _id: string; title: string; status: string }>
  descriptionPreview?: string
  // Fields only on get query (not list)
  subtasks?: Array<{
    _id: string
    title: string
    status: string
    sortOrder?: number
    _creationTime: number
  }>
  subtaskTotalMinutes?: number
}
