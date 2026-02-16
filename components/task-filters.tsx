"use client"

import { useCallback } from "react"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { CheckIcon, XIcon, FilterIcon, CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { getStatusConfig } from "@/components/task-status-select"

import { STATUS_OPTIONS } from "@/lib/constants"

const GROUP_OPTIONS = [
  { value: "none", label: "No grouping" },
  { value: "client", label: "Client" },
  { value: "project", label: "Project" },
  { value: "assignee", label: "Assignee" },
  { value: "status", label: "Status" },
] as const

export type TaskFilters = {
  clientId?: string
  projectId?: string
  assigneeId?: string
  status?: string
  dateFrom?: string
  dateTo?: string
}

export type GroupByOption = "none" | "client" | "project" | "assignee" | "status"

export function useTaskFilters() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const filters: TaskFilters = {
    clientId: searchParams.get("clientId") ?? undefined,
    projectId: searchParams.get("projectId") ?? undefined,
    assigneeId: searchParams.get("assigneeId") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    dateFrom: searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("dateTo") ?? undefined,
  }

  const groupBy = (searchParams.get("groupBy") as GroupByOption) ?? "none"

  const setFilter = useCallback(
    (key: string, value: string | undefined) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [searchParams, router, pathname],
  )

  const setFilters = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          params.set(key, value)
        } else {
          params.delete(key)
        }
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [searchParams, router, pathname],
  )

  const setGroupBy = useCallback(
    (value: GroupByOption) => {
      setFilter("groupBy", value === "none" ? undefined : value)
    },
    [setFilter],
  )

  const clearAll = useCallback(() => {
    router.replace(pathname, { scroll: false })
  }, [router, pathname])

  const hasFilters = Object.values(filters).some(Boolean)

  return { filters, groupBy, setFilter, setFilters, setGroupBy, clearAll, hasFilters }
}

export function TaskFilterBar({
  filters,
  groupBy,
  onFilterChange,
  onFiltersChange,
  onGroupByChange,
  onClearAll,
  hasFilters,
}: {
  filters: TaskFilters
  groupBy: GroupByOption
  onFilterChange: (key: string, value: string | undefined) => void
  onFiltersChange: (updates: Record<string, string | undefined>) => void
  onGroupByChange: (value: GroupByOption) => void
  onClearAll: () => void
  hasFilters: boolean
}) {
  const projects = useQuery(api.projects.listAll, {})
  const users = useQuery(api.users.listAll)

  // Derive unique clients from projects
  const clientsMap = new Map<string, string>()
  if (projects) {
    for (const p of projects) {
      if (!clientsMap.has(p.clientId)) {
        clientsMap.set(p.clientId, p.clientName)
      }
    }
  }
  const clients = [...clientsMap.entries()].map(([id, name]) => ({ id, name }))

  // Filter projects by selected client
  const filteredProjects = filters.clientId
    ? projects?.filter((p) => p.clientId === filters.clientId)
    : projects

  return (
    <div className="space-y-2">
      {/* Desktop filter bar */}
      <div className="hidden items-center gap-2 md:flex">
        <ClientFilter
          clients={clients}
          value={filters.clientId}
          onChange={(v) => {
            // Batch update: set client + clear project in one URL push
            onFiltersChange({
              clientId: v,
              projectId: v !== filters.clientId ? undefined : filters.projectId,
            })
          }}
        />
        <ProjectFilter
          projects={filteredProjects ?? []}
          value={filters.projectId}
          onChange={(v) => onFilterChange("projectId", v)}
        />
        <AssigneeFilter
          users={users ?? []}
          value={filters.assigneeId}
          onChange={(v) => onFilterChange("assigneeId", v)}
        />
        <StatusFilter
          value={filters.status}
          onChange={(v) => onFilterChange("status", v)}
        />
        <DateFilter
          label="From"
          value={filters.dateFrom}
          onChange={(v) => onFilterChange("dateFrom", v)}
        />
        <DateFilter
          label="To"
          value={filters.dateTo}
          onChange={(v) => onFilterChange("dateTo", v)}
        />

        <div className="ml-auto flex items-center gap-2">
          <Select value={groupBy} onValueChange={(v) => onGroupByChange(v as GroupByOption)}>
            <SelectTrigger className="h-8 w-[150px]">
              <span className="text-muted-foreground mr-1 text-xs">Group:</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GROUP_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Mobile filter button */}
      <div className="flex items-center gap-2 md:hidden">
        <TaskFilterDrawer
          filters={filters}
          groupBy={groupBy}
          onFilterChange={onFilterChange}
          onFiltersChange={onFiltersChange}
          onGroupByChange={onGroupByChange}
          onClearAll={onClearAll}
          clients={clients}
          projects={filteredProjects ?? []}
          users={users ?? []}
        />
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={onClearAll}>
            Clear
          </Button>
        )}
      </div>

      {/* Active filter chips */}
      {hasFilters && (
        <div className="flex flex-wrap items-center gap-1.5">
          {filters.clientId && (
            <FilterChip
              label={clientsMap.get(filters.clientId) ?? "Client"}
              onRemove={() => {
                onFiltersChange({ clientId: undefined, projectId: undefined })
              }}
            />
          )}
          {filters.projectId && (
            <FilterChip
              label={projects?.find((p) => p._id === filters.projectId)?.name ?? "Project"}
              onRemove={() => onFilterChange("projectId", undefined)}
            />
          )}
          {filters.assigneeId && (
            <FilterChip
              label={users?.find((u) => u._id === filters.assigneeId)?.name ?? "Assignee"}
              onRemove={() => onFilterChange("assigneeId", undefined)}
            />
          )}
          {filters.status && (
            <FilterChip
              label={getStatusConfig(filters.status).label}
              onRemove={() => onFilterChange("status", undefined)}
            />
          )}
          {filters.dateFrom && (
            <FilterChip
              label={`From ${filters.dateFrom}`}
              onRemove={() => onFilterChange("dateFrom", undefined)}
            />
          )}
          {filters.dateTo && (
            <FilterChip
              label={`To ${filters.dateTo}`}
              onRemove={() => onFilterChange("dateTo", undefined)}
            />
          )}
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onClearAll}>
            Clear all
          </Button>
        </div>
      )}
    </div>
  )
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <Badge variant="secondary" className="gap-1 pr-1">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="rounded-full p-0.5 hover:bg-muted-foreground/20"
      >
        <XIcon className="size-3" />
        <span className="sr-only">Remove filter</span>
      </button>
    </Badge>
  )
}

