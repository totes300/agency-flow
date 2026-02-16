"use client"

import { use, useState } from "react"
import { useQuery, useMutation } from "convex/react"
import { useRouter } from "next/navigation"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { toast } from "sonner"
import { BILLING_TYPE_LABELS } from "@/lib/constants"
import { useUndoAction } from "@/hooks/use-undo-action"
import dynamic from "next/dynamic"

const ClientFormDialog = dynamic(() =>
  import("@/components/client-form-dialog").then((m) => ({ default: m.ClientFormDialog }))
)
const ProjectFormDialog = dynamic(() =>
  import("@/components/project-form-dialog").then((m) => ({ default: m.ProjectFormDialog }))
)
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import {
  PlusIcon,
  PencilIcon,
  MoreHorizontalIcon,
  ArchiveIcon,
  ArchiveRestoreIcon,
} from "lucide-react"

export default function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const clientId = id as Id<"clients">

  const me = useQuery(api.users.getMe)
  const client = useQuery(
    api.clients.get,
    me?.role === "admin" ? { id: clientId } : "skip",
  )
  const projects = useQuery(
    api.projects.listByClient,
    me?.role === "admin"
      ? { clientId, includeArchived: true }
      : "skip",
  )
  const archiveProject = useMutation(api.projects.archive)
  const unarchiveProject = useMutation(api.projects.unarchive)
  const { execute: executeUndo } = useUndoAction()

  const [editClientOpen, setEditClientOpen] = useState(false)
  const [projectFormOpen, setProjectFormOpen] = useState(false)
  const [editProjectId, setEditProjectId] = useState<Id<"projects"> | null>(null)

  if (me === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
    )
  }

  if (me?.role !== "admin") {
    return <p className="text-muted-foreground">Admin access required.</p>
  }

  if (client === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (client === null) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <h2 className="text-lg font-semibold">Client not found</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          This client may have been deleted or the link is invalid.
        </p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/clients")}>
          Back to Clients
        </Button>
      </div>
    )
  }

  function handleArchiveProject(projectId: Id<"projects">, projectName: string) {
    executeUndo({
      id: projectId,
      message: `"${projectName}" archived`,
      action: async () => {
        await archiveProject({ id: projectId })
      },
    })
  }

  async function handleUnarchiveProject(projectId: Id<"projects">) {
    try {
      await unarchiveProject({ id: projectId })
      toast.success("Project restored")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    }
  }

  const activeProjects = projects?.filter((p) => !p.isArchived) ?? []
  const archivedProjects = projects?.filter((p) => p.isArchived) ?? []

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/clients">Clients</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{client.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {client.name}
            </h1>
            <Badge variant="outline">{client.currency}</Badge>
            {client.isArchived && <Badge variant="secondary">Archived</Badge>}
          </div>
          {(client.contactName || client.contactEmail) && (
            <p className="text-muted-foreground mt-1 text-sm">
              {[client.contactName, client.contactEmail]
                .filter(Boolean)
                .join(" — ")}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditClientOpen(true)}>
            <PencilIcon className="mr-2 size-4" />
            Edit Client
          </Button>
          <Button
            onClick={() => {
              setEditProjectId(null)
              setProjectFormOpen(true)
            }}
          >
            <PlusIcon className="mr-2 size-4" />
            New Project
          </Button>
        </div>
      </div>

      {projects && projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <h3 className="text-lg font-medium">No projects yet</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            Create the first project for {client.name}.
          </p>
          <Button
            className="mt-4"
            onClick={() => {
              setEditProjectId(null)
              setProjectFormOpen(true)
            }}
          >
            <PlusIcon className="mr-2 size-4" />
            Create First Project
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {activeProjects.length > 0 && (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeProjects.map((project) => (
                    <TableRow
                      key={project._id}
                      className="cursor-pointer"
                      onClick={() =>
                        router.push(`/projects/${project._id}`)
                      }
                    >
                      <TableCell className="font-medium">
                        {project.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {BILLING_TYPE_LABELS[project.billingType]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {project.billingType === "retainer" &&
                          project.retainerStatus && (
                            <Badge
                              variant={
                                project.retainerStatus === "active"
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {project.retainerStatus === "active"
                                ? "Active"
                                : "Inactive"}
                            </Badge>
                          )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontalIcon className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                handleArchiveProject(
                                  project._id,
                                  project.name,
                                )
                              }}
                            >
                              <ArchiveIcon className="mr-2 size-4" />
                              Archive
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {archivedProjects.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-muted-foreground text-sm font-medium">
                Archived Projects
              </h3>
              <div className="rounded-md border">
                <Table>
                  <TableBody>
                    {archivedProjects.map((project) => (
                      <TableRow key={project._id}>
                        <TableCell className="font-medium text-muted-foreground">
                          {project.name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {BILLING_TYPE_LABELS[project.billingType]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleUnarchiveProject(project._id)
                            }
                          >
                            <ArchiveRestoreIcon className="mr-2 size-4" />
                            Restore
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      )}

      <ClientFormDialog
        open={editClientOpen}
        onOpenChange={setEditClientOpen}
        editId={clientId}
      />

      <ProjectFormDialog
        open={projectFormOpen}
        onOpenChange={setProjectFormOpen}
        clientId={clientId}
        clientCurrency={client.currency}
      />
    </div>
  )
}
