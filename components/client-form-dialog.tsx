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

const CURRENCIES = [
  { code: "EUR", label: "EUR - Euro" },
  { code: "USD", label: "USD - US Dollar" },
  { code: "HUF", label: "HUF - Hungarian Forint" },
  { code: "GBP", label: "GBP - British Pound" },
]

interface ClientFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editId?: Id<"clients"> | null
}

export function ClientFormDialog({
  open,
  onOpenChange,
  editId,
}: ClientFormDialogProps) {
  const [name, setName] = useState("")
  const [contactName, setContactName] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [currency, setCurrency] = useState("EUR")
  const [submitting, setSubmitting] = useState(false)

  const client = useQuery(
    api.clients.get,
    editId ? { id: editId } : "skip",
  )
  const currencyLocked = useQuery(
    api.clients.isCurrencyLocked,
    editId ? { id: editId } : "skip",
  )

  const createClient = useMutation(api.clients.create)
  const updateClient = useMutation(api.clients.update)

  // Populate form when editing
  useEffect(() => {
    if (client) {
      setName(client.name)
      setContactName(client.contactName ?? "")
      setContactEmail(client.contactEmail ?? "")
      setCurrency(client.currency)
    } else if (!editId) {
      setName("")
      setContactName("")
      setContactEmail("")
      setCurrency("EUR")
    }
  }, [client, editId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)

    try {
      if (editId) {
        await updateClient({
          id: editId,
          name,
          contactName: contactName || undefined,
          contactEmail: contactEmail || undefined,
          currency,
        })
        toast.success("Client updated")
      } else {
        await createClient({
          name,
          contactName: contactName || undefined,
          contactEmail: contactEmail || undefined,
          currency,
        })
        toast.success("Client created")
      }
      onOpenChange(false)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editId ? "Edit Client" : "New Client"}</DialogTitle>
          <DialogDescription>
            {editId
              ? "Update client details."
              : "Add a new client to your agency."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="client-name">Company Name</Label>
            <Input
              id="client-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Acme Corp"
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-name">Contact Name</Label>
            <Input
              id="contact-name"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="e.g., John Doe"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-email">Contact Email</Label>
            <Input
              id="contact-email"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="e.g., john@acme.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            {currencyLocked ? (
              <div className="flex items-center gap-2">
                <Input value={currency} disabled />
                <span className="text-muted-foreground text-xs whitespace-nowrap">
                  Locked (has projects)
                </span>
              </div>
            ) : (
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !name.trim()}>
              {editId ? "Save Changes" : "Create Client"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
