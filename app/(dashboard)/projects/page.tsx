"use client"

import { useMemo, useState } from "react"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ProjectCard } from "@/components/project-card"
import dynamic from "next/dynamic"

const ProjectFormDialog = dynamic(() =>
  import("@/components/project-form-dialog").then((m) => ({ default: m.ProjectFormDialog }))
)
import { BILLING_TYPE_LABELS } from "@/lib/constants"
import { PlusIcon } from "lucide-react"

export default function ProjectsPage() {
  const me = useQuery(api.users.getMe)
  const [showArchived, setShowArchived] = useState(false)
  const [clientFilter, setClientFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [addOpen, setAddOpen] = useState(false)

  const isAdmin = me?.role === "admin"

  const projects = useQuery(
    api.projects.listAllWithMetrics,
    me ? { includeArchived: showArchived } : "skip",
  )

  // Derive unique client list from project data
  const clientOptions = useMemo(() => {
    if (!projects) return []
    const seen = new Map<string, string>()
    for (const p of projects) {
      if (!seen.has(p.clientId)) {
        seen.set(p.clientId, p.clientName)
      }
    }
    return Array.from(seen.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [projects])

  // Apply filters
  const filtered = useMemo(() => {
    if (!projects) return []
    return projects.filter((p) => {
      if (clientFilter !== "all" && p.clientId !== clientFilter) return false
      if (typeFilter !== "all" && p.billingType !== typeFilter) return false
      return true
    })
  }, [projects, clientFilter, typeFilter])

  // Group by client, sorted alphabetically
  const grouped = useMemo(() => {
    const map = new Map<string, { clientName: string; projects: typeof filtered }>()
    for (const p of filtered) {
      const group = map.get(p.clientId) ?? {
        clientName: p.clientName,
        projects: [],
      }
      group.projects.push(p)
      map.set(p.clientId, group)
    }
    return Array.from(map.values()).sort((a, b) =>
      a.clientName.localeCompare(b.clientName),
    )
  }, [filtered])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-muted-foreground mt-1">
            All projects across clients.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setAddOpen(true)}>
            <PlusIcon className="mr-1.5 size-4" />
            Add Project
          </Button>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Clients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            {clientOptions.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(BILLING_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Switch
            id="show-archived"
            checked={showArchived}
            onCheckedChange={setShowArchived}
          />
          <Label htmlFor="show-archived" className="text-sm">
            Show archived
          </Label>
        </div>
      </div>

      {/* Content */}
      {!projects ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[140px] rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <h3 className="text-lg font-medium">No projects found</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            {projects.length === 0
              ? "Create a client first, then add projects."
              : "Try adjusting your filters."}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map((group) => (
            <section key={group.clientName}>
              <h2 className="mb-3 text-sm font-medium text-muted-foreground">
                {group.clientName}{" "}
                <span className="text-muted-foreground/60">
                  ({group.projects.length})
                </span>
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {group.projects.map((project) => (
                  <ProjectCard key={project._id} project={project} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {isAdmin && (
        <ProjectFormDialog
          open={addOpen}
          onOpenChange={setAddOpen}
        />
      )}
    </div>
  )
}
