"use client"

import { useState, useCallback, useMemo, useRef } from "react"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { toast } from "sonner"
import { parseDuration } from "@/lib/parse-duration"
import { formatDuration, formatDate } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { CalendarIcon } from "lucide-react"

const QUICK_ADD_PRESETS = [
  { label: "15m", minutes: 15 },
  { label: "30m", minutes: 30 },
  { label: "45m", minutes: 45 },
  { label: "1h", minutes: 60 },
  { label: "2h", minutes: 120 },
  { label: "3h", minutes: 180 },
  { label: "4h", minutes: 240 },
  { label: "6h", minutes: 360 },
  { label: "8h", minutes: 480 },
]

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

interface AddTimeSectionProps {
  taskId: Id<"tasks">
  hasProject: boolean
  /** When true, hides date picker (used in timer dropdown). Default false. */
  compact?: boolean
}

export function AddTimeSection({ taskId, hasProject, compact = false }: AddTimeSectionProps) {
  const createEntry = useMutation(api.timeEntries.create)
  const [customInput, setCustomInput] = useState("")
  const [note, setNote] = useState("")
  const [date, setDate] = useState(todayString)
  const inputRef = useRef<HTMLInputElement>(null)

  const today = useMemo(() => todayString(), [])

  const effectiveDate = compact ? today : date

  const handleQuickAdd = useCallback(
    async (minutes: number, label: string) => {
      try {
        await createEntry({
          taskId,
          durationMinutes: minutes,
          date: effectiveDate,
          note: note.trim() || undefined,
        })
        toast.success(`Added ${label}`)
        setNote("")
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Something went wrong")
      }
    },
    [createEntry, taskId, effectiveDate, note],
  )

  const handleCustomAdd = useCallback(async () => {
    const minutes = parseDuration(customInput)
    if (!minutes || minutes <= 0) {
      toast.error("Enter a valid duration (e.g. 30m, 2h, 1h 30m)")
      return
    }
    try {
      await createEntry({
        taskId,
        durationMinutes: minutes,
        date: effectiveDate,
        note: note.trim() || undefined,
      })
      toast.success(`Added ${formatDuration(minutes)}`)
      setCustomInput("")
      setNote("")
      if (!compact) setDate(todayString())
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    }
  }, [createEntry, taskId, effectiveDate, customInput, note, compact])

  if (!hasProject) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        Assign a project to log time
      </div>
    )
  }

  const isToday = date === today

  return (
    <div className="space-y-2">
      {/* ── Visual card grouping ── */}
      <div className="rounded-lg border bg-muted/30 p-3 space-y-2.5">
        {/* Row 1: Date picker + preset buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          {!compact && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs shrink-0 bg-background">
                  <CalendarIcon className="size-3" />
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
          )}
          {!compact && <div className="h-4 w-px bg-border shrink-0" />}
          {QUICK_ADD_PRESETS.map((preset) => (
            <Button
              key={preset.label}
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-xs bg-background"
              onClick={() => handleQuickAdd(preset.minutes, preset.label)}
            >
              {preset.label}
            </Button>
          ))}
        </div>

        {/* Row 2: Custom duration input */}
        <Input
          ref={inputRef}
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              handleCustomAdd()
            }
          }}
          placeholder="e.g. 1h 30m"
          className="h-8 text-xs bg-background"
        />

        {/* Row 3: Note */}
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && customInput.trim()) {
              e.preventDefault()
              handleCustomAdd()
            }
          }}
          placeholder="Optional note"
          className="h-8 text-xs bg-background"
        />

        {/* Row 4: Full-width Add button */}
        <Button
          className="w-full h-8 text-xs"
          onClick={handleCustomAdd}
          disabled={!customInput.trim()}
        >
          Add
        </Button>
      </div>

      {/* Format hint — outside the card */}
      <p className="text-[10px] text-muted-foreground px-0.5">
        Formats: 30m, 2h, 1h 30m, 1.5h, 1:30
      </p>
    </div>
  )
}
