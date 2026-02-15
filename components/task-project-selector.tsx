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
  CommandSeparator,
} from "@/components/ui/command"
import { Badge } from "@/components/ui/badge"
import { CheckIcon } from "lucide-react"
import { cn } from "@/lib/utils"

const BILLING_LABELS: Record<string, string> = {
  fixed: "Fixed",
  retainer: "Retainer",
  t_and_m: "T&M",
}

export function TaskProjectSelector({
  taskId,
  currentProjectId,
  currentProjectName,
  currentClientName,
}: {
  taskId: Id<"tasks">
  currentProjectId?: string | null
  currentProjectName?: string | null
  currentClientName?: string | null
}) {
  const [open, setOpen] = useState(false)
  const projects = useQuery(api.projects.listAll, open ? {} : "skip")
  const me = useQuery(api.users.getMe)
  const updateTask = useMutation(api.tasks.update)

  // Group projects by client
  const grouped = new Map<string, { clientName: string; projects: NonNullable<typeof projects> }>()
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

  // Recent projects
  const recentProjects = recentProjectIds
    .map((id) => projects?.find((p) => p._id === id))
    .filter(Boolean) as NonNullable<typeof projects>

  async function handleSelect(projectId: Id<"projects">) {
    setOpen(false)
    try {
      await updateTask({ id: taskId, projectId })
    } catch (err: unknown) {
      toast.error((err as Error).message)
    }
  }

  const displayText = currentProjectName
    ? `${currentClientName ?? "?"} → ${currentProjectName}`
    : null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="max-w-[200px] truncate rounded-md px-2 py-1 text-left text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={(e) => e.stopPropagation()}
        >
          {displayText ? (
            <span className="text-foreground">{displayText}</span>
          ) : (
            <span className="text-muted-foreground">No project</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start" onClick={(e) => e.stopPropagation()}>
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
                      onSelect={() => handleSelect(p._id as Id<"projects">)}
                    >
                      <CheckIcon
                        className={cn(
                          "mr-2 size-4",
                          currentProjectId === p._id ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <div className="flex flex-1 items-center justify-between gap-2">
                        <span className="truncate">
                          {p.clientName} → {p.name}
                        </span>
                        <Badge variant="outline" className="shrink-0 text-[10px]">
                          {BILLING_LABELS[p.billingType] ?? p.billingType}
                        </Badge>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {[...grouped.entries()].map(([clientId, { clientName, projects: clientProjects }]) => (
              <CommandGroup key={clientId} heading={clientName}>
                {clientProjects.map((p) => (
                  <CommandItem
                    key={p._id}
                    value={`${clientName} ${p.name}`}
                    onSelect={() => handleSelect(p._id as Id<"projects">)}
                  >
                    <CheckIcon
                      className={cn(
                        "mr-2 size-4",
                        currentProjectId === p._id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="flex flex-1 items-center justify-between gap-2">
                      <span className="truncate">{p.name}</span>
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {BILLING_LABELS[p.billingType] ?? p.billingType}
                      </Badge>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
