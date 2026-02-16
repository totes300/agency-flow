"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { toast } from "sonner"
import { useIsMobile } from "@/hooks/use-mobile"
import { useDebouncedSave } from "@/hooks/use-debounced-save"
import { formatDuration, formatDistanceToNow } from "@/lib/format"
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetClose,
  SheetTitle,
} from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { XIcon, ClockIcon, ActivityIcon } from "lucide-react"
import type { EnrichedTask } from "@/lib/types"
import { TaskDetailMetadata } from "@/components/task-detail-metadata"
import { TaskDetailSubtasks } from "@/components/task-detail-subtasks"
import { TaskProjectSelector } from "@/components/task-project-selector"
import { TiptapEditor } from "@/components/tiptap-editor"
import { TimerCapsule } from "@/components/timer-button"
import { TaskDetailAttachments } from "@/components/task-detail-attachments"
import { AddTimeSection } from "@/components/add-time-section"
import { TimeEntryList } from "@/components/time-entry-list"
import { TaskDetailComments } from "@/components/task-detail-comments"

export function TaskDetailDialog({
  taskId,
  open,
  onOpenChange,
}: {
  taskId: Id<"tasks"> | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const isMobile = useIsMobile()
  const task = useQuery(api.tasks.get, taskId ? { id: taskId } : "skip")
  const me = useQuery(api.users.getMe)
  const updateTask = useMutation(api.tasks.update)
  const updateDescription = useMutation(api.tasks.updateDescription)

  const [title, setTitle] = useState("")
  const titleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isAdmin = me?.role === "admin"

  useEffect(() => {
    if (task?.title) {
      setTitle(task.title)
    }
  }, [task?.title])

  useEffect(() => {
    return () => {
      if (titleTimeoutRef.current) clearTimeout(titleTimeoutRef.current)
    }
  }, [])

  const handleTitleChange = useCallback(
    (value: string) => {
      setTitle(value)
      if (titleTimeoutRef.current) clearTimeout(titleTimeoutRef.current)
      titleTimeoutRef.current = setTimeout(async () => {
        if (!taskId || !value.trim()) return
        try {
          await updateTask({ id: taskId, title: value.trim() })
        } catch (err: unknown) {
          toast.error(err instanceof Error ? err.message : "Something went wrong")
        }
      }, 1000)
    },
    [taskId, updateTask],
  )

  const handleTitleBlur = useCallback(async () => {
    if (titleTimeoutRef.current) clearTimeout(titleTimeoutRef.current)
    if (!taskId || !title.trim()) return
    if (title.trim() !== task?.title) {
      try {
        await updateTask({ id: taskId, title: title.trim() })
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Something went wrong")
      }
    }
  }, [taskId, title, task?.title, updateTask])

  const debouncedSaveDescription = useDebouncedSave(
    useCallback(
      async (json: any) => {
        if (!taskId) return
        try {
          await updateDescription({ id: taskId, description: json })
        } catch (err: unknown) {
          toast.error(err instanceof Error ? err.message : "Something went wrong")
        }
      },
      [taskId, updateDescription],
    ),
  )

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[95dvh] p-0" showCloseButton={false}>
          <SheetTitle className="sr-only">Task Detail</SheetTitle>
          {task && me ? (
            <>
              <MobileHeader task={task} />
              <ScrollArea className="h-[calc(95dvh-44px)]">
                <div className="px-4 pb-4">
                  <MobileContent
                    task={task}
                    isAdmin={isAdmin}
                    title={title}
                    onTitleChange={handleTitleChange}
                    onTitleBlur={handleTitleBlur}
                    onDescriptionUpdate={debouncedSaveDescription}
                    currentUserId={me._id as Id<"users">}
                  />
                </div>
              </ScrollArea>
            </>
          ) : (
            <TaskDetailSkeleton />
          )}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl h-[85vh] p-0 gap-0 flex flex-col" showCloseButton={false}>
        <DialogTitle className="sr-only">Task Detail</DialogTitle>

        {/* ── Minimal header bar: stats + close ── */}
        {task ? (
          <DesktopHeaderBar task={task} />
        ) : (
          <div className="flex items-center justify-end border-b px-5 py-2 shrink-0">
            <DialogClose asChild>
              <Button variant="ghost" size="icon" className="size-7">
                <XIcon className="size-4" />
                <span className="sr-only">Close</span>
              </Button>
            </DialogClose>
          </div>
        )}

        {/* ── Two-column body ── */}
        <div className="flex-1 flex overflow-hidden">
          {task && me ? (
            <DesktopContent
              task={task}
              isAdmin={isAdmin}
              title={title}
              onTitleChange={handleTitleChange}
              onTitleBlur={handleTitleBlur}
              onDescriptionUpdate={debouncedSaveDescription}
              currentUserId={me._id as Id<"users">}
            />
          ) : (
            <TaskDetailSkeleton />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Desktop Header Bar (minimal — stats + close) ────────────────────────

function DesktopHeaderBar({ task }: { task: EnrichedTask }) {
  const totalMinutes = (task.totalMinutes ?? 0) + (task.subtaskTotalMinutes ?? 0)

  return (
    <div className="flex items-center gap-4 border-b px-5 py-2 shrink-0 text-xs text-muted-foreground">
      {/* Project breadcrumb — left side */}
      <TaskProjectSelector
        taskId={task._id as Id<"tasks">}
        currentProjectId={task.projectId}
        currentProjectName={task.projectName}
        currentClientName={task.clientName}
      />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Timer capsule — right side */}
      <TimerCapsule
        taskId={task._id as Id<"tasks">}
        taskTitle={task.title}
        hasProject={!!task.projectId}
        totalMinutes={totalMinutes}
      />
      {task._creationTime && (
        <span className="flex items-center gap-1.5" title="Last activity">
          <ActivityIcon className="size-3.5" aria-hidden="true" />
          <span>Active {formatDistanceToNow(task._creationTime)}</span>
        </span>
      )}
      <DialogClose asChild>
        <Button variant="ghost" size="icon" className="size-7 -mr-1">
          <XIcon className="size-4" />
          <span className="sr-only">Close</span>
        </Button>
      </DialogClose>
    </div>
  )
}

// ── Mobile Header (minimal) ─────────────────────────────────────────────

function MobileHeader({ task }: { task: EnrichedTask }) {
  const totalMinutes = (task.totalMinutes ?? 0) + (task.subtaskTotalMinutes ?? 0)

  return (
    <div className="flex items-center gap-3 border-b px-4 py-2 shrink-0 text-xs text-muted-foreground">
      <TaskProjectSelector
        taskId={task._id as Id<"tasks">}
        currentProjectId={task.projectId}
        currentProjectName={task.projectName}
        currentClientName={task.clientName}
      />
      <div className="flex-1" />
      <TimerCapsule
        taskId={task._id as Id<"tasks">}
        taskTitle={task.title}
        hasProject={!!task.projectId}
        totalMinutes={totalMinutes}
      />
      {task._creationTime && (
        <span className="flex items-center gap-1">
          <ActivityIcon className="size-3" aria-hidden="true" />
          Active {formatDistanceToNow(task._creationTime)}
        </span>
      )}
      <SheetClose asChild>
        <Button variant="ghost" size="icon" className="size-7 shrink-0">
          <XIcon className="size-4" />
          <span className="sr-only">Close</span>
        </Button>
      </SheetClose>
    </div>
  )
}

// ── Desktop Content (two-column) ────────────────────────────────────────

function DesktopContent({
  task,
  isAdmin,
  title,
  onTitleChange,
  onTitleBlur,
  onDescriptionUpdate,
  currentUserId,
}: {
  task: EnrichedTask
  isAdmin: boolean
  title: string
  onTitleChange: (value: string) => void
  onTitleBlur: () => void
  onDescriptionUpdate: (json: any) => void
  currentUserId: Id<"users">
}) {
  const totalMinutes = (task.totalMinutes ?? 0) + (task.subtaskTotalMinutes ?? 0)
  const estimate = task.estimate ?? 0
  const progressPercent = estimate > 0 ? Math.min(100, (totalMinutes / estimate) * 100) : 0

  return (
    <>
      {/* ── Left column: title + properties + work content ── */}
      <ScrollArea className="flex-[13] border-r">
        <div className="p-5 space-y-4">

          {/* Title + metadata */}
          <div className="space-y-1">
            <AutoResizeTitle
              value={title}
              onChange={onTitleChange}
              onBlur={onTitleBlur}
            />
            <TaskDetailMetadata task={task} isAdmin={isAdmin} />
          </div>

          {/* Description — Tiptap editor */}
          <TiptapEditor
            content={task.description ?? null}
            onUpdate={onDescriptionUpdate}
            placeholder="Add a description…"
          />

          {/* Subtasks */}
          <TaskDetailSubtasks
            taskId={task._id as Id<"tasks">}
            subtasks={task.subtasks ?? []}
            isAdmin={isAdmin}
          />

          {/* Files */}
          <TaskDetailAttachments
            taskId={task._id as Id<"tasks">}
            isAdmin={isAdmin}
            currentUserId={currentUserId}
          />

          {/* Add Time */}
          <div>
            <h3 className="text-xs font-medium text-muted-foreground mb-2">Add Time</h3>
            <AddTimeSection
              taskId={task._id as Id<"tasks">}
              hasProject={!!task.projectId}
            />
          </div>

          {/* Time Entries */}
          <div>
            <h3 className="text-xs font-medium text-muted-foreground mb-2">Time Entries</h3>
            <TimeEntryList
              taskId={task._id as Id<"tasks">}
              initialCount={5}
            />
          </div>
        </div>
      </ScrollArea>

      {/* ── Right column: progress + activity/comments ── */}
      <div className="flex-[7] flex flex-col min-w-0">
        {estimate > 0 && (
          <div className="px-5 pt-4 pb-2 shrink-0">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
              <span>Progress</span>
              <span className="tabular-nums font-medium text-foreground">
                {Math.round(progressPercent)}%
              </span>
            </div>
            <Progress value={progressPercent} className="h-1.5" />
          </div>
        )}

        <Tabs defaultValue="activity" className="flex-1 flex flex-col min-h-0">
          <div className="px-5 pt-3 shrink-0">
            <TabsList className="w-full">
              <TabsTrigger value="activity" className="flex-1">
                Activity
              </TabsTrigger>
              <TabsTrigger value="comments" className="flex-1">
                Comments
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="activity" className="flex-1 mt-0 min-h-0">
            <ScrollArea className="h-full">
              <div className="p-5">
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  Activity log — wired in Session 6
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
          <TabsContent value="comments" className="flex-1 mt-0 min-h-0">
            <ScrollArea className="h-full">
              <div className="p-5">
                <TaskDetailComments
                  taskId={task._id as Id<"tasks">}
                  isAdmin={isAdmin}
                  currentUserId={currentUserId}
                />
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}

// ── Mobile Content (single column) ──────────────────────────────────────

function MobileContent({
  task,
  isAdmin,
  title,
  onTitleChange,
  onTitleBlur,
  onDescriptionUpdate,
  currentUserId,
}: {
  task: EnrichedTask
  isAdmin: boolean
  title: string
  onTitleChange: (value: string) => void
  onTitleBlur: () => void
  onDescriptionUpdate: (json: any) => void
  currentUserId: Id<"users">
}) {
  const totalMinutes = (task.totalMinutes ?? 0) + (task.subtaskTotalMinutes ?? 0)
  const estimate = task.estimate ?? 0
  const progressPercent = estimate > 0 ? Math.min(100, (totalMinutes / estimate) * 100) : 0

  return (
    <div className="space-y-4">
      {/* Title */}
      <AutoResizeTitle
        value={title}
        onChange={onTitleChange}
        onBlur={onTitleBlur}
      />

      {/* Properties */}
      <TaskDetailMetadata task={task} isAdmin={isAdmin} />

      {/* Progress */}
      {estimate > 0 && (
        <div>
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Progress</span>
            <span className="tabular-nums font-medium text-foreground">{Math.round(progressPercent)}%</span>
          </div>
          <Progress value={progressPercent} className="h-1.5" />
        </div>
      )}

      {/* Description — Tiptap editor */}
      <TiptapEditor
        content={task.description ?? null}
        onUpdate={onDescriptionUpdate}
        placeholder="Add a description…"
      />

      {/* Subtasks */}
      <TaskDetailSubtasks
        taskId={task._id as Id<"tasks">}
        subtasks={task.subtasks ?? []}
        isAdmin={isAdmin}
      />

      {/* Files */}
      <TaskDetailAttachments
        taskId={task._id as Id<"tasks">}
        isAdmin={isAdmin}
        currentUserId={currentUserId}
      />

      {/* Add Time */}
      <div>
        <h3 className="text-xs font-medium text-muted-foreground mb-2">Add Time</h3>
        <AddTimeSection
          taskId={task._id as Id<"tasks">}
          hasProject={!!task.projectId}
        />
      </div>

      {/* Time Entries */}
      <div>
        <h3 className="text-xs font-medium text-muted-foreground mb-2">Time Entries</h3>
        <TimeEntryList
          taskId={task._id as Id<"tasks">}
          initialCount={5}
        />
      </div>

      {/* Activity / Comments */}
      <Tabs defaultValue="activity">
        <TabsList className="w-full">
          <TabsTrigger value="activity" className="flex-1">Activity</TabsTrigger>
          <TabsTrigger value="comments" className="flex-1">Comments</TabsTrigger>
        </TabsList>
        <TabsContent value="activity" className="mt-3">
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            Activity log — wired in Session 6
          </div>
        </TabsContent>
        <TabsContent value="comments" className="mt-3">
          <TaskDetailComments
            taskId={task._id as Id<"tasks">}
            isAdmin={isAdmin}
            currentUserId={currentUserId}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ── Auto-resize title ───────────────────────────────────────────────────

function AutoResizeTitle({
  value,
  onChange,
  onBlur,
}: {
  value: string
  onChange: (value: string) => void
  onBlur: () => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }, [value])

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.preventDefault()
      }}
      aria-label="Task title"
      spellCheck={false}
      rows={1}
      className="w-full text-2xl font-bold tracking-tight bg-transparent outline-none placeholder:text-muted-foreground resize-none overflow-hidden"
      placeholder="Task title…"
    />
  )
}

// ── Skeleton ────────────────────────────────────────────────────────────

function TaskDetailSkeleton() {
  return (
    <div className="p-6 space-y-4 w-full">
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-4 w-1/3" />
    </div>
  )
}
