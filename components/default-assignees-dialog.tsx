"use client"

import { useState, useEffect } from "react"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PlusIcon, RotateCcwIcon, CheckIcon, XIcon } from "lucide-react"

interface DefaultAssigneesDialogProps {
  projectId: Id<"projects">
  defaultAssignees: Array<{
    workCategoryId: Id<"workCategories">
    userId: Id<"users">
  }>
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DefaultAssigneesDialog({
  projectId,
  defaultAssignees,
  open,
  onOpenChange,
}: DefaultAssigneesDialogProps) {
  const categories = useQuery(api.workCategories.list, {})
  const users = useQuery(api.users.listAll, {})
  const setDefaultAssignees = useMutation(api.projects.setDefaultAssignees)
  const createCategory = useMutation(api.workCategories.create)

  const [draft, setDraft] = useState<Map<string, string>>(new Map())
  const [newCategoryName, setNewCategoryName] = useState("")
  const [addingCategory, setAddingCategory] = useState(false)

  useEffect(() => {
    if (open) {
      const m = new Map<string, string>()
      for (const a of defaultAssignees) {
        m.set(a.workCategoryId, a.userId)
      }
      setDraft(m)
      setNewCategoryName("")
      setAddingCategory(false)
    }
  }, [open, defaultAssignees])

  function getDraftValue(categoryId: string, globalDefaultUserId: string | null): string {
    if (draft.has(categoryId)) {
      return draft.get(categoryId)!
    }
    return globalDefaultUserId ?? "__none__"
  }

  function handleChange(categoryId: string, value: string, globalDefaultUserId: string | null) {
    const newDraft = new Map(draft)
    if (value === "__none__") {
      newDraft.delete(categoryId)
    } else if (value === globalDefaultUserId) {
      newDraft.delete(categoryId)
    } else {
      newDraft.set(categoryId, value)
    }
    setDraft(newDraft)
  }

  function resetRow(categoryId: string) {
    const newDraft = new Map(draft)
    newDraft.delete(categoryId)
    setDraft(newDraft)
  }

  function resetAll() {
    setDraft(new Map())
  }

  async function handleAddCategory() {
    if (!newCategoryName.trim()) return
    try {
      await createCategory({ name: newCategoryName })
      setNewCategoryName("")
      setAddingCategory(false)
      toast.success("Category created")
    } catch (err: unknown) {
      toast.error((err as Error).message)
    }
  }

  async function handleSave() {
    const overrides: Array<{
      workCategoryId: Id<"workCategories">
      userId: Id<"users">
    }> = []
    for (const [categoryId, userId] of draft) {
      overrides.push({
        workCategoryId: categoryId as Id<"workCategories">,
        userId: userId as Id<"users">,
      })
    }

    try {
      await setDefaultAssignees({ projectId, defaultAssignees: overrides })
      onOpenChange(false)
      toast.success("Default assignees saved")
    } catch (err: unknown) {
      toast.error((err as Error).message)
    }
  }

  const hasOverrides = draft.size > 0
  const catList = categories ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Default Assignees</DialogTitle>
          <DialogDescription>
            Assign default team members per work category. Project overrides take priority over global defaults.
          </DialogDescription>
        </DialogHeader>

        {/* Table */}
        <div className="overflow-hidden rounded-lg border">
          {/* Column headers */}
          <div className="bg-muted/50 grid grid-cols-[1fr_1fr_36px] text-muted-foreground text-xs font-medium">
            <div className="px-3 py-2">Category</div>
            <div className="border-l px-3 py-2">Assignee</div>
            <div />
          </div>

          {/* Rows */}
          {catList.map((cat, i) => {
            const globalDefault = cat.defaultUserId ?? null
            const currentValue = getDraftValue(cat._id, globalDefault)
            const isOverride = draft.has(cat._id)

            return (
              <div
                key={cat._id}
                className={cn(
                  "grid grid-cols-[1fr_1fr_36px] items-center border-t transition-colors hover:bg-muted/30",
                  isOverride && "bg-muted/20",
                )}
              >
                {/* Category name */}
                <div className="truncate px-3 py-2 text-sm">
                  {cat.name}
                </div>

                {/* Assignee select — borderless, blends into row */}
                <div className="border-l">
                  <Select
                    value={currentValue}
                    onValueChange={(v) => handleChange(cat._id, v, globalDefault)}
                  >
                    <SelectTrigger className="h-auto w-full rounded-none border-0 bg-transparent py-2 pl-3 shadow-none focus-visible:ring-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">
                        <span className="text-muted-foreground">— None —</span>
                      </SelectItem>
                      {users?.map((u) => (
                        <SelectItem key={u._id} value={u._id}>
                          {u.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Reset override */}
                <div className="flex items-center justify-center">
                  {isOverride && (
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground flex size-7 items-center justify-center rounded-md transition-colors"
                      onClick={() => resetRow(cat._id)}
                      title="Reset to global default"
                    >
                      <RotateCcwIcon className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}

          {/* Add category row */}
          {addingCategory ? (
            <div className="grid grid-cols-[1fr_auto_36px] items-center border-t">
              <div className="px-1.5 py-1.5">
                <Input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddCategory()
                    if (e.key === "Escape") {
                      setAddingCategory(false)
                      setNewCategoryName("")
                    }
                  }}
                  placeholder="Category name..."
                  className="h-8"
                  autoFocus
                />
              </div>
              <div className="flex items-center gap-1 pr-1.5">
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground flex size-7 items-center justify-center rounded-md transition-colors disabled:opacity-40"
                  onClick={handleAddCategory}
                  disabled={!newCategoryName.trim()}
                >
                  <CheckIcon className="size-4" />
                </button>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground flex size-7 items-center justify-center rounded-md transition-colors"
                  onClick={() => {
                    setAddingCategory(false)
                    setNewCategoryName("")
                  }}
                >
                  <XIcon className="size-4" />
                </button>
              </div>
              <div />
            </div>
          ) : (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground hover:bg-muted/30 flex w-full items-center border-t px-3 py-2 text-sm transition-colors"
              onClick={() => setAddingCategory(true)}
            >
              <PlusIcon className="mr-1.5 size-3.5" />
              Add category
            </button>
          )}
        </div>

        <DialogFooter className="flex-row items-center sm:justify-between">
          <div>
            {hasOverrides && (
              <Button variant="ghost" size="sm" onClick={resetAll} className="text-muted-foreground">
                <RotateCcwIcon className="mr-1.5 size-3" />
                Reset all
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
