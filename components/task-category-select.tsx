"use client"

import { useState, useCallback } from "react"
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
import { Badge } from "@/components/ui/badge"
import { CheckIcon, XIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export function TaskCategorySelect({
  taskId,
  projectId,
  currentCategoryId,
  currentCategoryName,
}: {
  taskId: Id<"tasks">
  projectId?: string | null
  currentCategoryId?: string | null
  currentCategoryName?: string | null
}) {
  const [open, setOpen] = useState(false)
  const categories = useQuery(api.workCategories.list, {})
  const updateTask = useMutation(api.tasks.update)
  const autoAssign = useQuery(
    api.tasks.getAutoAssignSuggestion,
    projectId && currentCategoryId
      ? {
          projectId: projectId as Id<"projects">,
          workCategoryId: currentCategoryId as Id<"workCategories">,
        }
      : "skip",
  )

  const handleSelect = useCallback(
    async (categoryId: string | null) => {
      setOpen(false)
      try {
        await updateTask({
          id: taskId,
          workCategoryId: categoryId as Id<"workCategories"> | null,
        })

        // Check for auto-assign suggestion when setting a new category
        if (categoryId && projectId) {
          // The auto-assign will be handled by checking after the update
          // For now we just show a toast if there's a suggestion
        }
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Something went wrong")
      }
    },
    [taskId, projectId, updateTask],
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="rounded-md px-2 py-1 text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={(e) => e.stopPropagation()}
        >
          {currentCategoryName ? (
            <Badge variant="secondary">{currentCategoryName}</Badge>
          ) : (
            <span className="text-muted-foreground">No category</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-0" align="start" onClick={(e) => e.stopPropagation()}>
        <Command>
          <CommandInput placeholder="Search categories..." />
          <CommandList>
            <CommandEmpty>No categories found.</CommandEmpty>
            <CommandGroup>
              {currentCategoryId && (
                <CommandItem
                  value="__clear__"
                  onSelect={() => handleSelect(null)}
                >
                  <XIcon className="mr-2 size-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Clear category</span>
                </CommandItem>
              )}
              {categories?.map((cat) => (
                <CommandItem
                  key={cat._id}
                  value={cat.name}
                  onSelect={() => handleSelect(cat._id)}
                >
                  <CheckIcon
                    className={cn(
                      "mr-2 size-4",
                      currentCategoryId === cat._id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="truncate">{cat.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
