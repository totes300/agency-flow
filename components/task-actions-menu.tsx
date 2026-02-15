"use client"

import { useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { toast } from "sonner"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useUndoAction } from "@/hooks/use-undo-action"
import {
  MoreHorizontalIcon,
  CopyIcon,
  ArchiveIcon,
  TrashIcon,
  ArrowRightLeftIcon,
} from "lucide-react"

const BILLING_LABELS: Record<string, string> = {
  fixed: "Fixed",
  retainer: "Retainer",
  t_and_m: "T&M",
}

export function TaskActionsMenu({
  taskId,
  taskTitle,
  isAdmin,
  hasTimeEntries,
  alwaysVisible = false,
}: {
  taskId: Id<"tasks">
  taskTitle: string
  isAdmin: boolean
  hasTimeEntries: boolean
  alwaysVisible?: boolean
}) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const duplicateTask = useMutation(api.tasks.duplicate)
  const archiveTask = useMutation(api.tasks.archive)
  const deleteTask = useMutation(api.tasks.remove)
  const moveTask = useMutation(api.tasks.moveToProject)

  const { execute: executeUndo } = useUndoAction()

  async function handleDuplicate() {
    setDropdownOpen(false)
    try {
      await duplicateTask({ id: taskId })
      toast.success("Task duplicated")
    } catch (err: unknown) {
      toast.error((err as Error).message)
    }
  }

  function handleArchive() {
    setDropdownOpen(false)
    executeUndo({
      id: `archive-${taskId}`,
      message: `"${taskTitle}" archived`,
      action: async () => {
        await archiveTask({ id: taskId })
      },
    })
  }

  function handleDeleteClick() {
    setDropdownOpen(false)
    setDeleteOpen(true)
  }

  async function handleDeleteConfirm() {
    setDeleteOpen(false)
    try {
      await deleteTask({ id: taskId })
      toast.success("Task deleted")
    } catch (err: unknown) {
      toast.error((err as Error).message)
    }
  }

  function handleMoveClick() {
    setDropdownOpen(false)
    if (hasTimeEntries) {
      toast.error(
        "Cannot move task: time entries exist. Time entries are linked to the current project for billing.",
      )
      return
    }
    setMoveOpen(true)
  }

  return (
    <>
      <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={`size-8 ${alwaysVisible ? "" : "opacity-0 group-hover:opacity-100"} data-[state=open]:opacity-100`}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontalIcon className="size-4" />
            <span className="sr-only">Task actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onClick={handleDuplicate}>
            <CopyIcon className="mr-2 size-4" />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleArchive}>
            <ArchiveIcon className="mr-2 size-4" />
            Archive
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {isAdmin && (
            <DropdownMenuItem onClick={handleMoveClick}>
              <ArrowRightLeftIcon className="mr-2 size-4" />
              Move to Project
            </DropdownMenuItem>
          )}
          {isAdmin && (
            <DropdownMenuItem
              onClick={handleDeleteClick}
              className="text-destructive focus:text-destructive"
            >
              <TrashIcon className="mr-2 size-4" />
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{taskTitle}&quot; and all its
              subtasks, comments, and attachments. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Move to project popover */}
      <MoveToProjectPopover
        taskId={taskId}
        open={moveOpen}
        onOpenChange={setMoveOpen}
        moveTask={moveTask}
      />
    </>
  )
}

function MoveToProjectPopover({
  taskId,
  open,
  onOpenChange,
  moveTask,
}: {
  taskId: Id<"tasks">
  open: boolean
  onOpenChange: (open: boolean) => void
  moveTask: ReturnType<typeof useMutation<typeof api.tasks.moveToProject>>
}) {
  const projects = useQuery(api.projects.listAll, open ? {} : "skip")
  const me = useQuery(api.users.getMe, open ? undefined : "skip")

  const grouped = new Map<
    string,
    { clientName: string; projects: NonNullable<typeof projects> }
  >()
  const recentProjectIds = me?.recentProjectIds ?? []

  if (projects) {
    for (const p of projects) {
      const key = p.clientId
      if (!grouped.has(key)) {
        grouped.set(key, { clientName: p.clientName, projects: [] })
      }
      grouped.get(key)!.projects.push(p)
    }
  }

  const recentProjects = recentProjectIds
    .map((id) => projects?.find((p) => p._id === id))
    .filter(Boolean) as NonNullable<typeof projects>

  async function handleSelect(projectId: Id<"projects">) {
    onOpenChange(false)
    try {
      await moveTask({ id: taskId, projectId })
      toast.success("Task moved")
    } catch (err: unknown) {
      toast.error((err as Error).message)
    }
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <span className="hidden" />
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-0"
        align="end"
        onClick={(e) => e.stopPropagation()}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command>
          <CommandInput placeholder="Search projects..." />
          <CommandList>
            <CommandEmpty>No projects found.</CommandEmpty>

            {recentProjects.length > 0 && (
              <>
                <CommandGroup heading="Recently Used">
                  {recentProjects.map((p) => (
                    <CommandItem
                      key={`recent-${p._id}`}
                      value={`${p.clientName} ${p.name}`}
                      onSelect={() =>
                        handleSelect(p._id as Id<"projects">)
                      }
                    >
                      <div className="flex flex-1 items-center justify-between gap-2">
                        <span className="truncate">
                          {p.clientName} → {p.name}
                        </span>
                        <Badge
                          variant="outline"
                          className="shrink-0 text-[10px]"
                        >
                          {BILLING_LABELS[p.billingType] ?? p.billingType}
                        </Badge>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {[...grouped.entries()].map(
              ([clientId, { clientName, projects: clientProjects }]) => (
                <CommandGroup key={clientId} heading={clientName}>
                  {clientProjects.map((p) => (
                    <CommandItem
                      key={p._id}
                      value={`${clientName} ${p.name}`}
                      onSelect={() =>
                        handleSelect(p._id as Id<"projects">)
                      }
                    >
                      <div className="flex flex-1 items-center justify-between gap-2">
                        <span className="truncate">{p.name}</span>
                        <Badge
                          variant="outline"
                          className="shrink-0 text-[10px]"
                        >
                          {BILLING_LABELS[p.billingType] ?? p.billingType}
                        </Badge>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ),
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
