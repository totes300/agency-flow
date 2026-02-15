"use client"

import { useRouter } from "next/navigation"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"
import { FileTextIcon, MessageSquareIcon, ListChecksIcon } from "lucide-react"
import { formatDistanceToNow } from "@/lib/format"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EnrichedTask = Record<string, any>

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

/**
 * Renders inline indicator icons next to the task title:
 * - has-description icon
 * - comment count badge
 * - subtask progress (e.g., "2/5")
 *
 * Desktop: HoverCard popovers on hover with preview content.
 * Click navigates to task detail.
 * Mobile: no hover — tap goes straight to detail.
 */
export function TaskIndicators({ task }: { task: EnrichedTask }) {
  const hasDescription = task.hasDescription
  const commentCount = task.commentCount ?? 0
  const subtaskCount = task.subtaskCount ?? 0
  const completedSubtaskCount = task.completedSubtaskCount ?? 0

  const showAny = hasDescription || commentCount > 0 || subtaskCount > 0
  if (!showAny) return null

  return (
    <span className="inline-flex items-center gap-1.5 ml-2">
      {hasDescription && (
        <DescriptionIndicator task={task} />
      )}
      {commentCount > 0 && (
        <CommentIndicator task={task} />
      )}
      {subtaskCount > 0 && (
        <SubtaskIndicator task={task} />
      )}
    </span>
  )
}

function DescriptionIndicator({ task }: { task: EnrichedTask }) {
  const router = useRouter()
  const taskId = task._id as string

  return (
    <HoverCard openDelay={300} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors"
          onClick={(e) => {
            e.stopPropagation()
            router.push(`/tasks/${taskId}`)
          }}
          aria-label="Has description"
        >
          <FileTextIcon className="size-3.5" />
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        className="w-72 hidden md:block"
        align="start"
        side="bottom"
      >
        <div className="space-y-2">
          <p className="text-sm font-medium">Description</p>
          <div className="border-t pt-2">
            {task.descriptionPreview ? (
              <p className="text-sm text-muted-foreground line-clamp-4">
                {task.descriptionPreview}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                No preview available
              </p>
            )}
          </div>
          <button
            type="button"
            className="text-xs text-primary hover:underline"
            onClick={(e) => {
              e.stopPropagation()
              router.push(`/tasks/${taskId}`)
            }}
          >
            View full description &rarr;
          </button>
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}

function CommentIndicator({ task }: { task: EnrichedTask }) {
  const router = useRouter()
  const taskId = task._id as string
  const commentCount = task.commentCount ?? 0
  const latest = task.latestComment

  return (
    <HoverCard openDelay={300} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-0.5 text-muted-foreground hover:text-foreground transition-colors"
          onClick={(e) => {
            e.stopPropagation()
            router.push(`/tasks/${taskId}`)
          }}
          aria-label={`${commentCount} comment${commentCount !== 1 ? "s" : ""}`}
        >
          <MessageSquareIcon className="size-3.5" />
          <span className="text-[11px] leading-none">{commentCount}</span>
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        className="w-72 hidden md:block"
        align="start"
        side="bottom"
      >
        <div className="space-y-2">
          <p className="text-sm font-medium">
            {commentCount} comment{commentCount !== 1 ? "s" : ""}
          </p>
          {latest && (
            <div className="border-t pt-2 space-y-1.5">
              <div className="flex items-center gap-2">
                <Avatar className="size-5">
                  <AvatarImage src={latest.avatarUrl} alt={latest.userName} />
                  <AvatarFallback className="text-[9px]">
                    {getInitials(latest.userName ?? "?")}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs font-medium">{latest.userName}</span>
                {latest._creationTime && (
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(latest._creationTime)}
                  </span>
                )}
              </div>
              {latest.content && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  &ldquo;{latest.content}&rdquo;
                </p>
              )}
            </div>
          )}
          <button
            type="button"
            className="text-xs text-primary hover:underline"
            onClick={(e) => {
              e.stopPropagation()
              router.push(`/tasks/${taskId}`)
            }}
          >
            Open comments &rarr;
          </button>
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}

function SubtaskIndicator({ task }: { task: EnrichedTask }) {
  const router = useRouter()
  const taskId = task._id as string
  const subtaskCount = task.subtaskCount ?? 0
  const completedSubtaskCount = task.completedSubtaskCount ?? 0
  const subtaskPreview = task.subtaskPreview as
    | { _id: string; title: string; status: string }[]
    | undefined

  return (
    <HoverCard openDelay={300} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-0.5 text-muted-foreground hover:text-foreground transition-colors"
          onClick={(e) => {
            e.stopPropagation()
            router.push(`/tasks/${taskId}`)
          }}
          aria-label={`${completedSubtaskCount} of ${subtaskCount} subtasks completed`}
        >
          <ListChecksIcon className="size-3.5" />
          <span className="text-[11px] leading-none">
            {completedSubtaskCount}/{subtaskCount}
          </span>
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        className="w-72 hidden md:block"
        align="start"
        side="bottom"
      >
        <div className="space-y-2">
          <p className="text-sm font-medium">
            Subtasks ({completedSubtaskCount}/{subtaskCount} completed)
          </p>
          {subtaskPreview && subtaskPreview.length > 0 && (
            <div className="border-t pt-2 space-y-1">
              {subtaskPreview.map((sub) => (
                <div key={sub._id} className="flex items-center gap-2">
                  <Checkbox
                    checked={sub.status === "done"}
                    disabled
                    className="size-3.5"
                  />
                  <span
                    className={`text-sm truncate ${sub.status === "done" ? "line-through text-muted-foreground" : ""}`}
                  >
                    {sub.title}
                  </span>
                </div>
              ))}
              {subtaskCount > 5 && (
                <p className="text-xs text-muted-foreground">
                  +{subtaskCount - 5} more
                </p>
              )}
            </div>
          )}
          <button
            type="button"
            className="text-xs text-primary hover:underline"
            onClick={(e) => {
              e.stopPropagation()
              router.push(`/tasks/${taskId}`)
            }}
          >
            View all subtasks &rarr;
          </button>
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