// ── Filter Dropdowns ──────────────────────────────────────────────────────

function ClientFilter({
  clients,
  value,
  onChange,
}: {
  clients: { id: string; name: string }[]
  value?: string
  onChange: (v: string | undefined) => void
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          {value ? clients.find((c) => c.id === value)?.name ?? "Client" : "Client"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search clients..." />
          <CommandList>
            <CommandEmpty>No clients found.</CommandEmpty>
            <CommandGroup>
              {value && (
                <CommandItem onSelect={() => onChange(undefined)}>
                  <span className="text-muted-foreground">Clear</span>
                </CommandItem>
              )}
              {clients.map((c) => (
                <CommandItem
                  key={c.id}
                  value={c.name}
                  onSelect={() => onChange(c.id)}
                >
                  <CheckIcon
                    className={cn("mr-2 size-4", value === c.id ? "opacity-100" : "opacity-0")}
                  />
                  {c.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function ProjectFilter({
  projects,
  value,
  onChange,
}: {
  projects: { _id: string; name: string; clientName: string }[]
  value?: string
  onChange: (v: string | undefined) => void
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          {value ? projects.find((p) => p._id === value)?.name ?? "Project" : "Project"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search projects..." />
          <CommandList>
            <CommandEmpty>No projects found.</CommandEmpty>
            <CommandGroup>
              {value && (
                <CommandItem onSelect={() => onChange(undefined)}>
                  <span className="text-muted-foreground">Clear</span>
                </CommandItem>
              )}
              {projects.map((p) => (
                <CommandItem
                  key={p._id}
                  value={`${p.clientName} ${p.name}`}
                  onSelect={() => onChange(p._id)}
                >
                  <CheckIcon
                    className={cn("mr-2 size-4", value === p._id ? "opacity-100" : "opacity-0")}
                  />
                  <span className="truncate">{p.clientName} → {p.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function AssigneeFilter({
  users,
  value,
  onChange,
}: {
  users: { _id: string; name: string }[]
  value?: string
  onChange: (v: string | undefined) => void
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          {value ? users.find((u) => u._id === value)?.name ?? "Assignee" : "Assignee"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search people..." />
          <CommandList>
            <CommandEmpty>No people found.</CommandEmpty>
            <CommandGroup>
              {value && (
                <CommandItem onSelect={() => onChange(undefined)}>
                  <span className="text-muted-foreground">Clear</span>
                </CommandItem>
              )}
              {users.map((u) => (
                <CommandItem
                  key={u._id}
                  value={u.name}
                  onSelect={() => onChange(u._id)}
                >
                  <CheckIcon
                    className={cn("mr-2 size-4", value === u._id ? "opacity-100" : "opacity-0")}
                  />
                  {u.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function StatusFilter({
  value,
  onChange,
}: {
  value?: string
  onChange: (v: string | undefined) => void
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          {value ? getStatusConfig(value).label : "Status"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-40 p-1" align="start">
        <div className="flex flex-col gap-0.5">
          {value && (
            <button
              type="button"
              onClick={() => onChange(undefined)}
              className="rounded-sm px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-accent"
            >
              Clear
            </button>
          )}
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={cn(
                "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent",
                value === opt.value && "bg-accent",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function DateFilter({
  label,
  value,
  onChange,
}: {
  label: string
  value?: string
  onChange: (v: string | undefined) => void
}) {
  const date = value ? new Date(value + "T00:00:00") : undefined

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          <CalendarIcon className="mr-1.5 size-3.5" />
          {value ?? label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => {
            if (d) {
              const yyyy = d.getFullYear()
              const mm = String(d.getMonth() + 1).padStart(2, "0")
              const dd = String(d.getDate()).padStart(2, "0")
              onChange(`${yyyy}-${mm}-${dd}`)
            } else {
              onChange(undefined)
            }
          }}
          initialFocus
        />
        {value && (
          <div className="border-t p-2">
            <Button variant="ghost" size="sm" className="w-full" onClick={() => onChange(undefined)}>
              Clear
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

// ── Mobile Filter Drawer ──────────────────────────────────────────────────

function TaskFilterDrawer({
  filters,
  groupBy,
  onFilterChange,
  onFiltersChange,
  onGroupByChange,
  onClearAll,
  clients,
  projects,
  users,
}: {
  filters: TaskFilters
  groupBy: GroupByOption
  onFilterChange: (key: string, value: string | undefined) => void
  onFiltersChange: (updates: Record<string, string | undefined>) => void
  onGroupByChange: (value: GroupByOption) => void
  onClearAll: () => void
  clients: { id: string; name: string }[]
  projects: { _id: string; name: string; clientName: string }[]
  users: { _id: string; name: string }[]
}) {
  const hasFilters = Object.values(filters).some(Boolean)

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <FilterIcon className="mr-2 size-4" />
          Filters
          {hasFilters && (
            <Badge variant="secondary" className="ml-1.5">
              {Object.values(filters).filter(Boolean).length}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[80vh]">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4 overflow-y-auto">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Client</label>
            <Select
              value={filters.clientId ?? "all"}
              onValueChange={(v) => {
                const newClient = v === "all" ? undefined : v
                onFiltersChange({
                  clientId: newClient,
                  projectId: newClient !== filters.clientId ? undefined : filters.projectId,
                })
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All clients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All clients</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Project</label>
            <Select
              value={filters.projectId ?? "all"}
              onValueChange={(v) => onFilterChange("projectId", v === "all" ? undefined : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p._id} value={p._id}>
                    {p.clientName} → {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Assignee</label>
            <Select
              value={filters.assigneeId ?? "all"}
              onValueChange={(v) => onFilterChange("assigneeId", v === "all" ? undefined : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All people" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All people</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u._id} value={u._id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Status</label>
            <Select
              value={filters.status ?? "all"}
              onValueChange={(v) => onFilterChange("status", v === "all" ? undefined : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Group by</label>
            <Select value={groupBy} onValueChange={(v) => onGroupByChange(v as GroupByOption)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GROUP_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {hasFilters && (
            <Button variant="outline" className="w-full" onClick={onClearAll}>
              Clear all filters
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
