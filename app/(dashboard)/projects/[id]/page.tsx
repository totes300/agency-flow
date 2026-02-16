"use client"

import { use, useState } from "react"
import { useQuery, useMutation } from "convex/react"
import { useRouter } from "next/navigation"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import dynamic from "next/dynamic"

const FixedProjectDetail = dynamic(() =>
  import("@/components/project-detail-fixed").then((m) => ({ default: m.FixedProjectDetail }))
)
const RetainerProjectDetail = dynamic(() =>
  import("@/components/project-detail-retainer").then((m) => ({ default: m.RetainerProjectDetail }))
)
const TmProjectDetail = dynamic(() =>
  import("@/components/project-detail-tm").then((m) => ({ default: m.TmProjectDetail }))
)
const DefaultAssigneesDialog = dynamic(() =>
  import("@/components/default-assignees-dialog").then((m) => ({ default: m.DefaultAssigneesDialog }))
)
const ProjectFormDialog = dynamic(() =>
  import("@/components/project-form-dialog").then((m) => ({ default: m.ProjectFormDialog }))
)
import { useUndoAction } from "@/hooks/use-undo-action"
import { BILLING_TYPE_LABELS } from "@/lib/constants"
import { PencilIcon, MoreHorizontalIcon, ArchiveIcon, ArchiveRestoreIcon, UsersIcon } from "lucide-react"

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const projectId = id as Id<"projects">

  const router = useRouter()
  const me = useQuery(api.users.getMe)
  const project = useQuery(
    api.projects.get,
    me ? { id: projectId } : "skip",
  )

  const [editOpen, setEditOpen] = useState(false)
  const [assigneesOpen, setAssigneesOpen] = useState(false)
  const archiveProject = useMutation(api.projects.archive)
  const unarchiveProject = useMutation(api.projects.unarchive)
  const { execute: undoExecute } = useUndoAction()

  if (project === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (project === null) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <h2 className="text-lg font-semibold">Project not found</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          This project may have been deleted or the link is invalid.
        </p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/projects")}>
          Back to Projects
        </Button>
      </div>
    )
  }

  const isAdmin = me?.role === "admin"

  function handleArchive() {
    undoExecute({
      id: `archive-project-${projectId}`,
      message: `"${project!.name}" will be archived`,
      action: async () => {
        await archiveProject({ id: projectId })
      },
    })
  }

  async function handleUnarchive() {
    try {
      await unarchiveProject({ id: projectId })
    } catch (err: unknown) {
      const { toast } = await import("sonner")
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    }
  }

  return (
    <div className="space-y-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/projects">Projects</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href={`/clients/${project.clientId}`}>
              {project.clientName}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{project.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {project.name}
            </h1>
            <Badge variant="outline">
              {BILLING_TYPE_LABELS[project.billingType]}
            </Badge>
            {project.isArchived && <Badge variant="secondary">Archived</Badge>}
            {project.billingType === "retainer" && project.retainerStatus && (
              <Badge
                variant={
                  project.retainerStatus === "active" ? "default" : "secondary"
                }
              >
                {project.retainerStatus === "active" ? "Active" : "Inactive"}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            {project.clientName} &middot; {project.clientCurrency}
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAssigneesOpen(true)}
            >
              <UsersIcon className="mr-1 size-3.5" />
              Assignees
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditOpen(true)}
            >
              <PencilIcon className="mr-1 size-3.5" />
              Edit
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8">
                  <MoreHorizontalIcon className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {project.isArchived ? (
                  <DropdownMenuItem onClick={handleUnarchive}>
                    <ArchiveRestoreIcon className="mr-2 size-4" />
                    Unarchive
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={handleArchive}>
                    <ArchiveIcon className="mr-2 size-4" />
                    Archive
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Type-specific detail view */}
      {project.billingType === "fixed" && (
        <FixedProjectDetail
          categoryEstimates={project.categoryEstimates}
          currency={project.clientCurrency}
          isAdmin={isAdmin}
        />
      )}

      {project.billingType === "retainer" && (
        <RetainerProjectDetail
          projectId={projectId}
          currency={project.clientCurrency}
          isAdmin={isAdmin}
        />
      )}

      {project.billingType === "t_and_m" && (
        <TmProjectDetail
          project={project}
          currency={project.clientCurrency}
          isAdmin={isAdmin}
        />
      )}

      {/* Dialogs (admin only) */}
      {isAdmin && (
        <DefaultAssigneesDialog
          projectId={projectId}
          defaultAssignees={project.defaultAssignees ?? []}
          open={assigneesOpen}
          onOpenChange={setAssigneesOpen}
        />
      )}
      {isAdmin && (
        <ProjectFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          clientId={project.clientId}
          clientCurrency={project.clientCurrency}
          project={{
            _id: projectId,
            name: project.name,
            billingType: project.billingType,
            hourlyRate: project.hourlyRate,
            tmCategoryRates: project.tmCategoryRates,
            includedHoursPerMonth: project.includedHoursPerMonth,
            overageRate: project.overageRate,
            rolloverEnabled: project.rolloverEnabled,
            startDate: project.startDate,
            categoryEstimates: project.categoryEstimates,
          }}
        />
      )}
    </div>
  )
}
