"use client"

import { useState, useRef, useCallback } from "react"
import { UiIcon } from "@/components/icons/ui-icons"
import { timeAgo } from "@/lib/task-config"
import type { EnrichedTask } from "@/lib/types"

// ── HoverIcon with popup ──────────────────────────────────────────────

interface TaskHoverIconProps {
  type: "description" | "comments" | "activity"
  task: EnrichedTask
  isDone: boolean
}

export function TaskHoverIcon({ type, task, isDone }: TaskHoverIconProps) {
  const [show, setShow] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const ref = useRef<HTMLSpanElement>(null)
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  const handleEnter = useCallback(() => {
    timeout.current = setTimeout(() => {
      if (ref.current) {
        setRect(ref.current.getBoundingClientRect())
        setShow(true)
      }
    }, 300)
  }, [])

  const handleLeave = useCallback(() => {
    if (timeout.current) clearTimeout(timeout.current)
    setShow(false)
  }, [])

  const iconType = type === "description" ? "desc" : type === "comments" ? "comment" : "activity"

  return (
    <span
      ref={ref}
      className="relative inline-flex items-center"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <span
        className="inline-flex items-center gap-[3px] px-[2px] py-[1px] rounded cursor-default transition-all duration-[120ms] leading-4"
        style={{
          color: !hasContent ? "#d1d5db" : hasNew ? "#374151" : "#9ca3af",
          fontSize: 11.5,
          fontWeight: hasNew ? 600 : 450,
          fontVariantNumeric: "tabular-nums",
          background: show && hasContent ? "#f3f4f6" : "transparent",
        }}
      >
        {hasNew && <span className="w-[5px] h-[5px] rounded-full bg-[#e8385d] shrink-0" />}
        <UiIcon type={iconType} size={12} color={!hasContent ? "#d1d5db" : hasNew ? "#374151" : "#b0b5bd"} />
        {count > 0 && <span className="text-[11px] font-semibold">{count}</span>}
      </span>

      {/* Popup */}
      {show && hasContent && rect && (
        <div
          className="fixed z-[500] bg-white border border-[#e5e7eb] rounded-[10px] shadow-[0_8px_30px_rgba(0,0,0,0.12),0_2px_6px_rgba(0,0,0,0.04)] w-[300px] max-h-[280px] overflow-hidden"
          style={{
            top: rect.bottom + 6,
            left: Math.min(rect.left, (typeof window !== "undefined" ? window.innerWidth : 1024) - 320),
            animation: "popIn 0.12s ease",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Description popup */}
          {type === "description" && (
            <div className="p-3">
              <div className="text-[10.5px] font-[650] text-[#9ca3af] uppercase tracking-[0.05em] mb-1.5">
                Description
              </div>
              <p className="text-[13px] text-[#374151] leading-[1.55] m-0 whitespace-pre-wrap">
                {task.descriptionPreview}
              </p>
            </div>
          )}

          {/* Comments popup */}
          {type === "comments" && task.latestComment && (
            <div className="p-3 overflow-y-auto max-h-[270px]">
              <div className="text-[10.5px] font-[650] text-[#9ca3af] uppercase tracking-[0.05em] mb-2">
                Comments ({task.commentCount})
              </div>
              <div className="flex gap-2 items-start">
                <UserAvatar name={task.latestComment.userName} size={22} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xs font-semibold text-[#111827]">{task.latestComment.userName}</span>
                    <span className="text-[11px] text-[#9ca3af]">{timeAgo(task.latestComment._creationTime)}</span>
                    {task.latestComment._creationTime > lastViewedAt && (
                      <span className="text-[9.5px] font-[650] text-[#e8385d] uppercase tracking-[0.03em]">new</span>
                    )}
                  </div>
                  <p className="text-[12.5px] text-[#4b5563] leading-[1.45] mt-0.5 m-0">{task.latestComment.content}</p>
                </div>
              </div>
            </div>
          )}

          {/* Activity popup */}
          {type === "activity" && task.latestActivityLog && (
            <div className="p-3">
              <div className="text-[10.5px] font-[650] text-[#9ca3af] uppercase tracking-[0.05em] mb-2">
                Recent Activity
              </div>
              {task.latestActivityLog.slice(0, 5).map((a, i) => {
                const isNew = a._creationTime > lastViewedAt
                return (
                  <div
                    key={i}
                    className="flex items-center gap-2 py-1.5"
                    style={{
                      borderBottom:
                        i < Math.min(task.latestActivityLog!.length, 5) - 1 ? "1px solid #f5f5f5" : "none",
                    }}
                  >
                    <UserAvatar name={a.userName} size={20} />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-[#111827]">
                        <span className="font-semibold">{a.userName}</span>{" "}
                        <span className="text-[#6b7280]">{a.action}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {isNew && <span className="w-[5px] h-[5px] rounded-full bg-[#e8385d]" />}
                      <span className="text-[11px] text-[#b0b5bd] whitespace-nowrap">{timeAgo(a._creationTime)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </span>
  )
}

// ── Activity text with hover popup ────────────────────────────────────

export function ActivityHover({ task }: { task: EnrichedTask }) {
  const [show, setShow] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const ref = useRef<HTMLSpanElement>(null)
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const latestActivity = task.latestActivityLog?.[0]
  if (!latestActivity) return null

  const lastViewedAt = task.lastViewedAt ?? 0
  const hasNew = task.latestActivityLog?.some((a) => a._creationTime > lastViewedAt) ?? false

  const handleEnter = () => {
    timeout.current = setTimeout(() => {
      if (ref.current) {
        setRect(ref.current.getBoundingClientRect())
        setShow(true)
      }
    }, 300)
  }
  const handleLeave = () => {
    if (timeout.current) clearTimeout(timeout.current)
    setShow(false)
  }

  return (
    <span ref={ref} className="relative inline-flex items-center" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <span
        className="text-[11.5px] italic cursor-default transition-colors duration-[120ms]"
        style={{
          color: hasNew ? "#6b7280" : "#b0b5bd",
          borderBottom: show ? "1px dotted #d1d5db" : "1px dotted transparent",
        }}
      >
        {latestActivity.userName} {latestActivity.action} {timeAgo(latestActivity._creationTime)}
      </span>

      {show && task.latestActivityLog && task.latestActivityLog.length > 0 && rect && (
        <div
          className="fixed z-[500] bg-white border border-[#e5e7eb] rounded-[10px] shadow-[0_8px_30px_rgba(0,0,0,0.12),0_2px_6px_rgba(0,0,0,0.04)] w-[290px] max-h-[260px] overflow-hidden"
          style={{
            top: rect.bottom + 6,
            left: Math.min(rect.left, (typeof window !== "undefined" ? window.innerWidth : 1024) - 310),
            animation: "popIn 0.12s ease",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-3">
            <div className="text-[10.5px] font-[650] text-[#9ca3af] uppercase tracking-[0.05em] mb-2">
              Recent Activity
            </div>
            {task.latestActivityLog.slice(0, 5).map((a, i) => {
              const isNew = a._creationTime > lastViewedAt
              return (
                <div
                  key={i}
                  className="flex items-center gap-2 py-1.5"
                  style={{
                    borderBottom:
                      i < Math.min(task.latestActivityLog!.length, 5) - 1 ? "1px solid #f5f5f5" : "none",
                  }}
                >
                  <UserAvatar name={a.userName} size={20} />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-[#111827]">
                      <span className="font-semibold">{a.userName}</span>{" "}
                      <span className="text-[#6b7280]">{a.action}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {isNew && <span className="w-[5px] h-[5px] rounded-full bg-[#e8385d]" />}
                    <span className="text-[11px] text-[#b0b5bd] whitespace-nowrap">{timeAgo(a._creationTime)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </span>
  )
}

// ── User Avatar (local) ───────────────────────────────────────────────

function UserAvatar({ name, size = 18 }: { name: string; size?: number }) {
  const hue = (name.charCodeAt(0) * 47 + (name.charCodeAt(1) || 0) * 31) % 360
  return (
    <span
      className="inline-flex items-center justify-center rounded-full shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.48,
        fontWeight: 600,
        background: `hsl(${hue}, 45%, 86%)`,
        color: `hsl(${hue}, 40%, 35%)`,
      }}
    >
      {name[0]}
    </span>
  )
}
