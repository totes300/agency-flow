"use client"

import { useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
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
} from "@/components/ui/command"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { CheckIcon, XIcon, ArchiveIcon, ChevronDownIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { useUndoAction } from "@/hooks/use-undo-action"
import { getStatusConfig } from "@/components/task-status-select"
import { STATUS_OPTIONS, getInitials } from "@/lib/constants"

export function TaskBulkBar({
  selectedIds,
  isAdmin,
  onClearSelection,
}: {
  selectedIds: Id<"tasks">[]
  isAdmin: boolean
  onClearSelection: () => void
}) {
  const [statusOpen, setStatusOpen] = useState(false)
  const [assigneeOpen, setAssigneeOpen] = useState(false)

  const bulkUpdateStatus = useMutation(api.tasks.bulkUpdateStatus)
  const bulkUpdateAssignees = useMutation(api.tasks.bulkUpdateAssignees)
  const bulkArchive = useMutation(api.tasks.bulkArchive)
  const users = useQuery(api.users.listAll, assigneeOpen ? {} : "skip")

  const { execute: executeUndo } = useUndoAction()

  const count = selectedIds.length
  if (count === 0) return null

  async function handleStatusChange(status: string) {
    setStatusOpen(false)
    try {
      const result = await bulkUpdateStatus({
        ids: selectedIds,
        status: status as "inbox" | "today" | "next_up" | "admin_review" | "stuck" | "done",
      })
      toast.success(`Updated ${result.updated} task${result.updated !== 1 ? "s" : ""}`)
      onClearSelection()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    }
  }

  async function handleAssigneeChange(userId: Id<"users">) {
    setAssigneeOpen(false)
    try {
      const result = await bulkUpdateAssignees({
        ids: selectedIds,
        assigneeIds: [userId],
      })
      toast.success(`Assigned ${result.updated} task${result.updated !== 1 ? "s" : ""}`)
      onClearSelection()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    }
  }

  function handleArchive() {
    const ids = [...selectedIds]
    executeUndo({
      id: `bulk-archive-${ids.join(",")}`,
      message: `${count} task${count !== 1 ? "s" : ""} archived`,
      action: async () => {
        await bulkArchive({ ids })
      },
    })
    onClearSelection()
  }

  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 w-[calc(100%-2rem)] max-w-lg md:w-auto md:max-w-none">
      <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 shadow-lg overflow-x-auto md:px-4 md:py-2.5">
        <span className="text-sm font-medium whitespace-nowrap">
          {count} selected
        </span>

        <div className="h-5 w-px bg-border shrink-0" />

        {/* Status picker */}
        <Popover open={statusOpen} onOpenChange={setStatusOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1 shrink-0">
              Status
              <ChevronDownIcon className="size-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-40 p-1" align="start">
            <div className="flex flex-col gap-0.5">
              {STATUS_OPTIONS.map((opt) => {
                const disabled = opt.value === "done" && !isAdmin
                const config = getStatusConfig(opt.value)
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={disabled}
                    onClick={() => handleStatusChange(opt.value)}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${config.color}`}
                    >
                      {config.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </PopoverContent>
        </Popover>

        {/* Assignee picker */}
        <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1 shrink-0">
              Assignee
              <ChevronDownIcon className="size-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-0" align="start">
            <Command>
              <CommandInput placeholder="Search people..." />
              <CommandList>
                <CommandEmpty>No users found.</CommandEmpty>
                <CommandGroup>
                  {users?.map((user) => (
                    <CommandItem
                      key={user._id}
                      value={user.name}
                      onSelect={() =>
                        handleAssigneeChange(user._id as Id<"users">)
                      }
                    >
                      <Avatar className="mr-2 size-5">
                        <AvatarImage src={user.avatarUrl} alt={user.name} />
                        <AvatarFallback className="text-[9px]">
                          {getInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate">{user.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Archive */}
        <Button variant="outline" size="sm" className="gap-1 shrink-0" onClick={handleArchive}>
          <ArchiveIcon className="size-3.5" />
          Archive
        </Button>

        <div className="h-5 w-px bg-border shrink-0" />

        {/* Dismiss */}
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={onClearSelection}
          aria-label="Clear selection"
        >
          <XIcon className="size-4" />
        </Button>
      </div>
    </div>
  )
}
