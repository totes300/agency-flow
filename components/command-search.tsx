"use client"

import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  CheckSquareIcon,
  UsersIcon,
  FolderIcon,
  SearchIcon,
} from "lucide-react"

interface CommandSearchProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const MAX_RESULTS_PER_GROUP = 5

export function CommandSearch({ open, onOpenChange }: CommandSearchProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)

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

  // Focus input when dialog opens
  useEffect(() => {
    if (open) {
      setQuery("")
      setSelectedIndex(0)
      // Small delay to ensure dialog is rendered
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  // Fetch data for search
  const searchResults = useQuery(
    api.search.globalSearch,
    open && query.length > 0 ? { query } : "skip",
  )

  // Flatten results for keyboard navigation
  const flatResults = useMemo(() => {
    if (!searchResults) return []
    const items: { type: string; id: string; title: string; subtitle?: string; url: string }[] = []
    for (const task of (searchResults.tasks ?? []).slice(0, MAX_RESULTS_PER_GROUP)) {
      items.push({
        type: "task",
        id: task._id,
        title: task.title,
        subtitle: task.projectName,
        url: `/tasks`, // Will be task detail URL in Phase 4
      })
    }
    for (const client of (searchResults.clients ?? []).slice(0, MAX_RESULTS_PER_GROUP)) {
      items.push({
        type: "client",
        id: client._id,
        title: client.name,
        url: `/clients`,
      })
    }
    for (const project of (searchResults.projects ?? []).slice(0, MAX_RESULTS_PER_GROUP)) {
      items.push({
        type: "project",
        id: project._id,
        title: project.name,
        subtitle: project.clientName,
        url: `/projects`,
      })
    }
    return items
  }, [searchResults])

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [flatResults.length])

  const navigate = useCallback(
    (url: string) => {
      onOpenChange(false)
      router.push(url)
    },
    [onOpenChange, router],
  )

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, flatResults.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter" && flatResults[selectedIndex]) {
      e.preventDefault()
      navigate(flatResults[selectedIndex].url)
    }
  }

  const iconForType = (type: string) => {
    switch (type) {
      case "task":
        return <CheckSquareIcon className="size-4 text-muted-foreground" />
      case "client":
        return <UsersIcon className="size-4 text-muted-foreground" />
      case "project":
        return <FolderIcon className="size-4 text-muted-foreground" />
      default:
        return null
    }
  }

  // Group results by type for display
  const grouped = useMemo(() => {
    const groups: Record<string, typeof flatResults> = {}
    for (const item of flatResults) {
      if (!groups[item.type]) groups[item.type] = []
      groups[item.type].push(item)
    }
    return groups
  }, [flatResults])

  const groupLabels: Record<string, string> = {
    task: "Tasks",
    client: "Clients",
    project: "Projects",
  }

  // Track flat index for highlight
  let flatIndex = -1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[20vh] translate-y-0 p-0 gap-0 sm:max-w-lg">
        <DialogTitle className="sr-only">Search</DialogTitle>
        <div className="flex items-center gap-2 border-b px-3">
          <SearchIcon className="size-4 text-muted-foreground shrink-0" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search tasks, clients, projects..."
            className="border-0 shadow-none focus-visible:ring-0 h-11"
          />
        </div>
        {query.length > 0 && (
          <div className="max-h-80 overflow-y-auto p-2">
            {flatResults.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                No results found.
              </p>
            )}
            {Object.entries(grouped).map(([type, items]) => (
              <div key={type}>
                <p className="text-xs font-medium text-muted-foreground px-2 py-1.5">
                  {groupLabels[type] ?? type}
                </p>
                {items.map((item) => {
                  flatIndex++
                  const idx = flatIndex
                  return (
                    <button
                      key={item.id}
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left ${
                        idx === selectedIndex
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-accent/50"
                      }`}
                      onClick={() => navigate(item.url)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                    >
                      {iconForType(item.type)}
                      <span className="flex-1 truncate">{item.title}</span>
                      {item.subtitle && (
                        <span className="text-xs text-muted-foreground truncate">
                          {item.subtitle}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
