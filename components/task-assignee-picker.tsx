"use client"

import { useState } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { toast } from "sonner"
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
import { CheckIcon, ChevronDown, UserRound } from "lucide-react"
import { cn } from "@/lib/utils"
import { getInitials } from "@/lib/constants"

export function TaskAssigneeAvatars({
  assignees,
  showNames = false,
}: {
  assignees: { _id: string; name: string; avatarUrl?: string }[]
  showNames?: boolean
}) {
  if (assignees.length === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground text-sm">
        <UserRound className="size-4" />
        {showNames && "Assign"}
      </span>
    )
  }

  const nameLabel = showNames
    ? assignees.length === 1
      ? assignees[0].name.split(" ")[0]
      : `${assignees[0].name.split(" ")[0]} +${assignees.length - 1}`
    : null

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex -space-x-1.5">
        {assignees.slice(0, 3).map((a) => (
          <Avatar key={a._id} className="size-5 border-2 border-background">
            <AvatarImage src={a.avatarUrl} alt={a.name} />
            <AvatarFallback className="text-[10px]">{getInitials(a.name)}</AvatarFallback>
          </Avatar>
        ))}
        {assignees.length > 3 && (
          <div className="flex size-5 items-center justify-center rounded-full border-2 border-background bg-muted text-[9px] font-medium">
            +{assignees.length - 3}
          </div>
        )}
      </div>
      {nameLabel && (
        <span className="text-sm truncate max-w-[120px]">{nameLabel}</span>
      )}
    </div>
  )
}

export function TaskAssigneePicker({
  taskId,
  currentAssigneeIds,
  currentAssignees,
  showNames = false,
}: {
  taskId: Id<"tasks">
  currentAssigneeIds: string[]
  currentAssignees: { _id: string; name: string; avatarUrl?: string }[]
  showNames?: boolean
}) {
  const [open, setOpen] = useState(false)
  const users = useQuery(api.users.listAll, {})
  const updateTask = useMutation(api.tasks.update)

  const selectedIds = new Set(currentAssigneeIds)

  async function handleToggle(userId: Id<"users">) {
    const newIds = selectedIds.has(userId)
      ? currentAssigneeIds.filter((id) => id !== userId)
      : [...currentAssigneeIds, userId]

    try {
      await updateTask({ id: taskId, assigneeIds: newIds as Id<"users">[] })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1 rounded-full bg-secondary/50 px-1.5 py-0.5 text-xs font-medium transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            !showNames && "rounded-md bg-transparent px-1 py-1",
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <TaskAssigneeAvatars assignees={currentAssignees} showNames={showNames} />
          {showNames && <ChevronDown className="size-3 shrink-0 text-muted-foreground" />}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start" onClick={(e) => e.stopPropagation()}>
        <Command>
          <CommandInput placeholder="Search people..." />
          <CommandList>
            <CommandEmpty>No users found.</CommandEmpty>
            <CommandGroup>
              {users?.map((user) => (
                <CommandItem
                  key={user._id}
                  value={user.name}
                  onSelect={() => handleToggle(user._id as Id<"users">)}
                >
                  <CheckIcon
                    className={cn(
                      "mr-2 size-4",
                      selectedIds.has(user._id) ? "opacity-100" : "opacity-0",
                    )}
                  />
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
  )
}
