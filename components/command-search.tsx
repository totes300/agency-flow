"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import {
  CommandDialog,
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command"
import {
  CheckSquareIcon,
  UsersIcon,
  FolderIcon,
} from "lucide-react"

interface CommandSearchProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CommandSearch({ open, onOpenChange }: CommandSearchProps) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")

  // Register global keyboard shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        onOpenChange(true)
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [onOpenChange])

  // Reset query when dialog opens
  useEffect(() => {
    if (open) {
      setQuery("")
      setDebouncedQuery("")
    }
  }, [open])

  // Debounce search query by 300ms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(timer)
  }, [query])

  const searchResults = useQuery(
    api.search.globalSearch,
    open && debouncedQuery.length > 0 ? { query: debouncedQuery } : "skip",
  )

  const tasks = searchResults?.tasks ?? []
  const clients = searchResults?.clients ?? []
  const projects = searchResults?.projects ?? []
  const hasResults = tasks.length > 0 || clients.length > 0 || projects.length > 0

  function navigate(url: string) {
    onOpenChange(false)
    router.push(url)
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search"
      description="Search across tasks, clients, and projects."
    >
      <Command shouldFilter={false}>
        <CommandInput
          placeholder="Search tasks, clients, projects..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {query.length > 0 && !hasResults && (
            <CommandEmpty>No results found.</CommandEmpty>
          )}
          {tasks.length > 0 && (
            <CommandGroup heading="Tasks">
              {tasks.map((task) => (
                <CommandItem
                  key={task._id}
                  onSelect={() => navigate(`/tasks`)}
                >
                  <CheckSquareIcon />
                  <span>{task.title}</span>
                  {task.projectName && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {task.projectName}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {tasks.length > 0 && (clients.length > 0 || projects.length > 0) && (
            <CommandSeparator />
          )}
          {clients.length > 0 && (
            <CommandGroup heading="Clients">
              {clients.map((client) => (
                <CommandItem
                  key={client._id}
                  onSelect={() => navigate(`/clients/${client._id}`)}
                >
                  <UsersIcon />
                  <span>{client.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {clients.length > 0 && projects.length > 0 && (
            <CommandSeparator />
          )}
          {projects.length > 0 && (
            <CommandGroup heading="Projects">
              {projects.map((project) => (
                <CommandItem
                  key={project._id}
                  onSelect={() => navigate(`/projects/${project._id}`)}
                >
                  <FolderIcon />
                  <span>{project.name}</span>
                  {project.clientName && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {project.clientName}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
