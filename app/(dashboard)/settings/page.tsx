"use client"

import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { useState, useRef, useEffect } from "react"
import { toast } from "sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  PlusIcon,
  ArchiveIcon,
  ArchiveRestoreIcon,
  SettingsIcon,
  TagsIcon,
  BellIcon,
  BlocksIcon,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Tab: Work Categories
// ---------------------------------------------------------------------------
function WorkCategoriesTab() {
  const me = useQuery(api.users.getMe)
  const categories = useQuery(
    api.workCategories.listAll,
    me?.role === "admin" ? {} : "skip",
  )
  const users = useQuery(api.users.listAll, me ? {} : "skip")
  const createCategory = useMutation(api.workCategories.create)
  const renameCategory = useMutation(api.workCategories.rename)
  const archiveCategory = useMutation(api.workCategories.archive)
  const unarchiveCategory = useMutation(api.workCategories.unarchive)
  const seedCategories = useMutation(api.workCategories.seed)
  const setDefaultUser = useMutation(api.workCategories.setDefaultUser)
  const setDefaultCostRate = useMutation(api.workCategories.setDefaultCostRate)
  const setDefaultBillRate = useMutation(api.workCategories.setDefaultBillRate)

  const [newRowId, setNewRowId] = useState<Id<"workCategories"> | null>(null)
  const newRowInputRef = useRef<HTMLInputElement | null>(null)

  // Auto-focus the name input when the new row renders
  useEffect(() => {
    if (newRowId && newRowInputRef.current) {
      newRowInputRef.current.focus()
      newRowInputRef.current.select()
      setNewRowId(null)
    }
  }, [newRowId, categories])

  async function handleCreate() {
    // Generate a unique default name
    const existingNames = new Set(categories?.map((c) => c.name.toLowerCase()) ?? [])
    let name = "New Category"
    let counter = 2
    while (existingNames.has(name.toLowerCase())) {
      name = `New Category ${counter}`
      counter++
    }
    try {
      const id = await createCategory({ name })
      setNewRowId(id)
    } catch (err: unknown) {
      toast.error((err as Error).message)
    }
  }

  async function handleRename(id: Id<"workCategories">, value: string, currentName: string) {
    const trimmed = value.trim()
    if (!trimmed || trimmed === currentName) return
    try {
      await renameCategory({ id, name: trimmed })
    } catch (err: unknown) {
      toast.error((err as Error).message)
    }
  }

  async function handleArchive(id: Id<"workCategories">) {
    try {
      await archiveCategory({ id })
      toast.success("Category archived")
    } catch (err: unknown) {
      toast.error((err as Error).message)
    }
  }

  async function handleUnarchive(id: Id<"workCategories">) {
    try {
      await unarchiveCategory({ id })
      toast.success("Category restored")
    } catch (err: unknown) {
      toast.error((err as Error).message)
    }
  }

  async function handleSetDefaultUser(
    categoryId: Id<"workCategories">,
    userId: string,
  ) {
    try {
      await setDefaultUser({
        id: categoryId,
        userId: userId === "__none__" ? undefined : (userId as Id<"users">),
      })
      toast.success("Default member updated")
    } catch (err: unknown) {
      toast.error((err as Error).message)
    }
  }

  async function handleSetCostRate(id: Id<"workCategories">, value: string) {
    const rate = value.trim() === "" ? undefined : parseFloat(value)
    if (rate !== undefined && (isNaN(rate) || rate < 0)) return
    try {
      await setDefaultCostRate({ id, rate })
    } catch (err: unknown) {
      toast.error((err as Error).message)
    }
  }

  async function handleSetBillRate(id: Id<"workCategories">, value: string) {
    const rate = value.trim() === "" ? undefined : parseFloat(value)
    if (rate !== undefined && (isNaN(rate) || rate < 0)) return
    try {
      await setDefaultBillRate({ id, rate })
    } catch (err: unknown) {
      toast.error((err as Error).message)
    }
  }

  async function handleSeed() {
    try {
      await seedCategories({})
      toast.success("Default categories created")
    } catch (err: unknown) {
      toast.error((err as Error).message)
    }
  }

  const isEmpty = categories && categories.length === 0

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <h3 className="text-lg font-medium">No categories yet</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          Seed default categories to get started, or create your own.
        </p>
        <Button className="mt-4" onClick={handleSeed}>
          Seed Default Categories
        </Button>
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Default Member</TableHead>
            <TableHead className="w-[100px]">Cost/hr</TableHead>
            <TableHead className="w-[100px]">Bill/hr</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[60px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categories?.map((category) => (
            <TableRow key={category._id}>
              <TableCell>
                <Input
                  key={category._id + "-name-" + category.name}
                  ref={category._id === newRowId ? newRowInputRef : undefined}
                  defaultValue={category.name}
                  onBlur={(e) => handleRename(category._id, e.target.value, category.name)}
                  className="h-8 w-40 font-medium"
                />
              </TableCell>
              <TableCell>
                <Select
                  value={category.defaultUserId ?? "__none__"}
                  onValueChange={(v) =>
                    handleSetDefaultUser(category._id, v)
                  }
                >
                  <SelectTrigger className="h-8 w-40">
                    <SelectValue>
                      {category.defaultUserName ?? "— None —"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— None —</SelectItem>
                    {users?.map((u) => (
                      <SelectItem key={u._id} value={u._id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Input
                  key={category._id + "-cost-" + (category.defaultCostRate ?? "")}
                  type="number"
                  min="0"
                  defaultValue={category.defaultCostRate ?? ""}
                  onBlur={(e) => handleSetCostRate(category._id, e.target.value)}
                  placeholder="—"
                  className="h-8 w-20"
                />
              </TableCell>
              <TableCell>
                <Input
                  key={category._id + "-bill-" + (category.defaultBillRate ?? "")}
                  type="number"
                  min="0"
                  defaultValue={category.defaultBillRate ?? ""}
                  onBlur={(e) => handleSetBillRate(category._id, e.target.value)}
                  placeholder="—"
                  className="h-8 w-20"
                />
              </TableCell>
              <TableCell>
                <Badge variant={category.isArchived ? "secondary" : "default"}>
                  {category.isArchived ? "Archived" : "Active"}
                </Badge>
              </TableCell>
              <TableCell>
                {category.isArchived ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleUnarchive(category._id)}
                  >
                    <ArchiveRestoreIcon className="size-4" />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleArchive(category._id)}
                  >
                    <ArchiveIcon className="size-4" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={6} className="bg-transparent">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground h-8 -ml-2"
                onClick={handleCreate}
              >
                <PlusIcon className="mr-1.5 size-3.5" />
                Add Category
              </Button>
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab: General
// ---------------------------------------------------------------------------
function GeneralTab() {
  const settings = useQuery(api.workspaceSettings.get)
  const updateSettings = useMutation(api.workspaceSettings.update)

  async function handleRateBlur(value: string) {
    const rate = value.trim() === "" ? undefined : parseFloat(value)
    if (rate !== undefined && (isNaN(rate) || rate < 0)) return
    try {
      await updateSettings({ defaultHourlyRate: rate })
      toast.success("Default hourly rate saved")
    } catch (err: unknown) {
      toast.error((err as Error).message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="default-hourly-rate">Default Hourly Rate</Label>
        <p className="text-muted-foreground text-sm">
          Pre-fills the hourly rate when creating new T&M projects.
        </p>
        <Input
          id="default-hourly-rate"
          key={"rate-" + (settings?.defaultHourlyRate ?? "")}
          type="number"
          min="0"
          defaultValue={settings?.defaultHourlyRate ?? ""}
          onBlur={(e) => handleRateBlur(e.target.value)}
          placeholder="e.g., 120"
          className="w-40"
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab: Notifications (placeholder)
// ---------------------------------------------------------------------------
function NotificationsTab() {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-muted-foreground text-sm">
          Notification preferences will appear here — email digests, in-app
          notification rules, and mention settings.
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab: Integrations (placeholder)
// ---------------------------------------------------------------------------
function IntegrationsTab() {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-muted-foreground text-sm">
          Integration settings will appear here — connected services, API keys,
          and webhook configurations.
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Settings page shell
// ---------------------------------------------------------------------------

const settingsTabs = [
  {
    value: "general",
    label: "General",
    icon: SettingsIcon,
    description: "Workspace preferences",
  },
  {
    value: "categories",
    label: "Work Categories",
    icon: TagsIcon,
    description: "Task types & defaults",
  },
  {
    value: "notifications",
    label: "Notifications",
    icon: BellIcon,
    description: "Alerts & digests",
  },
  {
    value: "integrations",
    label: "Integrations",
    icon: BlocksIcon,
    description: "Connected services",
  },
]

export default function SettingsPage() {
  const me = useQuery(api.users.getMe)

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
        <h1 className="text-2xl font-semibold tracking-tight">Access Denied</h1>
        <p className="text-muted-foreground mt-1">Admin access required.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your workspace configuration.
        </p>
      </div>

      <Separator className="mb-8" />

      <Tabs
        defaultValue="categories"
        orientation="vertical"
        className="gap-0"
      >
        <TabsList variant="line" className="w-52 shrink-0 items-stretch pr-6">
          {settingsTabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="justify-start gap-3 px-3 py-2.5 h-auto"
            >
              <tab.icon className="size-4 shrink-0" />
              <div className="flex flex-col items-start text-left">
                <span className="text-sm font-medium leading-none">
                  {tab.label}
                </span>
                <span className="text-muted-foreground text-xs font-normal mt-1 leading-none">
                  {tab.description}
                </span>
              </div>
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="border-l pl-10 flex-1 min-w-0 max-w-3xl">
          <TabsContent value="general">
            <div className="space-y-1 mb-6">
              <h2 className="text-lg font-semibold">General</h2>
              <p className="text-muted-foreground text-sm">
                Configure workspace-wide preferences.
              </p>
            </div>
            <GeneralTab />
          </TabsContent>

          <TabsContent value="categories">
            <div className="space-y-1 mb-6">
              <h2 className="text-lg font-semibold">Work Categories</h2>
              <p className="text-muted-foreground text-sm">
                Manage global work categories and their default team members.
              </p>
            </div>
            <WorkCategoriesTab />
          </TabsContent>

          <TabsContent value="notifications">
            <div className="space-y-1 mb-6">
              <h2 className="text-lg font-semibold">Notifications</h2>
              <p className="text-muted-foreground text-sm">
                Control how and when you receive notifications.
              </p>
            </div>
            <NotificationsTab />
          </TabsContent>

          <TabsContent value="integrations">
            <div className="space-y-1 mb-6">
              <h2 className="text-lg font-semibold">Integrations</h2>
              <p className="text-muted-foreground text-sm">
                Connect external services and manage API access.
              </p>
            </div>
            <IntegrationsTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
