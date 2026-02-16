"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { toast } from "sonner"
import { formatDuration, formatDate } from "@/lib/format"
import { parseDuration } from "@/lib/parse-duration"
import { useUndoAction } from "@/hooks/use-undo-action"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ChevronDown, MoreHorizontal, Pencil, Trash2 } from "lucide-react"

interface TimeEntryListProps {
  taskId: Id<"tasks">
  /** Wraps in a collapsible section (timer dropdown). Default false. */
  collapsible?: boolean
  /** Number of entries to show initially. Default 5. */
  initialCount?: number
  /** Link at bottom when collapsed (e.g. "Show all entries (X more)"). */
  onShowAll?: () => void
}

export function TimeEntryList({
  taskId,
  collapsible = false,
  initialCount = 5,
  onShowAll,
}: TimeEntryListProps) {
  if (collapsible) {
    return (
      <CollapsibleTimeEntryList
        taskId={taskId}
        initialCount={initialCount}
        onShowAll={onShowAll}
      />
    )
  }

  return (
    <ExpandedTimeEntryList
      taskId={taskId}
      initialCount={initialCount}
    />
  )
}

// ── Always-visible list (task detail) ─────────────────────────────────────

function ExpandedTimeEntryList({
  taskId,
  initialCount,
}: {
  taskId: Id<"tasks">
  initialCount: number
}) {
  const [numItems, setNumItems] = useState(initialCount)
  const entries = useQuery(api.timeEntries.list, {
    taskId,
    paginationOpts: { numItems },
  })

  const page = entries?.page ?? []
  const isDone = entries?.isDone ?? true

  const handleLoadMore = useCallback(() => {
    setNumItems((prev) => prev + initialCount)
  }, [initialCount])

  if (entries && page.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-2">No entries yet</p>
    )
  }

  return (
    <div className="rounded-lg border divide-y">
      {page.map((entry: any) => (
        <TimeEntryRow key={entry._id} entry={entry} />
      ))}
      {!isDone && (
        <div className="px-3 py-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground h-7"
            onClick={handleLoadMore}
          >
            Load More
          </Button>
        </div>
      )}
    </div>
  )
}

// ── Collapsible list (timer dropdown) ─────────────────────────────────────

function CollapsibleTimeEntryList({
  taskId,
  initialCount,
  onShowAll,
}: {
  taskId: Id<"tasks">
  initialCount: number
  onShowAll?: () => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const entries = useQuery(
    api.timeEntries.list,
    isOpen ? { taskId, paginationOpts: { numItems: initialCount } } : "skip",
  )

  const page = entries?.page ?? []
  const isDone = entries?.isDone ?? true

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground border-t hover:bg-muted/50 transition-colors"
        >
          <span>Time Entries</span>
          <ChevronDown className={`size-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-4 pb-3 divide-y">
          {page.length === 0 && (
            <p className="text-xs text-muted-foreground py-2">No entries yet</p>
          )}
          {page.map((entry: any) => (
            <TimeEntryRow key={entry._id} entry={entry} compact />
          ))}
          {!isDone && onShowAll && (
            <button
              type="button"
              className="w-full text-xs text-muted-foreground hover:text-foreground text-center py-2 transition-colors"
              onClick={onShowAll}
            >
              Show all entries&hellip;
            </button>
          )}
          {!isDone && !onShowAll && (
            <p className="text-xs text-muted-foreground text-center py-2">
              Show all entries&hellip;
            </p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

// ── Single entry row with inline edit + delete ────────────────────────────

function TimeEntryRow({ entry, compact }: { entry: any; compact?: boolean }) {
  const updateEntry = useMutation(api.timeEntries.update)
  const removeEntry = useMutation(api.timeEntries.remove)
  const { execute: undoExecute } = useUndoAction()

  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState("")
  const editInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing) {
      editInputRef.current?.focus()
      editInputRef.current?.select()
    }
  }, [isEditing])

  const handleStartEdit = useCallback(() => {
    setEditValue(formatDuration(entry.durationMinutes))
    setIsEditing(true)
  }, [entry.durationMinutes])

  const handleEditSave = useCallback(async () => {
    const minutes = parseDuration(editValue)
    if (!minutes || minutes <= 0) {
      toast.error("Enter a valid duration")
      setIsEditing(false)
      return
    }
    try {
      await updateEntry({ id: entry._id as Id<"timeEntries">, durationMinutes: minutes })
      toast.success(`Updated to ${formatDuration(minutes)}`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    }
    setIsEditing(false)
  }, [editValue, updateEntry, entry._id])

  const handleDelete = useCallback(() => {
    undoExecute({
      id: `delete-entry-${entry._id}`,
      message: `Deleted ${formatDuration(entry.durationMinutes)} entry`,
      action: async () => {
        await removeEntry({ id: entry._id as Id<"timeEntries"> })
      },
    })
  }, [undoExecute, removeEntry, entry._id, entry.durationMinutes])

  const padding = compact ? "py-2" : "px-3 py-2.5"

  if (isEditing) {
    return (
      <div className={`flex items-center gap-1.5 ${padding}`}>
        <Input
          ref={editInputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleEditSave()
            if (e.key === "Escape") setIsEditing(false)
          }}
          onBlur={handleEditSave}
          className="h-6 text-xs flex-1"
        />
      </div>
    )
  }

  return (
    <div className={`group/entry text-xs ${padding}`}>
      <div className="flex items-center gap-2">
        <span className="font-semibold tabular-nums shrink-0">
          {formatDuration(entry.durationMinutes)}
        </span>
        <span className="text-muted-foreground shrink-0">
          {formatDate(entry.date)}
        </span>
        <span className="text-muted-foreground truncate">
          &middot; {entry.userName}
        </span>
        <div className="ml-auto shrink-0 opacity-0 group-hover/entry:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center justify-center size-5 rounded hover:bg-muted transition-colors"
              >
                <MoreHorizontal className="size-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-32">
              <DropdownMenuItem onClick={handleStartEdit}>
                <Pencil className="size-3 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={handleDelete}
              >
                <Trash2 className="size-3 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {entry.note && (
        <p className="text-muted-foreground mt-0.5 leading-snug">
          {entry.note}
        </p>
      )}
    </div>
  )
}
