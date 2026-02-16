"use client"

import { useState } from "react"
import { useQuery, useMutation } from "convex/react"
import { useRouter } from "next/navigation"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { toast } from "sonner"
import { formatDuration } from "@/lib/format"
import { useUndoAction } from "@/hooks/use-undo-action"
import dynamic from "next/dynamic"

const ClientFormDialog = dynamic(() =>
  import("@/components/client-form-dialog").then((m) => ({ default: m.ClientFormDialog }))
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  PlusIcon,
  MoreHorizontalIcon,
  PencilIcon,
  ArchiveIcon,
  ArchiveRestoreIcon,
  TrashIcon,
} from "lucide-react"

export default function ClientsPage() {
  const router = useRouter()
  const me = useQuery(api.users.getMe)
  const [showArchived, setShowArchived] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editId, setEditId] = useState<Id<"clients"> | null>(null)
  const [deleteId, setDeleteId] = useState<Id<"clients"> | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  const clients = useQuery(
    api.clients.list,
    me?.role === "admin"
      ? { includeArchived: showArchived }
      : "skip",
  )
  const archiveClient = useMutation(api.clients.archive)
  const unarchiveClient = useMutation(api.clients.unarchive)
  const removeClient = useMutation(api.clients.remove)
  const { execute: executeUndo } = useUndoAction()

  if (me === undefined) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
    )
  }

  if (me?.role !== "admin") {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
        <p className="text-muted-foreground mt-1">Admin access required.</p>
      </div>
    )
  }

  function handleArchive(clientId: Id<"clients">, clientName: string) {
    executeUndo({
      id: clientId,
      message: `"${clientName}" archived`,
      action: async () => {
        await archiveClient({ id: clientId })
      },
    })
  }

  async function handleUnarchive(clientId: Id<"clients">) {
    try {
      await unarchiveClient({ id: clientId })
      toast.success("Client restored")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    }
  }

  async function handleDelete() {
    if (!deleteId) return
    try {
      await removeClient({ id: deleteId })
      toast.success("Client permanently deleted")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setDeleteConfirmOpen(false)
      setDeleteId(null)
    }
  }

  const isLoading = clients === undefined
  const isEmpty = clients && clients.length === 0 && !showArchived

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
          <p className="text-muted-foreground mt-1">
            Manage your agency clients.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditId(null)
            setFormOpen(true)
          }}
        >
          <PlusIcon className="mr-2 size-4" />
          New Client
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : isEmpty ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <h3 className="text-lg font-medium">No clients yet</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            Create your first client to get started.
          </p>
          <Button
            className="mt-4"
            onClick={() => {
              setEditId(null)
              setFormOpen(true)
            }}
          >
            <PlusIcon className="mr-2 size-4" />
            Create Your First Client
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Switch
              id="show-archived"
              checked={showArchived}
              onCheckedChange={setShowArchived}
            />
            <Label htmlFor="show-archived" className="text-sm">
              Show archived clients
            </Label>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead className="text-right">Active Projects</TableHead>
                  <TableHead className="text-right">Hours This Month</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients?.map((client) => (
                  <TableRow
                    key={client._id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/clients/${client._id}`)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {client.name}
                        {client.isArchived && (
                          <Badge variant="secondary">Archived</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{client.currency}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {client.activeProjectCount}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatDuration(client.minutesThisMonth)}
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
                              setEditId(client._id)
                              setFormOpen(true)
                            }}
                          >
                            <PencilIcon className="mr-2 size-4" />
                            Edit
                          </DropdownMenuItem>
                          {client.isArchived ? (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                handleUnarchive(client._id)
                              }}
                            >
                              <ArchiveRestoreIcon className="mr-2 size-4" />
                              Restore
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                handleArchive(client._id, client.name)
                              }}
                            >
                              <ArchiveIcon className="mr-2 size-4" />
                              Archive
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteId(client._id)
                              setDeleteConfirmOpen(true)
                            }}
                          >
                            <TrashIcon className="mr-2 size-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <ClientFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editId={editId}
      />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Permanently delete this client?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the client and all its projects and
              tasks. This action cannot be undone. If projects have logged time
              entries, deletion will be blocked — archive instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
