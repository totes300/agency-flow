"use client"

import { useState, useCallback } from "react"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { toast } from "sonner"
import { parseDuration } from "@/lib/parse-duration"
import { formatDuration, formatDate } from "@/lib/format"
import { CalendarIcon, Minus, Plus } from "lucide-react"

function todayString() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function dateToString(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function stringToDate(s: string) {
  const [y, m, d] = s.split("-").map(Number)
  return new Date(y, m - 1, d)
}

interface AddTimeFormProps {
  taskId: Id<"tasks">
  hasProject: boolean
  onSuccess?: () => void
  compact?: boolean
}

const PRESETS = [
  { label: "15m", minutes: 15 },
  { label: "30m", minutes: 30 },
  { label: "45m", minutes: 45 },
  { label: "1h", minutes: 60 },
]

export function AddTimeForm({ taskId, hasProject, onSuccess, compact }: AddTimeFormProps) {
  const createEntry = useMutation(api.timeEntries.create)
  const [durationText, setDurationText] = useState("")
  const [date, setDate] = useState(todayString())
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const handlePreset = useCallback((minutes: number) => {
    setDurationText(formatDuration(minutes))
  }, [])

  const handleStep = useCallback(
    (delta: number) => {
      const current = parseDuration(durationText) ?? 0
      const next = Math.max(0, current + delta)
      setDurationText(next > 0 ? formatDuration(next) : "")
    },
    [durationText],
  )

  const handleSubmit = useCallback(async () => {
    const minutes = parseDuration(durationText)
    if (!minutes || minutes <= 0) {
      toast.error("Enter a valid duration (e.g. 1h 30m, 45m, 1:30)")
      return
    }
    setSubmitting(true)
    try {
      await createEntry({ taskId, durationMinutes: minutes, date, note: note.trim() || undefined })
      toast.success(`Added ${formatDuration(minutes)}`)
      setDurationText("")
      setNote("")
      setDate(todayString())
      onSuccess?.()
    } catch (err: unknown) {
      toast.error((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }, [durationText, date, note, taskId, createEntry, onSuccess])

  if (!hasProject) {
    return (
      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        Assign a project to log time
      </div>
    )
  }

  const isToday = date === todayString()

  return (
    <div className="space-y-3">
      {/* Preset chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        {PRESETS.map((p) => (
          <Button
            key={p.label}
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => handlePreset(p.minutes)}
          >
            {p.label}
          </Button>
        ))}
        <div className="mx-1 h-4 w-px bg-border" />
        <Button type="button" variant="outline" size="icon" className="size-7" onClick={() => handleStep(-60)}>
          <Minus className="size-3" />
        </Button>
        <Button type="button" variant="outline" size="icon" className="size-7" onClick={() => handleStep(60)}>
          <Plus className="size-3" />
        </Button>
      </div>

      {/* Duration input */}
      <Input
        value={durationText}
        onChange={(e) => setDurationText(e.target.value)}
        placeholder="e.g. 1h 30m, 45m, 1:30"
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit()
        }}
      />

      {/* Date + Note row */}
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
              <CalendarIcon className="size-3.5" />
              {isToday ? "Today" : formatDate(date)}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={stringToDate(date)}
              onSelect={(d) => {
                if (d) setDate(dateToString(d))
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        {!compact && (
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note"
            className="flex-1 h-8 text-sm"
          />
        )}
      </div>

      <Button
        size="sm"
        onClick={handleSubmit}
        disabled={submitting || !durationText.trim()}
      >
        Add Time
      </Button>
    </div>
  )
}
