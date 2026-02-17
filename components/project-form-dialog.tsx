"use client"

import { useState, useEffect } from "react"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
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
import { PlusIcon, XIcon, AlertCircleIcon } from "lucide-react"

interface ExistingProject {
  _id: Id<"projects">
  name: string
  billingType: "fixed" | "retainer" | "t_and_m"
  hourlyRate?: number
  tmCategoryRates?: Array<{
    workCategoryId: string
    workCategoryName?: string
    rate: number
  }>
  includedHoursPerMonth?: number
  overageRate?: number
  rolloverEnabled?: boolean
  startDate?: string
  categoryEstimates?: Array<{
    _id: string
    workCategoryId: string
    workCategoryName: string
    estimatedMinutes: number
    internalCostRate?: number
    clientBillingRate?: number
    actualMinutes: number
  }>
}

interface ProjectFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientId?: Id<"clients">
  clientCurrency?: string
  project?: ExistingProject
}

interface CategoryEstimate {
  workCategoryId: Id<"workCategories">
  estimatedHours: string
  internalCostRate: string
  clientBillingRate: string
}

interface TmCategoryRate {
  workCategoryId: Id<"workCategories">
  rate: string
}

export function ProjectFormDialog({
  open,
  onOpenChange,
  clientId: clientIdProp,
  clientCurrency: clientCurrencyProp,
  project,
}: ProjectFormDialogProps) {
  const isEditMode = !!project

  const [name, setName] = useState("")
  const [billingType, setBillingType] = useState<"fixed" | "retainer" | "t_and_m">("fixed")
  const [submitting, setSubmitting] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState<Id<"clients"> | "">(clientIdProp ?? "")

  // Fetch clients for the picker when no clientId is provided
  const clients = useQuery(api.clients.list, !clientIdProp && open ? {} : "skip")

  const clientId = clientIdProp ?? (selectedClientId || undefined)
  const selectedClient = clients?.find((c) => c._id === selectedClientId)
  const clientCurrency = clientCurrencyProp ?? selectedClient?.currency ?? "USD"

  // Retainer fields
  const [includedHours, setIncludedHours] = useState("")
  const [overageRate, setOverageRate] = useState("")
  const [rolloverEnabled, setRolloverEnabled] = useState(true)
  const [startDate, setStartDate] = useState("")

  // Confirmation dialogs
  const [rolloverConfirmOpen, setRolloverConfirmOpen] = useState(false)
  const [pendingRolloverValue, setPendingRolloverValue] = useState(false)

  // T&M fields
  const [hourlyRate, setHourlyRate] = useState("")
  const [useCategoryRates, setUseCategoryRates] = useState(false)
  const [tmCategoryRates, setTmCategoryRates] = useState<TmCategoryRate[]>([])

  // Fixed fields
  const [categoryEstimates, setCategoryEstimates] = useState<CategoryEstimate[]>([])

  // Fetch workspace default hourly rate for new T&M projects
  const workspaceSettings = useQuery(
    api.workspaceSettings.get,
    open && !isEditMode ? {} : "skip",
  )

  const categories = useQuery(api.workCategories.listAll, open ? {} : "skip")
  const createProject = useMutation(api.projects.create)
  const updateProject = useMutation(api.projects.update)
  const setCategoryEstimatesMutation = useMutation(api.projects.setCategoryEstimates)
  const seedCategories = useMutation(api.workCategories.seed)

  const activeCategories = categories?.filter((c) => !c.isArchived)
  const hasCategories = activeCategories !== undefined && activeCategories.length > 0
  const categoriesLoaded = categories !== undefined

  // Reset / pre-fill form when dialog opens
  useEffect(() => {
    if (!open) return

    setSelectedClientId(clientIdProp ?? "")

    if (project) {
      setName(project.name)
      setBillingType(project.billingType)

      setIncludedHours(
        project.includedHoursPerMonth
          ? String(project.includedHoursPerMonth / 60)
          : "",
      )
      setOverageRate(
        project.overageRate !== undefined ? String(project.overageRate) : "",
      )
      setRolloverEnabled(project.rolloverEnabled ?? true)
      setStartDate(project.startDate ?? "")

      setHourlyRate(
        project.hourlyRate !== undefined ? String(project.hourlyRate) : "",
      )
      const hasCatRates =
        project.tmCategoryRates && project.tmCategoryRates.length > 0
      setUseCategoryRates(!!hasCatRates)
      setTmCategoryRates(
        hasCatRates
          ? project.tmCategoryRates!.map((r) => ({
              workCategoryId: r.workCategoryId as Id<"workCategories">,
              rate: String(r.rate),
            }))
          : [],
      )

      setCategoryEstimates(
        project.categoryEstimates?.map((e) => ({
          workCategoryId: e.workCategoryId as Id<"workCategories">,
          estimatedHours: String(e.estimatedMinutes / 60),
          internalCostRate:
            e.internalCostRate !== undefined ? String(e.internalCostRate) : "",
          clientBillingRate:
            e.clientBillingRate !== undefined
              ? String(e.clientBillingRate)
              : "",
        })) ?? [],
      )
    } else {
      setName("")
      setBillingType("fixed")
      setIncludedHours("")
      setOverageRate("")
      setRolloverEnabled(true)
      // Default to 1st of current month
      const now = new Date()
      setStartDate(
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`,
      )
      setHourlyRate("")
      setUseCategoryRates(false)
      setTmCategoryRates([])
      setCategoryEstimates([])
    }
  }, [open, project, clientIdProp])

  // Pre-fill hourly rate from workspace settings for new T&M projects
  useEffect(() => {
    if (
      !open ||
      isEditMode ||
      hourlyRate !== "" ||
      !workspaceSettings?.defaultHourlyRate
    )
      return
    setHourlyRate(String(workspaceSettings.defaultHourlyRate))
  }, [open, isEditMode, hourlyRate, workspaceSettings])

  function addCategoryEstimate() {
    if (!categories?.length) return
    const usedIds = new Set(categoryEstimates.map((e) => e.workCategoryId))
    const available = categories.find((c) => !c.isArchived && !usedIds.has(c._id))
    if (!available) return
    setCategoryEstimates([
      ...categoryEstimates,
      {
        workCategoryId: available._id,
        estimatedHours: "",
        internalCostRate: available.defaultCostRate != null ? String(available.defaultCostRate) : "",
        clientBillingRate: available.defaultBillRate != null ? String(available.defaultBillRate) : "",
      },
    ])
  }

  function removeCategoryEstimate(index: number) {
    setCategoryEstimates(categoryEstimates.filter((_, i) => i !== index))
  }

  function addTmCategoryRate() {
    if (!categories?.length) return
    const usedIds = new Set(tmCategoryRates.map((r) => r.workCategoryId))
    const available = categories.find((c) => !c.isArchived && !usedIds.has(c._id))
    if (!available) return
    setTmCategoryRates([
      ...tmCategoryRates,
      {
        workCategoryId: available._id,
        rate: available.defaultBillRate != null ? String(available.defaultBillRate) : "",
      },
    ])
  }

  function removeTmCategoryRate(index: number) {
    setTmCategoryRates(tmCategoryRates.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)

    if (!clientId) return

    try {
      if (isEditMode) {
        await updateProject({
          id: project._id,
          name,
          ...(billingType === "retainer"
            ? {
                includedHoursPerMonth: Math.round(
                  parseFloat(includedHours || "0") * 60,
                ),
                overageRate: overageRate ? parseFloat(overageRate) : undefined,
                rolloverEnabled,
                startDate: startDate || undefined,
              }
            : {}),
          ...(billingType === "t_and_m"
            ? {
                hourlyRate:
                  !useCategoryRates && hourlyRate
                    ? parseFloat(hourlyRate)
                    : undefined,
                tmCategoryRates:
                  useCategoryRates && tmCategoryRates.length > 0
                    ? tmCategoryRates
                        .filter((r) => r.rate)
                        .map((r) => ({
                          workCategoryId: r.workCategoryId,
                          rate: parseFloat(r.rate),
                        }))
                    : undefined,
              }
            : {}),
        })

        if (billingType === "fixed") {
          await setCategoryEstimatesMutation({
            projectId: project._id,
            estimates: categoryEstimates
              .filter((e) => e.estimatedHours)
              .map((e) => ({
                workCategoryId: e.workCategoryId,
                estimatedMinutes: Math.round(
                  parseFloat(e.estimatedHours) * 60,
                ),
                internalCostRate: e.internalCostRate
                  ? parseFloat(e.internalCostRate)
                  : undefined,
                clientBillingRate: e.clientBillingRate
                  ? parseFloat(e.clientBillingRate)
                  : undefined,
              })),
          })
        }

        toast.success("Project updated")
      } else {
        const projectId = await createProject({
          clientId,
          name,
          billingType,
          ...(billingType === "retainer"
            ? {
                includedHoursPerMonth: Math.round(
                  parseFloat(includedHours || "0") * 60,
                ),
                overageRate: overageRate ? parseFloat(overageRate) : undefined,
                rolloverEnabled,
                startDate: startDate || undefined,
              }
            : {}),
          ...(billingType === "t_and_m"
            ? {
                hourlyRate:
                  !useCategoryRates && hourlyRate
                    ? parseFloat(hourlyRate)
                    : undefined,
                tmCategoryRates:
                  useCategoryRates && tmCategoryRates.length > 0
                    ? tmCategoryRates
                        .filter((r) => r.rate)
                        .map((r) => ({
                          workCategoryId: r.workCategoryId,
                          rate: parseFloat(r.rate),
                        }))
                    : undefined,
              }
            : {}),
        })

        if (billingType === "fixed" && categoryEstimates.length > 0) {
          await setCategoryEstimatesMutation({
            projectId,
            estimates: categoryEstimates
              .filter((e) => e.estimatedHours)
              .map((e) => ({
                workCategoryId: e.workCategoryId,
                estimatedMinutes: Math.round(
                  parseFloat(e.estimatedHours) * 60,
                ),
                internalCostRate: e.internalCostRate
                  ? parseFloat(e.internalCostRate)
                  : undefined,
                clientBillingRate: e.clientBillingRate
                  ? parseFloat(e.clientBillingRate)
                  : undefined,
              })),
          })
        }

        toast.success("Project created")
      }

      onOpenChange(false)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSubmitting(false)
    }
  }

  const noCategoriesPrompt = categoriesLoaded && !hasCategories && (
    <div className="flex items-start gap-3 rounded-lg border border-dashed p-4">
      <AlertCircleIcon className="text-muted-foreground mt-0.5 size-5 shrink-0" />
      <div className="space-y-2">
        <p className="text-sm">
          No work categories exist yet. Create them first.
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            onClick={async () => {
              try {
                await seedCategories({})
                toast.success("Default categories created")
              } catch (err: unknown) {
                toast.error(err instanceof Error ? err.message : "Something went wrong")
              }
            }}
          >
            Seed Defaults
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.open("/settings", "_blank")}
          >
            Manage Categories
          </Button>
        </div>
      </div>
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Edit Project" : "New Project"}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? `Update project settings. Rates are in ${clientCurrency}.`
              : `Create a new project. Rates are in ${clientCurrency}.`}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Client picker (when not provided via props) */}
          {!clientIdProp && (
            <div className="space-y-2">
              <Label>Client</Label>
              <Select
                value={selectedClientId as string}
                onValueChange={(v) => setSelectedClientId(v as Id<"clients">)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a client..." />
                </SelectTrigger>
                <SelectContent>
                  {clients?.filter((c) => !c.isArchived).map((c) => (
                    <SelectItem key={c._id} value={c._id}>
                      {c.name} ({c.currency})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Project name */}
          <div className="space-y-2">
            <Label htmlFor="project-name">Project Name</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Website Redesign"
              required
              autoFocus
            />
          </div>

          {/* Billing type */}
          <div className="space-y-2">
            <Label>Billing Type</Label>
            {isEditMode ? (
              <p className="text-muted-foreground text-sm">
                {billingType === "fixed"
                  ? "Fixed"
                  : billingType === "retainer"
                    ? "Retainer"
                    : "T&M"}{" "}
                — cannot be changed after creation.
              </p>
            ) : (
              <Tabs
                value={billingType}
                onValueChange={(v) => setBillingType(v as typeof billingType)}
              >
                <TabsList className="w-full">
                  <TabsTrigger value="fixed" className="flex-1">
                    Fixed
                  </TabsTrigger>
                  <TabsTrigger value="retainer" className="flex-1">
                    Retainer
                  </TabsTrigger>
                  <TabsTrigger value="t_and_m" className="flex-1">
                    T&M
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            )}
          </div>

          {/* ── Fixed billing type fields ── */}
          {billingType === "fixed" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Category Estimates</Label>
                {hasCategories && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addCategoryEstimate}
                    disabled={categoryEstimates.length >= activeCategories.length}
                  >
                    <PlusIcon className="mr-1.5 size-3.5" />
                    Add
                  </Button>
                )}
              </div>

              {noCategoriesPrompt}

              {hasCategories && categoryEstimates.length === 0 && (
                <p className="text-muted-foreground text-sm">
                  No category estimates yet. Click &quot;Add&quot; to track hours
                  and rates per work type.
                </p>
              )}

              <div className="space-y-2">
                {categoryEstimates.map((est, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border p-3 space-y-2.5"
                  >
                    {/* Row 1: Category select + remove */}
                    <div className="flex items-center gap-2">
                      <Select
                        value={est.workCategoryId}
                        onValueChange={(v) => {
                          const updated = [...categoryEstimates]
                          const oldCat = categories?.find((c) => c._id === est.workCategoryId)
                          const newCat = categories?.find((c) => c._id === v)
                          updated[idx].workCategoryId = v as Id<"workCategories">
                          // Auto-update rates if they still match the old category's defaults
                          const oldCostStr = oldCat?.defaultCostRate != null ? String(oldCat.defaultCostRate) : ""
                          const oldBillStr = oldCat?.defaultBillRate != null ? String(oldCat.defaultBillRate) : ""
                          if (est.internalCostRate === oldCostStr) {
                            updated[idx].internalCostRate = newCat?.defaultCostRate != null ? String(newCat.defaultCostRate) : ""
                          }
                          if (est.clientBillingRate === oldBillStr) {
                            updated[idx].clientBillingRate = newCat?.defaultBillRate != null ? String(newCat.defaultBillRate) : ""
                          }
                          setCategoryEstimates(updated)
                        }}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {activeCategories
                            ?.filter(
                              (c) =>
                                c._id === est.workCategoryId ||
                                !categoryEstimates.some(
                                  (e, i) =>
                                    i !== idx && e.workCategoryId === c._id,
                                ),
                            )
                            .map((c) => (
                              <SelectItem key={c._id} value={c._id}>
                                {c.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive size-8 shrink-0"
                        onClick={() => removeCategoryEstimate(idx)}
                      >
                        <XIcon className="size-3.5" />
                      </Button>
                    </div>
                    {/* Row 2: Hours + Cost/hr + Bill/hr */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label className="text-muted-foreground text-xs">Hours</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.5"
                          value={est.estimatedHours}
                          onChange={(e) => {
                            const updated = [...categoryEstimates]
                            updated[idx].estimatedHours = e.target.value
                            setCategoryEstimates(updated)
                          }}
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground text-xs">Cost/hr</Label>
                        <Input
                          type="number"
                          min="0"
                          value={est.internalCostRate}
                          onChange={(e) => {
                            const updated = [...categoryEstimates]
                            updated[idx].internalCostRate = e.target.value
                            setCategoryEstimates(updated)
                          }}
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground text-xs">Bill/hr</Label>
                        <Input
                          type="number"
                          min="0"
                          value={est.clientBillingRate}
                          onChange={(e) => {
                            const updated = [...categoryEstimates]
                            updated[idx].clientBillingRate = e.target.value
                            setCategoryEstimates(updated)
                          }}
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Retainer billing type fields ── */}
          {billingType === "retainer" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="included-hours">Hours / Month</Label>
                  <Input
                    id="included-hours"
                    type="number"
                    min="1"
                    step="0.5"
                    value={includedHours}
                    onChange={(e) => setIncludedHours(e.target.value)}
                    placeholder="e.g., 10"
                    required={billingType === "retainer"}
                  />
                  {isEditMode && (project?.includedHoursPerMonth ?? 0) > 0 && includedHours && (
                    Math.round(parseFloat(includedHours) * 60) !== (project?.includedHoursPerMonth ?? 0)
                  ) && (
                    <p className="text-muted-foreground text-xs">
                      This applies to all months. For mid-project rate changes, contact support.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="overage-rate">
                    Overage ({clientCurrency}/hr)
                  </Label>
                  <Input
                    id="overage-rate"
                    type="number"
                    min="0"
                    value={overageRate}
                    onChange={(e) => setOverageRate(e.target.value)}
                    placeholder="e.g., 150"
                  />
                  {isEditMode && project?.overageRate !== undefined && overageRate && (
                    Math.abs(Number(overageRate) - Number(project?.overageRate ?? 0)) > 0.001
                  ) && (
                    <p className="text-muted-foreground text-xs">
                      This applies to all months. For mid-project rate changes, contact support.
                    </p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="start-date">Cycle Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <p className="text-muted-foreground text-xs">
                  Determines 3-month cycle alignment for rollover calculation.
                </p>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="rollover-enabled" className="text-sm font-medium">
                    Rollover enabled
                  </Label>
                  <p className="text-muted-foreground text-xs">
                    {rolloverEnabled
                      ? "Hours roll over within 3-month cycles"
                      : "Each month settles independently"}
                  </p>
                </div>
                <Switch
                  id="rollover-enabled"
                  checked={rolloverEnabled}
                  onCheckedChange={(checked) => {
                    if (isEditMode && project?.rolloverEnabled !== undefined && checked !== project.rolloverEnabled) {
                      setPendingRolloverValue(checked)
                      setRolloverConfirmOpen(true)
                    } else {
                      setRolloverEnabled(checked)
                    }
                  }}
                />
              </div>
            </div>
          )}

          {/* ── T&M billing type fields ── */}
          {billingType === "t_and_m" && (
            <div className="space-y-4">
              <Tabs
                value={useCategoryRates ? "category" : "single"}
                onValueChange={(v) => setUseCategoryRates(v === "category")}
              >
                <TabsList className="w-full">
                  <TabsTrigger value="single" className="flex-1">
                    Single Rate
                  </TabsTrigger>
                  <TabsTrigger value="category" className="flex-1">
                    Per-Category
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {!useCategoryRates ? (
                <div className="space-y-2">
                  <Label htmlFor="hourly-rate">
                    Hourly Rate ({clientCurrency}/hr)
                  </Label>
                  <Input
                    id="hourly-rate"
                    type="number"
                    min="0"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(e.target.value)}
                    placeholder="e.g., 100"
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Category Rates</Label>
                    {hasCategories && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addTmCategoryRate}
                        disabled={tmCategoryRates.length >= activeCategories.length}
                      >
                        <PlusIcon className="mr-1.5 size-3.5" />
                        Add
                      </Button>
                    )}
                  </div>

                  {noCategoriesPrompt}

                  <div className="space-y-2">
                    {tmCategoryRates.map((r, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2"
                      >
                        <Select
                          value={r.workCategoryId}
                          onValueChange={(v) => {
                            const updated = [...tmCategoryRates]
                            const oldCat = categories?.find((c) => c._id === r.workCategoryId)
                            const newCat = categories?.find((c) => c._id === v)
                            updated[idx].workCategoryId =
                              v as Id<"workCategories">
                            // Auto-update rate if it still matches the old category's default
                            const oldRateStr = oldCat?.defaultBillRate != null ? String(oldCat.defaultBillRate) : ""
                            if (r.rate === oldRateStr) {
                              updated[idx].rate = newCat?.defaultBillRate != null ? String(newCat.defaultBillRate) : ""
                            }
                            setTmCategoryRates(updated)
                          }}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {activeCategories
                              ?.filter(
                                (c) =>
                                  c._id === r.workCategoryId ||
                                  !tmCategoryRates.some(
                                    (cr, i) =>
                                      i !== idx &&
                                      cr.workCategoryId === c._id,
                                  ),
                              )
                              .map((c) => (
                                <SelectItem key={c._id} value={c._id}>
                                  {c.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <div className="flex items-center gap-1.5">
                          <Input
                            type="number"
                            min="0"
                            value={r.rate}
                            onChange={(e) => {
                              const updated = [...tmCategoryRates]
                              updated[idx].rate = e.target.value
                              setTmCategoryRates(updated)
                            }}
                            placeholder="0"
                            className="w-24"
                          />
                          <span className="text-muted-foreground text-xs shrink-0">/hr</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive size-8 shrink-0"
                          onClick={() => removeTmCategoryRate(idx)}
                        >
                          <XIcon className="size-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !name.trim() || !clientId}>
              {isEditMode ? "Save Changes" : "Create Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      {/* Rollover change confirmation dialog */}
      <AlertDialog open={rolloverConfirmOpen} onOpenChange={setRolloverConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change rollover setting?</AlertDialogTitle>
            <AlertDialogDescription>
              This will recompute all historical balances and settlement amounts. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setRolloverEnabled(pendingRolloverValue)
                setRolloverConfirmOpen(false)
              }}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}
