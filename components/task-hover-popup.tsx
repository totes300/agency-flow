"use client"

import { memo } from "react"
import { AlignLeft, MessageSquare } from "lucide-react"
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card"
import { UserAvatar } from "@/components/user-avatar"
import { timeAgo } from "@/lib/task-config"
import { cn } from "@/lib/utils"
import type { EnrichedTask } from "@/lib/types"

// ── Shared Activity Content ──────────────────────────────────────────────

function ActivityPopupContent({
  activities,
  lastViewedAt,
}: {
  activities: NonNullable<EnrichedTask["latestActivityLog"]>
  lastViewedAt: number
}) {
  const entries = activities.slice(0, 5)
  return (
    <div className="p-3">
      <div className="text-[10.5px] font-bold text-task-muted-light uppercase tracking-wide mb-2">
        Recent Activity
      </div>
      {entries.map((a, i) => {
        const isNew = a._creationTime > lastViewedAt
        return (
          <div
            key={a._creationTime}
            className={cn(
              "flex items-center gap-2 py-1.5",
              i < entries.length - 1 && "border-b border-task-border-lighter",
            )}
          >
            <UserAvatar name={a.userName} size={20} />
            <div className="flex-1 min-w-0">
              <span className="text-xs text-task-foreground">
                <span className="font-semibold">{a.userName}</span>{" "}
                <span className="text-task-muted">{a.action}</span>
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {isNew && <span className="w-[5px] h-[5px] rounded-full bg-task-accent" />}
              <span className="text-[11px] text-task-muted-lighter whitespace-nowrap">{timeAgo(a._creationTime)}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── HoverIcon with popup ──────────────────────────────────────────────

interface TaskHoverIconProps {
  type: "description" | "comments" | "activity"
  task: EnrichedTask
}

const ICON_MAP = {
  description: AlignLeft,
  comments: MessageSquare,
} as const

export const TaskHoverIcon = memo(function TaskHoverIcon({ type, task }: TaskHoverIconProps) {
  const hasContent =
    type === "description"
      ? !!task.descriptionPreview
      : type === "comments"
        ? (task.commentCount ?? 0) > 0
        : (task.latestActivityLog?.length ?? 0) > 0

  const lastViewedAt = task.lastViewedAt ?? 0
  const hasNew =
    type === "comments"
      ? !!(task.latestComment && task.latestComment._creationTime > lastViewedAt)
      : type === "activity"
        ? !!(task.latestActivityLog?.some((a) => a._creationTime > lastViewedAt))
        : false

  const count =
    type === "comments" ? (task.commentCount ?? 0) : type === "activity" ? (task.latestActivityLog?.length ?? 0) : 0

  const Icon = type === "description" ? ICON_MAP.description : ICON_MAP.comments
  const label = type === "description" ? "Description preview" : type === "comments" ? `${count} comments` : "Recent activity"

  return (
    <HoverCard openDelay={300} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className="relative inline-flex items-center appearance-none bg-transparent border-0 p-0"
          aria-label={label}
        >
          <span
            className={cn(
              "inline-flex items-center gap-[3px] px-[2px] py-[1px] rounded cursor-default transition-all duration-[120ms] leading-4 text-xs tabular-nums",
              !hasContent
                ? "text-task-separator"
                : hasNew
                  ? "font-semibold text-task-foreground-secondary"
                  : "font-normal text-task-muted-light",
            )}
          >
            {hasNew && <span className="w-[5px] h-[5px] rounded-full bg-task-accent shrink-0" />}
            <Icon
              size={12}
              className={cn(
                !hasContent
                  ? "text-task-separator"
                  : hasNew
                    ? "text-task-foreground-secondary"
                    : "text-task-muted-lighter",
              )}
            />
            {count > 0 && <span className="text-[11px] font-semibold">{count}</span>}
          </span>
        </button>
      </HoverCardTrigger>

      {hasContent && (
        <HoverCardContent
          align="start"
          sideOffset={6}
          className="w-[300px] max-h-[280px] overflow-hidden p-0 rounded-lg shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Description popup */}
          {type === "description" && (
            <div className="p-3">
              <div className="text-[10.5px] font-bold text-task-muted-light uppercase tracking-wide mb-1.5">
                Description
              </div>
              <p className="text-sm text-task-foreground-secondary leading-relaxed m-0 whitespace-pre-wrap">
                {task.descriptionPreview}
              </p>
            </div>
          )}

          {/* Comments popup */}
          {type === "comments" && task.latestComment && (
            <div className="p-3 overflow-y-auto max-h-[270px]">
              <div className="text-[10.5px] font-bold text-task-muted-light uppercase tracking-wide mb-2">
                Comments ({task.commentCount})
              </div>
              <div className="flex gap-2 items-start">
                <UserAvatar name={task.latestComment.userName} size={22} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xs font-semibold text-task-foreground">{task.latestComment.userName}</span>
                    <span className="text-[11px] text-task-muted-light">{timeAgo(task.latestComment._creationTime)}</span>
                    {task.latestComment._creationTime > lastViewedAt && (
                      <span className="text-[9.5px] font-bold text-task-accent uppercase tracking-wide">new</span>
                    )}
                  </div>
                  <p className="text-xs text-task-foreground-tertiary leading-relaxed mt-0.5 m-0">{task.latestComment.content}</p>
                </div>
              </div>
            </div>
          )}

          {/* Activity popup */}
          {type === "activity" && task.latestActivityLog && task.latestActivityLog.length > 0 && (
            <ActivityPopupContent activities={task.latestActivityLog} lastViewedAt={lastViewedAt} />
          )}
        </HoverCardContent>
      )}
    </HoverCard>
  )
})

// ── Activity text with hover popup ────────────────────────────────────

export const ActivityHover = memo(function ActivityHover({ task }: { task: EnrichedTask }) {
  const latestActivity = task.latestActivityLog?.[0]
  if (!latestActivity) return null

  const lastViewedAt = task.lastViewedAt ?? 0
  const hasNew = task.latestActivityLog?.some((a) => a._creationTime > lastViewedAt) ?? false

  return (
    <HoverCard openDelay={300} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className="relative inline-flex items-center appearance-none bg-transparent border-0 p-0"
          aria-label="View recent activity"
        >
          <span
            className={cn(
              "text-xs italic cursor-default transition-colors duration-[120ms] border-b border-dotted border-transparent hover:border-task-separator",
              hasNew ? "text-task-muted" : "text-task-muted-lighter",
            )}
          >
            {latestActivity.userName} {latestActivity.action} {timeAgo(latestActivity._creationTime)}
          </span>
        </button>
      </HoverCardTrigger>

      {task.latestActivityLog && task.latestActivityLog.length > 0 && (
        <HoverCardContent
          align="start"
          sideOffset={6}
          className="w-[290px] max-h-[260px] overflow-hidden p-0 rounded-lg shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <ActivityPopupContent activities={task.latestActivityLog} lastViewedAt={lastViewedAt} />
        </HoverCardContent>
      )}
    </HoverCard>
  )
})
